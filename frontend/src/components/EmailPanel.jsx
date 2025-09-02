// components/EmailPanel.jsx
import { useState } from "react";
import { api } from "../api";
import { toast } from "react-toastify";

export default function EmailPanel({ teamId, enabled }) {
  const [loading, setLoading] = useState(false);
  const disabled = !enabled;

  const test = async () => {
    setLoading(true);
    try {
      const res = await api(`/integrations/email/test/?team_id=${teamId}`, { method: "POST" });
      if (res.ok) toast.success("メールをテスト送信しました。");
      else if (res.error === "no_recipients") toast.warn("送信先がいません（チームメンバーのメールを確認）");
      else toast.error(`失敗: ${res.error || "unknown error"}`);
    } catch {
      toast.error("テスト送信に失敗しました。");
    } finally { setLoading(false); }
  };

  return (
    <div className={`card p-3 ${disabled ? "opacity-50" : ""}`}>
      <h5 className="mb-2">メール通知</h5>
      <small className="text-muted">
        チームメンバー（自分以外）の有効なメールに送ります。無効/空白は自動除外されます。
      </small>
      <div className="mt-2">
        <button className="btn btn-success" onClick={test} disabled={disabled || loading}>
          テスト送信
        </button>
      </div>
    </div>
  );
}
