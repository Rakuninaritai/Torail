// 招待での取得時emailは除外してもいいかも統計のチームでも飛んでるかも、メール飛ばない(SMTPやめる??railwayでのアプデでらしい)
// pw忘れ対応、グーグルソーシャル赤餅でも、バックのhtmlアイコン出ない(いずれもmyp後)
// 自動バックアップ&開発環境
// チーム名アルファベットで
// mypポートフォリオ編集,博士追加,何年卒追加,県選択し追加,言語選択言語の文字消す,エラーtoast分かりやすく,エラー表示
// codexコードデバック
// S3対応か検討
// stripeリクエスト核
import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Route, Routes, useNavigate, useParams, useLocation } from 'react-router-dom';


import { TeamProvider, useTeam } from './context/TeamContext';
import LogoutBtn from './components/LogoutBtn';
import CreateTeamModal from './components/CreateTeamModal';

import Home from './pages/Home';
import AddRecords from './pages/AddRecords';
import Records from './pages/Records';
import Login_Register from "./pages/Login_Register";
import Settings from "./pages/Settings";
import SlackCallback from "./pages/SlackCallback";
import { Navigate } from 'react-router-dom';
import RecordDetail from "./components/Records/RecordDetail";

import { api } from "./api";
import logo from "../src/assets/TorailLOGO.png"

import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import NotFound from './pages/NotFound';
import CompanyDashboard from './pages/Company/CompanyDashboard';
import CompanySettingsPage from './pages/Company/CompanySettings';
import DM from './pages/Company/DM';
import UserPage from './pages/UserPage';
import ScoutBoxPage from './pages/ScoutBox';
import UserBadge from './components/Home/UserBadge';
import PublicCompanyPage from './pages/Company/PublicCompanyPage';
import LoginCompanyPage from './pages/Company/LoginCompanyPage';
import Checkout from './pages/Checkout';
import Success from './pages/Success';

// 非企業アカウントが企業ページにアクセスしたときに表示する案内
function CompanyOnlyMessage() {
  return (
    <div className="container-xxl pb-5">
      <div className="page-header mb-3">
        <i className="bi bi-lock-fill fs-4" />
        <h1 className="title h4 mb-0">企業専用ページ</h1>
        <span className="subtle ms-2">このページは企業アカウント専用です</span>
      </div>
      <section className="torail-card">
        <p>現在のアカウントは企業アカウントではないため、このページにアクセスできません。</p>
        <p className="mb-0">企業として利用するには、企業アカウントでログインするか、アカウントを企業に切り替えてください。</p>
        <div className="mt-3">
          <a className="btn btn-primary me-2" href="/company/login">企業でログイン</a>
          <a className="btn btn-outline-secondary" href="/">ホームへ戻る</a>
        </div>
      </section>
    </div>
  );
}

