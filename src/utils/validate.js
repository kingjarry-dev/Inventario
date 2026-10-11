const { HttpError } = require('../middleware/errors');

const ISO = /^\d{4}-\d{2}-\d{2}$/;

// Valida y normaliza los datos de un producto (formulario, API e importación)
function validateProduct(body) {
  const name = String(body.name ?? '').trim();
  const sku = String(body.sku ?? '').trim().toUpperCase();
  const category = String(body.category ?? '').trim() || 'General';
  const price = Number(body.price);
  const cost = Number(body.cost || 0);
  const wholesale_price = Number(body.wholesale_price || 0);
  const wholesale_min = Number(body.wholesale_min || 0);
  const stock = Number(body.stock ?? 0);
  const min_stock = Number(body.min_stock ?? 5);
  const barcode = String(body.barcode ?? '').trim() || null;
  const expiry_date = String(body.expiry_date ?? '').trim() || null;
  const supplier_id = Number(body.supplier_id) > 0 ? Number(body.supplier_id) : null;

  if (!name) throw new HttpError(400, 'El nombre es obligatorio');
  if (!sku) throw new HttpError(400, 'El SKU es obligatorio');
  if (!Number.isFinite(price) || price < 0) throw new HttpError(400, 'Precio inválido');
  if (!Number.isFinite(cost) || cost < 0) throw new HttpError(400, 'Costo inválido');
  if (!Number.isFinite(wholesale_price) || wholesale_price < 0) throw new HttpError(400, 'Precio por mayor inválido');
  if (!Number.isInteger(wholesale_min) || wholesale_min < 0) throw new HttpError(400, 'Cantidad por mayor inválida');
  if (wholesale_price > 0 && wholesale_min < 2) throw new HttpError(400, 'Indica desde cuántas unidades aplica el precio por mayor (mínimo 2)');
  if (!Number.isInteger(stock) || stock < 0) throw new HttpError(400, 'Stock inválido');
  if (!Number.isInteger(min_stock) || min_stock < 0) throw new HttpError(400, 'Stock mínimo inválido');
  if (expiry_date && (!ISO.test(expiry_date) || Number.isNaN(Date.parse(expiry_date)))) throw new HttpError(400, 'Fecha de vencimiento inválida');

  return { name, sku, category, price, cost, wholesale_price, wholesale_min, barcode, expiry_date, supplier_id, stock, min_stock };
}

module.exports = { validateProduct };
