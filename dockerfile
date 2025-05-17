# ---------- Stage 1: Frontend build ----------
FROM node:18-alpine AS frontend
WORKDIR /app/frontend

# 依存ファイルだけ先にコピーして npm ci キャッシュを活かす
COPY frontend/package*.json ./
RUN npm ci

# 残りのフロントコードをコピーしてビルド
COPY frontend/ .
RUN npm run build            # → /app/frontend/dist/...

# ---------- Stage 2: Backend (runtime) ----------
FROM python:3.12-slim AS backend
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

# Python 依存を先に
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# プロジェクト全体をコピー
COPY . .

# Stage-1 で生成した React の成果物だけを取り込む
COPY --from=frontend /app/frontend/dist/index.html   templates/
COPY --from=frontend /app/frontend/dist/assets/      static/react/

# Django の準備
RUN python manage.py collectstatic --noinput && \
    python manage.py migrate

# ポートは Railway が $PORT を渡してくれる
CMD ["gunicorn", "Torail.wsgi:application", "--bind", "0.0.0.0:${PORT:-8000}"]
