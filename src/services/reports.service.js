const db = require('../db/database');
const products = require('./products.service');
const movements = require('./movements.service');

const RANGE = "s.voided_at IS NULL AND date(s.created_at,'localtime') BETWEEN ? AND ?";

function summary(from, to) {
  const totals = db
    .prepare(`SELECT COUNT(*) AS sales, COALESCE(SUM(total), 0) AS revenue FROM sales s WHERE ${RANGE}`)
    .get(from, to);
  const { units } = db
    .prepare(
      `SELECT COALESCE(SUM(si.quantity), 0) AS units
       FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE ${RANGE}`
    )
    .get(from, to);
  const { profit } = db
    .prepare(
      `SELECT COALESCE(SUM(si.quantity * (si.unit_price - si.unit_cost)), 0) AS profit
       FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE ${RANGE}`
    )
    .get(from, to);
  const { discounts } = db
    .prepare(`SELECT COALESCE(SUM(discount), 0) AS discounts FROM sales s WHERE ${RANGE}`)
    .get(from, to);
  const by_method = db
    .prepare(`SELECT payment_method, COUNT(*) AS sales, SUM(total) AS revenue FROM sales s WHERE ${RANGE} GROUP BY payment_method ORDER BY revenue DESC`)
    .all(from, to);
  const by_day = db
    .prepare(
      `SELECT date(s.created_at,'localtime') AS day, COUNT(*) AS sales, SUM(total) AS revenue
       FROM sales s WHERE ${RANGE} GROUP BY day ORDER BY day`
    )
    .all(from, to);
  const group = (col) =>
    db
      .prepare(
        `SELECT ${col === 'name' ? 'si.name, si.sku' : 'si.category'}, SUM(si.quantity) AS units,
                SUM(si.quantity * si.unit_price) AS revenue
         FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE ${RANGE}
         GROUP BY ${col === 'name' ? 'si.sku, si.name' : 'si.category'} ORDER BY revenue DESC LIMIT 8`
      )
      .all(from, to);
  return {
    from, to, ...totals, units, profit: profit - discounts, discounts, by_method,
    average_ticket: totals.sales ? totals.revenue / totals.sales : 0,
    by_day, top_products: group('name'), by_category: group('category'),
  };
}

// Datos del panel de Inicio (ventas de hoy, últimos 7 días, alertas y actividad)
function dashboard() {
  const LOCAL = "date(s.created_at,'localtime')";
  const OK = 's.voided_at IS NULL AND';
  const today = db
    .prepare(`SELECT COUNT(*) AS sales, COALESCE(SUM(total), 0) AS revenue FROM sales s WHERE ${OK} ${LOCAL} = date('now','localtime')`)
    .get();
  const week = db
    .prepare(
      `SELECT ${LOCAL} AS day, COUNT(*) AS sales, SUM(total) AS revenue FROM sales s
       WHERE ${OK} ${LOCAL} >= date('now','localtime','-6 days') GROUP BY day ORDER BY day`
    )
    .all();
  const low_stock = db
    .prepare('SELECT id, name, sku, stock, min_stock FROM products WHERE stock <= min_stock ORDER BY stock, name LIMIT 8')
    .all();
  const top_products = db
    .prepare(
      `SELECT si.name, SUM(si.quantity) AS units, SUM(si.quantity * si.unit_price) AS revenue
       FROM sale_items si JOIN sales s ON s.id = si.sale_id
       WHERE ${OK} ${LOCAL} >= date('now','localtime','-29 days')
       GROUP BY si.sku, si.name ORDER BY units DESC LIMIT 5`
    )
    .all();
  return {
    stats: products.stats(), today, week, low_stock, top_products,
    recent: movements.list({ limit: 8 }), expiring: products.expiring(30, 8),
  };
}

module.exports = { summary, dashboard };
