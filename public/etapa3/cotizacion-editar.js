// public/etapa3/cotizacion-editar.js

document.addEventListener("DOMContentLoaded", () => {
  // ====== ID de cotización desde la URL ======
  const params = new URLSearchParams(window.location.search);
  const idCotizacion = params.get("id");
  const headerIdEl = document.getElementById("header-id");
  if (headerIdEl) headerIdEl.textContent = idCotizacion ? `#${idCotizacion}` : "(sin id)";

  // ====== Referencias a elementos ======
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

  // ====== Mini-form Crear servicio rápido ======
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

  // ====== Estado en memoria ======
  let items = [];        // líneas de la cotización (ya transformadas)
  let allServicios = []; // todos los servicios (desde /api/servicios)
  let servicios = [];    // servicios filtrados para el <select>
  let nextIdLocal = 1;

  // ====== Helpers generales ======
  function mostrarError(msg) {
    if (mensajeErrorEl) mensajeErrorEl.textContent = msg || "";
  }

  function msgCrear(texto) {
    if (msgCrearSrv) msgCrearSrv.textContent = texto || "";
  }

  // Helper robusto: acepta array directo o { ok:true, key:[...] }
  async function fetchLista(url, posiblesKeys = []) {
    const resp = await fetch(url);
    const text = await resp.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Respuesta no-JSON desde ${url}: ${text.slice(0, 180)}`);
    }

    if (Array.isArray(data)) return data;

    for (const k of posiblesKeys) {
      if (Array.isArray(data?.[k])) return data[k];
    }

    throw new Error(`Formato inesperado desde ${url}`);
  }

  // ====== Catálogos "auto-alimentados" (catalogo_opcion) ======
  const catalogCache = {}; // { grupo: [ {valor}, ... ] }

  async function cargarCatalogo(grupo) {
    if (catalogCache[grupo]) return catalogCache[grupo];

    // Endpoint esperado: /api/catalogos/:grupo
    const lista = await fetchLista(`/api/catalogos/${encodeURIComponent(grupo)}`, ["opciones", "valores", "items"]);
    const norm = lista
      .map(x => (typeof x === "string" ? { valor: x } : x))
      .filter(x => x?.valor);

    catalogCache[grupo] = norm;
    return norm;
  }

  function addOptions(selectEl, opciones, { firstText = "(Seleccionar)", firstValue = "" } = {}) {
    if (!selectEl) return;
    selectEl.innerHTML = "";
    selectEl.appendChild(new Option(firstText, firstValue));
    opciones.forEach(o => {
      selectEl.appendChild(new Option(o.text, o.value));
    });
  }

  function show(el, visible) {
    if (!el) return;
    el.style.display = visible ? "" : "none";
  }

  // Crea el patrón: select catálogo + "Escribir nuevo..."
  async function initOtroCatalogo({
    grupoCatalogo,
    selectCatalogoEl,
    inputTextoEl
  }) {
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

  // ====== Helpers de fecha y tipos ======
  const MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ];

  const DIAS_SEMANA = [
    "domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"
  ];

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

    if (anio1 === anio2 && mes1 === mes2) {
      return `${dia1} – ${dia2} de ${mes1} de ${anio1}`;
    } else if (anio1 === anio2) {
      return `${dia1} de ${mes1} a ${dia2} de ${mes2} de ${anio1}`;
    } else {
      return `${dia1} de ${mes1} de ${anio1} a ${dia2} de ${mes2} de ${anio2}`;
    }
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

  // Mapea una fila devuelta por /api/cotizaciones/:id o por POST /items
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

  // ====== Guardar orden en backend ======
  async function guardarOrdenEnBackend() {
    if (!idCotizacion) return;
    try {
      const payload = {
        orden: items.map((it, index) => ({
          id_item: it.id_item,
          orden_dia: index + 1
        }))
      };

      const resp = await fetch(`/api/cotizaciones/${idCotizacion}/items/orden`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok) {
        console.warn("No se pudo guardar el orden en backend:", data.mensaje || data.error || "Error");
      }
    } catch (err) {
      console.error("Error guardando orden en backend:", err);
    }
  }

  // ====== Tabla de servicios incluidos ======
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
      if (!resp.ok || !data.ok) {
        throw new Error(data.mensaje || data.error || "Error al eliminar el item.");
      }

      items.splice(index, 1);
      actualizarTablaDesdeEstado();
    } catch (err) {
      console.error(err);
      mostrarError("No se pudo eliminar el servicio: " + err.message);
    }
  }

  // ==============================
  //   BLOQUE 1: Ubicaciones
  // ==============================
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

  filtroCiudad?.addEventListener("change", () => {
    filtrarServicios();
  });

  // ==============================
  //   BLOQUE 2: Tipos de servicio
  // ==============================
  async function cargarTiposServicio() {
    try {
      const lista = await fetchLista("/api/tiposervicio", ["tipos", "tipos_servicio", "tiposervicio"]);
      filtroTipoServicio.innerHTML = "";
      filtroTipoServicio.appendChild(new Option("(Todos los tipos)", ""));
      lista.forEach((t) => filtroTipoServicio.appendChild(new Option(t.nombre, t.id)));
    } catch (err) {
      console.error("Error cargando tipos de servicio", err);
      mostrarError("No se pudieron cargar los tipos de servicio: " + err.message);
    }
  }

  function esTipoAlojamientoSeleccionado() {
    const opt = filtroTipoServicio?.options?.[filtroTipoServicio.selectedIndex];
    if (!opt) return false;
    return opt.textContent.toLowerCase().includes("aloj");
  }

  function actualizarVisibilidadFechaHasta() {
    if (!wrapperFechaHasta || !fechaHastaInput) return;
    if (esTipoAlojamientoSeleccionado()) {
      wrapperFechaHasta.style.display = "";
    } else {
      wrapperFechaHasta.style.display = "none";
      fechaHastaInput.value = "";
    }
  }

  filtroTipoServicio?.addEventListener("change", () => {
    actualizarVisibilidadFechaHasta();
    filtrarServicios();
    renderCamposDinamicosPorTipo();
  });

  // ==============================
  //   BLOQUE 3: Servicios
  // ==============================
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

  // ==============================
  //   BLOQUE 3.1: Mini-form Crear servicio rápido
  // ==============================
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
      lista.forEach((p) => {
        selProveedorNuevo.appendChild(new Option(`${p.nombre} (${p.iniciales || ""})`, p.id));
      });
    } catch (e) {
      console.error("Error cargando proveedores", e);
    }
  }

  // Render de campos dinámicos según tipo seleccionado
  function renderCamposDinamicosPorTipo() {
    if (!contDinamico) return;

    const opt = filtroTipoServicio?.options?.[filtroTipoServicio.selectedIndex];
    const tipoTexto = (opt?.textContent || "").toLowerCase();

    contDinamico.innerHTML = "";

    // =========================
    // ALOJAMIENTO (Camino 2)
    // =========================
    if (tipoTexto.includes("aloj")) {
      contDinamico.innerHTML = `
        <h4>Detalle de alojamiento</h4>
        <div class="grid-2">
          <label>Noches<br/>
            <input type="number" id="aloj-noches" min="1" value="1" />
          </label>

          <label>Habitaciones<br/>
            <input type="number" id="aloj-habitaciones" min="1" value="1" />
          </label>

          <label>Régimen<br/>
            <select id="aloj-regimen"></select>
          </label>

          <label id="wrap-aloj-regimen-otro" style="display:none;">OTRO: ¿cuál?<br/>
            <div style="display:flex; gap:8px;">
              <select id="aloj-regimen-otro-select" style="flex:1;"></select>
              <input type="text" id="aloj-regimen-otro-txt" placeholder="Escribir..." style="flex:1; display:none;" />
            </div>
          </label>

          <label>Categoría hotel<br/>
            <select id="aloj-categoria-hotel"></select>
          </label>

          <label id="wrap-aloj-cat-hotel-otro" style="display:none;">OTRO: ¿cuál?<br/>
            <div style="display:flex; gap:8px;">
              <select id="aloj-categoria-hotel-otro-select" style="flex:1;"></select>
              <input type="text" id="aloj-categoria-hotel-otro-txt" placeholder="Escribir..." style="flex:1; display:none;" />
            </div>
          </label>

          <label>Categoría habitación<br/>
            <select id="aloj-categoria-hab"></select>
          </label>

          <label id="wrap-aloj-cat-hab-otro" style="display:none;">OTRO: ¿cuál?<br/>
            <div style="display:flex; gap:8px;">
              <select id="aloj-categoria-hab-otro-select" style="flex:1;"></select>
              <input type="text" id="aloj-categoria-hab-otro-txt" placeholder="Escribir..." style="flex:1; display:none;" />
            </div>
          </label>
        </div>
      `;

      // OJO: aquí debes alinear con tus ENUM reales (ejemplos)
      const selReg = document.getElementById("aloj-regimen");
      const selCatHotel = document.getElementById("aloj-categoria-hotel");
      const selCatHab = document.getElementById("aloj-categoria-hab");

      const wrapRegOtro = document.getElementById("wrap-aloj-regimen-otro");
      const wrapHotelOtro = document.getElementById("wrap-aloj-cat-hotel-otro");
      const wrapHabOtro = document.getElementById("wrap-aloj-cat-hab-otro");

      // Enum de ejemplo (cámbialo a tu BD si aplica)
      addOptions(selReg, [
        { value: "SOLO_ALOJAMIENTO", text: "Solo alojamiento" },
        { value: "ALOJAMIENTO_DESAYUNO", text: "Alojamiento y desayuno" },
        { value: "MEDIA_PENSION", text: "Media pensión" },
        { value: "PENSION_COMPLETA", text: "Pensión completa" },
        { value: "TODO_INCLUIDO", text: "Todo incluido" },
        { value: "OTRO", text: "OTRO (especificar)" }
      ], { firstText: "(Seleccionar)", firstValue: "" });

      addOptions(selCatHotel, [
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

      addOptions(selCatHab, [
        { value: "ESTANDAR", text: "Estándar" },
        { value: "SUPERIOR", text: "Superior" },
        { value: "SUITE", text: "Suite" },
        { value: "OTRO", text: "OTRO (especificar)" }
      ], { firstText: "(Seleccionar)", firstValue: "" });

      // Inicializar catálogos de "otros"
      const selRegOtro = document.getElementById("aloj-regimen-otro-select");
      const txtRegOtro = document.getElementById("aloj-regimen-otro-txt");
      const selHotelOtro = document.getElementById("aloj-categoria-hotel-otro-select");
      const txtHotelOtro = document.getElementById("aloj-categoria-hotel-otro-txt");
      const selHabOtro = document.getElementById("aloj-categoria-hab-otro-select");
      const txtHabOtro = document.getElementById("aloj-categoria-hab-otro-txt");

      initOtroCatalogo({ grupoCatalogo: "aloj_regimen_otro", selectCatalogoEl: selRegOtro, inputTextoEl: txtRegOtro });
      initOtroCatalogo({ grupoCatalogo: "aloj_categoria_hotel_otro", selectCatalogoEl: selHotelOtro, inputTextoEl: txtHotelOtro });
      initOtroCatalogo({ grupoCatalogo: "aloj_categoria_hab_otro", selectCatalogoEl: selHabOtro, inputTextoEl: txtHabOtro });

      function syncAlojUI() {
        show(wrapRegOtro, selReg?.value === "OTRO");
        show(wrapHotelOtro, selCatHotel?.value === "OTRO");
        show(wrapHabOtro, selCatHab?.value === "OTRO");

        if (selReg?.value !== "OTRO") { if (selRegOtro) selRegOtro.value = ""; if (txtRegOtro) txtRegOtro.value = ""; show(txtRegOtro, false); }
        if (selCatHotel?.value !== "OTRO") { if (selHotelOtro) selHotelOtro.value = ""; if (txtHotelOtro) txtHotelOtro.value = ""; show(txtHotelOtro, false); }
        if (selCatHab?.value !== "OTRO") { if (selHabOtro) selHabOtro.value = ""; if (txtHabOtro) txtHabOtro.value = ""; show(txtHabOtro, false); }
      }

      selReg?.addEventListener("change", syncAlojUI);
      selCatHotel?.addEventListener("change", syncAlojUI);
      selCatHab?.addEventListener("change", syncAlojUI);
      syncAlojUI();

      return;
    }

    // =========================
    // BOLETO (select inteligente + OTRA)
    // =========================
    if (tipoTexto.includes("boleto")) {
      contDinamico.innerHTML = `
        <h4>Detalle de boleto de entrada</h4>
        <div class="grid-2">
          <label>Lugar<br/>
            <input type="text" id="be-lugar" placeholder="Museo Louvre..." />
          </label>

          <label>Tipo de entrada<br/>
            <select id="be-tipo-entrada"></select>
          </label>

          <label id="wrap-be-tipo-otra" style="display:none;">OTRA: ¿cuál?<br/>
            <div style="display:flex; gap:8px;">
              <select id="be-tipo-otra-select" style="flex:1;"></select>
              <input type="text" id="be-tipo-otra-txt" placeholder="Escribir..." style="flex:1; display:none;" />
            </div>
          </label>

          <label>Audio guía<br/>
            <select id="be-audioguia">
              <option value="0">No</option>
              <option value="1">Sí</option>
            </select>
          </label>

          <label>Idioma<br/>
            <input type="text" id="be-idioma" placeholder="español" />
          </label>
        </div>
      `;

      const selTipo = document.getElementById("be-tipo-entrada");
      const wrapOtra = document.getElementById("wrap-be-tipo-otra");
      const selOtra = document.getElementById("be-tipo-otra-select");
      const txtOtra = document.getElementById("be-tipo-otra-txt");

      // OJO: ajusta estos valores a tu ENUM real (ejemplo)
      addOptions(selTipo, [
        { value: "ESTANDAR", text: "Estándar" },
        { value: "VIP", text: "VIP" },
        { value: "FAST_TRACK", text: "Fast track" },
        { value: "OTRA", text: "OTRA (especificar)" }
      ], { firstText: "(Seleccionar tipo)", firstValue: "" });

      initOtroCatalogo({ grupoCatalogo: "boleto_tipo_entrada_otro", selectCatalogoEl: selOtra, inputTextoEl: txtOtra });

      function syncOtraUI() {
        const isOtra = selTipo?.value === "OTRA";
        show(wrapOtra, isOtra);

        if (!isOtra) {
          if (selOtra) selOtra.value = "";
          if (txtOtra) txtOtra.value = "";
          show(txtOtra, false);
        }
      }

      selTipo?.addEventListener("change", syncOtraUI);
      syncOtraUI();

      return;
    }

    // Vuelo
    if (tipoTexto.includes("vuelo")) {
      contDinamico.innerHTML = `
        <h4>Detalle de vuelo</h4>
        <div class="grid-2">
          <label>Origen<br/>
            <input type="text" id="vu-origen" placeholder="Bogotá" />
          </label>
          <label>Destino<br/>
            <input type="text" id="vu-destino" placeholder="Madrid" />
          </label>
          <label>Escalas<br/>
            <input type="number" id="vu-escalas" min="0" value="0" />
          </label>
          <label>Clase<br/>
            <input type="text" id="vu-clase" placeholder="económica" />
          </label>
          <label>Equipaje<br/>
            <input type="text" id="vu-equipaje" placeholder="23kg+10kg+6kg" />
          </label>
        </div>
      `;
      return;
    }

    // Tren
    if (tipoTexto.includes("tren")) {
      contDinamico.innerHTML = `
        <h4>Detalle de tren</h4>
        <div class="grid-2">
          <label>Origen<br/>
            <input type="text" id="tr-origen" placeholder="Madrid" />
          </label>
          <label>Destino<br/>
            <input type="text" id="tr-destino" placeholder="Barcelona" />
          </label>
          <label>Escalas<br/>
            <input type="number" id="tr-escalas" min="0" value="0" />
          </label>
          <label>Clase<br/>
            <input type="text" id="tr-clase" placeholder="económica" />
          </label>
          <label>Equipaje<br/>
            <input type="text" id="tr-equipaje" placeholder="10kg+6kg" />
          </label>
          <label>Asientos reservados<br/>
            <select id="tr-sillas">
              <option value="1">Sí</option>
              <option value="0">No</option>
            </select>
          </label>
        </div>
      `;
    }
    // Traslado
    if (tipoTexto.includes("trasl")) {
      contDinamico.innerHTML = `
        <h4>Detalle de traslado</h4>
        <div class="grid-2">
          <label>Origen<br/>
            <input type="text" id="tr-origen-tx" placeholder="Aeropuerto, estación, hotel..." />
          </label>

          <label>Destino<br/>
            <input type="text" id="tr-destino-tx" placeholder="Hotel, aeropuerto..." />
          </label>

          <label>Tipo de traslado<br/>
            <select id="tr-tipo"></select>
          </label>

          <label id="wrap-tr-tipo-otro" style="display:none;">OTRO: ¿cuál?<br/>
            <input type="text" id="tr-tipo-otro" placeholder="Ej: Aeropuerto - Puerto" />
          </label>

          <label>Vehículo<br/>
            <select id="tr-vehiculo"></select>
          </label>

          <label id="wrap-tr-veh-otro" style="display:none;">OTRO: ¿cuál?<br/>
            <input type="text" id="tr-vehiculo-otro" placeholder="Ej: SUV, Tuk-tuk..." />
          </label>

          <label>Duración aprox<br/>
            <input type="text" id="tr-duracion" placeholder="Ej: 45 min, 1h..." />
          </label>

          <label>Equipaje<br/>
            <input type="text" id="tr-equipaje" placeholder="Ej: 1 maleta grande + 1 carry-on" />
          </label>

          <label style="grid-column: 1 / -1;">Nota<br/>
            <input type="text" id="tr-nota" placeholder="Opcional..." />
          </label>
        </div>
      `;

      const selTipo = document.getElementById("tr-tipo");
      const wrapTipoOtro = document.getElementById("wrap-tr-tipo-otro");
      const inpTipoOtro = document.getElementById("tr-tipo-otro");

      const selVeh = document.getElementById("tr-vehiculo");
      const wrapVehOtro = document.getElementById("wrap-tr-veh-otro");
      const inpVehOtro = document.getElementById("tr-vehiculo-otro");

      // Aquí pon los valores “seguros”. Si luego quieres “auto-alimentado”, estos OTRO alimentan catálogo.
      addOptions(selTipo, [
        { value: "", text: "(Seleccionar)" },
        { value: "AEROPUERTO_HOTEL", text: "Aeropuerto → Hotel" },
        { value: "HOTEL_AEROPUERTO", text: "Hotel → Aeropuerto" },
        { value: "ESTACION_HOTEL", text: "Estación → Hotel" },
        { value: "HOTEL_ESTACION", text: "Hotel → Estación" },
        { value: "PUERTO_HOTEL", text: "Puerto → Hotel" },
        { value: "HOTEL_PUERTO", text: "Hotel → Puerto" },
        { value: "HOTEL_HOTEL", text: "Hotel → Hotel" },
        { value: "OTRO", text: "OTRO (especificar)" }
      ], { firstText: "(Seleccionar)", firstValue: "" });

      addOptions(selVeh, [
        { value: "", text: "(Seleccionar)" },
        { value: "SEDAN", text: "Sedán" },
        { value: "VAN", text: "Van" },
        { value: "MINIBUS", text: "Minibús" },
        { value: "BUS", text: "Bus" },
        { value: "OTRO", text: "OTRO (especificar)" }
      ], { firstText: "(Seleccionar)", firstValue: "" });

      function syncTrasladoUI() {
        const isTipoOtro = (selTipo?.value === "OTRO");
        show(wrapTipoOtro, isTipoOtro);
        if (!isTipoOtro && inpTipoOtro) inpTipoOtro.value = "";

        const isVehOtro = (selVeh?.value === "OTRO");
        show(wrapVehOtro, isVehOtro);
        if (!isVehOtro && inpVehOtro) inpVehOtro.value = "";
      }

      selTipo?.addEventListener("change", syncTrasladoUI);
      selVeh?.addEventListener("change", syncTrasladoUI);
      syncTrasladoUI();
      return;
    }

    // Excursión / Visita / Tour
    if (tipoTexto.includes("excurs") || tipoTexto.includes("visita") || tipoTexto.includes("tour")) {
      contDinamico.innerHTML = `
        <h4>Detalle de excursión / visita</h4>
        <div class="grid-2">
          <label>Lugar / Atracción<br/>
            <input type="text" id="tu-lugar" placeholder="Ej: City tour, Sagrada Familia..." />
          </label>

          <label>Punto de encuentro<br/>
            <input type="text" id="tu-encuentro" placeholder="Ej: Lobby hotel, puerta principal..." />
          </label>

          <label>Duración<br/>
            <input type="text" id="tu-duracion" placeholder="Ej: 3h, día completo..." />
          </label>

          <label>Idioma del guía<br/>
            <select id="tu-idioma"></select>
          </label>

          <label id="wrap-tu-idioma-otro" style="display:none;">OTRO: ¿cuál?<br/>
            <input type="text" id="tu-idioma-otro" placeholder="Ej: francés, italiano..." />
          </label>

          <label style="grid-column: 1 / -1;">Incluye<br/>
            <input type="text" id="tu-incluye" placeholder="Opcional... (entradas, transporte, comida...)" />
          </label>

          <label style="grid-column: 1 / -1;">Observaciones<br/>
            <input type="text" id="tu-obs" placeholder="Opcional..." />
          </label>
        </div>
      `;

      const selIdioma = document.getElementById("tu-idioma");
      const wrapIdiomaOtro = document.getElementById("wrap-tu-idioma-otro");
      const inpIdiomaOtro = document.getElementById("tu-idioma-otro");

      addOptions(selIdioma, [
        { value: "", text: "(Seleccionar)" },
        { value: "ESPANOL", text: "Español" },
        { value: "INGLES", text: "Inglés" },
        { value: "PORTUGUES", text: "Portugués" },
        { value: "OTRO", text: "OTRO (especificar)" }
      ], { firstText: null })

      function syncTourUI() {
        const isOtro = (selIdioma?.value === "OTRO");
        show(wrapIdiomaOtro, isOtro);
        if (!isOtro && inpIdiomaOtro) inpIdiomaOtro.value = "";
      }

      selIdioma?.addEventListener("change", syncTourUI);
      syncTourUI();
      return;
    }


  }

  // ==============================
  //   CLICK Guardar servicio rápido
  // ==============================
  btnGuardarSrv?.addEventListener("click", async () => {
    msgCrear("");

    const id_ciudad = filtroCiudad?.value;
    const id_tipo = filtroTipoServicio?.value;
    const prov = selProveedorNuevo?.value;

    if (!prov) return msgCrear("Selecciona un proveedor.");
    if (!id_ciudad) return msgCrear("Selecciona una ciudad (para saber dónde vive el servicio).");
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

    // Alojamiento (Camino 2: manda *_otro)
    if (tipoTexto.includes("aloj")) {
      const regimen = document.getElementById("aloj-regimen")?.value || null;
      const catHotel = document.getElementById("aloj-categoria-hotel")?.value || null;
      const catHab = document.getElementById("aloj-categoria-hab")?.value || null;

      const regimenOtro = (regimen === "OTRO")
        ? leerValorOtro({
            selectCatalogoEl: document.getElementById("aloj-regimen-otro-select"),
            inputTextoEl: document.getElementById("aloj-regimen-otro-txt")
          })
        : null;

      const catHotelOtro = (catHotel === "OTRO")
        ? leerValorOtro({
            selectCatalogoEl: document.getElementById("aloj-categoria-hotel-otro-select"),
            inputTextoEl: document.getElementById("aloj-categoria-hotel-otro-txt")
          })
        : null;

      const catHabOtro = (catHab === "OTRO")
        ? leerValorOtro({
            selectCatalogoEl: document.getElementById("aloj-categoria-hab-otro-select"),
            inputTextoEl: document.getElementById("aloj-categoria-hab-otro-txt")
          })
        : null;

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
        idioma: document.getElementById("be-idioma")?.value?.trim() || null
      };
    }

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

        duracion_aprox: document.getElementById("tr-duracion")?.value?.trim() || null,
        equipaje: document.getElementById("tr-equipaje")?.value?.trim() || null,
        nota: document.getElementById("tr-nota")?.value?.trim() || null
      };
    }

    if (tipoTexto.includes("excurs") || tipoTexto.includes("visita") || tipoTexto.includes("tour")) {
      const idioma = document.getElementById("tu-idioma")?.value || null;
      const idiomaOtro = document.getElementById("tu-idioma-otro")?.value?.trim() || null;

      payload.tour = {
        lugar: document.getElementById("tu-lugar")?.value?.trim() || null,
        punto_encuentro: document.getElementById("tu-encuentro")?.value?.trim() || null,
        duracion: document.getElementById("tu-duracion")?.value?.trim() || null,

        idioma_guia: idioma,
        idioma_guia_otro: (idioma === "OTRO") ? idiomaOtro : null,

        incluye: document.getElementById("tu-incluye")?.value?.trim() || null,
        observaciones: document.getElementById("tu-obs")?.value?.trim() || null
      };
    }

    // Vuelo
    if (tipoTexto.includes("vuelo")) {
      payload.vuelo = {
        origen: document.getElementById("vu-origen")?.value?.trim() || "",
        destino: document.getElementById("vu-destino")?.value?.trim() || "",
        escalas: Number(document.getElementById("vu-escalas")?.value || 0),
        clase: document.getElementById("vu-clase")?.value?.trim() || null,
        equipaje: document.getElementById("vu-equipaje")?.value?.trim() || null
      };
    }

    // Tren
    if (tipoTexto.includes("tren")) {
      payload.tren = {
        origen: document.getElementById("tr-origen")?.value?.trim() || "",
        destino: document.getElementById("tr-destino")?.value?.trim() || "",
        escalas: Number(document.getElementById("tr-escalas")?.value || 0),
        clase: document.getElementById("tr-clase")?.value?.trim() || null,
        equipaje: document.getElementById("tr-equipaje")?.value?.trim() || null,
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

  // ==============================
  //   BLOQUE 4: Items de cotización
  // ==============================
  async function cargarCotizacionExistente() {
    if (!idCotizacion) return;
    try {
      const resp = await fetch(`/api/cotizaciones/${idCotizacion}`);
      const data = await resp.json();

      if (!data.ok) {
        console.warn("No se pudo cargar cotización:", data.mensaje);
        return;
      }

      const cab = data.cabecera || data.cotizacion;
      if (cab && cab.nombre_cotizacion && headerIdEl) {
        headerIdEl.textContent = cab.nombre_cotizacion;
      }

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

    if (!idCotizacion) {
      mostrarError("Falta el ID de cotización en la URL.");
      return;
    }

    const fechaDesde = fechaDesdeInput?.value;
    const idServicioSeleccionado = selectServicio?.value;

    if (!idServicioSeleccionado) {
      mostrarError("Selecciona un servicio antes de insertarlo.");
      return;
    }
    if (!fechaDesde) {
      mostrarError("Selecciona la fecha de servicio.");
      return;
    }

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
      if (!resp.ok || !data.ok) {
        throw new Error(data.mensaje || data.error || "Error al insertar servicio.");
      }

      const row = data.item;
      const nuevoItem = mapRowToItem(row);
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

  // ==============================
  //   INICIALIZACIÓN
  // ==============================
  (async () => {
    await cargarContinentes();
    await cargarTiposServicio();
    await cargarTodosLosServicios();
    await cargarProveedores();
    await cargarCotizacionExistente();
    actualizarVisibilidadFechaHasta();
  })();
});