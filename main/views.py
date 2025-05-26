from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import User, Subject, Task, Record, Language
from .serializers import UserSerializer, SubjectSerializer, TaskSerializer, RecordWriteSerializer,RecordReadSerializer, LanguageSerializer
from rest_framework_simplejwt.views import TokenObtainPairView,TokenRefreshView
from rest_framework.response import Response
from dj_rest_auth.views import LogoutView
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
# viewsではどのでーたをどうやって取得、保存、更新、削除できるか決める

# Userに対して
# modelviewsetを使うと取得更新保存削除などのAPIエンドポイントを自動作成してくれる
class UserViewSet(viewsets.ModelViewSet):
  # 土のデータに対して行うか
  queryset=User.objects.all()
  # どのシリアライザーを使うか(何を使ってjsonにするか)
  serializer_class=UserSerializer
  # 認証(ユーザーがログイン)していないと使えないように
  permission_classes=[IsAuthenticated]

# Subject
class SubjectViewSet(viewsets.ModelViewSet):
  queryset=Subject.objects.all()
  serializer_class=SubjectSerializer
  permission_classes=[IsAuthenticated]
  def get_queryset(self):
    # 今ログインしているユーザーのデータを取得する
    return Subject.objects.filter(user=self.request.user)
  # データが作られるとき(POST時)userは今ログインしているユーザー(request.userになる)
  def perform_create(self, serializer):
    serializer.save(user=self.request.user)

# Task
class TaskViewSet(viewsets.ModelViewSet):
  queryset=Task.objects.all()
  serializer_class=TaskSerializer
  permission_classes=[IsAuthenticated]
  def get_queryset(self):
    # 今ログインしているユーザーのデータを取得する
    return Task.objects.filter(user=self.request.user)
  # データが作られるとき(POST時)userは今ログインしているユーザー(request.userになる)
  def perform_create(self, serializer):
    serializer.save(user=self.request.user)

# Language
class LanguageViewSet(viewsets.ModelViewSet):
  queryset = Language.objects.all()
  serializer_class = LanguageSerializer
  permission_classes = [IsAuthenticated]

# Record
class RecordViewSet(viewsets.ModelViewSet):
  # クエリセットはclassが定義された段階で呼ばれる(必要)noneでも
  # get_quarysetはリクエストがあった段階で呼ばれる
  queryset=Record.objects.none()
  # queryset=Record.objects.all()
  permission_classes=[IsAuthenticated]
  
  def get_queryset(self):
    # 今ログインしているユーザーのデータを取得する
    return Record.objects.filter(user=self.request.user)
  
  # actionの種類によって使うシリアライザを分ける(読取書き込み)
  def get_serializer_class(self):
    if self.action in ['create','update','partial_update']:
      return RecordWriteSerializer
    return RecordReadSerializer
  
  # データが作られるとき(POST時)userは今ログインしているユーザー(request.userになる)
  def perform_create(self, serializer):
    serializer.save(user=self.request.user)
    
# ログイン成功時tokenを発行してhttponlycookieにsetするビュー
class CookieTokenObtainPairView(TokenObtainPairView):
  def post(self,request,*args,**kwargs):
    #まず標準処理でアクセストークン/リフレッシュトークンを得る
    response = super().post(request,*args,**kwargs)
    # cookieに設定
    response.set_cookie(
      'access_token',
      response.data['access'],
      httponly=True,
      secure=False,#開発用
      # secure=True,##本番用
      # samesite='None'##本番用
      samesite='Lax',
      path='/',
    )
    response.set_cookie(
        'refresh_token',
        response.data['refresh'],
        httponly=True,
        secure=False,#開発
        # secure=True,##本番用
        # samesite='None'##本番用
        samesite='Lax',
        path='/',
      )
    # ボディからトークンを削除
    response.data.pop('access',None)
    response.data.pop('refresh',None)
    return response
  

# リフレッシュ用
class CookieTokenRefreshView(TokenRefreshView):
    """
    リフレッシュ時にも、新しい access_token を HttpOnly Cookie にセット。
    """
    def post(self, request, *args, **kwargs):
        # 1) Cookie から refresh_token を取得
        refresh = request.COOKIES.get('refresh_token')
        if not refresh:
            return Response({'detail': 'refresh token が見つかりません'}, status=400)
        # 2) request.data に入れて super に委譲
        request.data['refresh'] = refresh
        # 通常のリフレッシュ
        response = super().post(request, *args, **kwargs)
        # Set-Cookie で上書き
        response.set_cookie(
            'access_token',
            response.data['access'],
            httponly=True,
            secure=False,      # 本番は True
            # secure=True,##本番用
            # samesite='None'##本番用
            samesite='Lax',
            path='/',
        )
        # ボディからは隠す
        response.data.pop('access', None)
        return response
      
# ログアウト用
class CookieLogoutView(LogoutView):
    """
    Logout するときは、HttpOnly Cookie を削除し、
    リクエストに含まれていた refresh_token をブラックリスト化。
    """
    def post(self, request, *args, **kwargs):
        # まず標準のブラックリスト処理
        response = super().post(request, *args, **kwargs)
        # クライアントから送られた Cookie を手動で取得
        refresh = request.COOKIES.get('refresh_token')
        if refresh:
            # ブラックリスト化
            RefreshToken(refresh).blacklist()
        # Cookie を完全に削除
        response.delete_cookie('access_token')
        response.delete_cookie('refresh_token')
        return response