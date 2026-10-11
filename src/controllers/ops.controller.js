// Proveedores, compras y caja
const purchases = require('../services/purchases.service');
const cash = require('../services/cash.service');
const { HttpError } = require('../middleware/errors');

const { suppliers } = purchases;

function removeSupplier(req, res) {
  if (!suppliers.remove(Number(req.params.id))) throw new HttpError(404, 'Proveedor no encontrado');
  res.status(204).end();
}

module.exports = {
  listSuppliers: (req, res) => res.json(suppliers.list()),
  createSupplier: (req, res) => res.status(201).json(suppliers.create(req.body)),
  removeSupplier,
  listPurchases: (req, res) => res.json(purchases.list()),
  createPurchase: (req, res) => res.status(201).json(purchases.create(req.body, req.user.username)),
  suggestions: (req, res) => res.json(purchases.suggestions()),
  cashToday: (req, res) => res.json({ ...cash.today(), history: cash.list() }),
  cashClose: (req, res) => res.json({ ...cash.close(req.body, req.user.username), history: cash.list() }),
};
