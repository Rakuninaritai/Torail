#!/bin/bash
python manage.py migrate
python manage.py collectstatic --noinput
gunicorn Torail.wsgi --bind 0.0.0.0:$PORT