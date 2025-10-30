import React, { useState } from 'react'
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { toast } from 'react-toastify';
import { useLocation } from 'react-router-dom';

const RegisterForm = ({ onLoginSuccess, settoken, hc, fixedAccountType, companyFlow }) => {
  const [isLoading, setLoading] = useState(false);
  const API_BASE = import.meta.env.VITE_API_BASE_URL;
  const BACKEND_BASE = import.meta.env.VITE_BACKEND_ORIGIN;
  const location = useLocation();
  const next = new URLSearchParams(location.search).get('next');

  const [credentials, setCredentials] = useState({
    username: "",
    email: "",
    password1: "",
    password2: ""
  });

  const [errors, setErrors] = useState({});

  // 配列正規化ヘルパー
  const toArr = (v) => {
    if (v == null) return [];
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') return [v];
    try { return [JSON.stringify(v)]; } catch { return [String(v)]; }
  };

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const body = { ...credentials };
      if (fixedAccountType) body.account_type = fixedAccountType;

      const res = await fetch(`${API_BASE}auth/registration/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        const norm = {
          non_field_errors: toArr(data.non_field_errors || data.detail),
          username: toArr(data.username),
          email: toArr(data.email),
          password1: toArr(data.password1),
          password2: toArr(data.password2),
        };
        setErrors(norm);
        toast.error("エラーが発生しました。");
        setLoading(false);
        return;
      }

      toast.success("登録成功です!");
      // settoken(data.key);
      onLoginSuccess && onLoginSuccess();
      setLoading(false);
    } catch (err) {
      setErrors({ non_field_errors: ["通信エラーが発生しました。再度お試しください。"] });
      toast.error("通信エラーが発生しました。");
      setLoading(false);
    }
  };

  return (
    <div className='timer-card mx-auto'>
      <form onSubmit={handleSubmit}>
        <h2>登録</h2>
        <div className="d-flex justify-content-center gap-3 mt-3">
          <button type='button' className="btn btn-dark btn-md" onClick={() => hc()}>ログインはこちら</button>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => {
              const currentRelative = `${location.pathname}${location.search}${location.hash}`;
              const frontendNext = next || currentRelative;
              const role = companyFlow ? '&role=company' : '';
              const relay = `/api/auth/social/jwt/?next=${encodeURIComponent(frontendNext)}${role}`;
              window.location.href =
                `${BACKEND_BASE}/accounts/google/login/?process=login&next=${encodeURIComponent(relay)}`;
            }}
          >
            <i className="bi bi-google me-1"></i> Googleで続行
          </button>
        </div>

        {/* ── 全体エラー ── */}
        {toArr(errors.non_field_errors).length > 0 && (
          <div className="alert alert-danger mt-3">
            {toArr(errors.non_field_errors).map((msg, i) => <div key={i}>{msg}</div>)}
          </div>
        )}

        {/* ── ユーザー名 ── */}
        <label htmlFor="username" className="form-label mt-3">ユーザー名</label>
        <small className="form-text text-muted d-block">半角英数記号のみで入力してください。</small>
        <input
          type="text"
          className='form-control mb-3'
          name='username'
          value={credentials.username}
          onChange={handleChange}
          required
          autoComplete="username"
          pattern="[!-~]+"
          title="半角英数字・記号（!～~）のみで入力してください。"
        />
        {toArr(errors.username).map((msg, i) => <div key={i} className="text-danger">{msg}</div>)}

        {/* ── メール ── */}
        <label htmlFor="email" className="form-label mt-3">メールアドレス</label>
        <input
          type="email"
          className='form-control mb-3'
          name='email'
          value={credentials.email}
          onChange={handleChange}
          required
        />
        {toArr(errors.email).map((msg, i) => <div key={i} className="text-danger">{msg}</div>)}

        {/* ── パスワード ── */}
        <label htmlFor="password1" className="form-label mt-3">パスワード</label>
        <small className="form-text text-muted d-block">8文字以上で、大文字と数字を含めてください</small>
        <input
          type="password"
          className='form-control mb-3'
          name='password1'
          value={credentials.password1}
          onChange={handleChange}
          required
          minLength={8}
          pattern="(?=.*[A-Z])(?=.*\d).+"
          title="パスワードは8文字以上で、大文字と数字を含めてください"
          onInvalid={e => e.target.setCustomValidity("8文字以上で、大文字と数字を含む必要があります")}
          onInput={e => e.target.setCustomValidity("")}
          autoComplete="new-password"
        />
        {toArr(errors.password1).map((msg, i) => <div key={i} className="text-danger">{msg}</div>)}

        {/* ── パスワード確認 ── */}
        <label htmlFor="password2" className="form-label mt-3">パスワード(確認用)</label>
        <small className="form-text text-muted d-block">上と同じパスワードを入力してください</small>
        <input
          type="password"
          className='form-control mb-3'
          name='password2'
          value={credentials.password2}
          onChange={handleChange}
          required
          autoComplete="new-password"
        />
        {toArr(errors.password2).map((msg, i) => <div key={i} className="text-danger">{msg}</div>)}

        {/* ── 利用規約 ── */}
        <div className="form-check mb-3 mt-4">
          <input className="form-check-input" type="checkbox" id="termsCheck" required />
          <label className="form-check-label" htmlFor="termsCheck">
            <a href="#" data-bs-toggle="modal" data-bs-target="#termsModal">
              利用規約・プライバシーポリシー
            </a>
            に同意します
          </label>
        </div>

        <div className="d-flex justify-content-center gap-3 mt-3">
          {isLoading ? <Skeleton /> : (
            <button id="startBtn" type='submit' className="btn btn-info btn-lg">
              <i className="bi bi-door-open"></i>
            </button>
          )}
        </div>
      </form>

      {/* モーダル（利用規約） */}
      <div
        className="modal fade"
        id="termsModal"
        tabIndex={-1}
        aria-labelledby="termsModalLabel"
        aria-hidden="true"
      >
        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="termsModalLabel">
                利用規約・プライバシーポリシー
              </h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="閉じる" />
            </div>
            <div className="modal-body" style={{ whiteSpace: 'pre-wrap' }}>
              {/* 必要に応じて利用規約本文をここに残す */}
              <p>（省略）</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">
                閉じる
              </button>
              <button
                type="button"
                className="btn btn-primary"
                data-bs-dismiss="modal"
                onClick={() => { document.getElementById('termsCheck').checked = true; }}
              >
                同意して閉じる
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterForm;
