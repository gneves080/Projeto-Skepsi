const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { createRequire } = require('module');

const path = require('path');

const app = express();

function escapeForHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '<')
    .replaceAll('>', '>')
    .replaceAll('"', '"')
    .replaceAll("'", '&#039;');
}




app.use(cors());
app.use(express.json({ limit: '1mb' }));

const requireLocal = createRequire(__filename);

const jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-me';

// Lazy-load DB helper
const db = requireLocal('./storage/db');

// garante seed
requireLocal('./bootstrap');


function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Acesso negado. Faça login.' });

  try {
    const payload = jwt.verify(token, jwtSecret);
    // payload: { sub: user.id, email }
    req.user = payload;
    return next();
  } catch (e) {
    return res.status(401).json({ message: 'Token inválido ou expirado.' });
  }
}

function adminOnly(req, res, next) {
  // Você (hard gate) é o único permitido.
  // Validação por e-mail exatamente como você digita no login.
  const allowedEmail = process.env.ADMIN_USER_EMAIL || 'gneves080';

  if (!req.user?.email) return res.status(403).json({ message: 'Acesso negado.' });
  if (String(req.user.email).toLowerCase() !== String(allowedEmail).toLowerCase()) {
    return res.status(403).json({ message: 'Acesso negado.' });
  }


  // Além do email, também exigimos role=admin (quando presente no token).
  // Como o payload atual só tem {sub, email}, validamos role no banco.
  const user = db.getUserByEmail(req.user.email);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ message: 'Acesso negado.' });
  }

  return next();
}


// Health
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Admin - login logs
app.get('/api/admin/login-logs', authRequired, adminOnly, (req, res) => {
  const limit = req.query?.limit ? Number(req.query.limit) : undefined;
  const logs = db.getLoginLogs({ limit });
  res.json({ logs });
});

// Auth
app.post('/api/login', async (req, res) => {

  const { email, senha } = req.body || {};
  if (!email || !senha) {
    return res.status(400).json({ message: 'Informe email e senha.' });
  }

  const user = db.getUserByEmail(email);
  if (!user) {
    await db.addLoginLog({ userId: null, email, ok: false, message: 'Usuário não encontrado' });
    return res.status(401).json({ message: 'Credenciais inválidas.' });
  }

  const ok = await bcrypt.compare(String(senha), user.senhaHash);
  if (!ok) {
    await db.addLoginLog({ userId: user.id, email, ok: false, message: 'Senha incorreta' });
    return res.status(401).json({ message: 'Credenciais inválidas.' });
  }

  await db.addLoginLog({ userId: user.id, email: user.email, ok: true, message: 'Login OK' });

  const token = jwt.sign({ sub: user.id, email: user.email }, jwtSecret, { expiresIn: '6h' });
  return res.json({ token });
});


app.post('/api/logout', authRequired, (_req, res) => {
  // JWT é stateless (para MVP). Logout apenas no cliente.
  res.json({ ok: true });
});

// Pacientes
app.get('/api/pacientes', authRequired, (_req, res) => {
  res.json({ pacientes: db.getPacientes() });
});

app.post('/api/pacientes', authRequired, (req, res) => {
  const { nome, cpf, dataNascimento, telefone, email } = req.body || {};

  if (!nome) return res.status(400).json({ message: 'Nome é obrigatório.' });

  const paciente = db.createPaciente({
    nome,
    cpf,
    dataNascimento,
    telefone,
    email
  });

  return res.status(201).json({ paciente });
});

app.get('/api/pacientes/:id', authRequired, (req, res) => {
  const paciente = db.getPacienteById(req.params.id);
  if (!paciente) return res.status(404).json({ message: 'Paciente não encontrado.' });
  return res.json({ paciente });
});

app.put('/api/pacientes/:id', authRequired, (req, res) => {
  const { nome, cpf, dataNascimento, telefone, email } = req.body || {};
  const updated = db.updatePaciente(req.params.id, { nome, cpf, dataNascimento, telefone, email });
  if (!updated) return res.status(404).json({ message: 'Paciente não encontrado.' });
  return res.json({ paciente: updated });
});

app.delete('/api/pacientes/:id', authRequired, (req, res) => {
  const ok = db.deletePaciente(req.params.id);
  if (!ok) return res.status(404).json({ message: 'Paciente não encontrado.' });
  return res.json({ ok: true });
});

// Agenda
app.get('/api/agenda', authRequired, (req, res) => {
  const date = req.query?.date;
  if (!date) return res.status(400).json({ message: 'Informe ?date=YYYY-MM-DD.' });
  const events = db.getAgendaEventsByDate(date);
  return res.json({ events });
});

app.get('/api/agenda/range', authRequired, (req, res) => {
  const start = req.query?.start;
  const end = req.query?.end;
  if (!start || !end) return res.status(400).json({ message: 'Informe ?start=YYYY-MM-DD&end=YYYY-MM-DD.' });
  const events = db.getAgendaEventsRange(start, end);
  return res.json({ events });
});

