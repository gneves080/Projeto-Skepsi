const API_BASE = '';

const els = {
  userEmail: document.getElementById('userEmail'),

  pageTitle: document.getElementById('pageTitle'),
  navLinks: Array.from(document.querySelectorAll('.nav-link')),

  btnLogout: document.getElementById('btnLogout'),
  btnNewPatient: document.getElementById('btnNewPatient'),

  pacientesTbody: document.getElementById('pacientesTbody'),
  pacientesEmpty: document.getElementById('pacientesEmpty'),
  searchInput: document.getElementById('searchInput'),
  btnReload: document.getElementById('btnReload'),

  patientForm: document.getElementById('patientForm'),
  patientId: document.getElementById('patientId'),
  fNome: document.getElementById('fNome'),
  fCpf: document.getElementById('fCpf'),
  fDataNascimento: document.getElementById('fDataNascimento'),
  fTelefone: document.getElementById('fTelefone'),
  fEmail: document.getElementById('fEmail'),
  patientError: document.getElementById('patientError'),
  btnDeletePatient: document.getElementById('btnDeletePatient'),

  fichasTexto: document.getElementById('fichasTexto'),
  btnSaveFichas: document.getElementById('btnSaveFichas'),
  fichasStatus: document.getElementById('fichasStatus'),

  prontuarioTexto: document.getElementById('prontuarioTexto'),
  btnSaveProntuario: document.getElementById('btnSaveProntuario'),
  prontuarioStatus: document.getElementById('prontuarioStatus'),

  btnExportProntuario: document.getElementById('btnExportProntuario'),
  btnPrintProntuario: document.getElementById('btnPrintProntuario'),

  prontuarioUpdates: document.getElementById('prontuarioUpdates'),

  selectedPatientSub: document.getElementById('selectedPatientSub'),

  statPacientes: document.getElementById('statPacientes'),
  statAtualizacao: document.getElementById('statAtualizacao'),
  statProntuarios: document.getElementById('statProntuarios'),

  modal: document.getElementById('modal'),
  newPatientForm: document.getElementById('newPatientForm'),
  newPatientError: document.getElementById('newPatientError'),
  newNome: document.getElementById('newNome'),
  newCpf: document.getElementById('newCpf'),
  newDataNascimento: document.getElementById('newDataNascimento'),
  newTelefone: document.getElementById('newTelefone'),
  newEmail: document.getElementById('newEmail'),

  quickActions: Array.from(document.querySelectorAll('[data-action]')),

  // Agenda
  agendaDate: document.getElementById('agendaDate'),
  agendaDateInput: document.getElementById('agendaDateInput'),
  agendaTitle: document.getElementById('agendaTitle'),
  agendaPacienteId: document.getElementById('agendaPacienteId'),
  agendaTimeInput: document.getElementById('agendaTimeInput'),
  agendaNotes: document.getElementById('agendaNotes'),
  agendaDayList: document.getElementById('agendaDayList'),
  agendaUpcoming: document.getElementById('agendaUpcoming'),
  btnReloadAgenda: document.getElementById('btnReloadAgenda'),
  agendaError: document.getElementById('agendaError'),
};

const state = {
  token: localStorage.getItem('token') || null,
  pacientes: [],
  selectedPacienteId: null,

  agendaSelectedDate: null,
  agendaEventsForDay: [],
  agendaUpcoming: [],
};

function setError(el, msg) {
  if (!el) return;
  el.textContent = msg || '';
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(state.token ? { Authorization: `Bearer ${state.token}` } : {})
  };
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

