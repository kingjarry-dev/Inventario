// Ticket de venta imprimible (impresora térmica de 80 mm o cualquier impresora).
import { $, money, escapeHtml, fmtDate, STORE_NAME, METHOD_LABELS } from './ui.js';

export function showTicket(sale) {
  const change = sale.amount_paid != null ? sale.amount_paid - sale.total : null;
  $('#ticket').innerHTML = `
    <h3>${escapeHtml(STORE_NAME)}</h3>
    <div class="c">Venta #${sale.id}${sale.voided_at ? ' (ANULADA)' : ''}<br>${fmtDate(sale.created_at)}<br>Atendió: ${escapeHtml(sale.username ?? '')}</div>
    <hr>
    ${sale.items.map((i) => `<div>${escapeHtml(i.name)}</div>
      <div class="ln"><span>${i.quantity} × ${money.format(i.unit_price)}</span><span>${money.format(i.quantity * i.unit_price)}</span></div>`).join('')}
    <hr>
    ${sale.discount > 0 ? `<div class="ln"><span>Subtotal</span><span>${money.format(sale.subtotal)}</span></div>
    <div class="ln"><span>Descuento</span><span>-${money.format(sale.discount)}</span></div>` : ''}
    <div class="ln"><b>TOTAL</b><b>${money.format(sale.total)}</b></div>
    <div class="ln"><span>Pago</span><span>${METHOD_LABELS[sale.payment_method] ?? escapeHtml(sale.payment_method)}</span></div>
    ${change !== null ? `<div class="ln"><span>Recibido</span><span>${money.format(sale.amount_paid)}</span></div>
    <div class="ln"><span>Vuelto</span><span>${money.format(change)}</span></div>` : ''}
    <hr><div class="c">¡Gracias por su compra!</div>`;
  $('#ticket-dialog').showModal();
}

export function initTicket() {
  $('#ticket-close').addEventListener('click', () => $('#ticket-dialog').close());
  $('#ticket-print').addEventListener('click', () => window.print());
}
