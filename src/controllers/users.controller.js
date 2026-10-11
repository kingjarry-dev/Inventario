const authService = require('../services/auth.service');
const { HttpError } = require('../middleware/errors');
const { validateCredentials } = require('./auth.controller');

const parseId = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'ID inválido');
  return id;
};

const list = (req, res) => res.json(authService.listUsers());

function create(req, res) {
  const { username, password } = validateCredentials(req.body);
  const role = req.body.role === 'admin' ? 'admin' : 'seller';
  try {
    res.status(201).json(authService.createUser(username, password, role));
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) throw new HttpError(409, 'Ese usuario ya existe');
    throw err;
  }
}

function remove(req, res) {
  const id = parseId(req);
  const u = authService.getUser(id);
  if (!u) throw new HttpError(404, 'Usuario no encontrado');
  if (id === req.user.id) throw new HttpError(400, 'No puedes eliminar tu propio usuario');
  if (u.role === 'admin' && authService.adminCount() <= 1) throw new HttpError(400, 'Debe quedar al menos un administrador');
  authService.removeUser(id);
  res.status(204).end();
}

function password(req, res) {
  const id = parseId(req);
  if (!authService.getUser(id)) throw new HttpError(404, 'Usuario no encontrado');
  const pw = String(req.body.password ?? '');
  if (pw.length < 6) throw new HttpError(400, 'La contraseña debe tener al menos 6 caracteres');
  authService.setPassword(id, pw);
  res.status(204).end();
}

module.exports = { list, create, remove, password };
