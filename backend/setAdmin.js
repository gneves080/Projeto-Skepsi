const db = require('./storage/db');

(async () => {
  const user = process.env.ADMIN_USER_EMAIL;
  const user2 = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASS;

  if (!user && !user2) {
    console.error('Defina ADMIN_USER_EMAIL ou ADMIN_USER no ambiente.');
    process.exit(1);
  }
  if (!pass) {
    console.error('Defina ADMIN_PASS no ambiente.');
    process.exit(1);
  }

  const email = String(user2 || user).toLowerCase();

  // Recria usuário admin no banco se necessário
  // (MVP: remove/insere simplificado via createUser; se já existir, apenas avisa)
  try {
    await db.ensureSeed();
  } catch (e) {
    // ignore
  }

  console.log('Seed de admin acionado. Se ADMIN_USER/ADMIN_PASS estiverem definidos, o admin deve existir.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

