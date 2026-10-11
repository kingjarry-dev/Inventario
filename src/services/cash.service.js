const db = require('../db/database');
const { HttpError } = require('../middleware/errors');

const round2 = (n) => Math.round(n * 100) / 100;
const TODAY = "date(created_at,'localtime') = date('now','localtime')";

function today() {
  const by_method = db
    .prepare(`SELECT payment_method, COUNT(*) AS sales, SUM(total) AS total FROM sales WHERE voided_at IS NULL AND ${TODAY} GROUP BY payment_method`)
    .all();
  const total = round2(by_method.reduce((t, m) => t + m.total, 0));
  const cash = round2(by_method.find((m) => m.payment_method === 'efectivo')?.total ?? 0);
  const { voided } = db.prepare(`SELECT COUNT(*) AS voided FROM sales WHERE voided_at IS NOT NULL AND ${TODAY}`).get();
  const closing = db.prepare("SELECT * FROM cash_closings WHERE day = date('now','localtime')").get() ?? null;
  return { by_method, total, expected_cash: cash, voided, closing };
}

function close({ counted_cash, note }, username) {
  const counted = Number(counted_cash);
  if (!Number.isFinite(counted) || counted < 0) throw new HttpError(400, 'Indica el efectivo contado');
  const t = today();
  if (t.closing) throw new HttpError(400, 'La caja de hoy ya fue cerrada');
  db.prepare(
    `INSERT INTO cash_closings (day, total_sales, expected_cash, counted_cash, difference, note, username)
     VALUES (date('now','localtime'), ?, ?, ?, ?, ?, ?)`
  ).run(t.total, t.expected_cash, round2(counted), round2(counted - t.expected_cash), note ? String(note).trim() : null, username);
  return today();
}

const list = (limit = 15) => db.prepare('SELECT * FROM cash_closings ORDER BY day DESC LIMIT ?').all(limit);

module.exports = { today, close, list };
