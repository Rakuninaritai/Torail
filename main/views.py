from rest_framework import viewsets, permissions
from rest_framework.permissions import IsAuthenticated
from django.db import models
from django.db.models import Q
from django.conf import settings
from django.shortcuts import get_object_or_404
from .models import User, Subject, Task, Record, Language,Team, TeamMembership, TeamInvitation,Integration
from .serializers import UserSerializer, SubjectSerializer, TaskSerializer, RecordWriteSerializer,RecordReadSerializer, LanguageSerializer,TeamSerializer, TeamMembershipSerializer,TeamInvitationSerializer#IntegrationSerializer
from rest_framework_simplejwt.views import TokenObtainPairView,TokenRefreshView
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from dj_rest_auth.views import LogoutView
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken,TokenError
from django_filters.rest_framework import DjangoFilterBackend
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

class BaseSharedViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    # ここでは filter_backends / filterset_fields は指定しない

    def get_shared_queryset(self, model_cls):
        user       = self.request.user
        team_param = self.request.query_params.get('team')

        # 2) team=all
        if team_param == 'all':
            return model_cls.objects.filter(
                Q(user=user, team__isnull=True) |
                Q(team__memberships__user=user)
            ).distinct()
            
        # 1) team=<数字>
        if team_param :
            team = get_object_or_404(
                Team,
                id=team_param,
                memberships__user=user
            )
            return model_cls.objects.filter(team=team)

        

        # 3) team=null ／ パラメータなし
        return model_cls.objects.filter(user=user, team__isnull=True)


class SubjectViewSet(BaseSharedViewSet):
    serializer_class = SubjectSerializer
    def get_queryset(self):
        return self.get_shared_queryset(Subject)
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class TaskViewSet(BaseSharedViewSet):
    serializer_class = TaskSerializer
    def get_queryset(self):
        return self.get_shared_queryset(Task)
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class IsTeamMember(permissions.BasePermission):
    """
    チーム関連オブジェクト（Team, Record.team!=None）へのアクセス制御
    チームの人でないとはいらせない
    - チームのオーナー or membership に含まれるユーザーのみ許可
    """
    def has_object_permission(self, request, view, obj):
        # チームオブジェクトなら owner or membership に含まれるか
        if isinstance(obj, Team):
            return  obj.memberships.filter(user=request.user).exists()
        # レコードオブジェクトで team が設定済みなら同様にチェック
        if isinstance(obj, Record) and obj.team:
            team = obj.team
            return team.memberships.filter(user=request.user).exists()
        # 個人レコード（team=None）は IsAuthenticated で OK
        return True
      
class RecordViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsTeamMember]

    def get_queryset(self):
        user       = self.request.user
        team_param = self.request.query_params.get('team')

        # 1) team=<数字> のときは特定チームのレコードのみ
        if team_param :
            team = get_object_or_404(
                Team,
                id=team_param,
                memberships__user=user
            )
            return Record.objects.filter(team=team)

        # 2) それ以外（パラメータなし／team=null／team=all）はすべて取得
        return Record.objects.filter(
            Q(user=user,            team__isnull=True)  | 
            Q(team__memberships__user=user)
        ).distinct()

    def get_serializer_class(self):
        if self.action in ['create','update','partial_update']:
            return RecordWriteSerializer
        return RecordReadSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
        
# Subject
# class SubjectViewSet(viewsets.ModelViewSet):
#   queryset=Subject.objects.all()
#   serializer_class=SubjectSerializer
#   permission_classes=[IsAuthenticated]
#   filter_backends = [DjangoFilterBackend]
#   filterset_fields = {
#         'team': ['exact', 'isnull'],  # ← isnull を有効に
#     }
  
#   def get_queryset(self):
#       user    = self.request.user
#       team_id = self.request.query_params.get('team', None)

#       # ─── チーム指定あり ───
#       if team_id:
#           # 「team=null」もしくは空文字が来たら個人レコードだけ
#           if team_id.lower() in ('null', ''):
#               return Subject.objects.filter(user=user, team__isnull=True)

#           # それ以外の team=<id> はそのチームの全レコード
#           team = get_object_or_404(Team, id=team_id, memberships__user=user)
#           return Subject.objects.filter(team=team)

#       # ─── デフォルト／パラメータなし ───
#       # 個人レコードだけ返す
#       return Subject.objects.filter(user=user, team__isnull=True)

#   def perform_create(self, serializer):
#       serializer.save(user=self.request.user)

# Task
# class TaskViewSet(viewsets.ModelViewSet):
#   queryset=Task.objects.all()
#   serializer_class=TaskSerializer
#   permission_classes=[IsAuthenticated]
#   filter_backends    = [DjangoFilterBackend]
#   filterset_fields   = {'team': ['exact', 'isnull']}

#   def get_queryset(self):
#       user    = self.request.user
#       team_id = self.request.query_params.get('team', None)

#       if team_id:
#           if team_id.lower() in ('null', ''):
#               return Task.objects.filter(user=user, team__isnull=True)
#           team = get_object_or_404(Team, id=team_id,memberships__user=user)
#           return Task.objects.filter(team=team)

#       return Task.objects.filter(user=user, team__isnull=True)

#   def perform_create(self, serializer):
#       serializer.save(user=self.request.user)

# Language
class LanguageViewSet(viewsets.ModelViewSet):
  queryset = Language.objects.all()
  serializer_class = LanguageSerializer
  permission_classes = [IsAuthenticated]




