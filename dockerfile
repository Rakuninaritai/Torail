# ---------- ① React ----------
FROM node:20-alpine AS frontend
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend .
RUN npm run build       # ← ここで index.html が出来る

# ---------- ② Python ----------
FROM python:3.12-slim
WORKDIR /app
# … requirements のインストールなど …

#  ← ★ ここが無いとコピーされません !!
COPY --from=frontend /frontend/dist/index.html ./templates/index.html
COPY --from=frontend /frontend/dist/assets     ./static/

RUN python manage.py collectstatic --noinput
CMD ["gunicorn","Torail.wsgi","--bind","0.0.0.0:8000"]
