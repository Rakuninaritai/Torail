import React from "react";

export default function ScoutList({ conversations, selectedId, onSelect, filter, query }) {
  const filtered = conversations.filter((c) => {
    const matchQuery =
      !query ||
      c.toUser.includes(query) ||
      c.subject.includes(query) ||
      c.body.includes(query);
    const matchFilter = filter === "all" || c.status === filter;
    return matchQuery && matchFilter;
  });

  return (
    <div className="list-group">
      {filtered.length === 0 ? (
        <div className="text-muted p-2">該当するスカウトがありません</div>
      ) : (
        filtered.map((c) => (
          <button
            key={c.id}
            className={`list-group-item list-group-item-action ${
              selectedId === c.id ? "active" : ""
            }`}
            onClick={() => onSelect(c.id)}
            style={{ whiteSpace: "normal" }}
          >
            <div className="d-flex justify-content-between">
              <strong>{c.toUser}</strong>
              <small>{c.date}</small>
            </div>
            <div className="text-truncate small">{c.subject}</div>
            <span
              className={`badge mt-1 ${
                c.status === "返信あり"
                  ? "text-bg-success"
                  : c.status === "辞退"
                  ? "text-bg-secondary"
                  : c.status === "既読"
                  ? "text-bg-info"
                  : "text-bg-warning"
              }`}
            >
              {c.status}
            </span>
          </button>
        ))
      )}
    </div>
  );
}
