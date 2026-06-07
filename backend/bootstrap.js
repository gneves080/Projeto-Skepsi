const db = require('./storage/db');

db.ensureSeed().then(() => {
  // seed feito
}).catch(err => {
  console.error('[seed] erro:', err);
});

