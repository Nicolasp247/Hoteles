// public/etapa2/servicios-editar.js
const API = 'http://localhost:3000/api';
const qs = new URLSearchParams(location.search);
const id = Number(qs.get('id'));

if (!id) { alert('Falta el parámetro id'); location.href = 'servicios-gestionar.html'; }

const el = {
  frm: document.getElementById('frm'),
  id_tipo: document.getElementById('id_tipo'),
  id_proveedor: document.getElementById('id_proveedor'),
  selPais: document.getElementById('sel-pais'),
  selCiudad: document.getElementById('sel-ciudad'),
  nombre: document.getElementById('nombre_wtravel'),
  tiempo: document.getElementById('tiempo_servicio'),
  privado: document.getElementById('privado'),
  desc: document.getElementById('descripcion'),
  // horas
  inpHora: document.getElementById('inp-hora'),
  chips: document.getElementById('chips'),
  btnAddHora: document.getElementById('btn-add-hora'),
  btnReemplazarHoras: document.getElementById('btn-reemplazar-horas'),
  // aloja
  boxAloja: document.getElementById('box-aloja'),
  aloNoches: document.getElementById('alo-noches'),
  aloHabs: document.getElementById('alo-habs'),
  aloDes: document.getElementById('alo-des'),
  aloCatH: document.getElementById('alo-cath'),
  aloCatB: document.getElementById('alo-cab'),
  aloProv: document.getElementById('alo-prov'),
  btnGuardarAloja: document.getElementById('btn-guardar-aloja'),
  // otros
  btnCancel: document.getElementById('btn-cancel')
};

let tipos = [];
let paises = [];
let horas = [];      // array de "HH:MM"
let idPaisActual = null;

// Util
const toTime = (s) => {
  if (!s) return null;
  const t = String(s).trim();
  if (/^\d{2}:\d{2}$/.test(t)) return t;
  return null;
};
const isAlojamiento = () => {
  const t = tipos.find(x => x.id == el.id_tipo.value);
  return t && t.nombre.toUpperCase() === 'ALOJAMIENTO';
};

// Cargar catálogos
async function cargarCatalogos() {
  const [tip, prov, allPaises] = await Promise.all([
    fetch(`${API}/tipos-servicio`).then(r => r.json()),
    fetch(`${API}/proveedores`).then(r => r.json()),
    fetch(`${API}/paises`).then(r => r.json()) // listado completo (id, nombre, continente)
  ]);
  tipos = tip;
  paises = allPaises;

  el.id_tipo.innerHTML = tip.map(t => `<option value="${t.id}">${t.nombre}</option>`).join('');
  el.id_proveedor.innerHTML = prov.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
  el.selPais.innerHTML = allPaises
    .map(p => `<option value="${p.id}">${p.nombre} — ${p.continente}</option>`).join('');
}

// Cargar ciudades del país
async function cargarCiudades(idPais, idCiudadSeleccionada = null) {
  if (!idPais) {
    el.selCiudad.innerHTML = '';
    el.selCiudad.disabled = true;
    return;
  }
  el.selCiudad.disabled = false;
  const cities = await fetch(`${API}/ciudades/${idPais}`).then(r => r.json());
  el.selCiudad.innerHTML = cities.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
  if (idCiudadSeleccionada) el.selCiudad.value = idCiudadSeleccionada;
}

// Render chips horarios
function pintarChips() {
  el.chips.innerHTML = horas.map(h => `
    <span class="chip">${h}
      <button type="button" data-del="${h}">✕</button>
    </span>`).join('');
}
el.chips.addEventListener('click', (e) => {
  const h = e.target.dataset.del;
  if (!h) return;
  horas = horas.filter(x => x !== h);
  pintarChips();
});