function setView(view) {
  document.querySelectorAll('.view[data-section]').forEach(s => {
    s.classList.toggle('is-hidden', s.getAttribute('data-section') !== view);
  });

  els.navLinks.forEach(b => {
    b.classList.toggle('is-active', b.dataset.view === view);
  });

  const titleMap = { dashboard: 'Eventos', pacientes: 'Pacientes' };
  if (els.pageTitle) els.pageTitle.textContent = titleMap[view] || '';
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

function openModal() {
  els.modal?.classList.add('is-open');
  els.modal?.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  els.modal?.classList.remove('is-open');
  els.modal?.setAttribute('aria-hidden', 'true');
  setError(els.newPatientError, '');
  els.newPatientForm?.reset();
}

function formatDateForInput(v) {
  if (!v) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateTimeOnly(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value || '');
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(d);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function todayIsoDate() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function normalize(str) {
  return String(str || '').toLowerCase().trim();
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '<')
    .replaceAll('>', '>')
    .replaceAll('"', '"')
    .replaceAll("'", '&#039;');
}

function switchTab(panelName) {
  // painéis de prontuário
  document.querySelectorAll('.tab-panel').forEach(p => {
    const isActive = p.getAttribute('data-panel') === panelName;
    p.classList.toggle('is-active', isActive);
  });
  document.querySelectorAll('.tab-btn').forEach(b => {
    const isActive = b.getAttribute('data-tab') === panelName;
    b.classList.toggle('is-active', isActive);
  });
}

function renderPacientes() {
  if (!els.pacientesTbody) return;
  const q = normalize(els.searchInput?.value);

  const pacientes = state.pacientes.filter(p => {
    if (!q) return true;
    return normalize(p.nome).includes(q) || normalize(p.cpf).includes(q);
  });

  els.pacientesTbody.innerHTML = '';
  if (els.pacientesEmpty) els.pacientesEmpty.style.display = pacientes.length ? 'none' : 'block';

  pacientes.forEach(p => {
    const tr = document.createElement('tr');
    tr.className = 'tr-click';
    tr.innerHTML = `
      <td><b>${escapeHtml(p.nome)}</b></td>
      <td>${escapeHtml(p.cpf || '')}</td>
      <td>${escapeHtml(p.dataNascimento || '')}</td>
      <td>${escapeHtml([p.telefone, p.email].filter(Boolean).join(' • '))}</td>
      <td>
        <button class="btn" data-open="${p.id}" style="padding:8px 12px;border-radius:12px;">Abrir</button>
      </td>
    `;

    tr.querySelector('[data-open]')?.addEventListener('click', () => selectPaciente(p.id));
    els.pacientesTbody.appendChild(tr);
  });
}

async function refreshPacientes() {
  const data = await api('/api/pacientes');
  state.pacientes = data.pacientes || [];
  renderPacientes();
  if (els.statPacientes) els.statPacientes.textContent = String(state.pacientes.length);
}

async function refreshDashboardStats() {
  if (!els.statPacientes) return;
  els.statPacientes.textContent = String(state.pacientes.length);
  if (els.statProntuarios) els.statProntuarios.textContent = String(state.pacientes.length);

  const last = [...state.pacientes].reduce((acc, p) => {
    const u = p.updatedAt ? new Date(p.updatedAt).getTime() : 0;
    return u > acc ? u : acc;
  }, 0);

  if (els.statAtualizacao) els.statAtualizacao.textContent = last ? new Date(last).toLocaleDateString('pt-BR') : '—';
}

// ===== Agenda =====
function renderAgendaEventsByTime(events, mountEl) {
  if (!mountEl) return;
  mountEl.innerHTML = '';

  if (!events?.length) {
    mountEl.innerHTML = `<div class="empty" style="display:block;">Nenhum evento.</div>`;
    return;
  }

  const groups = new Map();
  events.forEach(ev => {
    const time = ev.time || '00:00';
    if (!groups.has(time)) groups.set(time, []);
    groups.get(time).push(ev);
  });

  [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([time, list]) => {
      const wrap = document.createElement('div');
      wrap.className = 'hour-group';

      const pill = document.createElement('div');
      pill.className = 'hour-pill';
      pill.textContent = time;
      wrap.appendChild(pill);

      list.forEach(ev => {
        const item = document.createElement('div');
        item.className = 'event-item';

        const paciente = ev.pacienteId
          ? state.pacientes.find(p => p.id === ev.pacienteId)?.nome
          : null;

        item.innerHTML = `
          <div class="event-left">
            <div class="event-title" title="${escapeHtml(ev.title || '')}">${escapeHtml(ev.title || '')}</div>
            <div class="event-meta">${escapeHtml(paciente ? `Paciente: ${paciente}` : 'Sem paciente')} </div>
            ${ev.notes ? `<div class="event-meta">${escapeHtml(ev.notes)}</div>` : ''}
          </div>
          <div class="event-actions">
            <button class="icon-btn-sm" data-del="${ev.id}">Remover</button>
          </div>
        `;

        item.querySelector('[data-del]')?.addEventListener('click', async () => {
          if (!confirm('Remover este evento?')) return;
          try {
            await api(`/api/agenda/${encodeURIComponent(ev.id)}`, { method: 'DELETE' });
            await loadAgendaForCurrent();
            await loadAgendaUpcoming();
          } catch (err) {
            setError(els.agendaError, String(err.message || err));
          }
        });

        wrap.appendChild(item);
      });

      mountEl.appendChild(wrap);
    });
}

async function loadAgendaForCurrent() {
  if (!els.agendaDate) return;
  const date = state.agendaSelectedDate;
  if (!date) return;

  const data = await api(`/api/agenda?date=${encodeURIComponent(date)}`);
  state.agendaEventsForDay = data.events || [];
  renderAgendaEventsByTime(state.agendaEventsForDay, els.agendaDayList);
}

async function loadAgendaUpcoming() {
  if (!els.agendaUpcoming) return;
  const start = state.agendaSelectedDate;
  if (!start) return;

  const [y, m, d] = start.split('-').map(Number);
  const startDate = new Date(y, m - 1, d);
  const endDate = new Date(startDate.getTime());
  endDate.setDate(endDate.getDate() + 13);

  const endIso = `${endDate.getFullYear()}-${pad2(endDate.getMonth() + 1)}-${pad2(endDate.getDate())}`;
  const data = await api(`/api/agenda/range?start=${encodeURIComponent(start)}&end=${encodeURIComponent(endIso)}`);
  state.agendaUpcoming = data.events || [];

  renderAgendaEventsByTime(
    state.agendaUpcoming.sort((a, b) => `${a.date}T${a.time || '00:00'}`.localeCompare(`${b.date}T${b.time || '00:00'}`)),
    els.agendaUpcoming
  );
}

function ensureAgendaDefaults() {
  const today = todayIsoDate();
  state.agendaSelectedDate = today;
  if (els.agendaDate) els.agendaDate.value = today;
  if (els.agendaDateInput) els.agendaDateInput.value = today;
}

function renderAgendaPacientesDropdown() {
  if (!els.agendaPacienteId) return;

  const opt = ['<option value="">—</option>']
    .concat(
      state.pacientes.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.nome)}</option>`)
    )
    .join('');

  const currentValue = els.agendaPacienteId.value;
  els.agendaPacienteId.innerHTML = opt;

  const exists = state.pacientes.some(p => String(p.id) === String(currentValue));
  if (currentValue && exists) {
    els.agendaPacienteId.value = currentValue;
  } else if (state.pacientes[0]) {
    els.agendaPacienteId.value = state.pacientes[0].id;
  }
}

async function createAgendaEventFromForm() {
  setError(els.agendaError, '');

  const title = els.agendaTitle?.value?.trim();
  const pacienteId = els.agendaPacienteId?.value || '';
  const date = els.agendaDateInput?.value || state.agendaSelectedDate;
  const time = els.agendaTimeInput?.value;
  const notes = els.agendaNotes?.value || '';

  if (!title) throw new Error('Informe o título do evento.');
  if (!date) throw new Error('Informe a data do evento.');
  if (!time) throw new Error('Informe a hora do evento.');
  if (!pacienteId) throw new Error('Selecione um paciente cadastrado.');

  const payload = { title, date, time, pacienteId, notes };
  await api('/api/agenda', { method: 'POST', body: JSON.stringify(payload) });

  if (date === state.agendaSelectedDate) await loadAgendaForCurrent();
  await loadAgendaUpcoming();

  if (els.agendaTitle) els.agendaTitle.value = '';
  if (els.agendaNotes) els.agendaNotes.value = '';
}

async function loadProntuarioAndLog(pacienteId) {
  if (els.prontuarioStatus) els.prontuarioStatus.textContent = '';
  if (els.fichasStatus) els.fichasStatus.textContent = '';
  if (els.fichasTexto && els.fichasTexto.value === '') {
    // sem endpoint ainda; mantém vazio.
  }

  const prontuarioData = await api(`/api/pacientes/${pacienteId}/prontuario`);
  els.prontuarioTexto.value = prontuarioData?.prontuario?.texto || '';

  const updatesData = await api(`/api/pacientes/${pacienteId}/prontuario/updates?limit=50`);
  const updates = updatesData?.updates || [];

  if (els.prontuarioUpdates) {
    if (!updates.length) {
      els.prontuarioUpdates.innerHTML = `<div class="empty" style="display:block;">Nenhum histórico de mudanças.</div>`;
    } else {
      els.prontuarioUpdates.innerHTML = `
        <ul class="history-list">
          ${updates.map(u => {
            const teor = String(u.texto || '').replace(/\s+/g, ' ').trim();
            const resumo = teor ? teor.slice(0, 180) : 'Sem teor registrado.';
            return `
              <li class="history-item">
                <span class="history-dot" aria-hidden="true"></span>
                <div class="history-content">
                  <span class="history-datetime">${escapeHtml(formatDateTimeOnly(u.updatedAt))}</span>
                  <span class="history-summary">Teor da alteração: ${escapeHtml(resumo)}</span>
                </div>
              </li>
            `;
          }).join('')}
        </ul>
      `;
    }
  }
}

async function selectPaciente(pacienteId) {
  state.selectedPacienteId = pacienteId;
  setError(els.patientError, '');
  if (els.prontuarioStatus) els.prontuarioStatus.textContent = '';

  const paciente = state.pacientes.find(p => p.id === pacienteId);
  if (!paciente) return;

  els.patientId.value = paciente.id;
  els.fNome.value = paciente.nome || '';
  els.fCpf.value = paciente.cpf || '';
  els.fTelefone.value = paciente.telefone || '';
  els.fEmail.value = paciente.email || '';
  els.fDataNascimento.value = formatDateForInput(paciente.dataNascimento);

  if (els.selectedPatientSub) els.selectedPatientSub.textContent = `Prontuário de ${paciente.nome}`;

  // Integração: paciente selecionado na aba Pacientes sincroniza o select na aba Marcar evento
  if (els.agendaPacienteId) els.agendaPacienteId.value = pacienteId;

  await loadProntuarioAndLog(pacienteId);
  switchTab('prontuario');
}

// Events (nav/auth)
els.navLinks.forEach(b => {
  b.addEventListener('click', () => setView(b.dataset.view));
});

els.btnLogout?.addEventListener('click', () => {
  localStorage.removeItem('token');
  location.href = './login.html';
});

els.btnNewPatient?.addEventListener('click', () => openModal());

els.modal?.addEventListener('click', (e) => {
  const target = e.target;
  if (target?.dataset?.close === 'true') closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && els.modal?.classList.contains('is-open')) closeModal();
});

// New paciente
els.newPatientForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (els.newPatientError) els.newPatientError.textContent = '';

  const payload = {
    nome: els.newNome.value.trim(),
    cpf: els.newCpf.value.trim(),
    dataNascimento: els.newDataNascimento.value,
    telefone: els.newTelefone.value.trim(),
    email: els.newEmail.value.trim(),
  };

  try {
    await api('/api/pacientes', { method: 'POST', body: JSON.stringify(payload) });
    closeModal();
    setView('pacientes');
    await refreshPacientes();
    await refreshDashboardStats();

    renderAgendaPacientesDropdown();
  } catch (err) {
    setError(els.newPatientError, String(err.message || err));
  }
});

// Quick actions
els.quickActions.forEach(btn => {
  btn.addEventListener('click', async () => {
    const action = btn.dataset.action;
    if (action === 'openPacientes') {
      setView('pacientes');
      await refreshPacientes();
    }
    if (action === 'newPatient') openModal();
  });
});

// Pacientes
els.btnReload?.addEventListener('click', () => refreshPacientes());
els.searchInput?.addEventListener('input', () => renderPacientes());

els.patientForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.selectedPacienteId) return;

  setError(els.patientError, '');

  const payload = {
    nome: els.fNome.value.trim(),
    cpf: els.fCpf.value.trim(),
    dataNascimento: els.fDataNascimento.value,
    telefone: els.fTelefone.value.trim(),
    email: els.fEmail.value.trim(),
  };

  try {
    await api(`/api/pacientes/${state.selectedPacienteId}`, { method: 'PUT', body: JSON.stringify(payload) });
    await refreshPacientes();
    await refreshDashboardStats();
    if (els.selectedPatientSub) els.selectedPatientSub.textContent = `Atualizado • Prontuário de ${payload.nome}`;
  } catch (err) {
    setError(els.patientError, String(err.message || err));
  }
});

els.btnSaveProntuario?.addEventListener('click', async () => {
  if (!state.selectedPacienteId) return;
  if (els.prontuarioStatus) els.prontuarioStatus.textContent = '';

  try {
    const texto = els.prontuarioTexto.value;
    await api(`/api/pacientes/${state.selectedPacienteId}/prontuario`, { method: 'PUT', body: JSON.stringify({ texto }) });
    if (els.prontuarioStatus) els.prontuarioStatus.textContent = 'Prontuário atualizado com sucesso.';
    await refreshDashboardStats();
    await loadProntuarioAndLog(state.selectedPacienteId);
  } catch (err) {
    if (els.prontuarioStatus) els.prontuarioStatus.textContent = `Erro: ${String(err.message || err)}`;
  }
});

els.btnExportProntuario?.addEventListener('click', () => {
  if (!state.selectedPacienteId) return;
  const url = `${API_BASE}/api/pacientes/${encodeURIComponent(state.selectedPacienteId)}/prontuario/pdf`;
  window.open(url, '_blank');
});

els.btnPrintProntuario?.addEventListener('click', () => {
  if (!state.selectedPacienteId) return;
  const url = `${API_BASE}/api/pacientes/${encodeURIComponent(state.selectedPacienteId)}/prontuario/pdf`;
  const w = window.open(url, '_blank');
  if (!w) alert('Pop-up bloqueado. Permita pop-ups para imprimir/exportar.');
});

els.btnDeletePatient?.addEventListener('click', async () => {
  if (!state.selectedPacienteId) return;
  if (!confirm('Excluir este paciente e seu prontuário?')) return;

  try {
    await api(`/api/pacientes/${state.selectedPacienteId}`, { method: 'DELETE' });

    state.selectedPacienteId = null;
    els.patientForm?.reset();
    els.prontuarioTexto.value = '';
    if (els.selectedPatientSub) els.selectedPatientSub.textContent = 'Selecione um paciente.';

    await refreshPacientes();
    await refreshDashboardStats();

    renderAgendaPacientesDropdown();
  } catch (err) {
    setError(els.patientError, String(err.message || err));
  }
});

// Agenda UI events
els.agendaDate?.addEventListener('change', async () => {
  state.agendaSelectedDate = els.agendaDate.value;
  if (els.agendaDateInput) els.agendaDateInput.value = state.agendaSelectedDate;
  await loadAgendaForCurrent();
});

els.btnReloadAgenda?.addEventListener('click', async () => {
  await loadAgendaForCurrent();
  await loadAgendaUpcoming();
});

els.agendaForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await createAgendaEventFromForm();
    setError(els.agendaError, '');
  } catch (err) {
    setError(els.agendaError, String(err.message || err));
  }
});

document.getElementById('agendaForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await createAgendaEventFromForm();
    setError(els.agendaError, '');
  } catch (err) {
    setError(els.agendaError, String(err.message || err));
  }
});

(function initTabs(){
  document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.getAttribute('data-tab'));
    });
  });

  // tabs ligadas apenas quando existirem.
})();

(async function boot() {
  if (!state.token) {
    location.href = './login.html';
    return;
  }

  const email = decodeEmailFromToken(state.token);
  if (els.userEmail) els.userEmail.textContent = email || 'Usuário';

  try {
    await refreshPacientes();
    await refreshDashboardStats();

    ensureAgendaDefaults();
    renderAgendaPacientesDropdown();

    await loadAgendaForCurrent();
    await loadAgendaUpcoming();
  } catch (err) {
    const msg = String(err?.message || err || '');
    if (/Token/i.test(msg) || /Acesso negado/i.test(msg) || /inválido/i.test(msg)) {
      localStorage.removeItem('token');
      location.href = './login.html';
    } else {
      setError(els.agendaError, msg);
      console.error('[panel] erro init:', err);
    }
  }
})();
