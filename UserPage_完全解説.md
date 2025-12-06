# UserPage.jsx 完全解説

## 1️⃣ ページ全体の目的

```
┌──────────────────────────────────────────────────────────────┐
│                    マイページ / プロフィール                   │
├──────────────────────────────────────────────────────────────┤
│ 機能：                                                        │
│  ✅ ユーザープロフィール表示＆編集                            │
│  ✅ 自己紹介、ビジョン記入                                    │
│  ✅ 希望条件（職種、技術、ドメイン）設定                     │
│  ✅ SNS リンク管理（追加/削除）                              │
│  ✅ ポートフォリオ管理（追加/削除）                          │
│  ✅ 活動KPI表示（個人＆チーム集計）                          │
└──────────────────────────────────────────────────────────────┘
```

---

## 2️⃣ ページ構成図

```
UserPage.jsx
    │
    ├─ Props: token (ユーザー認証情報)
    │
    └─ useParams: username (URL パラメータ)
         ↓ URL例：/user/yamada
         
┌─────────────────────────────────────────────────────────────┐
│                   State & Data Fetching                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ 【読み取り専用】（全員が見られる）                            │
│  - pub: 公開プロフィール                                     │
│  - kpi: 活動KPI                                              │
│  - activity30: 30日の活動                                    │
│  - langBreakdown: 言語別時間配分                            │
│                                                               │
│ 【編集可能】（所有者のみ）                                    │
│  - me: 編集用プロフィール                                    │
│  - sns: SNS リンク配列                                       │
│  - portfolio: ポートフォリオ配列                             │
│                                                               │
│ 【マスターデータ】（全員共通選択肢）                          │
│  - masters.jobs: 職種一覧                                    │
│  - masters.techs: 技術領域一覧                               │
│  - masters.domains: プロダクト領域一覧                       │
│  - masters.langs: 言語一覧                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3️⃣ 初期化フロー（useEffect群）

```
┌──────────────────────────────────────────────────────────────┐
│                  ページマウント                               │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
    ┌─────────────────────┐
    │【useEffect 1】      │
    │公開プロフィール取得  │
    │依存: [username]     │
    └────────┬────────────┘
             │
             ├─ GET /public/username/{username}/profile/
             │
             ├─ 誰でも見られる
             │  ├─ display_name
             │  ├─ avatar_url
             │  ├─ bio（自己紹介）
             │  ├─ vision（ビジョン）
             │  ├─ desired_jobs（希望職種）
             │  ├─ tech_areas（技術領域）
             │  └─ sns_links（SNS）
             │
             └─ setPub() に保存
             │
             ▼
    ┌─────────────────────┐
    │【useEffect 2】      │
    │活動KPI取得          │
    │依存: [username]     │
    └────────┬────────────┘
             │
             ├─ GET /public/username/{username}/activity_kpi/
             │
             ├─ KPI データ
             │  ├─ streakNow（現在の連続日数）
             │  ├─ streakMax（過去最高連続日数）
             │  ├─ active7（7日以内の活動日）
             │  ├─ active30（30日以内の活動日）
             │  └─ activity30[]（日別の記録時間）
             │
             └─ setKpi(), setActivity30(), setLangBreakdown()
             │
             ▼
    ┌─────────────────────────┐
    │【useEffect 3】          │
    │編集用データ取得（オーナー只） │
    │依存: [isOwner]          │
    └────────┬────────────────┘
             │
             ├─ isOwner が true のみ実行
             │
             ├─ Promise.all([
             │    GET /profile/me/,
             │    GET /profile/sns/,
             │    GET /profile/portfolio/
             │  ])
             │
             ├─ setMe(), setSns(), setPortfolio()
             │
             └─ 非クリティカル：エラーはスキップ
             │
             ▼
    ┌─────────────────────┐
    │【useEffect 4】      │
    │マスターデータ取得    │
    │依存: []（1回のみ） │
    └────────┬────────────┘
             │
             ├─ Promise.all([
             │    GET /master/jobroles/,
             │    GET /master/techareas/,
             │    GET /master/productdomains/,
             │    GET /master/languages/
             │  ])
             │
             └─ setMasters()
```

---

## 4️⃣ 所有者判定ロジック

```
┌──────────────────────────────────────────────┐
│ isOwner = useMemo(                          │
│   () => token?.username === username        │
│   [token, username]                         │
│ )                                            │
└──────────────────────────────────────────────┘

例：

