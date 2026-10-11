function createSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      sku        TEXT    NOT NULL UNIQUE,
      category   TEXT    NOT NULL DEFAULT 'General',
      price      REAL    NOT NULL CHECK (price >= 0),
      stock      INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
      min_stock  INTEGER NOT NULL DEFAULT 5 CHECK (min_stock >= 0),
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'seller' CHECK (role IN ('admin', 'seller')),
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );

    -- El historial guarda copia del nombre/SKU para sobrevivir si se borra el producto
    CREATE TABLE IF NOT EXISTS stock_movements (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id   INTEGER,
      product_name TEXT NOT NULL,
      sku          TEXT NOT NULL,
      type         TEXT NOT NULL,
      quantity     INTEGER NOT NULL,
      stock_after  INTEGER NOT NULL,
      note         TEXT,
      username     TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_mov_created ON stock_movements(created_at);
    CREATE INDEX IF NOT EXISTS idx_mov_product ON stock_movements(product_id);

    CREATE TABLE IF NOT EXISTS sales (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      total      REAL NOT NULL,
      username   TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);

    CREATE TABLE IF NOT EXISTS sale_items (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id    INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id INTEGER,
      name       TEXT NOT NULL,
      sku        TEXT NOT NULL,
      category   TEXT NOT NULL,
      quantity   INTEGER NOT NULL CHECK (quantity > 0),
      unit_price REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_items_sale ON sale_items(sale_id);
  `);
}

// Migraciones para bases creadas con versiones anteriores
function migrate(db) {
  const has = (table, col) => db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col);
  if (!has('products', 'cost')) db.exec('ALTER TABLE products ADD COLUMN cost REAL NOT NULL DEFAULT 0 CHECK (cost >= 0)');
  if (!has('sale_items', 'unit_cost')) db.exec('ALTER TABLE sale_items ADD COLUMN unit_cost REAL NOT NULL DEFAULT 0');
  if (!has('sales', 'voided_at')) db.exec('ALTER TABLE sales ADD COLUMN voided_at TEXT');
  const add = (t, c, def) => { if (!has(t, c)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${def}`); };
  add('products', 'barcode', 'TEXT');
  add('products', 'expiry_date', 'TEXT');
  add('products', 'supplier_id', 'INTEGER');
  add('products', 'wholesale_price', 'REAL NOT NULL DEFAULT 0');
  add('products', 'wholesale_min', 'INTEGER NOT NULL DEFAULT 0');
  add('sales', 'payment_method', "TEXT NOT NULL DEFAULT 'efectivo'");
  add('sales', 'discount', 'REAL NOT NULL DEFAULT 0');
  add('sales', 'amount_paid', 'REAL');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      phone TEXT, notes TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT, supplier_id INTEGER, supplier_name TEXT,
      total REAL NOT NULL, note TEXT, username TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
      product_id INTEGER, name TEXT NOT NULL, sku TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0), unit_cost REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cash_closings (
      id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL UNIQUE, total_sales REAL NOT NULL,
      expected_cash REAL NOT NULL, counted_cash REAL NOT NULL, difference REAL NOT NULL,
      note TEXT, username TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  if (!has('sales', 'voided_by')) db.exec('ALTER TABLE sales ADD COLUMN voided_by TEXT');
}

// Datos de ejemplo para ver algo al abrir el prototipo por primera vez
function seedIfEmpty(db) {
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM products').get();
  if (total > 0) return;

  const insert = db.prepare(
    'INSERT INTO products (name, sku, category, price, stock, min_stock) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const demo = [
    ['Arroz 1kg', 'ARR-001', 'Abarrotes', 4.5, 40, 10],
    ['Aceite 1L', 'ACE-001', 'Abarrotes', 9.9, 12, 8],
    ['Leche entera 1L', 'LEC-001', 'Lácteos', 4.2, 3, 10],
    ['Galletas de soda', 'GAL-001', 'Snacks', 1.8, 60, 20],
    ['Gaseosa 500ml', 'GAS-001', 'Bebidas', 2.5, 7, 15],
    ['Detergente 500g', 'DET-001', 'Limpieza', 6.8, 18, 6],
  ];
  db.exec('BEGIN');
  try {
    demo.forEach((row) => insert.run(...row));
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

module.exports = { createSchema, migrate, seedIfEmpty };
