# from django.db import models
# from django.contrib.auth.models import AbstractUser
# import uuid
# from django.conf import settings
# # from main.tsuchi_tsukawan.fields import EncryptedTextField 
# # 暗号用
# from cryptography.fernet import Fernet
# import base64

# User = settings.AUTH_USER_MODEL  # 抽象化したカスタムユーザーモデルを参照
# # ユーザーモデルをカスタムしている
# # idをUUIDにすることで整数よりも複雑化させてる。(idを主キー化、デフォルトでuuidが設定される、管理画面での編集false)
# class User(AbstractUser):
#     id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
#     # emailを必須化でソーシャルログイン対応
#     email = models.EmailField(unique=True)

#     def __str__(self):
#         return self.username
    
# class Team(models.Model):
#     """
#     チーム情報
#     - owner: 作成者（オーナー）
#     - name: 画面表示用チーム名（ユニーク）
#     """
#     id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
#     name = models.CharField('チーム名', max_length=100, unique=True)##チーム名ユニークに
#     owner = models.ForeignKey(
#         User,
#         on_delete=models.CASCADE,# ユーザー削除時、チームも削除
#         related_name='owned_teams' # user.owned_teams で取得可能
#     )
#     created_at = models.DateTimeField(auto_now_add=True)
#     NOTIFY_CHOICES = [
#         ('slack', 'Slack'),
#         ('discord', 'Discord'),
#         ('email', 'Email'),
#         ('off', 'Off'),
#     ]
#     notify_mode = models.CharField(
#         max_length=10, choices=NOTIFY_CHOICES, default='off'
#     )

#     def __str__(self):
#         return self.name
      
# # トピックモデル(内容に対してトピック→タスクが作成できる)
# class Subject(models.Model):
#   # idはuuuidで強固かつ主キーに
#   id = models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
#   # nameはトピック名
#   name=models.CharField(max_length=100)
#   # ユーザーは外部キーで引っ張ってきた
#   user=models.ForeignKey(User,on_delete=models.CASCADE)
#   team = models.ForeignKey(
#       Team,
#       on_delete=models.CASCADE,
#       null=True, blank=True,
#       related_name='subjects',
#       help_text='チーム記録なら team にセット、個人記録は NULL'
#   )
#   class Meta:
#     constraints = [
#         # 個人モード (team IS NULL) では user×name の一意制約
#         models.UniqueConstraint(
#             fields=['user', 'name'],
#             condition=models.Q(team__isnull=True),
#             name='unique_personal_subject'
#         ),
#         # チームモード (team IS NOT NULL) では team×name の一意制約
#         models.UniqueConstraint(
#             fields=['team', 'name'],
#             condition=models.Q(team__isnull=False),
#             name='unique_team_subject'
#         ),
#     ]
#   def __str__(self):
#      return self.name
   
# # タスクモデル(どのトピックのどのタスクかみたいな)
# class Task(models.Model):
#   # idはuuuidで強固かつ主キーに
#   id = models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
#   # ユーザーは外部キーで引っ張ってきた
#   user=models.ForeignKey(User,on_delete=models.CASCADE)
#   # どのトピックのタスク化
#   subject=models.ForeignKey(Subject,on_delete=models.CASCADE)
#   # nameはタスク名
#   name=models.CharField(max_length=100)
#   team = models.ForeignKey(
#       Team,
#       on_delete=models.CASCADE,
#       null=True, blank=True,
#       related_name='tasks',
#       help_text='チーム記録なら team にセット、個人記録は NULL'
#   )
  
#   class Meta:
#     constraints = [
#         models.UniqueConstraint(
#         fields=['user','subject','name'],
#         condition=models.Q(team__isnull=True),
#         name='unique_personal_task'
#         ),
#         models.UniqueConstraint(
#             fields=['team','subject','name'],
#             condition=models.Q(team__isnull=False),
#             name='unique_team_task'
#         ),
#     ]
  
