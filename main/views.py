# main/views.py
from rest_framework import viewsets, permissions
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404
from django.http import JsonResponse, HttpResponse
from django.db.models import Q,Max,Count
from django.db.models.functions import Coalesce, Cast
from django.db.models import DateTimeField
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.contrib.auth.views import LogoutView
from django.conf import settings
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from rest_framework import parsers
from datetime import timedelta
from datetime import datetime
from dj_rest_auth.views import UserDetailsView
from django.utils import timezone
from django.db import IntegrityError, transaction
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from django.views.decorators.csrf import csrf_exempt
import json
import stripe
import logging

from .models import (
    User, Team, Subject, Task, Record, TeamMembership, TeamInvitation, Integration,
    LanguageMaster, UserProfile, UserSNS, PortfolioItem,
    JobRole, TechArea, ProductDomain,
    Company, CompanyMember, CompanyPlan, CompanyHiring,
    MessageTemplate, DMThread, DMMessage,UserProfile
)
from .serializers import (
    UserSerializer, SubjectSerializer, TaskSerializer, RecordReadSerializer, RecordWriteSerializer,
    TeamSerializer, TeamMembershipSerializer, TeamInvitationSerializer,
    LanguageMasterSerializer, UserProfileSerializer, UserProfileWriteSerializer, UserSNSSerializer, PortfolioItemSerializer,
    JobRoleSerializer, TechAreaSerializer, ProductDomainSerializer,
    CompanySerializer, CompanyMemberSerializer, CompanyPlanSerializer, CompanyHiringSerializer,
    MessageTemplateSerializer, DMThreadSerializer, DMMessageSerializer,CompanyHiringPublicSerializer,CompanyPublicSerializer,CandidateBriefSerializer
)
from .authentication import CookieJWTAuthentication
# --- Stripe Checkout endpoints (create session + webhook) ---
# 解説:
# - フロントエンドは /api/stripe/create-checkout-session/ に POST し、
#   サーバ側で Stripe Checkout Session を作成します。
# - サーバは作成時に軽量な Order レコードを残し、Checkout 完了は
#   Stripe の webhook (stripe_webhook) で受けて Order/CompanySubscription を更新します。
# - subscription の場合は `price_id`（price_...）と `company_id` が必要です。
# - セキュリティ: subscription 作成は会社のオーナー/管理者のみ許可しています。
@csrf_exempt
def create_checkout_session(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=400)
    logger = logging.getLogger(__name__)
    # Debug: log auth / cookie / header presence (do NOT log secrets)
    try:
        user_obj = getattr(request, 'user', None)
        is_auth = bool(user_obj and getattr(user_obj, 'is_authenticated', False))
        # If this is a plain Django HttpRequest (function view), DRF authentication
        # may not have run. Try to authenticate using our CookieJWTAuthentication
        # so that `request.user` is available when cookies contain JWT.
        if not is_auth:
            try:
                auth = CookieJWTAuthentication()
                auth_res = auth.authenticate(request)
                if auth_res:
                    # auth_res is (user, validated_token)
                    request.user = auth_res[0]
                    user_obj = request.user
                    is_auth = True
            except Exception:
                # ignore auth errors here; we'll treat as unauthenticated below
                pass
        logger.info('create_checkout_session called; method=%s path=%s authenticated=%s user_id=%s',
                    request.method, request.path, is_auth, getattr(user_obj, 'id', None))
        logger.info('Request.COOKIES keys=%s', list(request.COOKIES.keys()))
        logger.info('HTTP_COOKIE header present=%s', bool(request.META.get('HTTP_COOKIE')))
        logger.info('X-CSRFToken header present=%s', bool(request.META.get('HTTP_X_CSRFTOKEN')))
        logger.info('Authorization header present=%s', bool(request.META.get('HTTP_AUTHORIZATION')))
    except Exception:
        # never fail the view due to logging
        pass
    stripe.api_key = settings.STRIPE_SECRET_KEY
    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'error': 'invalid json'}, status=400)

    mode = data.get('mode', 'payment')
    price_id = data.get('price_id')
    company_id = data.get('company_id')
    success_url = data.get('success_url') or (settings.FRONTEND_URL.rstrip('/') + '/success')
    cancel_url = data.get('cancel_url') or (settings.FRONTEND_URL.rstrip('/') + '/cancel')
    metadata = data.get('metadata', {}) or {}

    try:
        if mode == 'subscription':
            # subscription mode requires price_id and company_id
            if not price_id or not company_id:
                return JsonResponse({'error': 'price_id and company_id are required for subscription'}, status=400)

            # membership check: allow any company member (previously owner/admin only)
            # - フロントからは Cookie ベースの認証で request.user を送る想定
            # - ここでは会社に所属するメンバーであることだけを確認し、作成を許可します
            if not getattr(request, 'user', None) or not request.user.is_authenticated:
                return JsonResponse({'error': 'authentication required'}, status=401)
            if not CompanyMember.objects.filter(company__id=company_id, user=request.user).exists():
                return JsonResponse({'error': 'forbidden'}, status=403)

            # Stripe Checkout Session を作成する（サブスクリプション）
            # - frontend は price_id（price_...）を渡すこと（product_id では動かない）
            # - metadata に会社IDを入れておくと webhook 側で紐付けしやすくなる
            session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[{'price': price_id, 'quantity': 1}],
                mode='subscription',
                success_url=success_url,
                cancel_url=cancel_url,
                metadata={**metadata, 'company_id': str(company_id)},
            )

            # create Order stub linking company
            # - ここでは金額を 0 にして stub 作成（本当の請求は Stripe 側が管理）
            try:
                from .models import Order, Company
                company = Company.objects.get(id=company_id)
                Order.objects.create(
                    user=request.user,
                    company=company,
                    amount=0,
                    currency='jpy',
                    stripe_session_id=session.id,
                )
            except Exception:
                # ログや通知を入れるとデバッグが楽になりますが、ここでは安全に握り潰す
                pass

            # Stripe.js の redirectToCheckout が廃止されたため
            # Checkout Session の `url` を返してフロントで直接遷移する方式に切り替える。
            return JsonResponse({'sessionId': session.id, 'url': getattr(session, 'url', None)})

        else:
            # one-time payment
            amount = data.get('amount')
            if amount is None:
                return JsonResponse({'error': 'amount is required'}, status=400)
            currency = data.get('currency', 'jpy')
            name = data.get('name', '購入')

            session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[{
                    'price_data': {
                        'currency': currency,
                        'product_data': {'name': name},
                        'unit_amount': int(amount),
                    },
                    'quantity': 1,
                }],
                mode='payment',
                success_url=success_url,
                cancel_url=cancel_url,
                metadata=metadata,
            )

            try:
                from .models import Order
                Order.objects.create(
                    user=(request.user if getattr(request, 'user', None) and request.user.is_authenticated else None),
                    amount=int(amount),
                    currency=currency,
                    stripe_session_id=session.id,
                )
            except Exception:
                pass

            # 同様に one-time payment の場合も session.url を返す
            return JsonResponse({'sessionId': session.id, 'url': getattr(session, 'url', None)})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def stripe_webhook(request):
    logger = logging.getLogger(__name__)
    stripe.api_key = settings.STRIPE_SECRET_KEY
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE', '')
    webhook_secret = settings.STRIPE_WEBHOOK_SECRET
    logger.info(f'Webhook called: has_secret={bool(webhook_secret)}, has_sig={bool(sig_header)}')
    try:
        if webhook_secret:
            event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
            logger.info(f'Webhook signature verified successfully')
        else:
            logger.warning(f'STRIPE_WEBHOOK_SECRET not set, processing unsigned webhook')
            event = json.loads(payload)
        logger.info(f'Webhook received: type={event.get("type")}, id={event.get("id")}')
    except ValueError as e:
        logger.error(f'Webhook ValueError: {e}')
        return HttpResponse(status=400)
    except Exception as e:
        logger.error(f'Webhook error: {e}')
        return HttpResponse(status=400)

    # ハンドリング: webhook イベントごとに処理を分岐します
    ev_type = event.get('type')
    if ev_type == 'checkout.session.completed':
        # Checkout が完了した直後のイベント
        # - session オブジェクトには subscription や payment_intent の参照が入る
        # - metadata に入れた company_id を使って CompanySubscription を作成/更新する
        session = event['data']['object']
        logger.info(f'checkout.session.completed: session_id={session.get("id")}, mode={session.get("mode")}, subscription={session.get("subscription")}')
        try:
            from .models import Order, CompanySubscription, Company
            # ① Order を探して paid フラグを立てる
            order = Order.objects.filter(stripe_session_id=session.get('id')).first()
            if order:
                logger.info(f'Order found: order_id={order.id}, updating paid=True')
                order.paid = True
                order.stripe_payment_intent_id = session.get('payment_intent') or order.stripe_payment_intent_id
                order.save(update_fields=['paid','stripe_payment_intent_id','updated_at'])
                logger.info(f'Order updated: order_id={order.id}, paid=True')
            else:
                logger.warning(f'Order not found for session_id={session.get("id")}')

            # ② サブスクリプションがあれば CompanySubscription を作成/更新
            subscription_id = session.get('subscription')
            metadata = session.get('metadata') or {}
            company_id = metadata.get('company_id')
            logger.info(f'Subscription check: subscription_id={subscription_id}, company_id={company_id}')
            if subscription_id and company_id:
                try:
                    company = Company.objects.filter(id=company_id).first()
                    if company:
                        # get_or_create で初回作成、既存なら status を active に更新
                        sub, created = CompanySubscription.objects.get_or_create(
                            stripe_subscription_id=subscription_id,
                            defaults={'company': company, 'status': 'active'}
                        )
                        if not created:
                            sub.company = company
                            sub.status = 'active'
                            sub.save()
                        logger.info(f'CompanySubscription {"created" if created else "updated"}: sub_id={sub.id}, company_id={company_id}')
                    else:
                        logger.warning(f'Company not found for company_id={company_id}')
                except Exception as e:
                    logger.error(f'CompanySubscription error: {e}')
        except Exception as e:
            logger.error(f'checkout.session.completed error: {e}')
    elif ev_type == 'invoice.payment_succeeded':
        invoice = event['data']['object']
        subscription_id = invoice.get('subscription')
        logger.info(f'invoice.payment_succeeded: subscription_id={subscription_id}')
        if subscription_id:
            try:
                from .models import CompanySubscription
                sub = CompanySubscription.objects.filter(stripe_subscription_id=subscription_id).first()
                if sub:
                    sub.status = 'active'
                    # invoice に period_end が入っている場合を使う
                    period_end = invoice.get('lines', {}).get('data', [])
                    period_end_ts = invoice.get('period_end') or invoice.get('current_period_end')
                    if period_end_ts:
                        try:
                            sub.current_period_end = datetime.fromtimestamp(int(period_end_ts))
                        except Exception:
                            pass
                    sub.save()
                    logger.info(f'CompanySubscription updated: sub_id={sub.id}, status=active')
                else:
                    logger.warning(f'CompanySubscription not found for subscription_id={subscription_id}')
            except Exception as e:
                logger.error(f'invoice.payment_succeeded error: {e}')
    elif ev_type == 'payment_intent.succeeded':
        pi = event['data']['object']
        logger.info(f'payment_intent.succeeded: pi_id={pi.get("id")}')
        try:
            from .models import Order
            order = Order.objects.filter(stripe_payment_intent_id=pi.get('id')).first()
            if order:
                order.paid = True
                order.save(update_fields=['paid','updated_at'])
                logger.info(f'Order updated via payment_intent: order_id={order.id}, paid=True')
            else:
                logger.warning(f'Order not found for payment_intent_id={pi.get("id")}')
        except Exception as e:
            logger.error(f'payment_intent.succeeded error: {e}')
    else:
        logger.info(f'Webhook event not handled: type={ev_type}')

    return HttpResponse(status=200)


