const db = require('../db/database');
const products = require('./products.service');
const { HttpError } = require('../middleware/errors');

const round2 = (n) => Math.round(n * 100) / 100;

// ----- Proveedores -----
const suppliers = {
  list: () => db.prepare('SELECT * FROM suppliers ORDER BY name').all(),
  create({ name, phone, notes }) {
    const n = String(name ?? '').trim();
    if (!n) throw new HttpError(400, 'El nombre del proveedor es obligatorio');
    try {
      const id = Number(db.prepare('INSERT INTO suppliers (name, phone, notes) VALUES (?, ?, ?)')
        .run(n, String(phone ?? '').trim() || null, String(notes ?? '').trim() || null).lastInsertRowid);
      return db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) throw new HttpError(409, 'Ya existe un proveedor con ese nombre');
      throw err;
    }
  },
  remove: (id) => db.tx(() => {
    db.prepare('UPDATE products SET supplier_id = NULL WHERE supplier_id = ?').run(id);
    return db.prepare('DELETE FROM suppliers WHERE id = ?').run(id).changes > 0;
  }),
};

// ----- Compras -----
// items: [{ product_id, quantity, unit_cost, expiry_date? }]
function create({ supplier_id, items, note }, username) {
  if (!Array.isArray(items) || !items.length) throw new HttpError(400, 'La compra no tiene productos');
  return db.tx(() => {
    const supplier = supplier_id ? db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplier_id) : null;
    if (supplier_id && !supplier) throw new HttpError(404, 'Proveedor no encontrado');
    const lines = items.map((it) => {
      const quantity = Number(it.quantity), unit_cost = Number(it.unit_cost);
      const p = products.get(Number(it.product_id));
      if (!p) throw new HttpError(404, 'Un producto de la compra ya no existe');
      if (!Number.isInteger(quantity) || quantity <= 0) throw new HttpError(400, `Cantidad inválida para "${p.name}"`);
      if (!Number.isFinite(unit_cost) || unit_cost < 0) throw new HttpError(400, `Costo inválido para "${p.name}"`);
      return { p, quantity, unit_cost, expiry: it.expiry_date || null };
    });
    const total = round2(lines.reduce((t, l) => t + l.quantity * l.unit_cost, 0));
    const id = Number(db.prepare('INSERT INTO purchases (supplier_id, supplier_name, total, note, username) VALUES (?, ?, ?, ?, ?)')
      .run(supplier?.id ?? null, supplier?.name ?? null, total, note ? String(note).trim() : null, username).lastInsertRowid);
    const ins = db.prepare('INSERT INTO purchase_items (purchase_id, product_id, name, sku, quantity, unit_cost) VALUES (?, ?, ?, ?, ?, ?)');
    for (const { p, quantity, unit_cost, expiry } of lines) {
      ins.run(id, p.id, p.name, p.sku, quantity, unit_cost);
      products.adjustStock(p.id, quantity, username, { type: 'compra', note: `Compra #${id}` });
      // el último costo de compra pasa a ser el costo del producto
      db.prepare('UPDATE products SET cost = ?, supplier_id = COALESCE(?, supplier_id), expiry_date = COALESCE(?, expiry_date) WHERE id = ?')
        .run(unit_cost, supplier?.id ?? null, expiry, p.id);
    }
    return get(id);
  });
}

function get(id) {
  const p = db.prepare('SELECT * FROM purchases WHERE id = ?').get(id);
  return p && { ...p, items: db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY id').all(id) };
}

function list(limit = 30) {
  return db.prepare('SELECT id FROM purchases ORDER BY id DESC LIMIT ?').all(limit).map((r) => get(r.id));
}

// Pedido sugerido: alcanzar ~14 días de venta + stock mínimo, según lo vendido en 30 días
function suggestions() {
  const rows = db.prepare(
    `SELECT p.id, p.name, p.sku, p.stock, p.min_stock, p.cost, p.supplier_id, s.name AS supplier_name,
       COALESCE((SELECT SUM(si.quantity) FROM sale_items si JOIN sales sa ON sa.id = si.sale_id
                 WHERE si.product_id = p.id AND sa.voided_at IS NULL
                   AND date(sa.created_at,'localtime') >= date('now','localtime','-29 days')), 0) AS sold_30
     FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id`
  ).all();
  return rows
    .map((r) => {
      const daily = r.sold_30 / 30;
      const days_left = daily > 0 ? r.stock / daily : null;
      const suggested = Math.max(Math.ceil(daily * 14 + r.min_stock - r.stock), 1);
      return { ...r, daily: Math.round(daily * 100) / 100, days_left: days_left === null ? null : Math.round(days_left * 10) / 10, suggested };
    })
    .filter((r) => r.stock <= r.min_stock || (r.days_left !== null && r.days_left < 7))
    .sort((a, b) => (a.days_left ?? 999) - (b.days_left ?? 999) || a.stock - b.stock);
}

module.exports = { suppliers, create, get, list, suggestions };
