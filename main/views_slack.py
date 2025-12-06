# ============================================================
# Slack 連携設定ビュー - OAuth認可〜チャンネル選択
# ============================================================
#
# 【フロー概要】
# -----------
# 1. ユーザーが「Slack に接続」ボタン押す
#    ↓
# 2. slack_connect: Slack OAuth 認可画面へ遷移
#    ↓
# 3. ユーザーが Slack で認可
#    ↓
# 4. slack_callback: 認可コード受領 → Bot Token 取得 → DB 保存
#    ↓
# 5. フロント: チャンネル一覧を取得 (list_channels)
#    ↓
# 6. ユーザーが通知先チャンネルを選択
#    ↓
# 7. save_channel: 選択したチャンネルID を DB に保存
#    ↓
# 8. send_test: テスト送信で接続確認
#
# この設定が完了すると、
# 以降 Record.timer_state=2 になった時に自動で Slack に通知が来ます！
#

from django.http import JsonResponse, HttpResponseRedirect
from django.conf import settings
from django.shortcuts import get_object_or_404
from slack_sdk.web import WebClient
import requests
from urllib.parse import urlencode
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from main.authentication import CookieJWTAuthentication
from django.http import Http404
from rest_framework.permissions import AllowAny
from rest_framework.decorators import parser_classes
from rest_framework.parsers import JSONParser, FormParser, MultiPartParser
from slack_sdk.errors import SlackApiError

from .models import Team, Integration


# ============================================================
# ヘルパー関数
# ============================================================
def _get_team(request) -> Team:
    """
    リクエストから team_id を抽出し、権限確認付きで Team を返す。
    
    【セキュリティ】
    -----
    - チームメンバーか確認（owner も memberships に入る設計）
    - 権限なしは Http404 で情報漏れ防止
    """
    team_id = request.GET.get("team_id") or request.POST.get("team_id")
    team = get_object_or_404(Team, id=team_id)
    if not team.memberships.filter(user=request.user).exists():
        raise Http404()
    return team


# ============================================================
# 1. Slack OAuth 認可画面へリダイレクト
# ============================================================
@api_view(['GET'])
@authentication_classes([CookieJWTAuthentication])
@permission_classes([IsAuthenticated])
def slack_connect(request):
    """
    【役割】
    ------
    Slack の OAuth2 認可画面へリダイレクト。
    
    【パラメータ】
    -----------
    - client_id: Slack App ID
    - scope: Bot がどの権限を要求するか
      chat:write      : メッセージ送信
      channels:read   : チャンネル一覧取得
      groups:read     : プライベートチャンネルも含める場合
    - redirect_uri: OAuth 認可後の戻り先
      settings.SLACK_REDIRECT_URI = 本番ドメイン + /api/integrations/slack/callback/
    - state: CSRF 対策＋チーム識別用
      team_id を state に入れる（認可後に取り出す）
    
    【認可後の流れ】
    --------
    Slack がユーザーを slack_callback にリダイレクト
      ↓
    query params に code (認可コード) と state (team_id) が付く
    """
    params = {
        "client_id": settings.SLACK_CLIENT_ID,
        "scope": "chat:write,channels:read",
        "user_scope": "",
        "redirect_uri": settings.SLACK_REDIRECT_URI,
        "state": request.GET.get("team_id", ""),
    }
    return HttpResponseRedirect("https://slack.com/oauth/v2/authorize?" + urlencode(params))


# ============================================================
# 2. Slack OAuth コールバック - Bot Token 取得 & 保存
# ============================================================
@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def slack_callback(request):
    """
    【役割】
    ------
    Slack OAuth 認可後に呼ばれるコールバック。
    認可コード → Bot Token 交換して Integration に保存。
    
    【クエリパラメータ】
    ---------------
    code:  認可コード（1回限りの使い捨て）
    state: team_id（OAuth リクエストで state に入れたもの）
    error: ユーザーが「deny」した場合は error=access_denied
    
    【処理フロー】
    ----------
    1. error が来ていないか確認
    2. code と state が存在するか確認
    3. Slack API (oauth.v2.access) に POST
       code → Bot Token 交換
    4. 戻ってきた access_token と team ID を Integration に保存
    5. フロント設定画面にリダイレクト
    
    【エラーハンドリング】
    -----------------
    - error=access_denied → ユーザーがキャンセル
    - invalid_code → コード期限切れ
    - invalid_client_secret → Slack App 設定エラー
    
    【重要】
    ----
    access_token は暗号化フィールド (Integration.access_token)
    で自動的に暗号化して保存される。
    
    DB に平文で保存されることはない！
    """
    error = request.GET.get("error")
    state = request.GET.get("state")

    if error:
        # ユーザーが「キャンセル」した等
        return HttpResponseRedirect(f"{settings.FRONTEND_URL}/settings/")

    code = request.GET.get("code")
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
        return JsonResponse({"ok": False, "error": data.get("error")}, status=400)

    bot_token = data["access_token"]
    workspace_id = data["team"]["id"]

    # Integration を upsert（team×provider='slack' はユニーク）
    team = get_object_or_404(Team, id=state)
    integ, _ = Integration.objects.get_or_create(team=team, provider="slack")
    integ.access_token = bot_token
    integ.workspace_id = workspace_id
    integ.save()

    return HttpResponseRedirect(f"{settings.FRONTEND_URL}/settings/")