@csrf_exempt
def retrieve_checkout_session(request):
    """GET /api/stripe/session/?session_id=cs_...
    - Returns stored Order info if present, otherwise fetches the Checkout Session
      from Stripe and returns its key fields so the frontend can verify status.
    - No authentication required because this is typically called from the success
      redirect (but you can expand to require auth if desired).
    """
    logger = logging.getLogger(__name__)
    from django.views.decorators.http import require_GET
    if request.method != 'GET':
        return JsonResponse({'error': 'GET required'}, status=400)
    session_id = request.GET.get('session_id')
    logger.info(f'retrieve_checkout_session called: session_id={session_id}')
    # If client didn't provide session_id, try to resolve the most-recent Order
    # for the authenticated user (this supports success URL without params)
    if not session_id:
        # Attempt cookie-based authentication like other function views
        try:
            auth = CookieJWTAuthentication()
            auth_res = auth.authenticate(request)
            if auth_res:
                request.user = auth_res[0]
        except Exception:
            pass

        if getattr(request, 'user', None) and getattr(request.user, 'is_authenticated', False):
            try:
                from .models import Order
                last_order = Order.objects.filter(user=request.user).order_by('-created_at').first()
                if last_order and last_order.stripe_session_id:
                    session_id = last_order.stripe_session_id
                    logger.info(f'Resolved session_id from user: {session_id}')
                else:
                    logger.warning(f'No recent session found for user')
                    return JsonResponse({'error': 'no recent session found for user'}, status=404)
            except Exception as e:
                logger.error(f'Error resolving recent session: {e}')
                return JsonResponse({'error': 'unable to resolve recent session'}, status=500)
        else:
            logger.warning(f'session_id required or authenticate')
            return JsonResponse({'error': 'session_id required or authenticate'}, status=400)

    stripe.api_key = settings.STRIPE_SECRET_KEY
    resp = {'sessionId': session_id}
    try:
        # Try to find an Order in our DB first
        from .models import Order, CompanySubscription
        order = Order.objects.filter(stripe_session_id=session_id).first()
        if order:
            resp['order'] = {
                'id': order.id,
                'paid': bool(order.paid),
                'amount': getattr(order, 'amount', None),
                'currency': getattr(order, 'currency', None),
            }
            logger.info(f'Order found: id={order.id}, paid={order.paid}')
        else:
            logger.warning(f'Order not found in DB for session_id={session_id}')

        # Fetch Stripe Checkout Session to get authoritative status
        try:
            session = stripe.checkout.Session.retrieve(session_id)
            resp['stripe'] = {
                'id': session.get('id'),
                'payment_status': session.get('payment_status'),
                'status': session.get('status'),
                'subscription': session.get('subscription'),
                'payment_intent': session.get('payment_intent'),
                'mode': session.get('mode'),
            }
            logger.info(f'Stripe session retrieved: payment_status={session.get("payment_status")}, subscription={session.get("subscription")}')
            # If there's a subscription id, try to include our CompanySubscription status
            subscription_id = session.get('subscription')
            if subscription_id:
                sub = CompanySubscription.objects.filter(stripe_subscription_id=subscription_id).first()
                if sub:
                    resp['company_subscription'] = {
                        'id': sub.id,
                        'status': sub.status,
                        'current_period_end': getattr(sub, 'current_period_end', None),
                    }
                    logger.info(f'CompanySubscription found: id={sub.id}, status={sub.status}')
                else:
                    logger.warning(f'CompanySubscription not found for subscription_id={subscription_id}')
        except Exception as e:
            # non-fatal: still return DB order info if present
            logger.error(f'Error retrieving Stripe session: {e}')
            pass

        logger.info(f'retrieve_checkout_session response: {resp}')
        return JsonResponse(resp)
    except Exception as e:
        logger.error(f'retrieve_checkout_session error: {e}')
        return JsonResponse({'error': str(e)}, status=500)

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
        # 非学生アカウントは公開プロファイルを持たない
        if getattr(user, 'account_type', None) not in ('student', 'both'):
            return Response({'detail': 'not found'}, status=404)
        if not prof or not prof.is_public:
            return Response({'detail':'not public'}, status=404)
        return Response(UserProfileSerializer(prof, context={'request': request}).data)

