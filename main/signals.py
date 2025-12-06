# ============================================================
# Django シグナルハンドラー - 通知トリガーのエントリーポイント
# ============================================================
# 
# 【役割】
# ------
# Django の post_save, pre_save シグナルを使うことで、
# モデルの保存時に「自動的に」処理を実行する仕組み。
# 
# このファイルは通知フローの「最初の1歩」を担当します。
# 「タイマーが完了（timer_state=2）に変わった」 → 「Celeryキューに追加」
#
# 【メリット】
# ----------
# - views.py には通知ロジックを書かない（責任分離）
# - モデル保存時に「自動的に」トリガーされる
# - テストやadmin画面でも同じロジックが走る
#

from django.db.models.signals import pre_save, post_save
from django.db import transaction
from django.dispatch import receiver

from .models import Record
from .tasks import dispatch_record_notification


@receiver(pre_save, sender=Record)
def remember_old_state(sender, instance: Record, **kwargs):
    """
    【タイミング】保存前（INSERT/UPDATE 前）
    
    【役割】
    ------
    「UPDATE 前の古い state」を一時的に instance に保存しておく。
    例：old=1 → new=2 に変わったかを detection したい。
    
    post_save では new state 情報しか無いため、
    ここで「変更前の値」をキャプチャしておく必要がある
    変わったことを検知するために。
    
    【処理フロー】
    -----------
    1. 新規作成 (INSERT) の場合？
       → DB に行がまだ無いので、旧値もない
       → _old_timer_state = None でスキップ
    
    2. UPDATE の場合
       → DB から古い timer_state を取得
       → instance._old_timer_state に一時保存
    
    【NOTE】
    ------
    instance に自由に属性を追加できるのは Django の便利な点。
    post_save で取り出すまで、この _old_timer_state が保持される。
    """
    if instance._state.adding:
        # INSERT 時はまだ DB に行が無い
        instance._old_timer_state = None
        return

    # 既存レコードの場合だけ旧値を取得 (.only で SELECT 節約)
    old_state_qs = (
        sender.objects
        .only("timer_state")
        .filter(pk=instance.pk)
        .values_list("timer_state", flat=True)
    )
    instance._old_timer_state = old_state_qs.first()


@receiver(post_save, sender=Record)
def record_timer_finished(sender, instance: Record, created: bool, **kwargs):
    """
    【タイミング】保存後（INSERT/UPDATE が DB に反映された直後）
    
    【役割】
    ------
    タイマーが完了（timer_state → 2）に変わったら、
    非同期タスク (Celery) をキューに追加して、
    通知処理（メール/Slack/Discord）を実行開始させる。
    
    【条件】
    -----
    ✓ UPDATE のみ対象（created=False）
      → 新規作成時は通知しない
    
    ✓ チーム未所属はスキップ
      → 個人チーム等で不要な通知を削減
    
    ✓ old_state != 2 AND new_state == 2 のみ
      → 0/1/None → 2 に遷移したときだけ
      → 2 → 2 は既に通知済みなのでスキップ
    
    【処理フロー】
    -----------
    1. INSERT 時 → return（新規作成は通知なし）
    2. チーム未所属 → return（通知先がない）
    3. タイマー完了（0/1 → 2） → Celery キューに追加
    
    【重要】
    ------
    transaction.on_commit() を使うことで、
    「DB のコミット完了後に」タスク追加が実行される。
    こうすることで、データが確実に DB に保存されてから
    Celery Worker が検索・処理することができる。
    
    もし on_commit() を使わないと、
    Worker が先に走って Record が見つからない可能性がある！
    """
    if created:
        return  # 新規レコードは対象外
    
    # チーム未所属レコードはそもそも通知しない（無駄キュー削減）
    if not instance.team_id:
        return

    old_state = getattr(instance, "_old_timer_state", None)

    # 0/1/None → 2 に遷移したときだけ
    if old_state != 2 and instance.timer_state == 2:
        rid = str(instance.pk)
        # 送信先（メール/Slack/Discord）は tasks 側で集約判定
        # .delay() = Celery にキューイング
        transaction.on_commit(lambda: dispatch_record_notification.delay(rid))
