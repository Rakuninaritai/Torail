import React, { useEffect, useState } from "react";

export default function TextAreaCard({ title, value, isOwner, onSave }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);

  return (
    <section className="torail-card mb-4">
      <div className="d-flex align-items-center justify-content-between">
        <h6 className="mb-0">{title}</h6>
        {isOwner && !editing && (
          <button className="btn btn-outline-secondary btn-sm" onClick={() => setEditing(true)}>
            <i className="bi bi-pencil" /> 編集
          </button>
        )}
        {isOwner && editing && (
          <div className="d-flex gap-2">
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>キャンセル</button>
            <button className="btn btn-primary btn-sm" onClick={() => { onSave?.(text); setEditing(false); }}>送信</button>
          </div>
        )}
      </div>
      {!editing ? (
        <p className="mt-2 mb-0 text-body">{value}</p>
      ) : (
        <textarea className="form-control mt-2" rows={4} value={text} onChange={(e) => setText(e.target.value)} />
      )}
    </section>
  );
}
