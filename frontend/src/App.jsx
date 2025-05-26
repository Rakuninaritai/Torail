// import './App.css'
import RecordsList from "./components/RecordsList";
import { useEffect, useState } from 'react';
import AddRecordForm from './components/AddRecordForm';
import RegistrationForm from './components/RegistrationForm';
import LoginForm from './components/LoginForm';
import LogoutBtn from './components/LogoutBtn';
import { Link, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import AddRecords from './pages/AddRecords';
import Records from './pages/Records';
import Login_Register from "./pages/Login_Register";
import { api } from "./api";
function App() {
  
  // この値が変わったらレコードが更新されたことにする
  const [updateFlag,setUpdateFlag]=useState(false)
  const [Token,setToken]=useState(false)
  // エラー表示などのmessagestate
  const [errors,setErrors]=useState("")

  // 値を変わらせるやつ(レコードのフォームに渡してる、あっちでこれを呼び出す)
  const refreshRecords=()=>{
    setUpdateFlag(!updateFlag)
  }
  const handleLogoutSuccess=()=>{
    setToken("")
  }
  useEffect(()=>{
     api('auth/user/')
      .then(data => {setToken(data)
        console.log(data)
      })
  
      .catch((err) => {
        setToken(null)
        setErrors(err)
      })
  },[updateFlag])
  return (
    <div className="d-flex vh-100 w-100" style={{ minWidth: 0 }}>
      {/* <!-- Sidebar for desktop --> */}
      <nav className="sidebar d-none d-md-flex flex-column">
        <div className="logo">
          <img src="https://via.placeholder.com/120x40?text=LOGO" alt="Logo"/>
        </div>
        <div className="nav flex-column" id="sidebarNav" role="tablist">
          <Link
            className="nav-link active"
            to="/"
          >
            <i className="bi bi-house-door-fill"></i> ホーム
          </Link>
          <Link
            className="nav-link"
            to="/addrecords"
          >
            <i className="bi bi-journal-text"></i> 記録
          </Link>
          <Link
            className="nav-link"
            to="/records"
          >
            <i className="bi bi-bar-chart-line-fill"></i> 統計
          </Link>
        </div>
        {/* ログアウト */}
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
      <div
        className="offcanvas offcanvas-start d-md-none"
        tabIndex={-1}
        id="mobileNav"
        aria-labelledby="mobileNavLabel"
      >
        <div className="offcanvas-header">
          <h5 id="mobileNavLabel">Menu</h5>
          <button
            type="button"
            className="btn-close"
            data-bs-dismiss="offcanvas"
            aria-label="Close"
          />
        </div>
        <div className="offcanvas-body">
          <div className="logo text-center mb-4">
            <img
              src="https://via.placeholder.com/120x40?text=LOGO"
              alt="Logo"
            />
          </div>
          <nav className="nav flex-column">
            <Link
              className="nav-link active"
              data-bs-toggle="pill"
              to="/"
            >
              <i className="bi bi-house-door-fill"></i> ホーム
            </Link>
            <Link
              className="nav-link"
              data-bs-toggle="pill"
              to="/addrecords"
            >
              <i className="bi bi-journal-text"></i> 記録
            </Link>
            <Link
              className="nav-link"
              data-bs-toggle="pill"
              to="/records"
            >
              <i className="bi bi-bar-chart-line-fill"></i> 統計
            </Link>
            {Token && (
              <LogoutBtn
                className="nav-link mt-3 text-white"
                onLogoutSuccess={handleLogoutSuccess}
              >
                <i className="bi bi-box-arrow-right"></i> ログアウト
              </LogoutBtn>
            )}
          </nav>
        </div>
      </div>

      <main className="flex-grow-1 p-3" style={{ backgroundColor: '#f6f8fa' }}>
        {/* 送信エラー */}
        {errors.detail && (
          <div className="text-danger mt-1">
            <div>{errors.detail}</div>
          </div>
        )}
        {/* モバイル時のオフキャンバス・トグルボタンはそのまま */}
        <button
          className="btn btn-outline-secondary d-md-none mb-3"
          type="button"
          data-bs-toggle="offcanvas"
          data-bs-target="#mobileNav"
        >
          <i className="bi bi-list"></i>
        </button>

        {/* ここで Routes を定義 */}
        <Routes>
          {/* ホーム画面 */}
          <Route
            path="/"
            element={<Home />}
          />

          {/* 記録追加画面 */}
          <Route
            path="/addrecords"
            element={
              Token
                ? <AddRecords token={Token} onRecordAdded={refreshRecords} updateFlag={updateFlag} />
                : <Login_Register onLoginSuccess={refreshRecords} settoken={setToken} />
            }
          />

          {/* 統計画面 */}
          <Route
            path="/records"
            element={
              Token
                ? <Records token={Token} koushin={refreshRecords} />
                : <Login_Register onLoginSuccess={refreshRecords} settoken={setToken} />
            }
          />

          {/* ログイン専用ページを用意しておきたい場合 */}
          <Route
            path="/login_register"
            element={<Login_Register onLoginSuccess={refreshRecords} settoken={setToken} />}
          />
        </Routes>
      </main>
    </div>
  )
}

export default App
