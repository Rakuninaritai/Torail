# --- 1) 依存インストール -----------------
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --- 2) アプリケーションコード -------------
COPY . /app

# --- 3) 静的ファイル収集は後でやる ---------
ENV DISABLE_COLLECTSTATIC=1
# ★ ここで collectstatic を呼ばない！
# RUN python manage.py collectstatic --noinput ←消す
#
# --- 4) アプリ起動 -------------------------
CMD ["gunicorn", "Torail.wsgi:application", "--bind", "0.0.0.0:8000"]