# ==== 自分のプロフィール編集 ====
class MyProfileView(APIView):
    permission_classes=[IsAuthenticated]
    parser_classes = [parsers.JSONParser, parsers.FormParser, parsers.MultiPartParser]
    def get(self, request):
        # 非学生アカウントにはプロフィール機能を提供しない
        if getattr(request.user, 'account_type', None) not in ('student', 'both'):
            return Response({'detail': 'not found'}, status=404)
        prof, _ = UserProfile.objects.get_or_create(user=request.user)
        return Response(UserProfileSerializer(prof, context={'request': request}).data)

    def patch(self, request):
        # 非学生アカウントにはプロフィール編集を許可しない
        if getattr(request.user, 'account_type', None) not in ('student', 'both'):
            return Response({'detail': 'not found'}, status=404)
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
    # def perform_create(self, serializer): serializer.save(user=self.request.user)
    
    @action(detail=False, methods=['get'], url_path='active')
    def active(self, request):
        """
        CO: 現在“未確定（timer_state≠2）”の自分のレコードを1件返す。
            - グローバルに1件しか存在しないことをDB制約で保証
            - チーム絞り（?team=<uuid>|null|all）を付けると、UI側の案内用にスコープ一致/不一致を判断できる
        """
        user = request.user
        team_param = request.query_params.get('team')  # CO: 'null' / 'all' / <uuid> / None

        # CO: ベースは自分の“未確定”一式
        base = (
            Record.objects
            .filter(user=user)
            .exclude(timer_state=2)  # ★ state=2（確定）以外
            .annotate(
                sort_key=Coalesce('end_time', 'start_time', Cast('date', DateTimeField()))
            )  # ★ これが無いと order_by('-sort_key') で落ちる
        )

        # CO: スコープ条件（UIの警告に使える。グローバルで1件のみなので、返すのは先頭1件）
        if team_param is not None and str(team_param).lower() == 'null':
            scoped = base.filter(team__isnull=True)
        elif team_param == 'all':
            scoped = base  # CO: そのまま（個人＋所属チーム全体）
        elif team_param:
            team = get_object_or_404(Team, id=team_param, memberships__user=user)
            scoped = base.filter(team=team)
        else:
            # CO: UIが単に「今走ってるものを知りたい」場合
            scoped = base

        rec = scoped.order_by('-sort_key', '-id').first()
        if not rec:
            # CO: 存在しない場合は 204 No Content
            return Response(status=204)

        # CO: 読み取りは RecordReadSerializer で
        ser = RecordReadSerializer(rec, context={'request': request})
        return Response(ser.data, status=200)

    def perform_create(self, serializer):
        """
        CO: 2重起動に対しては DB 制約に任せつつ、エラーメッセージを親切化
        """
        try:
            with transaction.atomic():          # CO: 競合時に確実に IntegrityError を捕捉
                serializer.save(user=self.request.user)
        except IntegrityError:
            # CO: DB の uniq_active_record_per_user に引っかかった場合
            raise PermissionDenied("未確定レコードは同時に1件までです。先に確定または停止してください。")

    def perform_update(self, serializer):
        """
        CO: 更新でも“未確定化”する変更が重複しないように同じ保護をかける
        """
        try:
            with transaction.atomic():
                serializer.save()
        except IntegrityError:
            raise PermissionDenied("未確定レコードは同時に1件までです。先に確定または停止してください。")


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

        # 既に同じ会社のメンバーか、他社に所属していないかチェック
        if CompanyMember.objects.filter(company=company, user=target).exists():
            return Response({'detail': 'すでにこの会社のメンバーです'}, status=400)
        if CompanyMember.objects.filter(user=target).exists():
            return Response({'detail': '既に別の会社に所属しています'}, status=400)

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
        # ユーザーが既にどこかの会社に所属していないことを確認
        user = serializer.validated_data.get('user')
        if user and CompanyMember.objects.filter(user=user).exists():
            raise PermissionDenied("そのユーザーは既にいずれかの会社に所属しています。")
        serializer.save()
    def perform_destroy(self, instance):
        _require_owner(instance.company, self.request.user)
        return super().perform_destroy(instance)

