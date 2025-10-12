import React, { useEffect, useRef, useState } from "react";
import "./user-cards.css";
import SnsAddModal from "./SnsAddModal";

export default function HeaderCard({ profile, isOwner, onSave, onAddSns, onRemoveSns, saving }) {
  const fileRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile);
  const [snsOpen, setSnsOpen] = useState(false);

  useEffect(() => setDraft(profile), [profile]);

  const pickAvatar = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setDraft((d) => ({ ...d, avatarUrl: url, _avatarFile: f }));
  };

  const start = () => setEditing(true);
  const cancel = () => { setDraft(profile); setEditing(false); };
  const save = () => { onSave?.(draft); setEditing(false); };

  const removeSnsAt = (idx) => { onRemoveSns?.(idx); };

  return (
    <section className="torail-card mb-4">
      <div className="d-flex align-items-center gap-3 flex-wrap">
        <div className="position-relative">
          <img
            src={draft.avatarUrl || "https://placehold.co/144x144/png"}
            className="avatar"
            alt="avatar"
            onClick={() => editing && fileRef.current?.click()}
          />
          {isOwner && editing && (
            <>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickAvatar} />
              <button
                type="button"
                className="btn btn-light border avatar-edit-btn"
                onClick={() => fileRef.current?.click()}
                title="画像を変更"
              >
                <i className="bi bi-camera" />
              </button>
            </>
          )}
        </div>

        <div className="flex-grow-1">
          {!editing ? (
            <>
              <div className="d-flex align-items-center flex-wrap gap-2">
                <h5 className="mb-0">{profile.displayName}</h5>
                <span className="badge text-bg-info">公開：企業のみ</span>
              </div>
              <div className="subtle mt-1">
                {profile.school} / {profile.grade} / {profile.pref}
              </div>
            </>
          ) : (
            <>
              <div className="d-flex gap-2 flex-wrap">
                <input
                  className="form-control form-control-sm"
                  placeholder="ユーザー名"
                  value={draft.displayName}
                  onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))}
                />
              </div>
              <div className="d-flex gap-2 flex-wrap mt-2">
                <input
                  className="form-control form-control-sm"
                  placeholder="学校"
                  value={draft.school}
                  onChange={(e) => setDraft((d) => ({ ...d, school: e.target.value }))}
                />
                <select
                  className="form-select form-select-sm"
                  value={draft.grade}
                  onChange={(e) => setDraft((d) => ({ ...d, grade: e.target.value }))}
                >
                  <option>1年</option><option>2年</option><option>3年</option><option>4年</option>
                </select>
                <input
                  className="form-control form-control-sm"
                  placeholder="都道府県"
                  value={draft.pref}
                  onChange={(e) => setDraft((d) => ({ ...d, pref: e.target.value }))}
                />
              </div>
            </>
          )}
        </div>

        <div className="ms-auto d-flex align-items-center gap-2 flex-wrap">
          {/* SNS表示（編集時は削除ボタンを重ねる） */}
          <div className="d-flex align-items-center gap-2">
            {draft.sns.map((s, i) => (
              <div key={i} className="sns-wrap">
                <a className="sns-btn" href={s.url} target="_blank" rel="noreferrer" title={s.label}>
                  <i className={`bi ${s.icon}`} />
                </a>
                {isOwner && editing && (
                  <button
                    type="button"
                    aria-label={`${s.label} を削除`}
                    className="sns-del"
                    onClick={() => removeSnsAt(i)}
                    title="削除"
                  >
                    <i className="bi bi-x-lg" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* SNS追加は編集モードでのみ表示 */}
          {isOwner && editing && (
            <button className="btn btn-outline-secondary btn-sm" onClick={() => setSnsOpen(true)}>
              <i className="bi bi-plus-lg" /> SNS追加
            </button>
          )}

          {isOwner && !editing && (
            <button className="btn btn-outline-secondary btn-sm" onClick={start}>
              <i className="bi bi-pencil" /> 編集
            </button>
          )}
          {isOwner && editing && (
            <>
              <button className="btn btn-secondary btn-sm" onClick={cancel}>キャンセル</button>
              <button className="btn btn-primary btn-sm" disabled={saving} onClick={save}>
                {saving ? '送信中…' : '送信'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* 追加モーダル */}
      <SnsAddModal
        open={snsOpen}
        onClose={() => setSnsOpen(false)}
        onSubmit={(item) => onAddSns?.(item)}
      />
    </section>
  );
}
