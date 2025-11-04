const BASE = 'http://localhost:3000';

const API = {
  async req(p, opts = {}) {
    const r = await fetch(`${BASE}${p}`, { headers:{'Content-Type':'application/json'}, ...opts });
    let data = null; try { data = await r.json(); } catch {}
    if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
    return data;
  },
  get(p){ return this.req(p); },
  post(p,d){ return this.req(p,{method:'POST', body:JSON.stringify(d)}); }
};

// refs
const el = {
  frmServicio: document.getElementById('frm-servicio'),
  id_tipo: document.getElementById('id_tipo'),
  id_proveedor: document.getElementById('id_proveedor'),
  id_continente: document.getElementById('id_continente'),
  id_pais: document.getElementById('id_pais'),
  id_ciudad: document.getElementById('id_ciudad'),
  nombre_wtravel: document.getElementById('nombre_wtravel'),
  tiempo_servicio: document.getElementById('tiempo_servicio'),
  privado: document.getElementById('privado'),
  descripcion: document.getElementById('descripcion'),

  boxHoras: document.getElementById('box-horas'),
  horaInput: document.getElementById('hora-input'),
  btnAddHora: document.getElementById('btn-add-hora'),
  listaHoras: document.getElementById('lista-horas'),
  btnGuardarHoras: document.getElementById('btn-guardar-horas'),

  frmAloja: document.getElementById('frm-aloja'),
  al_noches: document.getElementById('al_noches'),
  al_habs: document.getElementById('al_habs'),
  al_desayuno: document.getElementById('al_desayuno'),
  al_cat_hotel: document.getElementById('al_cat_hotel'),
  al_cat_hab: document.getElementById('al_cat_hab'),
  al_prov_hotel: document.getElementById('al_prov_hotel'),
};

let servicioId = null;
let horas = [];

// ---------- catálogos ----------
async function cargarCatalogos() {
  const [tipos, provs, conts] = await Promise.all([
    API.get('/api/tipos-servicio'),
    API.get('/api/proveedores'),
    API.get('/api/continentes')
  ]);

  el.id_tipo.innerHTML = tipos.map(t=>`<option value="${t.id}">${t.nombre}</option>`).join('');
  el.id_proveedor.innerHTML = provs.map(p=>`<option value="${p.id}">${p.nombre}</option>`).join('');
  el.id_continente.innerHTML = ['<option value="">(opcional)</option>']
    .concat(conts.map(c=>`<option value="${c.id}">${c.nombre}</option>`)).join('');
}

el.id_continente.addEventListener('change', async () => {
  el.id_pais.innerHTML = '';
  el.id_ciudad.innerHTML = '';
  el.id_pais.disabled = true;
  el.id_ciudad.disabled = true;

  const idc = el.id_continente.value;
  if (!idc) return;

  const paises = await API.get(`/api/paises/${idc}`);
  el.id_pais.innerHTML = paises.map(p=>`<option value="${p.id}">${p.nombre}</option>`).join('');
  el.id_pais.disabled = false;

  // trigger ciudades para primer país
  el.id_pais.dispatchEvent(new Event('change'));
});

el.id_pais.addEventListener('change', async () => {
  el.id_ciudad.innerHTML = '';
  el.id_ciudad.disabled = true;

  const idp = el.id_pais.value;
  if (!idp) return;

  const ciudades = await API.get(`/api/ciudades/${idp}`);
  el.id_ciudad.innerHTML = ciudades.map(c=>`<option value="${c.id}">${c.nombre}</option>`).join('');
  el.id_ciudad.disabled = false;
});

// ---------- crear servicio ----------
el.frmServicio.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const payload = {
      id_tipo: Number(el.id_tipo.value),
      id_proveedor: Number(el.id_proveedor.value),
      id_ciudad: Number(el.id_ciudad.value),            // obligatorio
      nombre_wtravel: el.nombre_wtravel.value.trim(),
      tiempo_servicio: el.tiempo_servicio.value.trim() || null,
      privado: Number(el.privado.value),
      descripcion: el.descripcion.value.trim() || null
    };
    const out = await API.post('/api/servicio', payload);
    servicioId = out.id; // id recién creado

    alert('Servicio creado (ID ' + servicioId + ')');

    // mostrar bloque horarios
    el.boxHoras.classList.remove('hidden');

    // si es alojamiento, mostrar ficha alojamiento
    const nombreTipo = el.id_tipo.options[el.id_tipo.selectedIndex].textContent;
    if (nombreTipo.toUpperCase() === 'ALOJAMIENTO') {
      el.frmAloja.classList.remove('hidden');
    }
  } catch (err) {
    alert('No se pudo crear: ' + err.message);
  }
});

// ---------- horarios ----------
function renderHoras() {
  el.listaHoras.innerHTML = horas.map((h,i) =>
    `<li>${h} <button data-del="${i}">✕</button></li>`
  ).join('');
}
el.btnAddHora.addEventListener('click', () => {
  const v = (el.horaInput.value || '').trim();
  if (!/^\d{2}:\d{2}$/.test(v)) return alert('Formato HH:MM');
  if (!horas.includes(v)) horas.push(v);
  el.horaInput.value = '';
  renderHoras();
});
el.listaHoras.addEventListener('click', (e) => {
  const idx = e.target.dataset.del;
  if (typeof idx !== 'undefined') {
    horas.splice(Number(idx), 1);
    renderHoras();
  }
});
el.btnGuardarHoras.addEventListener('click', async () => {
  if (!servicioId) return alert('Primero crea el servicio');
  if (horas.length === 0) return alert('Añade al menos una hora o sáltate este paso');
  try {
    await API.post(`/api/servicios/${servicioId}/horas`, { horas });
    alert('Horarios guardados');
  } catch (err) {
    alert('No se guardaron horarios: ' + err.message);
  }
});

// ---------- alojamiento ----------
el.frmAloja.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!servicioId) return alert('Primero crea el servicio');

  const payload = {
    id_servicio: servicioId,
    noches: Number(el.al_noches.value),
    habitaciones: Number(el.al_habs.value),
    desayuno: Number(el.al_desayuno.value),
    categoria_hotel: el.al_cat_hotel.value.trim() || null,
    categoria_hab: el.al_cat_hab.value.trim() || null,
    proveedor_hotel: el.al_prov_hotel.value.trim() || 'AEI'
  };

  try {
    await API.post('/api/alojamiento', payload);
    alert('Alojamiento guardado');
  } catch (err) {
    alert('No se pudo guardar alojamiento: ' + err.message);
  }
});

// init
(async function init(){
  await cargarCatalogos();
})();