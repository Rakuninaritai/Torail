# from rest_framework import serializers
# from .models import User, Subject, Task, Record, Language,Team, TeamMembership, TeamInvitation,Integration
# from django.contrib.auth import get_user_model
# from rest_framework.validators import UniqueValidator
# from dj_rest_auth.registration.serializers import RegisterSerializer
# from rest_framework.validators import UniqueTogetherValidator
# User = get_user_model()
# # シリアライザーはpythonをJSONにJSONをPYTHONに変換する役割がある
# # つまりフロントでも使えるようにする
# # Userモデルのシリアライザ
# class UserSerializer(serializers.ModelSerializer):
#   # GET時は受け取らずPOST/PATCH 時だけ受け取るフィールドになります
#   password = serializers.CharField(write_only=True, required=False)
#   # metaで指定
#   class Meta:
#     # モデルはユーザー
#     model=User
#     # フィールドで指定したものだけがjsonに
#     fields=['id','username','email','password']
#     # patchで呼ばれるupdate
#     # 引数はself(シリアライザ自体のインスタンスどのモデル使うかなど)instance(どのレコードを更新するか)validated_data(送られてきたデータ)
#   def update(self, instance, validated_data):
#       # validated_data から password を取り出し
#       pwd = validated_data.pop('password', None)

#       # username, email の通常更新
#       for attr, val in validated_data.items():
#           setattr(instance, attr, val)

#       # password が渡ってきていれば set_password でハッシュ化
#       if pwd:
#           instance.set_password(pwd)

#       instance.save()
#       return instance

    
# # Subjectモデルシリアライザ
# class SubjectSerializer(serializers.ModelSerializer):
#   # シリアライザ段階で request.user が入る
#   user = serializers.HiddenField(default=serializers.CurrentUserDefault())
#   # 書き込み時にチーム指定を可能にする
#   team = serializers.PrimaryKeyRelatedField(
#       queryset=Team.objects.all(),
#       allow_null=True,
#       required=False
#   )
#   class Meta:
#     model=Subject
#     fields=['id','name','user','team']
#     validators = []
#   def validate(self, data):
#     # 1) user は CurrentUserDefault() で validated_data に入る
#     user = data.get('user')
#     # 2) name, team は部分的更新にも対応して instance からフォールバック
#     name = data.get('name', getattr(self.instance, 'name', None))
#     team = data.get('team', getattr(self.instance, 'team', None))

#     # 重複チェック用の queryset を組み立て(今回のでdbない検索をかける)
#     if team:
#         # チーム内での name 一意
#         qs = Subject.objects.filter(team=team, name=name)
#     else:
#         # 個人（team is null）内での name 一意
#         qs = Subject.objects.filter(user=user, team__isnull=True, name=name)

#     # 更新時には自分自身を除外
#     if self.instance:
#         qs = qs.exclude(pk=self.instance.pk)

#     # 検索で存在していたら
#     if qs.exists():
#         if team:
#             raise serializers.ValidationError({'name': 'このチームには既に同じトピック名があります。'})
#         else:
#             raise serializers.ValidationError({'name': 'このトピックは既に追加されています。'})

#     return data

# # Taskモデルシリアライザ
# class TaskSerializer(serializers.ModelSerializer):
#   # シリアライザ段階で request.user が入る
#   user = serializers.HiddenField(default=serializers.CurrentUserDefault())
#   # 書き込み時にチーム指定を可能にする
#   team = serializers.PrimaryKeyRelatedField(
#       queryset=Team.objects.all(),
#       allow_null=True,
#       required=False
#   )
#   class Meta:
#     model=Task
#     fields=['id','name','subject','user','team']
#     validators = []
#   def validate(self, data):
#     user    = data.get('user')
#     name    = data.get('name', getattr(self.instance, 'name', None))
#     subject = data.get('subject', getattr(self.instance, 'subject', None))
#     team    = data.get('team', getattr(self.instance, 'team', None))

#     if team:
#         # チーム内で subject×name 一意
#         qs = Task.objects.filter(team=team, subject=subject, name=name)
#     else:
#         # 個人（team is null）内で user×subject×name 一意
#         qs = Task.objects.filter(user=user, team__isnull=True, subject=subject, name=name)

#     if self.instance:
#         qs = qs.exclude(pk=self.instance.pk)

#     if qs.exists():
#         if team:
#             raise serializers.ValidationError({'name': 'このチームには既に同じタスク名があります。'})
#         else:
#             raise serializers.ValidationError({'name': 'このタスクは既に追加されています。'})

#     return data

# # Languageモデルシリアライザ
# class LanguageSerializer(serializers.ModelSerializer):
#   class Meta:
#     model=Language
#     fields=['id','name']
    
