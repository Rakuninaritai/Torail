// src/pages/Company/CompanyDashboard.jsx
// ────────────────────────────────────────────────────────────────
// 企業ダッシュボード
// ────────────────────────────────────────────────────────────────
// 企業ユーザーが候補者（ユーザー）を検索・保存・スカウト（Scout へ遷移）
// する画面。所属企業がない場合は「企業作成」と「追加待機」を促すフロー。
// ────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import FiltersBar from "../../components/Company/dashboard/FiltersBar";
import SavedSearches from "../../components/Company/dashboard/SavedSearches";
import CandidateList from "../../components/Company/dashboard/CandidateList";
import "../../components/Company/dashboard/companydash.css";
import { api } from "../../api";



export default function CompanyDashboardPage() {
  // ページ遷移用 (onProfile/onScout で使用)
  const navigate = useNavigate();

  // ─────────────────────────────────────────────────────────────
  // ① 所属企業の読み込み
  // ─────────────────────────────────────────────────────────────
  // companies: 
  //   - null    = 読込中（何も表示しない）
  //   - []      = 未所属（企業作成フロー表示）
  //   - [...]   = 所属済み（通常ダッシュ表示）
  // creating  = 企業作成ボタンの送信中フラグ
  // newCompanyName = フォーム入力値
  const [companies, setCompanies] = useState(null); // null=読込中, []=未所属
  const [creating, setCreating] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");

  // ─────────────────────────────────────────────────────────────
  // ② 検索フィルタと結果管理
  // ─────────────────────────────────────────────────────────────
  // plan      = 現在のプラン（ここでは仮置き）
  // filters   = FiltersBar から受け取ったフィルタ条件
  //   - languages[]   = 言語スラッグ（例: ["python","typescript"]）
  //   - recentActiveDays = 最近の稼働日数
  //   - currentStreakMin/maxStreakMin = ストリーク最小値
  //   - grade = 学年（例: "B4"）
  //   - region = 都道府県（例: "東京都"）
  //   - sort = ソート方法（"直近アクティブ度" など）
  //   - q = キーワード検索
  // saved     = 保存された検索条件（SavedSearches コンポーネント用）
  // page      = 現在のページ番号（1-indexed）
  // pageSize  = 1ページあたりの件数
  // items     = 検索結果の候補者リスト
  // total     = 検索結果の総件数
  // ─────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────
  // ② プラン情報を API から取得（現在有効なプラン、または最新プラン）
  // ─────────────────────────────────────────────────────────────
  // plan オブジェクトには以下が含まれます：
  //   - id: UUID（プランID）
  //   - company: 企業ID
  //   - plan_type: 'free' | 'pro' | 'enterprise'
  //   - monthly_quota: 月間送信上限（例: 50, 200, 1000）
  //   - price_jpy: 月額価格（JPY、無料なら 0）
  //   - active_from: 開始日（例: "2024-11-28"）
  //   - active_to: 終了日（未指定なら null = 現在有効）
  //   - remaining: 残り送信可能数（サーバー側で初回は monthly_quota と同じ、DM 送信で -1）
  // ─────────────────────────────────────────────────────────────
  const [plan, setPlan] = useState(null);
  const [filters, setFilters] = useState({
    languages: [],
    recentActiveDays: null,
    currentStreakMin: null,
    maxStreakMin: null,
    grade: "",
    region: "",
    sort: "直近アクティブ度", // FiltersBar側の初期値と合わせる
    q: "",
  });
  const [saved, setSaved] = useState([
    { name: "Python×ストリーク≧3" },
    { name: "新着・全体公開" },
  ]);
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const [items, setItems] = useState([]); // 検索結果
  const [total, setTotal] = useState(0);  // 総件数

  useEffect(() => {
    // 画面マウント時に、ログインユーザーが所属する企業リストを取得
    // さらに、その企業のプラン情報も同時に取得してダッシュボードに反映
    let ignore = false;
    (async () => {
      try {
        const res = await api("/companies/", { method: "GET" });
        const companies_list = res?.results || res || [];
        if (!ignore) setCompanies(companies_list);
        
        // ────────────────────────────────────────────────────────────
        // 企業が存在する場合はそのプラン情報も取得する
        // ────────────────────────────────────────────────────────────
        if (companies_list.length > 0) {
          const first_company = companies_list[0];
          try {
            // GET /company_plans/?company={company_id}
            // バックエンドは作成日が新しいプランを先頭に返す想定（DESC order）
            const plans_res = await api(`/company_plans/?company=${first_company.id}`, { method: "GET" });
            const plans_list = plans_res?.results || plans_res || [];
            
            // 最初のプラン（最新）を現在のプランとして設定
            // 複数プランが存在する場合（例：Pro → Enterprise にアップグレード）は
            // 最新のものを使用する。サーバ側で current フラグが追加されたら
            // そちらを優先してください。
            if (!ignore && plans_list.length > 0) {
              // plan オブジェクト: { id, plan_type, monthly_quota, remaining, ... }
              setPlan(plans_list[0]);
            } else if (!ignore) {
              // プランが空の場合は null（未設定状態）
              setPlan(null);
            }
          } catch {
            // プラン取得失敗時は silent fail（ダッシュボード自体は表示する）
            if (!ignore) setPlan(null);
          }
        }
      } catch {
        if (!ignore) setCompanies([]);
      }
    })();
    return () => { ignore = true; };
  }, []);

  // ─────────────────────────────────────────────────────────────
  // ③ クエリビルド（filters → API のクエリ文字列）
  // ─────────────────────────────────────────────────────────────
  // フロントエンドの filters オブジェクトをバックエンド API の
  // クエリ文字列に変換する関数。
  // 言語、学年、地域、キーワード、ストリーク、ソート順等を組み立てる。
  // ─────────────────────────────────────────────────────────────
  const buildQuery = (f) => {
    const params = new URLSearchParams();
    // 言語フィルタ: 複数選択をカンマ区切りで送信
    if (f.languages?.length) {
      params.set("languages", f.languages.join(","));
    }
    // 学年フィルタ（例: "B4", "M1"）
    if (f.grade) params.set("grade", f.grade);
    // 都道府県フィルタ（バックエンドでは pref パラメータ）
    if (f.region) params.set("pref", f.region);
    // キーワード検索
    if (f.q) params.set("q", f.q);
    // 最近の稼働日数フィルタ（任意: days以内にアクティブ）
    if (f.recentActiveDays != null) params.set("recent_active_days", String(f.recentActiveDays));
    // 現在ストリーク（最小）と最長ストリーク（最小）をバックで近似フィルタへ
    if (f.currentStreakMin != null) params.set("current_streak_min", String(f.currentStreakMin));
    if (f.maxStreakMin != null) params.set("max_streak_min", String(f.maxStreakMin));
    // 注: visibility（全体公開/企業のみ/非公開）は企業側ダッシュでは不要のため送信しない
    // 並び替え条件をマッピング
    if (f.sort === "現在ストリーク（降順）") params.set("sort", "active7");  // ストリーク近似=直近活性
    else if (f.sort === "新着") params.set("sort", "new");
    else if (f.sort === "最終記録日時") params.set("sort", "recent");
    else params.set("sort", "active7");
    return params.toString();
  };

  // ─────────────────────────────────────────────────────────────
  // ④ 検索実行関数
  // ─────────────────────────────────────────────────────────────
  // filters/page を使ってバックエンド API から候補者リストを取得し、
  // items と total を更新する。
  // フォールバック: /companies/candidates/ が404なら /profiles/search/ を試みる。
  // ─────────────────────────────────────────────────────────────
  const runSearch = async (pageNum = 1, f) => {
    // f が未指定なら現在の filters を使用
    f = f ?? filters;
    const qs = buildQuery(f);
    try {
      // 本命エンドポイント: /companies/candidates/
      // 企業向けの候補者検索API（ページング対応）
      const res = await api(`/companies/candidates/?page=${pageNum}&${qs}`, { method: "GET" });
      const list = res?.results || res || [];
      // レスポンスデータを CandidateList コンポーネント用の形式に変換
      setItems(list.map(c => ({
        id: c.user_id,                              // user_idを使用
        name: c.display_name,
        username: c.username,
        school: c.school || "",
        grade: c.grade || "",
        region: c.prefecture || "",
        languages: c.languages || [],
        active7: c.active7 || 0,                    // 直近7日間のアクティブ度
        active30: c.active30 || 0,                  // 直近30日間のアクティブ度
        lastRecordAt: c.lastRecordAt || "",
        fav: !!c.fav,                               // お気に入りフラグ
        // heat は詳細 API で後追い取得（ここでは仮置き）
        heat: [],
        avatarUrl: c.avatar_url || ""
      })));
      // 総件数を保存（ページネーション用）
      setTotal(res?.count ?? list.length);
      return;
    } catch (e) {
      // /companies/candidates/ が 404 な場合 → フォールバック
      if (e?.status === 404) {
        try {
          // フォールバック: /profiles/search/ エンドポイントを試みる
          // （このエンドポイントが存在する場合のみ動作）
          const res2 = await api(`/profiles/search/?page=${pageNum}&${qs}`, { method: "GET" });
          const list2 = res2?.results || res2 || [];
          setItems(list2.map(p => ({
            id: p.user_id,
            name: p.display_name,
            username: p.username,
            school: p.school || "",
            grade: p.grade || "",
            region: p.prefecture || "",
            languages: p.languages || [],
            active7: p.active7 || 0,
            active30: p.active30 || 0,
            lastRecordAt: p.last_record_at || "",
            fav: !!p.fav,
            avatarUrl: p.avatar_url || "",
            heat: [],
          })));
          setTotal(res2?.count ?? list2.length);
          return;
        } catch {
          // 両方とも失敗 → 空表示
          setItems([]);
          setTotal(0);
          // TODO: トースト通知を出す（オプション）
          // toast.info("候補者検索APIが未実装のため、結果は空です。バックエンド側に /companies/candidates/ を追加してください。");
          return;
        }
      }
      // 404 以外のエラー → 上位へスロー
      throw e;
    }
  };

  // ─────────────────────────────────────────────────────────────
  // ⑤ 検索トリガー1: フィルタが変わったら 1 ページ目から検索
  // ─────────────────────────────────────────────────────────────
  // フィルタが変わるたびに検索を実行。ページを 1 にリセット。
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    setPage(1);
    runSearch(1, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // ─────────────────────────────────────────────────────────────
  // ⑥ 検索トリガー2: ページ変更時は現在の filters で検索
  // ─────────────────────────────────────────────────────────────
  // ページネーション: 別ページを選択したときにその page で検索を実行。
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    runSearch(page, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // ─────────────────────────────────────────────────────────────
  // ⑦ イベントハンドラ
  // ─────────────────────────────────────────────────────────────
  // onProfile: 候補者のプロフィールページに遷移
  const onProfile = (c) => navigate(`/mypage/${encodeURIComponent(c.username)}`);
  
  // onScout: DM 遷移用（候補者 username と user_id をパラメータ）
  // ルート名を Scout から DM に統一しました。
  const onScout   = (c) => navigate(`/company/dm?to=${encodeURIComponent(c.username)}&uid=${encodeURIComponent(c.id)}`);

  // onSaveCond: 現在のフィルタ条件を「保存された検索」に追加
  // ラベルは言語・ストリーク条件などから自動生成
  const onSaveCond = () => {
    const label = [
      filters.languages.length ? filters.languages.join("・") : null,
      filters.currentStreakMin != null ? `streak≥${filters.currentStreakMin}` : null,
    ].filter(Boolean).join("×") || "条件";
    setSaved(prev => [...prev, { name: label }]);
  };

  // onRemoveSaved: 保存された検索を削除
  const onRemoveSaved = (idx) => setSaved(prev => prev.filter((_, i) => i !== idx));

  // onToggleFav: 候補者のお気に入り状態をトグル
  // （実装パターン: API があれば POST/DELETE を実行してから反映）
  const onToggleFav = (c) => {
    setItems(prev => prev.map(x => x.id === c.id ? { ...x, fav: !x.fav } : x));
  };

  // ─────────────────────────────────────────────────────────────
  // ⑧ 条件分岐描画
  // ─────────────────────────────────────────────────────────────
  // companies が null = ロード中 → 何も返さない（非表示）
  // companies が [] = 未所属 → 企業作成フロー表示
  // companies[0] = 所属あり → 検索・保存・スカウト UI 表示
  // ─────────────────────────────────────────────────────────────
  if (companies === null) return null; // 読み込み中

  if (companies.length === 0) {
    // 未所属フロー: 企業を新規作成するか、追加を待つか
    // 未所属 → 空状態 UI（最初の1人 or 追加待ち）
    return (
      <main className="container-xxl pb-5">
        <div className="page-header mb-3">
          <i className="bi bi-building-add fs-4" />
          <h1 className="title h4 mb-0">企業ダッシュボード</h1>
          <span className="subtle ms-2">まずは会社を作成するか、オーナーからの追加をお待ちください</span>
        </div>

        <div className="row g-4">
          <div className="col-12 col-xl-6">
            <section className="torail-card h-100">
              <h6 className="mb-2">① 最初の1人は会社を新規作成</h6>
              <input
                className="form-control mb-2"
                placeholder="会社名（例: Torail株式会社）"
                value={newCompanyName}
                onChange={e=>setNewCompanyName(e.target.value)}
                disabled={creating}
              />
              <button
                className="btn btn-primary"
                disabled={creating || !newCompanyName.trim()}
                onClick={async ()=>{
                  try {
                    setCreating(true);
                    await api("/companies/", {
                      method: "POST",
                      headers: { "Content-Type":"application/json" },
                      body: JSON.stringify({ name: newCompanyName.trim() })
                    });
                    // 再ロードして通常ダッシュに切り替え
                    const list = await api("/companies/", { method: "GET" });
                    setCompanies(list?.results || list || []);
                  } catch (e) {
                    alert(e?.response?.data?.detail || "作成に失敗しました（既にどこかの会社に所属していませんか？）");
                  } finally {
                    setCreating(false);
                  }
                }}
              >
                <i className="bi bi-plus-lg" /> 会社を作成
              </button>
              <div className="form-hint small mt-2">
                ※ 既にいずれかの会社に所属している場合は新規作成できません。
              </div>
            </section>
          </div>

          <div className="col-12 col-xl-6">
            <section className="torail-card h-100">
              <h6 className="mb-2">② 会社が作成済みなら、オーナーからの追加を待つ</h6>
              <p className="text-muted small mb-3">
                あなたの登録メールに対して、オーナーがメンバー追加すると利用できるようになります。
              </p>
              <button
                className="btn btn-outline-secondary"
                onClick={async()=>{
                  const list = await api("/companies/", { method: "GET" });
                  setCompanies(list?.results || list || []);
                }}
              >
                <i className="bi bi-arrow-repeat" /> 追加されたか確認（更新）
              </button>
            </section>
          </div>
        </div>
      </main>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 所属あり: 通常の検索・保存・スカウト UI
  // ─────────────────────────────────────────────────────────────
  // 企業に所属済みのユーザーが見るメイン画面
  // プラン表示 → FiltersBar → SavedSearches → CandidateList の構成
  // ─────────────────────────────────────────────────────────────
  return (
    <main className="container-xxl pb-5">
      <div className="page-header mb-3">
        <i className="bi bi-search fs-4" />
        <h1 className="title h4 mb-0">企業ダッシュボード</h1>
        <span className="subtle ms-2">候補者の検索・保存・DM起点</span>
      </div>

      {/* ──────────────────────────────────────────────────────────────
          プラン情報表示（ダッシュボード上部のハイライト）
          ──────────────────────────────────────────────────────────────
          - plan が null の場合: プランが未設定のため「設定が必要」と表示
          - plan が存在: 
            - plan_type と monthly_quota を表示（大見出しサイズ）
            - remaining があれば残り送信数を表示（注目色で表示）
            - remaining がなければ「サーバー側の実装を待機中」と表示
          - 右上に「プラン設定」へのリンクボタンを配置
      */}
      {plan ? (
        <section className="torail-card mb-4 bg-light border-left-primary">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <div>
              <h5 className="mb-1">
                <i className="bi bi-lightning-charge-fill text-warning"></i>
                {' '}現在のプラン: <strong>{plan.plan_type}</strong>
              </h5>
              <div className="small text-muted">
                月間送信上限: <strong>{plan.monthly_quota} 件</strong>
              </div>
            </div>
            <a href="/company/settings" className="btn btn-sm btn-outline-primary">
              <i className="bi bi-gear"></i> プラン設定
            </a>
          </div>

          {/* 残り送信数の表示
              - remaining フィールドが存在すれば「あと○件」を強調表示
              - フィールドが undefined なら、サーバ側未実装なので案内を表示
          */}
          {plan.remaining !== undefined ? (
            <div className="alert alert-info mb-0 py-2">
              <strong>あと {plan.remaining} 件</strong> DM を送信できます
              {plan.remaining < 10 && plan.remaining >= 0 && (
                <span className="text-danger ms-2">
                  <i className="bi bi-exclamation-triangle"></i> 残数が少なくなっています
                </span>
              )}
              {plan.remaining <= 0 && (
                <span className="text-danger ms-2">
                  <i className="bi bi-exclamation-circle"></i> プランの上限に達しました
                </span>
              )}
            </div>
          ) : (
            <div className="small text-muted py-2">
              💡 残り送信数はサーバー側の実装が完了すると表示されます
            </div>
          )}
        </section>
      ) : (
        <section className="torail-card mb-4 bg-warning-light">
          <p className="text-muted mb-0">
            <i className="bi bi-info-circle"></i> プランが未設定です。
            <a href="/company/settings" className="ms-2">プラン設定ページ</a>でプランを選択してください。
          </p>
        </section>
      )}

      {/* フィルタバー: 言語・学年・地域・キーワード・ソート順 */}
      <FiltersBar value={filters} onChange={(v) => { setFilters(v); setPage(1); }} onSaveCond={onSaveCond} />
      
      {/* 保存済み検索: 過去に保存したフィルタ条件 */}
      <SavedSearches items={saved} onRemove={onRemoveSaved} plan={plan} />

      {/* 候補者リスト: ページネーション、アバター、プロフィール遷移、お気に入り、DM */}
      <CandidateList
        items={items}
        plan={plan}
        onProfile={onProfile}
        onScout={onScout}
        onToggleFav={onToggleFav}
        page={page}
        pageSize={pageSize}
        onPage={setPage}
        total={total}
      />
    </main>
  );
}
