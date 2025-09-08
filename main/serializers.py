from rest_framework import serializers
from .models import User, Subject, Task, Record, Language,Team, TeamMembership, TeamInvitation,Integration
from django.contrib.auth import get_user_model
from rest_framework.validators import UniqueValidator
from dj_rest_auth.registration.serializers import RegisterSerializer
from rest_framework.validators import UniqueTogetherValidator
User = get_user_model()
# シリアライザーはpythonをJSONにJSONをPYTHONに変換する役割がある
# つまりフロントでも使えるようにする
# Userモデルのシリアライザ
class UserSerializer(serializers.ModelSerializer):
  # GET時は受け取らずPOST/PATCH 時だけ受け取るフィールドになります
  password = serializers.CharField(write_only=True, required=False)
  # metaで指定
  class Meta:
    # モデルはユーザー
    model=User
    # フィールドで指定したものだけがjsonに
    fields=['id','username','email','password']
    # patchで呼ばれるupdate
    # 引数はself(シリアライザ自体のインスタンスどのモデル使うかなど)instance(どのレコードを更新するか)validated_data(送られてきたデータ)
  def update(self, instance, validated_data):
      # validated_data から password を取り出し
      pwd = validated_data.pop('password', None)

      # username, email の通常更新
      for attr, val in validated_data.items():
          setattr(instance, attr, val)

      # password が渡ってきていれば set_password でハッシュ化
      if pwd:
          instance.set_password(pwd)

      instance.save()
      return instance

    
# Subjectモデルシリアライザ
class SubjectSerializer(serializers.ModelSerializer):
  # シリアライザ段階で request.user が入る
  user = serializers.HiddenField(default=serializers.CurrentUserDefault())
  # 書き込み時にチーム指定を可能にする
  team = serializers.PrimaryKeyRelatedField(
      queryset=Team.objects.all(),
      allow_null=True,
      required=False
  )
  class Meta:
    model=Subject
    fields=['id','name','user','team']
    validators = []
  def validate(self, data):
    # 1) user は CurrentUserDefault() で validated_data に入る
    user = data.get('user')
    # 2) name, team は部分的更新にも対応して instance からフォールバック
    name = data.get('name', getattr(self.instance, 'name', None))
    team = data.get('team', getattr(self.instance, 'team', None))

    # 重複チェック用の queryset を組み立て(今回のでdbない検索をかける)
    if team:
        # チーム内での name 一意
        qs = Subject.objects.filter(team=team, name=name)
    else:
        # 個人（team is null）内での name 一意
        qs = Subject.objects.filter(user=user, team__isnull=True, name=name)

    # 更新時には自分自身を除外
    if self.instance:
        qs = qs.exclude(pk=self.instance.pk)

    # 検索で存在していたら
    if qs.exists():
        if team:
            raise serializers.ValidationError({'name': 'このチームには既に同じ教科名があります。'})
        else:
            raise serializers.ValidationError({'name': 'この教科は既に追加されています。'})

    return data

# Taskモデルシリアライザ
class TaskSerializer(serializers.ModelSerializer):
  # シリアライザ段階で request.user が入る
  user = serializers.HiddenField(default=serializers.CurrentUserDefault())
  # 書き込み時にチーム指定を可能にする
  team = serializers.PrimaryKeyRelatedField(
      queryset=Team.objects.all(),
      allow_null=True,
      required=False
  )
  class Meta:
    model=Task
    fields=['id','name','subject','user','team']
    validators = []
  def validate(self, data):
    user    = data.get('user')
    name    = data.get('name', getattr(self.instance, 'name', None))
    subject = data.get('subject', getattr(self.instance, 'subject', None))
    team    = data.get('team', getattr(self.instance, 'team', None))

    if team:
        # チーム内で subject×name 一意
        qs = Task.objects.filter(team=team, subject=subject, name=name)
    else:
        # 個人（team is null）内で user×subject×name 一意
        qs = Task.objects.filter(user=user, team__isnull=True, subject=subject, name=name)

    if self.instance:
        qs = qs.exclude(pk=self.instance.pk)

    if qs.exists():
        if team:
            raise serializers.ValidationError({'name': 'このチームには既に同じ課題名があります。'})
        else:
            raise serializers.ValidationError({'name': 'この課題は既に追加されています。'})

    return data

# Languageモデルシリアライザ
class LanguageSerializer(serializers.ModelSerializer):
  class Meta:
    model=Language
    fields=['id','name']
    
