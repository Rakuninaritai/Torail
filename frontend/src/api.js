// src/api.js
const API_BASE = import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '');

function hasRefreshToken() {
  return document.cookie.split(';').some(c => c.trim().startsWith('refresh_token='));
}
function getCSRFCookie() {
  const m = document.cookie.split('; ').find(r => r.startsWith('csrftoken='));
  return m ? decodeURIComponent(m.split('=')[1]) : '';
}

export async function api(path, options = {}) {
  const cleanPath = String(path || '').replace(/^\/+/, '');            // 先頭の / を剥がす
  const url = `${API_BASE}/${cleanPath}`;

  const method = (options.method || 'GET').toUpperCase();
  const needsCSRF = !['GET', 'HEAD', 'OPTIONS'].includes(method);

  // まず options を取り込んでから後で headers を最終合成（順序が大事）
  const config = {
    credentials: 'include',
    // cache: 'no-store',             // 必要ならコメント解除（中間キャッシュ対策）
    ...options,                       // ← 先に展開：ここに options.headers/signal 等が入る
  };

  // 既存 or options.headers をベースにしつつ、必要なら CSRF を付け足す
  const baseHeaders = {
    ...(config.headers || {}),
    ...(needsCSRF ? { 'X-CSRFToken': getCSRFCookie() } : {}),
  };

  // Body種別から Content-Type を調整
  const isFormData = (config.body instanceof FormData);
  const isJSONString = (typeof config.body === 'string' && !isFormData);

  // FormData なら Content-Type はブラウザ任せ（あれば消す）
  if (isFormData && baseHeaders['Content-Type']) {
    delete baseHeaders['Content-Type'];
  }
  // JSON文字列なら Content-Type を自動付与（未指定のときのみ）
  if (isJSONString && !baseHeaders['Content-Type']) {
    baseHeaders['Content-Type'] = 'application/json';
  }

  // 最終 headers を config に反映（ここで options.headers を上書きしない順序に）
  config.headers = baseHeaders;

  // ① 本来のリクエスト
  let res = await fetch(url, config);

  // ② 401 → refresh_token があるときだけリフレッシュして再試行
  if (
    res.status === 401 &&
    !cleanPath.startsWith('token/refresh') &&
    hasRefreshToken()
  ) {
    // refresh にも signal を渡す（Abort 時に確実に止まる）
    const refreshRes = await fetch(`${API_BASE}/token/refresh/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      signal: config.signal, // ← ここ重要
    });

    if (refreshRes.ok) {
      // 新しい access は Cookie に入るのでそのまま再試行（こちらにも signal を渡す）
      res = await fetch(url, { ...config, signal: config.signal });
    } else {
      window.location.href = '/login_register';
      throw new Error('認証が必要です');
    }
  }

  // ③ JSON パース（テキストfallback）
  const text = res.status === 204 ? '' : await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; }
  catch { data = { raw: text }; }

  // ④ ステータスチェック
  if (!res.ok) {
    throw { status: res.status, ...data };
  }

  return data;
}
export async function apiRaw(path, options = {}) {
  // ★ 末尾スラッシュ対策：/api/records → /api/records/ に正規化（301回避）
  const clean = String(path).replace(/([^/])$/, '$1/');
  const res = await fetch(`${API_BASE}${clean}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  // ★ 204は本文が無いのでjson()しない
  if (res.status === 204) return { status: 204, data: null };

  // ★ JSONが返るときだけ読む（非JSONは必要に応じてtextで拾ってもOK）
  const ct = res.headers.get('content-type') || '';
  const body = ct.includes('application/json') ? await res.json() : await res.text();

  return { status: res.status, data: body };
}