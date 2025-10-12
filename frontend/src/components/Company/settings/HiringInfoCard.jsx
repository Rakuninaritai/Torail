import React, { useState } from "react";

export default function HiringInfoCard({ info, onChange, isAdmin }) {
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(info);

  const handleSave = () => {
    onChange(draft);
    setEdit(false);
  };

  return (
    <div className="torail-card mb-4">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="mb-0">採用情報</h6>
        {isAdmin && (
          <div>
            {edit ? (
              <>
                <button className="btn btn-sm btn-outline-secondary me-2" onClick={() => setEdit(false)}>キャンセル</button>
                <button className="btn btn-sm btn-primary" onClick={handleSave}>保存</button>
              </>
            ) : (
              <button className="btn btn-sm btn-outline-secondary" onClick={() => setEdit(true)}>編集</button>
            )}
          </div>
        )}
      </div>
      <div className="row g-3">
        <div className="col-12 col-md-6">
          <label className="form-label">募集区分</label>
          {edit ? (
            <select className="form-select" value={draft.category} onChange={(e)=>setDraft({...draft,category:e.target.value})}>
              <option>新卒</option>
              <option>インターン</option>
              <option>中途</option>
            </select>
          ) : <input className="form-control" value={info.category} readOnly />}
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">主要技術スタック</label>
          <input className="form-control" value={edit ? draft.stack : info.stack}
                 readOnly={!edit} onChange={(e)=>setDraft({...draft,stack:e.target.value})}/>
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">勤務地</label>
          <input className="form-control" value={edit ? draft.location : info.location}
                 readOnly={!edit} onChange={(e)=>setDraft({...draft,location:e.target.value})}/>
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">稼働開始可能時期</label>
          <input className="form-control" value={edit ? draft.startDate : info.startDate}
                 readOnly={!edit} onChange={(e)=>setDraft({...draft,startDate:e.target.value})}/>
        </div>
      </div>
    </div>
  );
}
