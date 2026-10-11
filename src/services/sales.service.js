const db = require('../db/database');
const products = require('./products.service');
const { HttpError } = require('../middleware/errors');

const METHODS = ['efectivo', 'yape', 'plin', 'tarjeta'];
const round2 = (n) => Math.round(n * 100) / 100;

// items: [{ product_id, quantity }] (ya validado y sin repetidos)
// opts: { payment_method, discount (S/), amount_paid }
function create(items, username, opts = {}) {
  const method = opts.payment_method || 'efectivo';
  if (!METHODS.includes(method)) throw new HttpError(400, 'Método de pago inválido');
  const discount = round2(Number(opts.discount || 0));
  if (!Number.isFinite(discount) || discount < 0) throw new HttpError(400, 'Descuento inválido');

  return db.tx(() => {
    const lines = items.map(({ product_id, quantity }) => {
      const p = products.get(product_id);
      if (!p) throw new HttpError(404, 'Un producto de la venta ya no existe');
      if (p.stock < quantity) throw new HttpError(400, `Stock insuficiente de "${p.name}" (disponible: ${p.stock})`);
      return { p, quantity, price: products.priceFor(p, quantity) };
    });
    const subtotal = round2(lines.reduce((t, l) => t + l.price * l.quantity, 0));
    if (discount > subtotal) throw new HttpError(400, 'El descuento no puede superar el subtotal');
    const total = round2(subtotal - discount);
    let paid = null;
    if (method === 'efectivo' && opts.amount_paid != null && opts.amount_paid !== '') {
      paid = round2(Number(opts.amount_paid));
      if (!Number.isFinite(paid) || paid < total) throw new HttpError(400, 'El monto recibido es menor al total');
    }
    const sale = Number(
      db.prepare('INSERT INTO sales (total, username, payment_method, discount, amount_paid) VALUES (?, ?, ?, ?, ?)')
        .run(total, username, method, discount, paid).lastInsertRowid
    );
    const ins = db.prepare(
      `INSERT INTO sale_items (sale_id, product_id, name, sku, category, quantity, unit_price, unit_cost)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const { p, quantity, price } of lines) {
      ins.run(sale, p.id, p.name, p.sku, p.category, quantity, price, p.cost);
      products.adjustStock(p.id, -quantity, username, { type: 'venta', note: `Venta #${sale}` });
    }
    return get(sale);
  });
}

// Anula una venta y devuelve el stock (si el producto aún existe)
function voidSale(id, username) {
  return db.tx(() => {
    const sale = get(id);
    if (!sale) throw new HttpError(404, 'Venta no encontrada');
    if (sale.voided_at) throw new HttpError(400, 'La venta ya estaba anulada');
    db.prepare("UPDATE sales SET voided_at = datetime('now'), voided_by = ? WHERE id = ?").run(username, id);
    for (const it of sale.items) {
      if (it.product_id && products.get(it.product_id)) {
        products.adjustStock(it.product_id, it.quantity, username, { type: 'devolución', note: `Anulación venta #${id}` });
      }
    }
    return get(id);
  });
}

function itemsOf(saleId) {
  return db.prepare('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id').all(saleId);
}

function withSubtotal(s) {
  return { ...s, subtotal: round2(s.total + s.discount), items: itemsOf(s.id) };
}

function get(id) {
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
  return sale && withSubtotal(sale);
}

function list({ from, to, limit = 50 } = {}) {
  const where = [], args = [];
  if (from) { where.push("date(created_at,'localtime') >= ?"); args.push(from); }
  if (to) { where.push("date(created_at,'localtime') <= ?"); args.push(to); }
  const rows = db
    .prepare(`SELECT * FROM sales ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT ?`)
    .all(...args, limit);
  return rows.map(withSubtotal);
}

module.exports = { create, voidSale, get, list, METHODS };
