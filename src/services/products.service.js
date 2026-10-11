// Capa de acceso a datos: aquí vive todo el SQL.
const db = require('../db/database');
const movements = require('./movements.service');

const FIELDS = ['name', 'sku', 'category', 'price', 'cost', 'wholesale_price', 'wholesale_min',
  'barcode', 'expiry_date', 'supplier_id', 'stock', 'min_stock'];
const values = (d) => FIELDS.map((f) => d[f] ?? (['cost', 'wholesale_price', 'wholesale_min'].includes(f) ? 0 : null));

// Precio por mayor: aplica desde `wholesale_min` unidades
function priceFor(p, qty) {
  return p.wholesale_min > 0 && p.wholesale_price > 0 && qty >= p.wholesale_min ? p.wholesale_price : p.price;
}

function list(search = '') {
  const term = `%${String(search).trim()}%`;
  return db
    .prepare(
      `SELECT * FROM products
       WHERE name LIKE @term OR sku LIKE @term OR category LIKE @term OR barcode LIKE @term
       ORDER BY name COLLATE NOCASE`
    )
    .all({ term });
}

function get(id) {
  return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
}

function getBySku(sku) {
  return db.prepare('SELECT * FROM products WHERE sku = ?').get(String(sku).toUpperCase());
}

function create(data, username) {
  return db.tx(() => {
    const info = db
      .prepare(`INSERT INTO products (${FIELDS.join(', ')}) VALUES (${FIELDS.map(() => '?').join(', ')})`)
      .run(...values(data));
    const p = get(Number(info.lastInsertRowid));
    if (p.stock > 0) movements.log(p, 'inicial', p.stock, 'Stock inicial', username);
    return p;
  });
}

function update(id, data, username) {
  return db.tx(() => {
    const before = get(id);
    db.prepare(`UPDATE products SET ${FIELDS.map((f) => `${f} = ?`).join(', ')} WHERE id = ?`).run(...values(data), id);
    const p = get(id);
    if (p.stock !== before.stock) movements.log(p, 'ajuste', p.stock - before.stock, 'Edición del producto', username);
    return p;
  });
}

// opts.type / opts.note permiten que una venta o compra registre su propio tipo de movimiento
function adjustStock(id, delta, username, opts = {}) {
  return db.tx(() => {
    db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(delta, id);
    const p = get(id);
    movements.log(p, opts.type || (delta > 0 ? 'entrada' : 'salida'), delta, opts.note, username);
    return p;
  });
}

function remove(id, username) {
  return db.tx(() => {
    const p = get(id);
    const ok = db.prepare('DELETE FROM products WHERE id = ?').run(id).changes > 0;
    if (ok && p.stock > 0) movements.log({ ...p, stock: 0 }, 'baja', -p.stock, 'Producto eliminado', username);
    return ok;
  });
}

function stats() {
  return db
    .prepare(
      `SELECT
         COUNT(*)                             AS products,
         COALESCE(SUM(stock), 0)              AS units,
         COALESCE(SUM(stock <= min_stock), 0) AS low_stock,
         COALESCE(SUM(stock * price), 0)      AS inventory_value
       FROM products`
    )
    .get();
}

// Productos con stock que vencen en los próximos `days` días (o ya vencidos)
function expiring(days = 30, limit = 8) {
  return db
    .prepare(
      `SELECT id, name, sku, stock, expiry_date FROM products
       WHERE expiry_date IS NOT NULL AND stock > 0 AND expiry_date <= date('now','localtime', ?)
       ORDER BY expiry_date LIMIT ?`
    )
    .all(`+${days} days`, limit);
}

module.exports = { list, get, getBySku, create, update, adjustStock, remove, stats, expiring, priceFor };
