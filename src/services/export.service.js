const products = require('./products.service');
const movements = require('./movements.service');
const sales = require('./sales.service');

const toLocal = (utc) => {
  const d = new Date(utc.replace(' ', 'T') + 'Z');
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const DATASETS = {
  products: {
    sheet: 'Productos',
    headers: ['ID', 'Nombre', 'SKU', 'Categoría', 'Precio', 'Costo', 'Precio por mayor', 'Mínimo por mayor', 'Código de barras', 'Vencimiento', 'Stock', 'Stock mínimo', 'Valor en stock'],
    rows: () =>
      products.list('').map((p) => [p.id, p.name, p.sku, p.category, p.price, p.cost, p.wholesale_price, p.wholesale_min, p.barcode, p.expiry_date, p.stock, p.min_stock,
        Math.round(p.price * p.stock * 100) / 100]),
  },
  movements: {
    sheet: 'Movimientos',
    headers: ['Fecha', 'Producto', 'SKU', 'Tipo', 'Cantidad', 'Stock resultante', 'Nota', 'Usuario'],
    rows: (q) =>
      movements.list({ ...q, limit: 100000 }).map((m) => [toLocal(m.created_at), m.product_name, m.sku, m.type,
        m.quantity, m.stock_after, m.note, m.username]),
  },
  sales: {
    sheet: 'Ventas',
    headers: ['Fecha', 'Venta Nº', 'Producto', 'SKU', 'Categoría', 'Cantidad', 'Precio unitario', 'Subtotal', 'Pago', 'Descuento de la venta', 'Usuario'],
    rows: (q) =>
      sales.list({ ...q, limit: 100000 }).filter((s) => !s.voided_at).flatMap((s) =>
        s.items.map((i) => [toLocal(s.created_at), s.id, i.name, i.sku, i.category, i.quantity, i.unit_price,
          Math.round(i.quantity * i.unit_price * 100) / 100, s.payment_method, s.discount, s.username])),
  },
};

module.exports = { DATASETS };
