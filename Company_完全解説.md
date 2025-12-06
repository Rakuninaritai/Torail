# Torail 企業セクション完全解説

## 目次
1. [概要](#1-概要)
2. [ページ構成](#2-ページ構成)
3. [認証フロー](#3-認証フロー)
4. [CompanyDashboard](#4-companydashboard-候補者検索画面)
5. [CompanySettings](#5-companysettings-設定管理)
6. [PublicCompanyPage](#6-publiccompanypage-公開企業ページ)
7. [データモデル](#7-データモデル)
8. [API エンドポイント](#8-apiエンドポイント)
9. [State 管理パターン](#9-state管理パターン)
10. [エラーハンドリング](#10-エラーハンドリング)
11. [セキュリティ・権限制御](#11-セキュリティ権限制御)
12. [フロー図解](#12-フロー図解)

---

## 1. 概要

Torail の企業セクションは、企業ユーザーが **候補者（ユーザー）を検索・スカウトし、募集情報を管理する** ための統合プラットフォームです。

### 主要機能

| 機能 | 説明 |
|------|------|
| **ダッシュボード** | 候補者検索、フィルタ、保存済み検索、スカウト起点 |
| **設定管理** | 企業プロフィール、募集情報（CRUD）、プラン管理、メンバー管理 |
| **公開ページ** | 企業情報の公開表示（非ログインユーザーもアクセス可能） |
| **ログイン** | 企業ユーザーの認証フロー |

### 企業と個人ユーザーの違い

```
┌─────────────────────┬──────────────────┬──────────────────┐
│ 機能                │ 企業ユーザー     │ 個人ユーザー     │
├─────────────────────┼──────────────────┼──────────────────┤
│ プロフィール表示    │ 企業プロフィール │ 個人プロフィール │
│ 検索対象            │ 候補者（ユーザー）│ 企業             │
│ スカウト            │ ○ 可能           │ ✗ 不可           │
│ 募集情報管理        │ ○ 可能           │ ✗ 不可           │
│ メンバー管理        │ ○ 可能           │ ✗ 不可           │
│ プラン機能          │ ○ あり           │ ✗ なし           │
└─────────────────────┴──────────────────┴──────────────────┘
```

---

## 2. ページ構成

### URL ルート

```
/company/login                  → LoginCompanyPage
/company/dashboard              → CompanyDashboard
/company/settings               → CompanySettings
/company/public/:slug           → PublicCompanyPage
/company/scout?to=...&uid=...   → Scout（後続機能）
```

### ページ間の遷移フロー

```
┌─────────────────┐
│ /company/login  │ ← 企業ユーザーのログイン・登録
└────────┬────────┘
         │ (ログイン成功)
         ↓
┌─────────────────────┐
│ /company/dashboard  │ ← 候補者検索・スカウト起点
└────┬────────────┬───┘
     │            │
     │ (設定)     │ (スカウト)
     ↓            ↓
┌──────────────┐  /company/scout?to=...&uid=...
│ /company/    │  ↓
│ settings     │  Scout（スカウトメッセージ作成）
└──────────────┘
```

---

## 3. 認証フロー

### 企業ユーザー登録・ログインプロセス

```
1. /company/login にアクセス
   ↓
2. Login_Register コンポーネント表示
   - fixedAccountType="company" が設定されている
   - defaultTab="register" で新規登録フォームが最初に表示
   ↓
3. メール/パスワードで登録
   POST /auth/register/
   {
     "email": "company@example.com",
     "password": "...",
     "account_type": "company"  // ← 固定値
   }
   ↓
4. 登録成功 → /company/dashboard にリダイレクト
   ↓
5. ダッシュボード初期表示時
   GET /companies/
   - 未所属 → 企業作成フロー表示
   - 所属済み → 検索UI表示
```

### Token 管理

- Django REST Framework + DRF Token Authentication
- ログイン時に Token を localStorage に保存
- api() 関数が自動で Authorization ヘッダに Token を付与

---

## 4. CompanyDashboard: 候補者検索画面

### 責務

企業ユーザーが候補者（ユーザー）を検索・フィルタ・保存・スカウトするメイン画面。

### 状態管理

```javascript
// ① 所属企業
companies: null | []     // null=読込中, []=未所属, [...]= 所属済み

// ② フィルタ条件
filters: {
  languages: [],         // 言語スラッグ（例: ["python", "typescript"]）
  recentActiveDays: null,
  currentStreakMin: null,
  maxStreakMin: null,
  grade: "",             // 学年（"B4", "M1"など）
  region: "",            // 都道府県
  sort: "直近アクティブ度",
  q: ""                  // キーワード検索
}

// ③ 検索結果
items: []                // 候補者リスト
total: 0                 // 総件数
page: 1                  // ページ番号

// ④ 保存済み検索
saved: [
  { name: "Python×ストリーク≧3" },
  { name: "新着・全体公開" }
]
```

### データフロー

```
1. マウント時
   GET /companies/
   → companies に所属企業リスト
   ↓
2. companies が [] ならば
   → 企業作成フロー表示（未所属 UI）
   ↓
3. companies に値があれば
   → FiltersBar + SavedSearches + CandidateList を表示
   ↓
4. filters が変わる
   → setPage(1) でリセット
   → runSearch(1, filters) 実行
   ↓
5. page が変わる
   → runSearch(page, filters) 実行
```

### buildQuery 関数: フィルタ → URLパラメータ

```javascript
// 例: filters 状態
{
  languages: ["python", "javascript"],
  grade: "B4",
  region: "東京都",
  sort: "新着"
}

// 生成されるクエリ文字列
languages=python,javascript&grade=B4&pref=東京都&sort=new
```

### runSearch 関数: API 呼び出し

```javascript
// Primary endpoint
GET /companies/candidates/?page={pageNum}&{queryString}

// Fallback endpoint (404時)
GET /profiles/search/?page={pageNum}&{queryString}

// レスポンスマッピング
{
  user_id → id
  display_name → name
  username → username
  languages[] → languages
  active7 → active7
  active30 → active30
  avatar_url → avatarUrl
  fav → fav (お気に入りフラグ)
}
```

### イベントハンドラ

```javascript
// プロフィール表示
onProfile(c) → /mypage/{username}

// スカウト画面へ
onScout(c) → /company/scout?to={username}&uid={user_id}

// 検索条件を保存
onSaveCond() → saved リストに追加

// 候補者をお気に入り登録/解除
onToggleFav(c) → items の該当要素を更新
```

### 条件分岐

```javascript
if (companies === null) 
  → null を返す（何も表示しない）

if (companies.length === 0)
  → 企業作成フロー UI（2パターン表示）
     - 最初の1人：企業を新規作成
     - 既存企業：オーナーからの追加待ち

else (companies に値)
  → 通常のダッシュボード UI（検索・保存・スカウト）
```

---

## 5. CompanySettings: 設定管理

### 責務

企業のプロフィール、募集情報、公開設定、プラン、メンバーを管理する。**オーナーのみが編集可能**。

### 状態管理

```javascript
company: {            // ログインユーザーが所属する企業
  id, name, industry, 
  description, website, 
  slug, is_public, show_hirings
}

isAdmin: boolean      // ユーザーがオーナーかどうか
plans: [
  {
    id, company_id, plan_type ("free"|"pro"|"enterprise"),
    monthly_quota, price_jpy, active_from, current (将来フィールド)
  }
]

hirings: [            // 募集情報
  {
    id, company_id, title, detail, 
    tech_stack, location, employment_type,
    created_at
  }
]

showPlanModal: boolean
```

### 初期化フロー

```
1. マウント時
   ↓
2. GET /companies/
   → list[0] を取得
   ↓
3. GET /company_members/?company={id}
   → role="owner" を探す → isAdmin 判定
   ↓
4. GET /company_plans/?company={id}
   → plans リストを取得
   ↓
5. GET /company_hirings/?company={id}
   → hirings リストを取得（404 でもスルー）
```

### 募集情報 CRUD

```
CREATE:
  - 「募集を追加」ボタン → draft オブジェクトを先頭に挿入
  - ユーザーが編集 → HiringInfoCard の onChange 発火
  - raw.id がなければ POST /company_hirings/
  - 成功後、draft を作成したものに置換

READ:
  - マウント時に GET /company_hirings/?company={id}

UPDATE:
  - HiringInfoCard onChange で draft が返される
  - raw.id があれば PATCH /company_hirings/{id}/
  - 成功後、該当 item を更新

DELETE:
  - 削除ボタン → confirm() → DELETE /company_hirings/{id}/
  - 成功後、該当 item を除外
```

### プラン管理

```
PLAN_PRESETS:
  [
    { key: 'free', name: 'Free', monthly_quota: 50, price_jpy: 0 },
    { key: 'pro', name: 'Pro', monthly_quota: 200, price_jpy: 5000 },
    { key: 'enterprise', name: 'Enterprise', monthly_quota: 1000, price_jpy: 20000 }
  ]

applyPresetPlan(preset):
  POST /company_plans/
  {
    company, plan_type, monthly_quota, price_jpy, active_from
  }
  → plans に新プランを先頭追加
  
プラン比較モーダル:
  - showPlanModal が true のとき表示
  - 3つのプラン比較表（月額、上限、機能など）
  - 各プランの「このプランにする」ボタンで applyPresetPlan() 実行
```

### 公開設定

```
フィールド:
  - slug: URL スラッグ（例: "torail-inc"）
  - is_public: 企業ページの公開フラグ
  - show_hirings: 公開ページでの求人表示フラッグ

公開 URL:
  /company/public/{slug}

保存:
  PATCH /companies/{id}/
  { slug, is_public, show_hirings }
```

---

## 6. PublicCompanyPage: 公開企業ページ

### 責務

誰でもアクセス可能な企業の公開プロフィール。読み取り専用。

### データ取得

```javascript
GET /public/companies/{slug}/
→ {
    company: { name, industry, description, website, logo_url },
    hirings: [{ title, tech_stack, location, created_at }]
  }
```

### 表示内容

```
1. ページヘッダ: 企業名 + 業種
2. CompanyProfileCard: 読取専用表示（isAdmin=false）
3. HiringInfoCard: 読取専用表示
4. 求人リスト
```

### 条件分岐

```javascript
if (loading)
  → "読み込み中..."

if (!data)
  → "企業情報が見つかりません。"

else
  → 企業プロフィール + 求人表示
```

---

## 7. データモデル

### Company

```python
{
  id: Integer (PK)
  name: String
  industry: String
  description: Text
  website: URL
  logo_url: URL
  slug: String (unique, 公開 URL 用)
  is_public: Boolean (デフォルト: True)
  show_hirings: Boolean (公開ページで求人を表示)
  created_at: DateTime
  updated_at: DateTime
}
```

### CompanyMember

```python
{
  id: Integer (PK)
  user_id: ForeignKey(User)
  company_id: ForeignKey(Company)
  role: String Enum("owner", "member")
  joined_at: DateTime
}
```

### CompanyPlan

```python
{
  id: Integer (PK)
  company_id: ForeignKey(Company)
  plan_type: String ("free", "pro", "enterprise")
  monthly_quota: Integer
  price_jpy: Integer
  active_from: Date
  current: Boolean (将来フィールド：現在のプラン判定用)
  created_at: DateTime
}
```

### CompanyHiring

```python
{
  id: Integer (PK)
  company_id: ForeignKey(Company)
  title: String
  detail: Text
  tech_stack: String (カンマ区切り技術スタック)
  location: String (勤務地)
  employment_type: String ("新卒", "既卒", "インターン" など)
  created_at: DateTime
  updated_at: DateTime
}
```

---

## 8. API エンドポイント

### 企業情報

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/companies/` | ログインユーザーが所属する企業リスト |
| PATCH | `/companies/{id}/` | 企業情報を更新 |
| POST | `/companies/` | 新規企業を作成 |

### メンバー管理

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/company_members/?company={id}` | 企業のメンバー一覧 |

### プラン

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/company_plans/?company={id}` | 企業のプラン履歴 |
| POST | `/company_plans/` | 新規プランを作成 |

### 募集情報

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/company_hirings/?company={id}` | 企業の募集情報リスト |
| POST | `/company_hirings/` | 新規募集を作成 |
| PATCH | `/company_hirings/{id}/` | 募集を更新 |
| DELETE | `/company_hirings/{id}/` | 募集を削除 |

### 候補者検索

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/companies/candidates/?page=...&languages=...` | 候補者検索（企業向け） |
| GET (Fallback) | `/profiles/search/?page=...&...` | プロフィール検索（フォールバック） |

### 公開ページ

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/public/companies/{slug}/` | 公開企業情報（未認証でアクセス可） |

---

## 9. State 管理パターン

### ダッシュボード: フィルタ → 検索結果

```javascript
// 状態管理：フィルタが変わると自動で検索を実行
useEffect(() => {
  setPage(1);
  runSearch(1, filters);
}, [filters]);  // filters が変わるたびに発火

// ページ変更時も検索を実行
useEffect(() => {
  runSearch(page, filters);
}, [page]);
```

### 設定画面: フォーム入力 → API 送信

```javascript
// 入力値を state に保持（即座に反映）
onChange={(e) => setCompany(c => ({ ...c, slug: e.target.value }))}

// 保存ボタンで API 送信
onClick={() => savePublicSettings({ slug, is_public, show_hirings })}
  → PATCH /companies/{id}/
  → 成功時に company state を更新
```

### 募集情報: オプティミスティック UI

```javascript
// ドラフトを先頭に追加（即座に表示）
setHirings(prev => [draft, ...prev]);

// ユーザー編集
onChange(draft)

// API 送信（POST/PATCH）
→ 作成/更新されたオブジェクトでドラフトを置換
```

---

## 10. エラーハンドリング

### 候補者検索: フォールバック処理

```javascript
try {
  // Primary endpoint
  const res = await api(`/companies/candidates/?...`);
  setItems(...);
} catch (e) {
  if (e?.status === 404) {
    try {
      // Fallback endpoint
      const res2 = await api(`/profiles/search/?...`);
      setItems(...);
    } catch {
      // 両方失敗
      setItems([]);
      // toast.info("候補者検索API未実装");
    }
  } else {
    throw e;  // 404以外のエラーは上位へ
  }
}
```

### 企業作成: ユーザーフィードバック

```javascript
try {
  await api("/companies/", { method: "POST", ... });
  // 成功後、dashboard を通常表示に切り替え
} catch (e) {
  // DRF エラーレスポンスから detail 取得
  alert(e?.response?.data?.detail || "作成に失敗しました（既に企業に所属していませんか？）");
}
```

---

## 11. セキュリティ・権限制御

### オーナー権限（isAdmin）

```javascript
// CompanySettings では、フォーム操作を disabled で制限
disabled={!isAdmin || saving}

// 募集削除、プラン適用も isAdmin チェック
if (!isAdmin) { alert('オーナー権限が必要です'); return; }
```

### 公開ページ (PublicCompanyPage)

```javascript
// 常に isAdmin=false で表示
<CompanyProfileCard isAdmin={false} onChange={() => {}} />

// 編集フォームを一切表示しない
// DRF backend では is_public=False の企業にアクセス禁止
```

### 認証状態

```javascript
// fixedAccountType="company" で企業ユーザーに強制
// account_type="company" でない場合、ダッシュボード UI を非表示にすることも可能
```

---

## 12. フロー図解

### 企業ユーザーのオンボーディング

```
 ┌─────────────────┐
 │ /company/login  │
 │  ログイン・登録 │
 └────────┬────────┘
          │
          ↓
┌──────────────────────────┐
│ POST /auth/register/      │
│ account_type="company"    │
└────────┬─────────────────┘
         │
         ↓ (成功)
┌─────────────────────────┐
│ /company/dashboard      │
│ GET /companies/         │
└────┬────────────────────┘
     │
     ├─→ [] (未所属)
     │   ├─ 企業作成フロー表示
     │   ├─ 「会社を作成」ボタン
     │   │  POST /companies/
     │   │  → 企業作成
     │   │
     │   ↓
     │   (企業を作成したら通常 UI に)
     │
     └─→ [...] (所属済み)
         │
         ↓ 通常のダッシュボード表示
         ├─ FiltersBar（検索条件）
         ├─ SavedSearches（保存済み検索）
         └─ CandidateList（候補者リスト）
```

### 候補者検索から Scout への遷移

```
CompanyDashboard
  │
  ├─ FiltersBar: ユーザーがフィルタを操作
  │  └─ onChange(filters)
  │     → setFilters()
  │     → useEffect (filters依存)
  │        → runSearch(1, filters)
  │
  ├─ GET /companies/candidates/?page=...&languages=...
  │  (または /profiles/search/ fallback)
  │
  ├─ setItems([候補者リスト])
  │
  └─ CandidateList: 候補者を描画
     │
     └─ 各候補者に onScout ボタン
        └─ onScout(c)
           → navigate(`/company/scout?to=...&uid=...`)
              ↓
              Scout ページへ遷移
              (スカウトメッセージ作成)
```

### 企業設定画面のデータフロー

```
CompanySettings (マウント)
  │
  ├─ GET /companies/
  │  → setCompany(list[0])
  │
  ├─ GET /company_members/?company={id}
  │  → setIsAdmin(role === "owner")
  │
  ├─ GET /company_plans/?company={id}
  │  → setPlans()
  │
  └─ GET /company_hirings/?company={id}
     → setHirings()
     
     ↓

左カラム:
  ├─ CompanyProfileCard: 企業情報表示（読取）
  │
  ├─ 募集情報セクション:
  │  ├─ 「募集を追加」→ draft 追加
  │  ├─ 各募集の HiringInfoCard onChange
  │  │  → POST /company_hirings/ (新規)
  │  │  → PATCH /company_hirings/{id}/ (更新)
  │  └─ 削除ボタン
  │     → DELETE /company_hirings/{id}/
  │
  └─ 公開設定:
     ├─ slug 入力 → setCompany()
     ├─ is_public チェック → setCompany()
     ├─ show_hirings チェック → setCompany()
     └─ 保存ボタン
        → savePublicSettings()
        → PATCH /companies/{id}/

右カラム:
  ├─ 通知設定カード
  ├─ メンバー管理カード
  └─ プラン表示:
     ├─ 現在のプラン表示（plans[0]）
     ├─ 「プランを比較して選ぶ」
     └─ プラン比較モーダル
        ├─ 3プリセットを表形式表示
        └─ 各プランの「このプランにする」
           → applyPresetPlan(preset)
           → POST /company_plans/
           → setPlans([新プラン, ...])
```

### 公開ページのアクセスフロー

```
PublicCompanyPage (:slug)
  │
  ├─ useParams() → slug 取得
  │
  └─ useEffect ([slug]):
     │
     ├─ GET /public/companies/{slug}/
     │  (未認証でアクセス可能)
     │
     ├─ setData({ company, hirings })
     │ or
     ├─ エラー → "企業情報が見つかりません"
     │
     └─ setLoading(false)
        │
        ↓
     
     JSX 描画:
       ├─ ページヘッダ
       ├─ CompanyProfileCard (isAdmin=false)
       ├─ HiringInfoCard (isAdmin=false)
       └─ 求人リスト表示
```

---

## まとめ

Torail の企業セクションは、以下の4つの主要ページで構成されています：

1. **LoginCompanyPage**: 企業ユーザー認証（account_type="company"固定）
2. **CompanyDashboard**: 候補者検索・スカウト・検索保存（メイン機能）
3. **CompanySettings**: 企業プロフィール・募集・プラン・メンバー管理（オーナーのみ編集）
4. **PublicCompanyPage**: 企業情報の公開表示（読取専用、未認証アクセス可）

各ページは React の State 管理、API 統合、条件分岐描画を活用して、複雑なビジネスロジックを実装しています。

**次のステップ**: Scout 機能（スカウトメッセージ作成）の実装へ

