# # main/fields.py  ※新規ファイル
# from django.db import models
# from django.conf import settings
# from cryptography.fernet import Fernet, InvalidToken

# # settings.FERNET_KEY は base64 文字列で保存
# _CIPHER = Fernet(settings.FERNET_KEY.encode())

# class EncryptedTextField(models.TextField):
#     """
#     DB には暗号化文字列（base64）で保存し、
#     アプリ側では平文 str として扱える TextField。
#     """

#     def get_prep_value(self, value):
#         # save 前に呼ばれる
#         if value is None:
#             return None
#         if isinstance(value, str):
#             value = value.encode()
#         return _CIPHER.encrypt(value).decode()

#     def from_db_value(self, value, expr, connection):
#         # queryset 取得時に呼ばれる
#         if value is None:
#             return None
#         try:
#             return _CIPHER.decrypt(value.encode()).decode()
#         except InvalidToken:   # 旧データ or 既に平文
#             return value

#     def to_python(self, value):
#         # フォーム → Model 変換など
#         if value is None or isinstance(value, str) and not value:
#             return value
#         try:
#             return _CIPHER.decrypt(value.encode()).decode()
#         except InvalidToken:
#             return value
