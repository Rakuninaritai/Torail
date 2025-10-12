import React, { useState } from "react";
import ScoutCompose from "../../components/Company/scout/ScoutCompose";
import ScoutHistory from "../../components/Company/scout/ScoutHistory";
import ScoutTemplates from "../../components/Company/scout/ScoutTemplates";

export default function ScoutsPage({ initialUser }) {
  const [tab, setTab] = useState("compose");
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const [templates, setTemplates] = useState([
    {
      name: "カジュアル面談",
      subject: "{ユーザー名}さん、まずはカジュアルにお話ししませんか？",
      body: "{ユーザー名}さん、継続が素晴らしいですね！ぜひお話させてください。",
    },
    {
      name: "長期インターン",
      subject: "{ユーザー名}さん、長期インターンのご案内",
      body: "弊社での長期インターンにご興味ありませんか？",
    },
  ]);

  const handleSend = (s) => setConversations([s, ...conversations]);
  const handleUpdateStatus = (id, status) =>
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status } : c))
    );
  const handleReply = (id, text) =>
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status: "返信あり",
              messages: [
                ...c.messages,
                { from: "company", text, date: new Date().toLocaleString() },
              ],
            }
          : c
      )
    );
  const handleSaveTemplate = (tpl) => setTemplates([...templates, tpl]);
  const handleDeleteTemplate = (i) =>
    setTemplates(templates.filter((_, idx) => idx !== i));

  const selected = conversations.find((c) => c.id === selectedId);

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
        <ScoutCompose onSend={handleSend} toUser={initialUser} templates={templates} />
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
