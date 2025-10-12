import React, { useEffect, useState } from "react";
import "./user-cards.css";

const ICON_MAP = {
  github: "bi-github",
  x: "bi-twitter-x",
  qiita: "bi-journal-code",
  portfolio: "bi-link-45deg",
  other: "bi-link-45deg",
};

export default function SnsAddModal({ open, onClose, onSubmit }) {
  const [form, setForm] = useState({ label: "GitHub", type: "github", url: "" });
  const icon = ICON_MAP[form.type] || ICON_MAP.other;

  useEffect(() => {
    if (open) setForm({ label: "GitHub", type: "github", url: "" });
  }, [open]);

  const validUrl = (u) => /^https?:\/\//i.test(u || "");
  const canSubmit = form.label.trim() && validUrl(form.url);

  if (!open) return null;

  return (
    <div className="dlg-backdrop" role="dialog" aria-modal="true"
         onClick={(e)=>{ if(e.target.classList.contains("dlg-backdrop")) onClose?.(); }}>
      <div className="dlg-card">
        <div className="dlg-head">
          <strong>SNSリンクを追加</strong>
          <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
        </div>

        <div className="dlg-body">
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <label className="form-label">種類</label>
              <select className="form-select" value={form.type}
                      onChange={(e)=>setForm(f=>({ ...f, type: e.target.value }))}>
                <option value="github">GitHub</option>
                <option value="x">X（旧Twitter）</option>
                <option value="qiita">Qiita / Zenn</option>
                <option value="portfolio">ポートフォリオ</option>
                <option value="other">その他</option>
              </select>
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label">表示名</label>
              <input className="form-control" placeholder="例: GitHub"
                     value={form.label}
                     onChange={(e)=>setForm(f=>({ ...f, label: e.target.value }))}/>
            </div>
            <div className="col-12">
              <label className="form-label">URL</label>
              <input className="form-control" placeholder="https://..."
                     value={form.url}
                     onChange={(e)=>setForm(f=>({ ...f, url: e.target.value }))}/>
              {!validUrl(form.url) && form.url && (
                <div className="form-text text-danger">http(s):// から始まるURLを入力してください</div>
              )}
            </div>
          </div>

          <div className="mt-3 d-flex align-items-center gap-2">
            <span className="subtle">プレビュー:</span>
            <span className="sns-btn"><i className={`bi ${icon}`} /></span>
            <span>{form.label}</span>
          </div>
        </div>

        <div className="dlg-foot">
          <button className="btn btn-secondary" onClick={onClose}>キャンセル</button>
          <button className="btn btn-primary" disabled={!canSubmit}
                  onClick={()=>{ onSubmit?.({ label: form.label.trim(), url: form.url.trim(), icon }); onClose?.(); }}>
            追加
          </button>
        </div>
      </div>
    </div>
  );
}
