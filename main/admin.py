# main/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User, Subject, Task, Record, Language,Team
from .forms import CustomUserCreationForm, CustomUserChangeForm

# ── User 以外のモデルは標準登録 ─────────────────────────
admin.site.register(Subject)
admin.site.register(Task)
admin.site.register(Record)
admin.site.register(Language)
admin.site.register(Team)

# ── User 用の Admin をカスタマイズ ────────────────────────
@admin.register(User)
class CustomUserAdmin(BaseUserAdmin):
    form = CustomUserChangeForm        # 変更画面用フォーム
    add_form = CustomUserCreationForm  # 追加画面用フォーム

    list_display = ("username", "email", "is_staff", "is_active")
    list_filter  = ("is_staff", "is_active")
    search_fields = ("username", "email")
    ordering = ("username",)

    fieldsets = (
        (None,               {"fields": ("username", "email", "password")}),
        ("Permissions",      {"fields": ("is_staff", "is_active", "groups", "user_permissions")}),
        ("Important dates",  {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("username", "email", "password1", "password2", "is_staff", "is_active"),
        }),
    )
