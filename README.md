# Torail（トレイル）

[![Version](https://img.shields.io/badge/Version-1.0.0-green.svg)](#)

エンジニアの学習記録を可視化し、モチベーションを維持・向上させる**学習ログ管理アプリ**。

---

## 目次

* [概要](#概要)
* [機能](#機能)
* [動作環境](#動作環境)
* [インストール](#インストール)

  * [バックエンド](#バックエンド)
  * [フロントエンド](#フロントエンド)
* [使い方](#使い方)
* [開発ガイド](#開発ガイド)
* [作者](#作者)

---

## 概要

「Torail（トレイル）」は、

* **Track**（軌跡・記録）
* **Trail**（道・旅）
* **Tora**（虎）

を組み合わせた名前の通り、学習の道のりを虎のように力強く進むイメージを象徴するアプリです。

学習科目や使用言語、所要時間を手軽に記録し、グラフ表示で進捗を可視化できます。

グループ機能搭載予定

[Torail.App](https://torail.app/)で公開中。

## 機能

* 学習テーマ（科目・課題）、使用言語、学習時間、日付の記録
* タイマー機能によるリアルタイム計測
* 棒グラフ／折れ線グラフでの学習時間推移表示


## 動作環境

* Python 3.10+
* Node.js 16+
* Conda（推奨）
* PostgreSQL 13+

## インストール

### バックエンド

```bash
# リポジトリをクローン
git clone https://github.com/<ユーザー名>/Torail.git
cd Torail

# 仮想環境の作成と起動
conda create -n torail python=3.10 -y
conda activate torail

# 依存パッケージのインストール
pip install -r requirements.txt

# 環境変数を設定（.env ファイルを作成）
#   SECRET_KEY=your_secret_key
#   DATABASE_URL=postgresql://user:pass@host:port/dbname

# マイグレーション
python manage.py migrate

# サーバー起動
python manage.py runserver 0.0.0.0:8000
```

### フロントエンド

```bash
cd frontend
npm install
npm run dev
```

## 使い方

1. ブラウザで `http://localhost:8000` にアクセス
2. アカウント登録／ログイン
3. 学習記録を追加、編集、削除
4. 『グラフ』タブで学習時間の推移を確認

## 開発ガイド

* **バックエンド**: Django REST Framework
* **フロントエンド**: React + Vite
* **認証**: django-allauth
* **データベース**: PostgreSQL

## 作者

山本 舟人（shuto yamamoto）
