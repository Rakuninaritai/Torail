// components/UserBadge.jsx
import React from "react";
import { Link } from "react-router-dom";
import "./UserBadge.css";

export default function UserBadge({
  username = "",
  avatarUrl = "",
  inboxCount = 0,
  className = "",
  accountType = null,
}) {
  const initials = (username || "?").slice(0, 2).toUpperCase();
  const hasImg = !!(avatarUrl && avatarUrl.trim());
  const isStudent = (accountType === 'student' || accountType === 'both');
  return (
    <div className={`user-badge d-flex align-items-center gap-2 ${className}`}>
      {isStudent ? (
        <Link
          to={`/mypage/${encodeURIComponent(username)}`}
          className="avatar-link"
          title="マイページ"
        >
          {hasImg ? (
            <img src={avatarUrl} alt={`${username} avatar`} className="user-badge__avatar" />
          ) : (
            <div className="user-badge__avatar user-badge__avatar--fallback" aria-hidden="true">
              {initials}
            </div>
          )}
        </Link>
      ) : (
        <div className="avatar-link" title="マイページ">
          {hasImg ? (
            <img src={avatarUrl} alt={`${username} avatar`} className="user-badge__avatar" />
          ) : (
            <div className="user-badge__avatar user-badge__avatar--fallback" aria-hidden="true">{initials}</div>
          )}
        </div>
      )}

      <div className="flex-grow-1 min-w-0">
        {isStudent ? (
          <Link to={`/mypage/${encodeURIComponent(username)}`} className="user-badge__name text-truncate" title={username}>
            {username}
          </Link>
        ) : (
          <div className="user-badge__name text-truncate" title={username}>{username}</div>
        )}
      </div>

      {isStudent ? (
        <Link to="/dmbox" className="user-badge__inbox" title="受信ボックス">
          <i className="bi bi-inbox-fill"></i>
          {inboxCount > 0 && <span className="user-badge__badge">{inboxCount}</span>}
        </Link>
      ) : null}
    </div>
  );
}
