from django.contrib import admin
from .models import User, Subject, Task, Record, Language

admin.site.register(User)
admin.site.register(Subject)
admin.site.register(Task)
admin.site.register(Record)
admin.site.register(Language)

# adminでユーザー登録用
from django.contrib.auth.admin import UserAdmin
# 既存登録をいったん解除
admin.site.unregister(User)
# 公式の UserAdmin を再登録
admin.site.register(User, UserAdmin)