const fs = require('fs');
const path = require('path');
const db = require('../db/database');
const { DB_PATH } = require('../config');

const KEEP = 7; // cantidad de respaldos que se conservan

// Copia consistente de la base (VACUUM INTO) una vez al día; borra los más antiguos.
function run() {
  try {
    const dir = path.join(path.dirname(DB_PATH), 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const d = new Date();
    const day = new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const file = path.join(dir, `inventario-${day}.db`);
    if (!fs.existsSync(file)) db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
    fs.readdirSync(dir).filter((f) => /^inventario-.*\.db$/.test(f)).sort().reverse()
      .slice(KEEP).forEach((f) => fs.unlinkSync(path.join(dir, f)));
  } catch (err) {
    console.error('No se pudo crear el respaldo:', err.message);
  }
}

function start() {
  run();
  setInterval(run, 6 * 3600 * 1000).unref();
}

module.exports = { start, run };
