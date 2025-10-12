import React, { useState } from "react";
import EditToolbar from "./EditToolbar";

function EmptyPortfolio() {
  return { title:"", stack:"", desc:"", links:[] };
}

export default function PortfolioListCard({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [draft, setDraft] = useState(value);
  const set = (idx, k, v)=> setDraft(list => list.map((it,i)=> i===idx ? ({...it,[k]:v}) : it));
  const add = ()=> setDraft(list => [...list, EmptyPortfolio()]);
  const del = (idx)=> setDraft(list => list.filter((_,i)=>i!==idx));

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r=>setTimeout(r,400));
    onChange?.(draft);
    setSaving(false);
    setEditing(false);
  };

  return (
    <div className="torail-card mb-4">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <h6 className="mb-0">ポートフォリオ</h6>
        <div className="d-flex align-items-center gap-2">
          {editing && <button className="btn btn-outline-secondary btn-sm" onClick={add}><i className="bi bi-plus" /> 追加</button>}
          <EditToolbar editing={editing} onEdit={()=>{setDraft(value); setEditing(true);}} onCancel={()=>{setDraft(value); setEditing(false);}} onSave={handleSave} saving={saving}/>
        </div>
      </div>
      <div className="row g-3">
        {draft.map((item, i) => (
          <div key={i} className="col-12 col-md-6">
            <div className="portfolio-card h-100 d-flex flex-column">
              <div className="d-flex align-items-center justify-content-between">
                {editing ? (
                  <input className="form-control form-control-sm" value={item.title} onChange={e=>set(i,"title",e.target.value)} placeholder="タイトル"/>
                ) : <strong>{item.title||"無題"}</strong>}
                {editing ? (
                  <input className="form-control form-control-sm" style={{maxWidth:220}} value={item.stack} onChange={e=>set(i,"stack",e.target.value)} placeholder="技術スタック"/>
                ) : <span className="badge text-bg-light">{item.stack}</span>}
              </div>
              <div className="subtle mt-2 flex-grow-1">
                {editing ? (
                  <textarea className="form-control" rows={3} value={item.desc} onChange={e=>set(i,"desc", e.target.value)} placeholder="概要" />
                ) : (item.desc || <span className="text-muted">（概要なし）</span>)}
              </div>

              {/* リンク群（簡易） */}
              <div className="mt-2 d-flex flex-wrap gap-2">
                {(item.links||[]).map((l, j) => (
                  <a key={j} href={editing? "#!" : l.url} className={`btn btn-sm ${editing ? "btn-outline-secondary disabled" : "btn-outline-secondary"}`} target="_blank" rel="noreferrer">
                    <i className={`bi ${l.icon||"bi-link-45deg"}`} /> {l.label||"Link"}
                  </a>
                ))}
                {editing && (
                  <button className="btn btn-outline-secondary btn-sm" onClick={()=>set(i,"links",[...(item.links||[]), { url:"#", icon:"bi-link-45deg", label:"Link" }])}>
                    <i className="bi bi-plus" /> リンク追加
                  </button>
                )}
              </div>

              {editing && (
                <div className="mt-2 text-end">
                  <button className="btn btn-outline-danger btn-sm" onClick={()=>del(i)}>
                    <i className="bi bi-trash" /> 削除
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {draft.length===0 && <div className="text-muted">まだポートフォリオがありません</div>}
      </div>
    </div>
  );
}
