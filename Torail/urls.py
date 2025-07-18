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
# from main.tsuchi_tsukawan.integrations import discord_callback,discord_oauth_url,discord_channels

# urlsではAPIのエンドポイント(URLを決める)

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
    path("admin/", admin.site.urls),
]