#   def __str__(self):
#      return self.name
# # どの言語か(トピックやタスクに依存しない)
# class Language(models.Model):
#     id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
#     name = models.CharField(max_length=50, unique=True)
    
#     def __str__(self):
#         return self.name


    
    


# # 記録登録用レコード
# class Record(models.Model):
#   id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
#   user = models.ForeignKey(User, on_delete=models.CASCADE)
#   subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
#   task = models.ForeignKey(Task, on_delete=models.CASCADE)
#   languages = models.ManyToManyField(
#         Language,
#         blank=True,
#         related_name='records',
#         help_text='複数言語を記録できるようにした'
#     )
#   # いつ記録したか
#   date = models.DateField(auto_now_add=True)
#   # 何をしたかのメモ(省略可)
#   description = models.TextField(blank=True, null=True)
#   # 何分学習したかのやつint
#   duration = models.IntegerField(blank=True, null=True)
#   # 開始時刻を記録
#   start_time = models.DateTimeField(blank=True, null=True)
#   # 終了時刻を記録
#   end_time = models.DateTimeField(blank=True, null=True)
#   # タイマーの状態を記録(0:実行中、1:中断、2:終了、3:保存中(タイマーは止まっているがその他情報まだ))
#   timer_state=models.IntegerField(default=0)
#   # 再開時刻を記録(starttimeではなくこれから差分を取るため)
#   stop_time=models.DateTimeField(blank=True,null=True)
#   team = models.ForeignKey(
#       Team,
#       on_delete=models.CASCADE,
#       null=True, blank=True,
#       related_name='records',
#       help_text='チーム記録なら team にセット、個人記録は NULL'
#   )
#     # こうすることで Record.team が None → 個人／Not None → チーム に振り分けられる

#   def __str__(self):
#       return f"{self.user.username} - {self.task.name} ({self.duration} min)"
# class TeamMembership(models.Model):
#     """
#     チームメンバーシップ
#     - team ＋ user の組み合わせをユニーク化して、複数招待/参加を防止
#     """
#     id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
#     team = models.ForeignKey(
#         Team,
#         on_delete=models.CASCADE,
#         related_name='memberships'# team.memberships で一覧取得
#     )
#     user = models.ForeignKey(
#         User,
#         on_delete=models.CASCADE,
#         related_name='team_memberships'
#     )
#     joined_at = models.DateTimeField(auto_now_add=True)

#     class Meta:
#         unique_together = ('team', 'user') # 同じ組み合わせを重複登録させない


# class TeamInvitation(models.Model):
#     """
#     チーム招待
#     - invited_user: 招待対象ユーザー
#     - invited_by: 招待発行者（必ず team.owner）
#     - token: 承認リンク等で利用する UUID トークン
#     - accepted: 承認済みフラグ
#     """
#     id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
#     team = models.ForeignKey(
#         Team,
#         on_delete=models.CASCADE,
#         related_name='invitations'
#     )
#     invited_user = models.ForeignKey(
#         User,
#         on_delete=models.CASCADE,
#         related_name='invitations_received'
#     )
#     invited_by = models.ForeignKey(
#         User,
#         on_delete=models.CASCADE,
#         related_name='invitations_sent'
#     )
#     token = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
#     created_at = models.DateTimeField(auto_now_add=True)
#     accepted = models.BooleanField(default=False)

#     class Meta:
#         unique_together = ('team', 'invited_user')
        
# from typing import List
# def _build_fernet_from_env_key(s: str | bytes):
#     from cryptography.fernet import Fernet
#     if isinstance(s, str):
#         s = s.encode()
#     # 32bytes の URL-safe Base64 文字列が前提
#     return Fernet(s)

# def _build_fernet_from_secret(secret: str) -> Fernet:
#     # 旧方式（SECRET_KEY 32バイト切り出し→ゼロパディング→base64）
#     key = secret.encode()[:32].ljust(32, b"0")
#     return Fernet(base64.urlsafe_b64encode(key))

