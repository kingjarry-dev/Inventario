// SQLite integrado en Node (no requiere instalar ni compilar nada extra)
const { DatabaseSync } = require('node:sqlite');
const { DB_PATH } = require('../config');
const { createSchema, migrate, seedIfEmpty } = require('./schema');

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

createSchema(db);
migrate(db);
seedIfEmpty(db);

// Ejecuta fn dentro de una transacción (si falla, se revierte todo)
let depth = 0;
db.tx = (fn) => {
  if (depth > 0) return fn();
  db.exec('BEGIN');
  depth++;
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  } finally {
    depth--;
  }
};

module.exports = db;
