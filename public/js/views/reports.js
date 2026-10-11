import { api } from '../api.js';
import { $, money, escapeHtml, toast, METHOD_LABELS } from '../ui.js';

const iso = (d) => new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

function table(rows, cols) {
  if (!rows.length) return '<p class="empty-note">Sin datos en este periodo.</p>';
  return `<table><thead><tr>${cols.map((c) => `<th class="${c.cls ?? ''}">${c.h}</th>`).join('')}</tr></thead><tbody>${
    rows.map((r) => `<tr>${cols.map((c) => `<td class="${c.cls ?? ''}">${c.v(r)}</td>`).join('')}</tr>`).join('')
  }</tbody></table>`;
}

export async function load() {
  const from = $('#rep-from').value, to = $('#rep-to').value;
  if (!from || !to) return;
  try {
    const r = await api.report(from, to);
    $('#rep-stats').innerHTML = [
      ['Ventas', r.sales], ['Ingresos', money.format(r.revenue)],
      ['Ganancia', money.format(r.profit)], ['Unidades vendidas', r.units], ['Ticket promedio', money.format(r.average_ticket)],
    ].map(([l, v]) => `<div class="stat"><div><span>${l}</span><strong>${v}</strong></div></div>`).join('');

    const max = Math.max(...r.by_day.map((d) => d.revenue), 1);
    $('#rep-chart').innerHTML = r.by_day.length
      ? r.by_day.map((d) => `<div class="col" title="${d.day}: ${money.format(d.revenue)}">
          <i style="height:${Math.max((d.revenue / max) * 100, 2)}%"></i><span>${d.day.slice(8)}/${d.day.slice(5, 7)}</span></div>`).join('')
      : '<p class="empty-note">Sin ventas en este periodo.</p>';

    $('#rep-top').innerHTML = table(r.top_products, [
      { h: 'Producto', v: (p) => escapeHtml(p.name) },
      { h: 'Uds', cls: 'num', v: (p) => p.units },
      { h: 'Ingresos', cls: 'num', v: (p) => money.format(p.revenue) },
    ]);
    $('#rep-cat').innerHTML = table(r.by_category, [
      { h: 'Categoría', v: (c) => escapeHtml(c.category) },
      { h: 'Uds', cls: 'num', v: (c) => c.units },
      { h: 'Ingresos', cls: 'num', v: (c) => money.format(c.revenue) },
    ]);
    $('#rep-method').innerHTML = table(r.by_method, [
      { h: 'Método', v: (m) => METHOD_LABELS[m.payment_method] ?? escapeHtml(m.payment_method) },
      { h: 'Ventas', cls: 'num', v: (m) => m.sales },
      { h: 'Total', cls: 'num', v: (m) => money.format(m.revenue) },
    ]);
    const qs = `?from=${from}&to=${to}`;
    $('#rep-csv').href = `/api/export/sales.csv${qs}`;
    $('#rep-xlsx').href = `/api/export/sales.xlsx${qs}`;
  } catch (err) {
    toast(err.message);
  }
}

export function init() {
  const today = new Date(), start = new Date();
  start.setDate(start.getDate() - 29);
  $('#rep-from').value = iso(start);
  $('#rep-to').value = iso(today);
  $('#rep-apply').addEventListener('click', load);
}
