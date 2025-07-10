#!/usr/bin/env sh
set -eu  # -u を足して未定義変数もエラーに

# 1. staticfiles を収集（--noinput で対話なし）
python manage.py collectstatic --noinput

# 2. DB マイグレーション
python manage.py migrate --noinput

# 3. アプリ起動
exec gunicorn Torail.wsgi:application \
     --bind 0.0.0.0:${PORT:-8000} \
     --workers ${WEB_CONCURRENCY:-3} \
     --log-file - \
     --access-logfile -
