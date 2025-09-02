from django.http import JsonResponse, HttpResponseRedirect
# from django.views.decorators.http import require_GET, require_POST
from django.conf import settings
# from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404
from slack_sdk.web import WebClient
import requests
from urllib.parse import urlencode
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from main.authentication import CookieJWTAuthentication  # ← settings で使ってるやつ
from django.http import Http404
from rest_framework.permissions import AllowAny

from .models import Team, Integration

# --- ユーティリティ: team を取得（権限は既存の IsTeamMember で担保） ---
def _get_team(request) -> Team:
    team_id = request.GET.get("team_id") or request.POST.get("team_id")
    team = get_object_or_404(Team, id=team_id)
    # ★ 追加: アクセスユーザーがチームメンバーか確認（owner も memberships に入っている設計）
    if not team.memberships.filter(user=request.user).exists():
        raise Http404()  # 404にして情報漏れ防止
    return team

# 1) Slack 認証画面へ遷移（開始）
@api_view(['GET'])
@authentication_classes([CookieJWTAuthentication])
@permission_classes([IsAuthenticated])
def slack_connect(request):
    # state に team_id を載せて CSRF 対策＋どのチーム設定か識別
    params = {
        "client_id": settings.SLACK_CLIENT_ID,
        "scope": "chat:write,channels:read",   # private も必要なら groups:read を追加
        "user_scope": "",
        "redirect_uri": settings.SLACK_REDIRECT_URI,
        "state": request.GET.get("team_id", ""),
    }
    return HttpResponseRedirect("https://slack.com/oauth/v2/authorize?" + urlencode(params))

# --- 2) 認可コード受領 → access_token 交換 → Integration を保存 ---
@api_view(['GET'])
@authentication_classes([])            # ← 認証なし
@permission_classes([AllowAny])  
def slack_callback(request):
    error = request.GET.get("error")
    state = request.GET.get("state")  # team_id

    if error:  # 例: access_denied
        # 好きな戻り先にリダイレクト
        return HttpResponseRedirect(
            f"{settings.FRONTEND_URL}/settings/"
        )

    code = request.GET.get("code")
    if not code or not state:
        return JsonResponse({"ok": False, "error": "missing_code_or_state"}, status=400)
    code  = request.GET.get("code")
    state = request.GET.get("state")  # connect() で渡した team_id
    if not code or not state:
        return JsonResponse({"ok": False, "error": "missing_code_or_state"}, status=400)

    # 認可コードから Bot Token を取得
    r = requests.post(
        "https://slack.com/api/oauth.v2.access",
        data={
            "code": code,
            "client_id": settings.SLACK_CLIENT_ID,
            "client_secret": settings.SLACK_CLIENT_SECRET,
            "redirect_uri": settings.SLACK_REDIRECT_URI,
        },
        timeout=10,
    )
    data = r.json()
    if not data.get("ok"):
        # 例: invalid_code / invalid_redirect_uri / invalid_client_id
        return JsonResponse({"ok": False, "error": data.get("error")}, status=400)

    bot_token    = data["access_token"]   # Bot Token
    workspace_id = data["team"]["id"]     # ワークスペースID

    # Integration を upsert（team×provider='slack' はユニーク）
    team = get_object_or_404(Team, id=state)
    integ, _ = Integration.objects.get_or_create(team=team, provider="slack")
    integ.access_token = bot_token      # ★ 暗号化プロパティで保存
    integ.workspace_id = workspace_id
    integ.save()

    # 設定画面（フロント）に戻す
    return HttpResponseRedirect(
    f"{settings.FRONTEND_URL}/settings/"
)

# --- 3) チャンネル一覧（プルダウン用） ---
@api_view(['GET'])
@authentication_classes([CookieJWTAuthentication])
@permission_classes([IsAuthenticated])
def list_channels(request):
    team = _get_team(request)
    integ = Integration.objects.filter(team=team, provider="slack").first()
    if not (integ and integ.access_token):
        return JsonResponse({"ok": False, "error": "not_connected"}, status=400)

    client = WebClient(token=integ.access_token)
    # 公開のみ: types="public_channel" / private も必要なら ",private_channel"
    resp = client.conversations_list(types="public_channel", limit=200)
    chans = [{"id": c["id"], "name": c["name"]} for c in resp["channels"]]
    return JsonResponse({"ok": True, "channels": chans})

