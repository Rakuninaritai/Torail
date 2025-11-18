// src/pages/Company/CompanyDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import FiltersBar from "../../components/Company/dashboard/FiltersBar";
import SavedSearches from "../../components/Company/dashboard/SavedSearches";
import CandidateList from "../../components/Company/dashboard/CandidateList";
import "../../components/Company/dashboard/companydash.css";
import { api } from "../../api";



export default function CompanyDashboardPage() {
  const navigate = useNavigate();

  // 所属会社の読み込み
  const [companies, setCompanies] = useState(null); // null=読込中, []=未所属
  const [creating, setCreating] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  // ─────────────────────────────────────────────
  // まず最初に「検索に関わる state」を宣言（TDZ回避）
  // ─────────────────────────────────────────────
  const [plan] = useState({ type: "無料", note: "検索のみ/スカウト不可" });
  const [filters, setFilters] = useState({
    languages: [],
    recentActiveDays: null,
    currentStreakMin: null,
    maxStreakMin: null,
    grade: "",
    region: "",
    visibility: "",
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
    let ignore = false;
    (async () => {
      try {
        const res = await api("/companies/", { method: "GET" });
        if (!ignore) setCompanies(res?.results || res || []);
      } catch {
        if (!ignore) setCompanies([]);
      }
    })();
    return () => { ignore = true; };
  }, []);
  // ─────────────────────────────────────────────
  // クエリビルド（filters → API のクエリ文字列）
  // ─────────────────────────────────────────────
  const buildQuery = (f) => {
    const params = new URLSearchParams();
    if (f.languages?.length) {
      // LanguageMaster の slug を保存していれば slug で、なければ name を; 今回は name を小文字化
      params.set("languages", f.languages.map(s=>s.toLowerCase()).join(","));
    }
    if (f.grade) params.set("grade", f.grade);
    if (f.region) params.set("pref", f.region);
    if (f.q) params.set("q", f.q);
    // 並び替え
    if (f.sort === "現在ストリーク（降順）") params.set("sort", "active7");  // ストリーク近似=直近活性
    else if (f.sort === "新着") params.set("sort", "new");
    else if (f.sort === "最終記録日時") params.set("sort", "recent");
    else params.set("sort", "active7");
    return params.toString();
  };

  // ─────────────────────────────────────────────
  // 検索実行（filters/page を使って API から取得）
  // ─────────────────────────────────────────────
  const runSearch = async (pageNum = 1, f) => {
    // safety: f 未指定なら現在の filters
    f = f ?? filters;
    const qs = buildQuery(f);
   try {
    // --- まず本命エンドポイント ---
    const res = await api(`/companies/candidates/?page=${pageNum}&${qs}`, { method: "GET" });
    const list = res?.results || res || [];
    setItems(list.map(c => ({
      id: c.user_id,                              // ← user_id を持たせる
      name: c.display_name,
      username: c.username,
      school: c.school || "",
      grade: c.grade || "",
      region: c.prefecture || "",
      languages: c.languages || [],
      active7: c.active7 || 0,
      active30: c.active30 || 0,
      lastRecordAt: c.lastRecordAt || "",
      visibility: c.visibility,
      fav: !!c.fav, // バックがあれば反映、なければ false
      // heat は KPI 詳細APIで後追い取得。ここでは省略/仮置き
      heat: [],
      avatarUrl: c.avatar_url || ""
    })));
    setTotal(res?.count ?? list.length);
    return;
    } catch (e) {
      // 404 など → フォールバック（既存のプロフィール検索APIがあれば差し替え）
      if (e?.status === 404) {
        try {
          // 例：/profiles/search/（存在するならここに合わせてください）
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
            visibility: p.visibility,
            fav: !!p.fav,
            avatarUrl: p.avatar_url || "",
            heat: [],
          })));
          setTotal(res2?.count ?? list2.length);
          return;
        } catch (e2) {
          // それも無ければ空表示＋トースト
          setItems([]);
          setTotal(0);
          // お好みで toast を出す
          // toast.info("候補者検索APIが未実装のため、結果は空です。バックエンド側に /companies/candidates/ を追加してください。");
          return;
        }
      }
      // その他エラー
      throw e;
    }
  };

  // フィルタが変わったら 1 ページ目から検索
  useEffect(() => {
    setPage(1);
    runSearch(1, filters);
  }, [filters]);

  // ページ変更時は現在の filters で検索
  useEffect(() => {
    runSearch(page, filters);
  }, [page]);

  // ----- ハンドラ
  const onProfile = (c) => navigate(`/mypage/${encodeURIComponent(c.username)}`);
  const onScout   = (c) => navigate(`/company/scout?to=${encodeURIComponent(c.username)}&uid=${encodeURIComponent(c.id)}`);



  

  // （クライアント側のみでの並び替え・絞り込みをやるならここで items を加工。
  //  ただし今回はサーバ検索前提なので items をそのまま CandidateList に渡す）

  const onSaveCond = () => {
    const label = [
      filters.languages.length ? filters.languages.join("・") : null,
      filters.currentStreakMin!=null ? `streak≥${filters.currentStreakMin}`:null,
      filters.visibility || null
    ].filter(Boolean).join("×") || "条件";
    setSaved(prev => [...prev, { name: label }]);
  };

  const onRemoveSaved = (idx) => setSaved(prev => prev.filter((_,i)=>i!==idx));
  const onToggleFav = (c) => {
    // API があれば POST/DELETE → 成功時に反映
    setItems(prev => prev.map(x => x.id === c.id ? { ...x, fav: !x.fav } : x));
  };

  // ---- 分岐描画 ----
  if (companies === null) return null; // 読み込み中

  if (companies.length === 0) {
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

  // 所属あり → 従来の検索/保存/スカウト UI
  return (
    <main className="container-xxl pb-5">
      <div className="page-header mb-3">
        <i className="bi bi-search fs-4" />
        <h1 className="title h4 mb-0">企業ダッシュボード</h1>
        <span className="subtle ms-2">候補者の検索・保存・スカウト起点</span>
      </div>

      <FiltersBar value={filters} onChange={(v)=>{ setFilters(v); setPage(1); }} onSaveCond={onSaveCond} />
      <SavedSearches items={saved} onRemove={onRemoveSaved} plan={plan} />

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
