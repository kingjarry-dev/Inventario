# 📦 Inventario Tienda

Sistema de inventario sencillo para una tienda pequeña.
**Node.js + Express + SQLite (integrado en Node)**, con interfaz web en HTML/CSS/JS puro (sin pasos de compilación).

## Requisitos
- [Node.js](https://nodejs.org) 22.13 o superior

## Cómo ejecutarlo
```bash
npm install
npm start
```
Abre http://localhost:3000. La primera vez se crean productos de ejemplo.

Modo desarrollo (reinicia al guardar): `npm run dev`

## Funciones
- Listar, buscar, crear, editar y eliminar productos
- Sumar / restar stock con un clic
- Alerta de **stock bajo** (stock ≤ mínimo)
- Resumen: productos, unidades, stock bajo y valor del inventario

## Novedades v1.3.0
- **Costo y ganancia**, **anular ventas** (devuelve stock) y **respaldo diario** automático en `data/backups/` (últimos 7).
- **Compras y proveedores**: registra compras (sube stock y actualiza el costo) y **pedido sugerido** según lo vendido en 30 días.
- **Código de barras**: campo en el producto; en *Ventas*, escanea (o escribe el código) y pulsa Enter para agregarlo al carrito.
- **Ticket imprimible** (80 mm) al cobrar y desde el historial de ventas.
- **Pagos y caja**: efectivo / Yape / Plin / tarjeta, vuelto, resumen del día y **cierre de caja** (un cierre por día).
- **Descuentos** (S/ o %) y **precio por mayor** (desde N unidades).
- **Vencimientos**: etiqueta en el inventario y lista "Por vencer" en el Inicio.
- **Importar productos** desde CSV o Excel (`.xlsx`): crea nuevos y actualiza por SKU. Columnas reconocidas: Nombre, SKU, Categoría, Precio, Costo, Precio por mayor, Mínimo por mayor, Código de barras, Vencimiento, Stock, Stock mínimo. Truco: exporta, edita y vuelve a importar.
- **Pruebas**: `npm test` (runner integrado de Node, sin dependencias).

## Estructura
```
inventario-tienda/
├── server.js                  # Punto de entrada: levanta el servidor
├── src/
│   ├── app.js                 # Configura Express (middlewares y rutas)
│   ├── config.js              # Puerto y rutas de archivos
│   ├── routes/                # Qué URL llama a qué controlador
│   ├── controllers/           # Valida la entrada y responde (HTTP)
│   ├── services/              # Lógica de datos y SQL
│   ├── db/                    # Conexión, tablas y datos de ejemplo
│   └── middleware/            # Manejo de errores
├── public/                    # Interfaz web
│   ├── index.html
│   ├── css/styles.css
│   └── js/                    # api.js (servidor) · render.js (HTML) · main.js (eventos)
└── data/                      # Aquí se guarda inventario.db (se crea sola)
```

## Novedades v1.1.0
- **Login y roles**: al abrir por primera vez creas el administrador. Roles: *Administrador* (todo) y *Vendedor* (vende y ajusta stock).
- **Historial de movimientos**: entradas, salidas, ventas, ajustes y bajas, con fecha y usuario.
- **Ventas y reportes**: carrito de venta que descuenta stock; reporte por rango de fechas (ingresos, más vendidos, categorías).
- **Panel de inicio**: ventas de hoy y de 7 días, productos a reponer, más vendidos y actividad reciente. Menú lateral y login renovado (con botón para ver la contraseña).
- **Exportar**: productos, movimientos y ventas a **CSV** y **Excel (.xlsx)**.

> Las contraseñas se guardan con `scrypt`. Si olvidas la del administrador, bórrala con otro admin; si era el único, elimina `data/inventario.db` (¡perderás los datos!) o restaura una copia.

## API
Todas las rutas `/api/*` (salvo `/api/auth/*`) requieren iniciar sesión (cookie `sid`). 🔒 = solo administrador.

| Método | Ruta                              | Descripción                              |
|--------|-----------------------------------|------------------------------------------|
| GET    | `/api/auth/status`                | Estado de sesión / ¿primer uso?          |
| POST   | `/api/auth/setup`                 | Crea el administrador (solo primer uso)  |
| POST   | `/api/auth/login` · `/logout`     | Inicia / cierra sesión                   |
| GET    | `/api/products?q=texto`           | Lista / busca productos                  |
| GET    | `/api/products/stats`             | Resumen del inventario                   |
| POST   | `/api/products` 🔒                | Crea un producto                         |
| PUT    | `/api/products/:id` 🔒            | Edita un producto                        |
| PATCH  | `/api/products/:id/stock`         | Ajusta stock (`{delta: 1}`)              |
| DELETE | `/api/products/:id` 🔒            | Elimina un producto                      |
| POST   | `/api/sales`                      | Registra venta (`{items:[{product_id,quantity}]}`) |
| GET    | `/api/sales?from=&to=`            | Lista ventas                             |
| GET    | `/api/movements?type=`            | Historial de movimientos de stock        |
| GET    | `/api/reports/summary?from=&to=` 🔒 | Reporte de ventas                      |
| GET    | `/api/export/:dataset.:format` 🔒 | `products\|movements\|sales` en `csv\|xlsx` |
| GET/POST/DELETE | `/api/users` 🔒          | Gestión de usuarios                      |
| PUT    | `/api/users/:id/password` 🔒      | Cambia la contraseña de un usuario       |

| POST | `/api/sales/:id/void` 🔒 | Anula una venta |
| GET/POST/DELETE | `/api/suppliers` 🔒 | Proveedores |
| GET/POST | `/api/purchases` 🔒 · `/purchases/suggestions` | Compras y pedido sugerido |
| GET | `/api/cash` · POST `/api/cash/close` | Resumen y cierre de caja |
| POST | `/api/products/import?name=archivo.csv` 🔒 | Importa CSV/XLSX (cuerpo = archivo) |

## Siguientes pasos sugeridos
- Varias tiendas / sucursales
- Clientes y ventas a crédito (fiado)
- Impresión directa en impresora térmica (ESC/POS)
- Aplicación móvil / PWA para contar stock
