# ============================================================
# Celery 非同期タスク - 通知実行エンジン
# ============================================================
#
# 【概要】
# -------
# signals.py で Celery キューに追加されたタスクを実際に「実行」する場所。
# 以下の3つの通知方式をサポート：
#   1. メール送信（Django の EmailMultiAlternatives）
#   2. Slack 送信（slack_sdk ライブラリ経由）
#   3. Discord 送信（API 直叩き）
#
# 【実行フロー再掲】
# --------
# 1. dispatch_record_notification.delay(record_id)
#    ↓ Celery Worker が取得
# 2. _choose_modes(rec) で送信先を決定
#    - team.notify_mode を参照
#    - 設定された通知方式が利用可能か確認
#    ↓
# 3. 該当タスクを .delay() で追加
#    - send_record_notification.delay(record_id)      # メール
#    - notify_slack_team.delay(record_id)             # Slack
#    - notify_discord_team.delay(record_id)           # Discord
#    それぞれの処理は各viewsを参照
#    ↓ Worker が実行
# 4. 実際にメール/API 呼び出しを実行
#    ↓
# 5. ユーザー通知完了！
#

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

# ============================================================
# ヘルパ関数群（データ整形・フォーマット）
# ============================================================

def _fmt_time(t):
    """
    時間を HH:MM 形式で整形。
    """
    if not t:
        return "-"
    if isinstance(t, _dt.datetime):
        t = timezone.localtime(t)
    return t.strftime("%H:%M")

def _fmt_langs(rec: Record) -> str:
    """
    Record.languages の名前を '、' 区切りで返す。無ければ '-'
    
    複数の言語に対応（例："JavaScript、Python、Go"）
    """
    try:
        names = list(rec.languages.values_list('name', flat=True))
    except Exception:
        # 念のためフォールバック
        names = [getattr(l, 'name', '') for l in getattr(rec, 'languages', [])]
    names = [n for n in names if n]
    return "、".join(names) if names else "-"

def _minutes(ms) -> float:
    """
    ミリ秒を分に変換。
    """
    try:
        return 0.0 if not ms or ms <= 0 else ms / 60000.0
    except Exception:
        return 0.0

def _fmt_minutes(ms) -> str:
    """
    ミリ秒を分で表示（小数1桁）。
    例：120000ms → "2.0"
    """
    return f"{_minutes(ms):.1f}"