# # Recordモデルのシリアライザ(読み込み用)
# class RecordReadSerializer(serializers.ModelSerializer):
#   # レコードでは外部キーをネスト表示にしている(詳細に情報を含める)
#   # ネストしないとidのみだがnameなどのfield全てが取得できる
#   # 便利だがデータ量は増えるので使いどころは見極める必要あり
#   user=UserSerializer(read_only=True)
#   subject=SubjectSerializer(read_only=True)
#   task=TaskSerializer(read_only=True)
#   languages = LanguageSerializer(many=True, read_only=True)
  
#   class Meta:
#     model=Record
#     fields=['id', 'user', 'subject', 'task', 'languages', 'date', 'description', 'duration', 'start_time', 'end_time','stop_time','timer_state','team']
    
# # Recordモデルのシリアライザ(書き込み用)
# # main/serializers.py の RecordWriteSerializer を修正

# class RecordWriteSerializer(serializers.ModelSerializer):
#     subject   = serializers.PrimaryKeyRelatedField(queryset=Subject.objects.all())
#     task      = serializers.PrimaryKeyRelatedField(queryset=Task.objects.all())
#     languages = serializers.PrimaryKeyRelatedField(
#         queryset=Language.objects.all(),
#         many=True,
#         required=False,     # 未指定(PATCHで触らない)を許容
#         allow_empty=True    # 空配列での「全解除」も許容
#     )
#     team = serializers.PrimaryKeyRelatedField(
#         queryset=Team.objects.all(),
#         allow_null=True,
#         required=False
#     )

#     class Meta:
#         model  = Record
#         fields = [
#             'subject', 'task', 'languages',
#             'date', 'description', 'duration',
#             'start_time', 'end_time', 'stop_time',
#             'timer_state', 'team'
#         ]

#     def create(self, validated_data):
#         langs = validated_data.pop('languages', [])
#         record = Record.objects.create(**validated_data)
#         if langs is not None:   # 空配列なら全解除、未指定(None)は起きない想定
#             record.languages.set(langs)
#         return record

#     def update(self, instance, validated_data):
#         langs = validated_data.pop('languages', None)  # ← None なら「変更しない」
#         for attr, val in validated_data.items():
#             setattr(instance, attr, val)
#         instance.save()
#         if langs is not None:   # 明示指定があれば置き換え。空配列なら全解除
#             instance.languages.set(langs)
#         return instance

    
    
# # メルアド重複を500エラーではなく400エラーで出すためのシリアライザ
# # サーバーに送って500エラーになる前にシリアライザの段階で400にしてる
# class CustomRegisterSerializer(RegisterSerializer):
#     email = serializers.EmailField(
#         required=True,
#         validators=[
#             UniqueValidator(
#                 queryset=User.objects.all(),
#                 message="このメールアドレスは既に使われています。"
#             )
#         ]
#     )

#     def get_cleaned_data(self):
#         data = super().get_cleaned_data()
#         data['email'] = self.validated_data.get('email', '')
#         return data
      

# class TeamMembershipSerializer(serializers.ModelSerializer):
#     user = serializers.StringRelatedField(read_only=True)

#     class Meta:
#         model = TeamMembership
#         fields = ['id', 'team', 'user', 'joined_at']

# class TeamSerializer(serializers.ModelSerializer):
#     owner = serializers.StringRelatedField(read_only=True)  # オーナー名を文字列で返却
#     name = serializers.CharField(
#         validators=[
#             UniqueValidator(
#                 queryset=Team.objects.all(),
#                 message="このチーム名は既に使われています。"
#             )
#         ]
#     )
#     memberships = TeamMembershipSerializer(
#         many=True,
#         read_only=True,
#     )
#     class Meta:
#         model = Team
#         fields = ['id', 'name', 'owner', 'created_at','memberships','notify_mode' ]





# class TeamInvitationSerializer(serializers.ModelSerializer):
#     invited_user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
#     # team.name をそのまま文字列で返すフィールド
#     team_name = serializers.CharField(source='team.name', read_only=True)
#     invited_user_name=serializers.CharField(source='invited_user.username', read_only=True)
#     class Meta:
#         model = TeamInvitation
#         # invited_by, token, accepted, created_at は読み取り専用
#         read_only_fields = ['invited_by', 'token', 'accepted', 'created_at']
#         fields = ['id', 'team','team_name', 'invited_user','invited_user_name', 'invited_by', 'token', 'accepted', 'created_at']
        
# # 通知用
# # main/serializers.py  （末尾付近に追記）

# # class IntegrationSerializer(serializers.ModelSerializer):
# #     class Meta:
# #         model  = Integration
# #         fields = ['id', 'provider', 'workspace_id', 'channel_id', 'created_at']
# #         read_only_fields = fields          # 完全読み取り専用