app.post('/api/agenda', authRequired, (req, res) => {
  const { title, date, time, pacienteId, notes } = req.body || {};
  try {
    const ev = db.createAgendaEvent({ title, date, time, pacienteId, notes });
    return res.status(201).json({ event: ev });
  } catch (e) {
    return res.status(400).json({ message: String(e.message || e) });
  }
});

app.put('/api/agenda/:id', authRequired, (req, res) => {
  const { title, date, time, pacienteId, notes } = req.body || {};
  const updated = db.updateAgendaEvent(req.params.id, { title, date, time, pacienteId, notes });
  if (!updated) return res.status(404).json({ message: 'Evento não encontrado.' });
  return res.json({ event: updated });
});

app.delete('/api/agenda/:id', authRequired, (req, res) => {
  const ok = db.deleteAgendaEvent(req.params.id);
  if (!ok) return res.status(404).json({ message: 'Evento não encontrado.' });
  return res.json({ ok: true });
});

// Prontuário
app.get('/api/pacientes/:id/prontuario', authRequired, (req, res) => {

  const prontuario = db.getProntuarioByPacienteId(req.params.id);
  if (!prontuario) return res.status(404).json({ message: 'Prontuário não encontrado.' });
  return res.json({ prontuario });
});

app.put('/api/pacientes/:id/prontuario', authRequired, (req, res) => {
  const { texto } = req.body || {};
  const pacienteId = req.params.id;
  if (texto === undefined) return res.status(400).json({ message: 'Informe o texto do prontuário.' });

  const updatedBy = req.user?.email || req.user?.sub || 'unknown';
  const prontuario = db.upsertProntuario(pacienteId, { texto: String(texto), updatedBy });
  return res.json({ prontuario });
});

app.get('/api/pacientes/:id/prontuario/updates', authRequired, (req, res) => {
  const pacienteId = req.params.id;
  const limit = req.query?.limit ? Number(req.query.limit) : undefined;
  const updates = db.getProntuarioUpdates({ pacienteId, limit });
  return res.json({ updates });
});

// Export/Impressão (PDF): sem dependências externas, gerado via HTML+print no cliente.
app.get('/api/pacientes/:id/prontuario/pdf', authRequired, (req, res) => {
  const pacienteId = req.params.id;
  const paciente = db.getPacienteById(pacienteId);
  const prontuario = db.getProntuarioByPacienteId(pacienteId);
  if (!paciente || !prontuario) return res.status(404).json({ message: 'Paciente ou prontuário não encontrado.' });

  const updates = db.getProntuarioUpdates({ pacienteId, limit: 50 });

  // Envia HTML para o navegador imprimir/salvar como PDF.
  // (Método consistente mesmo sem libs de PDF instaladas.)
  const html = `<!doctype html>
<html lang="pt-br">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Prontuário - ${escapeForHtml(paciente.nome)}</title>
<style>
  @page { margin: 18mm 14mm; }
  body { font-family: Arial, Helvetica, sans-serif; color:#111; }
  h1 { font-size: 18px; margin: 0 0 6px; }
  .meta { font-size: 12px; color:#444; margin-bottom: 12px; }
  .block { border: 1px solid #ddd; padding: 12px; border-radius: 8px; }
  pre { white-space: pre-wrap; word-break: break-word; font-family: inherit; margin:0; }
  .section-title { font-weight: 700; margin: 14px 0 6px; font-size: 13px; }
  table { width:100%; border-collapse: collapse; font-size: 11.5px; }
  th, td { border-bottom: 1px solid #eee; padding: 6px 4px; text-align:left; vertical-align: top; }
  th { color:#333; font-weight:700; }
</style>
</head>
<body>
  <h1>PsicoFlow • Prontuário</h1>
  <div class="meta">
    <div><b>Paciente:</b> ${escapeForHtml(paciente.nome)} (${escapeForHtml(paciente.cpf || '—')})</div>
    <div><b>Atualizado em:</b> ${escapeForHtml(prontuario.updatedAt || prontuario.createdAt || '—')}</div>
  </div>

  <div class="block">
    <div class="section-title">Texto do prontuário</div>
    <pre>${escapeForHtml(prontuario.texto || '')}</pre>
  </div>

  <div class="section-title">Log de atualizações (últimas 50)</div>
  <div class="block" style="padding:0;">
    <table>
      <thead>
        <tr>
          <th>Data</th>
          <th>Usuário</th>
          <th>Versão</th>
          <th>Trecho</th>
        </tr>
      </thead>
      <tbody>
        ${updates.map(u => {
          const trecho = String(u.texto || '').replace(/\s+/g,' ').slice(0, 90);
          return `<tr>
            <td>${escapeForHtml(u.updatedAt || '')}</td>
            <td>${escapeForHtml(u.updatedBy || '')}</td>
            <td>${escapeForHtml(String(u.version || ''))}</td>
            <td>${escapeForHtml(trecho || '')}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>

  <script>
    // Autodisparar impressão para “Salvar como PDF”.
    setTimeout(() => { window.print(); }, 400);
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="prontuario-${pacienteId}.html"`);
  return res.send(html);
});

// Serve frontend (optional)
app.use(express.static(path.join(__dirname, '..', 'frontend')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[server] rodando em http://localhost:3000`);
});


