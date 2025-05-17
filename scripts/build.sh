# scripts/build.sh
#!/usr/bin/env bash
set -e

# ❶ React build
npm ci          --prefix frontend
npm run build   --prefix frontend          # → frontend/dist 生成

# ❷ copy to Django
mkdir -p templates static/react
cp  frontend/dist/index.html        templates/
cp -r frontend/dist/assets/*        static/react/

# ❸ Django collectstatic & migrate
python manage.py collectstatic --noinput
python manage.py migrate
