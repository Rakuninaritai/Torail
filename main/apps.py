# main/apps.py
from django.apps import AppConfig


class MainConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "main"

    def ready(self):
        # signals を import するだけ
        from . import signals  # noqa
