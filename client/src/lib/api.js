// Same-origin by default: Vite proxies /api in development and Vercel rewrites it in production,
// so the refresh cookie is first-party. VITE_API_URL can point at the API directly instead.
const BASE = import.meta.env.VITE_API_URL ?? '';

let accessToken = null;
let refreshing = null;
const listeners = new Set();

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }

  fieldErrors() {
    const out = {};
    for (const d of Array.isArray(this.details) ? this.details : []) {
      if (d.path && !out[d.path]) out[d.path] = d.message;
    }
    return out;
  }
}

export const getAccessToken = () => accessToken;

export function onSessionChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setSession(session) {
  accessToken = session?.accessToken ?? null;
  listeners.forEach((fn) => fn(session?.user ?? null));
}

async function parse(res) {
  if (res.status === 204) return null;
  const type = res.headers.get('content-type') || '';
  const body = type.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const err = body?.error ?? {};
    throw new ApiError(res.status, err.message || `Request failed (${res.status})`, err.details);
  }
  return body;
}

// Single-flight refresh: concurrent 401s share one /refresh call.
export function refreshSession() {
  if (!refreshing) {
    refreshing = fetch(`${BASE}/api/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(parse)
      .then((session) => {
        // 204 (no cookie) parses to null: signed out.
        setSession(session);
        return session;
      })
      .catch(() => {
        setSession(null);
        return null;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

export async function request(path, { method = 'GET', body, form, retry = true, raw = false } = {}) {
  const headers = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload, credentials: 'include' });
  if (res.status === 401 && retry && accessToken && !path.startsWith('/api/auth/')) {
    const session = await refreshSession();
    if (session) return request(path, { method, body, form, retry: false, raw });
  }
  if (raw) {
    if (!res.ok) await parse(res);
    return res;
  }
  return parse(res);
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  del: (path) => request(path, { method: 'DELETE' }),
  upload: (path, form, method = 'POST') => request(path, { method, form }),
};

export async function download(path, fallbackName) {
  const res = await request(path, { raw: true });
  const disposition = res.headers.get('content-disposition') || '';
  const name = disposition.match(/filename="?([^"]+)"?/)?.[1] || fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const assetUrl = (url) => (url && url.startsWith('/') ? `${BASE}${url}` : url);

export function qs(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') search.set(k, v);
  });
  const s = search.toString();
  return s ? `?${s}` : '';
}
