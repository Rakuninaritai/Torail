import React, { useState } from "react";

const applyTemplate = (tpl, vars) =>
  tpl.replace(/{(.*?)}/g, (_, key) => vars[key] ?? "");

export default function ScoutDetail({ conversation, onUpdateStatus, onReply, templates }) {
  const [reply, setReply] = useState("");
  const [template, setTemplate] = useState("");

  if (!conversation) {
    return <div className="text-muted">スカウトを選択してください</div>;
  }

  const handleReply = () => {
    if (!reply.trim()) return;
    onReply(conversation.id, reply);
    setReply("");
  };

  const handleTemplate = () => {
    if (!template) return;
    const tpl = templates.find((t) => t.name === template);
    if (tpl) {
      const vars = { ユーザー名: conversation.toUser };
      setReply(applyTemplate(tpl.body, vars));
    }
  };

  return (
    <div className="torail-card h-100 d-flex flex-column">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="mb-0">{conversation.toUser}</h6>
        <div className="btn-group btn-group-sm">
          <button
            className="btn btn-outline-info"
            onClick={() => onUpdateStatus(conversation.id, "既読")}
          >
            既読
          </button>
          <button
            className="btn btn-outline-success"
            onClick={() => onUpdateStatus(conversation.id, "返信あり")}
          >
            返信あり
          </button>
          <button
            className="btn btn-outline-secondary"
            onClick={() => onUpdateStatus(conversation.id, "辞退")}
          >
            辞退
          </button>
        </div>
      </div>

      {/* メッセージ履歴 */}
      <div className="flex-grow-1 overflow-auto mb-3 p-2 border rounded bg-light">
        {conversation.messages.map((m, i) => (
          <div
            key={i}
            className={`mb-2 d-flex ${
              m.from === "company" ? "justify-content-end" : "justify-content-start"
            }`}
          >
            <div
              className={`p-2 rounded ${
                m.from === "company" ? "bg-primary text-white" : "bg-white border"
              }`}
              style={{ maxWidth: "70%", whiteSpace: "pre-wrap" }}
            >
              <div className="small">{m.text}</div>
              <div className="text-end text-muted small">{m.date}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 返信欄 */}
      <div>
        <label className="form-label">返信</label>
        <div className="input-group mb-2">
          <select
            className="form-select"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
          >
            <option value="">テンプレ選択</option>
            {templates.map((t, i) => (
              <option key={i} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
          <button className="btn btn-outline-secondary" onClick={handleTemplate}>
            差し込み
          </button>
        </div>
        <textarea
          className="form-control mb-2"
          rows="3"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
        />
        <div className="text-end">
          <button className="btn btn-primary" onClick={handleReply}>
            <i className="bi bi-reply"></i> 送信
          </button>
        </div>
      </div>
    </div>
  );
}
