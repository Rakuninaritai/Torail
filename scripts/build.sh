#!/usr/bin/env bash
set -e

# ---------- React ----------
npm ci --prefix frontend
npm run build --prefix frontend     # → frontend/dist/

# ---------- テンプレート配置 ----------
mkdir -p templates
cp frontend/dist/index.html templates/

# （アセットは WhiteNoise で配信する）
mkdir -p static/react
cp -r frontend/dist/assets/* static/react/

# ---------- Django ----------
python manage.py collectstatic --noinput
