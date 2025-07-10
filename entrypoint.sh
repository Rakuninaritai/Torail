#!/usr/bin/env sh
set -eu
cd /app

# 毎回安全に実行しても壊れない処理
python manage.py collectstatic --noinput
python manage.py migrate --noinput

case "${1:-web}" in
  web)
    # Django + Gunicorn
    exec gunicorn Torail.wsgi:application --bind 0.0.0.0:${PORT:-8000}
    ;;
  worker)
    # Celery Worker
    shift       # 最初の引数(worker)を捨てて残りをそのまま渡せるように
    exec celery -A Torail worker --loglevel=info "$@"
    ;;
  beat)
    # Celery Beat （必要なら）
    shift
    exec celery -A Torail beat --loglevel=info "$@"
    ;;
  *)
    # 何か別のコマンドを渡したとき
    exec "$@"
    ;;
esac
