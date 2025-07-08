# # backend/main/integrations.py
# """Discord／Slack 等の外部サービス連携用エンドポイントをまとめたモジュール。

# ❶ Discord 連携のフロー
# ----------------------------------------------
# GET  /api/integrations/discord/url/?team=<team_id>
#     -> Discord OAuth2 へリダイレクトする URL を JSON で返す

# Discord 側で Bot をサーバーに追加すると、
# Discord が ``DISCORD_REDIRECT_URI`` にブラウザを戻す。
# その際 `code`, `state`, `guild_id` などがクエリに付与されるので
# ``/callback/`` がそれを受け取り、Integration レコードを作成する。

# ❷ Slack 連携（同じ要領なので概要のみ）
# ----------------------------------------------

# このモジュールは Django‑REST‑Framework の関数ベース view を採用し、
# urls.py で path を直接張る想定です（router だと callback が書きづらいため）。

# 依存：
#     - requests
#     - cryptography (main.models.Integration の暗号化フィールド用)

# """

# from __future__ import annotations

# import logging
# from urllib.parse import urlencode

# import requests
# from django.conf import settings
# from django.shortcuts import get_object_or_404, redirect
# from rest_framework.decorators import api_view, permission_classes
# from rest_framework.permissions import IsAuthenticated
# from rest_framework.response import Response
# from rest_framework.exceptions import PermissionDenied, ValidationError

# from main.models import Team, Integration
# from main.serializers import IntegrationSerializer
# from main.views import IsTeamMember  # 既存定義を再利用

# logger = logging.getLogger(__name__)

# # -----------------------------------------------------------------------------
# # 共通ヘルパ
# # -----------------------------------------------------------------------------

# def _require_team_member(team: Team, user):
#     """チームメンバーかどうかをチェック。"""
#     if not team.memberships.filter(user=user).exists():
#         raise PermissionDenied("チームメンバーのみ操作できます")

# # -----------------------------------------------------------------------------
# # Discord
# # -----------------------------------------------------------------------------

# def _build_discord_oauth_url(team_id: str) -> str:
#     params = {
#         "client_id": settings.DISCORD_CLIENT_ID,
#         "scope": "bot identify applications.commands",
#         "permissions": settings.DISCORD_PERMS,  # 例: 2048 (Send Messages)
#         "response_type": "code",
#         "redirect_uri": settings.DISCORD_REDIRECT_URI,
#         "state": team_id,
#     }
#     return "https://discord.com/api/oauth2/authorize?" + urlencode(params, safe=":/")

# @api_view(["GET"])
# @permission_classes([IsAuthenticated])
# def discord_oauth_url(request):
#     """フロント → 連携ボタン押下時に呼ばれ、Discord OAuth URL を返す。"""
#     team_id = request.query_params.get("team")
#     if not team_id:
#         raise ValidationError({"team": "必須です"})

#     team = get_object_or_404(Team, pk=team_id)
#     _require_team_member(team, request.user)

#     return Response({"url": _build_discord_oauth_url(team_id)})


# @api_view(["GET"])
# @permission_classes([IsAuthenticated])
# def discord_callback(request):
#     """Discord からリダイレクトされるエンドポイント。"""
#     code       = request.query_params.get("code")
#     team_id    = request.query_params.get("state")  # build_url で入れたもの
#     guild_id   = request.query_params.get("guild_id")  # Bot を入れたサーバー ID

#     if not (code and team_id and guild_id):
#         raise ValidationError("必須パラメータが不足しています")

#     team = get_object_or_404(Team, pk=team_id)
#     _require_team_member(team, request.user)

#     # --- 1) auth code → access_token 交換（ユーザートークン／不要ならスキップ）
#     try:
#         token_res = requests.post(
#             "https://discord.com/api/oauth2/token",
#             data={
#                 "client_id": settings.DISCORD_CLIENT_ID,
#                 "client_secret": settings.DISCORD_CLIENT_SECRET,
#                 "grant_type": "authorization_code",
#                 "code": code,
#                 "redirect_uri": settings.DISCORD_REDIRECT_URI,
#             },
#             timeout=5,
#         )
#         token_res.raise_for_status()
#     except Exception as e:
#         logger.exception("Discord token exchange failed")
#         raise ValidationError("Discord 認証に失敗しました") from e

#     access_token = token_res.json().get("access_token")

#     # --- 2) Integration レコード作成（Bot Token は env から取得）
#     integ, _ = Integration.objects.update_or_create(
#         team=team,
#         provider="discord",
#         defaults={
#             "access_token": settings.DISCORD_BOT_TOKEN,  # ボット用
#             "workspace_id": guild_id,
#             # channel_id は後で UI で選択
#         },
#     )

#     # フロント側に戻す（普通は SPA の URL にリダイレクト）
#     return redirect(settings.FRONTEND_URL + "/settings/integrations?connected=discord")


# @api_view(["GET"])
# @permission_classes([IsAuthenticated, IsTeamMember])
# def discord_channels(request):
#     """指定 integration(guild) のテキストチャンネル一覧を返却。"""
#     integ_id = request.query_params.get("integration")
#     integ    = get_object_or_404(Integration, pk=integ_id, provider="discord")

#     # Bot で Guild Channels 取得
#     url = f"https://discord.com/api/guilds/{integ.workspace_id}/channels"
#     res = requests.get(url, headers={"Authorization": f"Bot {integ.access_token}"}, timeout=5)
#     res.raise_for_status()

#     chans = {
#         c["id"]: c["name"]
#         for c in res.json()
#         if c["type"] == 0  # 0 = text channel
#     }
#     return Response(chans)

# # -----------------------------------------------------------------------------
# # Slack（概要のみ、実装は必要に応じて拡張してください）
# # -----------------------------------------------------------------------------

# # ... 同様の関数を用意
