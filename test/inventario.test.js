// Pruebas con el runner integrado de Node: npm test
const os = require('os');
const path = require('path');
const fs = require('fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inv-'));
process.env.INVENTARIO_DB = path.join(dir, 'test.db');

const products = require('../src/services/products.service');
const sales = require('../src/services/sales.service');
const purchases = require('../src/services/purchases.service');
const cash = require('../src/services/cash.service');
const reports = require('../src/services/reports.service');
const { importProducts } = require('../src/services/import.service');
const { buildXlsx } = require('../src/utils/xlsx');
const { validateProduct } = require('../src/utils/validate');

const mk = (extra = {}) => products.create(validateProduct({
  name: 'Arroz', sku: 'ARR-T', price: 5, cost: 3, stock: 100, min_stock: 5, ...extra,
}), 'tester');

test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('precio por mayor se aplica desde la cantidad mínima', () => {
  const p = mk({ sku: 'MAY-1', wholesale_price: 4, wholesale_min: 10 });
  assert.equal(products.priceFor(p, 9), 5);
  assert.equal(products.priceFor(p, 10), 4);
  assert.equal(sales.create([{ product_id: p.id, quantity: 10 }], 'tester').total, 40);
});

test('venta con descuento, método de pago y vuelto', () => {
  const p = mk({ sku: 'DES-1' });
  const s = sales.create([{ product_id: p.id, quantity: 2 }], 'tester', { discount: 1, payment_method: 'efectivo', amount_paid: 20 });
  assert.equal(s.subtotal, 10);
  assert.equal(s.total, 9);
  assert.equal(s.amount_paid, 20);
  assert.throws(() => sales.create([{ product_id: p.id, quantity: 1 }], 'tester', { discount: 99 }), /descuento/i);
  assert.throws(() => sales.create([{ product_id: p.id, quantity: 1 }], 'tester', { amount_paid: 1 }), /menor al total/);
  assert.throws(() => sales.create([{ product_id: p.id, quantity: 1 }], 'tester', { payment_method: 'bitcoin' }), /pago/);
});

test('no se vende más que el stock', () => {
  const p = mk({ sku: 'STK-1', stock: 2 });
  assert.throws(() => sales.create([{ product_id: p.id, quantity: 3 }], 'tester'), /Stock insuficiente/);
  assert.equal(products.get(p.id).stock, 2);
});

test('anular una venta devuelve el stock y no cuenta en reportes', () => {
  const p = mk({ sku: 'VOI-1', stock: 10 });
  const s = sales.create([{ product_id: p.id, quantity: 4 }], 'tester');
  assert.equal(products.get(p.id).stock, 6);
  sales.voidSale(s.id, 'tester');
  assert.equal(products.get(p.id).stock, 10);
  assert.throws(() => sales.voidSale(s.id, 'tester'), /ya estaba anulada/);
  const day = new Date().toISOString().slice(0, 10);
  assert.ok(reports.summary(day, day).sales >= 0);
});

test('la ganancia usa el costo guardado y resta descuentos', () => {
  const day = new Date().toISOString().slice(0, 10);
  const before = reports.summary(day, day).profit;
  const p = mk({ sku: 'PRO-1', price: 10, cost: 6 });
  sales.create([{ product_id: p.id, quantity: 2 }], 'tester', { discount: 2 }); // 20 - 12 - 2
  assert.equal(Math.round((reports.summary(day, day).profit - before) * 100) / 100, 6);
});

test('compra sube stock, actualiza costo y proveedor', () => {
  const sup = purchases.suppliers.create({ name: 'Distribuidora Sol' });
  const p = mk({ sku: 'COM-1', stock: 1, cost: 1 });
  const buy = purchases.create({ supplier_id: sup.id, items: [{ product_id: p.id, quantity: 10, unit_cost: 2.5 }] }, 'tester');
  assert.equal(buy.total, 25);
  const after = products.get(p.id);
  assert.equal(after.stock, 11);
  assert.equal(after.cost, 2.5);
  assert.equal(after.supplier_id, sup.id);
  assert.throws(() => purchases.suppliers.create({ name: 'distribuidora sol' }), /Ya existe/);
});

test('pedido sugerido incluye productos con stock bajo', () => {
  const p = mk({ sku: 'SUG-1', stock: 2, min_stock: 5 });
  const s = purchases.suggestions().find((x) => x.id === p.id);
  assert.ok(s && s.suggested >= 3);
});

test('productos por vencer aparecen en el panel', () => {
  const soon = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
  const p = mk({ sku: 'VEN-1', expiry_date: soon });
  assert.ok(products.expiring(30).some((x) => x.id === p.id));
  assert.throws(() => validateProduct({ name: 'x', sku: 'x', price: 1, expiry_date: '31/12/2030' }), /vencimiento/);
});

test('cierre de caja: esperado, diferencia y un solo cierre por día', () => {
  const t = cash.today();
  const r = cash.close({ counted_cash: t.expected_cash - 1 }, 'tester');
  assert.equal(r.closing.difference, -1);
  assert.throws(() => cash.close({ counted_cash: 0 }, 'tester'), /ya fue cerrada/);
});

test('importar CSV crea y actualiza por SKU, y reporta errores', () => {
  const csv = '﻿Nombre;SKU;Precio;Stock;Vencimiento\nLeche;LEC-I;4,50;10;31/12/2030\nSin precio;ERR-I;;3;\n';
  const r1 = importProducts(Buffer.from(csv), 'p.csv', 'tester');
  assert.equal(r1.created, 1);
  assert.equal(r1.errors.length, 1);
  const leche = products.getBySku('LEC-I');
  assert.equal(leche.price, 4.5);
  assert.equal(leche.expiry_date, '2030-12-31');
  const r2 = importProducts(Buffer.from('Nombre,SKU,Precio\nLeche Gloria,LEC-I,5\n'), 'p.csv', 'tester');
  assert.equal(r2.updated, 1);
  assert.equal(products.getBySku('LEC-I').stock, 10); // lo no indicado se conserva
});

test('importar Excel (.xlsx) generado por la propia exportación', () => {
  const xlsx = buildXlsx('Productos', ['Nombre', 'SKU', 'Precio', 'Stock'], [['Fideos', 'FID-X', 3.2, 7]]);
  const r = importProducts(xlsx, 'p.xlsx', 'tester');
  assert.deepEqual([r.created, r.errors.length], [1, 0]);
  assert.equal(products.getBySku('FID-X').stock, 7);
});
