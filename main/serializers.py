from rest_framework import serializers
from .models import User, Subject, Task, Record, Language
from rest_framework.validators import UniqueValidator
from dj_rest_auth.registration.serializers import RegisterSerializer
from rest_framework.validators import UniqueTogetherValidator
# シリアライザーはpythonをJSONにJSONをPYTHONに変換する役割がある
# つまりフロントでも使えるようにする
# Userモデルのシリアライザ
class UserSerializer(serializers.ModelSerializer):
  # metaで指定
  class Meta:
    # モデルはユーザー
    model=User
    # フィールドで指定したものだけがjsonに
    fields=['id','username','email']
    
# Subjectモデルシリアライザ
class SubjectSerializer(serializers.ModelSerializer):
  # シリアライザ段階で request.user が入る
  user = serializers.HiddenField(default=serializers.CurrentUserDefault())
  class Meta:
    model=Subject
    fields=['id','name','user']
    validators = [
            UniqueTogetherValidator(
                queryset=Subject.objects.all(),
                fields=['user', 'name'],
                message='この教科は既に追加されています。'
            )
        ]

# Taskモデルシリアライザ
class TaskSerializer(serializers.ModelSerializer):
  # シリアライザ段階で request.user が入る
  user = serializers.HiddenField(default=serializers.CurrentUserDefault())
  class Meta:
    model=Task
    fields=['id','name','subject','user']
    validators = [
            UniqueTogetherValidator(
                queryset=Task.objects.all(),
                fields=['user','subject' ,'name'],
                message='この課題は既に追加されています。'
            )
        ]

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
  language=LanguageSerializer(read_only=True)
  
  class Meta:
    model=Record
    fields=['id', 'user', 'subject', 'task', 'language', 'date', 'description', 'duration', 'start_time', 'end_time','stop_time','timer_state']
    
# Recordモデルのシリアライザ(書き込み用)
class RecordWriteSerializer(serializers.ModelSerializer):
  # 選択肢があるフィールドを引っ張ってきてる(idで呼ぶ、全選択肢を(viewで当該ユーザーのみ))
  subject=serializers.PrimaryKeyRelatedField(queryset=Subject.objects.all())
  task=serializers.PrimaryKeyRelatedField(queryset=Task.objects.all())
  language=serializers.PrimaryKeyRelatedField(queryset=Language.objects.all(),
                                              allow_null=True,      # nullを許可する
                                              required=False        # 必須ではない
  )
  class Meta:
    model=Record
    fields=[ 'subject', 'task', 'language', 'date', 'description', 'duration', 'start_time', 'end_time','stop_time','timer_state']
    
    
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