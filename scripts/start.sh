#!/usr/bin/env bash
set -e

python manage.py migrate
gunicorn Torail.wsgi:application --bind 0.0.0.0:${PORT:-8080}