# main/serializers.py
from rest_framework import serializers
from django.contrib.auth import get_user_model
from rest_framework.validators import UniqueValidator
from dj_rest_auth.registration.serializers import RegisterSerializer

from .models import (
    User, Team, Subject, Task, Record, TeamMembership, TeamInvitation, Integration,
    # 新規
    LanguageMaster, UserProfile, UserSNS, PortfolioItem,
    JobRole, TechArea, ProductDomain,
    Company, CompanyMember, CompanyPlan, CompanyHiring,
    MessageTemplate, DMThread, DMMessage
)

User = get_user_model()


# ---------------- User ----------------
class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)
    class Meta:
        model  = User
        fields = ['id','username','email','password','account_type']
    def update(self, instance, validated_data):
        pwd = validated_data.pop('password', None)
        for k,v in validated_data.items():
            setattr(instance, k, v)
        if pwd: instance.set_password(pwd)
        instance.save()
        return instance


# ------------- Masters --------------
class LanguageMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = LanguageMaster
        fields = ['id','name','slug','aliases','category','popularity','is_active']

class JobRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobRole
        fields = ['id','name']

class TechAreaSerializer(serializers.ModelSerializer):
    class Meta:
        model = TechArea
        fields = ['id','name']

class ProductDomainSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductDomain
        fields = ['id','name']


# ------------- Profile / SNS / PF --------------
class UserSNSSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserSNS
        fields = ['id','icon_class','url','created_at']

class PortfolioItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PortfolioItem
        fields = ['id','title','stack','url','github','description','created_at']

class UserProfileSerializer(serializers.ModelSerializer):
    desired_jobs    = JobRoleSerializer(many=True, read_only=True)
    tech_areas      = TechAreaSerializer(many=True, read_only=True)
    product_domains = ProductDomainSerializer(many=True, read_only=True)
    languages       = LanguageMasterSerializer(many=True, read_only=True)
    sns_links       = UserSNSSerializer(many=True, read_only=True, source='user.sns_links')
    portfolio_items = PortfolioItemSerializer(many=True, read_only=True, source='user.portfolio_items')
    class Meta:
        model  = UserProfile
        fields = [
            'id','display_name','school','prefecture','grade','bio','is_public',
            'desired_jobs','tech_areas','product_domains','languages',
            'sns_links','portfolio_items'
        ]

# PATCH/POST 用（ID配列で受ける）
class UserProfileWriteSerializer(serializers.ModelSerializer):
    desired_jobs    = serializers.PrimaryKeyRelatedField(queryset=JobRole.objects.all(), many=True, required=False)
    tech_areas      = serializers.PrimaryKeyRelatedField(queryset=TechArea.objects.all(), many=True, required=False)
    product_domains = serializers.PrimaryKeyRelatedField(queryset=ProductDomain.objects.all(), many=True, required=False)
    languages       = serializers.PrimaryKeyRelatedField(queryset=LanguageMaster.objects.filter(is_active=True), many=True, required=False)

    class Meta:
        model  = UserProfile
        fields = ['display_name','school','prefecture','grade','bio','is_public','desired_jobs','tech_areas','product_domains','languages']

    def update(self, instance, validated_data):
        m2m_fields = ['desired_jobs','tech_areas','product_domains','languages']
        sets = {}
        for f in m2m_fields:
            if f in validated_data:
                sets[f] = validated_data.pop(f)
        for k,v in validated_data.items():
            setattr(instance, k, v)
        instance.save()
        for f, qs in sets.items():
            getattr(instance, f).set(qs)
        return instance


# ------------- Subject/Task/Record（既存） -------------
class SubjectSerializer(serializers.ModelSerializer):
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())
    team = serializers.PrimaryKeyRelatedField(queryset=Team.objects.all(), allow_null=True, required=False)
    class Meta:
        model  = Subject
        fields = ['id','name','user','team']
        validators = []
    def validate(self, data):
        user = data.get('user')
        name = data.get('name', getattr(self.instance, 'name', None))
        team = data.get('team', getattr(self.instance, 'team', None))
        if team:
            qs = Subject.objects.filter(team=team, name=name)
        else:
            qs = Subject.objects.filter(user=user, team__isnull=True, name=name)
        if self.instance: qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError({'name':'同名のトピックが既に存在します'})
        return data

class TaskSerializer(serializers.ModelSerializer):
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())
    team = serializers.PrimaryKeyRelatedField(queryset=Team.objects.all(), allow_null=True, required=False)
    class Meta:
        model  = Task
        fields = ['id','name','subject','user','team']
        validators = []
    def validate(self, data):
        user    = data.get('user')
        name    = data.get('name', getattr(self.instance, 'name', None))
        subject = data.get('subject', getattr(self.instance, 'subject', None))
        team    = data.get('team', getattr(self.instance, 'team', None))
        if team: qs = Task.objects.filter(team=team, subject=subject, name=name)
        else:    qs = Task.objects.filter(user=user, team__isnull=True, subject=subject, name=name)
        if self.instance: qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError({'name':'同名のタスクが既に存在します'})
        return data

