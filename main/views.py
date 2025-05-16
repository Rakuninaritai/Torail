from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import User, Subject, Task, Record, Language
from .serializers import UserSerializer, SubjectSerializer, TaskSerializer, RecordWriteSerializer,RecordReadSerializer, LanguageSerializer
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
