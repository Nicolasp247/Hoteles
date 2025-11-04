// public/components/ui.js
export function toast(message, { duration = 1800, type = 'info' } = {}) {
  const el = document.createElement('div');
  el.textContent = message;
  el.style.cssText = `
    position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
    background: ${type === 'error' ? '#b91c1c' : '#111827'};
    color: #fff; padding: 10px 14px; border-radius: 10px; z-index: 9999;
    box-shadow: 0 6px 18px rgba(0,0,0,.25); font: 14px/1.2 system-ui, Arial;
  `;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

export function showError(err) {
  const msg = err?.message || String(err) || 'Error desconocido';
  toast(msg, { type: 'error', duration: 2600 });
}

export function confirmModal({
  title = '¿Confirmar?',
  message = '',
  okText = 'Aceptar',
  cancelText = 'Cancelar'
} = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,.35);
      display: grid; place-items: center; z-index: 10000;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      width: min(520px, 92vw); background: #fff; border-radius: 14px;
      box-shadow: 0 20px 40px rgba(0,0,0,.25); padding: 18px 20px; 
      font: 15px/1.5 system-ui, Arial; color: #111827;
    `;
    modal.innerHTML = `
      <h3 style="margin:0 0 8px;font:600 18px system-ui, Arial">${title}</h3>
      <p style="margin:0 0 16px;white-space:pre-wrap">${message}</p>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button data-cancel
          style="padding:10px 14px;border-radius:10px;border:1px solid #d1d5db;background:#fff;cursor:pointer">
          ${cancelText}
        </button>
        <button data-ok
          style="padding:10px 14px;border-radius:10px;border:0;background:#2563eb;color:#fff;cursor:pointer">
          ${okText}
        </button>
      </div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    function close(v) { overlay.remove(); resolve(v); }
    modal.querySelector('[data-ok]').addEventListener('click', () => close(true));
    modal.querySelector('[data-cancel]').addEventListener('click', () => close(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    window.addEventListener('keydown', onKey);
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(false); window.removeEventListener('keydown', onKey); }
    }
  });
}

// Spinner global opcional
let _spinnerCount = 0, _spinnerEl = null;
export function showLoading() {
  _spinnerCount++;
  if (_spinnerEl) return;
  _spinnerEl = document.createElement('div');
  _spinnerEl.style.cssText = `
    position: fixed; inset:0; display:grid; place-items:center; z-index: 9998;
    background: rgba(255,255,255,.45);
  `;
  _spinnerEl.innerHTML = `
    <div style="
      width:48px;height:48px;border:4px solid #93c5fd;border-top-color:#2563eb;
      border-radius:50%; animation:spin 0.9s linear infinite"></div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
  `;
  document.body.appendChild(_spinnerEl);
}
export function hideLoading() {
  _spinnerCount = Math.max(0, _spinnerCount - 1);
  if (_spinnerEl && _spinnerCount === 0) {
    _spinnerEl.remove(); _spinnerEl = null;
  }
}

/**
 * setLoading(btn, boolean)
 * Desactiva un botón y muestra un texto temporal mientras hay operación.
 */
export function setLoading(btn, loading, textWhileLoading = 'Guardando…') {
  if (!btn) return;
  if (loading) {
    btn.dataset._orig = btn.textContent;
    btn.textContent = textWhileLoading;
    btn.disabled = true;
    btn.style.opacity = '0.7';
    btn.style.cursor = 'not-allowed';
  } else {
    btn.textContent = btn.dataset._orig || btn.textContent;
    btn.disabled = false;
    btn.style.opacity = '';
    btn.style.cursor = '';
  }
}
