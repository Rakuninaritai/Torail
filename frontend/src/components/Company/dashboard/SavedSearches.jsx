import React from "react";
import "./companydash.css";

export default function SavedSearches({ items, onRemove, plan }) {
  return (
    <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
      {items.map((s, idx)=>(
        <span key={idx} className="saved-search-pill">
          保存条件: <strong>{s.name}</strong>
          <button className="btn btn-link btn-sm ms-2 p-0 align-baseline" onClick={()=>onRemove?.(idx)}>
            <i className="bi bi-x"></i>
          </button>
        </span>
      ))}
      <span className="ms-auto subtle">
        プラン: <strong>{plan.type}</strong>（{plan.note}）
      </span>
    </div>
  );
}
