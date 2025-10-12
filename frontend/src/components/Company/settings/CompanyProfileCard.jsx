import React, { useState } from "react";

export default function CompanyProfileCard({ profile, onChange, isAdmin }) {
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(profile);

  const handleSave = () => {
    onChange(draft);
    setEdit(false);
  };

  return (
    <div className="torail-card mb-4">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="mb-0">会社情報</h6>
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
          <label className="form-label">会社名 *</label>
          <input className="form-control" value={edit ? draft.name : profile.name}
                 readOnly={!edit} onChange={(e)=>setDraft({...draft,name:e.target.value})}/>
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">業種</label>
          <input className="form-control" value={edit ? draft.industry : profile.industry}
                 readOnly={!edit} onChange={(e)=>setDraft({...draft,industry:e.target.value})}/>
        </div>
        <div className="col-12">
          <label className="form-label">事業内容</label>
          <textarea className="form-control" rows="3"
                    value={edit ? draft.description : profile.description}
                    readOnly={!edit}
                    onChange={(e)=>setDraft({...draft,description:e.target.value})}/>
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">公式サイトURL</label>
          <input className="form-control" value={edit ? draft.website : profile.website}
                 readOnly={!edit} onChange={(e)=>setDraft({...draft,website:e.target.value})}/>
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">ロゴ</label>
          {edit ? (
            <input type="file" className="form-control"
                   onChange={(e)=>setDraft({...draft,logo:e.target.files[0]})}/>
          ) : (
            <div className="subtle">{profile.logo ? "アップロード済" : "未設定"}</div>
          )}
        </div>
      </div>
    </div>
  );
}
