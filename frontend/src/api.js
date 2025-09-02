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

export async function api(path, options = {}) {
  const cleanPath = path.replace(/^\/+/, '');
  const url = `${API_BASE}/${cleanPath}`;

  // Cookie を必ず送る
  const config = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  };

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
      // 新しいアクセストークンを取得してヘッダーにセット
      const { access } = await refreshRes.json();
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${access}`,
      };
      // 再リクエスト
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
