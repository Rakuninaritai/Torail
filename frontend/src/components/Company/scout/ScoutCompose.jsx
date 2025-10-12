import React, { useState } from "react";

// 差し込み関数
const applyTemplate = (tpl, vars) =>
  tpl.replace(/{(.*?)}/g, (_, key) => vars[key] ?? "");

export default function ScoutCompose({ onSend, toUser, templates }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [template, setTemplate] = useState("");

  const handleTemplate = () => {
    if (!template) return;
    const tpl = templates.find((t) => t.name === template);
    if (tpl) {
      const vars = { ユーザー名: toUser || "候補者" };
      setSubject(applyTemplate(tpl.subject, vars));
      setBody(applyTemplate(tpl.body, vars));
    }
  };

  const handleSend = () => {
    if (!subject || !body) return;
    onSend({
      id: Date.now(),
      toUser: toUser || "（未指定）",
      subject,
      body,
      status: "未読",
      date: new Date().toLocaleString(),
      messages: [
        { from: "company", text: body, date: new Date().toLocaleString() },
      ],
    });
    setSubject("");
    setBody("");
  };

  return (
    <div className="torail-card">
      <h6 className="mb-3">スカウト送信</h6>

      {/* 送信先 */}
      <div className="mb-3">
        <label className="form-label">送信先</label>
        <input className="form-control" value={toUser || ""} readOnly />
      </div>

      {/* テンプレート選択 */}
      <div className="mb-3">
        <label className="form-label">テンプレート</label>
        <div className="input-group">
          <select
            className="form-select"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
          >
            <option value="">選択してください</option>
            {templates.map((t, i) => (
              <option key={i} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            className="btn btn-outline-secondary"
            type="button"
            onClick={handleTemplate}
          >
            <i className="bi bi-clipboard-plus"></i> 差し込み
          </button>
        </div>
        <div className="form-hint small text-muted">
          利用可能な変数: {"{ユーザー名}"}
        </div>
      </div>

      {/* 件名 */}
      <div className="mb-3">
        <label className="form-label">件名</label>
        <input
          className="form-control"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="例: {ユーザー名}さん、カジュアルにお話しませんか？"
        />
      </div>

      {/* 本文 */}
      <div className="mb-3">
        <label className="form-label">本文</label>
        <textarea
          className="form-control"
          rows="6"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="{ユーザー名}さん、継続が素晴らしいですね！..."
        />
      </div>

      {/* 送信ボタン */}
      <div className="text-end">
        <button className="btn btn-primary" type="button" onClick={handleSend}>
          <i className="bi bi-send"></i> 送信
        </button>
      </div>
    </div>
  );
}
