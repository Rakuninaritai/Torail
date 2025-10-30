// components/UserBadge.jsx
import React from "react";
import { Link } from "react-router-dom";
import "./UserBadge.css";

export default function UserBadge({
  username = "",
  avatarUrl = "",
  inboxCount = 0,
  className = "",
}) {
  const initials = (username || "?").slice(0, 2).toUpperCase();
  const hasImg = !!(avatarUrl && avatarUrl.trim());

  return (
    <div className={`user-badge d-flex align-items-center gap-2 ${className}`}>
      <Link
        to={`/mypage/${encodeURIComponent(username)}`}
        className="avatar-link"
        title="マイページ"
      >
        {hasImg ? (
          <img
            src={avatarUrl}
            alt={`${username} avatar`}
            className="user-badge__avatar"
          />
        ) : (
          <div
            className="user-badge__avatar user-badge__avatar--fallback"
            aria-hidden="true"
          >
            {initials}
          </div>
        )}
      </Link>

      <div className="flex-grow-1 min-w-0">
        <Link
          to={`/mypage/${encodeURIComponent(username)}`}
          className="user-badge__name text-truncate"
          title={username}
        >
          {username}
        </Link>
      </div>

      <Link to="/scoutbox" className="user-badge__inbox" title="受信ボックス">
        <i className="bi bi-inbox-fill"></i>
        {inboxCount > 0 && <span className="user-badge__badge">{inboxCount}</span>}
      </Link>
    </div>
  );
}
