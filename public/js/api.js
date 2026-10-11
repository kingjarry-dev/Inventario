// Todas las llamadas al servidor viven aquí.
async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (res.status === 401 && !url.startsWith('/api/auth/login')) {
    window.dispatchEvent(new Event('session-expired'));
  }
  if (!res.ok) throw new Error(data.error || 'Error de servidor');
  return data;
}

const post = (url, body) => request(url, { method: 'POST', body: JSON.stringify(body) });

export const api = {
  // Autenticación
  authStatus: () => request('/api/auth/status'),
  setup: (c) => post('/api/auth/setup', c),
  login: (c) => post('/api/auth/login', c),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  // Productos
  list: (q = '') => request(`/api/products?q=${encodeURIComponent(q)}`),
  stats: () => request('/api/products/stats'),
  create: (p) => post('/api/products', p),
  update: (id, p) => request(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(p) }),
  adjustStock: (id, delta) =>
    request(`/api/products/${id}/stock`, { method: 'PATCH', body: JSON.stringify({ delta }) }),
  remove: (id) => request(`/api/products/${id}`, { method: 'DELETE' }),
  dashboard: () => request('/api/dashboard'),
  // Ventas, movimientos, reportes
  createSale: (items, extra = {}) => post('/api/sales', { items, ...extra }),
  voidSale: (id) => request(`/api/sales/${id}/void`, { method: 'POST' }),
  sales: (limit = 30) => request(`/api/sales?limit=${limit}`),
  movements: (type = '') => request(`/api/movements?limit=300&type=${encodeURIComponent(type)}`),
  report: (from, to) => request(`/api/reports/summary?from=${from}&to=${to}`),
  // Compras, proveedores, caja, importación
  suppliers: () => request('/api/suppliers'),
  createSupplier: (s) => post('/api/suppliers', s),
  removeSupplier: (id) => request(`/api/suppliers/${id}`, { method: 'DELETE' }),
  purchases: () => request('/api/purchases'),
  createPurchase: (p) => post('/api/purchases', p),
  suggestions: () => request('/api/purchases/suggestions'),
  cash: () => request('/api/cash'),
  closeCash: (c) => post('/api/cash/close', c),
  importProducts: (file) =>
    request(`/api/products/import?name=${encodeURIComponent(file.name)}`, {
      method: 'POST', body: file, headers: { 'Content-Type': 'application/octet-stream' },
    }),
  // Usuarios
  users: () => request('/api/users'),
  createUser: (u) => post('/api/users', u),
  removeUser: (id) => request(`/api/users/${id}`, { method: 'DELETE' }),
  setPassword: (id, password) =>
    request(`/api/users/${id}/password`, { method: 'PUT', body: JSON.stringify({ password }) }),
};