【ケース A】ユーザーが自分のページ見ている
  token.username = "yamada"
  username (URL) = "yamada"
  ↓
  isOwner = true
  ↓
  編集可能な UI を表示

【ケース B】他のユーザーのページを見ている
  token.username = "yamada"
  username (URL) = "tanaka"
  ↓
  isOwner = false
  ↓
  読み取り専用 UI のみ表示
  （編集ボタンなし）
```

---

## 5️⃣ データ取得パターン

### A. 公開データ（全員がアクセス可）

```
【公開プロフィール】
GET /public/username/{username}/profile/

応答例：
{
  "id": 1,
  "display_name": "山田太郎",
  "school": "〇〇大学",
  "grade": "3年",
  "avatar_url": "https://...",
  "bio": "Pythonエンジニアです",
  "vision": "スタートアップで...",
  "desired_jobs": [
    {"id": 1, "name": "Backend Engineer"},
    {"id": 3, "name": "Full Stack"}
  ],
  "tech_areas": [
    {"id": 2, "name": "Python"},
    {"id": 5, "name": "Django"}
  ],
  "sns_links": [
    {"id": 101, "icon_class": "github", "url": "https://github.com/..."}
  ]
}


【活動KPI】
GET /public/username/{username}/activity_kpi/

応答例：
{
  "kpi": {
    "streakNow": 15,      // 15日連続記録中
    "streakMax": 87,      // 過去最高87日
    "lastUpdate": "2025-11-27",
    "active7": 6,         // 7日以内に6日活動
    "active30": 24,       // 30日以内に24日活動
    "offHint": "11/20 お休み"
  },
  "activity30": [
    1.5, 2.0, 0, 3.5, 1.2, ... // 過去30日の記録時間
  ],
  "lang_breakdown": [
    {"label": "Python", "hours": 45.5},
    {"label": "JavaScript", "hours": 23.2},
    {"label": "TypeScript", "hours": 18.0}
  ]
}
```

### B. プライベートデータ（オーナー只）

```
【プロフィール編集用】
GET /profile/me/

応答例：
{
  "id": 1,
  "display_name": "山田太郎",
  "school": "〇〇大学",
  "grade": "3年",
  "prefecture": "東京都",
  "grad_year": 2024,
  "bio": "Pythonエンジニアです",
  ...
}


【SNS リスト】
GET /profile/sns/

応答例：
[
  {"id": 101, "icon_class": "github", "url": "https://github.com/..."},
  {"id": 102, "icon_class": "twitter", "url": "https://twitter.com/..."}
]


【ポートフォリオリスト】
GET /profile/portfolio/

応答例：
[
  {
    "id": 201,
    "title": "タスク管理アプリ",
    "stack": "React, Django",
    "description": "リアルタイム同期機能付き",
    "url": "https://...",
    "github": "https://github.com/..."
  }
]
```

---

## 6️⃣ 保存処理フロー

### 【保存パターン 1】プロフィール基本情報

```
HeaderCard コンポーネント（avatar, 名前, 学校など）
        │
        └─ ユーザーが「保存」をクリック
                │
                ▼
        saveProfile(draft) 実行
                │
                ├─ FormData に詰める（画像ファイル対応）
                │  ├─ display_name
                │  ├─ school
                │  ├─ grade
                │  ├─ grad_year
                │  ├─ prefecture
                │  └─ avatar（ファイル）← 画像選択時のみ
                │
                ├─ PATCH /profile/me/
                │     body: FormData
                │     Content-Type: application/x-www-form-urlencoded
                │     （自動設定、明示的に付けない）
                │
                ├─ 応答を setMe() に保存
                │
                ├─ pub にも反映（ユーザーが見ている画面も更新）
                │
                └─ toast.success("プロフィールを保存しました")
```

### 【保存パターン 2】テキスト（自己紹介、ビジョン）

```
TextAreaCard コンポーネント
        │
        └─ ユーザーが「保存」をクリック
                │
                ▼
        saveIntro(text) / saveVision(text) 実行
                │
                ├─ PATCH /profile/me/
                │     body: JSON.stringify({
                │       bio: text         // 自己紹介の場合
                │       // または
                │       vision: text      // ビジョンの場合
                │     })
                │     headers: {'Content-Type': 'application/json'}
                │
                ├─ pub を更新
                │
                └─ toast.success("自己紹介を保存しました")
