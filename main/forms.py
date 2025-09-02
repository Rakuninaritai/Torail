# main/forms.py
from django.contrib.auth.forms import UserCreationForm, UserChangeForm
from .models import User

class CustomUserCreationForm(UserCreationForm):
    class Meta(UserCreationForm.Meta):
        model = User
        fields = ("username", "email")    # 追加画面で email も必須に

class CustomUserChangeForm(UserChangeForm):
    class Meta(UserChangeForm.Meta):
        model = User
        fields = ("username", "email", "is_active", "is_staff")
        
        
# ソーシャルログイン用フォーム
from allauth.socialaccount.forms import SignupForm

class MySocialSignupForm(SignupForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # email は表示のみ（POSTされないが allauth 側で保持しているためOK）
        self.fields["email"].disabled = True
        # Bootstrapクラス付与
        for f in self.fields.values():
            classes = f.widget.attrs.get("class", "")
            f.widget.attrs["class"] = (classes + " form-control").strip()

