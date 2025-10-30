// src/pages/Company/CompanyDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import FiltersBar from "../../components/Company/dashboard/FiltersBar";
import SavedSearches from "../../components/Company/dashboard/SavedSearches";
import CandidateList from "../../components/Company/dashboard/CandidateList";
import "../../components/Company/dashboard/companydash.css";
import { api } from "../../api";

/** ダミーデータ（バック未接続時の見た目確認用） */
const allCandidates = [
  { id:"u1", name:"山本 舟人", school:"HAL名古屋", grade:"3年", region:"東海",
    streakCurrent:8, streakMax:21, lastRecordAt:"2025-09-28 22:10",
    active7:6, active30:22, visibility:"企業のみ",
    languages:["Python","TypeScript","C"], fav:false,
    heat:[1,2,0,3,1,0,4,1,2,3,0,1,0,2,3,0,0,1,2,1,4,1,2,0,2,3,1,0,2],
    createdAt:"2025-08-22",
  },
  { id:"u2", name:"伊藤 羽琉", school:"HAL名古屋", grade:"3年", region:"東海",
    streakCurrent:3, streakMax:9, lastRecordAt:"2025-09-27 19:20",
    active7:4, active30:15, visibility:"全体公開",
    languages:["JavaScript","Python","Go"], fav:true,
    heat:[0,1,2,2,0,1,3,0,2,1,0,1,3,2,0,0,1,2,1,0,2,3,1,0,2,2,0,1,0],
    createdAt:"2025-09-05",
  },
  { id:"u3", name:"佐藤 凛", school:"XX大学", grade:"4年", region:"関東",
    streakCurrent:12, streakMax:30, lastRecordAt:"2025-09-29 08:10",
    active7:7, active30:25, visibility:"企業のみ",
    languages:["Go","TypeScript","Python"], fav:false,
    heat:[3,2,2,4,3,3,4,2,3,3,4,2,3,2,4,3,2,4,3,4,4,2,3,2,3,4,3,4,3],
    createdAt:"2025-07-30",
  },
];

export default function CompanyDashboardPage() {
  const navigate = useNavigate();

  // 所属会社の読み込み
  const [companies, setCompanies] = useState(null); // null=読込中, []=未所属
  const [creating, setCreating] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");

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

  // ---- ここから下は「所属あり」のとき従来UI ----
  const [plan] = useState({ type: "無料", note: "検索のみ/スカウト不可" });
  const [filters, setFilters] = useState({
    languages: [], recentActiveDays: null, currentStreakMin: null, maxStreakMin: null,
    grade: "", region: "", visibility: "", sort: "直近アクティブ度",
  });
  const [saved, setSaved] = useState([{ name: "Python×ストリーク≧3" }, { name: "新着・全体公開" }]);
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const data = useMemo(() => {
    let arr = [...allCandidates];
    if (filters.languages.length) arr = arr.filter(c => filters.languages.every(l => c.languages.includes(l)));
    if (filters.recentActiveDays != null) arr = arr.filter(c => c.active30 >= filters.recentActiveDays);
    if (filters.currentStreakMin != null) arr = arr.filter(c => c.streakCurrent >= filters.currentStreakMin);
    if (filters.maxStreakMin != null) arr = arr.filter(c => c.streakMax >= filters.maxStreakMin);
    if (filters.grade) arr = arr.filter(c => c.grade === filters.grade);
    if (filters.region) arr = arr.filter(c => c.region === filters.region);
    if (filters.visibility) arr = arr.filter(c => c.visibility === filters.visibility);
    switch (filters.sort) {
      case "現在ストリーク（降順）": arr.sort((a,b)=> b.streakCurrent - a.streakCurrent); break;
      case "最終記録日時": arr.sort((a,b)=> new Date(b.lastRecordAt) - new Date(a.lastRecordAt)); break;
      case "新着": arr.sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt)); break;
      default: arr.sort((a,b)=> b.active7 - a.active7 || b.active30 - a.active30);
    }
    return arr;
  }, [filters]);

  const onSaveCond = () => {
    const label = [
      filters.languages.length ? filters.languages.join("・") : null,
      filters.currentStreakMin!=null ? `streak≥${filters.currentStreakMin}`:null,
      filters.visibility || null
    ].filter(Boolean).join("×") || "条件";
    setSaved(prev => [...prev, { name: label }]);
  };

  const onRemoveSaved = (idx) => setSaved(prev => prev.filter((_,i)=>i!==idx));
  const onProfile = (c) => navigate(`/mypage/${encodeURIComponent(c.name)}`); // 後で username に差し替え
  const onScout   = (c) => navigate(`/company/scout?to=${encodeURIComponent(c.name)}`);
  const onToggleFav = (c) => {
    const i = allCandidates.findIndex(x=>x.id===c.id);
    if (i>=0) { allCandidates[i].fav = !allCandidates[i].fav; }
    setPage(p=>p); // 再描画
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
        items={data}
        plan={plan}
        onProfile={onProfile}
        onScout={onScout}
        onToggleFav={onToggleFav}
        page={page}
        pageSize={pageSize}
        onPage={setPage}
      />
    </main>
  );
}