def _email_recipients(rec: Record) -> list[str]:
    """
    チームメンバーのメールを抽出（本人は除外）。
    
    【フィルタ】
    - 本人を除外（exclude(user=rec.user)）
    - 空またはNULLを除外
    - 空白のみも除外
    
    【返す値】
    バリデーション済みメールリスト
    例：["user1@example.com", "user2@example.com"]
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
    """
    Slack 用の ASCII テーブル形式テキストを生成。
    例：
    +----------+-----------+
    | ユーザー | user1     |
    | トピック | Python    |
    +----------+-----------+
    ...
    """
    rows = [
        ("ユーザー",   rec.user.username),
        ("トピック",       rec.subject.name),
        ("タスク",       rec.task.name),
        ("言語",       _fmt_langs(rec)),
        ("開始",       _fmt_time(rec.start_time)),
        ("終了",       _fmt_time(rec.end_time)),
        ("合計(分)",   f"{_fmt_minutes(rec.duration)} 分"),
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
    【役割】
    --------
    チーム設定から「実際に利用可能な通知方式」を判定。
    
    【判定ロジック】
    ---------------
    1. Slack
       → Integration.objects.filter(team=rec.team, provider="slack")
       → Access Token が登録されているか？
       → YES ならサポート対象
    
    2. Discord
       → Integration.objects.filter(team=rec.team, provider="discord")
       → Bot Token + channel_id が登録されているか？
       → YES ならサポート対象
    
    3. メール
       → _email_recipients(rec) が空でないか？
       → チームメンバー（本人以外）が有効なメール持ってるか？
       → YES ならサポート対象
    
    【返す値】
    ['slack', 'discord', 'email'] の部分集合。
    例：['slack', 'email']
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
    【重要な関数】送信先を「1つ」選定。
    
    【ロジック】
    -----------
    Team.notify_mode の値に基づいて送信先を決定：
    
    A. mode = 'slack' / 'discord' / 'email'
       → その通知方式「のみ」を使う
       → ただし利用不可ならスキップ
    
    B. mode = 'off'
       → 通知なし
    
    C. mode = 'auto' または未設定
       → 優先度 CSV に従って「最初に利用可能なもの」を選ぶ
       → デフォルト優先度：settings.TORAIL_NOTIFY_PRIORITY
       → 例："slack,email,discord"
       → 読み方：Slack が使えたら Slack、
         使えなければメール、それも無ければ Discord
    
    【返す値】
    ['slack'] / ['email'] / ['discord'] のいずれか
    または [] (通知なし)
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

    # auto: 優先度 CSV から「利用可能な最初のもの」を選ぶ
    prio_csv = getattr(settings, "TORAIL_NOTIFY_PRIORITY", "slack,email,discord")
    for m in [p.strip() for p in prio_csv.split(",") if p.strip()]:
        if m in available:
            return [m]
    return []


# ============================================================
# メール通知タスク
# ============================================================
@shared_task(name="record_notification.send")
def send_record_notification(record_id: str) -> None:
    """
    【役割】
    --------
    メール通知を送信。
    
    【処理フロー】
    -----------
    1. record_id から Record を取得
       - timer_state=2 のみ対象（完了状態）
       - 関連データを select_related/prefetch_related で効率化
    
    2. 送信先を取得
       - _email_recipients(record) でチームメンバーを抽出
       - 本人・空メールは自動除外
    
    3. HTMLメール本文を生成
       - templates/mail/record_done.html を使用
       - トピック・タスク・言語・時間を含める
    
    4. EmailMultiAlternatives で送信
       - テキスト版 + HTML版 の両対応
       - メールクライアントの環境に応じて表示
    
    5. 送信成功/失敗をログ出力
    
    【エラーハンドリング】
    ------------------
    - Record が見つからない → return（通知なし）
    - 送信先が空 → return（チームメンバーなし）
    - SMTP 接続失敗 → 例外をログ + raise
    
    【Celery リトライ】
    ---------------
    このタスクにはリトライ設定なし。
    失敗時は一度だけ実行。
    """
    logger.info(f"📬 send_record_notification start: record_id={record_id}")

    record = (
        Record.objects
        .select_related("user", "subject", "task", "team")
        .prefetch_related("languages") 
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
            ("トピック",  record.subject.name),
            ("タスク",  record.task.name),
            ("言語",  _fmt_langs(record)), 
            ("開始",  _fmt_time(record.start_time)),
            ("終了",  _fmt_time(record.end_time)),
            ("合計",  f"{_fmt_minutes(record.duration)} 分"),
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


# ============================================================
# Slack 通知タスク
# ============================================================
@shared_task(
    autoretry_for=(Exception,),      # 例外発生時、自動リトライ
    retry_backoff=True,              # 指数バックオフ（1秒 → 2秒 → 4秒...）
    max_retries=5,                   # 最大5回までリトライ
    name="record_notification.slack"
)
def notify_slack_team(record_id: str) -> bool:
    """
    【役割】
    --------
    Slack チャンネルにメッセージを送信。
    
    【処理フロー】
    -----------
    1. Record を取得（timer_state=2）
    2. Team に紐づく Slack Integration を確認
       - access_token（Bot Token）があるか？
       - channel_id が設定されているか？
    3. slack_sdk.WebClient で Slack API を呼び出し
    4. blocks 形式で見栄え良いメッセージを構築
       - Section + Fields でレイアウト
       - Mrkdwn（Markdown 風）でテキスト装飾
    5. 成功/失敗をログ出力
    
    【Block Kit Format】
    -----------------
    Slack の Block Kit は JSON ベースのメッセージ構造。
    以下のような見栄え：
    
    +------ 【Torail】user1さんがタイマーを完了... ------+
    | ユーザー: user1         | トピック: Python          |
    | タスク: 関数実装         | 合計(分): 15.5            |
    | 開始: 14:00             | 終了: 14:15               |
    +-----------------------------------------------------+
    | 言語: JavaScript、Python
    | 内容: (もあれば)
    |
    | 詳細: https://torail.app/records/xxx
    +-----------------------------------------------------+
    
    【リトライ設定】
    ---------------
    max_retries=5 で、失敗時は最大5回まで再実行。
    指数バックオフで、間隔が徐々に広がる。
    例：1秒後 → 3秒後 → 7秒後 → 15秒後 → 31秒後
    
    これにより Slack API の一時的な障害に耐える。
    
    【戻り値】
    --------
    bool: 成功時 True、失敗時 False
    （リトライ失敗時は例外が上がる）
    """
    rec = (
        Record.objects
        .select_related("user", "subject", "task", "team")
        .prefetch_related("languages")  
        .filter(pk=record_id, timer_state=2)
        .first()
    )
    if not rec or not rec.team:
        return False

    integ = Integration.objects.filter(team=rec.team, provider="slack").first()
    if not (integ and integ.access_token and integ.channel_id):
        return False

    lang_txt = _fmt_langs(rec)
    client = WebClient(token=integ.access_token)
    # chat.postMessage で Block Kit メッセージを送信
    client.chat_postMessage(
        channel=integ.channel_id,
        text="Torail 完了通知",  # フォールバック（Block Kit 非対応クライアント向け）
        blocks=[
            # タイトルセクション
            {"type": "section", "text": {"type": "mrkdwn",
             "text": f"*【Torail】{rec.user.username} さんがタイマーを完了しました（チーム: {rec.team.name}）*"}},
            
            # フィールド（2列レイアウト）
            {"type": "section", "fields": [
                {"type": "mrkdwn", "text": f"*ユーザー*\n{rec.user.username}"},
                {"type": "mrkdwn", "text": f"*トピック*\n{rec.subject.name}"},
                {"type": "mrkdwn", "text": f"*タスク*\n{rec.task.name}"},
                {"type": "mrkdwn", "text": f"*合計(分)*\n{_fmt_minutes(rec.duration)}"},
                {"type": "mrkdwn", "text": f"*開始*\n{_fmt_time(rec.start_time)}"},
            {"type": "mrkdwn", "text": f"*終了*\n{_fmt_time(rec.end_time)}"},
        ]},
        # 言語は別セクションで1行表示（フィールドに混ぜると列ズレしがち）
        *([{"type": "section", "text": {"type": "mrkdwn",
            "text": f"*言語*\n{lang_txt}"}}] if lang_txt != "-" else []),

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

# ============================================================
# Discord 通知タスク
# ============================================================
def _discord_embed_for_record(rec: Record) -> dict:
    """
    【役割】
    --------
    Discord の Embed（埋め込み）フォーマットを生成。
    
    【Embed 特性】
    ---------------
    - Web とモバイル両方で対応（レスポンシブ）
    - title + description + fields で構成
    - inline フィールドは 2個1組で見栄え良く配置
    - 可変長フィールド（言語・内容）は inline=False で1行表示
    
    【生成例】
    -----------
    +------------------------------------------+
    | 【Torail】user1さんがタイマー完了...    |
    |                                          |
    | ユーザー: user1                         |
    | トピック: Python基礎                    |
    |                                          |
    | 開始: 14:00  | 終了: 14:15              |
    | 合計(分): 15.5                          |
    | 言語: Python、JavaScript                |
    |                                          |
    | Torail                                   |
    +------------------------------------------+
    
    【戻り値】
    dict: JSON シリアライズ可能な Embed 辞書
    """
    title = f"【Torail】{rec.user.username} さんがタイマーを完了しました（チーム: {rec.team.name}）"
    url = f"{settings.FRONTEND_URL.rstrip('/')}/records/{rec.id}"
    lang_txt = _fmt_langs(rec)

    # 可変長は description に寄せる（太字ラベルで読みやすく）
    desc_lines = [
        f"**ユーザー**: {rec.user.username}",
        f"**トピック**: {rec.subject.name}",
        f"**タスク**: {rec.task.name}",
    ]
    if rec.description:
        # 説明は長いので最後に（Discord上限: 4096）
        desc_lines.append(f"**内容**: {rec.description}")
    if lang_txt != "-":
        desc_lines.append(f"**言語**: {lang_txt}") 

    fields = [
        # 2個1組で inline にする（モバイル2列に揃う）
        {"name": "開始",     "value": _fmt_time(rec.start_time),  "inline": True},
        {"name": "終了",     "value": _fmt_time(rec.end_time),    "inline": True},
        # 合計は1行で見せる（段ズレ防止）
        {"name": "合計(分)", "value": f"{_fmt_minutes(rec.duration)}", "inline": False},
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


@shared_task(
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=5,
    name="record_notification.discord"
)
def notify_discord_team(record_id: str) -> bool:
    """
    【役割】
    --------
    Discord チャンネルにメッセージを送信。
    
    【処理フロー】
    -----------
    1. Record を取得（timer_state=2）
    2. Team に紐づく Discord Integration を確認
       - Bot Token が設定されているか？
       - channel_id が設定されているか？
    3. Discord API v10 に直接 POST リクエスト
       - ライブラリ使わず requests で REST API 呼び出し
    4. Embed フォーマットでメッセージ構築
    5. 成功/失敗・エラーコードをログ出力
    
    【API エンドポイント】
    ------------------
    POST https://discord.com/api/v10/channels/{channel_id}/messages
    
    ヘッダー：
      Authorization: Bot {token}
      Content-Type: application/json
    
    ボディ：
      {
        "content": "テキスト",
        "embeds": [{ ... }],
        "allowed_mentions": {"parse": []}  # メンション防止
      }
    
    【エラーハンドリング】
    ------------------
    429: レート制限
      → 指数バックオフリトライで対応
    403: 権限なし
      → Embed / channel 削除 / Bot 削除 等
      → 例外化して通知
    404: チャンネルなし
      → 例外化して通知
    
    その他 4xx/5xx: 例外化してリトライ
    
    【リトライ設定】
    ---------------
    Slack と同様、最大5回までリトライ。
    
    【戻り値】
    --------
    bool: 成功時 True、失敗時 False
    """
    rec = (
        Record.objects
        .select_related("user", "subject", "task", "team")
        .prefetch_related("languages")  
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

# ============================================================
# 通知ディスパッチャー - 送信先を決定＆タスク選別
# ============================================================
@shared_task(name="record_notification.dispatch")
def dispatch_record_notification(record_id: str) -> None:
    """
    【最重要関数】タスク実行の「分岐点」。
    
    【役割】
    -------
    1. Record を取得
    2. Team の設定（notify_mode）を確認
    3. 利用可能な通知方式を判定
    4. 対応するタスクを Celery キューに追加
    
    【処理フロー】
    -----------
    dispatch_record_notification.delay(record_id)
           ↓ (signals.py から呼ばれる)
    _choose_modes(rec) で送信先を決定
           ↓
    対応タスクを .delay() で追加
           ↓
    実際の送信は別の Worker が実行
    
    【例】
    -----
    Team の notify_mode = 'auto'
    利用可能：['slack', 'email', 'discord']
    優先度：'slack,email,discord'
    
    → Slack が利用可能なので「Slack タスクのみ」追加
    → メール・Discord タスクは追加しない
    
    【ログ出力】
    -----------
    ℹ️ 通知スキップ: 利用可能な通知方式がない
    🚚 dispatch to: ['slack'] → 選定完了
    
    ※ 各タスク内では、さらに詳細なログが出力される
    
    【戻り値】
    None（Celery タスク）
    """
    rec = Record.objects.select_related("team").filter(pk=record_id, timer_state=2).first()
    if not rec or not rec.team:
        return

    # 送信先を決定
    modes = _choose_modes(rec)
    if not modes:
        logger.info(f"ℹ️ 通知スキップ: no available provider (team={rec.team_id})")
        return

    logger.info(f"🚚 dispatch to: {modes}")
    
    # 決定した送信先ごとに、対応タスクを追加
    for m in modes:
        if m == "email":
            send_record_notification.delay(record_id)
        elif m == "slack":
            notify_slack_team.delay(record_id)
        elif m == "discord":
            notify_discord_team.delay(record_id)
