import React, { useState } from "react";

export default function MemberManagementCard({ members, setMembers, isAdmin }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);

  const handleSearch = () => {
    // 仮検索結果
    setResults([
      { name: "新規社員", email: "new@corp.example", role: "メンバー" }
    ]);
  };

  const handleAdd = (m) => {
    setMembers([...members, m]);
    setResults([]);
    setSearch("");
  };

  const handleDelete = (idx) => {
    setMembers(members.filter((_,i)=>i!==idx));
  };

  return (
    <div className="torail-card">
      <h6 className="mb-2">メンバー</h6>
      {isAdmin && (
        <div className="input-group mb-3">
          <input className="form-control" placeholder="メールで検索"
                 value={search} onChange={(e)=>setSearch(e.target.value)}/>
          <button className="btn btn-outline-secondary" onClick={handleSearch}>
            <i className="bi bi-search"></i>
          </button>
        </div>
      )}
      {results.length>0 && (
        <div className="list-group mb-3">
          {results.map((r,i)=>(
            <div key={i} className="list-group-item d-flex justify-content-between align-items-center">
              {r.name} ({r.email})
              <button className="btn btn-sm btn-primary" onClick={()=>handleAdd(r)}>追加</button>
            </div>
          ))}
        </div>
      )}
      <ul className="list-group">
        {members.map((m,i)=>(
          <li key={i} className="list-group-item d-flex justify-content-between align-items-center">
            {m.name} ({m.email})
            <span className={`badge ${m.role==="管理者"?"text-bg-primary":"text-bg-secondary"}`}>{m.role}</span>
            {isAdmin && (
              <button className="btn btn-sm btn-outline-danger" onClick={()=>handleDelete(i)}>
                <i className="bi bi-x"></i>
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
