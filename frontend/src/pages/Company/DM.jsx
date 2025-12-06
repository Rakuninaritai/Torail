import React, { useState,useEffect } from "react";
import ScoutCompose from "../../components/Company/scout/ScoutCompose";
import ScoutHistory from "../../components/Company/scout/ScoutHistory";
import ScoutTemplates from "../../components/Company/scout/ScoutTemplates";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api";

export default function DMPage({ initialUser }) {
  const [tab, setTab] = useState("compose");
  const [templates, setTemplates] = useState([]);
  const [params] = useSearchParams();

  // テンプレをAPIから
  useEffect(()=>{
    (async()=>{
      try{
        const res = await api("/templates/", { method:"GET" });
        const list = res?.results || res || [];
        setTemplates(list.map(t => ({ id:t.id, name:t.name, subject:t.subject, body:t.body })));
      }catch{ /* 初回は空でもOK */ }
    })();
  },[]);
  // ▼ テンプレ保存（テンプレ管理タブから来る）
  const handleSaveTemplate = (tpl) => {
    // tpl: { name, subject, body } 想定
    (async () => {
      try {
        const created = await api('/templates/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: tpl.name, subject: tpl.subject, body: tpl.body }),
        });
        setTemplates(prev => [...prev, { id: created.id, name: created.name, subject: created.subject, body: created.body }]);
      } catch (err) {
        console.warn('テンプレ保存失敗, fallback to local', err);
        // フォールバック: ローカルで一時保存
        setTemplates(prev => [...prev, { ...tpl, id: crypto.randomUUID?.() || Date.now() }]);
      }
    })();
  };

  // 送信ハンドラ（スレッド作成→メッセージ投稿）
  const sendDM = async ({ toUserId, subject, body }) => {
    // 1) 所属会社の取得（1社想定）
    const comps = await api("/companies/", { method:"GET" });
    const company = (comps?.results || comps || [])[0];
    if (!company) { alert("会社がありません。まず会社を作成してください。"); return; }

    // 2) 既存スレッドがあれば流用、なければ作成（先に検索してから作る）
    let threadId = null;
    try {
      const list = await api(`/dm/threads/?company=${company.id}`, { method: "GET" });
      const exist = (list?.results || list || []).find(th => String(th.user) === String(toUserId));
      if (exist) {
        threadId = exist.id;
      } else {
        const payload = { company: company.id, user: toUserId };
        console.debug('creating dm thread payload', payload);
        const created = await api("/dm/threads/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        threadId = created.id;
      }
    } catch (err) {
      console.warn('thread lookup/create failed', err);
      throw err;
    }

    // 3) メッセージ送信
    try {
      // DMMessage.model では sender が必須 (company | user)
      await api("/dm/messages/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread: threadId, sender: "company", subject: subject || "", body }),
      });
    } catch (err) {
      console.error('メッセージ送信失敗', err);
      alert('メッセージ送信に失敗しました: ' + (err?.detail || err?.message || 'サーバーエラー'));
      return;
    }

    // 送信後はそのまま（会社側のDMナビゲーションは廃止）
    alert("送信しました。学生側のDMボックスに届きます。");
  };

  // ScoutCompose から呼ばれる onSend を差し替え
  const handleSend = async (state) => {
    // state: { toUserName, subject, body, ... }
    const uid = params.get("uid");
    if (!uid) { alert("候補者IDがありません（ダッシュボードから遷移してください）"); return; }
    await sendDM({ toUserId: uid, subject: state.subject, body: state.body });
  };

  // 履歴や返信は DMbox で行います

  const handleDeleteTemplate = (index) => {
    const tpl = templates[index];
    if (!tpl) return;
    (async () => {
      if (tpl.id && String(tpl.id).length > 10) {
        try {
          await api(`/templates/${tpl.id}/`, { method: 'DELETE' });
        } catch (err) {
          console.warn('テンプレ削除 API 失敗', err);
        }
      }
      setTemplates(prev => prev.filter((_, i) => i !== index));
    })();
  };

  return (
    <main className="container-xxl pb-5" style={{ height: "85vh" }}>
      <div className="page-header mb-3">
        <i className="bi bi-chat-dots fs-4"></i>
        <h1 className="title h4 mb-0">DM</h1>
        <span className="subtle ms-2">メッセージ送信・履歴・テンプレ管理</span>
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
            className={`nav-link ${tab === "templates" ? "active" : ""}`}
            onClick={() => setTab("templates")}
          >
            テンプレ管理
          </button>
        </li>
        {/* 履歴への会社側ナビゲーションは廃止 */}
      </ul>

      {tab === "compose" && (
         <ScoutCompose onSend={handleSend} toUser={params.get("to") || initialUser} templates={templates} />
      )}

      {/* 履歴はDMboxで管理するため、このページでは表示しない */}

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
