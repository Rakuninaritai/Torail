# main/views.py
from rest_framework import viewsets, permissions
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404
from django.db.models import Q
from django.db.models.functions import Coalesce, Cast
from django.db.models import DateTimeField
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.contrib.auth.views import LogoutView
from django.conf import settings
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from rest_framework import parsers
from datetime import timedelta
from dj_rest_auth.views import UserDetailsView
from django.utils import timezone

from .models import (
    User, Team, Subject, Task, Record, TeamMembership, TeamInvitation, Integration,
    LanguageMaster, UserProfile, UserSNS, PortfolioItem,
    JobRole, TechArea, ProductDomain,
    Company, CompanyMember, CompanyPlan, CompanyHiring,
    MessageTemplate, DMThread, DMMessage
)
from .serializers import (
    UserSerializer, SubjectSerializer, TaskSerializer, RecordReadSerializer, RecordWriteSerializer,
    TeamSerializer, TeamMembershipSerializer, TeamInvitationSerializer,
    LanguageMasterSerializer, UserProfileSerializer, UserProfileWriteSerializer, UserSNSSerializer, PortfolioItemSerializer,
    JobRoleSerializer, TechAreaSerializer, ProductDomainSerializer,
    CompanySerializer, CompanyMemberSerializer, CompanyPlanSerializer, CompanyHiringSerializer,
    MessageTemplateSerializer, DMThreadSerializer, DMMessageSerializer,CompanyHiringPublicSerializer,CompanyPublicSerializer
)
# 当該を返す
class PatchedUserDetailsView(UserDetailsView):
    serializer_class = UserSerializer
# ==== 既存 User ====
class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes=[IsAuthenticated]


# ==== マスター（全て閲覧は AllowAny でOK） ====
class LanguageMasterViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = LanguageMaster.objects.filter(is_active=True).order_by('-popularity','name')
    serializer_class = LanguageMasterSerializer
    permission_classes=[AllowAny]
    def get_queryset(self):
        qs = super().get_queryset()
        q = self.request.query_params.get('q')
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(slug__icontains=q) | Q(aliases__icontains=q))
        return qs
    
class JobRoleViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = JobRole.objects.all().order_by('name')
    serializer_class = JobRoleSerializer
    permission_classes=[AllowAny]

class TechAreaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = TechArea.objects.all().order_by('name')
    serializer_class = TechAreaSerializer
    permission_classes=[AllowAny]

class ProductDomainViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ProductDomain.objects.all().order_by('name')
    serializer_class = ProductDomainSerializer
    permission_classes=[AllowAny]


# ==== 公開プロフィール ====
from rest_framework.views import APIView
class PublicProfileView(APIView):
    """
    未ログインでも閲覧OK。個人情報は profile 経由で制御。
    GET /api/public/users/<uuid>/profile/
    """
    permission_classes = [AllowAny]
    def get(self, request, user_id):
        user = get_object_or_404(User, pk=user_id)
        prof = getattr(user, 'profile', None)
        if not prof or not prof.is_public:
            return Response({'detail':'not public'}, status=404)
        return Response(UserProfileSerializer(prof, context={'request': request}).data)

