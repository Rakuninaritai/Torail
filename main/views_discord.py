# ============================================================
# Discord 連携設定ビュー - Bot 招待〜チャンネル選択
# ============================================================
#
# 【フロー概要】
# -----------
# 1. ユーザーが「Discord に接続」ボタン押す
#    ↓
# 2. discord_connect: Discord Bot 招待 URL へ遷移
#    ↓
# 3. ユーザーが Discord で Bot を Guild(サーバー) に追加
#    ↓
# 4. discord_callback: 追加完了コールバック
#    → guild_id (サーバーID) を Integration に保存
#    ↓
# 5. フロント: チャンネル一覧を取得 (discord_channels)
#    ↓
# 6. ユーザーが通知先チャンネルを選択
#    ↓
# 7. discord_save_channel: 選択したチャンネルID を DB に保存
#    ↓
# 8. discord_test: テスト送信で接続確認
#
# 【Slack との違い】
# ----------------
# - Discord は Bot Token がアプリレベル（workspace/guild 共通）
# - Slack は app_id → workspace ごとに Token 発行（per-workspace）
# - Discord は guild_id (サーバーID) を使って複数サーバーに対応可能
#
# この設定が完了すると、
# 以降 Record.timer_state=2 になった時に自動で Discord に通知が来ます！
#

import json
import os
import urllib.parse
import requests

from django.conf import settings
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponseRedirect
from django.views.decorators.http import require_GET, require_POST
from django.core.signing import Signer, BadSignature
signer = Signer()
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from .models import Integration, Team, TeamMembership

DISCORD_API_BASE = "https://discord.com/api/v10"


# ============================================================
# ヘルパー関数
# ============================================================
def _require_team_and_membership(request, team_id: str):
    """
    チーム権限確認ヘルパー。
    
    【チェック】
    - ユーザーがログインしているか
    - Team が存在するか
    - ユーザーがチームメンバーまたはオーナーか
    
    【戻り値】
    - (team, None) : 権限OK
    - (None, error_response) : エラー
    """
    if not request.user.is_authenticated:
        return None, JsonResponse({"ok": False, "error": "auth_required"}, status=401)

    try:
        team = Team.objects.get(pk=team_id)
    except Team.DoesNotExist:
        return None, JsonResponse({"ok": False, "error": "team_not_found"}, status=404)

    is_member = TeamMembership.objects.filter(team=team, user=request.user).exists() or (team.owner_id == request.user.id)
    if not is_member:
        return None, JsonResponse({"ok": False, "error": "forbidden"}, status=403)

    return team, None


def _get_discord_bot_token(integ: Integration | None):
    """
    Discord Bot Token を取得。
    
    優先順位：
    1. Integration.access_token があれば使用
    2. settings.DISCORD_BOT_TOKEN を使用
    """
    token = integ.access_token if integ and integ.access_token else getattr(settings, "DISCORD_BOT_TOKEN", None)
    return token


def _discord_headers(token: str):
    """Discord API リクエストヘッダーを生成。"""
    return {"Authorization": f"Bot {token}", "Content-Type": "application/json"}


def _discord_get(token: str, path: str):
    """Discord API GET リクエスト。"""
    r = requests.get(f"{DISCORD_API_BASE}{path}", headers=_discord_headers(token), timeout=10)
    return r


# ============================================================
# 1. Discord ステータス確認
# ============================================================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def discord_status(request):
    """
    【役割】
    ------
    フロント設定画面に表示するため、現在の Discord 接続状態を返す。
    
    【返す値】
    -------
    {
      "ok": true,
      "connected": true,
      "guild": {"id": "123456", "name": "My Server"},
      "channel": {"id": "789012", "name": "notifications"}
    }
    
    接続されていない場合:
    {
      "ok": true,
      "connected": false
    }
    """
    team_id = request.GET.get("team_id")
    team, err = _require_team_and_membership(request, team_id)
    if err:
        return err

    integ = Integration.objects.filter(team=team, provider="discord").first()
    if not integ:
        return JsonResponse({"ok": True, "connected": False})

    token = _get_discord_bot_token(integ)
    if not token:
        return JsonResponse({"ok": True, "connected": False})

    # Guild / Channel 名を引いて返す（失敗しても connected=True は保つ）
    guild_name = None
    channel_name = None

    if integ.workspace_id:
        gr = _discord_get(token, f"/guilds/{integ.workspace_id}")
        if gr.status_code == 200:
            guild_name = gr.json().get("name")

    if integ.channel_id:
        cr = _discord_get(token, f"/channels/{integ.channel_id}")
        if cr.status_code == 200:
            channel_name = cr.json().get("name")

    return JsonResponse({
        "ok": True,
        "connected": True,
        "guild": {"id": integ.workspace_id, "name": guild_name} if integ.workspace_id else None,
        "channel": {"id": integ.channel_id, "name": channel_name} if integ.channel_id else None,
    })