class RecordReadSerializer(serializers.ModelSerializer):
    from .serializers import SubjectSerializer as _Sub
    from .serializers import TaskSerializer as _Task
    user     = UserSerializer(read_only=True)
    subject  = _Sub(read_only=True)
    task     = _Task(read_only=True)
    languages= LanguageMasterSerializer(many=True, read_only=True)
    class Meta:
        model  = Record
        fields = ['id','user','subject','task','languages','date','description','duration','start_time','end_time','stop_time','timer_state','team']

class RecordWriteSerializer(serializers.ModelSerializer):
    subject   = serializers.PrimaryKeyRelatedField(queryset=Subject.objects.all())
    task      = serializers.PrimaryKeyRelatedField(queryset=Task.objects.all())
    languages = serializers.PrimaryKeyRelatedField(queryset=LanguageMaster.objects.filter(is_active=True), many=True, required=False, allow_empty=True)
    team      = serializers.PrimaryKeyRelatedField(queryset=Team.objects.all(), allow_null=True, required=False)
    class Meta:
        model  = Record
        fields = ['subject','task','languages','date','description','duration','start_time','end_time','stop_time','timer_state','team']
    def create(self, validated_data):
        langs = validated_data.pop('languages', [])
        rec = Record.objects.create(**validated_data)
        if langs is not None: rec.languages.set(langs)
        return rec
    def update(self, instance, validated_data):
        langs = validated_data.pop('languages', None)
        for k,v in validated_data.items(): setattr(instance, k, v)
        instance.save()
        if langs is not None: instance.languages.set(langs)
        return instance


# ------------- Company / Member / Plan / Hiring -------------
class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model  = Company
        fields = ['id','name','industry','website','description','logo_url','owner','created_at']
        read_only_fields = ['owner','created_at']

class CompanyMemberSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    class Meta:
        model  = CompanyMember
        fields = ['id','company','user','role','joined_at']
        read_only_fields = ['joined_at']

class CompanyPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model  = CompanyPlan
        fields = ['id','company','plan_type','monthly_quota','price_jpy','active_from','active_to']

class CompanyHiringSerializer(serializers.ModelSerializer):
    class Meta:
        model  = CompanyHiring
        fields = ['id','company','title','detail','tech_stack','location','employment_type','created_at']
        read_only_fields = ['created_at']


# ------------- Templates / DM -------------
class MessageTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = MessageTemplate
        fields = ['id','owner_company','owner_user','name','subject','body','created_at']
        read_only_fields = ['created_at']

class DMMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model  = DMMessage
        fields = ['id','thread','sender','subject','body','created_at','is_read_by_company','is_read_by_user']
        read_only_fields = ['created_at']

class DMThreadSerializer(serializers.ModelSerializer):
    messages = DMMessageSerializer(many=True, read_only=True)
    class Meta:
        model  = DMThread
        fields = ['id','company','user','created_at','messages']
        read_only_fields = ['created_at']


# ------------- Auth register tweak（既存） -------------
class CustomRegisterSerializer(RegisterSerializer):
    email = serializers.EmailField(required=True, validators=[
        UniqueValidator(queryset=User.objects.all(), message="このメールアドレスは既に使われています。")
    ])
    def get_cleaned_data(self):
        data = super().get_cleaned_data()
        data['email'] = self.validated_data.get('email','')
        return data


# ------------- Team / Invitation（既存） -------------
class TeamMembershipSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    class Meta:
        model  = TeamMembership
        fields = ['id','team','user','joined_at']

class TeamSerializer(serializers.ModelSerializer):
    owner = serializers.StringRelatedField(read_only=True)
    name  = serializers.CharField(validators=[UniqueValidator(queryset=Team.objects.all(), message="このチーム名は既に使われています。")])
    memberships = TeamMembershipSerializer(many=True, read_only=True)
    class Meta:
        model  = Team
        fields = ['id','name','owner','created_at','memberships','notify_mode']

class TeamInvitationSerializer(serializers.ModelSerializer):
    invited_user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    team_name = serializers.CharField(source='team.name', read_only=True)
    invited_user_name = serializers.CharField(source='invited_user.username', read_only=True)
    class Meta:
        model  = TeamInvitation
        read_only_fields = ['invited_by','token','accepted','created_at']
        fields = ['id','team','team_name','invited_user','invited_user_name','invited_by','token','accepted','created_at']

