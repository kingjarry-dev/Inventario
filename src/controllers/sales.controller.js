const service = require('../services/sales.service');
const { HttpError } = require('../middleware/errors');
const { dateRange } = require('../utils/dates');

function create(req, res) {
  const raw = Array.isArray(req.body.items) ? req.body.items : [];
  if (!raw.length) throw new HttpError(400, 'La venta no tiene productos');
  const merged = new Map(); // junta líneas repetidas del mismo producto
  for (const it of raw) {
    const product_id = Number(it.product_id);
    const quantity = Number(it.quantity);
    if (!Number.isInteger(product_id) || product_id <= 0) throw new HttpError(400, 'Producto inválido');
    if (!Number.isInteger(quantity) || quantity <= 0) throw new HttpError(400, 'Cantidad inválida');
    merged.set(product_id, (merged.get(product_id) || 0) + quantity);
  }
  const items = [...merged].map(([product_id, quantity]) => ({ product_id, quantity }));
  const { payment_method, discount, amount_paid } = req.body;
  res.status(201).json(service.create(items, req.user.username, { payment_method, discount, amount_paid }));
}

function list(req, res) {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);
  res.json(service.list({ ...dateRange(req.query, false), limit }));
}

function voidSale(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Venta inválida');
  res.json(service.voidSale(id, req.user.username));
}

module.exports = { create, list, voidSale };
