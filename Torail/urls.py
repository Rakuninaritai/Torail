# """
# URL configuration for Torail project.

# The `urlpatterns` list routes URLs to views. For more information please see:
#     https://docs.djangoproject.com/en/5.1/topics/http/urls/
# Examples:
# Function views
#     1. Add an import:  from my_app import views
#     2. Add a URL to urlpatterns:  path('', views.home, name='home')
# Class-based views
#     1. Add an import:  from other_app.views import Home
#     2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
# Including another URLconf
#     1. Import the include() function: from django.urls import include, path
#     2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
# """

# from django.contrib import admin
# from django.urls import path, include
# from rest_framework.routers import DefaultRouter
# from main.views import UserViewSet, SubjectViewSet, TaskViewSet, RecordViewSet, LanguageViewSet,CookieTokenObtainPairView,CookieLogoutView,CookieTokenRefreshView,TeamViewSet, TeamInvitationViewSet
# #IntegrationViewSet
# from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
# from dj_rest_auth.views import UserDetailsView
from main import views_slack
from main import views_discord as vdisc
from main import views_email
# from django.conf import settings
# from django.shortcuts import redirect
# from rest_framework.decorators import api_view
# from rest_framework_simplejwt.tokens import RefreshToken
# from django.http import HttpResponseNotFound
# # from main.tsuchi_tsukawan.integrations import discord_callback,discord_oauth_url,discord_channels

# # urlsではAPIのエンドポイント(URLを決める)
# from django.conf import settings
# from django.shortcuts import redirect
# from django.views.decorators.http import require_GET
# from rest_framework_simplejwt.tokens import RefreshToken
# from django.http import HttpResponseNotFound

# # 404
# def _404(_req, *_a, **_kw):
#     return HttpResponseNotFound()

# # フロントのログインへ
# def _to_front_login(req, *_a, **_kw):
#     return redirect((settings.FRONTEND_URL or "/").rstrip("/") + "/login_register")

# # フロントのホームへ
# def to_front_home(request):
#     return redirect((settings.FRONTEND_URL or "/").rstrip("/") + "/")

def _cookie_opts(request=None):
    # https のときは SameSite=None; Secure 必須（クロスサイトでCookie送るため）
    if request is not None and request.is_secure():
        return dict(httponly=True, secure=True, samesite='None', path='/')
    # ローカル http のとき
    return dict(httponly=True, secure=False, samesite='Lax', path='/')

# @require_GET
# def social_jwt_issuer(request):
#     if not request.user.is_authenticated:
#         return redirect(f"{settings.FRONTEND_URL.rstrip('/')}/login?error=social_auth_failed")

#     refresh = RefreshToken.for_user(request.user)

#     # フロントの遷移先（/ 以外を許すなら next パラメータを安全に許容）
#     next_path = request.GET.get("next", "/")
#     # オープンリダイレクト防止：先頭が / でない or 外部URLなら無視
#     if not next_path.startswith("/"):
#         next_path = "/"

#     # ?login=ok を付与してトースト合図
#     sep = "&" if "?" in next_path else "?"
#     target = f"{settings.FRONTEND_URL.rstrip('/')}{next_path}{sep}login=ok"

#     resp = redirect(target)
#     opts = _cookie_opts(request)  # SameSite/Lax or None の既存関数
#     resp.set_cookie("access_token",  str(refresh.access_token), **opts)
#     resp.set_cookie("refresh_token", str(refresh),            **opts)
#     return resp

# # defaultrouterでCRUDのAPIエンドポイントを自動で作ってくれる(手動でGE,POST等書かなくていい)
# router=DefaultRouter()
# # api/userでuserviewsetが呼び出せるようにしてる(api/でrouterを読み込んでるので書くのはそれ以降)
# # rはpythonが/をそのままの文字列で解釈するために必要
# router.register(r'users',UserViewSet)
# router.register(r'subjects',SubjectViewSet, basename='subject')
# router.register(r'tasks',TaskViewSet, basename='task')
# router.register(r'languages',LanguageViewSet)
# router.register(r'records',RecordViewSet, basename='record')
# router.register(r'teams', TeamViewSet)         
# router.register(r'invitations', TeamInvitationViewSet)  
# # router.register(r'integrations', IntegrationViewSet, basename='integration')

