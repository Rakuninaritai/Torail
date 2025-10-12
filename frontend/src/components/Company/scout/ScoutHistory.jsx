import React from "react";
import ScoutList from "./ScoutList";
import ScoutDetail from "./ScoutDetail";

export default function ScoutHistory({
  conversations,
  selectedId,
  setSelectedId,
  filter,
  setFilter,
  query,
  setQuery,
  selected,
  onUpdateStatus,
  onReply,
  templates,
}) {
  const counts = {
    未読: conversations.filter((c) => c.status === "未読").length,
    既読: conversations.filter((c) => c.status === "既読").length,
    返信あり: conversations.filter((c) => c.status === "返信あり").length,
    辞退: conversations.filter((c) => c.status === "辞退").length,
  };

  return (
    <div className="row h-100 g-3">
      {/* 左ペイン */}
      <div className="col-12 col-md-4 h-100 d-flex flex-column">
        <input
          className="form-control mb-2"
          placeholder="検索（名前・件名）"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="btn-group mb-2 flex-wrap">
          {["all", "未読", "既読", "返信あり", "辞退"].map((f) => (
            <button
              key={f}
              className={`btn btn-sm ${
                filter === f ? "btn-primary" : "btn-outline-secondary"
              }`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "すべて" : f}
              {f !== "all" && counts[f] > 0 && (
                <span className="badge bg-light text-dark ms-1">{counts[f]}</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex-grow-1 overflow-auto">
          <ScoutList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={setSelectedId}
            filter={filter}
            query={query}
          />
        </div>
      </div>

      {/* 右ペイン */}
      <div className="col-12 col-md-8 h-100">
        <ScoutDetail
          conversation={selected}
          onUpdateStatus={onUpdateStatus}
          onReply={onReply}
          templates={templates}
        />
      </div>
    </div>
  );
}
