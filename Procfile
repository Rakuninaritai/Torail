
web:    gunicorn Torail.wsgi:application --bind 0.0.0.0:$PORT --workers 3
worker: celery -A Torail worker --loglevel=info
