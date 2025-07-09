#!/bin/sh
set -e

echo ">>> [entrypoint] Running migrations…"
python manage.py migrate --noinput

echo ">>> [entrypoint] Collecting static files…"
python manage.py collectstatic --noinput

# "$@" に CMD で指定したコマンドが入る（gunicorn など）
echo ">>> [entrypoint] Starting main process: $@"
exec "$@"