class CompanyPlanViewSet(viewsets.ModelViewSet):
    serializer_class = CompanyPlanSerializer
    permission_classes=[IsAuthenticated]
    def get_queryset(self):
        # 最新の適用開始日が先頭に来るようにソートして返す
        return CompanyPlan.objects.filter(company__members__user=self.request.user).order_by('-active_from')
    def perform_create(self, serializer):
        company = serializer.validated_data['company']
        # 変更: オーナーのみではなく、会社メンバーであればプラン作成を許可する
        if not CompanyMember.objects.filter(company=company, user=self.request.user).exists():
            raise PermissionDenied("会社メンバーのみ作成できます")
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

class CandidateSearchPagination(PageNumberPagination):
    page_size = 12
    page_size_query_param = "page_size"
    max_page_size = 50
class CandidateSearchView(APIView):
     permission_classes = [IsAuthenticated]

     def get(self, request):
         qs = UserProfile.objects.select_related("user").prefetch_related("languages")

         # 企業から見えるのは公開のみ
         qs = qs.filter(is_public=True)

         # --- filters ---
         langs = request.GET.get("languages")
         if langs:
             # フロントは language の slug を送る想定だが、name や aliases でもマッチするようにする
             arr = [s.strip() for s in langs.split(",") if s.strip()]
             if arr:
                lang_q = Q()
                # 各候補について slug/name/aliases を case-insensitive に照合
                for a in arr:
                    lang_q |= (
                        Q(languages__slug__iexact=a)
                        | Q(languages__name__iexact=a)
                        | Q(languages__aliases__icontains=a)
                    )
                qs = qs.filter(lang_q).distinct()

         grade = request.GET.get("grade")
         if grade:
             qs = qs.filter(grade=grade)

         pref = request.GET.get("pref")
         if pref:
            # サマリー的な地域グループ（関東/関西/東海/九州）を受け取る場合は所属都道府県群に展開する
            region_map = {
                '関東': ['茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県'],
                '関西': ['大阪府','兵庫県','京都府','滋賀県','奈良県','和歌山県'],
                '東海': ['愛知県','岐阜県','静岡県','三重県'],
                '九州': ['福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'],
            }
            if pref in region_map:
                qs = qs.filter(prefecture__in=region_map[pref])
            else:
                qs = qs.filter(prefecture=pref)

         q = request.GET.get("q")
         if q:
             q = q.strip()
             # username は User モデル側のフィールドなので related lookup を用いる
             qs = qs.filter(
                 Q(user__username__icontains=q) |
                 Q(display_name__icontains=q) |
                 Q(school__icontains=q)
             )

         # --- recent activity filter ---
         recent_days = request.GET.get("recent_active_days")
         if recent_days:
             try:
                 n = int(recent_days)
                 if n > 0:
                     qs = qs.filter(
                         Q(user__record__end_time__gte=self._days_ago(n)) |
                         Q(user__record__start_time__gte=self._days_ago(n)) |
                         Q(user__record__date__gte=self._days_ago_date(n))
                     ).distinct()
             except ValueError:
                 pass

        # visibility パラメータはダッシュボード側では使用しない

         # --- activity 集計 ---
         qs = qs.annotate(
             last_record_at=Max("user__record__end_time"),
             active7_count=Count(
                 "user__record",
                 filter=(
                     Q(user__record__end_time__gte=self._days_ago(7)) |
                     Q(user__record__start_time__gte=self._days_ago(7)) |
                     Q(user__record__date__gte=self._days_ago_date(7))
                 ),
                 distinct=True,
             ),
             active30_count=Count(
                 "user__record",
                 filter=(
                     Q(user__record__end_time__gte=self._days_ago(30)) |
                     Q(user__record__start_time__gte=self._days_ago(30)) |
                     Q(user__record__date__gte=self._days_ago_date(30))
                 ),
                 distinct=True,
             ),
         )

         # --- sort ---
         sort = request.GET.get("sort") or "active7"
         if sort == "recent":
             qs = qs.order_by("-last_record_at", "-id")
         elif sort == "new":
             qs = qs.order_by("-user__date_joined", "-id")
         else:
             qs = qs.order_by("-active7_count", "-active30_count", "-id")

         # --- post-annotations filters (ストリーク等の近似) ---
         # 注: 厳密な「連続日数ストリーク」はここでは複雑なので、
         # 活動日数を近似として用いる（active7_count/active30_count）
         try:
             cur_st = int(request.GET.get("current_streak_min") or 0)
         except ValueError:
             cur_st = 0
         try:
             max_st = int(request.GET.get("max_streak_min") or 0)
         except ValueError:
             max_st = 0
         if cur_st > 0:
             # 直近7日内のアクティブ日数が閾値以上
             qs = qs.filter(active7_count__gte=cur_st)
         if max_st > 0:
             qs = qs.filter(active30_count__gte=max_st)

         # --- paginate (最終的なフィルタ後にページング) ---
         paginator = CandidateSearchPagination()
         page = paginator.paginate_queryset(qs, request)

         def _abs_avatar_url(p: UserProfile):
             # ImageField の絶対URL化
             if getattr(p, "avatar", None) and hasattr(p.avatar, "url"):
                 try:
                     return request.build_absolute_uri(p.avatar.url)
                 except Exception:
                     return p.avatar.url
             return ""

         def _row(p: UserProfile):
             langs = list(p.languages.values_list("name", flat=True))
             return {
                 "user_id": p.user.id,
                 "username": p.user.username,
                 "display_name": p.display_name or p.user.username,
                 "school": p.school or "",
                 "grade": p.grade or "",
                 "prefecture": p.prefecture or "",
                 "languages": langs,
                 "active7": getattr(p, "active7_count", 0),
                 "active30": getattr(p, "active30_count", 0),
                 "lastRecordAt": getattr(p, "last_record_at", None),
                # 一覧は公開のみ返しているため visibility フィールドは返さない
                 "avatar_url": _abs_avatar_url(p),
                 "fav": False,
             }

         # paginator.paginate_queryset が None を返す可能性に備える
         if page is None:
             page = []
         data = [_row(p) for p in page]
         ser = CandidateBriefSerializer(data, many=True)
         return paginator.get_paginated_response(ser.data)

     @staticmethod
     def _days_ago(n):
         from django.utils import timezone
         return timezone.now() - timezone.timedelta(days=n)

     @staticmethod
     def _days_ago_date(n):
         from django.utils import timezone
         return (timezone.now() - timezone.timedelta(days=n)).date()


