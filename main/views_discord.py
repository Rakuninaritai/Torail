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


# ---- 小物: 権限チェック（チーム所属ならOK。オーナー限定にしたいなら条件を足す） ----
def _require_team_and_membership(request, team_id: str):
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
    # Integration が持っていれば最優先。無ければ settings から。
    token = integ.access_token if integ and integ.access_token else getattr(settings, "DISCORD_BOT_TOKEN", None)
    return token


def _discord_headers(token: str):
    return {"Authorization": f"Bot {token}", "Content-Type": "application/json"}


def _discord_get(token: str, path: str):
    r = requests.get(f"{DISCORD_API_BASE}{path}", headers=_discord_headers(token), timeout=10)
    return r


# ---- 1) status ----
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def discord_status(request):
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

    # guild / channel 名を引いて返す（失敗しても connected=True は保つ）
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


# ---- 2) channels ----
@api_view(["GET"])
def discord_channels(request):
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

    # /guilds/{guild_id}/channels から type=0 (text) を返す
    r = _discord_get(token, f"/guilds/{integ.workspace_id}/channels")
    if r.status_code != 200:
        return JsonResponse({"ok": False, "error": f"discord_api_{r.status_code}"}, status=400)

    channels = []
    for ch in r.json():
        # type 0: GUILD_TEXT （必要なら掲示板/スレなどを足す）
        if ch.get("type") == 0:
            channels.append({"id": ch["id"], "name": ch["name"]})

    return JsonResponse({"ok": True, "channels": channels})


# ---- 3) save_channel ----
@api_view(["POST"])
def discord_save_channel(request):
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


# ---- 4) test ----
@api_view(["POST"])
def discord_test(request):
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

    # シンプルなテストメッセージ（EmbedでなくてもOK）
    url = f"{DISCORD_API_BASE}/channels/{integ.channel_id}/messages"
    payload = {
        "content": f"Torail テスト: チーム  {team.name}  からのメッセージです。保存すればここに通知が来ます。",
        "allowed_mentions": {"parse": []},
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


# ---- 5) connect（Bot招待/OAuth開始） ----
@require_GET
def discord_connect(request):
    """
    Discord の Bot 招待 URL へ 302。成功後は callback に戻る。
    """
    team_id = request.GET.get("team_id")
    # ブラウザ遷移では Authorization を受け取れないので、ここは未認証でOK。
    # 代わりに state に署名を入れて改ざん防止する。
    if not team_id:
        return JsonResponse({"ok": False, "error": "team_required"}, status=400)
    try:
        Team.objects.only("id").get(pk=team_id)
    except Team.DoesNotExist:
        return JsonResponse({"ok": False, "error": "team_not_found"}, status=404)


    client_id = getattr(settings, "DISCORD_CLIENT_ID", None)
    redirect_uri = getattr(settings, "DISCORD_REDIRECT_URI", None)
    perms = getattr(settings, "DISCORD_PERMS", "2048")  # 送信:2048

    if not (client_id and redirect_uri):
        return JsonResponse({"ok": False, "error": "discord_oauth_not_configured"}, status=500)

    # state に team_id を載せて callback 時に関連付け
    state = signer.sign(team_id)  # "team_id:signature" 形式
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


# ---- 6) OAuth callback ----
@require_GET
def discord_callback(request):
    """
    Bot 追加後に Discord から戻る。基本的には code/guild_id/state が来る想定。
    guild_id が無ければ未設定のまま。最終的には FRONTEND_URL へ ?discord=connected で返す。
    """
    code = request.GET.get("code")
    state = request.GET.get("state")
    try:
        team_id = signer.unsign(state)  # 署名検証 + 抽出
    except BadSignature:
        return HttpResponseBadRequest("invalid state")
    guild_id = request.GET.get("guild_id")  # 返らないケースもある

    if not team_id:
        return HttpResponseBadRequest("missing state")

    try:
        team = Team.objects.get(pk=team_id)
    except Team.DoesNotExist:
        return HttpResponseBadRequest("invalid team")

    integ, _ = Integration.objects.get_or_create(team=team, provider="discord", defaults={"workspace_id": "", "channel_id": ""})

    # guild_id が来ていれば保存（来ない環境もあるので optional）
    if guild_id:
        integ.workspace_id = guild_id
        integ.save(update_fields=["workspace_id"])

    # ここで code を交換して何かする必要は基本なし（Bot Token は既知）
    # もし guild を API で取得したい場合は、notify_discord_team と同じ Bot Token を使って確認可能。

    frontend = getattr(settings, "FRONTEND_URL", "http://localhost:5173").rstrip("/")
    return HttpResponseRedirect(f"{frontend}/settings/")