// Carga detalle
async function cargarDetalle() {
  const s = await fetch(`${API}/servicios/${id}`).then(r => r.json());
  // Básicos
  el.id_tipo.value = s.id_tipo;
  el.id_proveedor.value = s.id_proveedor;
  el.nombre.value = s.nombre_wtravel || '';
  el.tiempo.value = s.tiempo_servicio || '';
  el.privado.value = s.privado ? '1' : '0';
  el.desc.value = s.descripcion || '';

  // País a partir de ciudad
  const infoCiudad = await fetch(`${API}/ciudad-info/${s.id_ciudad}`).then(r => r.json());
  idPaisActual = infoCiudad.id_pais;
  el.selPais.value = idPaisActual;
  await cargarCiudades(idPaisActual, s.id_ciudad);

  // Horas y alojamiento
  horas = (s.horas || []);     // ya viene como ["10:00","11:00",...]
  pintarChips();

  if (s.alojamiento) {
    el.aloNoches.value = s.alojamiento.noches;
    el.aloHabs.value   = s.alojamiento.habitaciones;
    el.aloDes.value    = s.alojamiento.desayuno ? '1' : '0';
    el.aloCatH.value   = s.alojamiento.categoria_hotel || '';
    el.aloCatB.value   = s.alojamiento.categoria_hab || '';
    el.aloProv.value   = s.alojamiento.proveedor_hotel || 'AEI';
  }

  // Mostrar/ocultar bloque alojamiento según tipo
  el.boxAloja.open = isAlojamiento();
  el.boxAloja.style.display = isAlojamiento() ? 'block' : 'none';
}

// Eventos dependientes país → ciudades y tipo → mostrar alojamiento
el.selPais.addEventListener('change', async () => {
  idPaisActual = Number(el.selPais.value);
  await cargarCiudades(idPaisActual, null);
});
el.id_tipo.addEventListener('change', () => {
  el.boxAloja.open = isAlojamiento();
  el.boxAloja.style.display = isAlojamiento() ? 'block' : 'none';
});

// Añadir una hora (cliente)
el.btnAddHora.addEventListener('click', () => {
  const h = toTime(el.inpHora.value);
  if (!h) { alert('Hora inválida. Usa HH:MM'); return; }
  if (!horas.includes(h)) horas.push(h);
  el.inpHora.value = '';
  pintarChips();
});

// Reemplazar horas en servidor
el.btnReemplazarHoras.addEventListener('click', async () => {
  const resp = await fetch(`${API}/servicios/${id}/horas`, {
    method: 'PUT',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ horas })
  });
  if (resp.ok) alert('Horarios guardados');
  else {
    const err = await resp.json().catch(()=>({error:'Error'}));
    alert('No se guardaron horarios: ' + (err.error || resp.status));
  }
});

// Guardar bloque alojamiento (upsert por id_servicio)
el.btnGuardarAloja.addEventListener('click', async () => {
  if (!isAlojamiento()) { alert('El tipo actual no es Alojamiento'); return; }
  const payload = {
    noches: Number(el.aloNoches.value),
    habitaciones: Number(el.aloHabs.value),
    desayuno: Number(el.aloDes.value),
    categoria_hotel: el.aloCatH.value || null,
    categoria_hab:   el.aloCatB.value || null,
    proveedor_hotel: (el.aloProv.value || 'AEI').slice(0,5)
  };
  const resp = await fetch(`${API}/alojamiento/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(payload)
  });
  if (resp.ok) alert('Alojamiento guardado');
  else {
    const err = await resp.json().catch(()=>({error:'Error'}));
    alert('No se guardó alojamiento: ' + (err.error || resp.status));
  }
});

// Guardar servicio (datos básicos)
el.frm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    id_tipo: Number(el.id_tipo.value),
    id_proveedor: Number(el.id_proveedor.value),
    id_ciudad: Number(el.selCiudad.value),
    nombre_wtravel: el.nombre.value.trim(),
    tiempo_servicio: el.tiempo.value.trim() || null,
    privado: Number(el.privado.value),
    descripcion: el.desc.value.trim() || null
  };
  const resp = await fetch(`${API}/servicio/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(payload)
  });
  if (resp.ok) {
    alert('Cambios guardados');
    location.href = 'servicios-gestionar.html';
  } else {
    const err = await resp.json().catch(()=>({error:'Error'}));
    alert('No se guardó: ' + (err.error || resp.status));
  }
});

el.btnCancel.addEventListener('click', () => history.back());

// Init
(async function init(){
  await cargarCatalogos();
  await cargarDetalle();
})();
