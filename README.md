# Torail  — チーム作業トラッカー


> **TL;DR**
> **Torail（トレイル）** は、チーム制作で起こりがちな *「タスクの抱え込み」* を解消し、メンバーの **作業進捗** をリアルタイムで共有できるプラットフォームです。
> ユーザーが *タイマー* で計測した作業をメモ付きで保存すると、チーム全体に即時反映・通知されます。
> [Torail.App](https://Torail.app)で公開中

---

## 目次

1. [概要](#概要)
2. [主な機能](#主な機能)
3. [動作環境](#動作環境)
4. [インストール](#インストール)
5. [使い方](#使い方)
6. [開発ガイド](#開発ガイド)
7. [作者](#作者)

---

## 概要

**Torail** という名前は

* **Track** ― 軌跡・記録
* **Trail** ― 道・旅
* **Tora** ― 虎

を掛け合わせ、*「虎のように力強く作業の道を進む」* という思いを込めています。

* 作業開始時にタイマーを起動し、**完了後にメモを添えて保存**
* その記録が **タイムライン** としてチームに即共有され、刺激と助け合いを促進
* 作業量やカテゴリ別の **グラフ表示** で進捗を一目で把握

---

## 主な機能

| 機能               | 概要                                                       |
| ---------------- | -------------------------------------------------------- |
| ⏱️ **タイマー + メモ** | ユーザーが作業を計測し、終了時にメモとともに保存。履歴は自動集計。                        |
| 📣 **グループ通知**    | タイマー保存と同時に **Celery Worker** がメールをチームへ一斉送信（Redis キュー使用）。 |
| 📊 **統計**   | 作業時間を棒グラフ／折れ線グラフで可視化。                            |
| 🔑 **認証 & 権限**   | django‑allauth による OAuth／ログイン対応。グループ単位の閲覧権限。          |

---

## 動作環境

* **Python** 3.10+
* **Node.js** 16+
* **Conda**（推奨）
* **PostgreSQL** 13+

---

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

---

## 使い方

1. ブラウザで **[http://localhost:8000](http://localhost:8000)** にアクセス
2. アカウント登録／ログイン
3. 作業開始時に **タイマー開始** → 作業終了後 **メモを入力して保存**
4. **統計** タブで作業時間の推移を確認

---

## 開発ガイド

* **バックエンド**: Django REST Framework + Celery + Redis
* **フロントエンド**: React + Vite 
* **データベース**: PostgreSQL
* **認証**: django‑allauth
* **デプロイ**: Railway 

---

## 作者

**山本 舟人（Shuto Yamamoto）** 

