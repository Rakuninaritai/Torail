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
          {/* プラン別のスカウトボタン制御
              - plan が null: 読込中のため disabled
              - plan.plan_type が 'free': 無料プラン → アラートを表示
              - plan.plan_type が 'pro' または 'enterprise': 有料 → スカウト送信可能
              - plan.remaining が 0 以下: 上限到達 → 送信不可
          */}
          {!plan ? (
            <button className="btn btn-primary btn-sm" disabled><i className="bi bi-send" /> 読込中...</button>
          ) : plan.plan_type === "free" ? (
            <button className="btn btn-primary btn-sm" onClick={()=>alert("無料プランではDM送信はできません。プラン設定をご確認ください。")}><i className="bi bi-send" /> DM送信</button>
          ) : plan.remaining !== undefined && plan.remaining <= 0 ? (
            <button className="btn btn-primary btn-sm" onClick={()=>alert("送信可能な残り件数がありません。プランを確認してください。")} disabled><i className="bi bi-send" /> DM送信</button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={()=>onScout?.(data)}><i className="bi bi-send" /> DM送信</button>
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