# urlpatterns = [
#     # バックからフロントに飛ばすよう
#      path("go/front-home/", to_front_home, name="front_home"),
#     # --- JWT Cookie 認証エンドポイント ---
#     path('api/token/',         CookieTokenObtainPairView.as_view(),  name='token_obtain_pair'),
#     path('api/token/refresh/', CookieTokenRefreshView.as_view(),      name='token_refresh'),
#     path('api/auth/logout/',   CookieLogoutView.as_view(),           name='rest_logout'),
#     # --- ユーザー情報の取得は dj-rest-auth の UserDetailsView ---
#     path('api/auth/user/',     UserDetailsView.as_view(),           name='rest_user_details'),
#     # --- 残りは既存のルーティング ---
#     path('api/auth/',          include('dj_rest_auth.urls')),
#     path('api/auth/registration/', include('dj_rest_auth.registration.urls')),
#     path('api/',               include(router.urls)),
#     # path("api/integrations/discord/url/", discord_oauth_url),
#     # path('api/integrations/discord/callback/', discord_callback),
#     # path("api/integrations/discord/channels",  discord_channels),
#     # 直打ちで入らせたくないものを“先に”定義（用途に応じて 404 かリダイレクトを選択）
#     path("accounts/login/", _to_front_login, name="account_login"),
#     path("accounts/signup/", _to_front_login, name="account_signup"),
#     path("accounts/password/reset/", _404, name="account_reset_password"),
#     path("accounts/password/change/", _404, name="account_change_password"),
#     path("accounts/email/", _404, name="account_email"),
#     path("accounts/inactive/", _404, name="account_inactive"),
#     # ← new: allauth の公開ルート（/accounts/google/login/ 等）
#     path("accounts/", include("allauth.urls")),
#     # --- Slack integration endpoints ---
#     path("api/integrations/slack/connect/",  views_slack.slack_connect),
#     path("api/integrations/slack/callback/", views_slack.slack_callback),
#     path("api/integrations/slack/channels/", views_slack.list_channels),
#     path("api/integrations/slack/save_channel/", views_slack.save_channel),
#     path("api/integrations/slack/test/", views_slack.send_test),
#     path('api/integrations/slack/status/', views_slack.slack_status),
#     # discord
#     path("api/integrations/discord/status/", vdisc.discord_status),
#     path("api/integrations/discord/channels/", vdisc.discord_channels),
#     path("api/integrations/discord/save_channel/", vdisc.discord_save_channel),
#     path("api/integrations/discord/test/", vdisc.discord_test),
#     path("api/integrations/discord/connect/", vdisc.discord_connect),
#     path("api/integrations/discord/callback/", vdisc.discord_callback),
#     path("api/integrations/email/test/", views_email.email_test),
#     path("admin/", admin.site.urls),
# ]

 
# urlpatterns += [ 
#     path("api/auth/social/jwt/", social_jwt_issuer, name="social_jwt_issuer"), 
# ]

# project/urls.py
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from dj_rest_auth.views import UserDetailsView
from django.conf.urls.static import static

from main.views import (
    # 既存
    UserViewSet, SubjectViewSet, TaskViewSet, RecordViewSet,
    CookieTokenObtainPairView, CookieLogoutView, CookieTokenRefreshView,
    TeamViewSet, TeamInvitationViewSet,
    # 新規
    LanguageMasterViewSet, JobRoleViewSet, TechAreaViewSet, ProductDomainViewSet,
    PublicProfileView, MyProfileView,
    UserSNSViewSet, PortfolioItemViewSet,
    CompanyViewSet, CompanyMemberViewSet, CompanyPlanViewSet, CompanyHiringViewSet,
    MessageTemplateViewSet, DMThreadViewSet, DMMessageViewSet,PublicProfileByNameView,
    PublicActivityKPIByNameView,PublicCompanyView,MyDMThreadsSummary,DMThreadDetailView,CompanyMemberInviteView,PatchedUserDetailsView
)

# ---- 既存と同様の補助関数/ビュー（省略） ----
from django.conf import settings
from django.shortcuts import redirect
from django.views.decorators.http import require_GET
from rest_framework_simplejwt.tokens import RefreshToken
from django.http import HttpResponseNotFound

def _404(_req, *_a, **_kw): return HttpResponseNotFound()
def _to_front_login(req, *_a, **_kw):
    return redirect((settings.FRONTEND_URL or "/").rstrip("/") + "/login_register")
def to_front_home(request):
    return redirect((settings.FRONTEND_URL or "/").rstrip("/") + "/")

@require_GET
def social_jwt_issuer(request):
    if not request.user.is_authenticated:
        return redirect(f"{settings.FRONTEND_URL.rstrip('/')}/login?error=social_auth_failed")
    refresh = RefreshToken.for_user(request.user)
    # 企業フローならアカウント種別を company に（学生なら company / both の設計は要件に合わせて）
    role = request.GET.get("role")
    if role == "company":
        u = request.user
        if u.account_type != "company":
            u.account_type = "company"
            u.save(update_fields=["account_type"])
    next_path = request.GET.get("next","/")
    if not next_path.startswith("/"): next_path = "/"
    sep = "&" if "?" in next_path else "?"
    target = f"{settings.FRONTEND_URL.rstrip('/')}{next_path}{sep}login=ok"
    resp = redirect(target)
    opts = dict(httponly=True, secure=False, samesite='Lax', path='/')  # 開発
    if request.is_secure(): opts = dict(httponly=True, secure=True, samesite='None', path='/')
    resp.set_cookie("access_token",  str(refresh.access_token), **opts)
    resp.set_cookie("refresh_token", str(refresh),            **opts)
    return resp

