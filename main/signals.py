# main/signals.py
from django.db.models.signals import pre_save, post_save
from django.db import transaction
from django.dispatch import receiver

from .models import Record
from .tasks import send_record_notification


@receiver(pre_save, sender=Record)
def remember_old_state(sender, instance: Record, **kwargs):
    """
    保存前に **DB 上の timer_state** を一時的に instance に保持しておく。
    - 新規作成 (instance._state.adding == True) の場合は旧値が存在しないのでスキップ。
    """
    if instance._state.adding:                       # INSERT 時はまだ DB に行が無い
        instance._old_timer_state = None
        return

    # 既存レコードの場合だけ旧値を取得 (.only で SELECT 節約)
    old_state_qs = (
        sender.objects
        .only("timer_state")
        .filter(pk=instance.pk)
        .values_list("timer_state", flat=True)
    )
    instance._old_timer_state = old_state_qs.first()   # 取れなければ None


@receiver(post_save, sender=Record)
def record_timer_finished(sender, instance: Record, created: bool, **kwargs):
    """
    旧 state → 新 state が **0/1 → 2** になった時だけ通知を飛ばす。
    Celery ジョブは transaction.on_commit で “コミット完了後” に実行キューへ。
    """
    if created:
        return  # 新規レコードは対象外

    old_state = getattr(instance, "_old_timer_state", None)

    if old_state != 2 and instance.timer_state == 2:
        transaction.on_commit(
            lambda: send_record_notification.delay(str(instance.pk))
        )
