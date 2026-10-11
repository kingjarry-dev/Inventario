import { api } from '../api.js';
import { ICONS } from '../render.js';
import { $, money, escapeHtml, fmtDate, MOVEMENT_LABELS as LABELS } from '../ui.js';

const iso = (d) => new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export async function load() {
  const d = await api.dashboard();
  const weekRevenue = d.week.reduce((t, x) => t + x.revenue, 0);
  $('#dash-stats').innerHTML = `
    <div class="stat ok"><div class="stat-icon">${ICONS.coins}</div><div><span>Vendido hoy</span><strong>${money.format(d.today.revenue)}</strong><small>${d.today.sales} venta${d.today.sales === 1 ? '' : 's'}</small></div></div>
    <div class="stat"><div class="stat-icon">${ICONS.layers}</div><div><span>Últimos 7 días</span><strong>${money.format(weekRevenue)}</strong></div></div>
    <div class="stat ${d.stats.low_stock ? 'alert' : 'warn'}"><div class="stat-icon">${ICONS.alert}</div><div><span>Stock bajo</span><strong>${d.stats.low_stock}</strong></div></div>
    <div class="stat"><div class="stat-icon">${ICONS.box}</div><div><span>Valor del inventario</span><strong>${money.format(d.stats.inventory_value)}</strong><small>${d.stats.products} productos</small></div></div>`;

  // Siempre 7 columnas, aunque algún día no haya ventas
  const byDay = new Map(d.week.map((x) => [x.day, x.revenue]));
  const days = Array.from({ length: 7 }, (_, i) => {
    const dt = new Date();
    dt.setDate(dt.getDate() - (6 - i));
    return { day: iso(dt), label: dt.toLocaleDateString('es-PE', { weekday: 'short' }), revenue: byDay.get(iso(dt)) ?? 0 };
  });
  const max = Math.max(...days.map((x) => x.revenue), 1);
  $('#dash-chart').innerHTML = days
    .map((x) => `<div class="col" title="${x.day}: ${money.format(x.revenue)}">
      <span>${x.revenue ? Math.round(x.revenue) : ''}</span><i style="height:${Math.max((x.revenue / max) * 100, 2)}%"></i><span>${x.label}</span></div>`)
    .join('');

  $('#dash-low').innerHTML = d.low_stock.length
    ? d.low_stock.map((p) => `<div class="list-item low-item"><span><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.sku)} · mínimo ${p.min_stock}</small></span>
        <span class="badge ${p.stock === 0 ? 'out' : 'low'}">${p.stock === 0 ? 'Agotado' : p.stock + ' uds'}</span></div>`).join('')
    : '<p class="empty-note">Todo en orden: ningún producto con stock bajo 🎉</p>';

  $('#dash-top').innerHTML = d.top_products.length
    ? `<table><thead><tr><th>Producto</th><th class="num">Uds</th><th class="num">Ingresos</th></tr></thead><tbody>${
        d.top_products.map((p) => `<tr><td>${escapeHtml(p.name)}</td><td class="num">${p.units}</td><td class="num">${money.format(p.revenue)}</td></tr>`).join('')}</tbody></table>`
    : '<p class="empty-note">Aún no hay ventas en los últimos 30 días.</p>';

  const today = iso(new Date());
  $('#dash-expiring').innerHTML = d.expiring.length
    ? d.expiring.map((p) => `<div class="list-item low-item"><span><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.sku)} · ${p.stock} uds</small></span>
        <span class="badge ${p.expiry_date < today ? 'out' : 'low'}">${p.expiry_date < today ? 'Vencido' : 'Vence'} ${p.expiry_date.split('-').reverse().join('/')}</span></div>`).join('')
    : '<p class="empty-note">Nada vence en los próximos 30 días.</p>';

  $('#dash-activity').innerHTML = d.recent.length
    ? d.recent.map((m) => `<div class="list-item"><div class="top"><span>${escapeHtml(m.product_name)}</span>
        <span class="${m.quantity > 0 ? 'pos' : 'neg'}">${m.quantity > 0 ? '+' : ''}${m.quantity}</span></div>
        <small>${LABELS[m.type] ?? escapeHtml(m.type)} · ${fmtDate(m.created_at)} · ${escapeHtml(m.username ?? '')}</small></div>`).join('')
    : '<p class="empty-note">Sin movimientos todavía.</p>';
}

export function init() {}
