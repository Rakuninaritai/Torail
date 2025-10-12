import React, { useState } from "react";

export default function ScoutTemplates({ templates, onSave, onDelete }) {
  const [newName, setNewName] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");

  return (
    <div className="torail-card">
      <h6 className="mb-3">テンプレ管理</h6>
      {templates.map((t, i) => (
        <div key={i} className="border rounded p-2 mb-2">
          <div className="d-flex justify-content-between align-items-center">
            <strong>{t.name}</strong>
            <button
              className="btn btn-sm btn-outline-danger"
              onClick={() => onDelete(i)}
            >
              <i className="bi bi-trash"></i>
            </button>
          </div>
          <div className="small text-muted text-truncate">{t.subject}</div>
        </div>
      ))}

      <hr />
      <h6 className="mb-2">新規テンプレ追加</h6>
      <input
        className="form-control mb-2"
        placeholder="テンプレ名"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
      />
      <input
        className="form-control mb-2"
        placeholder="件名（{ユーザー名} 差し込み可）"
        value={newSubject}
        onChange={(e) => setNewSubject(e.target.value)}
      />
      <textarea
        className="form-control mb-2"
        placeholder="本文（{ユーザー名} 差し込み可）"
        rows="4"
        value={newBody}
        onChange={(e) => setNewBody(e.target.value)}
      />
      <div className="text-end">
        <button
          className="btn btn-outline-primary"
          onClick={() => {
            if (newName && newSubject && newBody) {
              onSave({ name: newName, subject: newSubject, body: newBody });
              setNewName("");
              setNewSubject("");
              setNewBody("");
            }
          }}
        >
          <i className="bi bi-plus-lg"></i> 追加
        </button>
      </div>
    </div>
  );
}
