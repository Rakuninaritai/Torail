// src/api.js
const API_BASE = import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '');

/**
 * 汎用 fetch ヘルパー
 * ・HttpOnly Cookie (access, refresh) を自動で送受信
 * ・401 が返ってきたら一度だけ /token/refresh/ を叩いて再リクエスト、
 *   成功したら Authorization ヘッダーに新しい access をセット
 */
function hasRefreshToken() {
  return document.cookie
    .split(';')
    .some(c => c.trim().startsWith('refresh_token='));
}
function getCSRFCookie() {
  const m = document.cookie.split('; ').find(r => r.startsWith('csrftoken='))
  return m ? decodeURIComponent(m.split('=')[1]) : ''
}
export async function api(path, options = {}) {
  const cleanPath = path.replace(/^\/+/, '');
  const url = `${API_BASE}/${cleanPath}`;

  const method = (options.method || 'GET').toUpperCase()
  const needsCSRF = !['GET', 'HEAD', 'OPTIONS'].includes(method)
  const isFormData = (options.body instanceof FormData);
  const isJSONString = (
      typeof options.body === 'string' &&
      !isFormData
    );
  // Cookie を必ず送る
  const config = {
    credentials: 'include',
    headers: {
      // 'Content-Type': 'application/json',
      ...(needsCSRF ? { 'X-CSRFToken': getCSRFCookie() } : {}),
      ...(options.headers || {}),
    },
    ...options,
  };
  // FormData のときは Content-Type を消す（ブラウザに任せる）
  if (isFormData && config.headers['Content-Type']) {
    delete config.headers['Content-Type'];
  }
  // JSON文字列を送るのに Content-Type が無い場合は自動で付与
  if (isJSONString && !config.headers['Content-Type']) {
    config.headers['Content-Type'] = 'application/json';
  }

  // ① 本来のリクエスト
  let res = await fetch(url, config);

  // ② 401 → （かつ refresh_token があるときだけ）リフレッシュ試行
  if (
    res.status === 401 &&
    !cleanPath.startsWith('token/refresh') &&
    hasRefreshToken()
  ) {
    const refreshRes = await fetch(`${API_BASE}/token/refresh/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    if (refreshRes.ok) {
      // Cookie に新しい access が入っただけなので、そのまま再試行（ヘッダー変更不要）
      res = await fetch(url, config);
    } else {
      // リフレッシュ失敗 → 強制ログイン画面へ
      window.location.href = '/login_register';
      throw new Error('認証が必要です');
    }
  }

  // // ③ JSON パース
  // const data = res.status === 204 ? null : await res.json();

  // // ④ ステータスチェック
  // if (!res.ok) {
  //   // 400/500 系は呼び出し元にそのまま投げる
  //   throw data;
  // }
  // return data;
  // ③ JSON パース
const text = res.status === 204 ? '' : await res.text();
let data;
try { data = text ? JSON.parse(text) : null; }
catch { data = { raw: text }; }

// ④ ステータスチェック
if (!res.ok) {
  // ステータスと本文をそのまま throw
  throw { status: res.status, ...data };
}
return data;
}
