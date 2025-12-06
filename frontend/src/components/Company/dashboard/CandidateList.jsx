import React from "react";
import CandidateCard from "./CandidateCard";

export default function CandidateList({ items, plan, onProfile, onScout, onToggleFav, page = 1, pageSize = 6, onPage, total: totalCount = 0 }) {
  // `items` は親コンポーネントで既にページング済みのリスト（現在ページ分）を受け取る想定。
  // ページングはサーバ側で行うため、ここでは items をそのまま表示し、
  // ページ数や件数表示は `totalCount`（サーバが返す総件数）を使う。
  const view = Array.isArray(items) ? items : [];
  const total = Number.isFinite(totalCount) ? totalCount : (view.length || 0);
  const curPage = Number.isFinite(Number(page)) ? Number(page) : 1;
  const curPageSize = Number.isFinite(Number(pageSize)) ? Number(pageSize) : 6;
  const start = total === 0 ? 0 : (curPage - 1) * curPageSize + 1;
  const end = Math.min(curPage * curPageSize, total);
  const totalPages = Math.max(1, Math.ceil(total / curPageSize));

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
        <div className="subtle">全 {total} 件 / {total ? `${start}-${end}`:"0"} を表示</div>
        <ul className="pagination pagination-sm mb-0">
          <li className={`page-item ${curPage===1?"disabled":""}`}>
            <button className="page-link" onClick={()=>onPage?.(Math.max(1, curPage-1))}>«</button>
          </li>
          {(() => {
            // 表示するページ番号のウィンドウ（最大5ページ）、現在ページを中心にする
            const maxWindow = 5;
            let startPage = Math.max(1, curPage - Math.floor(maxWindow/2));
            let endPage = Math.min(totalPages, startPage + maxWindow - 1);
            // end に合わせて start を再調整
            startPage = Math.max(1, Math.min(startPage, Math.max(1, endPage - maxWindow + 1)));
            const pages = [];
            for (let p = startPage; p <= endPage; p++) pages.push(p);
            return pages.map(p => (
              <li key={p} className={`page-item ${curPage===p?"active":""}`}>
                <button className="page-link" onClick={()=>onPage?.(p)}>{p}</button>
              </li>
            ));
          })()}
          <li className={`page-item ${curPage===totalPages?"disabled":""}`}>
            <button className="page-link" onClick={()=>onPage?.(Math.min(totalPages, curPage+1))}>»</button>
          </li>
        </ul>
      </div>
    </>
  );
}
