const db = require('../db/database');
const products = require('./products.service');
const { readXlsx } = require('../utils/xlsx-read');
const { validateProduct } = require('../utils/validate');

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

// Nombre de columna (sin tildes, minúsculas) -> campo
const ALIASES = {
  name: ['nombre', 'producto', 'name'],
  sku: ['sku', 'codigo interno', 'codigo'],
  category: ['categoria', 'category'],
  price: ['precio', 'precio venta', 'precio de venta', 'price'],
  cost: ['costo', 'precio compra', 'cost'],
  wholesale_price: ['precio por mayor', 'precio mayorista', 'precio mayor'],
  wholesale_min: ['minimo por mayor', 'minimo mayor', 'cantidad por mayor'],
  barcode: ['codigo de barras', 'barras', 'barcode', 'ean'],
  expiry_date: ['vencimiento', 'fecha de vencimiento', 'vence'],
  stock: ['stock', 'cantidad'],
  min_stock: ['stock minimo', 'minimo'],
};
const FIELD_BY_HEADER = Object.fromEntries(Object.entries(ALIASES).flatMap(([f, hs]) => hs.map((h) => [h, f])));

// CSV con comas o punto y coma, comillas y BOM
function parseCsv(text) {
  text = text.replace(/^\uFEFF/, '');
  const first = text.split(/\r?\n/)[0] ?? '';
  const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const toNumber = (v) => {
  const s = String(v).trim();
  return /^\d+,\d+$/.test(s) ? Number(s.replace(',', '.')) : Number(s);
};

// Acepta AAAA-MM-DD, DD/MM/AAAA o el número de serie de Excel
function toDate(v) {
  const s = String(v).trim();
  if (/^\d{5}(\.\d+)?$/.test(s)) return new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 864e5).toISOString().slice(0, 10);
  const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : s;
}

function importProducts(buffer, filename, username) {
  const isXlsx = /\.xlsx$/i.test(filename) || buffer.subarray(0, 2).toString() === 'PK';
  const rows = isXlsx ? readXlsx(buffer) : parseCsv(buffer.toString('utf8'));
  const header = (rows.shift() ?? []).map((h) => FIELD_BY_HEADER[norm(h)] ?? null);
  if (!header.includes('name') || !header.includes('sku')) {
    return { created: 0, updated: 0, errors: ['Faltan las columnas "Nombre" y "SKU" en la primera fila.'] };
  }
  const out = { created: 0, updated: 0, errors: [] };
  rows.forEach((cells, i) => {
    if (cells.every((c) => !String(c).trim())) return;
    const given = {};
    header.forEach((f, c) => {
      const v = String(cells[c] ?? '').trim();
      if (f && v !== '') given[f] = f === 'expiry_date' ? toDate(v) : ['price', 'cost', 'wholesale_price'].includes(f) ? toNumber(v) : v;
    });
    try {
      db.tx(() => {
        const existing = given.sku ? products.getBySku(given.sku) : null;
        const data = validateProduct({ ...(existing ?? {}), ...given });
        if (existing) { products.update(existing.id, data, username); out.updated++; }
        else if (given.price === undefined) throw new Error('falta el precio');
        else { products.create(data, username); out.created++; }
      });
    } catch (err) {
      out.errors.push(`Fila ${i + 2}: ${err.message}`);
    }
  });
  return out;
}

module.exports = { importProducts, parseCsv };
