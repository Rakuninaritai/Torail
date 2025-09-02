# main/tasks.py
from __future__ import annotations

import datetime as _dt
from typing import Iterable, List

from celery import shared_task
from celery.utils.log import get_task_logger
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone
from slack_sdk.web import WebClient
import re

from .models import Record, TeamMembership, Integration
import requests

logger = get_task_logger(__name__)

# ------------------------------
# 共通ヘルパ
# ------------------------------
def _fmt_time(t):
    if not t:
        return "-"
    if isinstance(t, _dt.datetime):
        t = timezone.localtime(t)
    return t.strftime("%H:%M")

def _fmt_minutes(duration):
    if duration is None:
        return "-"
    # 1万超えはミリ秒想定、それ以外は分
    minutes = duration / 60_000 if duration > 10_000 else duration
    # 少数なら1桁
    return f"{minutes:.1f}" if isinstance(minutes, float) else f"{minutes}"
def _email_recipients(rec: Record) -> list[str]:

    """
    本人以外のメンバーのメールを厳しめに抽出（空文字/空白/NULLを除外）。
    """
    qs = (
        TeamMembership.objects
        .filter(team=rec.team)
        .exclude(user=rec.user)
        .values_list("user__email", flat=True)
    )
    recipients = []
    for e in qs:
        if not e:
            continue
        e2 = e.strip()
        if not e2:
            continue
        recipients.append(e2)
    return recipients

def _ascii_table_for_slack(rec: Record) -> str:
    rows = [
        ("ユーザー",   rec.user.username),
        ("教科",       rec.subject.name),
        ("課題",       rec.task.name),
        ("開始",       _fmt_time(rec.start_time)),
        ("終了",       _fmt_time(rec.end_time)),
        ("合計(分)",   _fmt_minutes(rec.duration)),
    ]
    key_w = max(len(k) for k, _ in rows)
    val_w = max(len(str(v)) for _, v in rows)
    border = f"+{'-'*(key_w+2)}+{'-'*(val_w+2)}+"
    lines = [border] + [f"| {k.ljust(key_w)} | {str(v).ljust(val_w)} |" for k, v in rows] + [border]

    link = f"{settings.FRONTEND_URL.rstrip('/')}/records/{rec.id}"
    title = f"【Torail】{rec.user.username} さんがタイマーを完了しました（チーム: {rec.team.name}）"
    return f"*{title}*\n```{'\n'.join(lines)}```\n詳細: {link}"

def _get_available_providers(rec: Record) -> List[str]:
    """
    チームの Integration とメール到達性から、利用可能なチャンネルを列挙。
    候補: 'slack', 'discord', 'email'
    """
    provs = set()
    if rec.team:
        if Integration.objects.filter(team=rec.team, provider="slack").exists():
            provs.add("slack")
        if Integration.objects.filter(team=rec.team, provider="discord").exists():
            provs.add("discord")
        # メールは実際に送信に使う抽出ロジックと揃える
        if _email_recipients(rec):
            provs.add("email")
    return list(provs)

def _choose_modes(rec: Record) -> List[str]:
    """
    送信先選択:
      1) team.notify_mode が 'slack'/'discord'/'email' のとき → その1つだけ（利用不可なら空）
      2) 'off' → 送らない
      3) 'auto'（既定） → 既存の優先度 CSV（settings or team側に将来拡張）で1つだけ
    """
    available = set(_get_available_providers(rec))
    if not available:
        return []

    team = rec.team
    mode = (team.notify_mode or "auto").lower()

    if mode in ("slack", "discord", "email"):
        return [m for m in [mode] if m in available]

    if mode == "off":
        return []

    # auto
    prio_csv = getattr(settings, "TORAIL_NOTIFY_PRIORITY", "slack,email,discord")
    for m in [p.strip() for p in prio_csv.split(",") if p.strip()]:
        if m in available:
            return [m]
    return []

