// public/etapa3/cotizacion-editar.js

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const idCotizacion = params.get("id");
  const headerIdEl = document.getElementById("header-id");
  if (headerIdEl) headerIdEl.textContent = idCotizacion ? `#${idCotizacion}` : "(sin id)";

  const filtroContinente = document.getElementById("filtro-continente");
  const filtroPais = document.getElementById("filtro-pais");
  const filtroCiudad = document.getElementById("filtro-ciudad");
  const filtroTipoServicio = document.getElementById("filtro-tipo-servicio");

  const wrapperFechaHasta = document.getElementById("wrapper-fecha-hasta");
  const fechaDesdeInput = document.getElementById("fecha-desde");
  const fechaHastaInput = document.getElementById("fecha-hasta");

  const selectServicio = document.getElementById("select-servicio");
  const chkOpcional = document.getElementById("chk-opcional");

  const tablaBody = document.getElementById("tabla-servicios-body");
  const totalUsdInput = document.getElementById("total-usd");

  const btnInsertarServicio = document.getElementById("btn-insertar-servicio");
  const btnCrearServicio = document.getElementById("btn-crear-servicio");
  const mensajeErrorEl = document.getElementById("mensaje-error");

  const btnToggleCrear = document.getElementById("btn-toggle-crear-servicio");
  const panelCrear = document.getElementById("panel-crear-servicio");
  const selProveedorNuevo = document.getElementById("nuevo-id-proveedor");
  const inpLinkReserva = document.getElementById("nuevo-link-reserva");
  const inpNombreW = document.getElementById("nuevo-nombre-wtravel");
  const inpTiempo = document.getElementById("nuevo-tiempo-servicio");
  const selPrivado = document.getElementById("nuevo-privado");
  const inpDesc = document.getElementById("nuevo-descripcion");
  const contDinamico = document.getElementById("nuevo-campos-dinamicos");
  const btnGuardarSrv = document.getElementById("btn-guardar-servicio-rapido");
  const btnCancelarSrv = document.getElementById("btn-cancelar-servicio-rapido");
  const msgCrearSrv = document.getElementById("msg-crear-servicio");

  let items = [];
  let allServicios = [];
  let servicios = [];
  let nextIdLocal = 1;

  function mostrarError(msg) {
    if (mensajeErrorEl) mensajeErrorEl.textContent = msg || "";
  }
  function msgCrear(texto) {
    if (msgCrearSrv) msgCrearSrv.textContent = texto || "";
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

  // ====== Catálogos ======
  const catalogCache = {};
  async function cargarCatalogo(grupo) {
    if (catalogCache[grupo]) return catalogCache[grupo];
    const lista = await fetchLista(`/api/catalogos/${encodeURIComponent(grupo)}`, ["opciones", "valores", "items"]);
    const norm = lista.map(x => (typeof x === "string" ? { valor: x } : x)).filter(x => x?.valor);
    catalogCache[grupo] = norm;
    return norm;
  }

  function addOptions(selectEl, opciones, { firstText = "(Seleccionar)", firstValue = "" } = {}) {
    if (!selectEl) return;
    selectEl.innerHTML = "";
    if (firstText !== null) selectEl.appendChild(new Option(firstText, firstValue));
    opciones.forEach(o => selectEl.appendChild(new Option(o.text, o.value)));
  }

  function show(el, visible) {
    if (!el) return;
    el.style.display = visible ? "" : "none";
  }

  async function fillSelectFromCatalog(selectEl, grupo, { firstText = "(Seleccionar)", firstValue = "" } = {}) {
    if (!selectEl) return;
    try {
      const cat = await cargarCatalogo(grupo);
      addOptions(selectEl, cat.map(x => ({ value: x.valor, text: x.valor })), { firstText, firstValue });
    } catch {
      addOptions(selectEl, [], { firstText: "(Sin catálogo)", firstValue: "" });
    }
  }

  // “OTRO” con catálogo + escribir
  async function initOtroCatalogo({ grupoCatalogo, selectCatalogoEl, inputTextoEl }) {
    if (!selectCatalogoEl) return;

    try {
      const cat = await cargarCatalogo(grupoCatalogo);
      const opts = [
        { value: "", text: "(Elegir de catálogo)" },
        ...cat.map(x => ({ value: x.valor, text: x.valor })),
        { value: "__write__", text: "Escribir nuevo..." }
      ];
      addOptions(selectCatalogoEl, opts, { firstText: "(Elegir de catálogo)", firstValue: "" });
    } catch {
      addOptions(selectCatalogoEl, [
        { value: "", text: "(Elegir de catálogo)" },
        { value: "__write__", text: "Escribir nuevo..." }
      ]);
    }

    function syncWrite() {
      const wantsWrite = selectCatalogoEl.value === "__write__";
      show(inputTextoEl, wantsWrite);
      if (!wantsWrite && inputTextoEl) inputTextoEl.value = "";
    }

    selectCatalogoEl.addEventListener("change", syncWrite);
    syncWrite();
  }

  function leerValorOtro({ selectCatalogoEl, inputTextoEl }) {
    if (!selectCatalogoEl) return null;
    const v = selectCatalogoEl.value || "";
    if (!v) return null;
    if (v !== "__write__") return v;
    const txt = (inputTextoEl?.value || "").trim();
    return txt || null;
  }

  function recalcularTotal() {
    let total = 0;
    items.forEach((it) => {
      const p = Number(it.precio);
      if (!Number.isNaN(p) && p > 0) total += p;
    });
    if (totalUsdInput) totalUsdInput.value = total.toFixed(2);
  }

  // ====== Fechas ======
  const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const DIAS_SEMANA = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];

  function parseYMD(ymd) {
    const [y, m, d] = ymd.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  function sumarDiasYmd(ymd, dias) {
    const d = parseYMD(ymd);
    d.setDate(d.getDate() + dias);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  function formatoRangoAlojamiento(desdeYmd, hastaYmd) {
    const d1 = parseYMD(desdeYmd);
    const d2 = parseYMD(hastaYmd);
    const dia1 = String(d1.getDate()).padStart(2, "0");
    const dia2 = String(d2.getDate()).padStart(2, "0");
    const mes1 = MESES[d1.getMonth()];
    const mes2 = MESES[d2.getMonth()];
    const anio1 = d1.getFullYear();
    const anio2 = d2.getFullYear();

    if (anio1 === anio2 && mes1 === mes2) return `${dia1} – ${dia2} de ${mes1} de ${anio1}`;
    if (anio1 === anio2) return `${dia1} de ${mes1} a ${dia2} de ${mes2} de ${anio1}`;
    return `${dia1} de ${mes1} de ${anio1} a ${dia2} de ${mes2} de ${anio2}`;
  }
  function formatoFechaServicio(fechaYmd) {
    const d = parseYMD(fechaYmd);
    const diaSemana = DIAS_SEMANA[d.getDay()];
    const dia = String(d.getDate()).padStart(2, "0");
    const mes = MESES[d.getMonth()];
    const anio = d.getFullYear();
    const diaCap = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
    return `${diaCap}, ${dia} de ${mes} de ${anio}`;
  }

  function esTipoAlojamientoTexto(tipoNombre) {
    return (tipoNombre || "").toLowerCase().includes("aloj");
  }
  function esTipoSinPrecio(tipoNombre) {
    const t = (tipoNombre || "").toLowerCase();
    return t.includes("vuelo") || t.includes("tren");
  }

  function mapRowToItem(row) {
    const tipo = row.tipo_servicio || "";
    const esAlojamiento = esTipoAlojamientoTexto(tipo);

    const fechaYmd = String(row.fecha_servicio).substring(0, 10);
    let fechaTexto;

    if (esAlojamiento && row.noches_alojamiento && row.noches_alojamiento > 0) {
      const desde = fechaYmd;
      const hasta = sumarDiasYmd(desde, row.noches_alojamiento - 1);
      fechaTexto = formatoRangoAlojamiento(desde, hasta);
    } else {
      fechaTexto = formatoFechaServicio(fechaYmd);
    }

    const servicioTexto = row.servicio_texto || row.nombre_servicio || "";
    let precio = row.precio_usd;
    if (esTipoSinPrecio(tipo)) precio = null;

    return {
      idLocal: nextIdLocal++,
      id_item: row.id_item,
      id_servicio: row.id_servicio,
      ciudad: row.ciudad,
      tipo_servicio: row.tipo_servicio,
      esAlojamiento,
      fecha: fechaTexto,
      servicioTexto,
      precio
    };
  }

  async function guardarOrdenEnBackend() {
    if (!idCotizacion) return;
    try {
      const payload = {
        orden: items.map((it, index) => ({ id_item: it.id_item, orden_dia: index + 1 }))
      };

      const resp = await fetch(`/api/cotizaciones/${idCotizacion}/items/orden`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok) console.warn("No se pudo guardar el orden:", data.mensaje || data.error || "Error");
    } catch (err) {
      console.error("Error guardando orden:", err);
    }
  }

  function actualizarTablaDesdeEstado() {
    if (!tablaBody) return;
    tablaBody.innerHTML = "";

    let ultimaCiudadCabecera = null;

    items.forEach((it, idx) => {
      if (it.esAlojamiento && it.ciudad && it.ciudad !== ultimaCiudadCabecera) {
        const trCiudad = document.createElement("tr");
        trCiudad.classList.add("fila-ciudad");
        const tdCiudad = document.createElement("td");
        tdCiudad.colSpan = 6;
        tdCiudad.textContent = it.ciudad.toUpperCase();
        trCiudad.appendChild(tdCiudad);
        tablaBody.appendChild(trCiudad);
        ultimaCiudadCabecera = it.ciudad;
      }

      const row = document.createElement("tr");
      row.dataset.idLocal = it.idLocal;

      const colOrden = document.createElement("td");
      const btnUp = document.createElement("button");
      btnUp.type = "button";
      btnUp.textContent = "↑";
      btnUp.classList.add("btn-small");
      btnUp.addEventListener("click", () => moverItem(idx, -1));

      const btnDown = document.createElement("button");
      btnDown.type = "button";
      btnDown.textContent = "↓";
      btnDown.classList.add("btn-small");
      btnDown.addEventListener("click", () => moverItem(idx, +1));

      colOrden.appendChild(btnUp);
      colOrden.appendChild(document.createTextNode(" "));
      colOrden.appendChild(btnDown);

      const colIndice = document.createElement("td");
      colIndice.classList.add("celda-indice");
      colIndice.textContent = idx + 1;

      const colFecha = document.createElement("td");
      colFecha.textContent = it.fecha || "";

      const colServicio = document.createElement("td");
      colServicio.textContent = it.servicioTexto || "";

      const colPrecio = document.createElement("td");
      if (it.precio != null && it.precio !== "") {
        const num = Number(it.precio);
        colPrecio.textContent = Number.isNaN(num) ? String(it.precio) : num.toFixed(2);
      } else {
        colPrecio.textContent = "-";
      }

      const colEliminar = document.createElement("td");
      const btnEliminar = document.createElement("button");
      btnEliminar.type = "button";
      btnEliminar.textContent = "✕";
      btnEliminar.classList.add("btn-small");
      btnEliminar.addEventListener("click", () => eliminarItem(it, idx));
      colEliminar.appendChild(btnEliminar);

      row.appendChild(colOrden);
      row.appendChild(colIndice);
      row.appendChild(colFecha);
      row.appendChild(colServicio);
      row.appendChild(colPrecio);
      row.appendChild(colEliminar);

      tablaBody.appendChild(row);
    });

    recalcularTotal();
  }

  async function moverItem(idx, delta) {
    const newIndex = idx + delta;
    if (newIndex < 0 || newIndex >= items.length) return;
    const tmp = items[idx];
    items[idx] = items[newIndex];
    items[newIndex] = tmp;
    actualizarTablaDesdeEstado();
    await guardarOrdenEnBackend();
  }

  async function eliminarItem(it, index) {
    const seguro = window.confirm("¿Eliminar este servicio de la cotización?");
    if (!seguro) return;

    try {
      const resp = await fetch(`/api/cotizaciones/items/${it.id_item}`, { method: "DELETE" });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok) throw new Error(data.mensaje || data.error || "Error al eliminar el item.");
      items.splice(index, 1);
      actualizarTablaDesdeEstado();
    } catch (err) {
      console.error(err);
      mostrarError("No se pudo eliminar el servicio: " + err.message);
    }
  }

  // ===== Ubicaciones =====
  async function cargarContinentes() {
    try {
      const lista = await fetchLista("/api/continentes", ["continentes"]);
      filtroContinente.innerHTML = "";
      filtroContinente.appendChild(new Option("(Todos los continentes)", ""));
      lista.forEach((c) => filtroContinente.appendChild(new Option(c.nombre, c.id)));
    } catch (err) {
      console.error("Error cargando continentes", err);
      mostrarError("No se pudieron cargar los continentes: " + err.message);
    }
  }

  async function cargarPaises(idContinente) {
    try {
      if (!idContinente) {
        filtroPais.innerHTML = "<option value=''> (Todos los países) </option>";
        filtroCiudad.innerHTML = "<option value=''> (Todas las ciudades) </option>";
        return;
      }
      const lista = await fetchLista(`/api/paises/${idContinente}`, ["paises"]);
      filtroPais.innerHTML = "";
      filtroPais.appendChild(new Option("(Todos los países)", ""));
      lista.forEach((p) => filtroPais.appendChild(new Option(p.nombre, p.id)));
      filtroCiudad.innerHTML = "<option value=''> (Todas las ciudades) </option>";
    } catch (err) {
      console.error("Error cargando países", err);
      mostrarError("No se pudieron cargar los países: " + err.message);
    }
  }

  async function cargarCiudades(idPais) {
    try {
      if (!idPais) {
        filtroCiudad.innerHTML = "<option value=''> (Todas las ciudades) </option>";
        return;
      }
      const lista = await fetchLista(`/api/ciudades/${idPais}`, ["ciudades"]);
      filtroCiudad.innerHTML = "";
      filtroCiudad.appendChild(new Option("(Todas las ciudades)", ""));
      lista.forEach((c) => filtroCiudad.appendChild(new Option(c.nombre, c.id)));
    } catch (err) {
      console.error("Error cargando ciudades", err);
      mostrarError("No se pudieron cargar las ciudades: " + err.message);
    }
  }

  filtroContinente?.addEventListener("change", async () => {
    const idCont = filtroContinente.value || null;
    await cargarPaises(idCont);
    filtrarServicios();
  });

  filtroPais?.addEventListener("change", async () => {
    const idPais = filtroPais.value || null;
    await cargarCiudades(idPais);
    filtrarServicios();
  });

  filtroCiudad?.addEventListener("change", () => filtrarServicios());

  // ===== Tipos =====
  async function cargarTiposServicio() {
    try {
      const lista = await fetchLista("/api/tiposervicio", ["tipos", "tipos_servicio", "tiposervicio"]);
      filtroTipoServicio.innerHTML = "";
      filtroTipoServicio.appendChild(new Option("(Todos los tipos)", ""));
      lista.forEach((t) => filtroTipoServicio.appendChild(new Option(t.nombre, t.id)));
    } catch (err) {
      console.error("Error cargando tipos", err);
      mostrarError("No se pudieron cargar los tipos: " + err.message);
    }
  }

  function esTipoAlojamientoSeleccionado() {
    const opt = filtroTipoServicio?.options?.[filtroTipoServicio.selectedIndex];
    if (!opt) return false;
    return opt.textContent.toLowerCase().includes("aloj");
  }

  function actualizarVisibilidadFechaHasta() {
    if (!wrapperFechaHasta || !fechaHastaInput) return;
    if (esTipoAlojamientoSeleccionado()) wrapperFechaHasta.style.display = "";
    else { wrapperFechaHasta.style.display = "none"; fechaHastaInput.value = ""; }
  }

  filtroTipoServicio?.addEventListener("change", () => {
    actualizarVisibilidadFechaHasta();
    filtrarServicios();
    renderCamposDinamicosPorTipo();
  });

  // ===== Servicios =====
  async function cargarTodosLosServicios() {
    try {
      const lista = await fetchLista("/api/servicios", ["servicios"]);
      allServicios = lista;
      filtrarServicios();
    } catch (err) {
      console.error("Error cargando servicios", err);
      mostrarError("No se pudieron cargar los servicios: " + err.message);
    }
  }

  function filtrarServicios() {
    const idCont = filtroContinente?.value || null;
    const idPais = filtroPais?.value || null;
    const idCiud = filtroCiudad?.value || null;
    const idTipo = filtroTipoServicio?.value || null;

    servicios = allServicios.filter((s) => {
      if (idCont && String(s.id_continente ?? "") !== String(idCont)) return false;
      if (idPais && String(s.id_pais ?? "") !== String(idPais)) return false;
      if (idCiud && String(s.id_ciudad ?? "") !== String(idCiud)) return false;
      if (idTipo && String(s.id_tipo ?? "") !== String(idTipo)) return false;
      return true;
    });

    rellenarSelectServicios();
  }

  function rellenarSelectServicios() {
    if (!selectServicio) return;
    selectServicio.innerHTML = "";
    selectServicio.appendChild(new Option("(Seleccionar servicio)", ""));
    servicios.forEach((s) => {
      const texto = s.servicio_texto || s.nombre_wtravel || `Servicio #${s.id}`;
      selectServicio.appendChild(new Option(texto, s.id));
    });
  }

  // ===== Mini-form =====
  btnToggleCrear?.addEventListener("click", () => {
    const visible = window.getComputedStyle(panelCrear).display !== "none";
    panelCrear.style.display = visible ? "none" : "block";
    msgCrear("");
    renderCamposDinamicosPorTipo();
  });

  btnCancelarSrv?.addEventListener("click", () => {
    panelCrear.style.display = "none";
    msgCrear("");
  });

  async function cargarProveedores() {
    try {
      const lista = await fetchLista("/api/proveedores", ["proveedores"]);
      selProveedorNuevo.innerHTML = "";
      lista.forEach((p) => selProveedorNuevo.appendChild(new Option(`${p.nombre} (${p.iniciales || ""})`, p.id)));
    } catch (e) {
      console.error("Error cargando proveedores", e);
    }
  }

  let _miniFormInited = false;

  function ocultarTodasLasSecciones() {
    ["sec-alojamiento","sec-boleto","sec-vuelo","sec-tren","sec-traslado","sec-tour"]
      .forEach(id => show(document.getElementById(id), false));
  }

  function initMiniFormOnce() {
    if (_miniFormInited) return;
    _miniFormInited = true;

    // ===== ALOJAMIENTO =====
    addOptions(document.getElementById("aloj-regimen"), [
      { value: "SOLO_ALOJAMIENTO", text: "Solo alojamiento" },
      { value: "ALOJAMIENTO_DESAYUNO", text: "Alojamiento y desayuno" },
      { value: "MEDIA_PENSION", text: "Media pensión" },
      { value: "PENSION_COMPLETA", text: "Pensión completa" },
      { value: "TODO_INCLUIDO", text: "Todo incluido" },
      { value: "OTRO", text: "OTRO (especificar)" }
    ], { firstText: "(Seleccionar)", firstValue: "" });

    addOptions(document.getElementById("aloj-categoria-hotel"), [
      { value: "H3_ECONOMICO", text: "3* Económico" },
      { value: "H3_SUPERIOR", text: "3* Superior" },
      { value: "H4_ECONOMICO", text: "4* Económico" },
      { value: "H4_SUPERIOR", text: "4* Superior" },
      { value: "H5_ECONOMICO", text: "5* Económico" },
      { value: "H5_SUPERIOR", text: "5* Superior" },
      { value: "LUJO_ECONOMICO", text: "Lujo Económico" },
      { value: "LUJO_SUPERIOR", text: "Lujo Superior" },
      { value: "OTRO", text: "OTRO (especificar)" }
    ], { firstText: "(Seleccionar)", firstValue: "" });

    addOptions(document.getElementById("aloj-categoria-hab"), [
      { value: "ESTANDAR", text: "Estándar" },
      { value: "SUPERIOR", text: "Superior" },
      { value: "SUITE", text: "Suite" },
      { value: "OTRO", text: "OTRO (especificar)" }
    ], { firstText: "(Seleccionar)", firstValue: "" });

    initOtroCatalogo({ grupoCatalogo: "aloj_regimen_otro", selectCatalogoEl: document.getElementById("aloj-regimen-otro-select"), inputTextoEl: document.getElementById("aloj-regimen-otro-txt") });
    initOtroCatalogo({ grupoCatalogo: "aloj_categoria_hotel_otro", selectCatalogoEl: document.getElementById("aloj-categoria-hotel-otro-select"), inputTextoEl: document.getElementById("aloj-categoria-hotel-otro-txt") });
    initOtroCatalogo({ grupoCatalogo: "aloj_categoria_hab_otro", selectCatalogoEl: document.getElementById("aloj-categoria-hab-otro-select"), inputTextoEl: document.getElementById("aloj-categoria-hab-otro-txt") });

    const selReg = document.getElementById("aloj-regimen");
    const selCatHotel = document.getElementById("aloj-categoria-hotel");
    const selCatHab = document.getElementById("aloj-categoria-hab");
    function syncAlojUI() {
      show(document.getElementById("wrap-aloj-regimen-otro"), selReg?.value === "OTRO");
      show(document.getElementById("wrap-aloj-cat-hotel-otro"), selCatHotel?.value === "OTRO");
      show(document.getElementById("wrap-aloj-cat-hab-otro"), selCatHab?.value === "OTRO");
    }
    selReg?.addEventListener("change", syncAlojUI);
    selCatHotel?.addEventListener("change", syncAlojUI);
    selCatHab?.addEventListener("change", syncAlojUI);
    syncAlojUI();

    // ===== BOLETO =====
    addOptions(document.getElementById("be-tipo-entrada"), [
      { value: "ESTANDAR", text: "Estándar" },
      { value: "VIP", text: "VIP" },
      { value: "FAST_TRACK", text: "Fast track" },
      { value: "OTRA", text: "OTRA (especificar)" }
    ], { firstText: "(Seleccionar tipo)", firstValue: "" });

    initOtroCatalogo({ grupoCatalogo: "boleto_tipo_entrada_otro", selectCatalogoEl: document.getElementById("be-tipo-otra-select"), inputTextoEl: document.getElementById("be-tipo-otra-txt") });

    // Idiomas (select desde BD)
    fillSelectFromCatalog(document.getElementById("be-idioma"), "idiomas", { firstText: "(Seleccionar idioma)", firstValue: "" });

    const selBeTipo = document.getElementById("be-tipo-entrada");
    function syncBoletoUI() { show(document.getElementById("wrap-be-tipo-otra"), selBeTipo?.value === "OTRA"); }
    selBeTipo?.addEventListener("change", syncBoletoUI);
    syncBoletoUI();

    // ===== VUELO (TODO SELECT desde catálogo + escalas fijo) =====
    fillSelectFromCatalog(document.getElementById("vu-origen"), "vuelo_origen", { firstText: "(Seleccionar)", firstValue: "" });
    fillSelectFromCatalog(document.getElementById("vu-destino"), "vuelo_destino", { firstText: "(Seleccionar)", firstValue: "" });
    fillSelectFromCatalog(document.getElementById("vu-clase"), "vuelo_clase", { firstText: "(Seleccionar)", firstValue: "" });
    fillSelectFromCatalog(document.getElementById("vu-equipaje"), "vuelo_equipaje", { firstText: "(Seleccionar)", firstValue: "" });

    const selVuEsc = document.getElementById("vu-escalas");
    if (selVuEsc) {
      addOptions(selVuEsc, [0,1,2,3].map(n => ({ value: String(n), text: String(n) })), { firstText: "(Seleccionar)", firstValue: "" });
    }

    // ===== TREN (TODO SELECT desde catálogo + escalas fijo) =====
    fillSelectFromCatalog(document.getElementById("tr-origen"), "tren_origen", { firstText: "(Seleccionar)", firstValue: "" });
    fillSelectFromCatalog(document.getElementById("tr-destino"), "tren_destino", { firstText: "(Seleccionar)", firstValue: "" });
    fillSelectFromCatalog(document.getElementById("tr-clase"), "tren_clase", { firstText: "(Seleccionar)", firstValue: "" });
    fillSelectFromCatalog(document.getElementById("tr-equipaje"), "tren_equipaje", { firstText: "(Seleccionar)", firstValue: "" });

    const selTrEsc = document.getElementById("tr-escalas");
    if (selTrEsc) {
      addOptions(selTrEsc, [0,1,2,3].map(n => ({ value: String(n), text: String(n) })), { firstText: "(Seleccionar)", firstValue: "" });
    }

    // ===== TRASLADO =====
    addOptions(document.getElementById("tr-tipo"), [
      { value: "AEROPUERTO_HOTEL", text: "Aeropuerto → Hotel" },
      { value: "HOTEL_AEROPUERTO", text: "Hotel → Aeropuerto" },
      { value: "ESTACION_HOTEL", text: "Estación → Hotel" },
      { value: "HOTEL_ESTACION", text: "Hotel → Estación" },
      { value: "PUERTO_HOTEL", text: "Puerto → Hotel" },
      { value: "HOTEL_PUERTO", text: "Hotel → Puerto" },
      { value: "HOTEL_HOTEL", text: "Hotel → Hotel" },
      { value: "OTRO", text: "OTRO (especificar)" }
    ], { firstText: "(Seleccionar)", firstValue: "" });

    addOptions(document.getElementById("tr-vehiculo"), [
      { value: "SEDAN", text: "Sedán" },
      { value: "VAN", text: "Van" },
      { value: "MINIBUS", text: "Minibús" },
      { value: "BUS", text: "Bus" },
      { value: "OTRO", text: "OTRO (especificar)" }
    ], { firstText: "(Seleccionar)", firstValue: "" });

    const selTrTipo = document.getElementById("tr-tipo");
    const selTrVeh = document.getElementById("tr-vehiculo");
    function syncTrasladoUI() {
      show(document.getElementById("wrap-tr-tipo-otro"), selTrTipo?.value === "OTRO");
      show(document.getElementById("wrap-tr-veh-otro"), selTrVeh?.value === "OTRO");
    }
    selTrTipo?.addEventListener("change", syncTrasladoUI);
    selTrVeh?.addEventListener("change", syncTrasladoUI);
    syncTrasladoUI();

    // ===== TOUR =====
    addOptions(document.getElementById("tu-tipo-guia"), [
      { value: "GUIA", text: "Guía" },
      { value: "AUDIOGUIA", text: "Audioguía" },
      { value: "CHOFER_GUIA", text: "Chofer-guía" },
      { value: "OTRO", text: "OTRO (especificar)" }
    ], { firstText: "(Seleccionar)", firstValue: "" });

    // Idiomas (desde BD)
    fillSelectFromCatalog(document.getElementById("tu-idioma"), "idiomas", { firstText: "(Seleccionar idioma)", firstValue: "" });

    const selTuTipoGuia = document.getElementById("tu-tipo-guia");
    const selTuIdioma = document.getElementById("tu-idioma");

    function syncTourUI() {
      show(document.getElementById("wrap-tu-tipo-guia-otro"), selTuTipoGuia?.value === "OTRO");
      show(document.getElementById("wrap-tu-idioma-otro"), selTuIdioma?.value === "OTRO");
    }
    selTuTipoGuia?.addEventListener("change", syncTourUI);
    selTuIdioma?.addEventListener("change", syncTourUI);
    syncTourUI();
  }

  function renderCamposDinamicosPorTipo() {
    if (!contDinamico) return;
    initMiniFormOnce();
    ocultarTodasLasSecciones();

    const opt = filtroTipoServicio?.options?.[filtroTipoServicio.selectedIndex];
    const tipoTexto = (opt?.textContent || "").toLowerCase();

    if (tipoTexto.includes("aloj")) return show(document.getElementById("sec-alojamiento"), true);
    if (tipoTexto.includes("boleto")) return show(document.getElementById("sec-boleto"), true);
    if (tipoTexto.includes("vuelo")) return show(document.getElementById("sec-vuelo"), true);
    if (tipoTexto.includes("tren")) return show(document.getElementById("sec-tren"), true);
    if (tipoTexto.includes("trasl")) return show(document.getElementById("sec-traslado"), true);
    if (tipoTexto.includes("excurs") || tipoTexto.includes("visita") || tipoTexto.includes("tour")) return show(document.getElementById("sec-tour"), true);
  }

  // ===== Guardar servicio rápido =====
  btnGuardarSrv?.addEventListener("click", async () => {
    msgCrear("");

    const id_ciudad = filtroCiudad?.value;
    const id_tipo = filtroTipoServicio?.value;
    const prov = selProveedorNuevo?.value;

    if (!prov) return msgCrear("Selecciona un proveedor.");
    if (!id_ciudad) return msgCrear("Selecciona una ciudad.");
    if (!id_tipo) return msgCrear("Selecciona el tipo de servicio.");

    const payload = {
      id_tipo: Number(id_tipo),
      id_proveedor: Number(prov),
      id_ciudad: Number(id_ciudad),
      nombre_wtravel: (inpNombreW?.value || "").trim(),
      tiempo_servicio: (inpTiempo?.value || "").trim() || null,
      privado: selPrivado?.value === "1",
      descripcion: (inpDesc?.value || "").trim() || null,
      link_reserva: (inpLinkReserva?.value || "").trim() || null
    };

    if (!payload.nombre_wtravel) return msgCrear("Falta el nombre WTravel.");

    const tipoTexto = (filtroTipoServicio?.options?.[filtroTipoServicio.selectedIndex]?.textContent || "").toLowerCase();

    // Alojamiento
    if (tipoTexto.includes("aloj")) {
      const regimen = document.getElementById("aloj-regimen")?.value || null;
      const catHotel = document.getElementById("aloj-categoria-hotel")?.value || null;
      const catHab = document.getElementById("aloj-categoria-hab")?.value || null;

      const regimenOtro = (regimen === "OTRO") ? leerValorOtro({
        selectCatalogoEl: document.getElementById("aloj-regimen-otro-select"),
        inputTextoEl: document.getElementById("aloj-regimen-otro-txt")
      }) : null;

      const catHotelOtro = (catHotel === "OTRO") ? leerValorOtro({
        selectCatalogoEl: document.getElementById("aloj-categoria-hotel-otro-select"),
        inputTextoEl: document.getElementById("aloj-categoria-hotel-otro-txt")
      }) : null;

      const catHabOtro = (catHab === "OTRO") ? leerValorOtro({
        selectCatalogoEl: document.getElementById("aloj-categoria-hab-otro-select"),
        inputTextoEl: document.getElementById("aloj-categoria-hab-otro-txt")
      }) : null;

      payload.alojamiento = {
        noches: Number(document.getElementById("aloj-noches")?.value || 1),
        habitaciones: Number(document.getElementById("aloj-habitaciones")?.value || 1),
        regimen,
        regimen_otro: regimenOtro,
        categoria_hotel: catHotel,
        categoria_hotel_otro: catHotelOtro,
        categoria_hab: catHab,
        categoria_hab_otro: catHabOtro
      };
    }

    // Boleto
    if (tipoTexto.includes("boleto")) {
      const tipoEntrada = document.getElementById("be-tipo-entrada")?.value || null;
      let tipoEntradaOtro = null;
      if (tipoEntrada === "OTRA") {
        tipoEntradaOtro = leerValorOtro({
          selectCatalogoEl: document.getElementById("be-tipo-otra-select"),
          inputTextoEl: document.getElementById("be-tipo-otra-txt")
        });
      }

      payload.boleto_entrada = {
        boleto_entrada: document.getElementById("be-lugar")?.value?.trim() || null,
        tipo_entrada: tipoEntrada,
        tipo_entrada_otro: tipoEntradaOtro,
        audioguia: document.getElementById("be-audioguia")?.value === "1",
        idioma: document.getElementById("be-idioma")?.value || null
      };
    }

    // Traslado (SIN duracion/equipaje)
    if (tipoTexto.includes("trasl")) {
      const tipo = document.getElementById("tr-tipo")?.value || null;
      const tipoOtro = document.getElementById("tr-tipo-otro")?.value?.trim() || null;
      const veh = document.getElementById("tr-vehiculo")?.value || null;
      const vehOtro = document.getElementById("tr-vehiculo-otro")?.value?.trim() || null;

      payload.traslado = {
        origen: document.getElementById("tr-origen-tx")?.value?.trim() || null,
        destino: document.getElementById("tr-destino-tx")?.value?.trim() || null,
        tipo_traslado: tipo,
        tipo_traslado_otro: (tipo === "OTRO") ? tipoOtro : null,
        vehiculo: veh,
        vehiculo_otro: (veh === "OTRO") ? vehOtro : null,
        nota: document.getElementById("tr-nota")?.value?.trim() || null
      };
    }

    // Tour (SIN duracion_min)
    if (tipoTexto.includes("excurs") || tipoTexto.includes("visita") || tipoTexto.includes("tour")) {
      const tipoGuia = document.getElementById("tu-tipo-guia")?.value || null;
      const tipoGuiaOtro = document.getElementById("tu-tipo-guia-otro")?.value?.trim() || null;

      const idioma = document.getElementById("tu-idioma")?.value || null;
      const idiomaOtro = document.getElementById("tu-idioma-otro")?.value?.trim() || null;

      payload.tour = {
        tipo_guia: tipoGuia,
        tipo_guia_otro: (tipoGuia === "OTRO") ? tipoGuiaOtro : null,
        idioma: idioma,
        idioma_otro: (idioma === "OTRO") ? idiomaOtro : null
      };
    }

    // Vuelo (TODO select)
    if (tipoTexto.includes("vuelo")) {
      payload.vuelo = {
        origen: document.getElementById("vu-origen")?.value || "",
        destino: document.getElementById("vu-destino")?.value || "",
        escalas: Number(document.getElementById("vu-escalas")?.value || 0),
        clase: document.getElementById("vu-clase")?.value || null,
        equipaje: document.getElementById("vu-equipaje")?.value || null
      };
    }

    // Tren (TODO select)
    if (tipoTexto.includes("tren")) {
      payload.tren = {
        origen: document.getElementById("tr-origen")?.value || "",
        destino: document.getElementById("tr-destino")?.value || "",
        escalas: Number(document.getElementById("tr-escalas")?.value || 0),
        clase: document.getElementById("tr-clase")?.value || null,
        equipaje: document.getElementById("tr-equipaje")?.value || null,
        sillas_reservadas: document.getElementById("tr-sillas")?.value === "1"
      };
    }

    try {
      const resp = await fetch("/api/servicios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok) throw new Error(data.mensaje || data.error || "Error creando servicio");

      await cargarTodosLosServicios();
      selectServicio.value = String(data.id_servicio);
      panelCrear.style.display = "none";
    } catch (e) {
      console.error(e);
      msgCrear(e.message);
    }
  });

  // ===== Cotización existente =====
  async function cargarCotizacionExistente() {
    if (!idCotizacion) return;
    try {
      const resp = await fetch(`/api/cotizaciones/${idCotizacion}`);
      const data = await resp.json();

      if (!data.ok) return console.warn("No se pudo cargar cotización:", data.mensaje);

      const cab = data.cabecera || data.cotizacion;
      if (cab && cab.nombre_cotizacion && headerIdEl) headerIdEl.textContent = cab.nombre_cotizacion;

      const lista = data.items || [];
      nextIdLocal = 1;
      items = lista.map((row) => mapRowToItem(row));
      actualizarTablaDesdeEstado();
    } catch (err) {
      console.error("Error cargando cotización existente", err);
    }
  }

  btnInsertarServicio?.addEventListener("click", async () => {
    mostrarError("");

    if (!idCotizacion) return mostrarError("Falta el ID de cotización en la URL.");

    const fechaDesde = fechaDesdeInput?.value;
    const idServicioSeleccionado = selectServicio?.value;

    if (!idServicioSeleccionado) return mostrarError("Selecciona un servicio antes de insertarlo.");
    if (!fechaDesde) return mostrarError("Selecciona la fecha de servicio.");

    const esOpcional = chkOpcional && chkOpcional.checked ? 1 : 0;

    try {
      const resp = await fetch(`/api/cotizaciones/${idCotizacion}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_servicio: Number(idServicioSeleccionado),
          fecha_servicio: fechaDesde,
          es_opcional: esOpcional
        })
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok) throw new Error(data.mensaje || data.error || "Error al insertar servicio.");

      const nuevoItem = mapRowToItem(data.item);
      items.push(nuevoItem);
      actualizarTablaDesdeEstado();
      await guardarOrdenEnBackend();
    } catch (err) {
      console.error(err);
      mostrarError("No se pudo insertar el servicio: " + err.message);
    }
  });

  btnCrearServicio?.addEventListener("click", () => {
    window.location.href = "../etapa2/servicios-crear.html";
  });

  (async () => {
    await cargarContinentes();
    await cargarTiposServicio();
    await cargarTodosLosServicios();
    await cargarProveedores();
    await cargarCotizacionExistente();
    actualizarVisibilidadFechaHasta();
  })();
});