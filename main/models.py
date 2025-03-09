from django.db import models
from django.contrib.auth.models import AbstractUser
import uuid
# ユーザーモデルをカスタムしている
# idをUUIDにすることで整数よりも複雑化させてる。(idを主キー化、デフォルトでuuidが設定される、管理画面での編集false)
class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # emailを必須化でソーシャルログイン対応
    email = models.EmailField(unique=True)

    def __str__(self):
        return self.username