import { api } from '../components/api.js';
import { toast, showError, confirmModal, setLoading } from '../components/ui.js';

const $ = s => document.querySelector(s);
const form = $('#form-tipo');
const tbody = document.createElement('tbody');
const table = document.createElement('table');
table.className = 'table';
table.innerHTML = `<thead><tr><th>Nombre</th><th style="width:140px"></th></tr></thead>`;
table.appendChild(tbody);
document.querySelector('.wrap').appendChild(table);

async function cargar() {
  try {
    const tipos = await api.get('/tipos-servicio');
    if (!tipos.length) {
      tbody.innerHTML = `<tr><td colspan="2" class="empty">No hay tipos creados</td></tr>`;
      return;
    }
    tbody.innerHTML = tipos.map(t => `
      <tr>
        <td>${t.nombre}</td>
        <td class="actions">
          <button data-editar="${t.id}">Editar</button>
          <button data-borrar="${t.id}" class="danger">Eliminar</button>
        </td>
      </tr>`).join('');
  } catch (e) { showError(e); }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const payload = { nombre: (fd.get('nombre')||'').trim() };
  const btn = form.querySelector('button[type="submit"]');
  try {
    setLoading(btn, true);
    await api.post('/tipo-servicio', payload);
    toast('Tipo creado');
    form.reset();
    await cargar();
  } catch (e) { showError(e); }
  finally { setLoading(btn, false); }
});

tbody.addEventListener('click', async (e) => {
  const idE = e.target.dataset.editar;
  const idB = e.target.dataset.borrar;

  if (idE) {
    const nuevo = prompt('Nuevo nombre para el tipo:');
    if (!nuevo) return;
    try {
      await api.put(`/tipo-servicio/${idE}`, { nombre: nuevo.trim() });
      toast('Tipo actualizado');
      await cargar();
    } catch (e) { showError(e); }
  }

  if (idB) {
    const ok = await confirmModal({
      title: 'Eliminar tipo',
      message: '¿Eliminar este tipo de servicio?',
      okText: 'Eliminar'
    });
    if (!ok) return;
    try {
      await api.del(`/tipo-servicio/${idB}`);
      toast('Tipo eliminado');
      await cargar();
    } catch (e) { showError(e); }
  }
});

cargar();