# ============================================================
# 2. Discord チャンネル一覧取得
# ============================================================
@api_view(["GET"])
def discord_channels(request):
    """
    【役割】
    ------
    Guild 内のテキストチャンネル一覧をフロントに返す。
    
    【前提】
    -----
    workspace_id (guild_id) が Integration に設定されている
    
    【Discord API】
    -----------
    GET /guilds/{guild_id}/channels
      → type=0 (GUILD_TEXT) のみを返す
    
    【返す値】
    -------
    {"ok": true, "channels": [{"id": "C1", "name": "#general"}, ...]}
    """
    team_id = request.GET.get("team_id")
    team, err = _require_team_and_membership(request, team_id)
    if err:
        return err

    integ = Integration.objects.filter(team=team, provider="discord").first()
    if not integ:
        return JsonResponse({"ok": False, "error": "not_connected"}, status=400)

    token = _get_discord_bot_token(integ)
    if not token:
        return JsonResponse({"ok": False, "error": "not_connected"}, status=400)

    if not integ.workspace_id:
        return JsonResponse({"ok": False, "error": "guild_missing"}, status=400)

    # Guild のチャンネル一覧を取得
    r = _discord_get(token, f"/guilds/{integ.workspace_id}/channels")
    if r.status_code != 200:
        return JsonResponse({"ok": False, "error": f"discord_api_{r.status_code}"}, status=400)

    channels = []
    for ch in r.json():
        # type 0: GUILD_TEXT（テキストチャンネルのみ）
        if ch.get("type") == 0:
            channels.append({"id": ch["id"], "name": ch["name"]})

    return JsonResponse({"ok": True, "channels": channels})


# ============================================================
# 3. チャンネルID を DB に保存
# ============================================================
@api_view(["POST"])
def discord_save_channel(request):
    """
    【役割】
    ------
    ユーザーが選択したチャンネルID を Integration.channel_id に保存。
    以降、通知はこのチャンネルに送信される。
    
    【リクエストボディ】
    --------
    {
      "team_id": "uuid",
      "channel_id": "789012"
    }
    """
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except Exception:
        return HttpResponseBadRequest("invalid json")

    team_id = payload.get("team_id")
    channel_id = payload.get("channel_id")
    team, err = _require_team_and_membership(request, team_id)
    if err:
        return err

    integ, _ = Integration.objects.get_or_create(team=team, provider="discord", defaults={"workspace_id": "", "channel_id": ""})
    if not channel_id:
        return JsonResponse({"ok": False, "error": "channel_required"}, status=400)

    integ.channel_id = channel_id
    integ.save(update_fields=["channel_id"])
    return JsonResponse({"ok": True})


# ============================================================
# 4. テスト送信 - 接続確認
# ============================================================
@api_view(["POST"])
def discord_test(request):
    """
    【役割】
    ------
    テストメッセージを選択されたチャンネルに送信。
    設定が正しく動いているか確認する。
    
    【チェック項目】
    -----------
    1. Integration / Bot Token / Channel ID が設定されているか
    2. Bot がチャンネルに書き込み権限があるか
    
    【エラー】
    -------
    403: 権限なし（Bot がチャンネルに参加していない等）
    404: チャンネルが見つからない
    429: レート制限（Discord API が一時的に拒否）
    """
    team_id = request.GET.get("team_id")
    team, err = _require_team_and_membership(request, team_id)
    if err:
        return err

    integ = Integration.objects.filter(team=team, provider="discord").first()
    token = _get_discord_bot_token(integ)
    if not (integ and token):
        return JsonResponse({"ok": False, "error": "not_connected"}, status=400)
    if not integ.channel_id:
        return JsonResponse({"ok": False, "error": "not_ready"}, status=400)

    # テストメッセージ送信
    url = f"{DISCORD_API_BASE}/channels/{integ.channel_id}/messages"
    payload = {
        "content": f"Torail テスト: チーム  {team.name}  からのメッセージです。保存すればここに通知が来ます。",
        "allowed_mentions": {"parse": []},  # メンション防止
    }
    r = requests.post(url, headers=_discord_headers(token), json=payload, timeout=10)
    
    if r.status_code == 403:
        return JsonResponse({"ok": False, "error": "forbidden_channel"}, status=400)
    if r.status_code == 404:
        return JsonResponse({"ok": False, "error": "channel_not_found"}, status=400)
    if r.status_code == 429:
        return JsonResponse({"ok": False, "error": "rate_limited"}, status=429)
    if r.status_code >= 400:
        return JsonResponse({"ok": False, "error": f"discord_api_{r.status_code}"}, status=400)

    return JsonResponse({"ok": True})


