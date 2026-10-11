import { api } from '../api.js';
import { $, escapeHtml, toast } from '../ui.js';

let me = null;

export async function load() {
  const users = await api.users();
  $('#users-body').innerHTML = users
    .map((u) => `<tr data-id="${u.id}" data-name="${escapeHtml(u.username)}">
      <td><span class="product-name">${escapeHtml(u.username)}</span></td>
      <td><span class="tag">${u.role === 'admin' ? 'Administrador' : 'Vendedor'}</span></td>
      <td class="right">
        <button class="btn btn-sm" data-act="pw">Cambiar clave</button>
        ${u.id === me.id ? '' : '<button class="btn btn-sm btn-danger" data-act="del">Eliminar</button>'}
      </td></tr>`)
    .join('');
}

export function init(user) {
  me = user;
  $('#user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#user-error');
    err.hidden = true;
    try {
      await api.createUser(Object.fromEntries(new FormData(e.target)));
      e.target.reset();
      toast('Usuario creado');
      await load();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    }
  });
  $('#users-body').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const tr = btn.closest('tr');
    const id = Number(tr.dataset.id), name = tr.dataset.name;
    try {
      if (btn.dataset.act === 'del') {
        if (!confirm(`¿Eliminar al usuario "${name}"?`)) return;
        await api.removeUser(id);
        toast('Usuario eliminado');
      } else {
        const pw = prompt(`Nueva contraseña para "${name}" (mínimo 6 caracteres):`);
        if (!pw) return;
        await api.setPassword(id, pw);
        toast('Contraseña actualizada');
      }
      await load();
    } catch (ex) {
      toast(ex.message);
    }
  });
}