# Recordモデルのシリアライザ(読み込み用)
class RecordReadSerializer(serializers.ModelSerializer):
  # レコードでは外部キーをネスト表示にしている(詳細に情報を含める)
  # ネストしないとidのみだがnameなどのfield全てが取得できる
  # 便利だがデータ量は増えるので使いどころは見極める必要あり
  user=UserSerializer(read_only=True)
  subject=SubjectSerializer(read_only=True)
  task=TaskSerializer(read_only=True)
  languages = LanguageSerializer(many=True, read_only=True)
  
  class Meta:
    model=Record
    fields=['id', 'user', 'subject', 'task', 'languages', 'date', 'description', 'duration', 'start_time', 'end_time','stop_time','timer_state','team']
    
# Recordモデルのシリアライザ(書き込み用)
# main/serializers.py の RecordWriteSerializer を修正

class RecordWriteSerializer(serializers.ModelSerializer):
    subject   = serializers.PrimaryKeyRelatedField(queryset=Subject.objects.all())
    task      = serializers.PrimaryKeyRelatedField(queryset=Task.objects.all())
    languages = serializers.PrimaryKeyRelatedField(
        queryset=Language.objects.all(),
        many=True,
        required=False,     # 未指定(PATCHで触らない)を許容
        allow_empty=True    # 空配列での「全解除」も許容
    )
    team = serializers.PrimaryKeyRelatedField(
        queryset=Team.objects.all(),
        allow_null=True,
        required=False
    )

    class Meta:
        model  = Record
        fields = [
            'subject', 'task', 'languages',
            'date', 'description', 'duration',
            'start_time', 'end_time', 'stop_time',
            'timer_state', 'team'
        ]

    def create(self, validated_data):
        langs = validated_data.pop('languages', [])
        record = Record.objects.create(**validated_data)
        if langs is not None:   # 空配列なら全解除、未指定(None)は起きない想定
            record.languages.set(langs)
        return record

    def update(self, instance, validated_data):
        langs = validated_data.pop('languages', None)  # ← None なら「変更しない」
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        if langs is not None:   # 明示指定があれば置き換え。空配列なら全解除
            instance.languages.set(langs)
        return instance

    
    
# メルアド重複を500エラーではなく400エラーで出すためのシリアライザ
# サーバーに送って500エラーになる前にシリアライザの段階で400にしてる
class CustomRegisterSerializer(RegisterSerializer):
    email = serializers.EmailField(
        required=True,
        validators=[
            UniqueValidator(
                queryset=User.objects.all(),
                message="このメールアドレスは既に使われています。"
            )
        ]
    )

    def get_cleaned_data(self):
        data = super().get_cleaned_data()
        data['email'] = self.validated_data.get('email', '')
        return data
      

class TeamMembershipSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = TeamMembership
        fields = ['id', 'team', 'user', 'joined_at']

class TeamSerializer(serializers.ModelSerializer):
    owner = serializers.StringRelatedField(read_only=True)  # オーナー名を文字列で返却
    name = serializers.CharField(
        validators=[
            UniqueValidator(
                queryset=Team.objects.all(),
                message="このチーム名は既に使われています。"
            )
        ]
    )
    memberships = TeamMembershipSerializer(
        many=True,
        read_only=True,
    )
    class Meta:
        model = Team
        fields = ['id', 'name', 'owner', 'created_at','memberships','notify_mode' ]





class TeamInvitationSerializer(serializers.ModelSerializer):
    invited_user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    # team.name をそのまま文字列で返すフィールド
    team_name = serializers.CharField(source='team.name', read_only=True)
    invited_user_name=serializers.CharField(source='invited_user.username', read_only=True)
    class Meta:
        model = TeamInvitation
        # invited_by, token, accepted, created_at は読み取り専用
        read_only_fields = ['invited_by', 'token', 'accepted', 'created_at']
        fields = ['id', 'team','team_name', 'invited_user','invited_user_name', 'invited_by', 'token', 'accepted', 'created_at']
        
# 通知用
# main/serializers.py  （末尾付近に追記）

# class IntegrationSerializer(serializers.ModelSerializer):
#     class Meta:
#         model  = Integration
#         fields = ['id', 'provider', 'workspace_id', 'channel_id', 'created_at']
#         read_only_fields = fields          # 完全読み取り専用



