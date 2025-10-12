import React from "react";
import "./companydash.css";

const LANGS = ["Python","JavaScript","TypeScript","Java","Go","C"];

export default function FiltersBar({ value, onChange, onSaveCond }) {
  const v = value;
  const set = (k, val) => onChange?.({ ...v, [k]: val });

  const toggleLang = (lang) => {
    const s = new Set(v.languages);
    s.has(lang) ? s.delete(lang) : s.add(lang);
    set("languages", [...s]);
  };

  return (
    <section className="torail-card mb-3">
      <div className="row g-3 align-items-end">
        <div className="col-12 col-xxl-4">
          <label className="form-label">言語（複数選択）</label>
          <div className="lstack">
            {LANGS.map(l => (
              <button
                key={l}
                type="button"
                className={`chip-btn ${v.languages.includes(l) ? "is-on" : ""}`}
                onClick={()=>toggleLang(l)}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="form-hint">クリックでON/OFF（複数可）</div>
        </div>

        <div className="col-6 col-md-2">
          <label className="form-label">直近N日稼働≧</label>
          <input type="number" className="form-control" placeholder="例: 14"
                 value={v.recentActiveDays ?? ""} min={0}
                 onChange={(e)=>set("recentActiveDays", e.target.value ? Number(e.target.value) : null)} />
        </div>

        <div className="col-6 col-md-2">
          <label className="form-label">現在ストリーク≧</label>
          <input type="number" className="form-control" placeholder="例: 3"
                 value={v.currentStreakMin ?? ""} min={0}
                 onChange={(e)=>set("currentStreakMin", e.target.value ? Number(e.target.value) : null)} />
        </div>

        <div className="col-6 col-md-2">
          <label className="form-label">最長ストリーク≧</label>
          <input type="number" className="form-control" placeholder="例: 10"
                 value={v.maxStreakMin ?? ""} min={0}
                 onChange={(e)=>set("maxStreakMin", e.target.value ? Number(e.target.value) : null)} />
        </div>

        <div className="col-6 col-md-2">
          <label className="form-label">学年</label>
          <select className="form-select" value={v.grade} onChange={(e)=>set("grade", e.target.value)}>
            <option value="">指定なし</option>
            <option>1年</option><option>2年</option><option>3年</option><option>4年</option>
          </select>
        </div>

        <div className="col-6 col-md-2">
          <label className="form-label">地域</label>
          <select className="form-select" value={v.region} onChange={(e)=>set("region", e.target.value)}>
            <option value="">指定なし</option>
            <option>東海</option><option>関東</option><option>関西</option><option>九州</option>
          </select>
        </div>

        <div className="col-6 col-md-2">
          <label className="form-label">公開ステータス</label>
          <select className="form-select" value={v.visibility} onChange={(e)=>set("visibility", e.target.value)}>
            <option value="">すべて</option>
            <option>企業のみ</option>
            <option>全体公開</option>
            <option>非公開</option>
          </select>
        </div>

        <div className="col-6 col-md-2">
          <label className="form-label">ソート</label>
          <select className="form-select" value={v.sort} onChange={(e)=>set("sort", e.target.value)}>
            <option>直近アクティブ度</option>
            <option>現在ストリーク（降順）</option>
            <option>最終記録日時</option>
            <option>新着</option>
          </select>
        </div>

        <div className="col-12 col-md-4 d-flex gap-2">
          <button className="btn btn-primary flex-grow-1" onClick={()=>onChange?.({...v})}>
            <i className="bi bi-funnel"></i> 絞り込む
          </button>
          <button className="btn btn-outline-secondary" onClick={onSaveCond}>
            <i className="bi bi-save"></i> 条件保存
          </button>
        </div>
      </div>
    </section>
  );
}
