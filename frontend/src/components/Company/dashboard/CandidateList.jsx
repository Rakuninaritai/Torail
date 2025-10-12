import React from "react";
import CandidateCard from "./CandidateCard";

export default function CandidateList({ items, plan, onProfile, onScout, onToggleFav, page, pageSize, onPage }) {
  const start = (page-1)*pageSize;
  const view = items.slice(start, start+pageSize);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total/pageSize));

  return (
    <>
      <div className="row g-3">
        {view.map(c=>(
          <div key={c.id} className="col-12 col-lg-6">
            <CandidateCard data={c} plan={plan} onProfile={onProfile} onScout={onScout} onToggleFav={onToggleFav}/>
          </div>
        ))}
        {view.length===0 && (
          <div className="empty">条件に一致する候補者がいません</div>
        )}
      </div>

      <div className="d-flex align-items-center justify-content-between mt-3">
        <div className="subtle">全 {total} 件 / {total ? `${start+1}-${Math.min(start+pageSize,total)}`:"0"} を表示</div>
        <ul className="pagination pagination-sm mb-0">
          <li className={`page-item ${page===1?"disabled":""}`}>
            <button className="page-link" onClick={()=>onPage?.(Math.max(1,page-1))}>«</button>
          </li>
          {Array.from({length: totalPages}).slice(0,5).map((_,i)=>{
            const p = i+1;
            return (
              <li key={p} className={`page-item ${page===p?"active":""}`}>
                <button className="page-link" onClick={()=>onPage?.(p)}>{p}</button>
              </li>
            );
          })}
          <li className={`page-item ${page===totalPages?"disabled":""}`}>
            <button className="page-link" onClick={()=>onPage?.(Math.min(totalPages,page+1))}>»</button>
          </li>
        </ul>
      </div>
    </>
  );
}
