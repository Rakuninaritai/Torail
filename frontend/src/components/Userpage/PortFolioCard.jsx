import React, { useState } from "react";

export default function PortfolioCard({ items, isOwner, onAdd, onRemove }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", tags: "", summary: "", url: "", git: "" });

  const add = () => {
    onAdd?.({
      title: form.title || "Untitled",
      tags: form.tags || "—",
      summary: form.summary || "",
      url: form.url || "",
      git: form.git || "",
    });
    setForm({ title: "", tags: "", summary: "", url: "", git: "" });
    setAdding(false);
  };

  return (
    <section className="torail-card mb-4">
      <div className="d-flex align-items-center justify-content-between">
        <h6 className="mb-0">ポートフォリオ</h6>
        {isOwner && !adding && (
          <button className="btn btn-outline-secondary btn-sm" onClick={() => setAdding(true)}>
            <i className="bi bi-plus-lg" /> 追加
          </button>
        )}
        {isOwner && adding && (
          <div className="d-flex gap-2">
            <button className="btn btn-secondary btn-sm" onClick={() => setAdding(false)}>キャンセル</button>
            <button className="btn btn-primary btn-sm" onClick={add}>送信</button>
          </div>
        )}
      </div>

      {adding && (
        <div className="row g-2 mt-2">
          <div className="col-12">
            <label className="form-label">タイトル</label>
            <input className="form-control" value={form.title} onChange={(e) => setForm((x) => ({ ...x, title: e.target.value }))} />
          </div>
          <div className="col-12">
            <label className="form-label">技術タグ（表示用）</label>
            <input className="form-control" value={form.tags} onChange={(e) => setForm((x) => ({ ...x, tags: e.target.value }))} />
          </div>
          <div className="col-12">
            <label className="form-label">概要</label>
            <textarea className="form-control" rows={3} value={form.summary} onChange={(e) => setForm((x) => ({ ...x, summary: e.target.value }))} />
          </div>
          <div className="col-6">
            <label className="form-label">URL</label>
            <input className="form-control" value={form.url} onChange={(e) => setForm((x) => ({ ...x, url: e.target.value }))} />
          </div>
            <div className="col-6">
            <label className="form-label">GitHub</label>
            <input className="form-control" value={form.git} onChange={(e) => setForm((x) => ({ ...x, git: e.target.value }))} />
          </div>
        </div>
      )}

      <div className="row g-3 mt-1">
        {items.map((it, idx) => (
          <div className="col-12 col-md-6" key={idx}>
            <div className="portfolio-card h-100 position-relative">
              {isOwner && (
                <button
                  type="button"
                  className="card-del"
                  title="削除"
                  aria-label="削除"
                  onClick={() => onRemove?.(idx)}
                >
                  <i className="bi bi-trash" />
                </button>
              )}

              <div className="d-flex align-items-center justify-content-between pe-4">
                <strong>{it.title}</strong>
                <span className="badge text-bg-light">{it.tags}</span>
              </div>
              <div className="subtle mt-1">{it.summary}</div>
              <div className="mt-2 d-flex gap-2">
                {it.url && (
                  <a href={it.url} className="btn btn-sm btn-outline-secondary" target="_blank" rel="noreferrer">
                    <i className="bi bi-link-45deg" /> URL
                  </a>
                )}
                {it.git && (
                  <a href={it.git} className="btn btn-sm btn-outline-secondary" target="_blank" rel="noreferrer">
                    <i className="bi bi-github" /> GitHub
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
