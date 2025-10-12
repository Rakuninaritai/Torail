import React, { useState } from "react";

export default function PlanSettingsCard({ plan, onChange, isAdmin }) {
  const [showModal, setShowModal] = useState(false);

  const handleChangePlan = (type) => {
    const newPlan = type === "有料"
      ? { type: "有料", desc: "スカウト送信可 / 上限50通" }
      : { type: "無料", desc: "閲覧・検索のみ" };
    onChange(newPlan);
    setShowModal(false);
  };

  return (
    <div className="torail-card mb-4">
      <h6 className="mb-2">プラン & 支払い</h6>
      <div className="d-flex align-items-center gap-2 mb-2">
        <span className={`badge ${plan.type === "有料" ? "text-bg-primary" : "text-bg-light"}`}>{plan.type}</span>
        <span className="subtle">{plan.desc}</span>
      </div>
      {isAdmin && (
        <div className="d-grid gap-2 mt-2">
          <button className="btn btn-primary btn-sm" onClick={()=>setShowModal(true)}>
            <i className="bi bi-lightning"></i> プラン変更
          </button>
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop d-flex align-items-center justify-content-center" style={{position:"fixed",inset:0,zIndex:1050,background:"rgba(0,0,0,.35)"}}>
          <div className="modal-content p-3" style={{maxWidth:"500px",borderRadius:"12px",background:"#fff"}}>
            <h5 className="mb-3">プラン比較</h5>
            <table className="table table-bordered">
              <thead>
                <tr><th></th><th>無料</th><th>有料</th></tr>
              </thead>
              <tbody>
                <tr><td>検索・閲覧</td><td>✓</td><td>✓</td></tr>
                <tr><td>スカウト送信</td><td>-</td><td>✓ (50通/月)</td></tr>
                <tr><td>SNSリンク閲覧</td><td>-</td><td>✓</td></tr>
              </tbody>
            </table>
            <div className="d-flex justify-content-end gap-2 mt-3">
              <button className="btn btn-outline-secondary" onClick={()=>setShowModal(false)}>閉じる</button>
              <button className="btn btn-light" onClick={()=>handleChangePlan("無料")}>無料プランにする</button>
              <button className="btn btn-primary" onClick={()=>handleChangePlan("有料")}>有料プランにする</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
