import React, { useEffect, useRef } from "react";
import { useNavigate } from 'react-router-dom';
import StatusBadge from "./StatusBadge";
import "./scoutbox.css";

export default function DetailDrawer({ open, data, onClose, onReply, onDecline, onInsertTemplate, currentUser }) {
  if (!open || !data) return null;
  const listRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    // 新しいメッセージ時に自動スクロール
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [data.messages]);

  const getDisplayName = (m) => {
    if (m.sender === 'company') return data.company || '採用担当';
    return data.user?.display_name || data.user?.username || '候補者';
  }

  // linkify: URL をクリック可能なリンクにする（簡易実装）
  const escapeHtml = (str) => str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const linkify = (text) => {
    if (!text) return '';
    const escaped = escapeHtml(String(text));
    // URL regex (http(s) and www) — keep simple
    const urlRe = /(https?:\/\/[\w\-\._~:\/?#\[\]@!$&'()*+,;=%]+)|(www\.[\w\-\._~:\/?#\[\]@!$&'()*+,;=%]+)/g;
    return escaped.replace(urlRe, (m) => {
      const href = m.startsWith('http') ? m : `http://${m}`;
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${m}</a>`;
    });
  };

  return (
    <div className="drawer-backdrop" onClick={(e)=>{ if(e.target.classList.contains("drawer-backdrop")) onClose?.(); }}>
      <aside className="drawer">
        <div className="drawer-head">
          <div>
            <div className="d-flex align-items-center gap-2">
              <h5 className="mb-0">{data.company}</h5>
              <span><StatusBadge status={data.status} /></span>
            </div>
            <div className="subtle small">件名: {data.subject}</div>
          </div>
          <button className="btn-close" onClick={onClose} aria-label="閉じる" />
        </div>

        <div className="drawer-body">
          <div className="thread-msg">
            <div className="thread-meta mb-1">会話</div>
            <div className="chat-container" ref={listRef} style={{display:'flex',flexDirection:'column',gap:'8px', maxHeight:'60vh', overflow:'auto'}}>
              {(data.messages || []).map(m => {
                const isCompanyViewer = currentUser?.account_type === 'company';
                const fallbackIsMine = (isCompanyViewer && m.sender === 'company') || (!isCompanyViewer && String(currentUser?.id) === String(data.user?.id) && m.sender === 'user');
                const isMine = (typeof m.is_mine !== 'undefined') ? !!m.is_mine : fallbackIsMine;
                const rowClass = isMine ? 'chat-row--right' : 'chat-row--left';
                const bubbleClass = isMine ? 'chat-bubble--mine' : (m.sender === 'company' ? 'chat-bubble--company' : 'chat-bubble--user');
                const name = isMine ? (currentUser?.display_name || currentUser?.username || (isCompanyViewer ? data.company : data.user?.username)) : getDisplayName(m);
                const avatarInitial = (getDisplayName(m) || (isCompanyViewer ? data.company : data.user?.username) || 'U').slice(0,1);
                return (
                  <div key={m.id} className={`chat-row ${rowClass}`}>
                    {!isMine && (
                      <div className="chat-avatar" onClick={()=>{
                        // 相手が会社かユーザーかで遷移先を決める
                        if(m.sender === 'company'){
                          if(data.company_slug) navigate(`/company/public/${data.company_slug}`);
                        } else {
                          if(data.user?.username) navigate(`/mypage/${data.user.username}`);
                        }
                      }}>{avatarInitial}</div>
                    )}
                    <div className={`chat-bubble ${bubbleClass}`}> 
                      <div className="chat-meta" style={{fontSize:'0.85rem', marginBottom:6}}>{name}</div>
                      <div style={{whiteSpace:'pre-wrap'}} dangerouslySetInnerHTML={{ __html: linkify(m.body) }} />
                      <div className="chat-time">{m.created_at ? new Date(m.created_at).toLocaleString() : ''}</div>
                    </div>
                    {isMine && (
                      <div className="chat-avatar" onClick={()=>{
                        // 自分側のアバターは相手先へ遷移
                        if(isCompanyViewer){
                          if(data.company_slug) navigate(`/company/public/${data.company_slug}`);
                        } else {
                          if(data.user?.username) navigate(`/mypage/${data.user.username}`);
                        }
                      }}>{(isCompanyViewer ? (data.company || 'C').slice(0,1) : (currentUser?.display_name || currentUser?.username || 'U').slice(0,1))}</div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-2 d-flex gap-2 flex-wrap">
              {data.tags?.map(t=> <span className="chip" key={t}>{t}</span>)}
            </div>
          </div>
        </div>

        <div className="drawer-foot">
          <label className="form-label mb-1">メッセージ</label>
          <textarea className="form-control mb-2" rows="3" placeholder="テンプレから挿入、または自由記述" id="replyBox" />
          <div className="d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-2">
              <select className="form-select form-select-sm" onChange={(e)=>{ const v = e.target.value; if(v){ onInsertTemplate?.(v); e.target.value=''; } }} style={{width:"auto"}}>
                <option value="">テンプレを選択</option>
                {Array.isArray(data.templates) && data.templates.length>0 ? (
                  data.templates.map(t => <option key={t.id} value={t.body}>{t.name || t.subject || t.body.slice(0,20)}</option>)
                ) : null}
              </select>
            </div>
            <div className="d-flex gap-2">
              {/* 辞退ボタンは廃止 */}
              <button className="btn btn-primary" onClick={()=>{ const el = document.getElementById('replyBox'); const text = el?.value?.trim(); if(text){ onReply?.(text); el.value=''; } }}><i className="bi bi-reply" /> 送信</button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
