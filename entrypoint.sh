#!/usr/bin/env sh
set -e
python manage.py migrate --noinput
exec gunicorn Torail.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 3 --log-file -
