// components/NotifyMethodSelector.jsx
import { useEffect, useState } from "react";
import { api } from "../api";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

export default function NotifyMethodSelector({ teamId, initialMode, onChange, loading }) {
  // 初期は null（= どれもONにしない）
  const [mode, setMode] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMode(initialMode ?? null);
  }, [initialMode]);

  const disabled = loading || saving || mode === null;

  const save = async (v) => {
    setSaving(true);
    try {
      await api(`/teams/${teamId}/`, {
        method: "PATCH",
        body: JSON.stringify({ notify_mode: v }),
      });
      setMode(v);
      onChange?.(v);
      toast.success("通知方法を更新しました");
    } catch {
      toast.error("通知方法の更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  // 取得中はUIを描画せず Skeleton のみ
  if (loading || mode === null) {
    return (
      <div className="card p-3">
        <h5 className="mb-2">通知の流し先</h5>
        <div className="d-flex flex-wrap gap-3">
          <Skeleton width={140} height={20} />
          <Skeleton width={90} height={20} />
          <Skeleton width={110} height={20} />
          <Skeleton width={100} height={20} />
          <Skeleton width={110} height={20} />
        </div>
      </div>
    );
  }

  const opts = [
    { value: "slack",   label: "Slack" },
    { value: "discord", label: "Discord" },
    { value: "email",   label: "メール" },
    { value: "off",     label: "通知しない" },
  ];

  return (
    <div className="card p-3">
      <h5 className="mb-2">通知の流し先</h5>
      <div className="d-flex flex-wrap gap-3">
        {opts.map((o) => (
          <div className="form-check" key={o.value}>
            <input
              className="form-check-input"
              type="radio"
              id={`notify-${o.value}`}
              name="notify_mode"
              checked={mode === o.value}
              onChange={() => save(o.value)}
              disabled={disabled}
            />
            <label className="form-check-label" htmlFor={`notify-${o.value}`}>
              {o.label}
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
