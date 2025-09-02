
// 統計チームのほかの人引っ張ってきている(個人はその人の作成の奴、チームはそのやつ)
// 言語複数選択、言語履歴呼び出し
// ログイン後前の奴にリンクさせてブロックしているのなら
import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Route, Routes, useNavigate, useParams, useLocation } from 'react-router-dom';

import RecordsList from "./components/RecordsList";
import { TeamProvider, useTeam } from './context/TeamContext';
import AddRecordForm from './components/AddRecordForm';
import RegistrationForm from './components/RegistrationForm';
import LoginForm from './components/LoginForm';
import LogoutBtn from './components/LogoutBtn';
import CreateTeamModal from './components/CreateTeamModal';

import Home from './pages/Home';
import AddRecords from './pages/AddRecords';
import Records from './pages/Records';
import Login_Register from "./pages/Login_Register";
import Settings from "./pages/Settings";
import SlackCallback from "./pages/SlackCallback";

import RecordDetail from "./components/RecordDetail";

import { api } from "./api";
import logo from "../src/assets/TorailLOGO.png"

import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import NotFound from './pages/NotFound';

/* =========================
   Helpers: Bind teamSlug ↔ context, Detail page
   urlからチームを引くことが出来る。直リンクしてもうまくいくように
   ========================= */
function TeamRouteBinder({ children }) {
  const { teamSlug } = useParams();
  const decoded = decodeURIComponent(teamSlug || '');
  const { teams, currentTeamId, selectTeam } = useTeam();
  const navigate = useNavigate();

  const team = useMemo(() => teams.find(t => t.name === decoded), [teams, decoded]);

  useEffect(() => {
    // まだチーム一覧が来てない間は何もしない
    if (!Array.isArray(teams) || teams.length === 0) return;

    // 見つからなければ 404 を出す
    if (!team) return;
    // URL上のチームと現在選択が違えば同期
    if (team.id !== currentTeamId) {
      selectTeam(team.id);
    }
  }, [teams, team, currentTeamId, selectTeam]);

  // 未ロード or 未検出のときの描画を分ける
  if (!Array.isArray(teams) || teams.length === 0) return null;      // 取得中は何も描画しない
  if (!team) {
    return <NotFound message="指定のチームが見つかりません。" />;
  }
  return children;
}

function RecordDetailPage({ token }) {
  const location = useLocation();
  const { recordId } = useParams();
  const navigate = useNavigate();

  const [rec, setRec] = useState(null);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [r, ts] = await Promise.all([
          api(`/records/${recordId}/`, { method: 'GET' }),
          api('/teams/', { method: 'GET' })
        ]);
        setRec(r);
        setTeams(ts);
      } catch (e) {
        setErr(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [recordId]);

  if (loading) return null;
  if (err || !rec) return <NotFound message="記録が見つかりません。" />;

  return <RecordDetail cf={() => navigate(-1)} rec={rec} token={token} teams={teams} />;
}

/* =========================
   App
   ========================= */
