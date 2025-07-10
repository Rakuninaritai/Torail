FROM python:3.12-slim
WORKDIR /app

# 依存関係
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Procfile と entrypoint を /app にコピー
COPY Procfile .
COPY entrypoint.sh .
RUN dos2unix entrypoint.sh || true     
RUN chmod +x entrypoint.sh            

# アプリ
COPY . /app

# 静的ファイル用ディレクトリ
RUN mkdir -p /app/staticfiles

# ENTRYPOINT は ./entrypoint.sh に揃える
ENTRYPOINT ["./entrypoint.sh"]
