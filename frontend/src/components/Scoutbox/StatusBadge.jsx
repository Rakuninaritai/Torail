import React from "react";

export default function StatusBadge({ status }) {
  const map = {
    未読: { cls: "text-bg-warning", dot: "status-unread" },
    既読: { cls: "text-bg-secondary", dot: "status-read" },
    辞退: { cls: "text-bg-danger", dot: "status-declined" },
  };
  const m = map[status] || map["既読"];
  return (
    <>
      <span className={`status-dot ${m.dot}`} aria-hidden />
      <span className={`badge ms-2 ${m.cls}`}>{status}</span>
    </>
  );
}
