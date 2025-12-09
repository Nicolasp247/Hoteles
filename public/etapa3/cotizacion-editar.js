// public/etapa3/cotizacion-editar.js

document.addEventListener("DOMContentLoaded", () => {
  // ====== ID de cotización desde la URL ======
  const params = new URLSearchParams(window.location.search);
  const idCotizacion = params.get("id");
  const headerIdEl   = document.getElementById("header-id");
  if (headerIdEl) headerIdEl.textContent = idCotizacion ? `#${idCotizacion}` : "(sin id)";

  // ====== Referencias a elementos ======
  const filtroContinente   = document.getElementById("filtro-continente");
  const filtroPais         = document.getElementById("filtro-pais");
  const filtroCiudad       = document.getElementById("filtro-ciudad");
  const filtroTipoServicio = document.getElementById("filtro-tipo-servicio");

  const wrapperFechaHasta  = document.getElementById("wrapper-fecha-hasta");
  const fechaDesdeInput    = document.getElementById("fecha-desde");
  const fechaHastaInput    = document.getElementById("fecha-hasta");

  const selectServicio     = document.getElementById("select-servicio");
  const chkOpcional        = document.getElementById("chk-opcional");

  const tablaBody          = document.getElementById("tabla-servicios-body");
  const totalUsdInput      = document.getElementById("total-usd");

  const btnInsertarServicio= document.getElementById("btn-insertar-servicio");
  const btnCrearServicio   = document.getElementById("btn-crear-servicio");
  const mensajeErrorEl     = document.getElementById("mensaje-error");

  // ====== Estado en memoria ======
  let items        = [];   // líneas de la cotización (ya transformadas)
  let allServicios = [];   // todos los servicios (desde /api/servicios)
  let servicios    = [];   // servicios filtrados para el <select>
  let nextIdLocal  = 1;

  // ====== Helpers generales ======
  function mostrarError(msg) {
    if (mensajeErrorEl) mensajeErrorEl.textContent = msg || "";
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
    if (!ymd) return new Date(NaN);
    const [y, m, d] = ymd.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function sumarDiasYmd(ymd, dias) {
    const d = parseYMD(ymd);
    d.setDate(d.getDate() + dias);
    const y   = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return `${y}-${mes}-${dia}`;
  }

  // Reglas de formato:
  // - mismo mes:  12 – 15 de diciembre de 2025
  // - distinto mes mismo año: 25 de enero a 02 de febrero de 2026
  // - distinto año: 25 de diciembre de 2026 a 08 de enero de 2027
  function formatoRangoAlojamiento(desdeYmd, hastaYmd) {
    const d1 = parseYMD(desdeYmd);
    const d2 = parseYMD(hastaYmd);

    const dia1  = d1.getDate();                     // sin pad para el primer día
    const dia2  = String(d2.getDate()).padStart(2, "0");
    const mes1  = MESES[d1.getMonth()];
    const mes2  = MESES[d2.getMonth()];
    const anio1 = d1.getFullYear();
    const anio2 = d2.getFullYear();

    if (anio1 === anio2 && mes1 === mes2) {
      // 12 – 15 de diciembre de 2025
      return `${dia1} – ${dia2} de ${mes1} de ${anio1}`;
    } else if (anio1 === anio2) {
      // 25 de enero a 02 de febrero de 2026
      return `${dia1} de ${mes1} a ${dia2} de ${mes2} de ${anio1}`;
    } else {
      // 25 de diciembre de 2026 a 08 de enero de 2027
      return `${dia1} de ${mes1} de ${anio1} a ${dia2} de ${mes2} de ${anio2}`;
    }
  }

  // Para servicios que NO son alojamiento:
  // Lunes, 08 de diciembre de 2025
  function formatoFechaServicio(fechaYmd) {
    const d = parseYMD(fechaYmd);
    if (Number.isNaN(d.getTime())) return "";
    const diaSemana = DIAS_SEMANA[d.getDay()];
    const dia  = String(d.getDate()).padStart(2, "0");
    const mes  = MESES[d.getMonth()];
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
  // a nuestro objeto "item" de la tabla
  function mapRowToItem(row) {
    const tipo = row.tipo_servicio || "";
    const servicioTextoBruto = row.servicio_texto || row.nombre_servicio || "";

    const esAlojamiento =
      esTipoAlojamientoTexto(tipo) ||
      servicioTextoBruto.toLowerCase().includes("aloj");

    const fechaYmd = String(row.fecha_servicio).substring(0, 10);
    let fechaTexto;

    // Si backend nos da noches_alojamiento podemos reconstruir el rango
    if (esAlojamiento && row.noches_alojamiento && row.noches_alojamiento > 0) {
      const desde = fechaYmd;
      const hasta = sumarDiasYmd(desde, row.noches_alojamiento - 1);
      fechaTexto = formatoRangoAlojamiento(desde, hasta);
    } else {
      fechaTexto = formatoFechaServicio(fechaYmd);
    }

    const servicioTexto = servicioTextoBruto;

    // Precio: el backend ya deja vuelo/tren con precio_usd = null
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
        tdCiudad.colSpan = 6; // orden, índice, fecha, servicio, precio, eliminar
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

      // Columna 3: fecha (texto formateado)
      const colFecha = document.createElement("td");
      colFecha.textContent = it.fecha || "";

      // Columna 4: servicio (texto)
      const colServicio = document.createElement("td");
      colServicio.textContent = it.servicioTexto || "";

      // Columna 5: precio (solo lectura)
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
    sincronizarOrdenConServidor();  // <-- nuevo
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
  async function sincronizarOrdenConServidor() {
    if (!idCotizacion) return;

    const payload = {
      orden: items.map((it, idx) => ({
        id_item: it.id_item,
        orden_dia: idx + 1
      }))
    };

    try {
      const resp = await fetch(`/api/cotizaciones/${idCotizacion}/items/orden`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        console.warn("No se pudo guardar el nuevo orden:", data.mensaje || data.error);
      }
    } catch (err) {
      console.warn("Error al sincronizar orden:", err);
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
      const data = await resp.json(); // array [{id,nombre,id_continente}, ...]
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
      const data = await resp.json(); // array [{id,nombre,id_pais}]
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
    const texto = opt.textContent.toLowerCase();
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
  });

  // ==============================
  //   BLOQUE 3: Servicios
  // ==============================
  async function cargarTodosLosServicios() {
    try {
      const resp = await fetch("/api/servicios");
      const data = await resp.json();  // array de servicios
      if (!Array.isArray(data)) return;
      allServicios = data;             // se espera que venga con id_continente, id_pais, id_ciudad, id_tipo
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
      opt.value = s.id; // servicio.id
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
      if (!data.ok) {
        console.warn("No se pudo cargar cotización:", data.mensaje);
        return;
      }

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
          // precio_usd lo calculará el backend cuando lo implementemos
        })
      });

      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        throw new Error(data.mensaje || data.error || "Error al insertar servicio.");
      }

      const row = data.item;
      const nuevoItem = mapRowToItem(row);

      // Aquí sí tenemos fecha_desde y, si es alojamiento, fecha_hasta del formulario,
      // así que sobreescribimos el texto de fecha para cumplir exactamente tus reglas.
      const isoDesde = fechaDesdeInput.value;
      const isoHasta = fechaHastaInput.value;

      if (esTipoAlojamientoSeleccionado() && isoHasta) {
        nuevoItem.fecha = formatoRangoAlojamiento(isoDesde, isoHasta);
      } else {
        nuevoItem.fecha = formatoFechaServicio(isoDesde);
      }

      items.push(nuevoItem);
      actualizarTablaDesdeEstado();
    } catch (err) {
      console.error(err);
      mostrarError("No se pudo insertar el servicio: " + err.message);
    }
  });

  btnCrearServicio.addEventListener("click", () => {
    window.location.href = "../etapa2/servicios-crear.html";
  });

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