# ------------------------------
# メール
# ------------------------------
@shared_task(name="record_notification.send")
def send_record_notification(record_id: str) -> None:
    logger.info(f"📬 send_record_notification start: record_id={record_id}")

    record = (
        Record.objects
        .select_related("user", "subject", "task", "team")
        .filter(pk=record_id, timer_state=2)
        .first()
    )
    if not record or not record.team:
        return

    recipients = _email_recipients(record)
    if not recipients:
        return

    if record.duration is None:
        dur_txt = "-"
    else:
        minutes = record.duration / 60_000 if record.duration > 10_000 else record.duration
        dur_txt = f"{minutes:.1f} 分" if isinstance(minutes, float) else f"{minutes} 分"

    context = {
        "record": record,
        "frontend_url": settings.FRONTEND_URL,
        "rows": [
            ("教科",  record.subject.name),
            ("課題",  record.task.name),
            ("開始",  _fmt_time(record.start_time)),
            ("終了",  _fmt_time(record.end_time)),
            ("合計",  dur_txt),
        ],
    }

    subject = f"[Torail] {record.user.username} さんがタイマーを完了しました"
    html_body = render_to_string("mail/record_done.html", context)

    msg = EmailMultiAlternatives(
        subject=subject,
        body="HTML メール対応クライアントでご覧ください。",
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=list(recipients),
    )
    msg.attach_alternative(html_body, "text/html")
    try:
        msg.send()
        logger.info(f"✅ メール送信成功: to={recipients}")
    except Exception as e:
        logger.error(f"❌ メール送信失敗: {e}", exc_info=True)

# ------------------------------
# Slack（ASCII表）
# ------------------------------
@shared_task(autoretry_for=(Exception,), retry_backoff=True, max_retries=5, name="record_notification.slack")
def notify_slack_team(record_id: str) -> bool:
    rec = (
        Record.objects
        .select_related("user", "subject", "task", "team")
        .filter(pk=record_id, timer_state=2)
        .first()
    )
    if not rec or not rec.team:
        return False

    integ = Integration.objects.filter(team=rec.team, provider="slack").first()
    if not (integ and integ.access_token and integ.channel_id):
        return False

    text = _ascii_table_for_slack(rec)
    client = WebClient(token=integ.access_token)
    client.chat_postMessage(
        channel=integ.channel_id,
    text="Torail 完了通知",
    blocks=[
        {"type": "section", "text": {"type": "mrkdwn",
         "text": f"*【Torail】{rec.user.username} さんがタイマーを完了しました（チーム: {rec.team.name}）*"}},
        {"type": "section", "fields": [
            {"type": "mrkdwn", "text": f"*ユーザー*\n{rec.user.username}"},
            {"type": "mrkdwn", "text": f"*教科*\n{rec.subject.name}"},
            {"type": "mrkdwn", "text": f"*課題*\n{rec.task.name}"},
            {"type": "mrkdwn", "text": f"*合計(分)*\n{_fmt_minutes(rec.duration)}"},
            {"type": "mrkdwn", "text": f"*開始*\n{_fmt_time(rec.start_time)}"},
            {"type": "mrkdwn", "text": f"*終了*\n{_fmt_time(rec.end_time)}"},
        ]},
        # description がある場合だけ別セクションで表示
       *([{"type": "section", "text": {"type": "mrkdwn",
           "text": f"*内容*\n{rec.description}"}}] if rec.description else []),
        {"type": "context", "elements": [
            # {"type": "mrkdwn", "text": f"詳細: {settings.FRONTEND_URL.rstrip('/')}/records/{rec.id}"}
            {"type": "mrkdwn", "text": f"詳細: {settings.FRONTEND_URL.rstrip('/')}/records/{rec.id}/"}
        ]}
    ]
    )
    logger.info(f"✅ Slack post ok: team={rec.team_id} channel={integ.channel_id}")
    return True

