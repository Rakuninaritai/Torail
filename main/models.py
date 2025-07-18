from django.db import models
from django.contrib.auth.models import AbstractUser
import uuid
from django.conf import settings
# from main.tsuchi_tsukawan.fields import EncryptedTextField 

User = settings.AUTH_USER_MODEL  # 抽象化したカスタムユーザーモデルを参照
# ユーザーモデルをカスタムしている
# idをUUIDにすることで整数よりも複雑化させてる。(idを主キー化、デフォルトでuuidが設定される、管理画面での編集false)
class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # emailを必須化でソーシャルログイン対応
    email = models.EmailField(unique=True)

    def __str__(self):
        return self.username
    
class Team(models.Model):
    """
    チーム情報
    - owner: 作成者（オーナー）
    - name: 画面表示用チーム名（ユニーク）
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField('チーム名', max_length=100, unique=True)##チーム名ユニークに
    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,# ユーザー削除時、チームも削除
        related_name='owned_teams' # user.owned_teams で取得可能
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
      
# 教科モデル(内容に対して教科→課題が作成できる)
class Subject(models.Model):
  # idはuuuidで強固かつ主キーに
  id = models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
  # nameは教科名
  name=models.CharField(max_length=100)
  # ユーザーは外部キーで引っ張ってきた
  user=models.ForeignKey(User,on_delete=models.CASCADE)
  team = models.ForeignKey(
      Team,
      on_delete=models.CASCADE,
      null=True, blank=True,
      related_name='subjects',
      help_text='チーム記録なら team にセット、個人記録は NULL'
  )
  class Meta:
    constraints = [
        # 個人モード (team IS NULL) では user×name の一意制約
        models.UniqueConstraint(
            fields=['user', 'name'],
            condition=models.Q(team__isnull=True),
            name='unique_personal_subject'
        ),
        # チームモード (team IS NOT NULL) では team×name の一意制約
        models.UniqueConstraint(
            fields=['team', 'name'],
            condition=models.Q(team__isnull=False),
            name='unique_team_subject'
        ),
    ]
  def __str__(self):
     return self.name
   
# 課題モデル(どの教科のどの課題かみたいな)
class Task(models.Model):
  # idはuuuidで強固かつ主キーに
  id = models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
  # ユーザーは外部キーで引っ張ってきた
  user=models.ForeignKey(User,on_delete=models.CASCADE)
  # どの教科の課題化
  subject=models.ForeignKey(Subject,on_delete=models.CASCADE)
  # nameは課題名
  name=models.CharField(max_length=100)
  team = models.ForeignKey(
      Team,
      on_delete=models.CASCADE,
      null=True, blank=True,
      related_name='tasks',
      help_text='チーム記録なら team にセット、個人記録は NULL'
  )
  
  class Meta:
    constraints = [
        models.UniqueConstraint(
        fields=['user','subject','name'],
        condition=models.Q(team__isnull=True),
        name='unique_personal_task'
        ),
        models.UniqueConstraint(
            fields=['team','subject','name'],
            condition=models.Q(team__isnull=False),
            name='unique_team_task'
        ),
    ]
  
  def __str__(self):
     return self.name
# どの言語か(教科や課題に依存しない)
class Language(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50, unique=True)
    
    def __str__(self):
        return self.name


    
    


# 記録登録用レコード
class Record(models.Model):
  id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
  user = models.ForeignKey(User, on_delete=models.CASCADE)
  subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
  task = models.ForeignKey(Task, on_delete=models.CASCADE)
  language = models.ForeignKey(Language, on_delete=models.CASCADE,blank=True, null=True)
  # いつ記録したか
  date = models.DateField(auto_now_add=True)
  # 何をしたかのメモ(省略可)
  description = models.TextField(blank=True, null=True)
  # 何分学習したかのやつint
  duration = models.IntegerField(blank=True, null=True)
  # 開始時刻を記録
  start_time = models.DateTimeField(blank=True, null=True)
  # 終了時刻を記録
  end_time = models.DateTimeField(blank=True, null=True)
  # タイマーの状態を記録(0:実行中、1:中断、2:終了、3:保存中(タイマーは止まっているがその他情報まだ))
  timer_state=models.IntegerField(default=0)
  # 再開時刻を記録(starttimeではなくこれから差分を取るため)
  stop_time=models.DateTimeField(blank=True,null=True)
  team = models.ForeignKey(
      Team,
      on_delete=models.CASCADE,
      null=True, blank=True,
      related_name='records',
      help_text='チーム記録なら team にセット、個人記録は NULL'
  )
    # こうすることで Record.team が None → 個人／Not None → チーム に振り分けられる

  def __str__(self):
      return f"{self.user.username} - {self.task.name} ({self.duration} min)"
class TeamMembership(models.Model):
    """
    チームメンバーシップ
    - team ＋ user の組み合わせをユニーク化して、複数招待/参加を防止
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    team = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        related_name='memberships'# team.memberships で一覧取得
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='team_memberships'
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('team', 'user') # 同じ組み合わせを重複登録させない


class TeamInvitation(models.Model):
    """
    チーム招待
    - invited_user: 招待対象ユーザー
    - invited_by: 招待発行者（必ず team.owner）
    - token: 承認リンク等で利用する UUID トークン
    - accepted: 承認済みフラグ
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    team = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        related_name='invitations'
    )
    invited_user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='invitations_received'
    )
    invited_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='invitations_sent'
    )
    token = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    accepted = models.BooleanField(default=False)

    class Meta:
        unique_together = ('team', 'invited_user')
        
        

# 通知連携用
# 現状メールのみで使わないが残しとく
class Integration(models.Model):
    """
    1レコード = 1チームの 1チャネル連携
    provider   : 'discord' / 'slack' / 'teams'
    access_tok : Bot / App 用トークン（暗号化）
    workspace  : Discord = guild_id, Slack = workspace_id, Teams = team_id
    channel_id : 送信先チャネル
    """
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    team         = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='integrations')
    provider     = models.CharField(max_length=10,
                     choices=[('discord', 'Discord'), ('slack', 'Slack'), ('teams', 'Teams')])
    # access_token =  EncryptedTextField()        # at rest で暗号化
    access_token = models.TextField(blank=True, null=True)
    workspace_id = models.CharField(max_length=255)
    channel_id   = models.CharField(max_length=255)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('team', 'provider')  # 1プロバイダーにつき1連携