```

### 【保存パターン 3】希望条件（複数選択）

```
PrefsCard コンポーネント
        │ （職種、技術、ドメイン を multi-select）
        │
        └─ ユーザーが「保存」をクリック
                │
                ▼
        savePrefs({ roles, techSelected, domain })
                │
                ├─ PATCH /profile/me/
                │     body: JSON.stringify({
                │       desired_jobs: [1, 3, 5],      // 職種 ID 配列
                │       tech_areas: [2, 5, 8],        // 技術 ID 配列
                │       product_domains: [10, 12]     // ドメイン ID 配列
                │     })
                │
                └─ toast.success("希望条件を保存しました")
```

---

## 7️⃣ SNS 管理（CRUD）

### 追加フロー

```
HeaderCard の「SNS 追加」ボタン
        │
        ▼
ユーザーが icon（github, twitter など）と URL を入力
        │
        ▼
addSns(item) 実行
        │
        ├─ POST /profile/sns/
        │     body: JSON.stringify({
        │       icon_class: "github",
        │       url: "https://github.com/..."
        │     })
        │
        ├─ 応答（新しい SNS レコード）を setSns() に追加
        │
        ├─ pub.sns_links も更新（表示側反映）
        │
        └─ toast.success("SNSの追加に失敗しました")
```

### 削除フロー

```
HeaderCard の「SNS 削除」ボタン（各 SNS 横）
        │
        ▼
removeSns(idx) 実行
        │
        ├─ idx から該当 SNS オブジェクトを取得
        │
        ├─ DELETE /profile/sns/{id}/
        │
        ├─ setSns() で配列から該当要素を削除
        │
        ├─ pub.sns_links も同期削除
        │
        └─ toast.success("SNSを削除しました")
```

---

## 8️⃣ ポートフォリオ管理（CRUD）

### 追加フロー

```
PortfolioCard の「ポートフォリオ追加」ボタン
        │
        ▼
ユーザーが title, tags, summary, url, git を入力
        │
        ▼
addPortfolio(it) 実行
        │
        ├─ UI データ ↔ API モデル の変換
        │     it.title        → body.title
        │     it.tags         → body.stack
        │     it.summary      → body.description
        │     it.url          → body.url
        │     it.git          → body.github
        │
        ├─ POST /profile/portfolio/
        │     body: JSON.stringify({
        │       title: "タスク管理アプリ",
        │       stack: "React, Django",
        │       description: "リアルタイム同期...",
        │       url: "https://...",
        │       github: "https://github.com/..."
        │     })
        │
        ├─ setPortfolio() に追加
        │
        └─ toast.success("ポートフォリオを追加しました")
```

### 削除フロー

```
PortfolioCard の「削除」ボタン（各ポートフォリオ横）
        │
        ▼
removePortfolio(idx) 実行
        │
        ├─ idx から該当ポートフォリオを取得
        │
        ├─ DELETE /profile/portfolio/{id}/
        │
        ├─ setPortfolio() で配列から削除
        │
        └─ toast.success("ポートフォリオを削除しました")
```

---

## 9️⃣ エラーハンドリング

### エラー抽出ロジック

```javascript
const msg = (e, fallback) => {
  // API レスポンス抽出
  const data = e?.response?.data || e;
  
  if (typeof data === 'object' && data !== null) {
    // DRF形式のフィールドエラー
    // {"url":["有効なURLを入力してください"], ...}
    const fieldErrors = Object.entries(data)
      .map(([key, val]) => {
        if (Array.isArray(val)) 
          return `${key}: ${val.join(" ")}`;
        if (typeof val === "string") 
          return `${key}: ${val}`;
        return null;
      })
      .filter(Boolean);
    
    if (fieldErrors.length) {
      return fieldErrors.join("\n");
    }
    
    // detail フィールド確認
    if (data.detail) return data.detail;
  }
  
  // フォールバック
  return e?.message || fallback || "エラーが発生しました";
};
```

### エラーハンドリング例

```
API 呼び出し
    ├─ 成功 → toast.success()
    │
    └─ 失敗 → catch (e)
         ├─ msg(e, '〇〇に失敗しました') で詳細抽出
         └─ toast.error() で表示
