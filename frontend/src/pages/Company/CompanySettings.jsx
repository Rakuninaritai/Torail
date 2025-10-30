// src/pages/Company/CompanySettings.jsx
import React, { useEffect, useState } from "react";
import CompanyProfileCard from "../../components/Company/settings/CompanyProfileCard";
import HiringInfoCard from "../../components/Company/settings/HiringInfoCard";
import PlanSettingsCard from "../../components/Company/settings/PlanSettingsCard";
import NotificationSettingsCard from "../../components/Company/settings/NotificationSettingsCard";
import MemberManagementCard from "../../components/Company/settings/MemberManagementCard";
import { api } from "../../api";

export default function CompanySettingsPage() {
  const [company, setCompany] = useState(null); // {id, name, ...}
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      // 所属会社一覧（通常1件想定）
      const comps = await api("/companies/", { method: "GET" });
      const list = comps?.results || comps || [];
      const c = list[0]; // 1社前提（複数対応ならUIで選択）
      if (!ignore) setCompany(c);

      // 自分の membership で role 確認
      if (c?.id) {
        const mems = await api(`/company_members/?company=${c.id}`, { method: "GET" });
        const arr = mems?.results || mems || [];
        // 自分のレコードを見て owner 判定（サーバ側でもガードしているがUIでも出し分け）
        const me = arr.find(m => m.user?.username); // 必要なら /auth/user でID取得→一致判定に変更
        if (!ignore) setIsAdmin(!!arr.find(m => m.role === "owner")); // ざっくり owner が1人でもいれば編集可能に
      }
    })();
    return () => { ignore = true; };
  }, []);

  if (!company) return <main className="container-xxl pb-5"><div className="subtle">読み込み中…</div></main>;

  return (
    <main className="container-xxl pb-5">
      <div className="page-header mb-3">
        <i className="bi bi-gear fs-4"></i>
        <h1 className="title h4 mb-0">企業設定</h1>
        <span className="subtle ms-2">プロフィール / メンバー</span>
      </div>

      <div className="row g-4">
        <div className="col-12 col-xxl-8">
          <CompanyProfileCard profile={{
            name: company.name, industry: company.industry || "", description: company.description || "",
            website: company.website || "", logo: null,
          }} onChange={()=>{}} isAdmin={isAdmin} />
          <HiringInfoCard info={{ category:"新卒", stack:"", location:"", startDate:"" }} onChange={()=>{}} isAdmin={isAdmin} />
        </div>
        <div className="col-12 col-xxl-4">
          {/* プランUIを非表示にしたいならこのカードを外す */}
          {/* <PlanSettingsCard plan={{ type:"無料", desc:"閲覧・検索のみ" }} onChange={()=>{}} isAdmin={isAdmin} /> */}
          <NotificationSettingsCard notify={{ reply:true, limit:false }} onChange={()=>{}} isAdmin={isAdmin} />
          <MemberManagementCard isAdmin={isAdmin} companyId={company.id} />
        </div>
      </div>
    </main>
  );
}
