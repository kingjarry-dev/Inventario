const db = require('../db/database');
const { hashPassword, verifyPassword, sha, newToken } = require('../utils/auth');

const SESSION_MS = 12 * 60 * 60 * 1000; // 12 horas

const countUsers = () => db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
const publicUser = (u) => u && { id: u.id, username: u.username, role: u.role };

function createUser(username, password, role) {
  const info = db
    .prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
    .run(username, hashPassword(password), role);
  return publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(Number(info.lastInsertRowid)));
}

function login(username, password) {
  const u = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!u || !verifyPassword(password, u.password_hash)) return null;
  return u;
}

function createSession(userId) {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  const token = newToken();
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(sha(token), userId, Date.now() + SESSION_MS);
  return token;
}

function userFromToken(token) {
  if (!token) return null;
  return publicUser(
    db.prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`
    ).get(sha(token), Date.now())
  );
}

const destroySession = (token) => db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(token));

// ---- Gestión de usuarios (solo admin) ----
const listUsers = () => db.prepare('SELECT id, username, role, created_at FROM users ORDER BY username').all();

function removeUser(id) {
  return db.prepare('DELETE FROM users WHERE id = ?').run(id).changes > 0;
}

function setPassword(id, password) {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id); // cierra sus sesiones abiertas
}

const adminCount = () => db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n;
const getUser = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id);

module.exports = {
  countUsers, createUser, login, createSession, userFromToken, destroySession,
  listUsers, removeUser, setPassword, adminCount, getUser,
};
