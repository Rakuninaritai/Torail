// src/pages/CompanySettingsPage.jsx
import React, { useState } from "react";
import CompanyProfileCard from "../../components/Company/settings/CompanyProfileCard";
import HiringInfoCard from "../../components/Company/settings/HiringInfoCard";
import PlanSettingsCard from "../../components/Company/settings/PlanSettingsCard";
import NotificationSettingsCard from "../../components/Company/settings/NotificationSettingsCard";
import MemberManagementCard from "../../components/Company/settings/MemberManagementCard";

export default function CompanySettingsPage({ isAdmin }) {
  const [profile, setProfile] = useState({
    name: "Torail株式会社",
    industry: "IT",
    description: "継続可視化サービス",
    website: "https://torail.app",
    logo: null,
  });
  const [hiring, setHiring] = useState({
    category: "新卒",
    stack: "Django / React",
    location: "名古屋 / フルリモート",
    startDate: "10月以降",
  });
  const [plan, setPlan] = useState({ type: "無料", desc: "閲覧・検索のみ" });
  const [notify, setNotify] = useState({ reply: true, limit: false });
  const [members, setMembers] = useState([
    { name: "佐藤", email: "sato@corp.example", role: "管理者" },
    { name: "田中", email: "tanaka@corp.example", role: "メンバー" },
  ]);

  return (
    <main className="container-xxl pb-5">
      <div className="page-header mb-3">
        <i className="bi bi-gear fs-4"></i>
        <h1 className="title h4 mb-0">企業設定</h1>
        <span className="subtle ms-2">プロフィール / プラン・支払い / メンバー / 通知</span>
      </div>

      <div className="row g-4">
        <div className="col-12 col-xxl-8">
          <CompanyProfileCard profile={profile} onChange={setProfile} isAdmin={isAdmin} />
          <HiringInfoCard info={hiring} onChange={setHiring} isAdmin={isAdmin} />
        </div>
        <div className="col-12 col-xxl-4">
          <PlanSettingsCard plan={plan} onChange={setPlan} isAdmin={isAdmin} />
          <NotificationSettingsCard notify={notify} onChange={setNotify} isAdmin={isAdmin} />
          <MemberManagementCard members={members} setMembers={setMembers} isAdmin={isAdmin} />
        </div>
      </div>
    </main>
  );
}
