import { api } from '../api.js';
import { $, money, escapeHtml, fmtDate, toast, debounce } from '../ui.js';

const cart = new Map(); // product_id -> { product, quantity, unit_cost }
let supplierList = [];

async function loadSuppliers() {
  supplierList = await api.suppliers();
  $('#buy-supplier').innerHTML = '<option value="">Sin proveedor</option>' +
    supplierList.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  $('#supplier-list').innerHTML = supplierList.length
    ? supplierList.map((s) => `<div class="list-item"><div class="top"><span>${escapeHtml(s.name)}</span>
        <button class="btn btn-sm btn-danger" data-rm-supplier="${s.id}">Eliminar</button></div>
        <small>${escapeHtml(s.phone ?? 'Sin teléfono')}</small></div>`).join('')
    : '<p class="empty-note">Aún no registras proveedores.</p>';
}

async function search() {
  const q = $('#buy-search').value.trim();
  if (!q) { $('#buy-results').innerHTML = ''; return; }
  const list = (await api.list(q)).slice(0, 6);
  $('#buy-results').productsById = new Map(list.map((p) => [p.id, p]));
  $('#buy-results').innerHTML = list.map((p) => `<button class="result" data-id="${p.id}">
      <span>${escapeHtml(p.name)}<small>${escapeHtml(p.sku)} · ${p.stock} en stock</small></span><strong>${money.format(p.cost)}</strong></button>`).join('')
    || '<p class="empty-note">Sin resultados</p>';
}

function addLine(product, quantity = 1) {
  const line = cart.get(product.id);
  if (line) line.quantity += quantity;
  else cart.set(product.id, { product, quantity, unit_cost: product.cost });
  drawCart();
}

function drawCart() {
  const lines = [...cart.values()];
  $('#buy-cart').innerHTML = lines.length
    ? lines.map(({ product: p, quantity, unit_cost }) => `<div class="cart-line buy" data-id="${p.id}">
        <span>${escapeHtml(p.name)}<br><small class="hint">${escapeHtml(p.sku)}</small></span>
        <input type="number" min="1" step="1" value="${quantity}" data-f="quantity" title="Cantidad" />
        <input type="number" min="0" step="0.01" value="${unit_cost}" data-f="unit_cost" title="Costo unitario" />
        <button class="rm" data-act="rm" title="Quitar">✕</button></div>`).join('')
    : '<p class="empty-note">Busca un producto o usa el pedido sugerido.</p>';
  $('#buy-total').textContent = money.format(lines.reduce((t, l) => t + l.quantity * l.unit_cost, 0));
  $('#btn-buy').disabled = !lines.length;
}

async function loadSuggest() {
  const rows = await api.suggestions();
  $('#buy-suggest').innerHTML = rows.length
    ? `<div class="table-wrap small"><table><thead><tr><th>Producto</th><th class="num">Stock</th><th class="num">Días</th><th class="num">Pedir</th><th></th></tr></thead><tbody>${
        rows.map((r) => `<tr><td>${escapeHtml(r.name)}<span class="product-sku">${escapeHtml(r.supplier_name ?? '')}</span></td>
          <td class="num">${r.stock}</td><td class="num">${r.days_left ?? '—'}</td><td class="num">${r.suggested}</td>
          <td><button class="btn btn-sm" data-add="${r.id}" data-qty="${r.suggested}">Agregar</button></td></tr>`).join('')}</tbody></table></div>
      <button class="btn btn-sm" id="buy-add-all">Agregar todos al pedido</button>`
    : '<p class="empty-note">Nada por reponer por ahora 🎉</p>';
  $('#buy-suggest').rows = rows;
}

async function loadHistory() {
  const rows = await api.purchases();
  $('#buy-history').innerHTML = rows.length
    ? rows.map((p) => `<div class="list-item"><div class="top"><span>Compra #${p.id}${p.supplier_name ? ' · ' + escapeHtml(p.supplier_name) : ''}</span><span>${money.format(p.total)}</span></div>
        <small>${p.items.map((i) => `${i.quantity}× ${escapeHtml(i.name)}`).join(', ')}</small>
        <small>${fmtDate(p.created_at)} · ${escapeHtml(p.username ?? '')}</small></div>`).join('')
    : '<p class="empty-note">Todavía no hay compras registradas.</p>';
}

export async function load() {
  cart.clear();
  drawCart();
  await Promise.all([loadSuppliers(), loadSuggest(), loadHistory()]);
}

async function addById(id, qty) {
  const p = (await api.list('')).find((x) => x.id === Number(id));
  if (p) addLine(p, Number(qty));
}

export function init() {
  $('#buy-search').addEventListener('input', debounce(search));
  $('#buy-results').addEventListener('click', (e) => {
    const b = e.target.closest('.result');
    if (b) addLine($('#buy-results').productsById.get(Number(b.dataset.id)));
  });
  $('#buy-cart').addEventListener('input', (e) => {
    const f = e.target.dataset.f;
    if (!f) return;
    const line = cart.get(Number(e.target.closest('.cart-line').dataset.id));
    line[f] = Number(e.target.value) || 0;
    $('#buy-total').textContent = money.format([...cart.values()].reduce((t, l) => t + l.quantity * l.unit_cost, 0));
  });
  $('#buy-cart').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act="rm"]');
    if (b) { cart.delete(Number(b.closest('.cart-line').dataset.id)); drawCart(); }
  });
  $('#buy-suggest').addEventListener('click', async (e) => {
    const one = e.target.closest('[data-add]');
    if (one) return addById(one.dataset.add, one.dataset.qty);
    if (e.target.id === 'buy-add-all') {
      const all = await api.list('');
      for (const r of $('#buy-suggest').rows) { const p = all.find((x) => x.id === r.id); if (p) addLine(p, r.suggested); }
    }
  });
  $('#btn-buy').addEventListener('click', async () => {
    try {
      const p = await api.createPurchase({
        supplier_id: Number($('#buy-supplier').value) || null,
        items: [...cart.values()].map((l) => ({ product_id: l.product.id, quantity: l.quantity, unit_cost: l.unit_cost })),
      });
      toast(`Compra #${p.id} registrada: ${money.format(p.total)}`);
      await load();
    } catch (err) { toast(err.message); }
  });
  $('#supplier-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api.createSupplier(Object.fromEntries(new FormData(e.target))); e.target.reset(); await loadSuppliers(); }
    catch (err) { toast(err.message); }
  });
  $('#supplier-list').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-rm-supplier]');
    if (!b || !confirm('¿Eliminar este proveedor?')) return;
    await api.removeSupplier(b.dataset.rmSupplier);
    await loadSuppliers();
  });
}