# ------------------------------
# Discord（Bot）
# ------------------------------
def _discord_embed_for_record(rec: Record) -> dict:
    """
    Web/モバイル両方で崩れにくいEmbed
    - 可変長は inline にしない
    - inline は常に2個1組（開始/終了）
    - URLはtitleに付与（可能なら本番は https）
    """
    title = f"【Torail】{rec.user.username} さんがタイマーを完了しました（チーム: {rec.team.name}）"
    url = f"{settings.FRONTEND_URL.rstrip('/')}/records/{rec.id}"

    # 可変長は description に寄せる（太字ラベルで読みやすく）
    desc_lines = [
        f"**ユーザー**: {rec.user.username}",
        f"**教科**: {rec.subject.name}",
        f"**課題**: {rec.task.name}",
    ]
    if rec.description:
        # 説明は長いので最後に（Discord上限: 4096）
        desc_lines.append(f"**内容**: {rec.description}")

    fields = [
        # 2個1組で inline にする（モバイル2列に揃う）
        {"name": "開始",     "value": _fmt_time(rec.start_time),  "inline": True},
        {"name": "終了",     "value": _fmt_time(rec.end_time),    "inline": True},
        # 合計は1行で見せる（段ズレ防止）
        {"name": "合計(分)", "value": _fmt_minutes(rec.duration), "inline": False},
    ]

    return {
        "title": title,
        "url": url,                 # タイトルにリンク付与
        "type": "rich",
        "description": "\n".join(desc_lines),
        "fields": fields,
        "footer": {"text": "Torail"},
        # "color": 0x5865F2,        # 任意：色を付けたい場合
    }


@shared_task(autoretry_for=(Exception,), retry_backoff=True, max_retries=5, name="record_notification.discord")
def notify_discord_team(record_id: str) -> bool:
    """
    provider='discord' の Integration 経由で、Bot Token を使って
    指定 channel_id にメッセージを送る（Webhookは使わない）。
    """
    rec = (
        Record.objects
        .select_related("user", "subject", "task", "team")
        .filter(pk=record_id, timer_state=2)
        .first()
    )
    if not rec or not rec.team:
        return False

    integ = Integration.objects.filter(team=rec.team, provider="discord").first()
    # access_token ← Bot Token を保存しておく前提（または settings.DISCORD_BOT_TOKEN を使う）
    bot_token = (integ.access_token if integ and integ.access_token else getattr(settings, "DISCORD_BOT_TOKEN", None))
    channel_id = integ.channel_id if integ else None

    if not (bot_token and channel_id):
        return False

    api = f"https://discord.com/api/v10/channels/{channel_id}/messages"
    headers = {
        "Authorization": f"Bot {bot_token}",
        "Content-Type": "application/json"
    }
    payload = {
        # フォールバック兼、Embedなしクライアント対策の一言
        "content": "Torail 完了通知",
        "embeds": [_discord_embed_for_record(rec)],
        "allowed_mentions": {"parse": []},  # 誤メンション防止
    }

    r = requests.post(api, json=payload, headers=headers, timeout=10)
    # 429: レート制限、403: 権限なし、404: チャンネル無し
    if r.status_code == 429:
        # Celery の autoretry に任せるため例外化
        retry_after = r.json().get("retry_after", 1)
        raise Exception(f"Discord rate limited. retry_after={retry_after}")
    if r.status_code >= 400:
        raise Exception(f"Discord post failed: {r.status_code} {r.text}")

    logger.info(f"✅ Discord post ok: team={rec.team_id} channel={channel_id}")
    return True

# ------------------------------
# ディスパッチ（送信先を決めるのはここ一か所）
# ------------------------------
@shared_task(name="record_notification.dispatch")
def dispatch_record_notification(record_id: str) -> None:
    rec = Record.objects.select_related("team").filter(pk=record_id, timer_state=2).first()
    if not rec or not rec.team:
        return

    modes = _choose_modes(rec)
    if not modes:
        logger.info(f"ℹ️ 通知スキップ: no available provider (team={rec.team_id})")
        return

    logger.info(f"🚚 dispatch to: {modes}")
    for m in modes:
        if m == "email":
            send_record_notification.delay(record_id)
        elif m == "slack":
            notify_slack_team.delay(record_id)
        elif m == "discord":
            notify_discord_team.delay(record_id)
