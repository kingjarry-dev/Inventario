// Arranque: sesión, navegación entre vistas y tema.
import { api } from './api.js';
import { $ } from './ui.js';
import * as dashboard from './views/dashboard.js';
import * as inventory from './views/inventory.js';
import * as sales from './views/sales.js';
import * as movements from './views/movements.js';
import * as reports from './views/reports.js';
import * as users from './views/users.js';
import * as purchases from './views/purchases.js';
import * as cash from './views/cash.js';
import { initTicket } from './ticket.js';

const views = { dashboard, inventory, sales, movements, purchases, cash, reports, users };
const auth = { box: $('#auth'), form: $('#auth-form'), error: $('#auth-error') };
let needsSetup = false;
let ready = false; // los eventos de las vistas se registran una sola vez

// ---------- Tema ----------
$('#btn-theme').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch (_) {}
});

// ---------- Mostrar / ocultar contraseña (ojito) ----------
document.addEventListener('click', (e) => {
  const b = e.target.closest('.pw-toggle');
  if (!b) return;
  const input = b.parentElement.querySelector('input');
  const reveal = input.type === 'password';
  input.type = reveal ? 'text' : 'password';
  b.classList.toggle('on', reveal);
  input.focus();
});

// ---------- Navegación ----------
const TITLES = {
  dashboard: ['Inicio', 'Resumen de tu negocio'],
  inventory: ['Inventario', 'Productos y niveles de stock'],
  sales: ['Ventas', 'Registra una nueva venta'],
  movements: ['Movimientos', 'Historial de entradas y salidas de stock'],
  purchases: ['Compras', 'Proveedores, reposición y pedido sugerido'],
  cash: ['Caja', 'Resumen del día y cierre de caja'],
  reports: ['Reportes', 'Analiza tus ventas por periodo'],
  users: ['Usuarios', 'Quién puede entrar al sistema'],
};

function show(name) {
  $('#page-title').textContent = TITLES[name][0];
  $('#page-sub').textContent = TITLES[name][1];
  $('#btn-new').hidden = name !== 'inventory';
  for (const key of Object.keys(views)) $(`#view-${key}`).hidden = key !== name;
  $('#nav').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  views[name].load();
}
$('#nav').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-view]');
  if (b) show(b.dataset.view);
});

// ---------- Sesión ----------
function showAuth(setup) {
  needsSetup = setup;
  document.body.removeAttribute('data-role');
  ['#nav', '#user-chip', '#btn-logout', '#btn-new'].forEach((s) => ($(s).hidden = true));
  $('#auth-title').textContent = setup ? 'Crea tu cuenta de administrador' : 'Iniciar sesión';
  $('#auth-sub').textContent = setup ? 'Es tu primer uso: este usuario podrá gestionar todo el sistema.' : '';
  $('#auth-submit').textContent = setup ? 'Crear y entrar' : 'Entrar';
  auth.form.elements.password.autocomplete = setup ? 'new-password' : 'current-password';
  auth.form.reset();
  auth.form.elements.password.type = 'password';
  auth.form.querySelector('.pw-toggle').classList.remove('on');
  auth.error.hidden = true;
  auth.box.hidden = false;
  auth.form.elements.username.focus();
}

function enter(user) {
  auth.box.hidden = true;
  document.body.dataset.role = user.role;
  $('#nav').hidden = false;
  $('#user-chip').hidden = false;
  $('#user-chip').textContent = `${user.username} · ${user.role === 'admin' ? 'Admin' : 'Vendedor'}`;
  $('#btn-logout').hidden = false;
  if (!ready) {
    Object.values(views).forEach((v) => v.init(user));
    initTicket();
    ready = true;
  }
  show('dashboard');
}

auth.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const creds = Object.fromEntries(new FormData(auth.form));
  try {
    enter(await (needsSetup ? api.setup(creds) : api.login(creds)));
  } catch (err) {
    auth.error.textContent = err.message;
    auth.error.hidden = false;
  }
});

$('#btn-logout').addEventListener('click', async () => {
  await api.logout();
  showAuth(false);
});
window.addEventListener('session-expired', () => showAuth(false));

(async () => {
  const st = await api.authStatus();
  if (st.user) enter(st.user);
  else showAuth(st.needsSetup);
})();
