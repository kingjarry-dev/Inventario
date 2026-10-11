// Movimientos, reportes y exportaciones (solo lectura)
const movements = require('../services/movements.service');
const reports = require('../services/reports.service');
const { DATASETS } = require('../services/export.service');
const { buildXlsx, buildCsv } = require('../utils/xlsx');
const { HttpError } = require('../middleware/errors');
const { dateRange, fmt } = require('../utils/dates');

function listMovements(req, res) {
  const limit = Math.min(Math.max(Number(req.query.limit) || 300, 1), 2000);
  const product_id = Number(req.query.product_id) || undefined;
  res.json(movements.list({ product_id, type: req.query.type || undefined, ...dateRange(req.query, false), limit }));
}

function summary(req, res) {
  const { from, to } = dateRange(req.query, true);
  res.json(reports.summary(from, to));
}

const dashboard = (req, res) => res.json(reports.dashboard());

function exportData(req, res) {
  const ds = DATASETS[req.params.dataset];
  const format = req.params.format;
  if (!ds || !['csv', 'xlsx'].includes(format)) throw new HttpError(404, 'Exportación no disponible');
  const rows = ds.rows(dateRange(req.query, false));
  const name = `inventario-${req.params.dataset}-${fmt(new Date())}.${format}`;
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  if (format === 'csv') {
    res.type('text/csv; charset=utf-8').send(buildCsv(ds.headers, rows));
  } else {
    res
      .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .send(buildXlsx(ds.sheet, ds.headers, rows));
  }
}

module.exports = { listMovements, summary, dashboard, exportData };
