// src/App.jsx
import './App.css';
import { BrowserRouter as Router, NavLink, Routes, Route, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { TeamProvider, useTeam } from './context/TeamContext';
import logo from '../src/assets/TorailLOGO.png';
import { api } from './api';

import Home from './pages/Home';
import AddRecords from './pages/AddRecords';
import Records from './pages/Records';
import Settings from './pages/Settings';
import Login_Register from './pages/Login_Register';
import LogoutBtn from './components/LogoutBtn';
import CreateTeamModal from './components/CreateTeamModal';

function Sidebar() {
  const navigate = useNavigate();
  const { teams, currentTeamId, selectTeam ,refreshTeams} = useTeam();
  const [Token, setToken] = useState(null);
  const [Login, setLogin] = useState(false);

  // サーバー認証チェック
  useEffect(() => {
    api('auth/user/')
      .then(user => setToken(user))
      .catch(() => setToken(null));
    refreshTeams()
  }, [Login]);

  const handleLogoutSuccess = () => {
    setToken(null);
    navigate('/');
  };
  const handleLoginSuccess = () => {
    setLogin(!Login);
    navigate('/');
  };

  return (
    <nav className="sidebar d-none d-md-flex flex-column">
      <div className="logo p-3">
        <img src={logo} alt="Torail Logo" width={200} />
      </div>

      {/* 個人／チーム 切替 */}
      <div className="p-3">
        <select
          className="form-select"
          value={currentTeamId || ''}
          onChange={e => selectTeam(e.target.value || null)
          }
        >
          <option value="">個人</option>
          {teams.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <button
          className="btn btn-outline-secondary w-100 mt-2"
          data-bs-toggle="modal"
          data-bs-target="#createTeamModal"
        >
          ＋ チーム作成
        </button>
      </div>

      <div className="nav flex-column">
        <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          ホーム
        </NavLink>

        {/* ログイン後のみ表示 */}
        {Token && (
          <>
            <NavLink to="/addrecords" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              測定
            </NavLink>
            <NavLink to="/records" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              統計
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              設定
            </NavLink>
          </>
        )}
      </div>

      {/* ログアウトボタン */}
      {Token ? (
        <div className="mt-auto p-3">
          <LogoutBtn className="btn btn-danger w-100" onLogoutSuccess={handleLogoutSuccess}>
            ログアウト
          </LogoutBtn>
        </div>
      ) : (
        <div className="mt-auto p-3">
          <NavLink to="/login_register" className="btn btn-primary w-100">
            ログイン／登録
          </NavLink>
        </div>
      )}

      {/* チーム作成モーダル */}
      <CreateTeamModal />
    </nav>
  );
}

export default function App() {
  return (
    <TeamProvider>
      {/* <Router> */}
        <div className="d-flex vh-100 w-100" style={{ minWidth: 0 }}>
          <Sidebar />

          <main className="flex-grow-1 p-3 bg-light">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route
                path="/addrecords"
                element={
                  /* Token は Sidebar 内で管理
                     個別ページ内でも api('auth/user/') を利用 */
                  <AddRecords />
                }
              />
              <Route path="/records" element={<Records />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/login_register" element={<Login_Register onLoginSuccess={() => { /* handled in Sidebar */ }} />} />
            </Routes>
          </main>
        </div>
      {/* </Router> */}
    </TeamProvider>
  );
}
