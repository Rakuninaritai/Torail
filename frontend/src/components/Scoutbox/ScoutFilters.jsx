import React from "react";
import "./scoutbox.css";

export default function ScoutFilters({ value, onChange }) {
  const v = value;
  const set = (k, val) => onChange?.({ ...v, [k]: val });

  return (
    <section className="torail-card mb-3">
      <div className="toolbar row g-2 align-items-end">
        <div className="col-12 col-lg-4">
          <label className="form-label">キーワード</label>
          <div className="input-group">
            <span className="input-group-text"><i className="bi bi-search" /></span>
            <input
              className="form-control"
              placeholder="会社名・件名で検索"
              value={v.q}
              onChange={(e) => set("q", e.target.value)}
            />
          </div>
        </div>
        <div className="col-6 col-lg-2">
          <label className="form-label">状態</label>
          <select className="form-select" value={v.status} onChange={(e)=>set("status", e.target.value)}>
            <option>すべて</option>
            <option>未読</option>
            <option>既読</option>
            <option>返信あり</option>
            <option>辞退</option>
          </select>
        </div>
        <div className="col-6 col-lg-2">
          <label className="form-label">期間</label>
          <select className="form-select" value={v.range} onChange={(e)=>set("range", e.target.value)}>
            <option>指定なし</option>
            <option>7日</option>
            <option>30日</option>
            <option>90日</option>
          </select>
        </div>
        <div className="col-6 col-lg-2">
          <label className="form-label">ソート</label>
          <select className="form-select" value={v.sort} onChange={(e)=>set("sort", e.target.value)}>
            <option>新着</option>
            <option>未読優先</option>
            <option>企業名</option>
          </select>
        </div>
        <div className="col-6 col-lg-2 d-grid">
          <button className="btn btn-primary" onClick={()=>onChange?.({...v})}>
            <i className="bi bi-funnel" /> 絞り込む
          </button>
        </div>
      </div>
    </section>
  );
}
