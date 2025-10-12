import React from "react";
import StatusBadge from "./StatusBadge";
import "./scoutbox.css";

export default function ScoutList({ items, onPick, quickFilter, setQuickFilter }) {
  const unread = items.filter(x=>x.status==="未読").length;
  const thisMonth = items.length; // ダミー

  return (
    <section className="torail-card list-condensed">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="d-flex align-items-center gap-2">
          <span className="chip">未読 <strong>{unread}</strong></span>
          <span className="chip">今月 <strong>{thisMonth}</strong></span>
        </div>
        <div className="btn-group btn-group-sm" role="group" aria-label="filters">
          {["すべて","未読","返信あり"].map(lbl=>(
            <button
              key={lbl}
              className={`btn btn-outline-secondary ${quickFilter===lbl ? "active":""}`}
              onClick={()=>setQuickFilter(lbl)}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      <div className="list-group list-group-flush">
        {items.map((it)=>(
          <button
            key={it.id}
            className="list-group-item list-group-item-action d-flex align-items-start gap-3 text-start"
            onClick={()=>onPick?.(it)}
          >
            <div className="pt-1">
              <span className={`status-dot ${{
                "未読":"status-unread","既読":"status-read","返信あり":"status-replied","辞退":"status-declined"
              }[it.status]||"status-read"}`} />
            </div>
            <div className="flex-grow-1">
              <div className="d-flex align-items-center justify-content-between">
                <div className="fw-bold">
                  {it.company} <span className="ms-2"><StatusBadge status={it.status} /></span>
                </div>
                <div className="subtle small">{it.sentAt}</div>
              </div>
              <div className="subtle">件名: {it.subject}</div>
              <div className="msg-snippet">{it.snippet}</div>
              <div className="mt-1 d-flex gap-2">
                {it.tags?.map(t=> <span key={t} className="badge text-bg-light">{t}</span>)}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="d-flex align-items-center justify-content-between mt-3">
        <div className="subtle">全 {items.length} 件 / 1–{Math.min(items.length,10)} を表示</div>
        <ul className="pagination pagination-sm mb-0">
          <li className="page-item disabled"><span className="page-link">«</span></li>
          <li className="page-item active"><span className="page-link">1</span></li>
          <li className="page-item"><a className="page-link" href="#!">2</a></li>
          <li className="page-item"><a className="page-link" href="#!">»</a></li>
        </ul>
      </div>
    </section>
  );
}