# ============================================================
# 5. Bot 招待 URL へリダイレクト
# ============================================================
@require_GET
def discord_connect(request):
    """
    【役割】
    ------
    Discord の Bot 招待 URL へリダイレクト。
    ユーザーがそこで Bot をサーバーに追加する。
    
    【フロー】
    ------
    1. ユーザーが「Connect to Discord」ボタン押す
    2. このエンドポイントに遷移
    3. ここから Discord OAuth URL へ 302 リダイレクト
    4. ユーザーが Discord で Bot を サーバーに追加
    5. Discord が discord_callback にリダイレクト
    
    【state 署名】
    -----------
    CSRF 対策として state を署名化。
    改ざん検出可能にする。
    """
    team_id = request.GET.get("team_id")
    if not team_id:
        return JsonResponse({"ok": False, "error": "team_required"}, status=400)
    
    try:
        Team.objects.only("id").get(pk=team_id)
    except Team.DoesNotExist:
        return JsonResponse({"ok": False, "error": "team_not_found"}, status=404)

    client_id = getattr(settings, "DISCORD_CLIENT_ID", None)
    redirect_uri = getattr(settings, "DISCORD_REDIRECT_URI", None)
    perms = getattr(settings, "DISCORD_PERMS", "2048")  # 2048: SEND_MESSAGES

    if not (client_id and redirect_uri):
        return JsonResponse({"ok": False, "error": "discord_oauth_not_configured"}, status=500)

    # state に team_id を署名化して付与
    state = signer.sign(team_id)
    params = {
        "client_id": client_id,
        "permissions": perms,
        "scope": "bot applications.commands",
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "state": state,
    }
    url = f"https://discord.com/api/oauth2/authorize?{urllib.parse.urlencode(params)}"
    return HttpResponseRedirect(url)


# ============================================================
# 6. OAuth コールバック - Guild ID 保存
# ============================================================
@require_GET
def discord_callback(request):
    """
    【役割】
    ------
    Discord OAuth の戻り先。
    Bot 追加時の guild_id (サーバーID) を取得して保存。
    
    【クエリパラメータ】
    -------
    code:     認可コード（ここでは使わない）
    state:    署名化した team_id（検証して解く）
    guild_id: Bot を追加したサーバーID（ここで保存）
    
    【処理】
    ------
    1. state を署名検証
    2. guild_id を Integration.workspace_id に保存
    3. フロント設定画面にリダイレクト
    
    【重要】
    -----
    guild_id が come ないケースもある（OAuth スコープ次第）。
    その場合は workspace_id が空のまま。
    後で API で guild 名等を引いて確認可能。
    """
    code = request.GET.get("code")
    state = request.GET.get("state")
    try:
        team_id = signer.unsign(state)
    except BadSignature:
        return HttpResponseBadRequest("invalid state")
    guild_id = request.GET.get("guild_id")

    if not team_id:
        return HttpResponseBadRequest("missing state")

    try:
        team = Team.objects.get(pk=team_id)
    except Team.DoesNotExist:
        return HttpResponseBadRequest("invalid team")

    integ, _ = Integration.objects.get_or_create(team=team, provider="discord", defaults={"workspace_id": "", "channel_id": ""})

    # guild_id が来ていれば保存
    if guild_id:
        integ.workspace_id = guild_id
        integ.save(update_fields=["workspace_id"])

    frontend = getattr(settings, "FRONTEND_URL", "http://localhost:5173").rstrip("/")
    return HttpResponseRedirect(f"{frontend}/settings/")
