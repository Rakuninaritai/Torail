
import React from "react";
import { useNavigate } from "react-router-dom";
import { useTeam } from "../context/TeamContext";
import TeamHome from "../components/Team_Home";
import { NavLink } from 'react-router-dom';

/* 
  Home 画面
  - ログイン状態で分岐
  - Bootstrap 5 のユーティリティでシンプルにレイアウト
*/
const Home = ({ token }) => {
  document.title="Torail|ホーム"
  const navigate = useNavigate();
  const { currentTeamId } = useTeam();

  return (
    <div id="home" className="container py-5">
      {/* ────── 1) Hero ────── */}
      <section className="text-center mb-5">
        <h1 className="display-4 fw-bold mb-3">
          <i className="bi bi-house-door"></i> Torail へようこそ
        </h1>
        
        <p className="lead mb-4">
          <span className="fw-semibold">
            ひとりの学びも、みんなの創作も――もっとアクティブに
          </span>
          。
          <br className="d-none d-md-block" />
          記録・統計・チーム通知までワンストップでサポートします。
        </p>

        {/* 行動ボタン：非ログイン時のみ表示 */}
        {!token && (
          <button
            type="button"
            className="btn btn-dark btn-lg px-4"
            onClick={() => navigate("/login_register")}
          >
            <i className="bi bi-door-open"></i> ログイン / 会員登録
          </button>
        )}
      </section>

      {/* ────── 2) Features ────── */}
      <section className="row g-4 mb-5">
        <div className="col-md-4">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-body text-center">
              <i className="bi bi-stopwatch display-5 mb-3 text-primary"></i>
              <h5 className="card-title fw-semibold">タイムトラッキング</h5>
              <p className="card-text small">
                ワンクリックで作業時間を計測。履歴やメモも残せます。
              </p>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-body text-center">
              <i className="bi bi-bar-chart-line display-5 mb-3 text-success"></i>
              <h5 className="card-title fw-semibold">統計ダッシュボード</h5>
              <p className="card-text small">
                教科別・課題別の作業量をグラフで可視化し、進捗をひと目で確認。
              </p>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-body text-center">
              <i className="bi bi-bell display-5 mb-3 text-warning"></i>
              <h5 className="card-title fw-semibold">チーム通知</h5>
              <p className="card-text small">
                メンバーの記録を メール へリアルタイム通知。
                仲間と励まし合えます。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ────── 3) Team ダッシュボード（ログイン & チーム選択時のみ） ────── */}
      {token && currentTeamId && (
        <section className="mb-5">
          <h2 className="h4 fw-bold mb-3">
            <i className="bi bi-people"></i> チームダッシュボード
          </h2>
          <TeamHome />
        </section>
      )}

       <footer className="mt-auto py-1">
          <div className="container text-center text-muted small opacity-75">
            <span>v2.0.0</span>
            <span className="mx-2">|</span>
            <a href="https://github.com/Rakuninaritai/Torail.git"
              target="_blank" rel="noopener noreferrer"
              className="text-muted text-decoration-none text-nowrap">
              最新コードをGitHubで公開中
            </a>
            <span className="mx-2">|</span>
            <span>© {new Date().getFullYear()} Shuto Yamamoto</span>
            <span className="mx-2">|</span>
            <span className="text-nowrap">本サービス内容について一切責任を負いません</span>
          </div>
        </footer>
    </div>
  );
};

export default Home;