class PublicCompanyView(APIView):
    permission_classes = [AllowAny]
    def get(self, request, slug):
        company = get_object_or_404(Company, slug=slug)
        # 非公開設定なら見せない
        if not getattr(company, 'is_public', True):
            return Response({'detail': 'not public'}, status=404)

        hirings = []
        if getattr(company, 'show_hirings', True):
            hirings = CompanyHiringPublicSerializer(company.hirings.order_by('-created_at'), many=True).data

        data = {
            "company": CompanyPublicSerializer(company).data,
            "hirings": hirings,
        }
        return Response(data)

class UsernameSearchView(APIView):
    """ユーザー名で検索（企業側のメンバー追加用）
    GET /api/users/search_by_username/?q=<query>
    - account_type が 'student' のユーザーは除外する
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        q = (request.query_params.get('q') or '').strip()
        if not q:
            return Response([], status=200)
        qs = User.objects.filter(username__icontains=q).exclude(account_type='student').order_by('username')[:20]
        data = []
        for u in qs:
            data.append({
                'id': str(u.id),
                'username': u.username,
                'email': u.email or '',
                'account_type': getattr(u, 'account_type', None),
            })
        return Response(data)
class CompanyMemberInviteView(APIView):
    permission_classes=[IsAuthenticated]
    def post(self, request, company_id):
        email = request.data.get('email')
        comp = get_object_or_404(Company, pk=company_id)
        _require_owner(comp, request.user)  # ownerのみ
        user = get_object_or_404(User, email=email)
        # 他社所属チェック
        if CompanyMember.objects.filter(user=user).exists():
            return Response({'detail': 'そのユーザーは既に別の会社に所属しています'}, status=400)
        CompanyMember.objects.get_or_create(company=comp, user=user, defaults={'role':'member'})
        return Response({"status":"ok"})
# 学生のScoutBox用：スレッド一覧（要約）
class MyDMThreadsSummary(APIView):
    permission_classes=[IsAuthenticated]
    def get(self, request):
        # このエンドポイントは学生向け（企業にはメールボックスは不要）
        if getattr(request.user, 'account_type', None) not in ('student', 'both'):
            return Response({'detail': 'not found'}, status=404)
        # 学生側の自分宛スレッド
        qs = DMThread.objects.filter(user=request.user).select_related('company').order_by('-created_at')
        q = (request.query_params.get('q') or '').strip()
        if q:
            qs = qs.filter(
                Q(company__name__icontains=q) |
                Q(user__username__icontains=q) |
                Q(user__profile__display_name__icontains=q) |
                Q(messages__subject__icontains=q) |
                Q(messages__body__icontains=q)
            ).distinct()
        # 直近の最後のメッセージとステータス類を添える
        result = []
        for th in qs:
            last = th.messages.order_by('-created_at').first()
            status = "未読"
            if last:
                # 既読状態: 最終メッセージの既読フラグに応じて判定
                # - 最終送信が company の場合は student(s) 側の is_read_by_user を参照
                # - 最終送信が user の場合は company 側の is_read_by_company を参照
                if last.sender == 'company':
                    if last.is_read_by_user: status = "既読"
                else:
                    if last.is_read_by_company: status = "既読"
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
        msgs_qs = DMMessage.objects.filter(thread=th).order_by('created_at')
        msgs = []
        # 判定: 現在のユーザーが会社メンバーかどうか
        is_company_member = CompanyMember.objects.filter(company=th.company, user=request.user).exists()
        for m in msgs_qs:
            # is_mine: company 側ログインかつ送信者が company の場合、
            # または スレッドの user と現在ユーザーが一致し sender が 'user' の場合
            if is_company_member and m.sender == 'company':
                mine = True
            elif th.user == request.user and m.sender == 'user':
                mine = True
            else:
                mine = False
            msgs.append({
                'id': str(m.id),
                'sender': m.sender,
                'subject': m.subject,
                'body': m.body,
                'created_at': m.created_at.isoformat(),
                'is_read_by_company': m.is_read_by_company,
                'is_read_by_user': m.is_read_by_user,
                'is_mine': mine,
            })

        # スレッドの相手ユーザー情報を追加して返す
        user = th.user
        display_name = getattr(getattr(user, 'profile', None), 'display_name', None) or user.username
        return Response({
            "thread": {
                "id": str(th.id),
                "company": th.company.name,
                "company_slug": th.company.slug,
                "user": {"id": str(user.id), "username": user.username, "display_name": display_name}
            },
            "messages": msgs,
        })


class MarkThreadReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, thread_id):
        th = get_object_or_404(DMThread, pk=thread_id)
        # アクセス権チェック
        if not (th.user == request.user or CompanyMember.objects.filter(company=th.company, user=request.user).exists()):
            raise PermissionDenied("参照できません")

        # 会社ログイン者なら company 宛ての未読フラグを更新（相手が user のメッセージを既読にする）
        if CompanyMember.objects.filter(company=th.company, user=request.user).exists():
            DMMessage.objects.filter(thread=th, sender='user', is_read_by_company=False).update(is_read_by_company=True)
        else:
            # 学生として開いた場合、会社からのメッセージを既読にする
            DMMessage.objects.filter(thread=th, sender='company', is_read_by_user=False).update(is_read_by_user=True)

        return Response({'status': 'ok'})
# ==== Templates / DM ====
class MessageTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = MessageTemplateSerializer
    permission_classes=[IsAuthenticated]
    def get_queryset(self):
        # 企業は自社テンプレのみ、個人は個人テンプレのみを返す
        # 会社メンバーが複数社所属するケースは稀だが、所属する最初の会社を採用
        cm = CompanyMember.objects.filter(user=self.request.user).first()
        owner_company = self.request.query_params.get('company')
        if cm and not owner_company:
            return MessageTemplate.objects.filter(owner_company=cm.company).order_by('-created_at')
        # クエリで company 指定があればそれを優先（管理用途など）
        if owner_company:
            return MessageTemplate.objects.filter(owner_company_id=owner_company).order_by('-created_at')
        # デフォルトは個人テンプレ
        return MessageTemplate.objects.filter(owner_user=self.request.user).order_by('-created_at')
    def perform_create(self, serializer):
        # company or user のどちらかで作成できる
        # 優先順: 明示的に owner_company があればそれを使う。なければログインユーザーが会社メンバーなら会社所有で保存。
        if serializer.validated_data.get('owner_company'):
            return serializer.save()
        # 会社メンバーであれば最初の所属会社を owner_company にする
        cm = CompanyMember.objects.filter(user=self.request.user).first()
        if cm:
            return serializer.save(owner_company=cm.company)
        # それ以外はユーザー所有として保存
        return serializer.save(owner_user=self.request.user)

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
        # 検索パラメータ q をサポート（会社名、ユーザー名、メッセージ件名/本文）
        q = (self.request.query_params.get('q') or '').strip()
        if q:
            qs = qs.filter(
                Q(company__name__icontains=q) |
                Q(user__username__icontains=q) |
                Q(user__profile__display_name__icontains=q) |
                Q(messages__subject__icontains=q) |
                Q(messages__body__icontains=q)
            ).distinct()
        return qs
    def perform_create(self, serializer):
        comp = serializer.validated_data['company']
        # 会社側のみスレッド作成許可（企業→学生への最初のDM）
        if not CompanyMember.objects.filter(company=comp, user=self.request.user).exists():
            raise PermissionDenied("会社メンバーのみ作成できます")

        # プラン残数があるかを確認し、トランザクション内で減算してからスレッド作成
        from django.utils import timezone as _tz
        today = _tz.localdate()
        try:
            with transaction.atomic():
                # 優先: 有効期間内のプラン。なければ最新プランを参照
                plan = (CompanyPlan.objects
                        .filter(company=comp)
                        .filter(Q(active_from__lte=today))
                        .filter(Q(active_to__isnull=True) | Q(active_to__gte=today))
                        .order_by('-active_from')
                        .first())
                if not plan:
                    plan = CompanyPlan.objects.filter(company=comp).order_by('-active_from').first()

                if plan:
                    # 残数が None の場合は monthly_quota を初期値として扱う
                    if plan.remaining is None:
                        plan.remaining = int(plan.monthly_quota or 0)
                    if plan.remaining <= 0:
                        raise PermissionDenied("送信可能な残り件数がありません。プランを確認してください。")
                    # 減算
                    plan.remaining = plan.remaining - 1
                    plan.save(update_fields=['remaining'])

                serializer.save()
        except IntegrityError:
            # 競合等で失敗した場合は適切に PermissionDenied を投げる
            raise PermissionDenied("スレッド作成に失敗しました（競合または残数不足の可能性）。")

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
        # 非学生アカウントはパブリックプロフィールを持たない
        if getattr(user, 'account_type', None) not in ('student', 'both'):
            return Response({'detail': 'not found'}, status=404)
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
