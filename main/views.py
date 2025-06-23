from rest_framework import viewsets, permissions
from rest_framework.permissions import IsAuthenticated
from django.db import models
from .models import User, Subject, Task, Record, Language,Team, TeamMembership, TeamInvitation
from .serializers import UserSerializer, SubjectSerializer, TaskSerializer, RecordWriteSerializer,RecordReadSerializer, LanguageSerializer,TeamSerializer, TeamMembershipSerializer,TeamInvitationSerializer
from rest_framework_simplejwt.views import TokenObtainPairView,TokenRefreshView
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from dj_rest_auth.views import LogoutView
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken,TokenError
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

class IsTeamMember(permissions.BasePermission):
    """
    チーム関連オブジェクト（Team, Record.team!=None）へのアクセス制御
    - チームのオーナー or membership に含まれるユーザーのみ許可
    """
    def has_object_permission(self, request, view, obj):
        # チームオブジェクトなら owner or membership に含まれるか
        if isinstance(obj, Team):
            return (
                obj.owner == request.user or
                obj.memberships.filter(user=request.user).exists()
            )
        # レコードオブジェクトで team が設定済みなら同様にチェック
        if isinstance(obj, Record) and obj.team:
            team = obj.team
            return (
                team.owner == request.user or
                team.memberships.filter(user=request.user).exists()
            )
        # 個人レコード（team=None）は IsAuthenticated で OK
        return True


class TeamViewSet(viewsets.ModelViewSet):
    """
    /api/teams/ エンドポイント
    - GET: 自分がオーナー or メンバーのチームを返却
    - POST: 新規チーム作成（owner=request.user）
    """
    queryset = Team.objects.all()
    serializer_class = TeamSerializer
    permission_classes = [IsAuthenticated, IsTeamMember]

    def get_queryset(self):
        return Team.objects.filter(
            models.Q(owner=self.request.user) |
            models.Q(memberships__user=self.request.user)
        ).distinct()

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

# Record
class RecordViewSet(viewsets.ModelViewSet):
  # クエリセットはclassが定義された段階で呼ばれる(必要)noneでも
  # get_quarysetはリクエストがあった段階で呼ばれる
  queryset=Record.objects.none()
  # queryset=Record.objects.all()
  permission_classes=[IsAuthenticated,IsTeamMember]
  
  def get_queryset(self):
    user = self.request.user
    qs = Record.objects.filter(user=user)
    team_id = self.request.query_params.get('team')
    if team_id:
        return qs.filter(team__id=team_id)
    return qs.filter(team__isnull=True)
  
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
      # secure=False,#開発用
      secure=True,##本番用
      samesite='None',##本番用
      # samesite='Lax',
      path='/',
    )
    response.set_cookie(
        'refresh_token',
        response.data['refresh'],
        httponly=True,
        # secure=False,#開発
        secure=True,##本番用
        samesite='None',##本番用
        # samesite='Lax',
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
            # secure=False,      # 本番は True
            secure=True,##本番用
            samesite='None',##本番用
            # samesite='Lax',
            path='/',
        )
        # ボディからは隠す
        response.data.pop('access', None)
        return response
      
# ログアウト用
class CookieLogoutView(LogoutView):
    """
    HttpOnly Cookie を削除しつつ、
    refresh_token をブラックリスト化する。
    """
    def post(self, request, *args, **kwargs):
        # ① 通常の dj-rest-auth Logout 処理
        response = super().post(request, *args, **kwargs)

        # ② Cookie からリフレッシュ・トークンを取得
        refresh = request.COOKIES.get('refresh_token')
        if refresh:
            try:
                # すでに blacklist 済みでも例外を握り潰す
                token = RefreshToken(refresh)
                token.blacklist()
            except TokenError:
                pass

        # ③ Cookie を完全に削除
        response.delete_cookie('access_token')
        response.delete_cookie('refresh_token')
        return response




class TeamInvitationViewSet(viewsets.ModelViewSet):
    """
    /api/invitations/
    - POST: team.owner のみ招待可能
    - GET: 自分が受け取った招待 or 自分が送った招待を確認
    - accept: 招待承認アクション
    """
    queryset = TeamInvitation.objects.all()
    serializer_class = TeamInvitationSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        team = serializer.validated_data['team']
        if team.owner != self.request.user:
            raise PermissionDenied("招待はオーナーのみ可能です")
        serializer.save(invited_by=self.request.user)

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        inv = self.get_object()
        # 招待対象ユーザーのみ承認可
        if inv.invited_user != request.user:
            raise PermissionDenied("他ユーザーの招待は承認できません")
        inv.accepted = True
        inv.save()
        # 承認時に membership レコードを作成
        TeamMembership.objects.create(team=inv.team, user=request.user)
        return Response({'status': 'joined'})


#   エラー対応行った後モデル図シリアらーざviewurls理解