const db = require('../db/database');

function log(p, type, quantity, note, username) {
  db.prepare(
    `INSERT INTO stock_movements (product_id, product_name, sku, type, quantity, stock_after, note, username)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(p.id, p.name, p.sku, type, quantity, p.stock, note ?? null, username ?? null);
}

function list({ product_id, type, from, to, limit = 300 } = {}) {
  const where = [], args = [];
  if (product_id) { where.push('product_id = ?'); args.push(product_id); }
  if (type) { where.push('type = ?'); args.push(type); }
  if (from) { where.push("date(created_at,'localtime') >= ?"); args.push(from); }
  if (to) { where.push("date(created_at,'localtime') <= ?"); args.push(to); }
  const sql = `SELECT * FROM stock_movements ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY id DESC LIMIT ?`;
  return db.prepare(sql).all(...args, limit);
}

module.exports = { log, list };
