import React from "react";
import StatusBadge from "./StatusBadge";
import "./scoutbox.css";

export default function DetailDrawer({ open, data, onClose, onReply, onDecline, onInsertTemplate }) {
  if (!open || !data) return null;

  return (
    <div className="drawer-backdrop" onClick={(e)=>{ if(e.target.classList.contains("drawer-backdrop")) onClose?.(); }}>
      <aside className="drawer">
        <div className="drawer-head">
          <div>
            <div className="d-flex align-items-center gap-2">
              <h5 className="mb-0">{data.company}</h5>
              <span><StatusBadge status={data.status} /></span>
            </div>
            <div className="subtle small">件名: {data.subject}</div>
          </div>
          <button className="btn-close" onClick={onClose} aria-label="閉じる" />
        </div>

        <div className="drawer-body">
          <div className="thread-msg">
            <div className="thread-meta mb-1">
              送信: {data.sentAt} / 差出人: <strong>{data.from || "採用担当"}</strong>
            </div>
            <div className="text-body">{data.body}</div>
            <div className="mt-2 d-flex gap-2 flex-wrap">
              {data.tags?.map(t=> <span className="chip" key={t}>{t}</span>)}
              {data.jobUrl && (
                <a href={data.jobUrl} className="btn btn-sm btn-outline-secondary" target="_blank" rel="noreferrer">
                  <i className="bi bi-link-45deg" /> 求人票
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="drawer-foot">
          <label className="form-label mb-1">返信</label>
          <textarea className="form-control mb-2" rows="5" placeholder="テンプレから挿入、または自由記述" id="replyBox" />
          <div className="d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-2">
              <select className="form-select form-select-sm" onChange={(e)=>onInsertTemplate?.(e.target.value)} style={{width:"auto"}}>
                <option value="">テンプレを選択</option>
                <option value="まずはカジュアルにご挨拶できれば嬉しいです。">まずはカジュアルに</option>
                <option value="詳細の業務内容と稼働条件についてお伺いしたいです。">詳細を伺いたい</option>
                <option value="今回は見送りとさせてください。機会があればまたお願いします。">今回は見送り</option>
              </select>
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-danger" onClick={onDecline}><i className="bi bi-x" /> 辞退</button>
              <button className="btn btn-primary" onClick={onReply}><i className="bi bi-reply" /> 返信する</button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
