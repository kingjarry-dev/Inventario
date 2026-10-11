import { api } from '../api.js';
import { $, money, escapeHtml, toast, METHOD_LABELS } from '../ui.js';

function draw(d) {
  $('#cash-stats').innerHTML = `
    <div class="stat ok"><div><span>Vendido hoy</span><strong>${money.format(d.total)}</strong></div></div>
    <div class="stat"><div><span>Efectivo esperado</span><strong>${money.format(d.expected_cash)}</strong></div></div>
    <div class="stat"><div><span>Ventas anuladas hoy</span><strong>${d.voided}</strong></div></div>`;
  $('#cash-methods').innerHTML = d.by_method.length
    ? `<table><thead><tr><th>Método</th><th class="num">Ventas</th><th class="num">Total</th></tr></thead><tbody>${
        d.by_method.map((m) => `<tr><td>${METHOD_LABELS[m.payment_method] ?? escapeHtml(m.payment_method)}</td><td class="num">${m.sales}</td><td class="num">${money.format(m.total)}</td></tr>`).join('')}</tbody></table>`
    : '<p class="empty-note">Aún no hay ventas hoy.</p>';
  const c = d.closing;
  $('#cash-form').hidden = !!c;
  $('#cash-closed').hidden = !c;
  if (c) $('#cash-closed').textContent = `Caja cerrada por ${c.username}: contado ${money.format(c.counted_cash)} · diferencia ${money.format(c.difference)}.`;
  $('#cash-history').innerHTML = d.history.length
    ? `<table><thead><tr><th>Día</th><th class="num">Ventas</th><th class="num">Contado</th><th class="num">Dif.</th></tr></thead><tbody>${
        d.history.map((h) => `<tr><td>${h.day}</td><td class="num">${money.format(h.total_sales)}</td><td class="num">${money.format(h.counted_cash)}</td>
          <td class="num ${h.difference < 0 ? 'neg' : h.difference > 0 ? 'pos' : ''}">${money.format(h.difference)}</td></tr>`).join('')}</tbody></table>`
    : '<p class="empty-note">Sin cierres todavía.</p>';
}

export async function load() { draw(await api.cash()); }

export function init() {
  $('#cash-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!confirm('¿Cerrar la caja de hoy? No se puede deshacer.')) return;
    try { draw(await api.closeCash(Object.fromEntries(new FormData(e.target)))); toast('Caja cerrada'); }
    catch (err) { toast(err.message); }
  });
}
