FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    STATIC_ROOT=/app/staticfiles

WORKDIR /app

# 1) 依存関係
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 2) アプリケーションコード
COPY . /app

# 依存インストールまで終わったあと
ENV FERNET_KEY=dummy_collectstatic_key
# 3) 静的ファイル収集（本番想定）
RUN mkdir -p "${STATIC_ROOT}" \
    && python manage.py collectstatic --noinput

# 4) デフォルトは Gunicorn
CMD ["gunicorn", "Torail.wsgi:application", "--bind", "0.0.0.0:8000"]
