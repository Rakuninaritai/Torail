// src/api.js
const API_BASE = import.meta.env.VITE_API_BASE_URL.replace(/\/$/, ''); 
// 末尾の「/」を勝手に落としておく

/**
 * 汎用 fetch ヘルパー
 * ・HttpOnly Cookie (access, refresh) を自動で送受信
 * ・401 が返ってきたら一度だけ /token/refresh/ を叩いて再リクエスト
 */
export async function api(path, options = {}) {
  // path の先頭の「/」も潰しておく
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

  // ② 401 → リフレッシュ試行
  if (res.status === 401 && !cleanPath.startsWith('token/refresh')) {
    const refreshRes = await fetch(`${API_BASE}/token/refresh/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      // body は空で OK（Cookie の中の refresh_token を使う）
      body: JSON.stringify({}),
    });
    if (refreshRes.ok) {
      // 成功したら再度オリジナルエンドポイントを呼ぶ
      res = await fetch(url, config);
    } else {
      // リフレッシュ失敗 → 強制ログイン画面へ
      window.location.href = '/login_register';
      throw new Error('認証が必要です');
    }
  }

  // ③ JSON パース
  const data = (res.status === 204)
  ? null            // or {}／[]など、好みで
  : await res.json()
  // ④ ステータスチェック
  if (!res.ok) {
    // 400/500 系は呼び出し元にそのまま投げる
    throw data;
  }
  return data;
}
