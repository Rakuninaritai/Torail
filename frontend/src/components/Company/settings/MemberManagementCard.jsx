// src/components/Company/settings/MemberManagementCard.jsx
import React, { useEffect, useState } from "react";
import { api } from "../../../api";

export default function MemberManagementCard({ isAdmin, companyId }) {
  const [members, setMembers] = useState([]);     // [{id, user:{id,username,email,account_type}, role}]
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]); // search results from username API
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

  // 招待: ユーザー名検索 -> 選択で追加
  useEffect(() => {
    let mounted = true;
    let t = null;
    if ((query || '').trim().length >= 2) {
      // 簡易デバウンス
      t = setTimeout(async () => {
        try {
          const res = await api(`/users/search_by_username/?q=${encodeURIComponent(query.trim())}`, { method: 'GET' });
          if (!mounted) return;
          setResults(res || []);
        } catch {
          if (!mounted) return;
          setResults([]);
        }
      }, 300);
    } else {
      setResults([]);
    }
    return () => { mounted = false; if (t) clearTimeout(t); };
  }, [query]);

  const inviteByUserId = async (user) => {
    if (posting) return;
    try {
      setPosting(true);
      setErr("");
      await api(`/company_members/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: companyId, user: user.id, role: 'member' }),
      });
      const res = await api(`/company_members/?company=${companyId}`, { method: "GET" });
      setMembers(res?.results || res || []);
      setQuery("");
      setResults([]);
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
          <div className="mb-2">
            <input
              className="form-control"
              placeholder="ユーザー名で検索（英数字） 例: yamam"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setErr(""); }}
            />
            <div className="small text-muted mt-1">学籍アカウント（student）は検索対象に含めません</div>
          </div>
          {results.length > 0 && (
            <ul className="list-group mb-2">
              {results.map(u => (
                <li key={u.id} className="list-group-item d-flex align-items-center justify-content-between">
                  <div>
                    <div><strong>{u.username}</strong> <span className="text-muted">{u.email}</span></div>
                    <div className="small text-secondary">{u.account_type}</div>
                  </div>
                  <div>
                    <button className="btn btn-sm btn-primary" disabled={posting} onClick={() => inviteByUserId(u)}>追加</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
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
