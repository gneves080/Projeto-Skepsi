const API_BASE = '';

const els = {
  userEmail: document.getElementById('userEmail'),
  btnLogout: document.getElementById('btnLogout'),

  btnReload: document.getElementById('btnReload'),
  logsLimit: document.getElementById('logsLimit'),
  logsTbody: document.getElementById('logsTbody'),
  logsEmpty: document.getElementById('logsEmpty'),

  adminError: document.getElementById('adminError'),
  adminStatus: document.getElementById('adminStatus'),

  navLinks: Array.from(document.querySelectorAll('[data-nav]'))
};

const state = {
  token: localStorage.getItem('token') || null
};

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(state.token ? { Authorization: `Bearer ${state.token}` } : {})
  };
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers || {})
    }
  });

  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch {}
    const message = data?.message || `Erro HTTP ${res.status}`;
    throw new Error(message);
  }

  return res.json();
}

function decodeEmailFromToken(token) {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const obj = JSON.parse(json);
    return obj.email || null;
  } catch {
    return null;
  }
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '<')
    .replaceAll('>', '>')
    .replaceAll('"', '"')
    .replaceAll("'", '&#039;');
}

els.navLinks.forEach(b => {
  b.addEventListener('click', () => {
    const target = b.dataset.nav;
    if (target === 'admin') return;
    if (target === 'dashboard') location.href = './index.html';
    if (target === 'pacientes') location.href = './index.html';
  });
});

els.btnLogout.addEventListener('click', () => {
  localStorage.removeItem('token');
  location.href = './index.html';
});

function renderLogs(logs) {
  els.logsTbody.innerHTML = '';
  els.logsEmpty.style.display = logs?.length ? 'none' : 'block';

  (logs || []).forEach(l => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(l.createdAt || '')}</td>
      <td>${escapeHtml(l.email || '')}</td>
      <td>
        ${l.ok
          ? '<span style="color:#079669;font-weight:700">OK</span>'
          : '<span style="color:#b42318;font-weight:700">FALHA</span>'}
      </td>
      <td>${escapeHtml(l.message || '')}</td>
    `;
    els.logsTbody.appendChild(tr);
  });
}

async function loadLogs() {
  els.adminError.textContent = '';
  els.adminStatus.textContent = '';

  const limit = els.logsLimit?.value ? Number(els.logsLimit.value) : 200;

  try {
    const data = await api(`/api/admin/login-logs?limit=${encodeURIComponent(limit)}`);
    renderLogs(data?.logs || []);
    els.adminStatus.textContent = 'Atualizado.';
  } catch (err) {
    els.adminError.textContent = String(err.message || err);
    els.logsEmpty.style.display = 'none';
  }
}

function initAuthGate() {
  if (!state.token) {
    location.href = './login.html';
    return false;
  }

  const email = decodeEmailFromToken(state.token);
  if (els.userEmail) els.userEmail.textContent = email || 'Usuário';
  return true;
}

els.btnReload?.addEventListener('click', async () => {
  await loadLogs();
});

(async function init() {
  if (!initAuthGate()) return;
  await loadLogs();
})();

