// src/components/LanguageModalPicker.jsx
import React, { useEffect, useState } from "react";
import "./LanguageModalPicker.css";

export default function LanguageModalPicker({
  languages = [],     // [{id, name}]
  value = [],         // 選択中ID配列
  onChange,           // (ids) => void
  disabled = false,
  buttonLabel = "言語を選ぶ",
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => { if (!open) setDraft(value); }, [open, value]);

  const toggle = (id) => {
    const s = new Set(draft);
    s.has(id) ? s.delete(id) : s.add(id);
    setDraft([...s]);
  };

  const commit = () => { onChange?.(draft); setOpen(false); };

  const summaryText = () => {
    if (!value?.length) return "未選択";
    const names = value
      .map(id => languages.find(l => l.id === id)?.name)
      .filter(Boolean);
    return names.slice(0, 3).join("、") + (names.length > 3 ? ` 他${names.length - 3}` : "");
  };

  return (
    <div className="lmp">
      {/* <label className="form-label d-block">{buttonLabel}</label> */}
      <div className="lmp-bar">
        <div className="lmp-chips">
          {value?.length
            ? value.map(id => {
                const n = languages.find(l => l.id === id)?.name || id;
                return <span key={id} className="lmp-chip">{n}</span>;
              })
            : <span className="text-muted">未選択</span>
          }
        </div>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={() => !disabled && setOpen(true)}
          disabled={disabled}
        >
          編集
        </button>
      </div>

      {!open ? null : (
        <div className="lmp-backdrop" role="dialog" aria-modal="true" onClick={(e)=>{ if(e.target.classList.contains('lmp-backdrop')) setOpen(false)}}>
          <div className="lmp-modal">
            <div className="lmp-modal-head">
              <strong>言語を選択</strong>
              <button type="button" className="btn-close" aria-label="Close" onClick={()=>setOpen(false)} />
            </div>

            <div className="lmp-grid">
              {languages.map((lang) => {
                const selected = draft.includes(lang.id);
                return (
                  <button
                    type="button"
                    key={lang.id}
                    className={`lmp-bubble ${selected ? "is-selected" : ""}`}
                    onClick={() => toggle(lang.id)}
                    aria-pressed={selected}
                  >
                    <span className="lmp-dot">{selected && <i className="bi bi-check2" />}</span>
                    <span className="lmp-label">{lang.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="lmp-modal-foot">
              <button type="button" className="btn btn-outline-secondary" onClick={()=>setDraft([])}>全て外す</button>
              <div className="flex-spacer" />
              <button type="button" className="btn btn-secondary" onClick={()=>setOpen(false)}>キャンセル</button>
              <button type="button" className="btn btn-primary" onClick={commit}>決定</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
