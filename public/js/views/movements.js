import { api } from '../api.js';
import { $, escapeHtml, fmtDate, MOVEMENT_LABELS as LABELS } from '../ui.js';

let rows = [];

function draw() {
  const q = $('#mov-search').value.trim().toLowerCase();
  const vis = rows.filter((m) => !q || m.product_name.toLowerCase().includes(q) || m.sku.toLowerCase().includes(q));
  $('#mov-empty').hidden = vis.length > 0;
  $('#mov-body').innerHTML = vis
    .map((m) => `<tr>
      <td>${fmtDate(m.created_at)}</td>
      <td><span class="product-name">${escapeHtml(m.product_name)}</span><span class="product-sku">${escapeHtml(m.sku)}</span></td>
      <td><span class="tag">${LABELS[m.type] ?? escapeHtml(m.type)}</span></td>
      <td class="num ${m.quantity > 0 ? 'pos' : 'neg'}">${m.quantity > 0 ? '+' : ''}${m.quantity}</td>
      <td class="num">${m.stock_after}</td>
      <td>${escapeHtml(m.note ?? '')}</td>
      <td>${escapeHtml(m.username ?? '')}</td></tr>`)
    .join('');
}

export async function load() {
  rows = await api.movements($('#mov-type').value);
  draw();
}

export function init() {
  $('#mov-type').addEventListener('change', load);
  $('#mov-search').addEventListener('input', draw);
}
