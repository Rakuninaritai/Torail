"""
URL configuration for Torail project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from main.views import UserViewSet, SubjectViewSet, TaskViewSet, RecordViewSet, LanguageViewSet,CookieTokenObtainPairView,CookieLogoutView,CookieTokenRefreshView,TeamViewSet, TeamInvitationViewSet
#IntegrationViewSet
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from dj_rest_auth.views import UserDetailsView
from main import views_slack
from main import views_discord as vdisc
from main import views_email
from django.conf import settings
from django.shortcuts import redirect
from rest_framework.decorators import api_view
from rest_framework_simplejwt.tokens import RefreshToken
from django.http import HttpResponseNotFound
# from main.tsuchi_tsukawan.integrations import discord_callback,discord_oauth_url,discord_channels

# urlsではAPIのエンドポイント(URLを決める)
from django.conf import settings
from django.shortcuts import redirect
from django.views.decorators.http import require_GET
from rest_framework_simplejwt.tokens import RefreshToken
from django.http import HttpResponseNotFound

# 404
def _404(_req, *_a, **_kw):
    return HttpResponseNotFound()

# フロントのログインへ
def _to_front_login(req, *_a, **_kw):
    return redirect((settings.FRONTEND_URL or "/").rstrip("/") + "/login_register")

# フロントのホームへ
def to_front_home(request):
    return redirect((settings.FRONTEND_URL or "/").rstrip("/") + "/")

def _cookie_opts(request=None):
    # https のときは SameSite=None; Secure 必須（クロスサイトでCookie送るため）
    if request is not None and request.is_secure():
        return dict(httponly=True, secure=True, samesite='None', path='/')
    # ローカル http のとき
    return dict(httponly=True, secure=False, samesite='Lax', path='/')

@require_GET
def social_jwt_issuer(request):
    # allauth がセッションログイン済みでここへ遷移してくる想定
    if not request.user.is_authenticated:
        return redirect(f"{settings.FRONTEND_URL.rstrip('/')}/login?error=social_auth_failed")

    refresh = RefreshToken.for_user(request.user)
    resp = redirect(settings.FRONTEND_URL.rstrip('/') + "/")
    opts = _cookie_opts(request)
    resp.set_cookie("access_token",  str(refresh.access_token), **opts)
    resp.set_cookie("refresh_token", str(refresh),            **opts)
    return resp

# defaultrouterでCRUDのAPIエンドポイントを自動で作ってくれる(手動でGE,POST等書かなくていい)
router=DefaultRouter()
# api/userでuserviewsetが呼び出せるようにしてる(api/でrouterを読み込んでるので書くのはそれ以降)
# rはpythonが/をそのままの文字列で解釈するために必要
router.register(r'users',UserViewSet)
router.register(r'subjects',SubjectViewSet, basename='subject')
router.register(r'tasks',TaskViewSet, basename='task')
router.register(r'languages',LanguageViewSet)
router.register(r'records',RecordViewSet, basename='record')
router.register(r'teams', TeamViewSet)         
router.register(r'invitations', TeamInvitationViewSet)  
# router.register(r'integrations', IntegrationViewSet, basename='integration')

urlpatterns = [
    # バックからフロントに飛ばすよう
     path("go/front-home/", to_front_home, name="front_home"),
    # --- JWT Cookie 認証エンドポイント ---
    path('api/token/',         CookieTokenObtainPairView.as_view(),  name='token_obtain_pair'),
    path('api/token/refresh/', CookieTokenRefreshView.as_view(),      name='token_refresh'),
    path('api/auth/logout/',   CookieLogoutView.as_view(),           name='rest_logout'),
    # --- ユーザー情報の取得は dj-rest-auth の UserDetailsView ---
    path('api/auth/user/',     UserDetailsView.as_view(),           name='rest_user_details'),
    # --- 残りは既存のルーティング ---
    path('api/auth/',          include('dj_rest_auth.urls')),
    path('api/auth/registration/', include('dj_rest_auth.registration.urls')),
    path('api/',               include(router.urls)),
    # path("api/integrations/discord/url/", discord_oauth_url),
    # path('api/integrations/discord/callback/', discord_callback),
    # path("api/integrations/discord/channels",  discord_channels),
    # 直打ちで入らせたくないものを“先に”定義（用途に応じて 404 かリダイレクトを選択）
    path("accounts/login/", _to_front_login, name="account_login"),
    path("accounts/signup/", _to_front_login, name="account_signup"),
    path("accounts/password/reset/", _404, name="account_reset_password"),
    path("accounts/password/change/", _404, name="account_change_password"),
    path("accounts/email/", _404, name="account_email"),
    path("accounts/inactive/", _404, name="account_inactive"),
    # ← new: allauth の公開ルート（/accounts/google/login/ 等）
    path("accounts/", include("allauth.urls")),
    # --- Slack integration endpoints ---
    path("api/integrations/slack/connect/",  views_slack.slack_connect),
    path("api/integrations/slack/callback/", views_slack.slack_callback),
    path("api/integrations/slack/channels/", views_slack.list_channels),
    path("api/integrations/slack/save_channel/", views_slack.save_channel),
    path("api/integrations/slack/test/", views_slack.send_test),
    path('api/integrations/slack/status/', views_slack.slack_status),
    # discord
    path("api/integrations/discord/status/", vdisc.discord_status),
    path("api/integrations/discord/channels/", vdisc.discord_channels),
    path("api/integrations/discord/save_channel/", vdisc.discord_save_channel),
    path("api/integrations/discord/test/", vdisc.discord_test),
    path("api/integrations/discord/connect/", vdisc.discord_connect),
    path("api/integrations/discord/callback/", vdisc.discord_callback),
    path("api/integrations/email/test/", views_email.email_test),
    path("admin/", admin.site.urls),
]

 
urlpatterns += [ 
    path("api/auth/social/jwt/", social_jwt_issuer, name="social_jwt_issuer"), 
]


# urls.py に一時追加
from django.http import JsonResponse
from django.views.decorators.http import require_GET

@require_GET
def whoami(request):
    return JsonResponse({
        "cookies_seen": list(request.COOKIES.keys()),
        "is_secure": request.is_secure(),
        "xf_proto": request.META.get("HTTP_X_FORWARDED_PROTO"),
        "auth": request.user.is_authenticated,
        "user": getattr(request.user, "username", None),
    })

urlpatterns += [ path("whoami", whoami) ]