function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // レコード更新トリガ
  const [updateFlag, setUpdateFlag] = useState(false);
  const [Token, setToken] = useState(null);
  const [Login, setLogin] = useState(false);

  const { teams, currentTeamId, selectTeam } = useTeam();

  const [errors, setErrors] = useState("");
  const [isLoading, setLoading] = useState(false);

  const refreshRecords = () => setUpdateFlag(!updateFlag);

  const handleLogoutSuccess = () => {
    navigate('/');
    setToken(null);
  };
  const handleLoginSuccess = () => {
    setLogin(!Login);
    navigate('/');
  };

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      api('auth/user/')
        .then(data => setToken(data))
        .catch((err) => {
          setToken(null);
          setErrors(err);
        })
        .finally(() => setLoading(false));
    }, 1000);
  }, [Login]);

  // 個人なら "/" or "/suffix"
  // チーム選択中なら "/<teamName-encoded>" or "/<teamName-encoded>/suffix"
  const teamSlugPath = (suffix = '') => {
    if (!currentTeamId) return suffix ? `/${suffix}` : '/';
    const teamName = teams.find(t => t.id === currentTeamId)?.name || '';
    const base = `/${encodeURIComponent(teamName)}`;
    return suffix ? `${base}/${suffix}` : base;
  };

  return (
    <div className="d-flex vh-100 w-100" style={{ minWidth: 0 }}>
      {/* Sidebar */}
      <nav className="sidebar d-none d-md-flex flex-column">
        <div className="logo">
          <img src={logo} alt="Logo" width={300} />
        </div>

        {Token && (
          <div className="p-3">
            <select
              className="form-select"
              value={currentTeamId || ''}
              onChange={e => {
                const nextId = e.target.value || null;
                selectTeam(nextId);
                // 現在のパスから suffix を抽出（例: "/aaa/addrecords" -> "addrecords"）
                const path = location.pathname;
                const parts = path.split('/').filter(Boolean);
                // レコード詳細は共通なのでそのまま維持
                const isDetail = parts[0] === 'records' && parts[1];
                if (isDetail) return; // /records/:id はコンテキスト関係なし

                // suffix を決定
                // チームパスなら [teamSlug, ...suffix]、個人なら [...suffix]
                const suffix = (() => {
                  if (parts.length === 0) return '';                 // "/"
                  if (parts[0] === 'records' || parts[0] === 'settings' || parts[0] === 'addrecords') {
                    // 個人系: そのまま先頭を suffix に
                    return parts.join('/');
                  }
                  // チーム系: 先頭(teamSlug)を除いた残りを suffix
                  return parts.slice(1).join('/');
                })();

                if (!nextId) {
                  // 個人へ → "/{suffix?}"
                  navigate(suffix ? `/${suffix}` : `/`, { replace: true });
                } else {
                  // チームへ → "/<teamName-encoded>/{suffix?}"
                  const teamName = (teams.find(t => t.id === nextId)?.name) || '';
                  const base = `/${encodeURIComponent(teamName)}`;
                  navigate(suffix ? `${base}/${suffix}` : base, { replace: true });
                }
              }}
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
        )}

        <div className="nav flex-column" id="sidebarNav" role="tablist">
          {/* Home */}
          <NavLink
            to={teamSlugPath('')}
            end
            className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          >
            <i className="bi bi-house-door-fill"></i> ホーム
          </NavLink>

          {/* 測定 */}
          {Token && (
            <NavLink
              to={teamSlugPath('addrecords')}
              className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
            >
              <i className="bi bi-journal-text"></i> 測定
            </NavLink>
          )}

          {/* 統計 */}
          {Token && (
            <NavLink
              to={teamSlugPath('records')}
              className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
            >
              <i className="bi bi-bar-chart-line-fill"></i> 統計
            </NavLink>
          )}

          {/* 設定 */}
          {Token && (
            <NavLink
              to={teamSlugPath('settings')}
              className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
            >
              <i className="bi bi-gear"></i> 設定・招待
            </NavLink>
          )}
        </div>

        {Token && (
          <div className="nav flex-column mt-auto">
            <LogoutBtn
              className="nav-link text-white"
              onLogoutSuccess={handleLogoutSuccess}
            >
              <i className="bi bi-box-arrow-right"></i> ログアウト
            </LogoutBtn>
          </div>
        )}
      </nav>

      {/* Offcanvas for mobile */}
      <div className="offcanvas offcanvas-start d-md-none" tabIndex={-1} id="mobileNav" aria-labelledby="mobileNavLabel">
        <div className="offcanvas-header">
          <h5 id="mobileNavLabel">Menu</h5>
          <button type="button" className="btn-close" data-bs-dismiss="offcanvas" aria-label="Close" />
        </div>
        <div className="offcanvas-body">
          <div className="logo text-center mb-4">
            <img src={logo} alt="Logo" width={300} />
          </div>
          <div className="p-3">
            <select
              className="form-select"
              value={currentTeamId || ''}
              onChange={e => selectTeam(e.target.value || null)}
            >
              <option value="">個人</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {Token && (
              <button
                className="btn btn-outline-secondary w-100 mt-2"
                data-bs-toggle="modal"
                data-bs-target="#createTeamModal"
              >
                ＋ チーム作成
              </button>
            )}
          </div>

          <nav className="nav flex-column">
            <NavLink to={teamSlugPath('')} end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <i className="bi bi-house-door-fill"></i> ホーム
            </NavLink>
            {Token && (
              <NavLink to={teamSlugPath('addrecords')} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                <i className="bi bi-journal-text"></i> 測定
              </NavLink>
            )}
            {Token && (
              <NavLink to={teamSlugPath('records')} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                <i className="bi bi-bar-chart-line-fill"></i> 統計
              </NavLink>
            )}
            {Token && (
              <NavLink to={teamSlugPath('settings')} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                <i className="bi bi-gear"></i> 設定・招待
              </NavLink>
            )}
            {Token && (
              <LogoutBtn className="nav-link mt-3 text-white" onLogoutSuccess={handleLogoutSuccess}>
                <i className="bi bi-box-arrow-right"></i> ログアウト
              </LogoutBtn>
            )}
          </nav>
        </div>
      </div>

      <main className="flex-grow-1 p-3" style={{ backgroundColor: '#f6f8fa' }}>
        <button className="btn btn-outline-secondary d-md-none mb-3" type="button" data-bs-toggle="offcanvas" data-bs-target="#mobileNav">
          <i className="bi bi-list"></i>
        </button>

        <Routes>
          {/* 個人 Home */}
          <Route path="/" element={<Home token={Token} />} />

          {/* 個人 AddRecords / Records */}
          <Route
            path="/addrecords"
            element={Token ? <AddRecords token={Token} onRecordAdded={refreshRecords} updateFlag={updateFlag} /> : <Login_Register onLoginSuccess={handleLoginSuccess} settoken={setToken} />}
          />
          <Route
            path="/records"
            element={Token ? <Records token={Token} koushin={refreshRecords} /> : <Login_Register onLoginSuccess={handleLoginSuccess} settoken={setToken} />}
          />

          {/* 個人 Settings */}
          <Route
            path="/settings"
            element={Token ? <Settings /> : <Login_Register onLoginSuccess={handleLoginSuccess} settoken={setToken} />}
          />

          {/* チーム Home */}
          <Route
            path="/:teamSlug"
            element={Token ? (
              <TeamRouteBinder>
                <Home token={Token} />
              </TeamRouteBinder>
            ) : <Login_Register onLoginSuccess={handleLoginSuccess} settoken={setToken} />}
          />

          {/* チーム AddRecords / Records */}
          <Route
            path="/:teamSlug/addrecords"
            element={Token ? (
              <TeamRouteBinder>
                <AddRecords token={Token} onRecordAdded={refreshRecords} updateFlag={updateFlag} />
              </TeamRouteBinder>
            ) : <Login_Register onLoginSuccess={handleLoginSuccess} settoken={setToken} />}
          />
          <Route
            path="/:teamSlug/records"
            element={Token ? (
              <TeamRouteBinder>
                <Records token={Token} koushin={refreshRecords} />
              </TeamRouteBinder>
            ) : <Login_Register onLoginSuccess={handleLoginSuccess} settoken={setToken} />}
          />

          {/* チーム Settings */}
          <Route
            path="/:teamSlug/settings"
            element={Token ? (
              <TeamRouteBinder>
                <Settings />
              </TeamRouteBinder>
            ) : <Login_Register onLoginSuccess={handleLoginSuccess} settoken={setToken} />}
          />

          {/* レコード詳細（共通） */}
          <Route
            path="/records/:recordId"
            element={Token ? <RecordDetailPage token={Token} /> : <Login_Register onLoginSuccess={handleLoginSuccess} settoken={setToken} />}
          />

          {/* 既存 */}
          <Route path="/login_register" element={<Login_Register onLoginSuccess={handleLoginSuccess} settoken={setToken} />} />
          <Route path="/slack/callback" element={<SlackCallback />} />
          {/* 404ページ常にルート最下層で */}
          <Route path='*' element={<NotFound/>} />
        </Routes>

        <CreateTeamModal />
        {isLoading && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 9999,
              backgroundColor: '#fff'
            }}
          >
            <Skeleton width="100%" height="100%" style={{ display: 'block' }} />
          </div>
        )}
        <ToastContainer
          position='top-right'
          autoClose={3000}
          hideProgressBar={false}
          closeOnClick
          pauseOnHover
          draggable
        />
      </main>
    </div>
  );
}

export default App;

