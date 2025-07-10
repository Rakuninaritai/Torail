FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    STATIC_ROOT=/app/staticfiles

WORKDIR /app

# 1) 依存ライブラリ
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 2) Procfile & entrypoint
COPY Procfile .                 # /app/Procfile
COPY entrypoint.sh .            # /app/entrypoint.sh
RUN chmod +x entrypoint.sh

# 3) アプリ本体
COPY . /app

# 4) 静的ファイル用 dir
RUN mkdir -p "$STATIC_ROOT"

# 5) エントリポイント
ENTRYPOINT ["./entrypoint.sh"]
