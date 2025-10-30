import React, { useEffect, useState } from "react";
import LanguageModalPicker from "../AddRecords/LanguageBubblPicker";

export default function PrefsCard({  
  rolesOptions = [],
  rolesSelected=[],
  techOptions=[],
  techSelected = [],
  domainOptions = [],
  domainSelected=[],
  isOwner,
  onSave }) {
  // roles
  const [rolesSel, setRolesSel] = useState(rolesSelected);

  // domain
  const [domainSel, setDomainSel] = useState(domainSelected);
  // tech
  const [techSel, setTechSel] = useState(techSelected);


  // ← props 到着後に同期
  useEffect(() => setRolesSel(rolesSelected), [rolesSelected]);
  useEffect(() => setDomainSel(domainSelected), [domainSelected]);
  useEffect(() => setTechSel(techSelected), [techSelected]);

  return (
    <section className="three-col mb-4">
      {/* roles */}
      <div className="torail-card"> 
        <div className="d-flex align-items-center justify-content-between"> 
          <h6 className="mb-0">希望職種</h6> 
          {isOwner && ( <button className="btn btn-primary btn-sm" onClick={() => onSave?.({ roles: rolesSel })}>送信</button> )} 
        </div> 
        <div className="mt-2"> 
          <LanguageModalPicker languages={rolesOptions} // [{id,name}]
             value={rolesSel} onChange={setRolesSel} disabled={!isOwner} /> 
        </div> 
      </div>

      {/* tech */}
       <div className="torail-card"> 
        <div className="d-flex align-items-center justify-content-between"> 
          <h6 className="mb-0">技術領域</h6> 
          {isOwner && ( <button className="btn btn-primary btn-sm" onClick={() => onSave?.({ techSelected: techSel })}>送信</button> )} 
        </div> 
        <div className="mt-2"> 
          <LanguageModalPicker languages={techOptions} // [{id,name}]
             value={techSel} onChange={setTechSel} disabled={!isOwner} /> 
        </div> 
      </div>

      {/* domain */}
      <div className="torail-card"> 
        <div className="d-flex align-items-center justify-content-between"> 
          <h6 className="mb-0">プロダクト関心ドメイン</h6> 
          {isOwner && ( <button className="btn btn-primary btn-sm" onClick={() => onSave?.({ domain: domainSel })}>送信</button> )} 
        </div> 
        <div className="mt-2"> 
          <LanguageModalPicker languages={domainOptions} // [{id,name}]
             value={domainSel} onChange={setDomainSel} disabled={!isOwner} /> 
        </div> 
      </div>
    </section>
  );
}
