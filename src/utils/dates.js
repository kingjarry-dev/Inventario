const { HttpError } = require('../middleware/errors');

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Lee ?from=YYYY-MM-DD&to=YYYY-MM-DD. Si withDefaults, usa los últimos 30 días.
function dateRange(query, withDefaults) {
  let { from, to } = query;
  if (withDefaults) {
    const today = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 29);
    from = from || fmt(start);
    to = to || fmt(today);
  }
  for (const v of [from, to]) if (v && !ISO.test(v)) throw new HttpError(400, 'Fecha inválida (use AAAA-MM-DD)');
  if (from && to && from > to) throw new HttpError(400, 'La fecha inicial es posterior a la final');
  return { from, to };
}

module.exports = { dateRange, fmt };
