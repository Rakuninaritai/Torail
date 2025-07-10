#!/usr/bin/env sh
set -eu
python manage.py collectstatic --noinput
python manage.py migrate --noinput
exec gunicorn Torail.wsgi:application --bind 0.0.0.0:${PORT:-8000}
