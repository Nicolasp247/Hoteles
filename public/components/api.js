// public/components/api.js
// Cliente mínimo para nuestro backend bajo el prefijo /api

const BASE = '/api';
const DEFAULT_TIMEOUT_MS = 15000;

function withTimeout(promise, ms = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Timeout de red')), ms);
    promise.then(v => { clearTimeout(t); resolve(v); })
           .catch(e => { clearTimeout(t); reject(e); });
  });
}

async function request(path, { method = 'GET', body, headers = {}, timeout } = {}) {
  const init = { method, headers: { ...headers } };

  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
    init.headers['Content-Type'] = init.headers['Content-Type'] || 'application/json';
  }

  const res = await withTimeout(fetch(`${BASE}${path}`, init), timeout);

  // 204 No Content
  if (res.status === 204) return null;

  // Intenta parsear JSON si viene como JSON
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = data;
    throw err;
  }

  return data;
}

// Helpers públicos
export const api = {
  get: (p, opts)           => request(p, { ...opts, method: 'GET' }),
  post: (p, body, opts)    => request(p, { ...opts, method: 'POST', body }),
  put: (p, body, opts)     => request(p, { ...opts, method: 'PUT',  body }),
  del: (p, opts)           => request(p, { ...opts, method: 'DELETE' }),

  // Utilidad para construir query strings: api.qs({a:1,b:'x'}) -> "?a=1&b=x"
  qs(params) {
    if (!params) return '';
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return;
      if (Array.isArray(v)) v.forEach(item => usp.append(k, item));
      else usp.set(k, v);
    });
    const s = usp.toString();
    return s ? `?${s}` : '';
  }
};