# ---- Router ----
router = DefaultRouter()
# 既存
router.register(r'users', UserViewSet)
router.register(r'subjects', SubjectViewSet, basename='subject')
router.register(r'tasks', TaskViewSet, basename='task')
router.register(r'records', RecordViewSet, basename='record')
router.register(r'teams', TeamViewSet)
router.register(r'invitations', TeamInvitationViewSet)
# 新規（master）
router.register(r'master/languages', LanguageMasterViewSet, basename='master-languages')
router.register(r'master/jobroles', JobRoleViewSet, basename='master-jobroles')
router.register(r'master/techareas', TechAreaViewSet, basename='master-techareas')
router.register(r'master/productdomains', ProductDomainViewSet, basename='master-productdomains')
# 新規（プロフィールの付属）
router.register(r'profile/sns', UserSNSViewSet, basename='profile-sns')
router.register(r'profile/portfolio', PortfolioItemViewSet, basename='profile-portfolio')
# 新規（会社）
router.register(r'companies', CompanyViewSet, basename='companies')
router.register(r'company_members', CompanyMemberViewSet, basename='company-members')
router.register(r'company_plans', CompanyPlanViewSet, basename='company-plans')
router.register(r'company_hirings', CompanyHiringViewSet, basename='company-hirings')
# 新規（テンプレ/DM）
router.register(r'templates', MessageTemplateViewSet, basename='templates')
router.register(r'dm/threads', DMThreadViewSet, basename='dm-threads')
router.register(r'dm/messages', DMMessageViewSet, basename='dm-messages')

urlpatterns = [
    # バックからフロントに飛ばすよう
     path("go/front-home/", to_front_home, name="front_home"),
    # --- 残りは既存のルーティング ---
    path('api/auth/user/', PatchedUserDetailsView.as_view(), name='rest_user_details'),
    path('api/auth/',          include('dj_rest_auth.urls')),
    path('api/auth/registration/', include('dj_rest_auth.registration.urls')),
    path('api/',               include(router.urls)),
    # Cookie-JWT
    path('api/token/',         CookieTokenObtainPairView.as_view(),  name='token_obtain_pair'),
    path('api/token/refresh/', CookieTokenRefreshView.as_view(),     name='token_refresh'),
    path('api/auth/logout/',   CookieLogoutView.as_view(),           name='rest_logout'),
    path('api/auth/user/',     UserDetailsView.as_view(),            name='rest_user_details'),

    # 認証系
    path('api/auth/',                   include('dj_rest_auth.urls')),
    path('api/auth/registration/',      include('dj_rest_auth.registration.urls')),
    path("api/auth/social/jwt/",        social_jwt_issuer, name="social_jwt_issuer"),

    # 公開プロフィール & 自分のプロフィール
    path('api/public/users/<uuid:user_id>/profile/', PublicProfileView.as_view()),
    path('api/profile/me/', MyProfileView.as_view()),
    path('api/public/username/<str:username>/profile/', PublicProfileByNameView.as_view()),
    path('api/public/username/<str:username>/activity_kpi/', PublicActivityKPIByNameView.as_view()),
    # company
    path('api/public/companies/<slug:slug>/', PublicCompanyView.as_view()),
    path('api/dm/threads/summary/', MyDMThreadsSummary.as_view()),       # 学生一覧
    path('api/dm/threads/<uuid:thread_id>/detail/', DMThreadDetailView.as_view()),
    path('api/companies/<uuid:company_id>/invite_by_email/', CompanyMemberInviteView.as_view()),

    # 既存 & 新規のViewSet群
    path('api/', include(router.urls)),
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

    # フロント誘導/管理/他
    path("go/front-home/", to_front_home, name="front_home"),
    path("accounts/login/", _to_front_login, name="account_login"),
    path("accounts/signup/", _to_front_login, name="account_signup"),
    path("accounts/password/reset/", _404, name="account_reset_password"),
    path("accounts/password/change/", _404, name="account_change_password"),
    path("accounts/email/", _404, name="account_email"),
    path("accounts/inactive/", _404, name="account_inactive"),
    path("accounts/", include("allauth.urls")),
    path("admin/", admin.site.urls),
]
urlpatterns += [ 
    path("api/auth/social/jwt/", social_jwt_issuer, name="social_jwt_issuer"), 
]
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
