import React from "react";

export default function NotificationSettingsCard({ notify, onChange, isAdmin }) {
  const toggle = (key) => onChange({ ...notify, [key]: !notify[key] });

  return (
    <div className="torail-card mb-4">
      <h6 className="mb-2">通知設定</h6>
      <div className="form-check form-switch">
        <input className="form-check-input" type="checkbox" checked={notify.reply}
               disabled={!isAdmin} onChange={()=>toggle("reply")}/>
        <label className="form-check-label">返信・辞退通知</label>
      </div>
      <div className="form-check form-switch">
        <input className="form-check-input" type="checkbox" checked={notify.limit}
               disabled={!isAdmin} onChange={()=>toggle("limit")}/>
        <label className="form-check-label">上限超過アラート</label>
      </div>
    </div>
  );
}
