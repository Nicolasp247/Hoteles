// public/etapa3/cotizacion-editar.js

document.addEventListener("DOMContentLoaded", () => {
  // ====== Obtener ID de cotización de la URL ======
  const params = new URLSearchParams(window.location.search);
  const idCotizacion = params.get("id");
  const headerIdEl = document.getElementById("header-id");
  headerIdEl.textContent = idCotizacion ? `#${idCotizacion}` : "(sin id)";

  // ====== Referencias a elementos ======
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
  const btnCalendar1 = document.getElementById("btn-calendario-1");
  const btnCalendar2 = document.getElementById("btn-calendario-2");

  const mensajeErrorEl = document.getElementById("mensaje-error");

  // ====== Estado en memoria (de momento) ======
  let items = []; // cada item: { idLocal, fecha, servicioTexto, precio, opcional }

  let nextIdLocal = 1;

  // ====== Helpers ======
  function mostrarError(msg) {
    mensajeErrorEl.textContent = msg || "";
  }

  function recalcularIndices() {
    // Recorremos las filas y actualizamos el índice visible (1,2,3,...)
    Array.from(tablaBody.rows).forEach((row, idx) => {
      const celdaIndice = row.querySelector(".celda-indice");
      if (celdaIndice) {
        celdaIndice.textContent = idx + 1;
      }
    });
  }

  function recalcularTotal() {
    let total = 0;

    items.forEach((it) => {
      // Para vuelos y trenes podrías decidir no sumarlos:
      // por ahora sumamos solo si el precio es número positivo.
      const precio = Number(it.precio);
      if (!Number.isNaN(precio) && precio > 0) {
        total += precio;
      }
    });

    totalUsdInput.value = total.toFixed(2);
  }

  function actualizarTablaDesdeEstado() {
    tablaBody.innerHTML = "";

    items.forEach((it, idx) => {
      const row = document.createElement("tr");
      row.dataset.idLocal = it.idLocal;

      // Columna 1: cambiar orden (↑ ↓)
      const colOrden = document.createElement("td");
      const btnUp = document.createElement("button");
      btnUp.type = "button";
      btnUp.textContent = "↑";
      btnUp.addEventListener("click", () => moverItem(idx, -1));

      const btnDown = document.createElement("button");
      btnDown.type = "button";
      btnDown.textContent = "↓";
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

      // Columna 4: servicio (texto)
      const colServicio = document.createElement("td");
      colServicio.textContent = it.servicioTexto || "";

      // Columna 5: precio
      const colPrecio = document.createElement("td");
      const inputPrecio = document.createElement("input");
      inputPrecio.type = "number";
      inputPrecio.step = "0.01";
      inputPrecio.min = "0";
      inputPrecio.value = it.precio ?? "";
      inputPrecio.addEventListener("input", () => {
        it.precio = inputPrecio.value;
        recalcularTotal();
      });
      colPrecio.appendChild(inputPrecio);

      row.appendChild(colOrden);
      row.appendChild(colIndice);
      row.appendChild(colFecha);
      row.appendChild(colServicio);
      row.appendChild(colPrecio);

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

  // ====== Lógica de mostrar/ocultar "fecha hasta" ======
  function actualizarVisibilidadFechaHasta() {
    const tipo = filtroTipoServicio.value;
    if (tipo === "alojamiento") {
      wrapperFechaHasta.style.display = "";
    } else {
      wrapperFechaHasta.style.display = "none";
      fechaHastaInput.value = "";
    }
  }

  filtroTipoServicio.addEventListener("change", actualizarVisibilidadFechaHasta);
  actualizarVisibilidadFechaHasta(); // inicial

  // ====== Insertar servicio en la tabla (en memoria, por ahora) ======
  btnInsertarServicio.addEventListener("click", () => {
    mostrarError("");

    const tipo = filtroTipoServicio.value;
    const fechaDesde = fechaDesdeInput.value;
    const fechaHasta = fechaHastaInput.value;
    const servicioSeleccionado = selectServicio.value;
    const servicioTextoSeleccionado =
      selectServicio.options[selectServicio.selectedIndex]?.text || "";

    if (!servicioSeleccionado) {
      mostrarError("Selecciona un servicio antes de insertarlo.");
      return;
    }

    if (!fechaDesde) {
      mostrarError("Selecciona al menos la fecha de uso (desde).");
      return;
    }

    if (tipo === "alojamiento" && !fechaHasta) {
      mostrarError("Para alojamiento, indica la fecha de uso (hasta).");
      return;
    }

    // Construir el texto de servicio para la tabla
    let texto = servicioTextoSeleccionado;
    if (tipo === "alojamiento") {
      texto = `Alojamiento: ${texto}`;
    }

    if (chkOpcional.checked) {
      texto = `Opcional: ${texto}`;
    }

    const nuevoItem = {
      idLocal: nextIdLocal++,
      fecha: fechaDesde,        // más adelante podríamos expandir rango
      servicioTexto: texto,
      precio: ""                // se rellena manual en la tabla
    };

    items.push(nuevoItem);
    actualizarTablaDesdeEstado();
  });

  // ====== Botón "Crear servicio" ======
  btnCrearServicio.addEventListener("click", () => {
    // Por ahora simplemente lo mandamos a la pantalla de crear servicio de etapa2
    window.location.href = "../etapa2/servicios-crear.html";
  });

  // Los botones de calendario de momento solo muestran un alert
  btnCalendar1.addEventListener("click", () => {
    alert("Calendario (por implementar)");
  });

  btnCalendar2.addEventListener("click", () => {
    alert("Calendario (por implementar)");
  });

  // ====== TODO PRÓXIMO PASO: cargar servicios reales y items de la BD ======
  // Aquí más adelante:
  // - haremos fetch a /api/servicios para llenar select-servicio
  // - haremos fetch a /api/cotizaciones/:id para cargar items guardados
});
