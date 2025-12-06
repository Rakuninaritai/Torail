import React, { useState,useEffect, useMemo } from "react";
import ScoutCompose from "../../components/Company/scout/ScoutCompose";
import ScoutHistory from "../../components/Company/scout/ScoutHistory";
import ScoutTemplates from "../../components/Company/scout/ScoutTemplates";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../../api";

export default function ScoutsPage({ initialUser }) {
  const [tab, setTab] = useState("compose");
  const [conversations, setConversations] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [params] = useSearchParams();
  const navigate = useNavigate();

  // テンプレをAPIから
  useEffect(()=>{
    (async()=>{
      try{
        const res = await api("/templates/", { method:"GET" });
        const list = res?.results || res || [];
        setTemplates(list.map(t => ({ id:t.id, name:t.name, subject:t.subject, body:t.body })));
      }catch(e){ /* 初回は空でもOK */ }
    })();
  },[]);
  // ▼ 選択中スレッド（履歴タブで右側に表示）
  const selected = useMemo(
    () => conversations.find(c => c.id === selectedId) || null,
    [conversations, selectedId]
  );
  // ▼ テンプレ保存（テンプレ管理タブから来る）
  const handleSaveTemplate = (tpl) => {
    // tpl: { name, subject, body } 想定
    setTemplates(prev => [...prev, { ...tpl, id: crypto.randomUUID?.() || Date.now() }]);
  };

  // 送信ハンドラ（スレッド作成→メッセージ投稿）
  const sendScout = async ({ toUserId, subject, body }) => {
    // 1) 所属会社の取得（1社想定）
    const comps = await api("/companies/", { method:"GET" });
    const company = (comps?.results || comps || [])[0];
    if (!company) { alert("会社がありません。まず会社を作成してください。"); return; }

    // 2) 既存スレッドがあれば流用、なければ作成（先に検索）
    let threadId = null;
    try {
      const list = await api(`/dm/threads/?company=${company.id}`, { method: "GET" });
      const exist = (list?.results || list || []).find(th => String(th.user) === String(toUserId));
      if (exist) {
        threadId = exist.id;
      } else {
        const created = await api("/dm/threads/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company: company.id, user: toUserId })
        });
        threadId = created.id;
      }
    } catch (e) {
      // 既存スレッド取得/作成に失敗
      console.warn('thread lookup/create failed', e);
      throw e;
    }

    // 3) メッセージ送信（sender を company に設定）
    await api("/dm/messages/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thread: threadId, sender: 'company', subject: subject||"", body })
    });

    // UI更新（簡易）
    setConversations(prev => [{
      id: threadId,
      toUserId,
      status: "送信済み",
      messages: [{ from:"company", text: body, date: new Date().toLocaleString() }],
    }, ...prev]);

    alert("送信しました。学生側のDMboxに届きます。");
    setTab("history");
  };

  // ScoutCompose から呼ばれる onSend を差し替え
  const handleSend = async (state) => {
    // state: { toUserName, subject, body, ... }
    const uid = params.get("uid");
    if (!uid) { alert("候補者IDがありません（ダッシュボードから遷移してください）"); return; }
    await sendScout({ toUserId: uid, subject: state.subject, body: state.body });
  };
  // ──────────────────────────────────────────────
  // ステータス更新（履歴リストのドロップダウン等から呼ばれる想定）
  // usage: onUpdateStatus(id, "既読" | "未読" ...)
  const handleUpdateStatus = (id, status) => {
    setConversations(prev =>
      prev.map(c => (c.id === id ? { ...c, status } : c))
    );
  };

  // 返信（右ペインの返信ボタン等から呼ばれる想定）
  // usage: onReply(id, "本文テキスト")
  const handleReply = (id, text) => {
    setConversations(prev =>
      prev.map(c =>
        c.id === id
          ? {
              ...c,
              status: "未読",
              messages: [
                ...(c.messages || []),
                { from: "company", text, date: new Date().toLocaleString() },
              ],
            }
          : c
      )
    );
  };

  // テンプレ削除（テンプレ管理タブ）
  // usage: onDelete(indexNumber)
  const handleDeleteTemplate = (index) => {
    setTemplates(prev => prev.filter((_, i) => i !== index));
  };
  // ──────────────────────────────────────────────

  return (
    <main className="container-xxl pb-5" style={{ height: "85vh" }}>
      <div className="page-header mb-3">
        <i className="bi bi-send fs-4"></i>
        <h1 className="title h4 mb-0">スカウト</h1>
        <span className="subtle ms-2">送信・履歴・テンプレ管理</span>
      </div>

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            className={`nav-link ${tab === "compose" ? "active" : ""}`}
            onClick={() => setTab("compose")}
          >
            送信
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${tab === "history" ? "active" : ""}`}
            onClick={() => setTab("history")}
          >
            履歴
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${tab === "templates" ? "active" : ""}`}
            onClick={() => setTab("templates")}
          >
            テンプレ管理
          </button>
        </li>
      </ul>

      {tab === "compose" && (
         <ScoutCompose onSend={handleSend} toUser={params.get("to") || initialUser} templates={templates} />
      )}

      {tab === "history" && (
        <ScoutHistory
          conversations={conversations}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          filter={filter}
          setFilter={setFilter}
          query={query}
          setQuery={setQuery}
          selected={selected}
          onUpdateStatus={handleUpdateStatus}
          onReply={handleReply}
          templates={templates}
        />
      )}

      {tab === "templates" && (
        <ScoutTemplates
          templates={templates}
          onSave={handleSaveTemplate}
          onDelete={handleDeleteTemplate}
        />
      )}
    </main>
  );
}
