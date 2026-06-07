const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const { nanoid } = require('nanoid');
const bcrypt = require('bcrypt');

const fs = require('fs');
const path = require('path');

const dbFile = path.join(__dirname, '..', 'data', 'db.json');

// Ensure folder
fs.mkdirSync(path.dirname(dbFile), { recursive: true });

const adapter = new JSONFile(dbFile);

// lowdb@6 exige default data no construtor para evitar:
// "lowdb: missing default data".
const lowdb = new Low(adapter, { users: [], pacientes: [], prontuarios: [], prontuarioUpdates: [], loginLogs: [], agendaEvents: [] });




async function initIfNeeded() {
  // garante que o arquivo exista com estrutura válida
  if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(
      dbFile,
      JSON.stringify({ users: [], pacientes: [], prontuarios: [], loginLogs: [], agendaEvents: [] }, null, 2)
    );
  }

  await lowdb.read();

  // compat com arquivos antigos
  lowdb.data ||= { users: [], pacientes: [], prontuarios: [], prontuarioUpdates: [], loginLogs: [], agendaEvents: [] };
  lowdb.data.prontuarios ||= [];
  lowdb.data.prontuarioUpdates ||= [];
  lowdb.data.agendaEvents ||= [];
  lowdb.data.loginLogs ||= [];

  await lowdb.write();
}



const ready = initIfNeeded();


function nowIso() {
  return new Date().toISOString();
}

function getData() {
  return lowdb.data;
}

function getUserByEmail(email) {
  return getData().users.find(u => u.email.toLowerCase() === String(email).toLowerCase());
}

async function ensureSeed() {
  await ready;
  if (getData().users.length > 0) return;

  const adminUser = process.env.ADMIN_USER || '';
  const adminPass = process.env.ADMIN_PASS || '';

  // Não vaza credenciais no código. Se env não estiver configurado, não cria admin automaticamente.
  if (!adminUser || !adminPass) {
    console.warn('[seed] ADMIN_USER/ADMIN_PASS não definidos. Admin seed não será criada.');
    return;
  }

  const senhaHash = await bcrypt.hash(String(adminPass), 10);
  getData().users.push({ id: nanoid(), email: String(adminUser).toLowerCase(), senhaHash, role: 'admin', createdAt: nowIso() });

  await lowdb.write();
}


function getUserById(id) {
  return getData().users.find(u => u.id === id) || null;
}

function addLoginLog({ userId, email, ok, message }) {
  const payload = {
    id: nanoid(),
    userId: userId || null,
    email: email ? String(email).toLowerCase() : null,
    ok: Boolean(ok),
    message: message ? String(message).slice(0, 300) : '',
    createdAt: nowIso()
  };

  getData().loginLogs ||= [];
  getData().loginLogs.push(payload);
  return lowdb.write().then(() => payload);
}

function getLoginLogs({ limit = 200 } = {}) {
  const lim = Number(limit) > 0 ? Number(limit) : 200;
  return [...(getData().loginLogs || [])]
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, lim);
}

async function createUser({ email, name, senha, role }) {

  await ready;
  if (!email) throw new Error('Email é obrigatório.');
  const existing = getUserByEmail(email);
  if (existing) throw new Error('Email já cadastrado.');

  const senhaHash = await bcrypt.hash(String(senha), 10);
  const user = {
    id: nanoid(),
    email: String(email).toLowerCase(),
    name: name ? String(name) : undefined,
    senhaHash,
    role: role === 'admin' ? 'admin' : 'user',
    createdAt: nowIso()
  };

  getData().users.push(user);
  await lowdb.write();
  return user;
}