# --- 4) 選択したチャンネルIDを保存 ---
from rest_framework.decorators import parser_classes
from rest_framework.parsers import JSONParser, FormParser, MultiPartParser
@api_view(['POST'])
@authentication_classes([CookieJWTAuthentication])
@permission_classes([IsAuthenticated])
@parser_classes([JSONParser, FormParser, MultiPartParser])
def save_channel(request):
    print("DEBUG save_channel request.data:", request.data)  # ← 何が来てるか丸見え
    print("DEBUG save_channel POST:", request.POST)
    team_id = (request.data.get("team_id")
               or request.POST.get("team_id")
               or request.GET.get("team_id"))
    channel_id = (request.data.get("channel_id")
                  or request.POST.get("channel_id")
                  or request.GET.get("channel_id"))
    if not team_id:
        return JsonResponse({"ok": False, "error": "no_team"}, status=400)
    if not channel_id:
        return JsonResponse({"ok": False, "error": "no_channel"}, status=400)

    team = get_object_or_404(Team, id=team_id)
    if not team.memberships.filter(user=request.user).exists():
        raise Http404()

    integ = Integration.objects.filter(team=team, provider="slack").first()
    if not integ:
        return JsonResponse({"ok": False, "error": "not_connected"}, status=400)

    integ.channel_id = channel_id
    integ.save()
    return JsonResponse({"ok": True})


# --- 5) テスト送信（設定確認用） ---
from slack_sdk.errors import SlackApiError
@api_view(['POST'])
@authentication_classes([CookieJWTAuthentication])
@permission_classes([IsAuthenticated])
def send_test(request):
    team = _get_team(request)
    integ = Integration.objects.filter(team=team, provider="slack").first()
    if not (integ and integ.access_token and integ.channel_id):
        return JsonResponse({"ok": False, "error": "not_ready"}, status=400)

    client = WebClient(token=integ.access_token)

    # まずは公開チャンネルなら自動参加を試みる（channels:join が必要）
    try:
        client.conversations_join(channel=integ.channel_id)
    except SlackApiError as e:
        # 代表例:
        # - not_in_channel: （招待必要なプライベート）→後段の postMessage でも同じエラーになる
        # - method_not_supported_for_channel_type / channel_not_found などはそのまま流す
        pass

    # 送信
    try:
        client.chat_postMessage(channel=integ.channel_id, text=f"Torail テスト: チーム  {team.name}  からのメッセージです。保存すればここに通知が来ます。")
        return JsonResponse({"ok": True})
    except SlackApiError as e:
        err = e.response.get("error", "slack_api_error")
        # わかりやすいメッセージを返す
        if err == "not_in_channel":
            return JsonResponse({
                "ok": False,
                "error": "not_in_channel",
                "hint": "Bot がチャンネルに参加していません。公開: channels:join 追加＆再インストールで自動参加可。プライベート: Slack で /invite @Bot"
            }, status=400)
        if err == "missing_scope":
            return JsonResponse({
                "ok": False,
                "error": "missing_scope",
                "hint": "Slack アプリに channels:join を追加して再インストールしてください。"
            }, status=400)
        return JsonResponse({"ok": False, "error": err}, status=400)

# --- 6) 連携ステータス（ワークスペース名 / チャンネル名） ---

@api_view(['GET'])
@authentication_classes([CookieJWTAuthentication])
@permission_classes([IsAuthenticated])
def slack_status(request):
    team = _get_team(request)  # team_id は ?team_id=... で渡す
    integ = Integration.objects.filter(team=team, provider="slack").first()
    if not (integ and integ.access_token):
        return JsonResponse({"ok": False, "connected": False, "error": "not_connected"}, status=200)

    client = WebClient(token=integ.access_token)

    workspace_name = None
    bot_user = None
    try:
        # auth.test は軽量で workspace 名や bot user を取得できる
        auth = client.auth_test()
        workspace_name = auth.get("team")
        bot_user = auth.get("user")  # 例: "torail-bot"
    except SlackApiError as e:
        return JsonResponse({"ok": False, "connected": False, "error": e.response.get("error", "slack_auth_failed")}, status=200)

    channel_name = None
    if integ.channel_id:
        try:
            info = client.conversations_info(channel=integ.channel_id)
            channel_name = info["channel"]["name"]
        except SlackApiError as e:
            # 例: archived / not_in_channel / channel_not_found 等
            channel_name = None

    return JsonResponse({
        "ok": True,
        "connected": True,
        "workspace": {
            "id": integ.workspace_id,
            "name": workspace_name,
        },
        "channel": {
            "id": integ.channel_id,
            "name": channel_name,
        },
        "bot_user": bot_user,
    })

    
from django.views.decorators.csrf import csrf_exempt  # DRFなら通常不要、必要なら付ける

def _get_team_by_id(team_id: str, user):
    team = get_object_or_404(Team, id=team_id)
    if not team.memberships.filter(user=user).exists():
        # 権限なしは 404 で伏せる
        raise Http404()
    return team



