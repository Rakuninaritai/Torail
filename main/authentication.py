# main/authentication.py

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework import exceptions

class CookieJWTAuthentication(JWTAuthentication):
    """
    標準の JWTAuthentication を拡張して、
    Authorization ヘッダではなく Cookie から access_token を取得する。
    """
    def authenticate(self, request):
        # 1) Cookie から生トークンを取得
        raw_token = request.COOKIES.get('access_token')
        if raw_token is None:
            return None  # 続行できないので他の認証クラスへ

        # 2) トークンの検証
        try:
            validated_token = self.get_validated_token(raw_token)
        except exceptions.AuthenticationFailed as e:
            raise e

        # 3) トークンからユーザーを取得
        user = self.get_user(validated_token)
        return (user, validated_token)
