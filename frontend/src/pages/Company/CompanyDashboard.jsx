import React, { useMemo, useState } from "react";
import FiltersBar from "../../components/Company/dashboard/FiltersBar";
import SavedSearches from "../../components/Company/dashboard/SavedSearches";
import CandidateList from "../../components/Company/dashboard/CandidateList";
import "../../components/Company/dashboard/companydash.css";

/** ダミーデータ */
const allCandidates = [
  {
    id:"u1", name:"山本 舟人", school:"HAL名古屋", grade:"3年", region:"東海",
    streakCurrent:8, streakMax:21, lastRecordAt:"2025-09-28 22:10",
    active7:6, active30:22, visibility:"企業のみ",
    languages:["Python","TypeScript","C"], fav:false,
    heat: [1,2,0,3,1,0,4, 1,2,3,0,1,0,2, 3,0,0,1,2,1,4, 1,2,0,2,3,1,0,2],
    createdAt: "2025-08-22",
  },
  {
    id:"u2", name:"伊藤 羽琉", school:"HAL名古屋", grade:"3年", region:"東海",
    streakCurrent:3, streakMax:9, lastRecordAt:"2025-09-27 19:20",
    active7:4, active30:15, visibility:"全体公開",
    languages:["JavaScript","Python","Go"], fav:true,
    heat: [0,1,2,2,0,1,3, 0,2,1,0,1,3,2, 0,0,1,2,1,0,2, 3,1,0,2,2,0,1,0],
    createdAt: "2025-09-05",
  },
  {
    id:"u3", name:"佐藤 凛", school:"XX大学", grade:"4年", region:"関東",
    streakCurrent:12, streakMax:30, lastRecordAt:"2025-09-29 08:10",
    active7:7, active30:25, visibility:"企業のみ",
    languages:["Go","TypeScript","Python"], fav:false,
    heat: [3,2,2,4,3,3,4, 2,3,3,4,2,3,2, 4,3,2,4,3,4,4, 2,3,2,3,4,3,4,3],
    createdAt: "2025-07-30",
  },
];

export default function CompanyDashboardPage() {
  const [plan] = useState({ type: "無料", note: "検索のみ/スカウト不可" });
  const [filters, setFilters] = useState({
    languages: [],
    recentActiveDays: null,
    currentStreakMin: null,
    maxStreakMin: null,
    grade: "",
    region: "",
    visibility: "",
    sort: "直近アクティブ度",
  });
  const [saved, setSaved] = useState([
    { name: "Python×ストリーク≧3" },
    { name: "新着・全体公開" },
  ]);

  const [page, setPage] = useState(1);
  const pageSize = 6;

  const data = useMemo(()=>{
    let arr = [...allCandidates];

    // 言語
    if (filters.languages.length) {
      arr = arr.filter(c => filters.languages.every(l => c.languages.includes(l)));
    }

    // 直近N日の稼働日数（active30を仮利用）
    if (filters.recentActiveDays != null) {
      arr = arr.filter(c => c.active30 >= filters.recentActiveDays);
    }

    // ストリーク
    if (filters.currentStreakMin != null) {
      arr = arr.filter(c => c.streakCurrent >= filters.currentStreakMin);
    }
    if (filters.maxStreakMin != null) {
      arr = arr.filter(c => c.streakMax >= filters.maxStreakMin);
    }

    // 学年/地域/公開
    if (filters.grade) arr = arr.filter(c => c.grade === filters.grade);
    if (filters.region) arr = arr.filter(c => c.region === filters.region);
    if (filters.visibility) arr = arr.filter(c => c.visibility === filters.visibility);

    // ソート
    switch (filters.sort) {
      case "現在ストリーク（降順）":
        arr.sort((a,b)=> b.streakCurrent - a.streakCurrent); break;
      case "最終記録日時":
        arr.sort((a,b)=> new Date(b.lastRecordAt) - new Date(a.lastRecordAt)); break;
      case "新着":
        arr.sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt)); break;
      default: // 直近アクティブ度
        arr.sort((a,b)=> b.active7 - a.active7 || b.active30 - a.active30);
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

  const onProfile = (c) => alert(`${c.name} の公開プロフィールへ（後でリンク接続）`);
  const onScout   = (c) => alert(`${c.name} へスカウト作成へ（後で遷移）`);
  const onToggleFav = (c) => {
    // ダミー：本来はサーバ更新
    const i = allCandidates.findIndex(x=>x.id===c.id);
    if (i>=0) { allCandidates[i].fav = !allCandidates[i].fav; }
    setPage(page=>page); // 再描画
  };

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
