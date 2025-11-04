// ES MÓDULO: este archivo se carga con <script type="module">

import { api } from '../components/api.js';
import { toast, showError, confirmModal } from '../components/ui.js';

const ul         = document.getElementById('lista-servicios');
const detalle    = document.getElementById('detalle');
const txtBuscar  = document.getElementById('txt-buscar');
const btnBuscar  = document.getElementById('btn-buscar');
const btnRecargar= document.getElementById('btn-recargar');

let cacheServicios = [];

async function cargarTodos() {
  try {
    const data = await api.get('/servicios');
    cacheServicios = data;
    renderLista(data);
  } catch (e) {
    showError(e);
  }
}

function renderLista(list) {
  ul.innerHTML = '';
  if (!list.length) {
    ul.innerHTML = `<li>No hay resultados…</li>`;
    return;
  }
  for (const s of list) {
    const li = document.createElement('li');
    li.innerHTML = `
      <div>
        <strong>${s.nombre_wtravel}</strong>
        <div class="meta">${s.tipo} • ${s.proveedor} • ${s.ciudad}</div>
      </div>
      <div class="meta">${s.privado ? 'Privado' : 'Compartido'}</div>
    `;
    li.addEventListener('click', () => verDetalle(s.id));
    ul.appendChild(li);
  }
}

async function verDetalle(id) {
  try {
    const s = await api.get(`/servicios/${id}`);
    detalle.innerHTML = `
      <h3>${s.nombre_wtravel}</h3>
      <div class="detail-grid">
        <div><b>Tipo:</b></div><div>${s.tipo}</div>
        <div><b>Proveedor:</b></div><div>${s.proveedor}</div>
        <div><b>Ciudad:</b></div><div>${s.ciudad}</div>
        <div><b>Tiempo:</b></div><div>${s.tiempo_servicio ?? '-'}</div>
        <div><b>Privado:</b></div><div>${s.privado ? 'Sí' : 'No'}</div>
        <div><b>Descripción:</b></div><div>${s.descripcion ?? '-'}</div>
        ${s.alojamiento ? `
          <div><b>Alojamiento:</b></div>
          <div>${s.alojamiento.noches} noches • ${s.alojamiento.habitaciones} hab • 
              ${s.alojamiento.desayuno ? 'con desayuno' : 'sin desayuno'} • 
              Hotel ${s.alojamiento.categoria_hotel ?? '-'} • Hab ${s.alojamiento.categoria_hab ?? '-'} • Prov ${s.alojamiento.proveedor_hotel}
          </div>` : ''}
      </div>
      <div class="actions">
        <button id="btn-editar">Editar</button>
        <button id="btn-eliminar" class="danger">Eliminar</button>
      </div>
    `;

    document.getElementById('btn-editar').onclick = () => {
      window.location.href = `servicios-editar.html?id=${id}`;
    };

    document.getElementById('btn-eliminar').onclick = async () => {
      const ok = await confirmModal({
        title: 'Eliminar servicio',
        message: '¿Seguro que deseas eliminar este servicio? Esta acción es irreversible.',
        okText: 'Eliminar'
      });
      if (!ok) return;
      try {
        await api.del(`/servicio/${id}`); // ← ruta backend correcta
        toast('Servicio eliminado');
        await cargarTodos();
        detalle.innerHTML = `<p>Selecciona un servicio de la lista para ver el detalle…</p>`;
      } catch (e) { showError(e); }
    };
  } catch (e) { showError(e); }
}

btnBuscar.addEventListener('click', () => {
  const q = (txtBuscar.value || '').toLowerCase().trim();
  if (!q) return renderLista(cacheServicios);
  renderLista(cacheServicios.filter(s =>
    (s.nombre_wtravel || '').toLowerCase().includes(q)
  ));
});
btnRecargar.addEventListener('click', () => {
  txtBuscar.value = '';
  cargarTodos();
});

cargarTodos();
