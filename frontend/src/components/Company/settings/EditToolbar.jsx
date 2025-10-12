import React from "react";

export default function EditToolbar({ editing, onEdit, onCancel, onSave, saving }) {
  return (
    <div className="d-flex gap-2 ms-auto">
      {!editing ? (
        <button className="btn btn-outline-secondary btn-sm" onClick={onEdit}>
          <i className="bi bi-pencil" /> 編集
        </button>
      ) : (
        <>
          <button className="btn btn-outline-secondary btn-sm" onClick={onCancel}>
            キャンセル
          </button>
          <button className="btn btn-primary btn-sm" onClick={onSave} disabled={saving}>
            {saving ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-check2" />}
            保存
          </button>
        </>
      )}
    </div>
  );
}
