// src/components/Company/settings/MemberManagementCard.jsx
import React, { useEffect, useState } from "react";
import { api } from "../../../api";

export default function MemberManagementCard({ isAdmin, companyId }) {
  const [members, setMembers] = useState([]);     // [{id, user:{id,username,email,account_type}, role}]
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState("");

  // 初期ロード（会社メンバー一覧）
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setLoading(true);
        const res = await api(`/company_members/?company=${companyId}`, { method: "GET" });
        const list = res?.results || res || [];
        if (!ignore) setMembers(list);
      } catch (e) {
        if (!ignore) setErr("メンバー一覧の取得に失敗しました");
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [companyId]);

  // 招待: メール（既ユーザーが前提）
  const inviteByEmail = async () => {
    if (!email.trim() || posting) return;
    try {
      setPosting(true);
      setErr("");
      await api(`/companies/${companyId}/invite_by_email/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      // 追加後に再取得（正確）
      const res = await api(`/company_members/?company=${companyId}`, { method: "GET" });
      setMembers(res?.results || res || []);
      setEmail("");
    } catch (e) {
      const msg = e?.response?.data?.detail || "招待に失敗しました（既に所属済み/存在しない/権限不足の可能性）";
      setErr(msg);
    } finally {
      setPosting(false);
    }
  };

  // 削除（会社から外す）: owner だけ許可
  const handleDelete = async (memberId) => {
    if (!isAdmin) return;
    if (!window.confirm("このメンバーを会社から外します。よろしいですか？")) return;
    try {
      await api(`/company_members/${memberId}/`, { method: "DELETE" });
      setMembers(list => list.filter(m => m.id !== memberId));
    } catch {
      alert("削除に失敗しました");
    }
  };

  return (
    <div className="torail-card">
      <h6 className="mb-2">メンバー</h6>

      {isAdmin && (
        <>
          <div className="input-group mb-2">
            <input
              className="form-control"
              placeholder="メールアドレスで招待"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="btn btn-primary" disabled={posting} onClick={inviteByEmail}>
              追加
            </button>
          </div>
          {err && <div className="text-danger small mb-2">{err}</div>}
        </>
      )}

      {loading ? (
        <div className="subtle">読み込み中…</div>
      ) : members.length === 0 ? (
        <div className="subtle">メンバーはいません</div>
      ) : (
        <ul className="list-group">
          {members.map((m) => (
            <li key={m.id} className="list-group-item d-flex align-items-center gap-2">
              <div className="flex-grow-1">
                {m.user?.username ?? "(no name)"} ({m.user?.email ?? "—"})
              </div>
              <span className={`badge ${m.role === "owner" ? "text-bg-primary" : "text-bg-secondary"}`}>
                {m.role === "owner" ? "管理者" : "メンバー"}
              </span>
              {isAdmin && m.role !== "owner" && (
                <button className="btn btn-sm btn-outline-danger ms-2" onClick={() => handleDelete(m.id)}>
                  <i className="bi bi-x" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
