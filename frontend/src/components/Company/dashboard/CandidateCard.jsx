import React from "react";
import "./companydash.css";

function Heatmap({ values = [] }) {
  // values: 長さ30、0〜4の強度
  return (
    <div className="heatmap" aria-label="直近30日の稼働">
      {Array.from({length:30}).map((_,i)=>{
        const v = values[i] ?? 0;
        const cls = v ? `on-${v}` : "";
        return <div key={i} className={`cell ${cls}`} />;
      })}
    </div>
  );
}

export default function CandidateCard({ data, plan, onProfile, onScout, onToggleFav }) {
  return (
    <div className="candidate-card torail-card h-100">
      <div className="d-flex align-items-center gap-3 mb-2">
        <span className="avatar" />
        <div>
          <div className="fw-bold">
            {data.name}
            <span className="subtle">・{data.school} {data.grade}</span>
          </div>
          <div className="subtle">
            現在ストリーク <strong>{data.streakCurrent}日</strong> ／ 最長 <strong>{data.streakMax}日</strong>
          </div>
        </div>
        <div className="ms-auto d-flex gap-2">
          <button className="btn btn-outline-secondary btn-sm" onClick={()=>onProfile?.(data)}><i className="bi bi-person-vcard" /> プロフィール</button>
          {plan.type === "有料" ? (
            <button className="btn btn-primary btn-sm" onClick={()=>onScout?.(data)}><i className="bi bi-send" /> スカウトへ</button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={()=>alert("無料プランではスカウト送信はできません。プラン設定をご確認ください。")}><i className="bi bi-send" /> スカウトへ</button>
          )}
          <button className="btn btn-outline-warning btn-sm" onClick={()=>onToggleFav?.(data)} aria-pressed={data.fav}>
            <i className={data.fav ? "bi bi-star-fill" : "bi bi-star"} />
          </button>
        </div>
      </div>

      <div className="mb-2">
        <div className="subtle mb-1">直近30日の稼働</div>
        <Heatmap values={data.heat} />
      </div>

      <div className="d-flex flex-wrap gap-2 align-items-center">
        <span className="badge text-bg-light">主要言語</span>
        {data.languages.slice(0,3).map((l,i)=>(
          <span key={i} className="badge text-bg-primary">{l}</span>
        ))}
      </div>
    </div>
  );
}
