import axios from 'axios';

/**
 * Shared API client.
 *  - Cookies (HttpOnly access/refresh tokens) are sent automatically; no tokens in JS storage.
 *  - Unsafe requests echo the readable crm_csrf cookie in X-CSRF-Token (double-submit CSRF).
 *  - A 401 TOKEN_EXPIRED triggers ONE shared refresh, then the request is retried once.
 *  - Errors are normalised to ApiError { status, code, message, details, requestId }.
 */
export class ApiError extends Error {
  constructor({ status = 0, code = 'NETWORK_ERROR', message = 'Network error — check your connection', details, requestId } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details || [];
    this.requestId = requestId;
  }
  fieldErrors() {
    return Object.fromEntries((this.details || []).filter((d) => d.path).map((d) => [d.path.replace(/^body\./, ''), d.message]));
  }
}

function readCookie(name) {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * API origin. Empty (default) = same origin: the dev server / nginx proxies /api to the backend.
 * Set VITE_API_URL (e.g. https://api.example.com) at build time to call a separately hosted API directly.
 */
export const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
export const API_BASE = `${API_ORIGIN}/api/v1`;

export const api = axios.create({ baseURL: API_BASE, withCredentials: true, timeout: 30_000 });

api.interceptors.request.use((config) => {
  const method = (config.method || 'get').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const token = readCookie('crm_csrf');
    if (token) config.headers['X-CSRF-Token'] = token;
  }
  return config;
});

let refreshing = null;
const listeners = new Set();
export const onSessionExpired = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

async function refresh() {
  if (!refreshing) {
    refreshing = axios.post(`${API_BASE}/auth/refresh`, null, { withCredentials: true, headers: { 'X-CSRF-Token': readCookie('crm_csrf') || '' } }).finally(() => {
      setTimeout(() => { refreshing = null; }, 0);
    });
  }
  return refreshing;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (axios.isCancel(error)) throw error;
    const res = error.response;
    const original = error.config || {};
    const body = res?.data?.error;
    if (res?.status === 401 && body?.code === 'TOKEN_EXPIRED' && !original.__retried) {
      try {
        await refresh();
        original.__retried = true;
        return api(original);
      } catch {
        listeners.forEach((fn) => fn());
      }
    } else if (res?.status === 401 && ['SESSION_REVOKED', 'INVALID_TOKEN', 'SESSION_EXPIRED'].includes(body?.code)) {
      listeners.forEach((fn) => fn());
    }
    if (!res) throw new ApiError();
    throw new ApiError({ status: res.status, code: body?.code || 'HTTP_ERROR', message: body?.message || `Request failed (${res.status})`, details: body?.details, requestId: body?.request_id });
  }
);

/** Unwraps the { data, meta } envelope. */
export const unwrap = (p) => p.then((r) => r.data);
export const get = (url, params, config) => unwrap(api.get(url, { params, ...config }));
export const post = (url, body, config) => unwrap(api.post(url, body, config));
export const patch = (url, body, config) => unwrap(api.patch(url, body, config));
export const put = (url, body, config) => unwrap(api.put(url, body, config));
export const del = (url, config) => unwrap(api.delete(url, config));

/** Downloads a binary/CSV response through the authenticated client. */
export async function download(url, params, fallbackName = 'download') {
  const res = await api.get(url, { params, responseType: 'blob' });
  const cd = res.headers['content-disposition'] || '';
  const name = /filename="?([^";]+)"?/.exec(cd)?.[1] || fallbackName;
  const href = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
