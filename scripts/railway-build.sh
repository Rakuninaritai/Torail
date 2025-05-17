# #!/usr/bin/env bash
# set -e             # どこかでエラーが出たら止める

# # ---------- ❶ React ----------
# npm ci --prefix frontend
# npm run build --prefix frontend

# # ---------- ❷ コピー ----------
# mkdir -p templates static/react
# cp frontend/dist/index.html templates/
# cp -r frontend/dist/assets/* static/react/

# # ---------- ❸ Django ----------
# pip install -r requirements.txt
# python manage.py collectstatic --noinput
# python manage.py migrate
#!/usr/bin/env bash
set -e

# ❶ React ビルド
npm ci          --prefix frontend
npm run build   --prefix frontend   # → frontend/dist/ に index.html + assets/

# ❷ Django collectstatic & migrate
python manage.py collectstatic --noinput
python manage.py migrate