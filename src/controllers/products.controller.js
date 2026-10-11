// Capa HTTP: valida la entrada y responde. No contiene SQL.
const service = require('../services/products.service');
const { HttpError } = require('../middleware/errors');
const { validateProduct } = require('../utils/validate');
const importService = require('../services/import.service');

function parseId(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'ID inválido');
  return id;
}

// Convierte el error de SKU duplicado de SQLite en un mensaje claro
function handleUnique(err) {
  if (String(err.message).includes('UNIQUE constraint failed')) {
    throw new HttpError(409, 'Ya existe un producto con ese SKU');
  }
  throw err;
}

function list(req, res) {
  res.json(service.list(req.query.q));
}

function stats(req, res) {
  res.json(service.stats());
}

function create(req, res) {
  const data = validateProduct(req.body);
  try {
    res.status(201).json(service.create(data, req.user.username));
  } catch (err) {
    handleUnique(err);
  }
}

function update(req, res) {
  const id = parseId(req);
  if (!service.get(id)) throw new HttpError(404, 'Producto no encontrado');
  const data = validateProduct(req.body);
  try {
    res.json(service.update(id, data, req.user.username));
  } catch (err) {
    handleUnique(err);
  }
}

function adjustStock(req, res) {
  const id = parseId(req);
  const product = service.get(id);
  if (!product) throw new HttpError(404, 'Producto no encontrado');

  const delta = Number(req.body.delta);
  if (!Number.isInteger(delta) || delta === 0) throw new HttpError(400, 'Cantidad inválida');
  if (product.stock + delta < 0) throw new HttpError(400, 'El stock no puede quedar negativo');

  res.json(service.adjustStock(id, delta, req.user.username));
}

function remove(req, res) {
  const id = parseId(req);
  if (!service.remove(id, req.user.username)) throw new HttpError(404, 'Producto no encontrado');
  res.status(204).end();
}

function importFile(req, res) {
  if (!Buffer.isBuffer(req.body) || !req.body.length) throw new HttpError(400, 'Adjunta un archivo CSV o Excel (.xlsx)');
  res.json(importService.importProducts(req.body, String(req.query.name || ''), req.user.username));
}

module.exports = { importFile, list, stats, create, update, adjustStock, remove };