# def _fernets_for_decrypt() -> List[Fernet]:
#     """
#     復号時に試す鍵の候補を列挙（新→旧の順）
#     """
#     fns: List[Fernet] = []
#     # 新: FERNET_KEY（推奨）
#     fk = getattr(settings, "FERNET_KEY", None)
#     if fk:
#         fns.append(_build_fernet_from_env_key(fk))
#     # 旧: SECRET_KEY 派生
#     sk = getattr(settings, "SECRET_KEY", None)
#     if sk:
#         fns.append(_build_fernet_from_secret(sk))
#     # さらに一時的な旧鍵がある場合（例：移行期間）
#     ofk = getattr(settings, "OLD_FERNET_KEY", None)
#     if ofk:
#         fns.append(_build_fernet_from_env_key(ofk))
#     if not fns:
#         raise RuntimeError("No Fernet key found. Set FERNET_KEY (recommended).")
#     return fns

# def _fernet_primary() -> Fernet:
#     """
#     暗号化（保存）に使う主鍵：FERNET_KEY があればそれを使う。
#     無ければ SECRET_KEY 派生（非推奨だが後方互換）。
#     """
#     fk = getattr(settings, "FERNET_KEY", None)
#     if fk:
#         return _build_fernet_from_env_key(fk)
#     sk = getattr(settings, "SECRET_KEY", None)
#     if sk:
#         return _build_fernet_from_secret(sk)
#     raise RuntimeError("FERNET_KEY or SECRET_KEY is not set")
# # 通知連携用
# # 現状メールのみで使わないが残しとく
# class Integration(models.Model):
#     """
#     1レコード = 1チームの 1チャネル連携
#     provider   : 'discord' / 'slack' / 'teams'
#     _access_tok: Bot / App 用トークン（暗号化） ← BinaryField に変更
#     workspace  : Discord = guild_id, Slack = workspace_id, Teams = team_id
#     channel_id : 送信先チャネル
#     """
#     id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
#     team         = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='integrations')
#     provider     = models.CharField(max_length=10,
#                      choices=[('discord', 'Discord'), ('slack', 'Slack'), ('teams', 'Teams')])
#     # access_token =  EncryptedTextField()        # at rest で暗号化
#     _access_token = models.BinaryField(null=True, blank=True)
#     workspace_id = models.CharField(max_length=255)
#     channel_id   = models.CharField(max_length=255)
#     created_at   = models.DateTimeField(auto_now_add=True)

#     class Meta:
#         unique_together = ('team', 'provider')  # 1プロバイダーにつき1連携
    
#     # ▼ プロパティで透過的に暗号化/復号する
#     @property
#     def access_token(self) -> str | None:
#         from cryptography.fernet import InvalidToken
#         if not self._access_token:
#             return None
#         ct = bytes(self._access_token)
#         for f in _fernets_for_decrypt():
#             try:
#                 return f.decrypt(ct).decode()
#             except InvalidToken:
#                 continue
#         # どの鍵でも復号できない
#         raise InvalidToken("Access token decrypt failed with all candidate keys.")

#     @access_token.setter
#     def access_token(self, value: str | None):
#         self._access_token = _fernet_primary().encrypt(value.encode()) if value else None



# main/models.py
from django.db import models
from django.contrib.auth.models import AbstractUser
import uuid
from django.conf import settings
from typing import List
from cryptography.fernet import Fernet
import base64
from django.core.validators import FileExtensionValidator
from django.db.models import Q, UniqueConstraint