# ============================================================
# 3. Slack チャンネル一覧取得
# ============================================================
@api_view(['GET'])
@authentication_classes([CookieJWTAuthentication])
@permission_classes([IsAuthenticated])
def list_channels(request):
    """
    【役割】
    ------
    Slack Workspace内のパブリックチャンネル一覧をフロントに返す。
    フロント側でプルダウンに表示される。
    
    【前提】
    -----
    slack_callback で Bot Token が既に保存されている
    
    【Slack API】
    ---------
    conversations.list (type=public_channel)
      → workspace 内のパブリックチャンネルを列挙
    
    【返す値】
    -------
    {"ok": true, "channels": [{"id": "C123", "name": "#general"}, ...]}
    """
    team = _get_team(request)
    integ = Integration.objects.filter(team=team, provider="slack").first()
    if not (integ and integ.access_token):
        return JsonResponse({"ok": False, "error": "not_connected"}, status=400)

    client = WebClient(token=integ.access_token)
    resp = client.conversations_list(types="public_channel", limit=200)
    chans = [{"id": c["id"], "name": c["name"]} for c in resp["channels"]]
    return JsonResponse({"ok": True, "channels": chans})


# ============================================================
# 4. チャンネルID を DB に保存
# ============================================================
@api_view(['POST'])
@authentication_classes([CookieJWTAuthentication])
@permission_classes([IsAuthenticated])
@parser_classes([JSONParser, FormParser, MultiPartParser])
def save_channel(request):
    """
    【役割】
    ------
    ユーザーが選択したチャンネルID を Integration.channel_id に保存。
    以降、通知はこのチャンネルに送信される。
    
    【リクエストボディ】
    --------
    {
      "team_id": "uuid",
      "channel_id": "C123abc"
    }
    
    【処理】
    ------
    1. team_id, channel_id を抽出
    2. チーム権限確認
    3. Integration を取得
    4. channel_id を更新＆保存
    """
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


# ============================================================
# 5. テスト送信 - 接続確認
# ============================================================
@api_view(['POST'])
@authentication_classes([CookieJWTAuthentication])
@permission_classes([IsAuthenticated])
def send_test(request):
    """
    【役割】
    ------
    テストメッセージを選択されたチャンネルに送信。
    設定が正しく動いているか確認する。
    
    【チェック項目】
    -----------
    1. Access Token が存在するか
    2. Channel ID が設定されているか
    3. Bot がチャンネルに参加できるか
    4. メッセージ送信権限があるか
    
    【エラー】
    -------
    not_in_channel: Bot がチャンネルに参加していない
      → 公開チャンネル: /invite してもらう
      → Slack App 設定で channels:join scope を追加
    
    missing_scope: 権限が不足
      → Slack App 設定で scope 追加＆再インストール
    """
    team = _get_team(request)
    integ = Integration.objects.filter(team=team, provider="slack").first()
    if not (integ and integ.access_token and integ.channel_id):
        return JsonResponse({"ok": False, "error": "not_ready"}, status=400)

    client = WebClient(token=integ.access_token)

    try:
        client.conversations_join(channel=integ.channel_id)
    except SlackApiError:
        pass

    try:
        client.chat_postMessage(
            channel=integ.channel_id,
            text=f"Torail テスト: チーム  {team.name}  からのメッセージです。保存すればここに通知が来ます。"
        )
        return JsonResponse({"ok": True})
    except SlackApiError as e:
        err = e.response.get("error", "slack_api_error")
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


# ============================================================
# 6. ステータス確認 - ワークスペース & チャンネル名表示
# ============================================================
@api_view(['GET'])
@authentication_classes([CookieJWTAuthentication])
@permission_classes([IsAuthenticated])
def slack_status(request):
    """
    【役割】
    ------
    フロント設定画面に表示するため、現在の Slack 接続状態を返す。
    
    【返す値】
    -------
    {
      "ok": true,
      "connected": true,
      "workspace": {"id": "T123", "name": "MySlack"},
      "channel": {"id": "C123", "name": "torail-notifications"},
      "bot_user": "torail-bot"
    }
    
    【使用場所】
    --------
    フロント: settings/SlackPanel.jsx で表示
      - ワークスペース名
      - チャンネル名
      - Bot ユーザー名
    
    接続されていないか、権限エラーなら:
    {
      "ok": false,
      "connected": false,
      "error": "not_connected" / "slack_auth_failed"
    }
    """
    team = _get_team(request)
    integ = Integration.objects.filter(team=team, provider="slack").first()
    if not (integ and integ.access_token):
        return JsonResponse({"ok": False, "connected": False, "error": "not_connected"}, status=200)

    client = WebClient(token=integ.access_token)

    workspace_name = None
    bot_user = None
    try:
        auth = client.auth_test()
        workspace_name = auth.get("team")
        bot_user = auth.get("user")
    except SlackApiError as e:
        return JsonResponse({"ok": False, "connected": False, "error": e.response.get("error", "slack_auth_failed")}, status=200)

    channel_name = None
    if integ.channel_id:
        try:
            info = client.conversations_info(channel=integ.channel_id)
            channel_name = info["channel"]["name"]
        except SlackApiError:
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



