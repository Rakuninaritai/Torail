import React, { useState } from "react";
import LanguageModalPicker from "../AddRecords/LanguageBubblPicker";

export default function PrefsCard({ roles, techOptions, techSelected, domain, isOwner, onSave }) {
  // roles
  const [editingRoles, setEditingRoles] = useState(false);
  const [rolesText, setRolesText] = useState(roles.join(", "));
  const commitRoles = () => { onSave?.({ roles: rolesText.split(",").map(s=>s.trim()).filter(Boolean) }); setEditingRoles(false); };

  // domain
  const [editingDomain, setEditingDomain] = useState(false);
  const [domainText, setDomainText] = useState(domain.join(", "));
  const commitDomain = () => { onSave?.({ domain: domainText.split(",").map(s=>s.trim()).filter(Boolean) }); setEditingDomain(false); };

  // tech
  const [techSel, setTechSel] = useState(techSelected);

  return (
    <section className="three-col mb-4">
      {/* roles */}
      <div className="torail-card">
        <div className="d-flex align-items-center justify-content-between">
          <h6 className="mb-0">希望職種</h6>
          {isOwner && (!editingRoles ? (
            <button className="btn btn-outline-secondary btn-sm" onClick={() => setEditingRoles(true)}><i className="bi bi-pencil" /> 編集</button>
          ) : (
            <div className="d-flex gap-2">
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingRoles(false)}>キャンセル</button>
              <button className="btn btn-primary btn-sm" onClick={commitRoles}>送信</button>
            </div>
          ))}
        </div>
        {!editingRoles ? (
          <div className="d-flex flex-wrap gap-2 mt-2">
            {roles.map((r) => <span key={r} className="pill">{r}</span>)}
          </div>
        ) : (
          <input className="form-control mt-2" value={rolesText} onChange={(e)=>setRolesText(e.target.value)} />
        )}
      </div>

      {/* tech */}
      <div className="torail-card">
        <div className="d-flex align-items-center justify-content-between">
          <h6 className="mb-0">技術領域</h6>
          {isOwner && (
            <button className="btn btn-primary btn-sm" onClick={() => onSave?.({ techSelected: techSel })}>送信</button>
          )}
        </div>
        <div className="mt-2">
          <LanguageModalPicker
            languages={techOptions} // [{id,name}]
            value={techSel}
            onChange={setTechSel}
            disabled={!isOwner}
          />
        </div>
      </div>

      {/* domain */}
      <div className="torail-card">
        <div className="d-flex align-items-center justify-content-between">
          <h6 className="mb-0">プロダクト関心ドメイン</h6>
          {isOwner && (!editingDomain ? (
            <button className="btn btn-outline-secondary btn-sm" onClick={() => setEditingDomain(true)}><i className="bi bi-pencil" /> 編集</button>
          ) : (
            <div className="d-flex gap-2">
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingDomain(false)}>キャンセル</button>
              <button className="btn btn-primary btn-sm" onClick={commitDomain}>送信</button>
            </div>
          ))}
        </div>
        {!editingDomain ? (
          <div className="d-flex flex-wrap gap-2 mt-2">
            {domain.map((r) => <span key={r} className="pill">{r}</span>)}
          </div>
        ) : (
          <input className="form-control mt-2" value={domainText} onChange={(e)=>setDomainText(e.target.value)} />
        )}
      </div>
    </section>
  );
}
