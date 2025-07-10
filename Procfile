web:    gunicorn Torail.wsgi:application --bind 0.0.0.0:$PORT --workers 3 --log-file -
worker: celery -A Torail worker --loglevel=info
