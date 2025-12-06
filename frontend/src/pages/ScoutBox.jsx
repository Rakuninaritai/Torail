import React, { useEffect, useMemo, useState, useCallback } from "react";
import ScoutFilters from "../components/Scoutbox/ScoutFilters";
import ScoutList from "../components/Scoutbox/ScoutList";
import DetailDrawer from "../components/Scoutbox/DetailDrawer";
import "../components/Scoutbox/scoutbox.css";
import { api } from "../api";

export default function  ScoutBoxPage() {
  // ダミーデータ
  const [items, setItems] = useState([
    
  ]);
  const [filters, setFilters] = useState({ q: "", status: "すべて", range: "指定なし", sort: "新着" });
  const [quickFilter, setQuickFilter] = useState("すべて");
  // fetchThreads: 会社か学生かに応じてスレッド一覧を取得（検索対応）
  const fetchThreads = useCallback(async (opts = {}) => {
    const q = opts.q ?? filters.q ?? '';
    // 企業判定: companies API で最初の会社を取る
    const comps = await api('/companies/', { method: 'GET' });
    const company = (comps?.results || comps || [])[0];
    let rows = [];
    if (company) {
      // 企業側
      const url = q ? `/dm/threads/?company=${company.id}&q=${encodeURIComponent(q)}` : `/dm/threads/?company=${company.id}`;
      const resp = await api(url, { method: 'GET' });
      rows = resp?.results || resp || [];
      setItems(rows.map(r => {
        const last = (r.messages && r.messages.length>0) ? r.messages.slice(-1)[0] : null;
        // 会社側表示は「ユーザーからのメッセージが会社に未読か」を重視
        let status = '未読';
        if (last) {
          if (last.sender === 'user') {
            status = last.is_read_by_company ? '既読' : '未読';
          } else {
            // 最終送信が company の場合は相手（user）が読んだかどうかで既読判定
            status = last.is_read_by_user ? '既読' : '未読';
          }
        }
        return ({
          id: r.id,
          company: r.company?.name || company.name,
          status,
          subject: last ? (last.subject || '(件名なし)') : '(件名なし)',
          snippet: last ? (last.body.slice(0,120) || '') : '',
          tags: [],
          sentAt: r.created_at,
        });
      }));
    } else {
      // 学生側
      const url = q ? `/dm/threads/summary/?q=${encodeURIComponent(q)}` : `/dm/threads/summary/`;
      const rowsSummary = await api(url, { method: 'GET' });
      rows = rowsSummary || [];
      setItems(rows.map(r => ({
        id: r.thread_id,
        company: r.company,
        status: r.status,
        subject: r.subject || "(件名なし)",
        snippet: r.snippet || "",
        tags: r.tags || [],
        sentAt: r.sentAt,
      })));
    }
    return rows;
  }, [filters]);

  useEffect(() => {
    (async () => {
      try {
        await fetchThreads();
      } catch (e) {
        console.error("スカウトBOX取得失敗", e);
      }
    })();
  }, [fetchThreads]);

  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [newTpl, setNewTpl] = useState({ name: '', subject: '', body: '' });

  // ログイン中ユーザー情報を取得（account_type, id, username, display_name）
  useEffect(() => {
    (async () => {
      try {
        const u = await api('auth/user/');
        let prof = null;
        try { prof = await api('/profile/me/', { method: 'GET' }); } catch { prof = null; }
        setCurrentUser({ id: prof?.id || u?.id || null, username: u?.username, account_type: u?.account_type, display_name: prof?.display_name, avatar_url: prof?.avatar_url });
      } catch {
        setCurrentUser(null);
      }
    })();
  }, []);

  // templates のロード（currentUser に依存）
  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      try {
        const res = await api('/templates/', { method: 'GET' });
        const list = (res?.results || res || []);
        setTemplates(list.map(t => ({ id: t.id, name: t.name, subject: t.subject, body: t.body })));
      } catch {
        setTemplates([]);
      }
    })();
  }, [currentUser]);

  // フィルタ適用
  const filtered = useMemo(() => {
    let arr = [...items];
    // キーワード
    if (filters.q.trim()) {
      const q = filters.q.trim().toLowerCase();
      arr = arr.filter(x =>
        x.company.toLowerCase().includes(q) ||
        x.subject.toLowerCase().includes(q) ||
        x.snippet.toLowerCase().includes(q)
      );
    }
    // 状態
    const wanted = (quickFilter !== "すべて") ? quickFilter : (filters.status !== "すべて" ? filters.status : null);
    if (wanted) arr = arr.filter(x => x.status === wanted);

    // ソート（ダミー）
    if (filters.sort === "企業名") arr.sort((a,b)=>a.company.localeCompare(b.company));
    if (filters.sort === "未読優先") arr.sort((a,b)=>{
      const score = (s)=> s==="未読"?0 : s==="既読"?1 : 2;
      return score(a.status)-score(b.status);
    });
    return arr;
  }, [items, filters, quickFilter]);

  // 最終メッセージからステータスを決めるヘルパー
  const statusFromLast = (last) => {
    if (!last) return '未読';
    if (last.sender === 'company') {
      return last.is_read_by_user ? '既読' : '未読';
    }
    return last.is_read_by_company ? '既読' : '未読';
  };

  const openDetail = async (it) => {
    const res = await api(`/dm/threads/${it.id}/detail/`, { method: "GET" });
    const msgs = res.messages || [];
    setCurrent({
      id: it.id,
      company: res.thread.company,
      company_slug: res.thread.company_slug,
      status: it.status,
      subject: msgs.length ? msgs[0].subject : (it.subject || ""),
      messages: msgs,
      tags: it.tags,
      jobUrl: "#",
      user: res.thread.user || null,
      templates: templates, // pass templates to drawer for select options
    });
    setOpen(true);
    try {
      // 開封時に既読を付ける
      await api(`/dm/threads/${it.id}/mark_read/`, { method: 'POST' });
      // ローカルのメッセージにも既読フラグを反映
      setCurrent(prev => {
        if (!prev) return prev;
        const isCompany = currentUser?.account_type === 'company';
        const msgs2 = (prev.messages || []).map(m => ({
          ...m,
          is_read_by_company: isCompany ? true : m.is_read_by_company,
          is_read_by_user: isCompany ? m.is_read_by_user : true,
        }));
        return { ...prev, messages: msgs2 };
      });
      // 一覧のステータスも最終メッセージの既読フラグに基づいて更新
      setItems(list => list.map(x => {
        if (x.id !== it.id) return x;
        // 現在の current state の messages を参照して最終メッセージを決定
        const cur = (current && current.messages) ? current : null;
        const last = cur && cur.messages && cur.messages.length>0 ? cur.messages.slice(-1)[0] : null;
        // もし local current が未更新なら、resp.messages を使う
        const fallbackLast = (msgs && msgs.length>0) ? msgs.slice(-1)[0] : last;
        const finalLast = fallbackLast || null;
        if (!finalLast) return { ...x, status: '未読' };
        const newStatus = finalLast.sender === 'company' ? (finalLast.is_read_by_user ? '既読' : '未読') : (finalLast.is_read_by_company ? '既読' : '未読');
        return { ...x, status: newStatus };
      }));
    } catch (e) {
      // 既読付け失敗は致命的ではない
      console.warn('mark_read failed', e);
    }
  };

  const closeDetail = () => setOpen(false);

  const  reply = async (text) => {
    if (!current) return;
    const body = (text || "").trim();
    if (!body) return;
    try {
      const body = (text || "").trim();
      if (!body) return;
      // 送信者は現在ユーザーの account_type を優先して判定
      const sender = currentUser?.account_type === 'company' ? 'company' : 'user';
      const created = await api('/dm/messages/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread: current.id, sender, subject: current.subject || '', body })
      });

      setCurrent(prev => ({
        ...prev,
        messages: [ ...(prev.messages || []), { id: created.id || Date.now(), sender, subject: created.subject || current.subject || '', body: created.body || body, created_at: created.created_at || new Date().toISOString(), is_mine: true, is_read_by_company: created.is_read_by_company, is_read_by_user: created.is_read_by_user } ],
      }));

      // スレッド一覧のステータスを最終メッセージの既読フラグから再計算
      setItems(list => list.map(x => {
        if (x.id !== current.id) return x;
        const last = (current.messages && current.messages.length>0) ? current.messages.slice(-1)[0] : null;
        const newLast = created || last;
        return { ...x, status: statusFromLast(newLast) };
      }));
    } catch(e) {
      console.warn('reply failed', e);
    }
  };

  

  const insertTemplate = (text) => {
    if (!text) return;
    // プレースホルダ置換: 企業側テンプレは {ユーザー名}、学生側テンプレは {企業名}
    const replacePlaceholders = (tpl) => {
      let s = tpl || '';
      try {
        if (currentUser?.account_type === 'company') {
          // 企業側テンプレ→ {ユーザー名}
          const uname = current?.user?.display_name || current?.user?.username || '';
          s = s.replace(/\{\s*ユーザー名\s*\}/g, uname);
        } else {
          // 学生側テンプレ→ {企業名}
          const cname = current?.company || '';
          s = s.replace(/\{\s*企業名\s*\}/g, cname);
        }
      } catch {
        // ignore
      }
      return s;
    };

    const el = document.getElementById("replyBox");
    const final = replacePlaceholders(text);
    if (!el) return; // replyBox が存在する場合のみ挿入
    el.value = (el.value ? el.value + "\n" : "") + final;
  };

  return (
    <main className="container-xxl pb-5">
      <div className="page-header mb-3">
        <i className="bi bi-inbox fs-4" />
        <h1 className="title h4 mb-0">DMbox</h1>
        <span className="subtle ms-2">メッセージを一元管理</span>
      </div>

      <ScoutFilters value={filters} onChange={setFilters} onSearch={(v)=>{ setFilters(v); fetchThreads({q: v.q}); }} />

      <div className="row g-4">
        <div className="col-12 col-xl-7">
          <ScoutList
            items={filtered}
            onPick={openDetail}
            quickFilter={quickFilter}
            setQuickFilter={setQuickFilter}
          />
        </div>
        <div className="col-12 col-xl-5">
          <section className="torail-card mb-3">
            <h6 className="mb-2">テンプレ（返信）</h6>
            <div className="mb-2 text-muted small">テンプレ内で使えるプレースホルダ: 企業向けテンプレでは <code>{'{ユーザー名}'}</code>、学生向けテンプレでは <code>{'{企業名}'}</code> が使えます。挿入時に自動で置換されます。</div>
            <div className="d-grid gap-2">
              {templates.slice(0,3).map((t,i)=> (
                <button key={i} className="btn btn-outline-secondary btn-sm" onClick={()=>insertTemplate(t.body)}>{t.name || `テンプレ ${i+1}`}</button>
              ))}
            </div>
          </section>

          {/* テンプレ管理（会社なら会社テンプレ、個人なら個人テンプレ） */}
          {currentUser && (
            <section className="torail-card">
              <h6 className="mb-2">テンプレ管理</h6>
              <div className="mb-2">
                <input className="form-control mb-2" placeholder="名前" value={newTpl.name} onChange={e=>setNewTpl(s=>({...s,name:e.target.value}))} />
                <input className="form-control mb-2" placeholder="件名（任意）" value={newTpl.subject} onChange={e=>setNewTpl(s=>({...s,subject:e.target.value}))} />
                <textarea className="form-control mb-2" rows={3} placeholder="本文" value={newTpl.body} onChange={e=>setNewTpl(s=>({...s,body:e.target.value}))} />
                <div className="d-flex gap-2">
                  <button className="btn btn-primary btn-sm" onClick={async()=>{
                    try{
                      const created = await api('/templates/', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(newTpl) });
                      setTemplates(prev=>[...prev, { id: created.id, name: created.name, subject: created.subject, body: created.body }]);
                      setNewTpl({ name:'', subject:'', body:'' });
                    }catch(err){ console.warn('テンプレ作成失敗', err); }
                  }}>保存</button>
                  <button className="btn btn-outline-secondary btn-sm" onClick={()=>setNewTpl({ name:'', subject:'', body:'' })}>クリア</button>
                </div>
              </div>
              <div>
                <ul className="list-unstyled">
                  {templates.map(t=> (
                    <li key={t.id} className="d-flex align-items-center justify-content-between mb-2">
                      <div>
                        <div className="fw-semibold">{t.name}</div>
                        <div className="text-muted small">{t.subject}</div>
                      </div>
                      <div className="d-flex gap-2">
                        <button className="btn btn-sm btn-outline-secondary" onClick={()=>insertTemplate(t.body)}>挿入</button>
                        <button className="btn btn-sm btn-outline-danger" onClick={async()=>{ try{ await api(`/templates/${t.id}/`, { method:'DELETE' }); setTemplates(prev=>prev.filter(x=>x.id!==t.id)); }catch(e){console.warn(e);} }}>削除</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </div>
      </div>

      <DetailDrawer
        open={open}
        data={current}
        onClose={closeDetail}
        onReply={reply}
        
        onInsertTemplate={insertTemplate}
        currentUser={currentUser}
      />
    </main>
  );
}
