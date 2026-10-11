const authService = require('../services/auth.service');
const { HttpError } = require('./errors');

const COOKIE = 'sid';

function readCookie(req, name) {
  const m = String(req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : null;
}

function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${12 * 3600}`);
}
const clearSessionCookie = (res) => res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);

function attachUser(req, res, next) {
  req.sessionToken = readCookie(req, COOKIE);
  req.user = authService.userFromToken(req.sessionToken);
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return next(new HttpError(401, 'Inicia sesión para continuar'));
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return next(new HttpError(401, 'Inicia sesión para continuar'));
  if (req.user.role !== 'admin') return next(new HttpError(403, 'Solo el administrador puede hacer esto'));
  next();
}

module.exports = { attachUser, requireAuth, requireAdmin, setSessionCookie, clearSessionCookie };