```

---

## 🔟 レンダリング構成

```
UserPage
    │
    ├─【ローディング】
    │  loading = true のときは「読み込み中…」
    │
    ├─【エラー】
    │  err || !pub のときは「ユーザーが見つかりません」
    │
    └─【正常表示】
         │
         ├─ HeaderCard
         │  ├─ プロフィール画像
         │  ├─ 名前、学校、学年
         │  ├─ SNS リンク（表示＆管理）
         │  └─ 保存ボタン（isOwner のみ）
         │
         ├─ TextAreaCard (自己紹介)
         │  ├─ 多行テキスト
         │  └─ 保存ボタン（isOwner のみ）
         │
         ├─ MetricsCard（KPI）
         │  ├─ KPI 表示（streakNow, streakMax など）
         │  ├─ 30日カレンダー
         │  └─ 言語別時間配分
         │
         ├─ TextAreaCard (ビジョン)
         │  ├─ 多行テキスト
         │  └─ 保存ボタン（isOwner のみ）
         │
         ├─ PrefsCard（希望条件）
         │  ├─ 職種（multi-select）
         │  ├─ 技術（multi-select）
         │  ├─ ドメイン（multi-select）
         │  └─ 保存ボタン（isOwner のみ）
         │
         └─ PortfolioCard（ポートフォリオ）
            ├─ 既存ポートフォリオ一覧
            ├─ 追加フォーム（isOwner のみ）
            └─ 削除ボタン（各アイテム横）
```

---

## 1️⃣1️⃣ データ同期パターン

### 表示側と編集側の同期

```
pub (公開プロフィール)       me (編集用)
     ↓                           ↓
  実際に表示                   編集用フォーム
     ↓                           ↓
ユーザーが編集して保存
     ↓
PATCH /profile/me/ (backend)
     ↓
応答 = 更新されたデータ
     ↓
┌─────────────────────┐
│ setMe(応答)         │  ← 編集用ステート更新
│ setPub(p => ({...}))│  ← 表示側も同時更新
└─────────────────────┘
     ↓
画面に即座に反映される
（リロード不要）
```

### 複数エンドポイントの同期

```
isOwner = true のとき：

Promise.all([
  GET /profile/me/        ← 編集用データ
  GET /profile/sns/       ← SNS リスト
  GET /profile/portfolio/ ← ポートフォリオ
])
     ↓
全て並列取得（高速化）
     ↓
setState × 3 同時実行
```

---

## 1️⃣2️⃣ 注意点と設計上の工夫

### ① アンマウント対策

```javascript
useEffect(() => {
  let ignore = false;
  
  (async () => {
    // fetch...
    if (ignore) return;  // ← アンマウント済みなら state 更新しない
    setState(...);
  })();
  
  return () => { 
    ignore = true;  // ← cleanup 時に true にする
  };
}, [dependencies]);
```

理由：非同期処理中にアンマウント → state 更新 → メモリリーク警告

### ② FormData の使用（画像アップロード）

```javascript
// 画像含む場合：FormData
const fd = new FormData();
fd.append("avatar", draft._avatarFile);  // ← ファイルオブジェクト
// Content-Type は自動設定（明示的に付けない）

await api('/profile/me/', { 
  method: 'PATCH', 
  body: fd  // ← FormData のまま送信
});
```

### ③ JSON と FormData の使い分け

```javascript
// テキストだけ → JSON
{ 
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ bio: text })
}

// 画像含む → FormData
const fd = new FormData();
fd.append("avatar", file);
{ 
  method: 'PATCH',
  body: fd  // Content-Type 自動設定
}
```

### ④ 多重選択の ID 配列化

```javascript
// UI の値（複数選択）
roles = ["Backend Engineer", "Full Stack"]

// API 送信時は ID に変換
desired_jobs = [1, 3]  // ID だけを抽出

savePrefs では：
const payload = {
  desired_jobs: roles.map(id => id)  // すでに ID の想定
};
```

---

## 🔑 重要な Redux 的な概念

```
UserPage は Redux がなく、複数の「関連ステート」を管理：

pub          ← 表示用（読み取り専用）
me           ← 編集用（プライベート）
sns          ← SNS リスト
portfolio    ← ポートフォリオ リスト
masters      ← マスターデータ（共有）
kpi          ← KPI（読み取り専用）

これらを sync させるのが重要：
  編集 → 保存 → setMe + setPub 同時更新
  削除 → setSns + setPub.sns_links 同時更新
```

---

## 📊 ステート管理の全体像

```
           isOwner (computed)
              ↓
     ┌────────────────────┐
     │                    │
     ▼                    ▼
  true                 false
  (編集可)             (読み取り)
  ├─ me                └─ pub のみ
  ├─ sns                  見られる
  ├─ portfolio
  └─ pub
     表示兼用

  all
  ├─ kpi
  ├─ activity30
  ├─ masters
  └─ loading/err
```

