# ── 1) ビルド専用ステージで React をビルド ─────────────────────
FROM node:20-alpine AS frontend
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend .
RUN npm run build        # → /frontend/dist に生成

# ── 2) 本番イメージ (Python) ─────────────────────────────────────
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Python 依存
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションコード
COPY . .

# React の成果物を Django が拾える場所へ
COPY --from=frontend /frontend/dist /app/static/react

# ここで collectstatic
RUN python manage.py collectstatic --noinput

EXPOSE 8000
# ⭐ ここを CMD（exec 形式）にする
CMD ["gunicorn", "Torail.wsgi", "--bind", "0.0.0.0:8000"]
