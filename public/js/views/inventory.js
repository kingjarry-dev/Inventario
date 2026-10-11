import { api } from '../api.js';
import { renderStats, renderProducts } from '../render.js';
import { $, toast, debounce } from '../ui.js';

const els = {
  stats: $('#stats'), body: $('#products-body'), empty: $('#empty'), search: $('#search'),
  dialog: $('#dialog'), form: $('#product-form'), title: $('#dialog-title'), error: $('#form-error'),
  count: $('#count'), filters: $('#filters'),
};
let products = [];
let filter = 'all';

export async function load() {
  const [list, stats] = await Promise.all([api.list(els.search.value), api.stats()]);
  products = list;
  draw();
  renderStats(els.stats, stats);
}

function draw() {
  const visible = filter === 'low' ? products.filter((p) => p.stock <= p.min_stock) : products;
  renderProducts(els.body, els.empty, visible);
  els.count.textContent = visible.length ? `Mostrando ${visible.length} producto${visible.length === 1 ? '' : 's'}` : '';
}

function openForm(product = null) {
  els.form.reset();
  els.error.hidden = true;
  els.title.textContent = product ? 'Editar producto' : 'Nuevo producto';
  els.form.elements.id.value = product?.id ?? '';
  if (product) {
    for (const key of ['name', 'sku', 'category', 'price', 'cost', 'wholesale_price', 'wholesale_min', 'barcode', 'expiry_date', 'supplier_id', 'stock', 'min_stock']) {
      els.form.elements[key].value = product[key] ?? '';
    }
  }
  els.dialog.showModal();
}

export function init() {
  els.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(els.form));
    const id = data.id;
    delete data.id;
    try {
      if (id) await api.update(id, data);
      else await api.create(data);
      els.dialog.close();
      toast(id ? 'Producto actualizado' : 'Producto creado');
      await load();
    } catch (err) {
      els.error.textContent = err.message;
      els.error.hidden = false;
    }
  });

  $('#btn-import').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const r = await api.importProducts(file);
      toast(`Importación: ${r.created} nuevos, ${r.updated} actualizados${r.errors.length ? `, ${r.errors.length} con error` : ''}`);
      if (r.errors.length) alert('Filas con problemas:\n\n' + r.errors.slice(0, 15).join('\n') + (r.errors.length > 15 ? '\n…' : ''));
      await load();
    } catch (err) { toast(err.message); }
  });

  $('#btn-new').addEventListener('click', () => openForm());
  $('#btn-cancel').addEventListener('click', () => els.dialog.close());
  els.search.addEventListener('input', debounce(load));

  els.filters.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    filter = chip.dataset.filter;
    els.filters.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === chip));
    draw();
  });

  els.body.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = Number(btn.closest('tr').dataset.id);
    const product = products.find((p) => p.id === id);
    try {
      switch (btn.dataset.action) {
        case 'inc': await api.adjustStock(id, 1); break;
        case 'dec': await api.adjustStock(id, -1); break;
        case 'edit': return openForm(product);
        case 'delete':
          if (!confirm(`¿Eliminar "${product.name}"?`)) return;
          await api.remove(id);
          toast('Producto eliminado');
          break;
      }
      await load();
    } catch (err) {
      toast(err.message);
    }
  });
}