# ------------------------------------------------------------
# 既存 User を拡張（アカウント種別フラグを追加）
# ------------------------------------------------------------
class User(AbstractUser):
    """
    学生/企業でログイン導線を分けたい前提：
    - account_type: 'student' | 'company' | 'both'
    """
    ACCOUNT_CHOICES = [
        ('student', 'Student'),
        ('company', 'Company'),
        ('both', 'Both'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    account_type = models.CharField(max_length=10, choices=ACCOUNT_CHOICES, default='student')

    def __str__(self):
        return self.username


# ------------------------------------------------------------
# 既存 Team 関連（残置・互換維持）
# ------------------------------------------------------------
class Team(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField('チーム名', max_length=100, unique=True)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='owned_teams')
    created_at = models.DateTimeField(auto_now_add=True)
    NOTIFY_CHOICES = [('slack','Slack'),('discord','Discord'),('email','Email'),('off','Off')]
    notify_mode = models.CharField(max_length=10, choices=NOTIFY_CHOICES, default='off')
    def __str__(self): return self.name


# ------------------------------------------------------------
# 言語マスター（旧 Language 置換用）
# ------------------------------------------------------------
class LanguageMaster(models.Model):
    """
    表記ゆれを防ぐためのマスタ
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=80, unique=True)  # 表示名
    slug = models.SlugField(max_length=80, unique=True)  # 検索/URL用
    aliases = models.JSONField(default=list, blank=True) # ["py","python3"] など
    category = models.CharField(max_length=40, blank=True, default="")
    popularity = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    def __str__(self): return self.name


# ------------------------------------------------------------
# 学生向けプロフィール（公開可）
# ------------------------------------------------------------
class JobRole(models.Model):
    id   = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=60, unique=True)
    def __str__(self): return self.name

class TechArea(models.Model):
    id   = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=60, unique=True)
    def __str__(self): return self.name

class ProductDomain(models.Model):
    id   = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=60, unique=True)
    def __str__(self): return self.name

class UserProfile(models.Model):
    """
    公開プロフィール。未ログイン閲覧OK想定。
    """
    GRADE_CHOICES = [('1','1年'),('2','2年'),('3','3年'),('4','4年'),('M1','修士1'),('M2','修士2')]
    id        = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user      = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    display_name = models.CharField(max_length=80, blank=True, default="")
    school    = models.CharField(max_length=120, blank=True, default="")
    prefecture= models.CharField(max_length=60, blank=True, default="")
    grade     = models.CharField(max_length=4, choices=GRADE_CHOICES, blank=True, default="")
    bio       = models.TextField(blank=True, default="")
    vision    = models.TextField(blank=True, default="")
     # 追加: アイコン（Djangoで保存）
    avatar    = models.ImageField(
        upload_to="avatars/",
        blank=True, null=True,
        validators=[FileExtensionValidator(["jpg","jpeg","png","webp"])]
    )

    # 選択式マスター
    desired_jobs    = models.ManyToManyField(JobRole, blank=True, related_name='profiles')
    tech_areas      = models.ManyToManyField(TechArea, blank=True, related_name='profiles')
    product_domains = models.ManyToManyField(ProductDomain, blank=True, related_name='profiles')
    languages       = models.ManyToManyField(LanguageMaster, blank=True, related_name='profiles')

    # 公開設定（今回は全部グローバル想定。将来拡張用に保持）
    is_public = models.BooleanField(default=True)
    # 追加: 卒業年度（例: '27卒'）
    grad_year = models.CharField(max_length=8, blank=True, default="")

    def __str__(self):
        return f"Profile({self.user.username})"

class UserSNS(models.Model):
    """
    SNSリンク（bi-アイコンクラスを保存）
    """
    id     = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user   = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sns_links')
    icon_class = models.CharField(max_length=40)  # 例: bi-github, bi-twitter-x
    url    = models.URLField()
    created_at = models.DateTimeField(auto_now_add=True)

class PortfolioItem(models.Model):
    id     = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user   = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='portfolio_items')
    title  = models.CharField(max_length=120)
    stack  = models.CharField(max_length=120, blank=True, default="")
    url    = models.URLField(blank=True, default="")
    github = models.URLField(blank=True, default="")
    description = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)


# ------------------------------------------------------------
# 既存の科目/タスク/Record（言語だけ LanguageMaster に付け替え）
# ------------------------------------------------------------
class Subject(models.Model):
    id   = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    team = models.ForeignKey(Team, on_delete=models.CASCADE, null=True, blank=True, related_name='subjects')
    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user','name'], condition=models.Q(team__isnull=True), name='unique_personal_subject'),
            models.UniqueConstraint(fields=['team','name'], condition=models.Q(team__isnull=False), name='unique_team_subject'),
        ]
    def __str__(self): return self.name

class Task(models.Model):
    id   = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    team = models.ForeignKey(Team, on_delete=models.CASCADE, null=True, blank=True, related_name='tasks')
    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user','subject','name'], condition=models.Q(team__isnull=True), name='unique_personal_task'),
            models.UniqueConstraint(fields=['team','subject','name'], condition=models.Q(team__isnull=False), name='unique_team_task'),
        ]
    def __str__(self): return self.name

class Record(models.Model):
    id   = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    task = models.ForeignKey(Task, on_delete=models.CASCADE)
    # ★ 言語を LanguageMaster に変更
    languages = models.ManyToManyField(LanguageMaster, blank=True, related_name='records', help_text='複数言語を記録できる')
    date = models.DateField(auto_now_add=True)
    description = models.TextField(blank=True, null=True)
    duration = models.IntegerField(blank=True, null=True)
    start_time = models.DateTimeField(blank=True, null=True)
    end_time   = models.DateTimeField(blank=True, null=True)
    timer_state = models.IntegerField(default=0)
    stop_time = models.DateTimeField(blank=True, null=True)
    team = models.ForeignKey(Team, on_delete=models.CASCADE, null=True, blank=True, related_name='records')
    class Meta:
        # CO: 既存の ordering などがあれば維持
        constraints = [
            # CO: 「timer_state != 2（未確定）」のものは user ごとに1件まで、をDBで保証
            UniqueConstraint(
                fields=['user'],
                condition=~Q(timer_state=2),   # CO: state=2(確定)は除外＝0/1/3が対象
                name='uniq_active_record_per_user'
            ),
        ]
    def __str__(self):
        return f"{self.user.username} - {self.task.name} ({self.duration} min)"


# ------------------------------------------------------------
# 会社（Company）＋ メンバー（role固定）
# ------------------------------------------------------------
class Company(models.Model):
    id    = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='owned_companies')
    name  = models.CharField(max_length=120, unique=True)
    slug  = models.SlugField(max_length=140, unique=True, default="", blank=True) 
    industry = models.CharField(max_length=120, blank=True, default="")
    website  = models.URLField(blank=True, default="")
    description = models.TextField(blank=True, default="")
    logo_url = models.URLField(blank=True, default="")
    # 公開設定: 会社ページ自体を公開するか、公開ページで募集情報を表示するか
    is_public = models.BooleanField(default=True)
    show_hirings = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    def __str__(self): return self.name
    def save(self, *a, **kw):
        from django.utils.text import slugify
        if not self.slug:
            base = slugify(self.name) or str(self.id)[:8]
            s = base
            i = 1
            while Company.objects.filter(slug=s).exclude(pk=self.pk).exists():
                i += 1
                s = f"{base}-{i}"
            self.slug = s
        return super().save(*a, **kw)

class CompanyMember(models.Model):
    ROLE_CHOICES = [('owner','Owner'), ('member','Member')]
    id      = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='members')
    user    = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='company_memberships')
    role    = models.CharField(max_length=10, choices=ROLE_CHOICES, default='member')
    joined_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        unique_together = ('company','user')

class CompanyPlan(models.Model):
    PLAN_CHOICES = [('free','無料'),('pro','有料'),('enterprise','エンタープライズ')]
    id      = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='plans')
    plan_type = models.CharField(max_length=20, choices=PLAN_CHOICES, default='free')
    monthly_quota = models.IntegerField(default=50)  # 送信上限など
    price_jpy = models.IntegerField(default=0)
    active_from = models.DateField()
    active_to   = models.DateField(null=True, blank=True)
    # 追加: 残り件数を保持するフィールド。NULL 許容で、未設定時は monthly_quota を初期値としてセットします。
    remaining = models.IntegerField(null=True, blank=True)

    def save(self, *args, **kwargs):
        # 初期作成時に remaining が未設定なら monthly_quota を初期値として設定
        if self.remaining is None:
            try:
                self.remaining = int(self.monthly_quota)
            except Exception:
                self.remaining = 0
        return super().save(*args, **kwargs)
    class Meta:
        # デフォルトの並び順を開始日の降順（最新が先頭）にする
        ordering = ['-active_from']

class Order(models.Model):
    """
    Stripe 決済のための簡易オーダーモデル

    解説（用途）:
    - フロントエンドが Checkout セッションを作成するときにサーバ側で stub を残すために使います。
      （Checkout セッション ID を保存しておき、後続の webhook で支払い完了を結び付けるため）
    - subscription / one-time のどちらでも利用可能。company がある場合は企業課金に紐付けます。

    Stripe マッピング:
    - `stripe_session_id` は Stripe Checkout Session の ID（例: cs_test_...）
    - `stripe_payment_intent_id` は 支払いが即時発生する PaymentIntent の ID（存在する場合）
    - webhook 側で session / payment_intent を参照して `paid=True` に更新します

    実装上の注意:
    - 金額の canonical source は Stripe 側なので amount=0 で stub を作ることもあります。
    - セキュリティ上、Webhook は Stripe の署名で検証してから状態変更してください。
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='orders')
    company = models.ForeignKey('Company', null=True, blank=True, on_delete=models.SET_NULL, related_name='orders')
    amount = models.IntegerField()
    currency = models.CharField(max_length=10, default='jpy')
    stripe_session_id = models.CharField(max_length=255, blank=True, null=True)
    stripe_payment_intent_id = models.CharField(max_length=255, blank=True, null=True)
    paid = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Order {self.id} - {self.amount} {self.currency} - paid:{self.paid}"


class CompanySubscription(models.Model):
    """
    企業のサブスクリプション情報を保存するモデル

    解説（用途）:
    - Stripe の subscription（サブスク）をサーバ側で参照・保持するためのモデル。
    - webhook イベント（checkout.session.completed / invoice.payment_succeeded 等）で
      subscription のステータスや次回課金期間を更新します。

    主なフィールド:
    - `stripe_subscription_id`: Stripe 側の subscription ID（例: sub_...）を一意キーとして保持
    - `price_id`: Checkout に渡した Price ID（price_...）。請求対象のプラン識別に便利
    - `status`: 'active' / 'past_due' / 'canceled' など Stripe のステータスを保存
    - `current_period_end`: 次回請求の終了（期間終了）日時を保持（UI 表示や有効判定に使用）

    実装上の注意:
    - Stripe の真の状態は常に Stripe API が正。DB はキャッシュ的に扱い、重要な判定は
      Stripe API を参照するか webhook の状態を元に更新すること。
    - webhook の署名検証を必ず行ってください（STRIPE_WEBHOOK_SECRET を設定）。
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey('Company', on_delete=models.CASCADE, related_name='subscriptions')
    stripe_subscription_id = models.CharField(max_length=255, unique=True)
    price_id = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(max_length=50, blank=True, null=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Subscription {self.stripe_subscription_id} ({self.company.name})"

class CompanyHiring(models.Model):
    """
    会社の募集情報（複数可）
    """
    id      = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='hirings')
    title   = models.CharField(max_length=120)         # どんな役職
    detail  = models.TextField(blank=True, default="") # 詳細
    tech_stack = models.CharField(max_length=200, blank=True, default="")
    location   = models.CharField(max_length=120, blank=True, default="")
    employment_type = models.CharField(max_length=40, blank=True, default="")  # 新卒/中途/インターン 等
    created_at = models.DateTimeField(auto_now_add=True)


# ------------------------------------------------------------
# DM（旧スカウト）とテンプレ
# ------------------------------------------------------------
class MessageTemplate(models.Model):
    """
    会社 or ユーザーのどちらか一方が所有（両方同時は不可）
    """
    id       = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner_company = models.ForeignKey(Company, null=True, blank=True, on_delete=models.CASCADE, related_name='templates')
    owner_user    = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE, related_name='templates')
    name     = models.CharField(max_length=100)
    subject  = models.CharField(max_length=200, blank=True, default="")
    body     = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    def clean(self):
        # 会社orユーザーのどちらか片方必須
        if not self.owner_company and not self.owner_user:
            raise ValueError("owner_company か owner_user のどちらかが必要です")

class DMThread(models.Model):
    """
    会社 × 学生 = 1スレッド
    """
    id      = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='dm_threads')
    user    = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='dm_threads')
    created_at = models.DateTimeField(auto_now_add=True)
    # 状態管理はメッセージ側/既読と分ける（ここは最低限）
    class Meta:
        unique_together = ('company','user')

class DMMessage(models.Model):
    SENDER_CHOICES = [('company','Company'),('user','User')]
    id      = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    thread  = models.ForeignKey(DMThread, on_delete=models.CASCADE, related_name='messages')
    sender  = models.CharField(max_length=10, choices=SENDER_CHOICES)
    subject = models.CharField(max_length=200, blank=True, default="")
    body    = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_read_by_company = models.BooleanField(default=False)
    is_read_by_user    = models.BooleanField(default=False)


# ------------------------------------------------------------
# TeamMembership / Invitation / Integration（既存）
# ------------------------------------------------------------
class TeamMembership(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='team_memberships')
    joined_at = models.DateTimeField(auto_now_add=True)
    class Meta: unique_together = ('team','user')

class TeamInvitation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='invitations')
    invited_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='invitations_received')
    invited_by   = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='invitations_sent')
    token = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    accepted = models.BooleanField(default=False)
    class Meta: unique_together = ('team','invited_user')


# ==== 既存 Integration（暗号関連ユーティリティはそのまま） ====
def _build_fernet_from_env_key(s: str | bytes):
    if isinstance(s, str): s = s.encode()
    return Fernet(s)

def _build_fernet_from_secret(secret: str) -> Fernet:
    key = secret.encode()[:32].ljust(32, b"0")
    return Fernet(base64.urlsafe_b64encode(key))

def _fernets_for_decrypt() -> List[Fernet]:
    fns: List[Fernet] = []
    fk = getattr(settings, "FERNET_KEY", None)
    if fk: fns.append(_build_fernet_from_env_key(fk))
    sk = getattr(settings, "SECRET_KEY", None)
    if sk: fns.append(_build_fernet_from_secret(sk))
    ofk = getattr(settings, "OLD_FERNET_KEY", None)
    if ofk: fns.append(_build_fernet_from_env_key(ofk))
    if not fns: raise RuntimeError("No Fernet key found. Set FERNET_KEY")
    return fns

def _fernet_primary() -> Fernet:
    fk = getattr(settings, "FERNET_KEY", None)
    if fk: return _build_fernet_from_env_key(fk)
    sk = getattr(settings, "SECRET_KEY", None)
    if sk: return _build_fernet_from_secret(sk)
    raise RuntimeError("FERNET_KEY or SECRET_KEY is not set")

class Integration(models.Model):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    team         = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='integrations')
    provider     = models.CharField(max_length=10, choices=[('discord','Discord'),('slack','Slack'),('teams','Teams')])
    _access_token = models.BinaryField(null=True, blank=True)
    workspace_id = models.CharField(max_length=255)
    channel_id   = models.CharField(max_length=255)
    created_at   = models.DateTimeField(auto_now_add=True)
    class Meta: unique_together = ('team','provider')

    @property
    def access_token(self) -> str | None:
        from cryptography.fernet import InvalidToken
        if not self._access_token: return None
        ct = bytes(self._access_token)
        for f in _fernets_for_decrypt():
            try: return f.decrypt(ct).decode()
            except InvalidToken: continue
        raise InvalidToken("Access token decrypt failed.")

    @access_token.setter
    def access_token(self, value: str | None):
        self._access_token = _fernet_primary().encrypt(value.encode()) if value else None

# # docker compose exec backend python manage.py makemigrations
# # docker compose exec backend python manage.py migrate

