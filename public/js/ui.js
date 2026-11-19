// Utilidades compartidas por todas las vistas.
export const $ = (sel, root = document) => root.querySelector(sel);
export const money = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });
export const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// SQLite guarda UTC ("2026-10-07 21:30:00"); aquí se muestra en hora local
export const fmtDate = (utc) =>
  new Date(String(utc).replace(' ', 'T') + 'Z').toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });

export function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.hidden = true), 2500);
}

export function debounce(fn, ms = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export const STORE_NAME = 'Tienda Tania';
export const METHOD_LABELS = { efectivo: 'Efectivo', yape: 'Yape', plin: 'Plin', tarjeta: 'Tarjeta' };
export const MOVEMENT_LABELS = {
  entrada: 'Entrada', salida: 'Salida', venta: 'Venta', ajuste: 'Ajuste', inicial: 'Stock inicial',
  baja: 'Baja', compra: 'Compra', 'devolución': 'Devolución',
};
export const priceFor = (p, qty) =>
  p.wholesale_min > 0 && p.wholesale_price > 0 && qty >= p.wholesale_min ? p.wholesale_price : p.price;