// 学生専用ページ（受信ボックスなど）に対する案内
function StudentOnlyMessage() {
  return (
    <div className="container-xxl pb-5">
      <div className="page-header mb-3">
        <i className="bi bi-lock-fill fs-4" />
        <h1 className="title h4 mb-0">学生専用ページ</h1>
        <span className="subtle ms-2">このページは学生アカウント専用です</span>
      </div>
      <section className="torail-card">
        <p>現在のアカウントは学生アカウントではないため、このページにアクセスできません。</p>
        <div className="mt-3">
          <a className="btn btn-primary me-2" href="/">ホームへ戻る</a>
        </div>
      </section>
    </div>
  );
}


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
    setLogin(v => !v); // これで auth/user 再取得が走る
  };
  // ソーシャルログインが完了するとフロントにurl付きで送ってくるからそれを判断してトースト出してurl消す
  useEffect(() => {
  const url = new URL(window.location.href);
  if (url.searchParams.get('login') === 'ok') {
    toast.success('ログインに成功しました!');
    // その後クエリをきれいにする
    url.searchParams.delete('login');
    url.searchParams.delete('next');
    window.history.replaceState({}, '', url.pathname + (url.search ? '?' + url.search : '') + url.hash);
  }
}, [navigate]);
  useEffect(() => {
    setLoading(true);
      api('auth/user/')
        .then(data => setToken(data))
        .catch((err) => {
          setToken(null);
          setErrors(err);
        })
        .finally(() => setLoading(false));
  }, [Login]);
  // Token が入ったら、login_register にいた場合は next へ飛ばす
  useEffect(() => {
    if (!Token) return;
    if (location.pathname === '/login_register') {
      const params = new URLSearchParams(location.search);
      const next = params.get('next');
      navigate(next || '/', { replace: true });
    }
  }, [Token, location.pathname, location.search, navigate]);
  useEffect(() => {
  console.log('Token =', Token);
}, [Token]);
  const isCompany = !!(Token && typeof Token === 'object' && Token.account_type === 'company');
  const [MyProfile, setMyProfile] = useState(null);
  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!Token) { setMyProfile(null); return; }
      // 学生アカウント (student または both) の場合のみ profile/me を取得する
      const acct = Token && typeof Token === 'object' ? Token.account_type : null;
      if (acct !== 'student' && acct !== 'both') {
        if (!ignore) setMyProfile(null);
        return;
      }
      try {
        const me = await api('/profile/me/', { method: 'GET' });
        if (!ignore) setMyProfile(me);
      } catch {
        if (!ignore) setMyProfile(null);
      }
    })();
    return () => { ignore = true; };
  }, [Token]);


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
        {Token  && !isCompany&&(
          <div className="px-3 pt-2 pb-1">
            <UserBadge
              username={Token?.username}
              avatarUrl={MyProfile?.avatar_url}
              accountType={Token?.account_type}
              /* inboxCount={未読件数があれば入れる} */
            />
          </div>
        )}
        {Token && isCompany && (
          <div className="px-3 pt-2 pb-1">
            <UserBadge
              username={Token?.username}
              avatarUrl={MyProfile?.avatar_url}
              accountType={Token?.account_type}
            />
            <div className="small text-muted mt-1">企業アカウント</div>
          </div>
        )}

        {Token &&!isCompany && (
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
          {isCompany ? (
            <>
              <NavLink to="/company/dashboard" className={({isActive})=>isActive?'nav-link active':'nav-link'}>
                <i className="bi bi-speedometer2"></i> ダッシュボード
              </NavLink>
              <NavLink to="/company/dmbox" className={({isActive})=>isActive?'nav-link active':'nav-link'}>
                <i className="bi bi-inbox"></i> DMbox
              </NavLink>
              <NavLink to="/company/settings" className={({isActive})=>isActive?'nav-link active':'nav-link'}>
                <i className="bi bi-gear"></i> 会社設定
              </NavLink>
              <NavLink to="/purchase" className={({isActive})=>isActive?'nav-link active':'nav-link'}>
                <i className="bi bi-credit-card"></i> 購入テスト
              </NavLink>
            </>
          ) : (
            <>
              <NavLink to={teamSlugPath('')} end className={({isActive})=>isActive?'nav-link active':'nav-link'}>
                <i className="bi bi-house-door-fill"></i> ホーム
              </NavLink>
              {Token && <NavLink to={teamSlugPath('addrecords')} className={({isActive})=>isActive?'nav-link active':'nav-link'}>
                <i className="bi bi-journal-text"></i> 測定
              </NavLink>}
              {Token && <NavLink to={teamSlugPath('records')} className={({isActive})=>isActive?'nav-link active':'nav-link'}>
                <i className="bi bi-bar-chart-line-fill"></i> 統計
              </NavLink>}
              {Token && <NavLink to={teamSlugPath('settings')} className={({isActive})=>isActive?'nav-link active':'nav-link'}>
                <i className="bi bi-gear"></i> 設定・招待
              </NavLink>}
              {Token && <NavLink to="/purchase" className={({isActive})=>isActive?'nav-link active':'nav-link'}>
                <i className="bi bi-credit-card"></i> 購入テスト
              </NavLink>}
            </>
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

          {/* ユーザーバッジ */}
          {Token && (
            <div className="mb-3 text-center">
                <UserBadge username={Token?.username} avatarUrl={MyProfile?.avatar_url} accountType={Token?.account_type} />
              {isCompany && <div className="small text-muted mt-1">企業アカウント</div>}
            </div>
          )}

          {/* チーム選択（個人のみ） */}
          {!isCompany && Token && (
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
              <button
                className="btn btn-outline-secondary w-100 mt-2"
                data-bs-toggle="modal"
                data-bs-target="#createTeamModal"
              >
                ＋ チーム作成
              </button>
            </div>
          )}

          {/* ナビゲーション */}
          <nav className="nav flex-column">
            {isCompany ? (
              <>
                <NavLink
                  to="/company/dashboard"
                  className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                  data-bs-dismiss="offcanvas"
                >
                  <i className="bi bi-speedometer2"></i> ダッシュボード
                </NavLink>
                <NavLink
                  to="/company/dmbox"
                  className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                  data-bs-dismiss="offcanvas"
                >
                  <i className="bi bi-inbox"></i> DMbox
                </NavLink>
                <NavLink
                  to="/company/settings"
                  className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                  data-bs-dismiss="offcanvas"
                >
                  <i className="bi bi-gear"></i> 会社設定
                </NavLink>
              </>
            ) : (
              <>
                <NavLink
                  to={teamSlugPath('')}
                  end
                  className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                  data-bs-dismiss="offcanvas"
                >
                  <i className="bi bi-house-door-fill"></i> ホーム
                </NavLink>
                {Token && (
                  <NavLink
                    to={teamSlugPath('addrecords')}
                    className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                    data-bs-dismiss="offcanvas"
                  >
                    <i className="bi bi-journal-text"></i> 測定
                  </NavLink>
                )}
                {Token && (
                  <NavLink
                    to={teamSlugPath('records')}
                    className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                    data-bs-dismiss="offcanvas"
                  >
                    <i className="bi bi-bar-chart-line-fill"></i> 統計
                  </NavLink>
                )}
                {Token && (
                  <NavLink
                    to={teamSlugPath('settings')}
                    className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                    data-bs-dismiss="offcanvas"
                  >
                    <i className="bi bi-gear"></i> 設定・招待
                  </NavLink>
                )}
              </>
            )}

            {/* ログアウト */}
            {Token && (
              <LogoutBtn
                className="nav-link mt-3 text-white"
                onLogoutSuccess={handleLogoutSuccess}
                data-bs-dismiss="offcanvas"
              >
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
            element={Token ? <AddRecords token={Token} onRecordAdded={refreshRecords} updateFlag={updateFlag} /> :  (isLoading
         ? null 
         : <Navigate replace to={`/login_register?next=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`} />)}
          />
          <Route
            path="/records"
            element={Token ? <Records token={Token} koushin={refreshRecords} /> :  (isLoading
         ? null 
         : <Navigate replace to={`/login_register?next=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`} />)}
          />

          {/* 個人 Settings */}
          <Route
            path="/settings"
            element={Token ? <Settings /> : (isLoading
         ? null 
         : <Navigate replace to={`/login_register?next=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`} />)}
          />

          {/* チーム Home */}
          <Route
            path="/:teamSlug"
            element={Token ? (
              <TeamRouteBinder>
                <Home token={Token} />
              </TeamRouteBinder>
            ) :  (isLoading
         ? null 
         : <Navigate replace to={`/login_register?next=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`} />)}
          />

          {/* チーム AddRecords / Records */}
          <Route
            path="/:teamSlug/addrecords"
            element={Token ? (
              <TeamRouteBinder>
                <AddRecords token={Token} onRecordAdded={refreshRecords} updateFlag={updateFlag} />
              </TeamRouteBinder>
            ) :  (isLoading
         ? null 
         : <Navigate replace to={`/login_register?next=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`} />)}
          />
          <Route
            path="/:teamSlug/records"
            element={Token ? (
              <TeamRouteBinder>
                <Records token={Token} koushin={refreshRecords} />
              </TeamRouteBinder>
            ) :  (isLoading
         ? null 
         : <Navigate replace to={`/login_register?next=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`} />)}
          />

          {/* チーム Settings */}
          <Route
            path="/:teamSlug/settings"
            element={Token ? (
              <TeamRouteBinder>
                <Settings />
              </TeamRouteBinder>
            ) : (isLoading
         ? null 
         : <Navigate replace to={`/login_register?next=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`} />)}
          />

          {/* レコード詳細（共通） */}
          <Route
            path="/records/:recordId"
            element={Token ? <RecordDetailPage token={Token} /> :  (isLoading
         ? null 
         : <Navigate replace to={`/login_register?next=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`} />)}
          />

          {/* 既存 */}
          <Route path="/login_register" element={<Login_Register onLoginSuccess={handleLoginSuccess} settoken={setToken} />} />
          <Route path="/slack/callback" element={<SlackCallback />} />
          {/* Company routes: require login + company account. */}
          <Route
            path='/company/dashboard'
            element={
              isLoading ? null : (
                Token ? (
                  isCompany ? <CompanyDashboard /> : <CompanyOnlyMessage />
                ) : (
                  <Navigate replace to={`/login_register?next=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`} />
                )
              )
            }
          />
          <Route
            path='/company/dm'
            element={
              isLoading ? null : (
                Token ? (
                  isCompany ? <DM initialUser={"山本 舟人"} /> : <CompanyOnlyMessage />
                ) : (
                  <Navigate replace to={`/login_register?next=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`} />
                )
              )
            }
          />
          <Route
            path='/company/settings'
            element={
              isLoading ? null : (
                Token ? (
                  isCompany ? <CompanySettingsPage isAdmin={true} /> : <CompanyOnlyMessage />
                ) : (
                  <Navigate replace to={`/login_register?next=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`} />
                )
              )
            }
          />
          <Route path="/mypage/:username" element={<UserPage token={Token} />} />
          <Route
            path='/dmbox'
            element={
              isLoading ? null : (
                Token ? (
                  (Token.account_type === 'student' || Token.account_type === 'both') ? <ScoutBoxPage /> : <StudentOnlyMessage />
                ) : (
                  <Navigate replace to={`/login_register?next=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`} />
                )
              )
            }
          />
          <Route
            path='/company/dmbox'
            element={
              isLoading ? null : (
                Token ? (
                  isCompany ? <ScoutBoxPage /> : <CompanyOnlyMessage />
                ) : (
                  <Navigate replace to={`/login_register?next=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`} />
                )
              )
            }
          />
          {/* 仮追加 */}
          <Route path='/company/public/:slug' element={<PublicCompanyPage/>}/>
          <Route path='/company/login' element={<LoginCompanyPage/>}/>
          <Route/>

          {/* Stripe success page */}
          <Route path="/success" element={<Success />} />
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

