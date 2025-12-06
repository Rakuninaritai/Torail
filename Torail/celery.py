# ============================================================
# Celery 非同期タスク実行エンジン - Torail通知システムの核
# ============================================================
# 
# 【概要】
# -------
# Celery は分散タスクキューシステム。
# 以下のような処理を「バックグラウンドで非同期実行」します：
#   1. 長時間かかる処理（メール送信、API呼び出し）
#   2. スケジュール実行（cron的な定期処理）
#   3. 複数ステップの処理（リトライ付きなど）
# 
# Torail で Celery が担うタスク：
#   - メール送信（SMTP接続＆送信）
#   - Slack メッセージ送信
#   - Discord メッセージ送信
#   - これら3つをDRY化・一元管理
#
# 【実行フロー】
# -----------
# ユーザーがタイマーを「完了」に変更
#   ↓
# Django signals (post_save) が検知
#   ↓
# dispatch_record_notification.delay(record_id) をキューに追加
#   ↓
# Celery Worker がキューから取得
#   ↓
# 実際にメール/Slack/Discord を送信実行
# （この間、ユーザーのリクエストは完了＝レスポンス快適）
# 次はtasks.pyを参照
#

import os
from celery import Celery

# Django設定モジュールを指定
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Torail.settings")

# Celery アプリケーションインスタンス生成
celery_app = Celery("Torail")

# Django settings.py の CELERY_* 設定を読む込む
celery_app.config_from_object("django.conf:settings", namespace="CELERY")

# main/tasks.py や其他の tasks.py から @shared_task デコレータで定義された
# すべてのタスク関数を自動検出＆登録
celery_app.autodiscover_tasks()