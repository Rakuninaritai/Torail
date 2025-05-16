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
from main.views import UserViewSet, SubjectViewSet, TaskViewSet, RecordViewSet, LanguageViewSet
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
# urlsではAPIのエンドポイント(URLを決める)

# defaultrouterでCRUDのAPIエンドポイントを自動で作ってくれる(手動でGE,POST等書かなくていい)
router=DefaultRouter()
# api/userでuserviewsetが呼び出せるようにしてる(api/でrouterを読み込んでるので書くのはそれ以降)
# rはpythonが/をそのままの文字列で解釈するために必要
router.register(r'users',UserViewSet)
router.register(r'subjects',SubjectViewSet)
router.register(r'tasks',TaskViewSet)
router.register(r'languages',LanguageViewSet)
router.register(r'records',RecordViewSet)

urlpatterns = [
    # api/ならinclude先を確認
    path("api/", include(router.urls), name=""),
    # ログインしてアクセストークンとリフレッシュトークンを取得
    path("api/token/",TokenObtainPairView.as_view(),name="token_obtain_pair"),
    # リフトーでアクトーを更新
    path("api/token/refresh/",TokenRefreshView.as_view(),name="token_refresh"),
    # ユーザー認証用のエンドポイント
    path('api/auth/', include('dj_rest_auth.urls')),
    # ユーザー登録用のエンドポイント
    path('api/auth/registration/', include('dj_rest_auth.registration.urls')),
    path("admin/", admin.site.urls),
]
