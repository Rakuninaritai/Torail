### ---------- ① React をビルドするステージ ----------
FROM node:20-alpine AS frontend
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend .
RUN npm run build            # → /frontend/dist に生成

### ---------- ② 本番 Python イメージ ----------
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Python 依存
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Django プロジェクト
COPY . .

# React の成果物を Django が見る場所へ
COPY --from=frontend /frontend/dist/index.html           ./templates/index.html
COPY --from=frontend /frontend/dist/assets               ./static/

# collectstatic
RUN python manage.py collectstatic --noinput

EXPOSE 8000
CMD ["gunicorn", "Torail.wsgi", "--bind", "0.0.0.0:8000"]
