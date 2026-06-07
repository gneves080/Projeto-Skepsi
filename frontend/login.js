const API_BASE = '';

const els = {
  loginForm: document.getElementById('loginForm'),
  loginError: document.getElementById('loginError')
};

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
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

els.loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  els.loginError.textContent = '';

  const fd = new FormData(els.loginForm);
  const email = fd.get('email');
  const senha = fd.get('senha');

  try {
    const data = await api('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });

    localStorage.setItem('token', data.token);
    location.href = './index.html';
  } catch (err) {
    // Mensagem genérica (não revelar dados internos)
    els.loginError.textContent = 'Falha no login. Verifique suas credenciais.';
  }
});

// Forgot password (MVP - UI only)
const btnForgot = document.getElementById('btnForgot');
const btnBackToLogin = document.getElementById('btnBackToLogin');
const forgotPanel = document.getElementById('forgotPanel');
const forgotForm = document.getElementById('forgotForm');
const forgotStatus = document.getElementById('forgotStatus');
const forgotError = document.getElementById('forgotError');

function showForgot() {
  if (forgotPanel) forgotPanel.style.display = 'block';
  if (els.loginForm) els.loginForm.style.display = 'none';
}

function showLogin() {
  if (forgotPanel) forgotPanel.style.display = 'none';
  if (els.loginForm) els.loginForm.style.display = 'flex';
}

btnForgot?.addEventListener('click', () => {
  if (!forgotPanel) return;
  forgotStatus.textContent = '';
  forgotError.textContent = '';
  showForgot();
});

btnBackToLogin?.addEventListener('click', () => {
  if (!forgotPanel) return;
  forgotStatus.textContent = '';
  forgotError.textContent = '';
  showLogin();
});

forgotForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  forgotError.textContent = '';
  const fd = new FormData(forgotForm);
  const email = fd.get('email');

  // MVP: não existe endpoint de recuperação ainda.
  // Mensagem genérica para não revelar se email existe no banco.
  forgotStatus.textContent = 'Se o e-mail existir, enviaremos instruções de recuperação.';
});


