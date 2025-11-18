import { useEffect, useState } from "react";
import { api } from "../../api";
import CompanyProfileCard from "../../components/Company/settings/CompanyProfileCard";
import HiringInfoCard from "../../components/Company/settings/HiringInfoCard";
import PlanSettingsCard from "../../components/Company/settings/PlanSettingsCard";
import NotificationSettingsCard from "../../components/Company/settings/NotificationSettingsCard";
import MemberManagementCard from "../../components/Company/settings/MemberManagementCard";
// src/pages/Company/CompanySettings.jsx
export default function CompanySettingsPage() {
  const [company, setCompany] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [slug, setSlug] = useState("");
  const [plans, setPlans] = useState([]);
  const [newPlan, setNewPlan] = useState({ plan_type:"free", monthly_quota:50, price_jpy:0, active_from:"" });

  useEffect(() => {
    let ignore = false;
    (async () => {
      try{
        const comps = await api("/companies/", { method: "GET" });
        const list = comps?.results || comps || [];
        const c = list[0];
        if (!ignore) {
          setCompany(c);
          setSlug(c?.slug || "");
        }
        if (c?.id) {
          const mems = await api(`/company_members/?company=${c.id}`, { method: "GET" });
          const arr = mems?.results || mems || [];
          if (!ignore) setIsAdmin(!!arr.find(m => m.role === "owner"));

          const pls = await api(`/company_plans/?company=${c.id}`, { method:"GET" });
          if (!ignore) setPlans(pls?.results || pls || []);
        }
      }catch(e){ if (!ignore) setCompany(null); }
    })();
    return () => { ignore = true; };
  }, []);

  const saveSlug = async () => {
    if (!company) return;
    try {
      setSaving(true);
      const updated = await api(`/companies/${company.id}/`, {
        method:"PATCH",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ slug })
      });
      setCompany(updated);
      // 成功トースト
      // toast.success("保存しました")
      alert("保存しました");
    } catch(e) {
      alert(e?.response?.data?.slug?.[0] || "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const createPlan = async () => {
    if (!company) return;
    try{
      const body = { ...newPlan, company: company.id };
      const res = await api(`/company_plans/`, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify(body)
      });
      setPlans(prev => [res, ...prev]);
    }catch(e){
      alert("プラン作成に失敗しました");
    }
  };

  if (!company) return <main className="container-xxl pb-5"><div className="subtle">読み込み中…</div></main>;

  const publicUrl = `/company/public/${company.slug || ""}`; // ← フロントの公開ページ（既にRouteあり）

  return (
    <main className="container-xxl pb-5">
      {/* 既存の見出しはそのまま */}
      <div className="row g-4">
        <div className="col-12 col-xxl-8">
          {/* 会社プロフィールカードは既存のまま */}
          <CompanyProfileCard
            profile={{
              name: company.name,
              industry: company.industry || "",
              description: company.description || "",
              website: company.website || "",
              logo: null,
            }}
            onChange={()=>{}}
            isAdmin={isAdmin}
          />

          {/* ★ 追加: slug 編集＋公開リンク */}
          <section className="torail-card mt-3">
            <h6 className="mb-2">公開設定（slug）</h6>
            <div className="row g-2 align-items-end">
              <div className="col-12 col-md-6">
                <label className="form-label">会社URLスラッグ（小文字英数とハイフン）</label>
                <input className="form-control"
                  value={slug}
                  onChange={e=>setSlug(e.target.value)}
                  disabled={!isAdmin || saving}
                  placeholder="例: torail-inc" />
              </div>
              <div className="col-12 col-md-3">
                <button className="btn btn-primary w-100" disabled={!isAdmin || saving} onClick={saveSlug}>
                  保存
                </button>
              </div>
              <div className="col-12">
                <div className="small text-muted">
                  公開ページ: <a href={publicUrl}>{publicUrl}</a>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="col-12 col-xxl-4">
          {/* 通知・メンバー 管理カードは既存 */}
          <NotificationSettingsCard notify={{ reply:true, limit:false }} onChange={()=>{}} isAdmin={isAdmin} />
          <MemberManagementCard isAdmin={isAdmin} companyId={company.id} />

          {/* ★ 追加: プラン簡易UI */}
          <section className="torail-card mt-3">
            <h6 className="mb-2">プラン</h6>
            <ul className="list-group mb-2">
              {plans.map(p=>(
                <li key={p.id} className="list-group-item d-flex justify-content-between align-items-center">
                  <span>{p.plan_type}（{p.monthly_quota}件/月）</span>
                  <span className="text-muted small">{p.active_from}〜{p.active_to||"—"}</span>
                </li>
              ))}
              {plans.length===0 && <li className="list-group-item text-muted">未設定</li>}
            </ul>
            <div className="row g-2">
              <div className="col-6">
                <select className="form-select" value={newPlan.plan_type}
                  onChange={e=>setNewPlan({...newPlan, plan_type:e.target.value})}>
                  <option value="free">無料</option>
                  <option value="pro">有料</option>
                  <option value="enterprise">エンタープライズ</option>
                </select>
              </div>
              <div className="col-6">
                <input className="form-control" type="date"
                  value={newPlan.active_from}
                  onChange={e=>setNewPlan({...newPlan, active_from:e.target.value})}
                  placeholder="開始日" />
              </div>
              <div className="col-6">
                <input className="form-control" type="number" min={0}
                  value={newPlan.monthly_quota}
                  onChange={e=>setNewPlan({...newPlan, monthly_quota:Number(e.target.value)})}
                  placeholder="上限" />
              </div>
              <div className="col-6">
                <input className="form-control" type="number" min={0}
                  value={newPlan.price_jpy}
                  onChange={e=>setNewPlan({...newPlan, price_jpy:Number(e.target.value)})}
                  placeholder="価格(円)" />
              </div>
              <div className="col-12">
                <button className="btn btn-outline-primary w-100" onClick={createPlan}>プランを追加</button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
