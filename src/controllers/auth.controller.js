const authService = require('../services/auth.service');
const { HttpError } = require('../middleware/errors');
const { setSessionCookie, clearSessionCookie } = require('../middleware/auth');

function validateCredentials(body) {
  const username = String(body.username ?? '').trim();
  const password = String(body.password ?? '');
  if (!/^[\w.-]{3,30}$/.test(username)) throw new HttpError(400, 'Usuario: 3 a 30 caracteres (letras, números, . _ -)');
  if (password.length < 6) throw new HttpError(400, 'La contraseña debe tener al menos 6 caracteres');
  return { username, password };
}

function status(req, res) {
  res.json({ needsSetup: authService.countUsers() === 0, user: req.user });
}

// Primer uso: crea el administrador (solo funciona si aún no hay usuarios)
function setup(req, res) {
  if (authService.countUsers() > 0) throw new HttpError(403, 'El sistema ya fue configurado');
  const { username, password } = validateCredentials(req.body);
  const user = authService.createUser(username, password, 'admin');
  setSessionCookie(res, authService.createSession(user.id));
  res.status(201).json(user);
}

// Freno simple contra adivinar contraseñas: 5 fallos por usuario cada minuto
const failures = new Map();
function login(req, res) {
  const username = String(req.body.username ?? '').trim().toLowerCase();
  const now = Date.now();
  const f = (failures.get(username) || []).filter((t) => now - t < 60_000);
  if (f.length >= 5) throw new HttpError(429, 'Demasiados intentos. Espera un minuto.');

  const user = authService.login(username, String(req.body.password ?? ''));
  if (!user) {
    failures.set(username, [...f, now]);
    throw new HttpError(401, 'Usuario o contraseña incorrectos');
  }
  failures.delete(username);
  setSessionCookie(res, authService.createSession(user.id));
  res.json({ id: user.id, username: user.username, role: user.role });
}

function logout(req, res) {
  if (req.sessionToken) authService.destroySession(req.sessionToken);
  clearSessionCookie(res);
  res.status(204).end();
}

module.exports = { status, setup, login, logout, validateCredentials };
