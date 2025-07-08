# from django.conf import settings
# from django.core.mail import EmailMultiAlternatives
# from django.template.loader import render_to_string
# from celery import shared_task
# import datetime as _dt
# from django.utils import timezone

# # --------------------------------------------------
# # 内部ヘルパー  ※ Celery タスクではありません
# # --------------------------------------------------
# def _fmt_time(t):
#     """
#     datetime | time | None  -> 'HH:MM'
#     * DateTimeField の場合は settings.TIME_ZONE に変換してから表示
#     """
#     if not t:
#         return "-"

#     if isinstance(t, _dt.datetime):
#         t = timezone.localtime(t)            # ← ここで JST へ
#         return t.strftime("%H:%M")

#     # TimeField（tz なし）の想定
#     return t.strftime("%H:%M")

# def _build_rows(record):
#     """
#     メール本文に渡す (label, value) のタプル一覧を返す。
#     duration が None の場合はダッシュを表示。
#     record.duration は「ミリ秒」でも「分」でも対応。
#     """
#     # duration → 分単位の文字列を作成
#     if record.duration is None:
#         dur_txt = "-"
#     else:
#         # ミリ秒なら 60_000 で割る / すでに分ならそのまま
#         minutes = record.duration / 60_000 if record.duration > 10000 else record.duration
#         dur_txt = f"{minutes:.1f} 分" if isinstance(minutes, float) else f"{minutes} 分"

#     return [
#         ("教科",  record.subject.name),
#         ("課題",  record.task.name),
#         ("開始",  _fmt_time(record.start_time)),
#         ("終了",  _fmt_time(record.end_time)),
#         ("合計",  dur_txt),
#     ]


# # --------------------------------------------------
# # Celery Task  – ここだけ @shared_task ！
# # --------------------------------------------------
# @shared_task(name="record_notification.send")
# def send_record_notification(record_id: str):
#     from main.models import Record
#     rec = Record.objects.get(pk=record_id)
#     print(f"✉️ TASK start pk={rec.pk} state={rec.timer_state}")

# # def send_record_notification(record_id: str) -> None:
#     """
#     timer_state が 2 になったレコードの完了通知を
#     チームメンバー（本人除く）へ HTML メールで送信
#     """
#     from .models import Record, TeamMembership   # 遅延 import

#     # レコード取得
#     record = (
#         Record.objects
#         .select_related("user", "subject", "task", "team")
#         .get(pk=record_id)
#     )

#     team = record.team
#     if not team:
#         return   # チームに属していない個人用レコードは通知しない

#     # 本人を除くチームメンバーのメールアドレス
#     recipients = (
#         TeamMembership.objects
#         .filter(team=team)
#         .exclude(user=record.user)
#         .values_list("user__email", flat=True)
#     )
#     recipients = [e for e in recipients if e]   # 空文字メールは除外
#     if not recipients:
#         return

#     # メール本文用コンテキスト
#     context = {
#         "record":       record,
#         "frontend_url": settings.FRONTEND_URL,   # settings.py に必ず定義
#         "rows":         _build_rows(record),
#     }

#     subject = f"[Torail] {record.user.username} さんがタイマーを完了しました"

#     # HTML 本文（txt 版も欲しければ別テンプレートを用意）
#     html_body = render_to_string("mail/record_done.html", context)

#     message = EmailMultiAlternatives(
#         subject=subject,
#         body="HTML メールを表示できるクライアントでご覧ください。",
#         from_email=settings.DEFAULT_FROM_EMAIL,
#         to=list(recipients),
#     )
#     message.attach_alternative(html_body, "text/html")
#     message.send()

# main/tasks.py  ─ Celery タスク群
from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

from .models import Record, TeamMembership


@shared_task(name="record_notification.send")
def send_record_notification(record_id: str) -> None:
    """
    レコードが真に「完了状態 (timer_state==2)」かつ
    チームに属している場合のみ HTML メールを送信する。
    """

    # ───────── ① レコードを再取得して最終状態を確認 ─────────
    record = (
        Record.objects
        .select_related("user", "subject", "task", "team")
        .filter(pk=record_id, timer_state=2)     # ← ★ 二重チェック！
        .first()
    )
    if not record or not record.team:
        # レコードが消えている / 未完了 / 個人用 なら何もしない
        return

    # ───────── ② 本人以外のチームメンバーを取得 ─────────
    recipients = (
        TeamMembership.objects
        .filter(team=record.team)
        .exclude(user=record.user)               # 自分は除外
        .values_list("user__email", flat=True)
    )
    recipients = [e for e in recipients if e]    # 空メールアドレスを除外
    if not recipients:
        return

    # ───────── ③ メール本文用コンテキスト ─────────
    def fmt_time(t):
        """datetime or time → 'HH:MM'／None→'-'（JST 揃え）"""
        from django.utils import timezone
        import datetime as _dt

        if not t:
            return "-"
        if isinstance(t, _dt.datetime):
            t = timezone.localtime(t)            # settings.TIME_ZONE へ
        return t.strftime("%H:%M")

    if record.duration is None:
        dur_txt = "-"
    else:
        minutes = record.duration / 60_000 if record.duration > 10000 else record.duration
        dur_txt = f"{minutes:.1f} 分" if isinstance(minutes, float) else f"{minutes} 分"

    context = {
        "record": record,
        "frontend_url": settings.FRONTEND_URL,
        "rows": [
            ("教科",  record.subject.name),
            ("課題",  record.task.name),
            ("開始",  fmt_time(record.start_time)),
            ("終了",  fmt_time(record.end_time)),
            ("合計",  dur_txt),
        ],
    }

    # ───────── ④ メール送信 ─────────
    subject = f"[Torail] {record.user.username} さんがタイマーを完了しました"
    html_body = render_to_string("mail/record_done.html", context)

    msg = EmailMultiAlternatives(
        subject=subject,
        body="HTML メール対応クライアントでご覧ください。",
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=list(recipients),
    )
    msg.attach_alternative(html_body, "text/html")
    msg.send()