class TeamViewSet(viewsets.ModelViewSet):
    """
    /api/teams/ エンドポイント
    - GET: 自分がオーナー or メンバーのチームを返却
    - POST: 新規チーム作成（owner=request.user）
    """
    queryset = Team.objects.all()
    serializer_class = TeamSerializer
    permission_classes = [IsAuthenticated, IsTeamMember]

    # get時そのユーザーがメンバーかメンバーのチームを返却
    def get_queryset(self):
        # owner かどうかに関係なく，自分が members に入っているチームを返す
        return Team.objects.filter(memberships__user=self.request.user).distinct()

    # post時そのユーザーがオーナーでチーム作成
    def perform_create(self, serializer):
        team = serializer.save(owner=self.request.user)  # owner は単に作成者記録
        # 作成者を membership にも自動で追加しておくと便利
        TeamMembership.objects.create(team=team, user=self.request.user)
        
    # 自分をチームから脱退
    @action(detail=True, methods=['post'], url_path='leave')
    def leave(self, request, pk=None):
        """
        自分をチームから脱退させる
        POST /api/teams/{team_id}/leave/
        """
        team = self.get_object()

        # オーナーは脱退させない
        if team.owner == request.user:
            raise PermissionDenied("チームオーナーは脱退できません。")

        # 自分のメンバーシップを取得して削除
        membership = get_object_or_404(
            TeamMembership,
            team=team,
            user=request.user
        )
        membership.delete()

        return Response({'status': 'left'}, status=204)

# Record
# class RecordViewSet(viewsets.ModelViewSet):
#   # クエリセットはclassが定義された段階で呼ばれる(必要)noneでも
#   # get_quarysetはリクエストがあった段階で呼ばれる
#   queryset=Record.objects.none()
#   # serializer_class = RecordReadSerializer
#   # queryset=Record.objects.all()
#   permission_classes=[IsAuthenticated,IsTeamMember]
  
#   def get_queryset(self):
#       user    = self.request.user
#       team_id = self.request.query_params.get('team', None)

#       # ─── チームID指定あり ───
#       if team_id and team_id.lower() not in ('null', ''):
#           # チームのメンバー権限チェック（IsTeamMember でカバーしていなければここでも）
#           team = get_object_or_404(
#               Team,
#               id=team_id,
#               memberships__user=user
#           )
#           return Record.objects.filter(team=team)

#       # ─── デフォルト／team=null／パラメータなし ───
#       # ログインユーザーの作成した全レコードを返す
#       return Record.objects.filter(user=user)

#   def get_serializer_class(self):
#       if self.action in ['create', 'update', 'partial_update']:
#           return RecordWriteSerializer
#       return RecordReadSerializer

#   def perform_create(self, serializer):
#       serializer.save(user=self.request.user)
    
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
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['team', 'accepted']

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        # デフォルトでは、自分が送った or 自分が受け取ったものだけ
        qs = qs.filter(Q(invited_by=user) | Q(invited_user=user))

        # クエリパラメータに team があったら、そのチーム全体の招待一覧に切り替え
        team_id = self.request.query_params.get('team')
        if team_id:
            team = get_object_or_404(Team, pk=team_id)
            # チームのメンバーだけが見られるようにチェック
            if not team.memberships.filter(user=user).exists():
                raise PermissionDenied("このチームの招待一覧を参照する権限がありません")
            qs = TeamInvitation.objects.filter(team=team)  # チーム全体
        return qs

    def perform_create(self, serializer):
        team = serializer.validated_data['team']
        if not team.memberships.filter(user=self.request.user).exists():
            raise PermissionDenied("チームメンバーのみ招待を送信できます")
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

# # backend/main/views.py など
# def build_discord_oauth_url(team_id: str) -> str:
#     from urllib.parse import urlencode

#     params = {
#         "client_id": settings.DISCORD_CLIENT_ID,
#         "scope": "bot identify",
#         "permissions": settings.DISCORD_PERMS,        # 例: 2048
#         "response_type": "code",                     # ★ 必須
#         "redirect_uri": settings.DISCORD_REDIRECT_URI,  # 例: http://localhost:8000/api/integrations/discord/callback/
#         "state": team_id,                            # ← チーム UUID
#     }
#     return "https://discord.com/api/oauth2/authorize?" + urlencode(params, safe=":/")
  
# class IntegrationViewSet(viewsets.ModelViewSet):
#     """
#     /api/integrations/
#       - GET: 自分がメンバーのチームの連携一覧
#       - POST: チームメンバーが連携レコードを作成
#     """
#     serializer_class = IntegrationSerializer
#     permission_classes = [IsAuthenticated, IsTeamMember]
#     filter_backends = [DjangoFilterBackend]
#     filterset_fields = ["team", "provider"]

#     def get_queryset(self):
#         user = self.request.user
#         qs = Integration.objects.filter(team__memberships__user=user)
#         team_id = self.request.query_params.get("team")
#         if team_id:
#             qs = qs.filter(team__id=team_id)
#         return qs

#     def perform_create(self, serializer):
#         team = serializer.validated_data["team"]
#         # チームメンバー以外は作成禁止
#         if not team.memberships.filter(user=self.request.user).exists():
#             raise PermissionDenied("チームメンバーのみ連携を作成できます")
#         serializer.save()
