// public/etapa3/cotizacion-editar.js
// ✅ Versión completa corregida:
// - Flechas ↑/↓ ahora mueven ORDEN + FECHA (↑ resta 1 día, ↓ suma 1 día)
// - Alojamiento: mueve el check-in; el rango se recalcula con noches
// - Opcionales: no muestran precio y no suman al total
// - Render de fecha: se calcula desde fechaYmd (ya no usa it.fecha que no existía)

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

  // ✅ Preview del nombre automático (si existe en el HTML)
  const inpNombreAutoPreview = document.getElementById("nuevo-nombre-auto-preview");

  // tiempo_servicio: select + txt
  const selTiempoServicio = document.getElementById("nuevo-tiempo-servicio-select");
  const txtTiempoServicio = document.getElementById("nuevo-tiempo-servicio-txt");

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

  // ✅ Mapa global: id_servicio (string) -> servicio_texto (string)
  let servicioTextoById = new Map();

  // ==========================
  // Helpers UI
  // ==========================
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
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Respuesta no-JSON desde ${url}: ${text.slice(0, 180)}`);
    }

    if (Array.isArray(data)) return data;
    for (const k of posiblesKeys) if (Array.isArray(data?.[k])) return data[k];
    throw new Error(`Formato inesperado desde ${url}`);
  }

  // ==========================
  // Catálogos
  // ==========================
  const catalogCache = {};
  async function cargarCatalogo(grupo) {
    if (catalogCache[grupo]) return catalogCache[grupo];
    const lista = await fetchLista(`/api/catalogos/${encodeURIComponent(grupo)}`, [
      "opciones",
      "valores",
      "items",
    ]);
    const norm = lista
      .map((x) => (typeof x === "string" ? { valor: x } : x))
      .filter((x) => x?.valor);
    catalogCache[grupo] = norm;
    return norm;
  }

  function addOptions(selectEl, opciones, { firstText = "(Seleccionar)", firstValue = "" } = {}) {
    if (!selectEl) return;
    selectEl.innerHTML = "";
    if (firstText !== null) selectEl.appendChild(new Option(firstText, firstValue));
    (opciones || []).forEach((o) => selectEl.appendChild(new Option(o.text, o.value)));
  }

  function show(el, visible) {
    if (!el) return;
    el.style.display = visible ? "" : "none";
  }

  async function fillSelectFromCatalog(selectEl, grupo, { firstText = "(Seleccionar)", firstValue = "" } = {}) {
    if (!selectEl) return;
    try {
      const cat = await cargarCatalogo(grupo);
      addOptions(selectEl, cat.map((x) => ({ value: x.valor, text: x.valor })), { firstText, firstValue });
    } catch {
      addOptions(selectEl, [], { firstText: "(Sin catálogo)", firstValue: "" });
    }
  }

  // ✅ Un solo select con opción "Escribir nuevo..." => muestra input "¿Cuál?"
  function initSelectConEscribirNuevo(selectEl, inputEl) {
    if (!selectEl) return;

    function sync() {
      const wantsWrite = selectEl.value === "__write__";
      if (inputEl) {
        inputEl.style.display = wantsWrite ? "" : "none";
        if (!wantsWrite) inputEl.value = "";
      }
    }

    selectEl.addEventListener("change", sync);
    sync();
  }

  function leerSelectOEscribir(selectEl, inputEl) {
    if (!selectEl) return null;
    const v = selectEl.value || "";
    if (!v) return null;
    if (v !== "__write__") return v;
    const txt = (inputEl?.value || "").trim();
    return txt || null;
  }

  // Tiempo servicio (catálogo + escribir)
  async function initOtroCatalogo({ grupoCatalogo, selectCatalogoEl, inputTextoEl }) {
    if (!selectCatalogoEl) return;

    try {
      const cat = await cargarCatalogo(grupoCatalogo);

      const opts = [
        ...cat.map((x) => ({ value: x.valor, text: x.valor })),
        { value: "__write__", text: "Escribir nuevo..." },
      ];

      addOptions(selectCatalogoEl, opts, { firstText: "(Elegir de catálogo)", firstValue: "" });
    } catch {
      addOptions(selectCatalogoEl, [{ value: "__write__", text: "Escribir nuevo..." }], {
        firstText: "(Elegir de catálogo)",
        firstValue: "",
      });
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

  // ✅ para selects de catálogo con "Escribir nuevo..."
  async function fillSelectCatalogoConEscribir(selectEl, inputEl, grupoCatalogo, { firstText, firstValue } = {}) {
    if (!selectEl) return;

    const firstT = firstText ?? "(Seleccionar)";
    const firstV = firstValue ?? "";

    try {
      const cat = await cargarCatalogo(grupoCatalogo);
      const opts = [
        ...cat.map((x) => ({ value: x.valor, text: x.valor })),
        { value: "__write__", text: "Escribir nuevo..." },
      ];
      addOptions(selectEl, opts, { firstText: firstT, firstValue: firstV });
    } catch {
      addOptions(selectEl, [{ value: "__write__", text: "Escribir nuevo..." }], {
        firstText: "(Sin catálogo)",
        firstValue: "",
      });
    }

    initSelectConEscribirNuevo(selectEl, inputEl);
  }

  function recalcularTotal() {
    let total = 0;
    items.forEach((it) => {
      if (it.es_opcional) return; // ✅ no sumar opcionales
      const p = Number(it.precio);
      if (!Number.isNaN(p) && p > 0) total += p;
    });
    if (totalUsdInput) totalUsdInput.value = total.toFixed(2);
  }

  // ==========================
  // Fechas
  // ==========================
  const MESES = [
    "enero","febrero","marzo","abril","mayo","junio",
    "julio","agosto","septiembre","octubre","noviembre","diciembre",
  ];
  const DIAS_SEMANA = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];

  function parseYMD(ymd) {
    const [y, m, d] = String(ymd || "").split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
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

  // ==========================
  // ✅ Filtro fuerte por noches (solo alojamiento)
  // ==========================
  let nochesFiltroAloj = null;

  function calcularNoches(desdeYmd, hastaYmd) {
    if (!desdeYmd || !hastaYmd) return null;
    const d1 = parseYMD(desdeYmd);
    const d2 = parseYMD(hastaYmd);
    const diffMs = d2 - d1;
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return diffDias;
  }

  function esTipoAlojamientoSeleccionado() {
    const opt = filtroTipoServicio?.options?.[filtroTipoServicio.selectedIndex];
    if (!opt) return false;
    return opt.textContent.toLowerCase().includes("aloj");
  }

  function actualizarNochesYFiltrarServicios() {
    if (!esTipoAlojamientoSeleccionado()) {
      nochesFiltroAloj = null;
      return;
    }

    const desde = fechaDesdeInput?.value;
    const hasta = fechaHastaInput?.value;

    if (!desde || !hasta) {
      nochesFiltroAloj = null;
      filtrarServicios();
      return;
    }

    const noches = calcularNoches(desde, hasta);

    if (!Number.isFinite(noches) || noches < 1) {
      nochesFiltroAloj = null;
      mostrarError("En alojamiento, la fecha hasta debe ser posterior a la fecha desde (mínimo 1 noche).");
      filtrarServicios();
      return;
    }

    mostrarError("");
    nochesFiltroAloj = noches;
    filtrarServicios();
  }

  // ==========================
  // ✅ Servicio texto robusto (para cotización)
  // ==========================
  function getServicioTextoFromRow(row) {
    const direct = (row?.servicio_texto || "").trim();
    if (direct) return direct;

    const idSrv = row?.id_servicio != null ? String(row.id_servicio) : null;
    if (idSrv && servicioTextoById.has(idSrv)) return servicioTextoById.get(idSrv);

    const alt =
      (row?.nombre_servicio || "").trim() ||
      (row?.nombre_wtravel || "").trim() ||
      (row?.nombre || "").trim();

    return alt || "";
  }

  // ==========================
  // Mapeo items cotización
  // ==========================
  function mapRowToItem(row) {
    const tipo = row.tipo_servicio || "";
    const esAlojamiento = esTipoAlojamientoTexto(tipo);

    const fechaYmd = String(row.fecha_servicio).substring(0, 10);
    const servicioTexto = getServicioTextoFromRow(row);

    let precio = row.precio_usd;
    if (esTipoSinPrecio(tipo)) precio = null;

    return {
      idLocal: nextIdLocal++,
      id_item: row.id_item,
      id_servicio: row.id_servicio,
      ciudad: row.ciudad,
      tipo_servicio: row.tipo_servicio,
      esAlojamiento,
      fechaYmd, // ✅ clave
      noches_alojamiento: row.noches_alojamiento ?? null,
      servicioTexto,
      precio,
      es_opcional: Number(row.es_opcional) === 1,
    };
  }

  async function guardarOrdenEnBackend() {
    if (!idCotizacion) return;
    try {
      const payload = {
        orden: items.map((it, index) => ({ id_item: it.id_item, orden_dia: index + 1 })),
      };

      const resp = await fetch(`/api/cotizaciones/${idCotizacion}/items/orden`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok) console.warn("No se pudo guardar el orden:", data.mensaje || data.error || "Error");
    } catch (err) {
      console.error("Error guardando orden:", err);
    }
  }

  // ✅ Persistir fecha del item (requiere backend: PUT /api/cotizaciones/items/:id_item/fecha)
  async function guardarFechaItemEnBackend(idItem, fechaYmd) {
    if (!idItem) return;
    try {
      const resp = await fetch(`/api/cotizaciones/items/${idItem}/fecha`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha_servicio: fechaYmd }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok) {
        console.warn("No se pudo guardar la fecha:", data.mensaje || data.error || "Error");
      }
    } catch (err) {
      console.error("Error guardando fecha:", err);
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

      // ✅ Fecha se recalcula desde fechaYmd
      const colFecha = document.createElement("td");
      if (it.esAlojamiento && it.noches_alojamiento && Number(it.noches_alojamiento) > 0) {
        const desde = it.fechaYmd;
        const hasta = sumarDiasYmd(desde, Number(it.noches_alojamiento));
        colFecha.textContent = formatoRangoAlojamiento(desde, hasta);
      } else {
        colFecha.textContent = it.fechaYmd ? formatoFechaServicio(it.fechaYmd) : "";
      }

      const colServicio = document.createElement("td");
      colServicio.textContent = it.servicioTexto || "";

      const colPrecio = document.createElement("td");
      // ✅ Si es opcional, no mostrar precio
      if (it.es_opcional) {
        colPrecio.textContent = "-";
      } else if (it.precio != null && it.precio !== "") {
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

  // ✅ Mover: swap + mover fecha del item movido (+/-1 día) + persistir fecha + persistir orden
  async function moverItem(idx, delta) {
    if (idx < 0 || idx >= items.length) return;

    const moved = items[idx];
    if (!moved || !moved.fechaYmd) return;

    // 1) Cambiar fecha (siempre)
    const nuevaFecha = sumarDiasYmd(moved.fechaYmd, delta);
    moved.fechaYmd = nuevaFecha;

    // 2) Guardar fecha en backend (siempre)
    await guardarFechaItemEnBackend(moved.id_item, moved.fechaYmd);

    // 3) Regla: solo cambiar índice si cruza con el vecino
    let swapped = false;

    if (delta === -1 && idx > 0) {
      const prev = items[idx - 1];
      // Si al subir queda ANTES que la fecha del anterior → sí swap
      if (prev?.fechaYmd && moved.fechaYmd < prev.fechaYmd) {
        items[idx] = prev;
        items[idx - 1] = moved;
        swapped = true;
      }
    }

    if (delta === +1 && idx < items.length - 1) {
      const next = items[idx + 1];
      // Si al bajar queda DESPUÉS que la fecha del siguiente → sí swap
      if (next?.fechaYmd && moved.fechaYmd > next.fechaYmd) {
        items[idx] = next;
        items[idx + 1] = moved;
        swapped = true;
      }
    }

    // 4) Repintar
    actualizarTablaDesdeEstado();

    // 5) Solo guardar orden si realmente cambió el índice
    if (swapped) {
      await guardarOrdenEnBackend();
    }
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

  // ==========================
  // Ubicaciones
  // ==========================
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

  // ==========================
  // Tipos
  // ==========================
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

  function actualizarVisibilidadFechaHasta() {
    if (!wrapperFechaHasta || !fechaHastaInput) return;

    if (esTipoAlojamientoSeleccionado()) {
      wrapperFechaHasta.style.display = "";
    } else {
      wrapperFechaHasta.style.display = "none";
      fechaHastaInput.value = "";
      nochesFiltroAloj = null;
    }
  }

  filtroTipoServicio?.addEventListener("change", () => {
    actualizarVisibilidadFechaHasta();
    actualizarNochesYFiltrarServicios();
    filtrarServicios();
    renderCamposDinamicosPorTipo();
  });

  fechaDesdeInput?.addEventListener("change", () => {
    if (esTipoAlojamientoSeleccionado()) actualizarNochesYFiltrarServicios();
  });
  fechaHastaInput?.addEventListener("change", () => {
    if (esTipoAlojamientoSeleccionado()) actualizarNochesYFiltrarServicios();
  });

  // ==========================
  // Servicios
  // ==========================
  async function cargarTodosLosServicios() {
    try {
      const lista = await fetchLista("/api/servicios", ["servicios"]);
      allServicios = lista;

      // ✅ refresca mapa id -> servicio_texto
      servicioTextoById = new Map(
        (allServicios || []).map((s) => [
          String(s.id),
          (s.servicio_texto || "").trim() ||
            (s.nombre_wtravel || "").trim() ||
            `Servicio #${s.id}`,
        ])
      );

      filtrarServicios();
    } catch (err) {
      console.error("Error cargando servicios", err);
      mostrarError("No se pudieron cargar los servicios: " + err.message);
    }
  }

  function labelServicio(s) {
    return (s.servicio_texto || "").trim() || s.nombre_wtravel || `Servicio #${s.id}`;
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

      if (esTipoAlojamientoSeleccionado() && nochesFiltroAloj != null) {
        const n = Number(
          s.aloj_noches ?? s.noches ?? s.noches_alojamiento ?? s.alojamiento_noches
        );
        if (!Number.isFinite(n) || n !== nochesFiltroAloj) return false;
      }

      return true;
    });

    rellenarSelectServicios();
    if (selectServicio) selectServicio.value = "";
  }

  function rellenarSelectServicios() {
    if (!selectServicio) return;
    selectServicio.innerHTML = "";
    selectServicio.appendChild(new Option("(Seleccionar servicio)", ""));

    servicios.forEach((s) => {
      const texto = labelServicio(s);
      selectServicio.appendChild(new Option(texto, s.id));
    });
  }

  // ==========================
  // Mini-form (Crear servicio rápido)
  // ==========================
  btnToggleCrear?.addEventListener("click", () => {
    const visible = window.getComputedStyle(panelCrear).display !== "none";
    panelCrear.style.display = visible ? "none" : "block";
    msgCrear("");

    if (inpNombreAutoPreview) {
      inpNombreAutoPreview.value = "Se genera automáticamente al guardar";
    }

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
      lista.forEach((p) =>
        selProveedorNuevo.appendChild(new Option(`${p.nombre} (${p.iniciales || ""})`, p.id))
      );
    } catch (e) {
      console.error("Error cargando proveedores", e);
    }
  }

  let _miniFormInited = false;

  function ocultarTodasLasSecciones() {
    ["sec-alojamiento", "sec-boleto", "sec-vuelo", "sec-tren", "sec-traslado", "sec-tour"].forEach((id) =>
      show(document.getElementById(id), false)
    );
  }

  async function initMiniFormOnce() {
    if (_miniFormInited) return;
    _miniFormInited = true;

    await initOtroCatalogo({
      grupoCatalogo: "tiempo_servicio",
      selectCatalogoEl: selTiempoServicio,
      inputTextoEl: txtTiempoServicio,
    });

    // ===== ALOJAMIENTO =====
    addOptions(
      document.getElementById("aloj-regimen"),
      [
        { value: "SOLO_ALOJAMIENTO", text: "Solo alojamiento" },
        { value: "ALOJAMIENTO_DESAYUNO", text: "Alojamiento y desayuno" },
        { value: "MEDIA_PENSION", text: "Media pensión" },
        { value: "PENSION_COMPLETA", text: "Pensión completa" },
        { value: "TODO_INCLUIDO", text: "Todo incluido" },
        { value: "__write__", text: "Escribir nuevo..." },
      ],
      { firstText: "(Seleccionar)", firstValue: "" }
    );

    addOptions(
      document.getElementById("aloj-categoria-hotel"),
      [
        { value: "H3_ECONOMICO", text: "3* Económico" },
        { value: "H3_SUPERIOR", text: "3* Superior" },
        { value: "H4_ECONOMICO", text: "4* Económico" },
        { value: "H4_SUPERIOR", text: "4* Superior" },
        { value: "H5_ECONOMICO", text: "5* Económico" },
        { value: "H5_SUPERIOR", text: "5* Superior" },
        { value: "LUJO_ECONOMICO", text: "Lujo Económico" },
        { value: "LUJO_SUPERIOR", text: "Lujo Superior" },
        { value: "__write__", text: "Escribir nuevo..." },
      ],
      { firstText: "(Seleccionar)", firstValue: "" }
    );

    addOptions(
      document.getElementById("aloj-categoria-hab"),
      [
        { value: "ESTANDAR", text: "Estándar" },
        { value: "SUPERIOR", text: "Superior" },
        { value: "SUITE", text: "Suite" },
        { value: "__write__", text: "Escribir nuevo..." },
      ],
      { firstText: "(Seleccionar)", firstValue: "" }
    );

    initSelectConEscribirNuevo(document.getElementById("aloj-regimen"), document.getElementById("aloj-regimen-txt"));
    initSelectConEscribirNuevo(
      document.getElementById("aloj-categoria-hotel"),
      document.getElementById("aloj-categoria-hotel-txt")
    );
    initSelectConEscribirNuevo(
      document.getElementById("aloj-categoria-hab"),
      document.getElementById("aloj-categoria-hab-txt")
    );

    // ===== BOLETO =====
    addOptions(
      document.getElementById("be-tipo-entrada"),
      [
        { value: "ESTANDAR", text: "Estándar" },
        { value: "VIP", text: "VIP" },
        { value: "FAST_TRACK", text: "Fast track" },
        { value: "__write__", text: "Escribir nuevo..." },
      ],
      { firstText: "(Seleccionar tipo)", firstValue: "" }
    );
    initSelectConEscribirNuevo(
      document.getElementById("be-tipo-entrada"),
      document.getElementById("be-tipo-entrada-txt")
    );

    await initOtroCatalogo({
      grupoCatalogo: "boleto_lugar",
      selectCatalogoEl: document.getElementById("be-lugar-select"),
      inputTextoEl: document.getElementById("be-lugar-txt"),
    });

    await fillSelectCatalogoConEscribir(
      document.getElementById("be-idioma"),
      document.getElementById("be-idioma-txt"),
      "idiomas",
      { firstText: "(Seleccionar idioma)", firstValue: "" }
    );

    addOptions(
      document.getElementById("be-tipo-guia"),
      [
        { value: "GUIA", text: "Guía" },
        { value: "AUDIOGUIA", text: "Audioguía" },
        { value: "NINGUNO", text: "Ninguno" },
        { value: "__write__", text: "Escribir nuevo..." },
      ],
      { firstText: "(Seleccionar)", firstValue: "" }
    );
    initSelectConEscribirNuevo(document.getElementById("be-tipo-guia"), document.getElementById("be-tipo-guia-txt"));

    // ===== VUELO =====
    await fillSelectCatalogoConEscribir(
      document.getElementById("vu-origen"),
      document.getElementById("vu-origen-txt"),
      "vuelo_origen",
      { firstText: "(Seleccionar)", firstValue: "" }
    );

    await fillSelectFromCatalog(document.getElementById("vu-destino"), "vuelo_destino", {
      firstText: "(Seleccionar)",
      firstValue: "",
    });

    await fillSelectFromCatalog(document.getElementById("vu-clase"), "vuelo_clase", {
      firstText: "(Seleccionar)",
      firstValue: "",
    });

    await fillSelectFromCatalog(document.getElementById("vu-equipaje"), "vuelo_equipaje", {
      firstText: "(Seleccionar)",
      firstValue: "",
    });

    const selVuEsc = document.getElementById("vu-escalas");
    if (selVuEsc) {
      addOptions(
        selVuEsc,
        [0, 1, 2, 3].map((n) => ({ value: String(n), text: String(n) })),
        { firstText: "(Seleccionar)", firstValue: "" }
      );
    }

    // ===== TREN =====
    await fillSelectCatalogoConEscribir(
      document.getElementById("tr-origen"),
      document.getElementById("tr-origen-txt"),
      "tren_origen",
      { firstText: "(Seleccionar)", firstValue: "" }
    );

    await fillSelectFromCatalog(document.getElementById("tr-destino"), "tren_destino", {
      firstText: "(Seleccionar)",
      firstValue: "",
    });

    await fillSelectFromCatalog(document.getElementById("tr-clase"), "tren_clase", {
      firstText: "(Seleccionar)",
      firstValue: "",
    });

    await fillSelectFromCatalog(document.getElementById("tr-equipaje"), "tren_equipaje", {
      firstText: "(Seleccionar)",
      firstValue: "",
    });

    const selTrEsc = document.getElementById("tr-escalas");
    if (selTrEsc) {
      addOptions(
        selTrEsc,
        [0, 1, 2, 3].map((n) => ({ value: String(n), text: String(n) })),
        { firstText: "(Seleccionar)", firstValue: "" }
      );
    }

    // ===== TRASLADO =====
    addOptions(
      document.getElementById("tr-tipo"),
      [
        { value: "AEROPUERTO_HOTEL", text: "Aeropuerto → Hotel" },
        { value: "HOTEL_AEROPUERTO", text: "Hotel → Aeropuerto" },
        { value: "ESTACION_HOTEL", text: "Estación → Hotel" },
        { value: "HOTEL_ESTACION", text: "Hotel → Estación" },
        { value: "PUERTO_HOTEL", text: "Puerto → Hotel" },
        { value: "HOTEL_PUERTO", text: "Hotel → Puerto" },
        { value: "HOTEL_HOTEL", text: "Hotel → Hotel" },
        { value: "__write__", text: "Escribir nuevo..." },
      ],
      { firstText: "(Seleccionar)", firstValue: "" }
    );
    initSelectConEscribirNuevo(document.getElementById("tr-tipo"), document.getElementById("tr-tipo-otro"));

    addOptions(
      document.getElementById("tr-vehiculo"),
      [
        { value: "SEDAN", text: "Sedán" },
        { value: "VAN", text: "Van" },
        { value: "MINIBUS", text: "Minibús" },
        { value: "BUS", text: "Bus" },
        { value: "__write__", text: "Escribir nuevo..." },
      ],
      { firstText: "(Seleccionar)", firstValue: "" }
    );
    initSelectConEscribirNuevo(document.getElementById("tr-vehiculo"), document.getElementById("tr-vehiculo-txt"));

    await initOtroCatalogo({
      grupoCatalogo: "traslado_origen",
      selectCatalogoEl: document.getElementById("tr-origen-select"),
      inputTextoEl: document.getElementById("tr-origen-txt"),
    });
    await initOtroCatalogo({
      grupoCatalogo: "traslado_destino",
      selectCatalogoEl: document.getElementById("tr-destino-select"),
      inputTextoEl: document.getElementById("tr-destino-txt"),
    });

    // ===== TOUR =====
    addOptions(
      document.getElementById("tu-tipo-guia"),
      [
        { value: "GUIA", text: "Guía" },
        { value: "AUDIOGUIA", text: "Audioguía" },
        { value: "CHOFER_GUIA", text: "Chofer-guía" },
        { value: "__write__", text: "Escribir nuevo..." },
      ],
      { firstText: "(Seleccionar)", firstValue: "" }
    );
    initSelectConEscribirNuevo(document.getElementById("tu-tipo-guia"), document.getElementById("tu-tipo-guia-otro"));

    await fillSelectCatalogoConEscribir(
      document.getElementById("tu-idioma"),
      document.getElementById("tu-idioma-txt"),
      "idiomas",
      { firstText: "(Seleccionar idioma)", firstValue: "" }
    );
  }

  async function renderCamposDinamicosPorTipo() {
    if (!contDinamico) return;
    await initMiniFormOnce();
    ocultarTodasLasSecciones();

    const opt = filtroTipoServicio?.options?.[filtroTipoServicio.selectedIndex];
    const tipoTexto = (opt?.textContent || "").toLowerCase();

    if (tipoTexto.includes("aloj")) return show(document.getElementById("sec-alojamiento"), true);
    if (tipoTexto.includes("boleto")) return show(document.getElementById("sec-boleto"), true);
    if (tipoTexto.includes("vuelo")) return show(document.getElementById("sec-vuelo"), true);
    if (tipoTexto.includes("tren")) return show(document.getElementById("sec-tren"), true);
    if (tipoTexto.includes("trasl")) return show(document.getElementById("sec-traslado"), true);
    if (tipoTexto.includes("excurs") || tipoTexto.includes("visita") || tipoTexto.includes("tour"))
      return show(document.getElementById("sec-tour"), true);
  }

  // ==========================
  // Guardar servicio rápido
  // ==========================
  btnGuardarSrv?.addEventListener("click", async () => {
    msgCrear("");

    const id_ciudad = filtroCiudad?.value;
    const id_tipo = filtroTipoServicio?.value;
    const prov = selProveedorNuevo?.value;

    if (!prov) return msgCrear("Selecciona un proveedor.");
    if (!id_ciudad) return msgCrear("Selecciona una ciudad.");
    if (!id_tipo) return msgCrear("Selecciona el tipo de servicio.");

    const tiempoServicioFinal = leerValorOtro({
      selectCatalogoEl: selTiempoServicio,
      inputTextoEl: txtTiempoServicio,
    });

    const payload = {
      id_tipo: Number(id_tipo),
      id_proveedor: Number(prov),
      id_ciudad: Number(id_ciudad),
      tiempo_servicio: tiempoServicioFinal || null,
      privado: selPrivado?.value === "1",
      descripcion: (inpDesc?.value || "").trim() || null,
      link_reserva: (inpLinkReserva?.value || "").trim() || null,
    };

    const tipoTexto = (filtroTipoServicio?.options?.[filtroTipoServicio.selectedIndex]?.textContent || "").toLowerCase();

    // ALOJAMIENTO
    if (tipoTexto.includes("aloj")) {
      const selReg = document.getElementById("aloj-regimen");
      const selCatHotel = document.getElementById("aloj-categoria-hotel");
      const selCatHab = document.getElementById("aloj-categoria-hab");

      const regVal = leerSelectOEscribir(selReg, document.getElementById("aloj-regimen-txt"));
      const catHotelVal = leerSelectOEscribir(selCatHotel, document.getElementById("aloj-categoria-hotel-txt"));
      const catHabVal = leerSelectOEscribir(selCatHab, document.getElementById("aloj-categoria-hab-txt"));

      payload.alojamiento = {
        noches: Number(document.getElementById("aloj-noches")?.value || 1),
        habitaciones: Number(document.getElementById("aloj-habitaciones")?.value || 1),

        regimen: selReg?.value === "__write__" ? "OTRO" : selReg?.value || null,
        regimen_otro: selReg?.value === "__write__" ? regVal : null,

        categoria_hotel: selCatHotel?.value === "__write__" ? "OTRO" : selCatHotel?.value || null,
        categoria_hotel_otro: selCatHotel?.value === "__write__" ? catHotelVal : null,

        categoria_hab: selCatHab?.value === "__write__" ? "OTRO" : selCatHab?.value || null,
        categoria_hab_otro: selCatHab?.value === "__write__" ? catHabVal : null,
      };
    }

    // BOLETO
    if (tipoTexto.includes("boleto")) {
      const tipoEntradaSel = document.getElementById("be-tipo-entrada");
      const tipoEntradaTxt = document.getElementById("be-tipo-entrada-txt");
      const tipoEntradaVal = leerSelectOEscribir(tipoEntradaSel, tipoEntradaTxt);

      const lugarFinal = leerValorOtro({
        selectCatalogoEl: document.getElementById("be-lugar-select"),
        inputTextoEl: document.getElementById("be-lugar-txt"),
      });

      const idiomaSel = document.getElementById("be-idioma");
      const idiomaTxt = document.getElementById("be-idioma-txt");
      const idiomaVal = leerSelectOEscribir(idiomaSel, idiomaTxt);

      const tipoGuiaSel = document.getElementById("be-tipo-guia");
      const tipoGuiaTxt = document.getElementById("be-tipo-guia-txt");
      const tipoGuiaVal = leerSelectOEscribir(tipoGuiaSel, tipoGuiaTxt);

      payload.boleto_entrada = {
        boleto_entrada: lugarFinal || null,
        tipo_entrada: tipoEntradaSel?.value === "__write__" ? "OTRA" : tipoEntradaSel?.value || null,
        tipo_entrada_otro: tipoEntradaSel?.value === "__write__" ? tipoEntradaVal : null,
        audioguia: tipoGuiaVal === "AUDIOGUIA",
        tipo_guia: tipoGuiaVal || null,
        idioma: idiomaVal || null,
      };
    }

    // TRASLADO
    if (tipoTexto.includes("trasl")) {
      const tipoSel = document.getElementById("tr-tipo");
      const tipoTxt = document.getElementById("tr-tipo-otro");
      const tipoFinal = leerSelectOEscribir(tipoSel, tipoTxt);

      const vehSel = document.getElementById("tr-vehiculo");
      const vehTxt = document.getElementById("tr-vehiculo-txt");
      const vehFinal = leerSelectOEscribir(vehSel, vehTxt);

      const origenFinal = leerValorOtro({
        selectCatalogoEl: document.getElementById("tr-origen-select"),
        inputTextoEl: document.getElementById("tr-origen-txt"),
      });
      const destinoFinal = leerValorOtro({
        selectCatalogoEl: document.getElementById("tr-destino-select"),
        inputTextoEl: document.getElementById("tr-destino-txt"),
      });

      payload.traslado = {
        origen: origenFinal || null,
        destino: destinoFinal || null,
        tipo_traslado: tipoSel?.value === "__write__" ? "OTRO" : tipoSel?.value || null,
        tipo_traslado_otro: tipoSel?.value === "__write__" ? tipoFinal : null,
        vehiculo: vehSel?.value === "__write__" ? "OTRO" : vehSel?.value || null,
        vehiculo_otro: vehSel?.value === "__write__" ? vehFinal : null,
        nota: document.getElementById("tr-nota")?.value?.trim() || null,
      };
    }

    // TOUR
    if (tipoTexto.includes("excurs") || tipoTexto.includes("visita") || tipoTexto.includes("tour")) {
      const tipoGuiaSel = document.getElementById("tu-tipo-guia");
      const tipoGuiaTxt = document.getElementById("tu-tipo-guia-otro");
      const tipoGuiaVal = leerSelectOEscribir(tipoGuiaSel, tipoGuiaTxt);

      const idiomaSel = document.getElementById("tu-idioma");
      const idiomaTxt = document.getElementById("tu-idioma-txt");
      const idiomaVal = leerSelectOEscribir(idiomaSel, idiomaTxt);

      payload.tour = {
        tipo_guia: tipoGuiaSel?.value === "__write__" ? "OTRO" : tipoGuiaSel?.value || null,
        tipo_guia_otro: tipoGuiaSel?.value === "__write__" ? tipoGuiaVal : null,
        idioma: idiomaSel?.value === "__write__" ? "OTRO" : idiomaSel?.value || null,
        idioma_otro: idiomaSel?.value === "__write__" ? idiomaVal : null,
      };
    }

    // VUELO
    if (tipoTexto.includes("vuelo")) {
      const origen = leerSelectOEscribir(document.getElementById("vu-origen"), document.getElementById("vu-origen-txt"));
      const destino = (document.getElementById("vu-destino")?.value || "").trim();
      const clase = (document.getElementById("vu-clase")?.value || "").trim();
      const equipaje = (document.getElementById("vu-equipaje")?.value || "").trim();
      const escalasSel = document.getElementById("vu-escalas");
      const escalasVal = (escalasSel?.value || "").trim();
      const n = Number(escalasVal);
      const escalasNum = Number.isFinite(n) ? n : 0;

      payload.vuelo = {
        origen: origen || "",
        destino: destino || "",
        escalas: escalasNum,
        clase: clase || "",
        equipaje: equipaje || "",
      };
    }

    // TREN
    if (tipoTexto.includes("tren")) {
      const origen = leerSelectOEscribir(document.getElementById("tr-origen"), document.getElementById("tr-origen-txt"));
      const destino = (document.getElementById("tr-destino")?.value || "").trim();
      const clase = (document.getElementById("tr-clase")?.value || "").trim();
      const equipaje = (document.getElementById("tr-equipaje")?.value || "").trim();
      const escalasSel = document.getElementById("tr-escalas");
      const escalasVal = (escalasSel?.value || "").trim();
      const n = Number(escalasVal);
      const escalasNum = Number.isFinite(n) ? n : 0;

      payload.tren = {
        origen: origen || "",
        destino: destino || "",
        escalas: escalasNum,
        clase: clase || "",
        equipaje: equipaje || null,
        sillas_reservadas: document.getElementById("tr-sillas")?.value === "1",
      };
    }

    try {
      const resp = await fetch("/api/servicios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok) throw new Error(data.mensaje || data.error || "Error creando servicio");

      await cargarTodosLosServicios();

      if (selectServicio) selectServicio.value = String(data.id_servicio);

      panelCrear.style.display = "none";
    } catch (e) {
      console.error(e);
      msgCrear(e.message);
    }
  });

  // ==========================
  // Cotización existente
  // ==========================
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

  // ==========================
  // Insertar servicio
  // ==========================
  btnInsertarServicio?.addEventListener("click", async () => {
    mostrarError("");

    if (!idCotizacion) return mostrarError("Falta el ID de cotización en la URL.");

    const fechaDesde = fechaDesdeInput?.value;
    const fechaHasta = fechaHastaInput?.value;
    const idServicioSeleccionado = selectServicio?.value;

    if (!idServicioSeleccionado) return mostrarError("Selecciona un servicio antes de insertarlo.");
    if (!fechaDesde) return mostrarError("Selecciona la fecha de servicio.");

    if (esTipoAlojamientoSeleccionado()) {
      if (!fechaHasta) return mostrarError("En alojamiento debes seleccionar también la fecha hasta (check-out).");

      const noches = calcularNoches(fechaDesde, fechaHasta);
      if (!Number.isFinite(noches) || noches < 1) {
        return mostrarError("La fecha hasta debe ser posterior a la fecha desde (mínimo 1 noche).");
      }
    }

    const esOpcional = chkOpcional && chkOpcional.checked ? 1 : 0;

    try {
      const resp = await fetch(`/api/cotizaciones/${idCotizacion}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_servicio: Number(idServicioSeleccionado),
          fecha_servicio: fechaDesde,
          es_opcional: esOpcional,
        }),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok) throw new Error(data.mensaje || data.error || "Error al insertar servicio.");

      // ✅ completa texto si backend no lo devuelve
      const row = data.item || {};
      if (!row.servicio_texto) {
        const idSrvKey = String(row.id_servicio || idServicioSeleccionado);
        if (servicioTextoById.has(idSrvKey)) row.servicio_texto = servicioTextoById.get(idSrvKey);
      }

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

  // ==========================
  // Init
  // ==========================
  (async () => {
    await cargarContinentes();
    await cargarTiposServicio();
    await cargarTodosLosServicios(); // ✅ llena servicioTextoById antes de cargar cotización
    await cargarProveedores();
    await cargarCotizacionExistente();
    actualizarVisibilidadFechaHasta();
    actualizarNochesYFiltrarServicios();

    if (inpNombreAutoPreview) {
      inpNombreAutoPreview.value = "Se genera automáticamente al guardar";
    }
  })();
});
