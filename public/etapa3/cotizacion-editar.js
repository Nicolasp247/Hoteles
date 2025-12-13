// public/etapa3/cotizacion-editar.js

document.addEventListener("DOMContentLoaded", () => {
  // ====== ID de cotización desde la URL ======
  const params = new URLSearchParams(window.location.search);
  const idCotizacion = params.get("id");

  const headerIdEl = document.getElementById("header-id");
  if (headerIdEl) headerIdEl.textContent = idCotizacion ? `#${idCotizacion}` : "(sin id)";

  // ====== Referencias a elementos ======
  const filtroContinente   = document.getElementById("filtro-continente");
  const filtroPais         = document.getElementById("filtro-pais");
  const filtroCiudad       = document.getElementById("filtro-ciudad");
  const filtroTipoServicio = document.getElementById("filtro-tipo-servicio");

  const wrapperFechaHasta  = document.getElementById("wrapper-fecha-hasta");
  const fechaDesdeInput    = document.getElementById("fecha-desde");
  const fechaHastaInput    = document.getElementById("fecha-hasta"); // (por ahora solo UI)

  const selectServicio     = document.getElementById("select-servicio");
  const chkOpcional        = document.getElementById("chk-opcional");

  const tablaBody          = document.getElementById("tabla-servicios-body");
  const totalUsdInput      = document.getElementById("total-usd");

  const btnInsertarServicio= document.getElementById("btn-insertar-servicio");
  const btnCrearServicio   = document.getElementById("btn-crear-servicio");
  const mensajeErrorEl     = document.getElementById("mensaje-error");

  // ====== Mini-form: refs ======
  const btnToggleCrearServicio = document.getElementById("btn-toggle-crear-servicio");
  const panelCrearServicio     = document.getElementById("panel-crear-servicio");
  const msgCrearServicioEl     = document.getElementById("msg-crear-servicio");

  const nuevoIdProveedorEl     = document.getElementById("nuevo-id-proveedor");
  const nuevoLinkReservaEl     = document.getElementById("nuevo-link-reserva");
  const nuevoNombreWtravelEl   = document.getElementById("nuevo-nombre-wtravel");
  const nuevoTiempoServicioEl  = document.getElementById("nuevo-tiempo-servicio");
  const nuevoPrivadoEl         = document.getElementById("nuevo-privado");
  const nuevoDescripcionEl     = document.getElementById("nuevo-descripcion");

  const nuevoCamposDinamicosEl = document.getElementById("nuevo-campos-dinamicos");
  const btnGuardarServicioRapido = document.getElementById("btn-guardar-servicio-rapido");
  const btnCancelarServicioRapido = document.getElementById("btn-cancelar-servicio-rapido");

  // ====== Estado en memoria ======
  let items        = [];   // líneas de la cotización (ya transformadas)
  let allServicios = [];   // todos los servicios (desde /api/servicios)
  let servicios    = [];   // servicios filtrados para el <select>
  let nextIdLocal  = 1;

  // tipos y proveedores para mini-form
  let tiposServicioCache = [];     // [{id,nombre}]
  let proveedoresCache = [];       // [{id,nombre,iniciales}]

  // ====== Helpers generales ======
  function mostrarError(msg) {
    if (mensajeErrorEl) mensajeErrorEl.textContent = msg || "";
  }

  function mostrarErrorCrearServicio(msg) {
    if (msgCrearServicioEl) msgCrearServicioEl.textContent = msg || "";
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
    if (esTipoSinPrecio(tipo)) {
      precio = null;
    }

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

  // ====== Tabla de servicios incluidos ======
  function actualizarTablaDesdeEstado() {
    tablaBody.innerHTML = "";

    let ultimaCiudadCabecera = null;

    items.forEach((it, idx) => {
      // Cabecera de ciudad antes de alojamientos
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

      // Columna 1: cambiar orden (↑ ↓)
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

      // Columna 2: índice
      const colIndice = document.createElement("td");
      colIndice.classList.add("celda-indice");
      colIndice.textContent = idx + 1;

      // Columna 3: fecha
      const colFecha = document.createElement("td");
      colFecha.textContent = it.fecha || "";

      // Columna 4: servicio
      const colServicio = document.createElement("td");
      colServicio.textContent = it.servicioTexto || "";

      // Columna 5: precio
      const colPrecio = document.createElement("td");
      if (it.precio != null && it.precio !== "") {
        const num = Number(it.precio);
        colPrecio.textContent = Number.isNaN(num) ? String(it.precio) : num.toFixed(2);
      } else {
        colPrecio.textContent = "-";
      }

      // Columna 6: eliminar
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

  function moverItem(idx, delta) {
    const newIndex = idx + delta;
    if (newIndex < 0 || newIndex >= items.length) return;
    const tmp = items[idx];
    items[idx] = items[newIndex];
    items[newIndex] = tmp;
    actualizarTablaDesdeEstado();
  }

  async function eliminarItem(it, index) {
    const seguro = window.confirm("¿Eliminar este servicio de la cotización?");
    if (!seguro) return;

    try {
      const resp = await fetch(`/api/cotizaciones/items/${it.id_item}`, {
        method: "DELETE"
      });
      const data = await resp.json();
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
      const resp = await fetch("/api/continentes");
      const data = await resp.json(); // array [{id, nombre}, ...]
      if (!Array.isArray(data)) return;

      filtroContinente.innerHTML = "";
      const opt0 = document.createElement("option");
      opt0.value = "";
      opt0.textContent = "(Todos los continentes)";
      filtroContinente.appendChild(opt0);

      data.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.nombre;
        filtroContinente.appendChild(opt);
      });
    } catch (err) {
      console.error("Error cargando continentes", err);
      mostrarError("No se pudieron cargar los continentes.");
    }
  }

  async function cargarPaises(idContinente) {
    try {
      if (!idContinente) {
        filtroPais.innerHTML   = "<option value=''> (Todos los países) </option>";
        filtroCiudad.innerHTML = "<option value=''> (Todas las ciudades) </option>";
        return;
      }

      const resp = await fetch(`/api/paises/${idContinente}`);
      const data = await resp.json();
      filtroPais.innerHTML = "";
      const opt0 = document.createElement("option");
      opt0.value = "";
      opt0.textContent = "(Todos los países)";
      filtroPais.appendChild(opt0);

      data.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.nombre;
        filtroPais.appendChild(opt);
      });

      filtroCiudad.innerHTML = "<option value=''> (Todas las ciudades) </option>";
    } catch (err) {
      console.error("Error cargando países", err);
      mostrarError("No se pudieron cargar los países.");
    }
  }

  async function cargarCiudades(idPais) {
    try {
      if (!idPais) {
        filtroCiudad.innerHTML = "<option value=''> (Todas las ciudades) </option>";
        return;
      }

      const resp = await fetch(`/api/ciudades/${idPais}`);
      const data = await resp.json();
      filtroCiudad.innerHTML = "";
      const opt0 = document.createElement("option");
      opt0.value = "";
      opt0.textContent = "(Todas las ciudades)";
      filtroCiudad.appendChild(opt0);

      data.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.nombre;
        filtroCiudad.appendChild(opt);
      });
    } catch (err) {
      console.error("Error cargando ciudades", err);
      mostrarError("No se pudieron cargar las ciudades.");
    }
  }

  filtroContinente.addEventListener("change", async () => {
    const idCont = filtroContinente.value || null;
    await cargarPaises(idCont);
    filtrarServicios();
  });

  filtroPais.addEventListener("change", async () => {
    const idPais = filtroPais.value || null;
    await cargarCiudades(idPais);
    filtrarServicios();
  });

  filtroCiudad.addEventListener("change", () => {
    filtrarServicios();
  });

  // ==============================
  //   BLOQUE 2: Tipos de servicio
  // ==============================
  async function cargarTiposServicio() {
    try {
      const resp = await fetch("/api/tipos-servicio");
      const data = await resp.json(); // array [{id,nombre}]
      if (!Array.isArray(data)) return;

      tiposServicioCache = data;

      filtroTipoServicio.innerHTML = "";
      const opt0 = document.createElement("option");
      opt0.value = "";
      opt0.textContent = "(Todos los tipos)";
      filtroTipoServicio.appendChild(opt0);

      data.forEach((t) => {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = t.nombre;
        filtroTipoServicio.appendChild(opt);
      });
    } catch (err) {
      console.error("Error cargando tipos de servicio", err);
      mostrarError("No se pudieron cargar los tipos de servicio.");
    }
  }

  function esTipoAlojamientoSeleccionado() {
    const opt = filtroTipoServicio.options[filtroTipoServicio.selectedIndex];
    if (!opt) return false;
    const texto = (opt.textContent || "").toLowerCase();
    return texto.includes("aloj");
  }

  function actualizarVisibilidadFechaHasta() {
    if (esTipoAlojamientoSeleccionado()) {
      wrapperFechaHasta.style.display = "";
    } else {
      wrapperFechaHasta.style.display = "none";
      fechaHastaInput.value = "";
    }
  }

  filtroTipoServicio.addEventListener("change", () => {
    actualizarVisibilidadFechaHasta();
    filtrarServicios();

    // si el panel está abierto, actualizamos campos dinámicos al vuelo
    if (panelCrearServicio && panelCrearServicio.style.display !== "none") {
      renderCamposDinamicosSegunTipo();
    }
  });

  // ==============================
  //   BLOQUE 3: Servicios (para selector)
  // ==============================
  async function cargarTodosLosServicios() {
    try {
      const resp = await fetch("/api/servicios");
      const data = await resp.json();
      if (!Array.isArray(data)) return;
      allServicios = data;
      filtrarServicios();
    } catch (err) {
      console.error("Error cargando servicios", err);
      mostrarError("No se pudieron cargar los servicios.");
    }
  }

  function filtrarServicios() {
    const idCont  = filtroContinente.value || null;
    const idPais  = filtroPais.value || null;
    const idCiud  = filtroCiudad.value || null;
    const idTipo  = filtroTipoServicio.value || null;

    servicios = allServicios.filter((s) => {
      if (idCont && String(s.id_continente ?? "") !== idCont) return false;
      if (idPais && String(s.id_pais ?? "") !== idPais)       return false;
      if (idCiud && String(s.id_ciudad ?? "") !== idCiud)     return false;
      if (idTipo && String(s.id_tipo ?? "") !== idTipo)       return false;
      return true;
    });

    rellenarSelectServicios();
  }

  function rellenarSelectServicios() {
    selectServicio.innerHTML = "";
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "(Seleccionar servicio)";
    selectServicio.appendChild(opt0);

    servicios.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.nombre_wtravel || `Servicio #${s.id}`;
      selectServicio.appendChild(opt);
    });
  }

  // ==============================
  //   BLOQUE 4: Items de cotización
  // ==============================
  async function cargarCotizacionExistente() {
    if (!idCotizacion) return;
    try {
      const resp = await fetch(`/api/cotizaciones/${idCotizacion}`);
      const data = await resp.json();
      if (!data.ok) return;

      const lista = data.items || [];
      nextIdLocal = 1;
      items = lista.map((row) => mapRowToItem(row));
      actualizarTablaDesdeEstado();
    } catch (err) {
      console.error("Error cargando cotización existente", err);
    }
  }

  btnInsertarServicio.addEventListener("click", async () => {
    mostrarError("");

    if (!idCotizacion) {
      mostrarError("Falta el ID de cotización en la URL.");
      return;
    }

    const fechaDesde = fechaDesdeInput.value;
    const idServicioSeleccionado = selectServicio.value;

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

      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        throw new Error(data.mensaje || data.error || "Error al insertar servicio.");
      }

      const row = data.item;
      const nuevoItem = mapRowToItem(row);
      items.push(nuevoItem);
      actualizarTablaDesdeEstado();
    } catch (err) {
      console.error(err);
      mostrarError("No se pudo insertar el servicio: " + err.message);
    }
  });

  // ==============================
  //   MINI-FORM: Proveedores + panel
  // ==============================
  async function cargarProveedores() {
    try {
      const resp = await fetch("/api/proveedores");
      const data = await resp.json();
      if (!data.ok || !Array.isArray(data.proveedores)) {
        throw new Error(data.mensaje || "Respuesta inválida de /api/proveedores");
      }
      proveedoresCache = data.proveedores;

      nuevoIdProveedorEl.innerHTML = "";
      const opt0 = document.createElement("option");
      opt0.value = "";
      opt0.textContent = "(Seleccionar proveedor)";
      nuevoIdProveedorEl.appendChild(opt0);

      proveedoresCache.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${p.nombre} (${p.iniciales})`;
        nuevoIdProveedorEl.appendChild(opt);
      });
    } catch (err) {
      console.error(err);
      mostrarErrorCrearServicio("No se pudieron cargar los proveedores.");
    }
  }

  function abrirPanelCrearServicio() {
    if (!panelCrearServicio) return;

    mostrarErrorCrearServicio("");
    panelCrearServicio.style.display = "";

    // si proveedores no están cargados, los cargamos
    if (!proveedoresCache.length) {
      cargarProveedores();
    }

    // cada vez que abres, armamos campos dinámicos según tipo actual
    renderCamposDinamicosSegunTipo();
  }

  function cerrarPanelCrearServicio() {
    if (!panelCrearServicio) return;
    panelCrearServicio.style.display = "none";
    limpiarMiniForm();
  }

  function togglePanelCrearServicio() {
    if (!panelCrearServicio) return;
    const abierto = panelCrearServicio.style.display !== "none";
    if (abierto) cerrarPanelCrearServicio();
    else abrirPanelCrearServicio();
  }

  function limpiarMiniForm() {
    if (nuevoIdProveedorEl) nuevoIdProveedorEl.value = "";
    if (nuevoLinkReservaEl) nuevoLinkReservaEl.value = "";
    if (nuevoNombreWtravelEl) nuevoNombreWtravelEl.value = "";
    if (nuevoTiempoServicioEl) nuevoTiempoServicioEl.value = "";
    if (nuevoPrivadoEl) nuevoPrivadoEl.value = "0";
    if (nuevoDescripcionEl) nuevoDescripcionEl.value = "";
    if (nuevoCamposDinamicosEl) nuevoCamposDinamicosEl.innerHTML = "";
    mostrarErrorCrearServicio("");
  }

  // Este botón abre/cierra el panel
  if (btnToggleCrearServicio) {
    btnToggleCrearServicio.addEventListener("click", togglePanelCrearServicio);
  }

  // También el botón de abajo "Crear servicio" abre el panel
  if (btnCrearServicio) {
    btnCrearServicio.addEventListener("click", togglePanelCrearServicio);
  }

  if (btnCancelarServicioRapido) {
    btnCancelarServicioRapido.addEventListener("click", cerrarPanelCrearServicio);
  }

  // ==============================
  //   MINI-FORM: campos dinámicos según tipo
  // ==============================
  function getNombreTipoSeleccionado() {
    const opt = filtroTipoServicio?.options?.[filtroTipoServicio.selectedIndex];
    return opt ? (opt.textContent || "").trim() : "";
  }

  function renderCamposDinamicosSegunTipo() {
    if (!nuevoCamposDinamicosEl) return;

    const nombreTipo = getNombreTipoSeleccionado().toLowerCase();

    // Si no hay tipo seleccionado, pedimos que lo seleccione
    if (!filtroTipoServicio.value) {
      nuevoCamposDinamicosEl.innerHTML = `
        <p class="mensaje-error">
          Selecciona primero el <b>Tipo de servicio</b> arriba para poder crear el servicio rápido.
        </p>
      `;
      return;
    }

    // Helpers para armar inputs
    const input = (id, label, placeholder = "", type = "text") => `
      <label>${label}<br/>
        <input type="${type}" id="${id}" placeholder="${placeholder}" />
      </label>
    `;

    const number = (id, label, min = 0, step = 1) => `
      <label>${label}<br/>
        <input type="number" id="${id}" min="${min}" step="${step}" />
      </label>
    `;

    const select = (id, label, optionsHtml) => `
      <label>${label}<br/>
        <select id="${id}">${optionsHtml}</select>
      </label>
    `;

    // Alojamiento
    if (nombreTipo.includes("aloj")) {
      nuevoCamposDinamicosEl.innerHTML = `
        <h4>Datos de alojamiento</h4>
        <div class="grid-2">
          ${number("aloja-noches", "Noches", 1, 1)}
          ${number("aloja-habitaciones", "Habitaciones", 1, 1)}

          ${select("aloja-regimen", "Régimen", `
            <option value="">(Seleccionar)</option>
            <option value="SOLO_ALOJAMIENTO">Solo alojamiento</option>
            <option value="ALOJAMIENTO_DESAYUNO">Alojamiento y desayuno</option>
            <option value="TODO_INCLUIDO">Todo incluido</option>
          `)}

          ${input("aloja-proveedor-hotel", "Proveedor hotel (código)", "Ej: AEI")}
          
          ${select("aloja-categoria-hotel", "Categoría hotel", `
            <option value="">(Seleccionar)</option>
            <option value="3_ECONOMICO">3★ Económico</option>
            <option value="3_SUPERIOR">3★ Superior</option>
            <option value="4_ECONOMICO">4★ Económico</option>
            <option value="4_SUPERIOR">4★ Superior</option>
            <option value="5_ECONOMICO">5★ Económico</option>
            <option value="5_SUPERIOR">5★ Superior</option>
            <option value="LUJO_ECONOMICO">Lujo Económico</option>
            <option value="LUJO_SUPERIOR">Lujo Superior</option>
          `)}

          ${select("aloja-categoria-hab", "Categoría habitación", `
            <option value="">(Seleccionar)</option>
            <option value="ESTANDAR">Estándar</option>
            <option value="SUPERIOR">Superior</option>
            <option value="SUITE">Suite</option>
            <option value="OTRO">Otro (especificar)</option>
          `)}

          <label id="wrap-aloja-categoria-hab-otro" style="display:none;">
            ¿Cuál?<br/>
            <input type="text" id="aloja-categoria-hab-otro" placeholder="Ej: Deluxe King, Junior Suite..." />
          </label>
        </div>
      `;

      // lógica "otro"
      setTimeout(() => {
        const sel = document.getElementById("aloja-categoria-hab");
        const wrap = document.getElementById("wrap-aloja-categoria-hab-otro");
        if (sel && wrap) {
          sel.addEventListener("change", () => {
            wrap.style.display = sel.value === "OTRO" ? "" : "none";
          });
        }
      }, 0);

      return;
    }

    // Boleto de entrada
    if (nombreTipo.includes("boleto")) {
      nuevoCamposDinamicosEl.innerHTML = `
        <h4>Datos de boleto de entrada</h4>
        <div class="grid-2">
          ${input("be-lugar", "Lugar", "Ej: Museo Louvre")}
          ${input("be-tipo-entrada", "Tipo de entrada", "Ej: Estándar, VIP")}
          ${select("be-audioguia", "Audioguía", `
            <option value="0">No</option>
            <option value="1">Sí</option>
          `)}
          ${input("be-idioma", "Idioma", "Ej: español")}
        </div>
      `;
      return;
    }

    // Vuelo
    if (nombreTipo.includes("vuelo")) {
      nuevoCamposDinamicosEl.innerHTML = `
        <h4>Datos de vuelo</h4>
        <div class="grid-2">
          ${input("vu-origen", "Origen", "Ej: Bogotá")}
          ${input("vu-destino", "Destino", "Ej: Madrid")}
          ${number("vu-escalas", "Escalas (#)", 0, 1)}
          ${input("vu-clase", "Clase", "Ej: Económica, Business")}
          ${input("vu-equipaje", "Equipaje", "Ej: 23kg+10kg+6kg")}
        </div>
        <p style="opacity:.8;margin-top:6px;">
          Nota: “asientos reservados” lo manejamos por ahora solo en Tren (si luego lo quieres en Vuelo, se agrega fácil).
        </p>
      `;
      return;
    }

    // Tren
    if (nombreTipo.includes("tren")) {
      nuevoCamposDinamicosEl.innerHTML = `
        <h4>Datos de tren</h4>
        <div class="grid-2">
          ${input("tr-origen", "Origen", "Ej: Madrid")}
          ${input("tr-destino", "Destino", "Ej: Barcelona")}
          ${number("tr-escalas", "Escalas (#)", 0, 1)}
          ${input("tr-clase", "Clase", "Ej: Económica, Primera")}
          ${input("tr-equipaje", "Equipaje", "Ej: 10kg+6kg")}
          ${select("tr-sillas", "Asientos reservados", `
            <option value="0">No</option>
            <option value="1">Sí</option>
          `)}
        </div>
      `;
      return;
    }

    // Traslado (simple)
    if (nombreTipo.includes("traslado")) {
      nuevoCamposDinamicosEl.innerHTML = `
        <h4>Datos de traslado</h4>
        <p style="opacity:.8;margin-top:-6px;">
          Por ahora el texto final lo armamos con <b>Nombre WTravel</b> + descripción.
          Si luego quieres subtabla “traslado”, lo conectamos.
        </p>
        <div class="grid-2">
          ${input("tras-origen", "Origen", "Ej: Hotel en Barcelona")}
          ${input("tras-destino", "Destino", "Ej: Aeropuerto")}
        </div>
      `;
      return;
    }

    // Visita / Excursión (simple)
    if (nombreTipo.includes("visita") || nombreTipo.includes("excurs")) {
      nuevoCamposDinamicosEl.innerHTML = `
        <h4>Datos de ${getNombreTipoSeleccionado()}</h4>
        <p style="opacity:.8;margin-top:-6px;">
          En esta primera versión: usa <b>Tiempo del servicio</b> y <b>Descripción</b> para dejarlo perfecto.
          Después, si quieres, lo normalizamos en subtabla.
        </p>
        <div class="grid-2">
          ${input("vx-idioma", "Idioma", "Ej: español")}
          ${select("vx-tipo-guia", "Guía / Audioguía", `
            <option value="">(Opcional)</option>
            <option value="GUIA">Guía</option>
            <option value="AUDIOGUIA">Audioguía</option>
          `)}
        </div>
      `;
      return;
    }

    // Default
    nuevoCamposDinamicosEl.innerHTML = `
      <p style="opacity:.8;">
        No hay campos especiales para este tipo. Con los campos comunes arriba es suficiente.
      </p>
    `;
  }

  // ==============================
  //   MINI-FORM: Guardar servicio
  // ==============================
  function validarMiniFormBase() {
    if (!filtroTipoServicio.value) return "Selecciona el tipo de servicio arriba.";
    if (!filtroCiudad.value) return "Selecciona la ciudad arriba.";
    if (!nuevoIdProveedorEl.value) return "Selecciona un proveedor.";
    if (!nuevoNombreWtravelEl.value.trim()) return "Escribe el Nombre WTravel.";
    return null;
  }

  function buildPayloadServicio() {
    const id_tipo = Number(filtroTipoServicio.value);
    const id_ciudad = Number(filtroCiudad.value);

    const payload = {
      id_tipo,
      id_proveedor: Number(nuevoIdProveedorEl.value),
      id_ciudad,
      nombre_wtravel: nuevoNombreWtravelEl.value.trim(),
      tiempo_servicio: nuevoTiempoServicioEl.value ? nuevoTiempoServicioEl.value.trim() : null,
      privado: nuevoPrivadoEl.value === "1",
      descripcion: nuevoDescripcionEl.value ? nuevoDescripcionEl.value.trim() : null,
      link_reserva: nuevoLinkReservaEl.value ? nuevoLinkReservaEl.value.trim() : null
    };

    const nombreTipo = getNombreTipoSeleccionado().toLowerCase();

    // Alojamiento
    if (nombreTipo.includes("aloj")) {
      const categoriaHabSel = document.getElementById("aloja-categoria-hab");
      let categoriaHab = categoriaHabSel ? categoriaHabSel.value : null;
      if (categoriaHab === "OTRO") {
        const otro = document.getElementById("aloja-categoria-hab-otro");
        categoriaHab = otro && otro.value.trim() ? otro.value.trim() : "OTRO";
      }

      payload.alojamiento = {
        noches: Number(document.getElementById("aloja-noches")?.value || 1),
        habitaciones: Number(document.getElementById("aloja-habitaciones")?.value || 1),
        regimen: document.getElementById("aloja-regimen")?.value || null,
        categoria_hotel: document.getElementById("aloja-categoria-hotel")?.value || null,
        categoria_hab: categoriaHab || null,
        proveedor_hotel: document.getElementById("aloja-proveedor-hotel")?.value?.trim() || null
      };
    }

    // Boleto entrada
    if (nombreTipo.includes("boleto")) {
      payload.boleto_entrada = {
        nombre_lugar: document.getElementById("be-lugar")?.value?.trim() || null,
        tipo_entrada: document.getElementById("be-tipo-entrada")?.value?.trim() || null,
        audioguia: (document.getElementById("be-audioguia")?.value === "1"),
        idioma: document.getElementById("be-idioma")?.value?.trim() || null
      };
    }

    // Vuelo
    if (nombreTipo.includes("vuelo")) {
      payload.vuelo = {
        origen: document.getElementById("vu-origen")?.value?.trim() || "",
        destino: document.getElementById("vu-destino")?.value?.trim() || "",
        escalas: Number(document.getElementById("vu-escalas")?.value || 0),
        clase: document.getElementById("vu-clase")?.value?.trim() || null,
        equipaje: document.getElementById("vu-equipaje")?.value?.trim() || null
      };
    }

    // Tren
    if (nombreTipo.includes("tren")) {
      payload.tren = {
        origen: document.getElementById("tr-origen")?.value?.trim() || "",
        destino: document.getElementById("tr-destino")?.value?.trim() || "",
        escalas: Number(document.getElementById("tr-escalas")?.value || 0),
        clase: document.getElementById("tr-clase")?.value?.trim() || null,
        equipaje: document.getElementById("tr-equipaje")?.value?.trim() || null,
        sillas_reservadas: (document.getElementById("tr-sillas")?.value === "1")
      };
    }

    // Traslado/Visita/Excursión:
    // En esta versión lo dejamos en nombre/descripcion/tiempo y no subtabla.
    // Si luego lo quieres 100% estructurado, lo hacemos con tabla propia.

    return payload;
  }

  async function guardarServicioRapido() {
    mostrarErrorCrearServicio("");

    const err = validarMiniFormBase();
    if (err) {
      mostrarErrorCrearServicio(err);
      return;
    }

    // Validaciones extra rápidas por subtipo
    const nombreTipo = getNombreTipoSeleccionado().toLowerCase();
    if (nombreTipo.includes("vuelo")) {
      const o = document.getElementById("vu-origen")?.value?.trim();
      const d = document.getElementById("vu-destino")?.value?.trim();
      if (!o || !d) return mostrarErrorCrearServicio("En Vuelo: origen y destino son obligatorios.");
    }
    if (nombreTipo.includes("tren")) {
      const o = document.getElementById("tr-origen")?.value?.trim();
      const d = document.getElementById("tr-destino")?.value?.trim();
      if (!o || !d) return mostrarErrorCrearServicio("En Tren: origen y destino son obligatorios.");
    }

    const payload = buildPayloadServicio();

    try {
      btnGuardarServicioRapido.disabled = true;
      btnGuardarServicioRapido.textContent = "Guardando...";

      const resp = await fetch("/api/servicios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        throw new Error(data.mensaje || data.error || "Error creando servicio.");
      }

      const nuevoId = data.id_servicio;

      // refrescamos servicios, filtramos y seleccionamos el nuevo
      await cargarTodosLosServicios();
      filtrarServicios();
      selectServicio.value = String(nuevoId);

      // cerramos panel
      cerrarPanelCrearServicio();

    } catch (e) {
      console.error(e);
      mostrarErrorCrearServicio("No se pudo crear el servicio: " + e.message);
    } finally {
      btnGuardarServicioRapido.disabled = false;
      btnGuardarServicioRapido.textContent = "Guardar servicio";
    }
  }

  if (btnGuardarServicioRapido) {
    btnGuardarServicioRapido.addEventListener("click", guardarServicioRapido);
  }

  // ==============================
  //   INICIALIZACIÓN
  // ==============================
  (async () => {
    await cargarContinentes();
    await cargarTiposServicio();
    await cargarTodosLosServicios();
    await cargarCotizacionExistente();
    actualizarVisibilidadFechaHasta();
  })();
});
