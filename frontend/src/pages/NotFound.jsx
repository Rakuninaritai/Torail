// src/pages/NotFound.jsx
import React, { useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTeam } from '../context/TeamContext';

export default function NotFound({ message }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { teams, currentTeamId } = useTeam();

  // 現在のホーム（個人 or 選択中チーム）のURLを作る
  const homeHref = (() => {
    if (!currentTeamId) return '/';
    const teamName = teams.find(t => t.id === currentTeamId)?.name || '';
    return `/${encodeURIComponent(teamName)}`;
  })();

  useEffect(() => {
    document.title = 'Torail | 404 Not Found';
  }, []);

  return (
    <div className="container d-flex align-items-center justify-content-center" style={{ minHeight: '70vh' }}>
      <div className="text-center">
        <h1 className="display-4 fw-bold">404</h1>
        <p className="lead mb-2">お探しのページは見つかりませんでした。</p>
        {message && <p className="text-muted mb-2">{message}</p>}
        <div className="small text-muted mb-4">URL: <code>{location.pathname}</code></div>

        <div className="d-flex gap-2 justify-content-center">
          <button className="btn btn-outline-secondary" onClick={() => navigate(-1)}>
            戻る
          </button>
          <Link className="btn btn-primary" to={homeHref}>
            ホームへ
          </Link>
        </div>

        <div className="mt-4">
          <Link className="text-decoration-none" to="/login_register">
            ログイン / 新規登録
          </Link>
        </div>
      </div>
    </div>
  );
}
