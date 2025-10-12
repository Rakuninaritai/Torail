import React, { useState } from "react";

function Modal({ open, onClose, children, title="SNSを追加" }) {
  if (!open) return null;
  return (
    <div className="lmp-backdrop" onClick={(e)=>{ if(e.target.classList.contains("lmp-backdrop")) onClose?.(); }}>
      <div className="lmp-modal" role="dialog" aria-modal="true">
        <div className="lmp-modal-head">
          <strong>{title}</strong>
          <button className="btn-close" onClick={onClose} />
        </div>
        <div className="p-3">{children}</div>
      </div>
    </div>
  );
}

export default function SnsListCard({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ label:"GitHub", url:"", icon:"bi-github" });

  const remove = (idx)=> onChange?.(value.filter((_,i)=>i!==idx));

  const add = ()=> {
    if (!draft.url) return;
    onChange?.([...(value||[]), draft]);
    setOpen(false);
    setDraft({ label:"GitHub", url:"", icon:"bi-github" });
  };

  return (
    <div className="torail-card">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <h6 className="mb-0">SNS</h6>
        <button className="btn btn-outline-secondary btn-sm" onClick={()=>setOpen(true)}>
          <i className="bi bi-plus" /> 追加
        </button>
      </div>
      <div className="d-flex align-items-center gap-2 flex-wrap">
        {(value||[]).map((s, i) => (
          <div key={i} className="d-flex align-items-center gap-1">
            <a className="sns-btn" href={s.url} target="_blank" rel="noreferrer" title={s.label}>
              <i className={`bi ${s.icon}`} />
            </a>
            <button className="btn btn-outline-danger btn-sm" onClick={()=>remove(i)}>
              <i className="bi bi-x"></i>
            </button>
          </div>
        ))}
        {(!value || value.length===0) && <span className="text-muted">まだSNSがありません</span>}
      </div>

      <Modal open={open} onClose={()=>setOpen(false)} title="SNSを追加">
        <div className="row g-3">
          <div className="col-12 col-md-6">
            <label className="form-label">名前</label>
            <input className="form-control" value={draft.label} onChange={e=>setDraft(d=>({...d,label:e.target.value}))}/>
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label">アイコン（Bootstrap Icons）</label>
            <input className="form-control" value={draft.icon} onChange={e=>setDraft(d=>({...d,icon:e.target.value}))} placeholder="bi-github など" />
          </div>
          <div className="col-12">
            <label className="form-label">URL</label>
            <input className="form-control" value={draft.url} onChange={e=>setDraft(d=>({...d,url:e.target.value}))} placeholder="https://..." />
          </div>
          <div className="d-flex justify-content-end gap-2">
            <button className="btn btn-outline-secondary" onClick={()=>setOpen(false)}>キャンセル</button>
            <button className="btn btn-primary" onClick={add}><i className="bi bi-plus" /> 追加</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
