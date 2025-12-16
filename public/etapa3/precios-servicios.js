// public/etapa3/precios-servicios.js
document.addEventListener("DOMContentLoaded", () => {
  const filtroContinente = document.getElementById("filtro-continente");
  const filtroPais = document.getElementById("filtro-pais");
  const filtroCiudad = document.getElementById("filtro-ciudad");
  const filtroTipo = document.getElementById("filtro-tipo");

  const selServicio = document.getElementById("sel-servicio");
  const inpAnio = document.getElementById("inp-anio");
  const selTipoHab = document.getElementById("sel-tipo-hab");
  const btnCargar = document.getElementById("btn-cargar");
  const btnGuardar = document.getElementById("btn-guardar");
  const tbody = document.getElementById("tbody-precios");
  const msg = document.getElementById("msg");

  const btnEditar = document.getElementById("btn-editar");
  const btnCancelarEdicion = document.getElementById("btn-cancelar-edicion");
  const btnGuardarEdicion = document.getElementById("btn-guardar-edicion");
  const srvDetalle = document.getElementById("srv-detalle");
  const srvEditar = document.getElementById("srv-editar");

  const edNombre = document.getElementById("ed-nombre");
  const edProveedor = document.getElementById("ed-proveedor");
  const edTiempo = document.getElementById("ed-tiempo");
  const edPrivado = document.getElementById("ed-privado");
  const edLink = document.getElementById("ed-link");
  const edDesc = document.getElementById("ed-desc");
  const edReadonly = document.getElementById("ed-readonly");

  const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  let allServicios = [];
  let serviciosFiltrados = [];
  let detalleActual = null;
  let proveedoresCache = [];

  function show(el, v) { if (!el) return; el.classList.toggle("hide", !v); }
  function setMsg(text, isError = false) {
    msg.textContent = text || "";
    msg.style.color = isError ? "crimson" : "inherit";
  }

  async function fetchLista(url, posiblesKeys = []) {
    const resp = await fetch(url);
    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error(`Respuesta no-JSON desde ${url}: ${text.slice(0, 180)}`); }

    if (Array.isArray(data)) return data;
    for (const k of posiblesKeys) if (Array.isArray(data?.[k])) return data[k];
    throw new Error(`Formato inesperado desde ${url}`);
  }

  function addOptions(selectEl, opciones, { firstText = "(Seleccionar)", firstValue = "" } = {}) {
    if (!selectEl) return;
    selectEl.innerHTML = "";
    if (firstText !== null) selectEl.appendChild(new Option(firstText, firstValue));
    opciones.forEach(o => selectEl.appendChild(new Option(o.text, o.value)));
  }

  function renderTabla(precios12) {
    tbody.innerHTML = "";
    for (let m = 1; m <= 12; m++) {
      const row = (precios12 || []).find(x => Number(x.mes) === m);
      const tr = document.createElement("tr");

      const tdMes = document.createElement("td");
      tdMes.textContent = `${m}. ${MESES[m - 1]}`;

      const tdPrecio = document.createElement("td");
      const input = document.createElement("input");
      input.type = "number";
      input.step = "0.01";
      input.min = "0";
      input.dataset.mes = String(m);
      input.value = (row?.precio_usd === null || row?.precio_usd === undefined) ? "" : String(row.precio_usd);
      tdPrecio.appendChild(input);

      tr.appendChild(tdMes);
      tr.appendChild(tdPrecio);
      tbody.appendChild(tr);
    }
  }

  // =========================
  // Cargar filtros ubicación
  // =========================
  async function cargarContinentes() {
    const lista = await fetchLista("/api/continentes", ["continentes"]);
    addOptions(filtroContinente, lista.map(x => ({ value: String(x.id), text: x.nombre })), {
      firstText: "(Todos los continentes)", firstValue: ""
    });
  }

  async function cargarPaises(idContinente) {
    if (!idContinente) {
      addOptions(filtroPais, [], { firstText: "(Todos los países)", firstValue: "" });
      addOptions(filtroCiudad, [], { firstText: "(Todas las ciudades)", firstValue: "" });
      return;
    }
    const lista = await fetchLista(`/api/paises/${idContinente}`, ["paises"]);
    addOptions(filtroPais, lista.map(x => ({ value: String(x.id), text: x.nombre })), {
      firstText: "(Todos los países)", firstValue: ""
    });
    addOptions(filtroCiudad, [], { firstText: "(Todas las ciudades)", firstValue: "" });
  }

  async function cargarCiudades(idPais) {
    if (!idPais) {
      addOptions(filtroCiudad, [], { firstText: "(Todas las ciudades)", firstValue: "" });
      return;
    }
    const lista = await fetchLista(`/api/ciudades/${idPais}`, ["ciudades"]);
    addOptions(filtroCiudad, lista.map(x => ({ value: String(x.id), text: x.nombre })), {
      firstText: "(Todas las ciudades)", firstValue: ""
    });
  }

  async function cargarTiposServicio() {
    const lista = await fetchLista("/api/tiposervicio", ["tipos", "tipos_servicio", "tiposervicio"]);
    // En esta pantalla no queremos ALOJAMIENTO
    const filtrados = lista.filter(t => !String(t.nombre || "").toLowerCase().includes("aloj"));
    addOptions(filtroTipo, filtrados.map(t => ({ value: String(t.id), text: t.nombre })), {
      firstText: "(Todos los tipos)", firstValue: ""
    });
  }

  // =========================
  // Servicios + filtrado
  // =========================
  async function cargarServicios() {
    const lista = await fetchLista("/api/servicios", ["servicios"]);
    // sacar alojamiento de esta pantalla
    allServicios = lista.filter(s => !String(s.tipo || "").toLowerCase().includes("aloj"));
    filtrarServicios();
  }

  function filtrarServicios() {
    const idCont = filtroContinente.value || null;
    const idPais = filtroPais.value || null;
    const idCiud = filtroCiudad.value || null;
    const idTipo = filtroTipo.value || null;

    serviciosFiltrados = allServicios.filter(s => {
      if (idCont && String(s.id_continente ?? "") !== String(idCont)) return false;
      if (idPais && String(s.id_pais ?? "") !== String(idPais)) return false;
      if (idCiud && String(s.id_ciudad ?? "") !== String(idCiud)) return false;
      if (idTipo && String(s.id_tipo ?? "") !== String(idTipo)) return false;
      return true;
    });

    // orden más legible
    serviciosFiltrados.sort((a, b) => {
      const aa = (a.servicio_texto || a.nombre_wtravel || "").toLowerCase();
      const bb = (b.servicio_texto || b.nombre_wtravel || "").toLowerCase();
      return aa.localeCompare(bb);
    });

    selServicio.innerHTML = "";
    selServicio.appendChild(new Option("(Seleccionar servicio)", ""));

    serviciosFiltrados.forEach(s => {
    const ciudad = (s.ciudad || "").trim();
    const txtBase = s.servicio_texto || s.nombre_wtravel || `Servicio #${s.id}`;
    const txt = ciudad ? `[${ciudad}] ${txtBase}` : txtBase;
    selServicio.appendChild(new Option(txt, String(s.id)));
    });


    // reset detalle
    detalleActual = null;
    renderDetalle(null);
    show(btnEditar, false);
    show(btnCancelarEdicion, false);
    show(btnGuardarEdicion, false);
    show(srvEditar, false);
  }

  // =========================
  // Detalle + edición servicio
  // =========================
  function renderDetalle(det) {
    srvDetalle.innerHTML = "";
    if (!det) {
      srvDetalle.innerHTML = `<div class="muted">Selecciona un servicio para ver detalles.</div>`;
      return;
    }

    const kv = [
      ["Tipo", det.tipo || ""],
      ["Ciudad", det.ciudad || ""],
      ["Proveedor", det.proveedor || ""],
      ["Tiempo", det.tiempo_servicio || ""],
      ["Privado", det.privado ? "Sí" : "No"],
      ["Link", det.link_reserva ? det.link_reserva : "(sin link)"],
      ["Descripción", det.descripcion || "(sin descripción)"],
    ];

    kv.forEach(([k, v]) => {
      const a = document.createElement("div");
      a.className = "muted";
      a.textContent = k;
      const b = document.createElement("div");
      if (k === "Link" && det.link_reserva) {
        const link = document.createElement("a");
        link.href = det.link_reserva;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = det.link_reserva;
        b.appendChild(link);
      } else {
        b.textContent = v;
      }
      srvDetalle.appendChild(a);
      srvDetalle.appendChild(b);
    });
  }

  async function cargarProveedores() {
    proveedoresCache = await fetchLista("/api/proveedores", ["proveedores"]);
    edProveedor.innerHTML = "";
    proveedoresCache.forEach(p => {
      edProveedor.appendChild(new Option(`${p.nombre} (${p.iniciales || ""})`, String(p.id)));
    });
  }

  async function cargarDetalleServicio(idServicio) {
    if (!idServicio) return;

    const resp = await fetch(`/api/servicios/${idServicio}`);
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok) {
      setMsg(data.mensaje || data.error || "No se pudo cargar detalle del servicio", true);
      return;
    }

    // tu endpoint devuelve { ok:true, servicio:{...} }
    detalleActual = data.servicio;
    renderDetalle(detalleActual);

    show(btnEditar, true);
    show(btnCancelarEdicion, false);
    show(btnGuardarEdicion, false);
    show(srvEditar, false);
  }

  function abrirEdicion() {
    if (!detalleActual) return;

    edNombre.value = detalleActual.nombre_wtravel || "";
    edTiempo.value = detalleActual.tiempo_servicio || "";
    edPrivado.value = detalleActual.privado ? "1" : "0";
    edLink.value = detalleActual.link_reserva || "";
    edDesc.value = detalleActual.descripcion || "";

    // proveedor select
    if (detalleActual.id_proveedor != null) {
      edProveedor.value = String(detalleActual.id_proveedor);
    }

    edReadonly.textContent =
      `Nota: Tipo y Ciudad se mantienen. (Tipo: ${detalleActual.tipo || ""} | Ciudad: ${detalleActual.ciudad || ""})`;

    show(srvEditar, true);
    show(btnEditar, false);
    show(btnCancelarEdicion, true);
    show(btnGuardarEdicion, true);
  }

  function cerrarEdicion() {
    show(srvEditar, false);
    show(btnEditar, !!detalleActual);
    show(btnCancelarEdicion, false);
    show(btnGuardarEdicion, false);
  }

  async function guardarEdicion() {
    if (!detalleActual) return;

    const id = detalleActual.id;
    const payload = {
      // REQUIRED por tu PUT /api/servicio/:id
      id_tipo: detalleActual.id_tipo,
      id_proveedor: Number(edProveedor.value),
      id_ciudad: detalleActual.id_ciudad,
      nombre_wtravel: (edNombre.value || "").trim(),
      tiempo_servicio: (edTiempo.value || "").trim() || null,
      privado: edPrivado.value === "1",
      descripcion: (edDesc.value || "").trim() || null,
      link_reserva: (edLink.value || "").trim() || null
    };

    if (!payload.nombre_wtravel) return setMsg("Falta el nombre WTravel.", true);

    const resp = await fetch(`/api/servicio/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok) {
      return setMsg(data.mensaje || data.error || "Error guardando cambios", true);
    }

    setMsg("Servicio actualizado ✅");
    cerrarEdicion();

    // recargar detalle y lista para que el texto del select quede actualizado
    await cargarServicios();
    selServicio.value = String(id);
    await cargarDetalleServicio(id);
  }

  // =========================
  // Precios
  // =========================
  async function cargarPrecios() {
    setMsg("");
    const id = selServicio.value;
    const anio = inpAnio.value;
    const tipoHab = selTipoHab.value;

    if (!id) return setMsg("Selecciona un servicio.", true);
    if (!anio) return setMsg("Selecciona un año.", true);

    const resp = await fetch(`/api/servicios/${id}/precios?anio=${encodeURIComponent(anio)}&tipo_habitacion=${encodeURIComponent(tipoHab)}`);
    const data = await resp.json().catch(() => ({}));

    if (!resp.ok || !data.ok) return setMsg(data.mensaje || data.error || "Error cargando precios", true);

    renderTabla(data.precios || []);
    setMsg("Precios cargados.");
  }

  async function guardarPrecios() {
    setMsg("");
    const id = selServicio.value;
    const anio = inpAnio.value;
    const tipoHab = selTipoHab.value;

    if (!id) return setMsg("Selecciona un servicio.", true);
    if (!anio) return setMsg("Selecciona un año.", true);

    const inputs = tbody.querySelectorAll("input[type='number']");
    const precios = Array.from(inputs).map(inp => {
      const mes = Number(inp.dataset.mes);
      const raw = String(inp.value || "").trim();
      return { mes, precio_usd: raw === "" ? null : Number(raw) };
    });

    const resp = await fetch(`/api/servicios/${id}/precios?anio=${encodeURIComponent(anio)}&tipo_habitacion=${encodeURIComponent(tipoHab)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ precios })
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok) return setMsg(data.mensaje || data.error || "Error guardando precios", true);

    setMsg("Guardado listo ✅");
  }

  // =========================
  // Eventos
  // =========================
  filtroContinente.addEventListener("change", async () => {
    await cargarPaises(filtroContinente.value || null);
    filtrarServicios();
  });

  filtroPais.addEventListener("change", async () => {
    await cargarCiudades(filtroPais.value || null);
    filtrarServicios();
  });

  filtroCiudad.addEventListener("change", filtrarServicios);
  filtroTipo.addEventListener("change", filtrarServicios);

  selServicio.addEventListener("change", async () => {
    const id = selServicio.value;
    if (!id) {
      detalleActual = null;
      renderDetalle(null);
      cerrarEdicion();
      show(btnEditar, false);
      return;
    }
    await cargarDetalleServicio(id);
  });

  btnCargar.addEventListener("click", cargarPrecios);
  btnGuardar.addEventListener("click", guardarPrecios);

  btnEditar.addEventListener("click", abrirEdicion);
  btnCancelarEdicion.addEventListener("click", () => { setMsg(""); cerrarEdicion(); });
  btnGuardarEdicion.addEventListener("click", guardarEdicion);

  // =========================
  // Init
  // =========================
  inpAnio.value = String(new Date().getFullYear());
  renderTabla([]);

  (async () => {
    try {
      await cargarContinentes();
      await cargarTiposServicio();
      await cargarServicios();
      await cargarProveedores();

      // defaults para selects vacíos
      addOptions(filtroPais, [], { firstText: "(Todos los países)", firstValue: "" });
      addOptions(filtroCiudad, [], { firstText: "(Todas las ciudades)", firstValue: "" });

      setMsg("");
    } catch (e) {
      console.error(e);
      setMsg(e.message, true);
    }
  })();
});