# ==== 自分のプロフィール編集 ====
class MyProfileView(APIView):
    permission_classes=[IsAuthenticated]
    parser_classes = [parsers.JSONParser, parsers.FormParser, parsers.MultiPartParser]
    def get(self, request):
        prof, _ = UserProfile.objects.get_or_create(user=request.user)
        return Response(UserProfileSerializer(prof, context={'request': request}).data)

    def patch(self, request):
        prof, _ = UserProfile.objects.get_or_create(user=request.user)
        # 画像が来ていたら先に保存
        f = request.FILES.get('avatar')
        if f:
            prof.avatar = f
            prof.save(update_fields=['avatar'])
        ser = UserProfileWriteSerializer(prof, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        prof = ser.save()
        return Response(UserProfileSerializer(prof, context={'request': request}).data)


# SNS / PF の簡易CRUD（本人のみ）
class UserSNSViewSet(viewsets.ModelViewSet):
    serializer_class = UserSNSSerializer
    permission_classes=[IsAuthenticated]
    def get_queryset(self):
        return UserSNS.objects.filter(user=self.request.user).order_by('-created_at')
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class PortfolioItemViewSet(viewsets.ModelViewSet):
    serializer_class = PortfolioItemSerializer
    permission_classes=[IsAuthenticated]
    def get_queryset(self):
        return PortfolioItem.objects.filter(user=self.request.user).order_by('-created_at')
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class PublicActivityKPIByNameView(APIView):
    """
    公開プロフィールのユーザーについて、
    本人が記録したすべて（個人/チーム）のうち、確定(timer_state=2)のみを集計。
    返却：KPI / 直近30日の強度配列(0–4) / 言語別の総時間（時間単位）
    GET /api/public/username/<username>/activity_kpi/
      - ?scope=all|personal|team （任意）
    """
    permission_classes = [AllowAny]

    def get(self, request, username):
        from .models import User, Record
        user = get_object_or_404(User, username=username)

        prof = getattr(user, 'profile', None)
        if not prof or not prof.is_public:
            return Response({'detail': 'not public'}, status=404)

        scope = request.query_params.get('scope', 'all')

        qs = Record.objects.filter(user=user, timer_state=2)
        if scope == 'personal':
            qs = qs.filter(team__isnull=True)
        elif scope == 'team':
            qs = qs.filter(team__isnull=False)

        # ---- 日別合計（分）
        daily = {}
        # 言語内訳用に languages をプリフェッチ
        qs = qs.only('id', 'date', 'start_time', 'end_time', 'duration').prefetch_related('languages')

        # 言語→合計時間（時間単位）
        lang_hours = {}  # { "Python": 12.5, ... }
        OTHER_LABEL = "未指定"

        for rec in qs:
            # 日付キー（date優先 → end_time → start_time → 今日）
            if rec.date:
                dt = rec.date
            elif rec.end_time:
                dt = rec.end_time.date()
            elif rec.start_time:
                dt = rec.start_time.date()
            else:
                dt = timezone.localdate()

            minutes = max(0, round(((rec.duration or 0) / 1000) / 60))
            key = dt.isoformat()
            daily[key] = daily.get(key, 0) + minutes

            # --- 言語按分
            langs = list(rec.languages.all())
            hours_total = minutes / 60.0
            if langs:
                share = hours_total / len(langs)
                for l in langs:
                    name = l.name or OTHER_LABEL
                    lang_hours[name] = lang_hours.get(name, 0.0) + share
            else:
                # 言語未指定はまとめる
                lang_hours[OTHER_LABEL] = lang_hours.get(OTHER_LABEL, 0.0) + hours_total

        # ---- KPIユーティリティ
        def levels_last_n(daily_map, n=30):
            today = timezone.localdate()
            vals, active = [], 0
            for i in range(n-1, -1, -1):
                d = today - timedelta(days=i)
                m = daily_map.get(d.isoformat(), 0)
                if m > 0: active += 1
                level = 0 if m == 0 else 1 if m <= 30 else 2 if m <= 60 else 3 if m <= 120 else 4
                vals.append(level)
            return vals, active

        def streaks(daily_map):
            today = timezone.localdate()
            span = 370
            cur = 0
            for i in range(span):
                d = (today - timedelta(days=i)).isoformat()
                if daily_map.get(d, 0) > 0: cur += 1
                else: break
            run = 0
            mx = 0
            for i in range(span, -1, -1):
                d = (today - timedelta(days=i)).isoformat()
                if daily_map.get(d, 0) > 0:
                    run += 1
                    if run > mx: mx = run
                else:
                    run = 0
            return cur, mx

        last_update = '—'
        if daily:
            last_update = sorted([k for k, v in daily.items() if v > 0])[-1]

        activity30, active30 = levels_last_n(daily, 30)
        _, active7 = levels_last_n(daily, 7)
        s_now, s_max = streaks(daily)

        offs = []
        today = timezone.localdate()
        for i in range(6, -1, -1):
            d = today - timedelta(days=i)
            if daily.get(d.isoformat(), 0) == 0:
                offs.append(f"{d.month}/{d.day}")

        # ---- 言語内訳（時間）を降順で並べ、少数2桁で丸め
        lang_breakdown = [
            {"label": name, "hours": round(hours, 2)}
            for name, hours in sorted(lang_hours.items(), key=lambda x: x[1], reverse=True)
            if hours > 0
        ]

        payload = {
            "kpi": {
                "streakNow": s_now,
                "streakMax": s_max,
                "lastUpdate": last_update,
                "active7": active7,
                "active30": active30,
                "offHint": ", ".join(offs) if offs else "—",
            },
            "activity30": activity30,
            "lang_breakdown": lang_breakdown,  # ★ 追加
        }
        return Response(payload, status=200)


# ==== Subject/Task/Record（既存ロジックを利用） ====
class BaseSharedViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    def get_shared_queryset(self, model_cls):
        user       = self.request.user
        team_param = self.request.query_params.get('team')
        if team_param is not None and str(team_param).lower() == 'null':
            return model_cls.objects.filter(user=user, team__isnull=True)
        if team_param == 'all':
            return model_cls.objects.filter(Q(user=user, team__isnull=True)|Q(team__memberships__user=user)).distinct()
        if team_param:
            team = get_object_or_404(Team, id=team_param, memberships__user=user)
            return model_cls.objects.filter(team=team)
        return model_cls.objects.filter(user=user, team__isnull=True)

class SubjectViewSet(BaseSharedViewSet):
    serializer_class = SubjectSerializer
    def get_queryset(self): return self.get_shared_queryset(Subject)
    def perform_create(self, serializer): serializer.save(user=self.request.user)

class TaskViewSet(BaseSharedViewSet):
    serializer_class = TaskSerializer
    def get_queryset(self): return self.get_shared_queryset(Task)
    def perform_create(self, serializer): serializer.save(user=self.request.user)

class IsTeamMember(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        from .models import Record as _Record, Team as _Team
        if isinstance(obj, _Team):
            return obj.memberships.filter(user=request.user).exists()
        if isinstance(obj, _Record) and obj.team:
            return obj.team.memberships.filter(user=request.user).exists()
        return True

class RecordViewSet(viewsets.ModelViewSet):
    permission_classes=[IsAuthenticated, IsTeamMember]
    def get_queryset(self):
        user       = self.request.user
        team_param = self.request.query_params.get('team')
        mine       = self.request.query_params.get('mine','').lower() in ('1','true','yes','y')
        if mine:
            qs = Record.objects.filter(user=user).filter(Q(team__isnull=True)|Q(team__memberships__user=user))
            return qs.distinct()
        if team_param is not None and str(team_param).lower() == 'null':
            return Record.objects.filter(user=user, team__isnull=True)
        if team_param:
            team = get_object_or_404(Team, id=team_param, memberships__user=user)
            return Record.objects.filter(team=team)
        return Record.objects.filter(Q(user=user, team__isnull=True)|Q(team__memberships__user=user)).distinct()

    @action(detail=False, methods=['get'], url_path='recent_languages')
    def recent_languages(self, request):
        user = request.user
        subject = request.query_params.get('subject')
        task    = request.query_params.get('task')
        rec_id  = request.query_params.get('record')
        before  = request.query_params.get('before')
        if not subject or not task:
            return Response({"detail":"subject と task は必須です。"}, status=400)
        base = (Record.objects
                .filter(user=user, subject_id=subject, task_id=task, timer_state=2)
                .annotate(sort_key=Coalesce('end_time','start_time', Cast('date', DateTimeField())))
                .order_by('-sort_key'))
        if rec_id:
            try:
                cur = (Record.objects
                       .filter(pk=rec_id, user=user)
                       .annotate(sort_key=Coalesce('end_time','start_time', Cast('date', DateTimeField())))
                       .get())
                base = base.filter(sort_key__lt=cur.sort_key)
            except Record.DoesNotExist:
                pass
        elif before:
            base = base.filter(sort_key__lt=before)
        prev_rec = base.prefetch_related('languages').first()
        if not prev_rec: return Response([], status=200)
        langs = list(prev_rec.languages.values('id','name','slug'))
        return Response(langs, status=200)

    def get_serializer_class(self):
        return RecordWriteSerializer if self.action in ['create','update','partial_update'] else RecordReadSerializer
    def perform_create(self, serializer): serializer.save(user=self.request.user)


# ==== Company & Member & Plan & Hiring ====
class IsCompanyMember(permissions.BasePermission):
    """
    company 関連は company.members に含まれているかで制御
    """
    def has_object_permission(self, request, view, obj):
        if isinstance(obj, Company):
            return obj.members.filter(user=request.user).exists()
        return True

def _require_owner(company: Company, user: User):
    if not CompanyMember.objects.filter(company=company, user=user, role='owner').exists():
        raise PermissionDenied("Owner 権限が必要です。")

class CompanyViewSet(viewsets.ModelViewSet):
    serializer_class = CompanySerializer
    permission_classes=[IsAuthenticated, IsCompanyMember]

    def get_queryset(self):
        return Company.objects.filter(members__user=self.request.user).distinct()

    def perform_create(self, serializer):
        # 既にどこかの会社メンバーなら新規作成不可（運用意図通り）
        if CompanyMember.objects.filter(user=self.request.user).exists():
            raise PermissionDenied("既にいずれかの会社に所属しています。新規作成はできません。")
        company = serializer.save(owner=self.request.user)
        CompanyMember.objects.create(company=company, user=self.request.user, role='owner')
    @action(detail=True, methods=['post'], url_path='invite_by_email')
    def invite_by_email(self, request, pk=None):
        company = self.get_object()
        _require_owner(company, request.user)  # オーナーのみ

        email = (request.data.get('email') or '').strip().lower()
        if not email:
            return Response({'detail': 'email は必須です'}, status=400)

        try:
            target = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            # 方針：未登録なら“先にサインアップして待ってもらう”
            return Response({'detail': 'ユーザーが見つかりません。先に企業サインアップをお願いします。'}, status=404)

        # 既に所属？
        if CompanyMember.objects.filter(company=company, user=target).exists():
            return Response({'detail': 'すでにこの会社のメンバーです'}, status=400)

        CompanyMember.objects.create(company=company, user=target, role='member')
        # 学生→両方に昇格
        if target.account_type == 'student':
            target.account_type = 'both'
            target.save(update_fields=['account_type'])

        return Response({'status':'ok'})

class CompanyMemberViewSet(viewsets.ModelViewSet):
    serializer_class = CompanyMemberSerializer
    permission_classes=[IsAuthenticated]
    def get_queryset(self):
        company_id = self.request.query_params.get('company')
        qs = CompanyMember.objects.filter(company__members__user=self.request.user)
        if company_id: qs = qs.filter(company_id=company_id)
        return qs
    def perform_create(self, serializer):
        company = serializer.validated_data['company']
        _require_owner(company, self.request.user)
        serializer.save()
    def perform_destroy(self, instance):
        _require_owner(instance.company, self.request.user)
        return super().perform_destroy(instance)

class CompanyPlanViewSet(viewsets.ModelViewSet):
    serializer_class = CompanyPlanSerializer
    permission_classes=[IsAuthenticated]
    def get_queryset(self):
        return CompanyPlan.objects.filter(company__members__user=self.request.user)
    def perform_create(self, serializer):
        company = serializer.validated_data['company']
        _require_owner(company, self.request.user)
        serializer.save()

class CompanyHiringViewSet(viewsets.ModelViewSet):
    serializer_class = CompanyHiringSerializer
    permission_classes=[IsAuthenticated]
    def get_queryset(self):
        return CompanyHiring.objects.filter(company__members__user=self.request.user).order_by('-created_at')
    def perform_create(self, serializer):
        company = serializer.validated_data['company']
        if not CompanyMember.objects.filter(company=company, user=self.request.user).exists():
            raise PermissionDenied("会社メンバーのみ作成できます")
        serializer.save()

class PublicCompanyView(APIView):
    permission_classes = [AllowAny]
    def get(self, request, slug):
        company = get_object_or_404(Company, slug=slug)
        data = {
            "company": CompanyPublicSerializer(company).data,
            "hirings": CompanyHiringPublicSerializer(company.hirings.order_by('-created_at'), many=True).data,
        }
        return Response(data)
class CompanyMemberInviteView(APIView):
    permission_classes=[IsAuthenticated]
    def post(self, request, company_id):
        email = request.data.get('email')
        comp = get_object_or_404(Company, pk=company_id)
        _require_owner(comp, request.user)  # ownerのみ
        user = get_object_or_404(User, email=email)
        CompanyMember.objects.get_or_create(company=comp, user=user, defaults={'role':'member'})
        return Response({"status":"ok"})
# 学生のScoutBox用：スレッド一覧（要約）
class MyDMThreadsSummary(APIView):
    permission_classes=[IsAuthenticated]
    def get(self, request):
        # 学生側の自分宛スレッド
        qs = DMThread.objects.filter(user=request.user).select_related('company').order_by('-created_at')
        # 直近の最後のメッセージとステータス類を添える
        result = []
        for th in qs:
            last = th.messages.order_by('-created_at').first()
            status = "未読"
            if last:
                # 既読状態: 学生が読んだかどうかで判定
                if last.is_read_by_user: status = "既読"
                # 返信あり: 学生→company の送信が存在すれば
                if th.messages.filter(sender='user').exists(): status = "返信あり"
            result.append({
                "thread_id": str(th.id),
                "company": th.company.name,
                "company_slug": th.company.slug,
                "subject": last.subject if last else "",
                "snippet": (last.body[:80] + "…") if last and len(last.body) > 80 else (last.body if last else ""),
                "sentAt": (last.created_at.strftime("%Y-%m-%d %H:%M") if last else th.created_at.strftime("%Y-%m-%d %H:%M")),
                "status": status,
                "tags": [],  # 必要なら CompanyHiring 紐付け等で拡張
            })
        return Response(result)

class DMThreadDetailView(APIView):
    permission_classes=[IsAuthenticated]
    def get(self, request, thread_id):
        th = get_object_or_404(DMThread, pk=thread_id)
        if not (th.user == request.user or CompanyMember.objects.filter(company=th.company, user=request.user).exists()):
            raise PermissionDenied("参照できません")
        msgs = DMMessage.objects.filter(thread=th).order_by('created_at').values(
            'id','sender','subject','body','created_at','is_read_by_company','is_read_by_user'
        )
        return Response({
            "thread": {"id": str(th.id), "company": th.company.name, "company_slug": th.company.slug},
            "messages": list(msgs),
        })
# ==== Templates / DM ====
class MessageTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = MessageTemplateSerializer
    permission_classes=[IsAuthenticated]
    def get_queryset(self):
        qs = MessageTemplate.objects.filter(
            Q(owner_user=self.request.user) |
            Q(owner_company__members__user=self.request.user)
        ).distinct()
        owner_company = self.request.query_params.get('company')
        if owner_company:
            qs = qs.filter(owner_company_id=owner_company)
        return qs
    def perform_create(self, serializer):
        # company or user のどちらかで作成できる
        return serializer.save(owner_user=self.request.user) if not serializer.validated_data.get('owner_company') else serializer.save()

class DMThreadViewSet(viewsets.ModelViewSet):
    serializer_class = DMThreadSerializer
    permission_classes=[IsAuthenticated]
    def get_queryset(self):
        # 会社側 or 学生側のどちらも一覧できる（所属/本人のみ）
        qs = DMThread.objects.filter(
            Q(company__members__user=self.request.user) | Q(user=self.request.user)
        ).distinct().order_by('-created_at')
        company_id = self.request.query_params.get('company')
        if company_id:
            qs = qs.filter(company_id=company_id)
        return qs
    def perform_create(self, serializer):
        comp = serializer.validated_data['company']
        # 会社側のみスレッド作成許可（企業→学生への最初のDM）
        if not CompanyMember.objects.filter(company=comp, user=self.request.user).exists():
            raise PermissionDenied("会社メンバーのみ作成できます")
        serializer.save()

class DMMessageViewSet(viewsets.ModelViewSet):
    serializer_class = DMMessageSerializer
    permission_classes=[IsAuthenticated]
    def get_queryset(self):
        return DMMessage.objects.filter(
            Q(thread__company__members__user=self.request.user) | Q(thread__user=self.request.user)
        ).distinct().order_by('created_at')
    def perform_create(self, serializer):
        thread = serializer.validated_data['thread']
        # 送信者権限チェック
        if CompanyMember.objects.filter(company=thread.company, user=self.request.user).exists():
            sender = 'company'
        elif thread.user == self.request.user:
            sender = 'user'
        else:
            raise PermissionDenied("このスレッドに投稿できません")
        serializer.save(sender=sender)



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
    
def _cookie_opts():
    if settings.DEBUG:
        # ローカル http://localhost:5173 / Vite プロキシ運用
        return dict(httponly=True, secure=False, samesite='Lax', path='/')
    else:
        # 本番 https://torail.app （フロント別オリジンなら None）
        return dict(httponly=True, secure=True, samesite='None', path='/')

class CookieTokenObtainPairView(TokenObtainPairView):
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        opts = _cookie_opts()
        response.set_cookie('access_token',  response.data['access'],  **opts)
        response.set_cookie('refresh_token', response.data['refresh'], **opts)
        response.data.pop('access', None)
        response.data.pop('refresh', None)
        return response

class CookieTokenRefreshView(TokenRefreshView):
    def post(self, request, *args, **kwargs):
        refresh = request.COOKIES.get('refresh_token')
        if not refresh:
            return Response({'detail': 'refresh token が見つかりません'}, status=400)
        request.data['refresh'] = refresh
        response = super().post(request, *args, **kwargs)
        opts = _cookie_opts()
        response.set_cookie('access_token', response.data['access'], **opts)
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
class PublicProfileByNameView(APIView):
    permission_classes = [AllowAny]
    def get(self, request, username):
        user = get_object_or_404(User, username=username)
        prof = getattr(user, 'profile', None)
        if not prof or not prof.is_public:
            return Response({'detail':'not public'}, status=404)
        return Response(UserProfileSerializer(prof, context={'request': request}).data)

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
