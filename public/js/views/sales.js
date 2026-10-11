import { api } from '../api.js';
import { $, money, escapeHtml, fmtDate, toast, debounce, priceFor, METHOD_LABELS } from '../ui.js';
import { showTicket } from '../ticket.js';

const cart = new Map(); // product_id -> { product, quantity }
let recent = [];

async function search() {
  const all = await api.list($('#sale-search').value);
  const list = all.slice(0, 8);
  $('#sale-results').innerHTML = list
    .map((p) => `<button class="result" data-id="${p.id}" ${p.stock <= 0 ? 'disabled' : ''}>
        <span>${escapeHtml(p.name)}<small>${escapeHtml(p.sku)} · ${p.stock} en stock${p.wholesale_min > 0 && p.wholesale_price > 0 ? ` · mayor desde ${p.wholesale_min}: ${money.format(p.wholesale_price)}` : ''}</small></span>
        <strong>${money.format(p.price)}</strong></button>`)
    .join('') || '<p class="empty-note">Sin resultados</p>';
  $('#sale-results').productsById = new Map(all.map((p) => [p.id, p]));
  return all;
}

function add(product) {
  const line = cart.get(product.id) || { product, quantity: 0 };
  if (line.quantity >= product.stock) return toast('No hay más stock disponible');
  line.quantity++;
  cart.set(product.id, line);
  drawCart();
}

// Calcula subtotal, descuento (S/), total y vuelto con lo que hay en pantalla
function totals() {
  const lines = [...cart.values()];
  const subtotal = lines.reduce((t, l) => t + priceFor(l.product, l.quantity) * l.quantity, 0);
  const raw = Number($('#sale-discount').value) || 0;
  const amount = $('#sale-discount-type').value === 'pct' ? (subtotal * raw) / 100 : raw;
  const discount = Math.min(Math.max(Math.round(amount * 100) / 100, 0), subtotal);
  const total = Math.round((subtotal - discount) * 100) / 100;
  const paid = $('#sale-paid').value === '' ? null : Number($('#sale-paid').value);
  return { lines, subtotal, discount, total, paid };
}

function drawCart() {
  const { lines, subtotal, discount, total, paid } = totals();
  $('#cart').innerHTML = lines.length
    ? lines.map(({ product: p, quantity }) => {
        const unit = priceFor(p, quantity);
        return `<div class="cart-line" data-id="${p.id}">
          <span>${escapeHtml(p.name)}<br><small class="hint">${money.format(unit)} c/u${unit !== p.price ? ' · precio por mayor' : ''}</small></span>
          <span class="qty"><button data-act="dec">−</button><b>${quantity}</b><button data-act="inc">+</button></span>
          <strong>${money.format(unit * quantity)}</strong>
          <button class="rm" data-act="rm" title="Quitar">✕</button>
        </div>`;
      }).join('')
    : '<p class="empty-note">Agrega productos (o escanea un código de barras) para iniciar la venta.</p>';
  $('#cart-total').textContent = money.format(total);
  const cash = $('#sale-method').value === 'efectivo';
  $('#paid-wrap').hidden = !cash;
  const parts = [];
  if (discount > 0) parts.push(`Subtotal ${money.format(subtotal)} · Descuento −${money.format(discount)}`);
  if (cash && paid !== null) parts.push(paid >= total ? `Vuelto: ${money.format(paid - total)}` : 'El monto recibido no alcanza');
  $('#cart-extra').textContent = parts.join(' · ');
  $('#btn-checkout').disabled = !lines.length;
}

export async function load() {
  cart.clear();
  $('#sale-discount').value = 0;
  $('#sale-paid').value = '';
  drawCart();
  await Promise.all([search(), loadHistory()]);
  $('#sale-search').focus();
}

async function loadHistory() {
  recent = await api.sales(30);
  $('#sales-list').innerHTML = recent.length
    ? recent.map((s) => `<div class="list-item${s.voided_at ? ' voided' : ''}">
        <div class="top"><span>Venta #${s.id}${s.voided_at ? ' · ANULADA' : ''}</span><span>${money.format(s.total)}</span></div>
        <small>${s.items.map((i) => `${i.quantity}× ${escapeHtml(i.name)}`).join(', ')}</small>
        <small>${fmtDate(s.created_at)} · ${escapeHtml(s.username ?? '')} · ${METHOD_LABELS[s.payment_method] ?? ''}${s.discount > 0 ? ` · desc. ${money.format(s.discount)}` : ''}</small>
        <div class="row-actions"><button class="btn btn-sm" data-ticket="${s.id}">Ticket</button>
        ${s.voided_at ? '' : `<button class="btn btn-sm btn-danger admin-only" data-void="${s.id}">Anular</button>`}</div></div>`).join('')
    : '<p class="empty-note">Todavía no hay ventas registradas.</p>';
}

export function init() {
  $('#sales-list').addEventListener('click', async (e) => {
    const t = e.target.closest('[data-ticket]');
    if (t) return showTicket(recent.find((s) => s.id === Number(t.dataset.ticket)));
    const btn = e.target.closest('[data-void]');
    if (!btn || !confirm(`¿Anular la venta #${btn.dataset.void}? Se devolverá el stock.`)) return;
    try { await api.voidSale(btn.dataset.void); toast('Venta anulada'); await load(); } catch (err) { toast(err.message); }
  });
  ['#sale-discount', '#sale-discount-type', '#sale-method', '#sale-paid'].forEach((s) => {
    $(s).addEventListener('input', drawCart);
    $(s).addEventListener('change', drawCart);
  });
  $('#sale-search').addEventListener('input', debounce(search));
  // Enter = lector de código de barras: coincidencia exacta de código/SKU, o el primer resultado
  $('#sale-search').addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const code = $('#sale-search').value.trim().toLowerCase();
    if (!code) return;
    const all = await search();
    const pick = all.find((p) => p.barcode?.toLowerCase() === code || p.sku.toLowerCase() === code && p.stock > 0)
      ?? all.find((p) => p.stock > 0);
    if (!pick) return toast('Producto no encontrado o sin stock');
    add(pick);
    $('#sale-search').value = '';
    await search();
  });
  $('#sale-results').addEventListener('click', (e) => {
    const btn = e.target.closest('.result');
    if (btn) add($('#sale-results').productsById.get(Number(btn.dataset.id)));
  });
  $('#cart').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = Number(btn.closest('.cart-line').dataset.id);
    const line = cart.get(id);
    if (btn.dataset.act === 'rm') cart.delete(id);
    else if (btn.dataset.act === 'dec') { if (--line.quantity <= 0) cart.delete(id); }
    else if (line.quantity < line.product.stock) line.quantity++;
    else toast('No hay más stock disponible');
    drawCart();
  });
  $('#btn-checkout').addEventListener('click', async () => {
    const { lines, discount, total, paid } = totals();
    const method = $('#sale-method').value;
    if (method === 'efectivo' && paid !== null && paid < total) return toast('El monto recibido no alcanza');
    try {
      const sale = await api.createSale(
        lines.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
        { discount, payment_method: method, amount_paid: method === 'efectivo' ? paid : null }
      );
      toast(`Venta #${sale.id} registrada: ${money.format(sale.total)}`);
      await load();
      showTicket(sale);
    } catch (err) {
      toast(err.message);
    }
  });
}
