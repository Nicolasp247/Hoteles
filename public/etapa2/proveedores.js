import { api } from '../components/api.js';
import { toast, showError, confirmModal, setLoading } from '../components/ui.js';

const $ = s => document.querySelector(s);
const tbody = $('#tabla tbody');
const form  = $('#form-proveedor');
const btnCancel = $('#btn-cancel');

let editingId = null;

async function cargar() {
  try {
    const rows = await api.get('/proveedores');
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty">No hay proveedores. Crea el primero ↑</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.nombre}</td>
        <td>${r.web ? `<a href="${r.web}" target="_blank" rel="noopener">${r.web}</a>` : ''}</td>
        <td><span class="badge">${r.iniciales}</span></td>
        <td class="actions">
          <button data-editar="${r.id}">Editar</button>
          <button data-borrar="${r.id}" class="danger">Eliminar</button>
        </td>
      </tr>
    `).join('');
  } catch (e) { showError(e); }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const payload = {
    nombre: (fd.get('nombre')||'').trim(),
    web: (fd.get('web')||'').trim() || null,
    iniciales: (fd.get('iniciales')||'').trim().toUpperCase()
  };
  const btn = form.querySelector('button[type="submit"]');
  try {
    setLoading(btn, true);
    if (editingId) {
      await api.put(`/proveedor/${editingId}`, payload);
      toast('Proveedor actualizado');
    } else {
      await api.post('/proveedor', payload);
      toast('Proveedor creado');
    }
    form.reset(); editingId=null;
    await cargar();
  } catch (e) { showError(e); }
  finally { setLoading(btn, false); }
});

btnCancel.addEventListener('click', () => { form.reset(); editingId=null; });

tbody.addEventListener('click', async (e) => {
  const idE = e.target.dataset.editar;
  const idB = e.target.dataset.borrar;

  if (idE) {
    try {
      const rows = await api.get('/proveedores');
      const r = rows.find(x=>x.id==idE);
      if (!r) return;
      form.nombre.value = r.nombre;
      form.web.value = r.web || '';
      form.iniciales.value = r.iniciales || '';
      editingId = r.id;
    } catch (e) { showError(e); }
  }

  if (idB) {
    const ok = await confirmModal({
      title: 'Eliminar proveedor',
      message: '¿Seguro que deseas eliminar este proveedor? Esta acción no se puede deshacer.',
      okText: 'Eliminar',
      cancelText: 'Cancelar'
    });
    if (!ok) return;
    try {
      await api.del(`/proveedor/${idB}`);
      toast('Proveedor eliminado');
      await cargar();
    } catch (e) { showError(e); }
  }
});

cargar();