function getPacientes() {
  return [...getData().pacientes].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

function getPacienteById(id) {
  return getData().pacientes.find(p => p.id === id) || null;
}

function createPaciente({ nome, cpf, dataNascimento, telefone, email }) {
  const paciente = {
    id: nanoid(),
    nome: String(nome),
    cpf: cpf ? String(cpf) : '',
    dataNascimento: dataNascimento ? String(dataNascimento) : '',
    telefone: telefone ? String(telefone) : '',
    email: email ? String(email) : '',
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  getData().pacientes.push(paciente);
  // cria prontuário vazio
  const prontuario = { id: nanoid(), pacienteId: paciente.id, texto: '', updatedAt: nowIso(), createdAt: nowIso() };
  getData().prontuarios.push(prontuario);
  lowdb.write();
  return paciente;
}

function updatePaciente(id, fields) {
  const paciente = getPacienteById(id);
  if (!paciente) return null;
  if (fields.nome !== undefined) paciente.nome = fields.nome ? String(fields.nome) : paciente.nome;
  if (fields.cpf !== undefined) paciente.cpf = fields.cpf ? String(fields.cpf) : '';
  if (fields.dataNascimento !== undefined) paciente.dataNascimento = fields.dataNascimento ? String(fields.dataNascimento) : '';
  if (fields.telefone !== undefined) paciente.telefone = fields.telefone ? String(fields.telefone) : '';
  if (fields.email !== undefined) paciente.email = fields.email ? String(fields.email) : '';
  paciente.updatedAt = nowIso();
  lowdb.write();
  return paciente;
}

function deletePaciente(id) {
  const before = getData().pacientes.length;
  getData().pacientes = getData().pacientes.filter(p => p.id !== id);
  getData().prontuarios = getData().prontuarios.filter(pr => pr.pacienteId !== id);
  lowdb.write();
  return getData().pacientes.length !== before;
}

function getProntuarioByPacienteId(pacienteId) {
  return getData().prontuarios.find(p => p.pacienteId === pacienteId) || null;
}

function upsertProntuario(pacienteId, { texto, updatedBy }) {
  let prontuario = getProntuarioByPacienteId(pacienteId);
  const now = nowIso();

  if (!prontuario) {
    prontuario = { id: nanoid(), pacienteId, texto: '', createdAt: now, updatedAt: now };
    getData().prontuarios.push(prontuario);
  }

  const atualVersion = (() => {
    const updates = getData().prontuarioUpdates || [];
    return updates.filter(u => u.pacienteId === String(pacienteId)).length;
  })();

  const nextVersion = atualVersion + 1;

  prontuario.texto = String(texto);
  prontuario.updatedAt = now;

  // log/auditoria
  getData().prontuarioUpdates ||= [];
  getData().prontuarioUpdates.push({
    id: nanoid(),
    pacienteId: String(pacienteId),
    version: nextVersion,
    texto: String(texto),
    updatedAt: now,
    updatedBy: updatedBy ? String(updatedBy) : 'unknown',
  });

  lowdb.write();
  return prontuario;
}

function getProntuarioUpdates({ pacienteId, limit = 200 } = {}) {
  const pid = pacienteId ? String(pacienteId) : null;
  const lim = Number(limit) > 0 ? Number(limit) : 200;

  const updates = getData().prontuarioUpdates || [];
  return [...updates]
    .filter(u => (pid ? u.pacienteId === pid : true))
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    .slice(0, lim);
}


function normalizeDateISO(date) {
  if (!date) return '';
  // aceita Date ou string
  if (date instanceof Date) {
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  }
  const s = String(date);
  // se vier completo com hora, pega yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  return '';
}

function normalizeTimeHM(t) {
  if (t === undefined || t === null) return '';
  const s = String(t).trim();
  // aceita HH:mm
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  return '';
}

function getAgendaEventsByDate(dateISO) {
  const d = normalizeDateISO(dateISO);
  if (!d) return [];

  return [...(getData().agendaEvents || [])]
    .filter(ev => ev.date === d)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
}

function getAgendaEventsRange(startDateISO, endDateISO) {

  const start = normalizeDateISO(startDateISO);
  const end = normalizeDateISO(endDateISO);
  if (!start || !end) return [];

  const startTime = start + 'T00:00';
  const endTime = end + 'T23:59';

  return [...(getData().agendaEvents || [])]
    .filter(ev => {
      if (!ev.date) return false;
      const dt = `${ev.date}T${(ev.time || '00:00')}`;
      return dt >= startTime && dt <= endTime;
    })
    .sort((a, b) => {
      const da = `${a.date}T${a.time || '00:00'}`;
      const db = `${b.date}T${b.time || '00:00'}`;
      return da.localeCompare(db);
    });
}

function createAgendaEvent({ title, date, time, pacienteId, notes }) {
  const d = normalizeDateISO(date);
  const t = normalizeTimeHM(time);

  if (!title || !String(title).trim()) throw new Error('Título do evento é obrigatório.');
  if (!d) throw new Error('Data inválida.');
  if (!t) throw new Error('Hora inválida.');

  const ev = {
    id: nanoid(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    title: String(title).trim(),
    date: d,
    time: t,
    pacienteId: pacienteId ? String(pacienteId) : null,
    notes: notes ? String(notes) : '',
  };


  getData().agendaEvents ||= [];
  getData().agendaEvents.push(ev);
  lowdb.write();
  return ev;
}

function getAgendaEventById(id) {

  const events = getData().agendaEvents || [];
  return events.find(e => e.id === id) || null;
}

function updateAgendaEvent(id, fields) {

  const events = getData().agendaEvents || [];
  const ev = events.find(e => e.id === id);
  if (!ev) return null;

  if (fields.title !== undefined) ev.title = String(fields.title).trim();
  if (fields.date !== undefined) ev.date = normalizeDateISO(fields.date);
  if (fields.time !== undefined) ev.time = normalizeTimeHM(fields.time);
  if (fields.pacienteId !== undefined) ev.pacienteId = fields.pacienteId ? String(fields.pacienteId) : null;
  if (fields.notes !== undefined) ev.notes = fields.notes ? String(fields.notes) : '';

  ev.updatedAt = nowIso();
  lowdb.write();
  return ev;
}

function deleteAgendaEvent(id) {
  const before = (getData().agendaEvents || []).length;
  getData().agendaEvents = (getData().agendaEvents || []).filter(e => e.id !== id);
  lowdb.write();
  return (getData().agendaEvents || []).length !== before;
}

module.exports = {
  ensureSeed,
  getUserByEmail,
  getUserById,
  addLoginLog,
  getLoginLogs,
  getPacientes,
  getPacienteById,
  createPaciente,
  updatePaciente,
  deletePaciente,
  getProntuarioByPacienteId,
  upsertProntuario,
  getProntuarioUpdates,

  getAgendaEventsByDate,
  getAgendaEventsRange,
  createAgendaEvent,
  updateAgendaEvent,
  deleteAgendaEvent
};



