// public/etapa3/index-etapa3.js

document.addEventListener("DOMContentLoaded", () => {
  const btnNueva        = document.getElementById("btn-nueva-cotizacion");
  const txtBuscar       = document.getElementById("txt-buscar");
  const btnLimpiar      = document.getElementById("btn-limpiar-busqueda");
  const tbody           = document.getElementById("tbody-cotizaciones");
  const mensajeListado  = document.getElementById("mensaje-listado");

  let todas = [];   // cache de cotizaciones desde la API

  function mostrarMensaje(msg) {
    if (mensajeListado) mensajeListado.textContent = msg || "";
  }

  function formatearFechaYmd(fecha) {
    if (!fecha) return "";
    // fecha_viaje viene como "2025-12-17T23:00:00.000Z" -> nos quedamos con yyyy-mm-dd
    const soloFecha = String(fecha).substring(0, 10); // "YYYY-MM-DD"
    const [y, m, d] = soloFecha.split("-");
    return `${d}/${m}/${y}`;
  }

  function renderLista(filtroTexto = "") {
    tbody.innerHTML = "";

    let lista = [...todas];

    if (filtroTexto) {
      const q = filtroTexto.toLowerCase();
      lista = lista.filter(c => {
        const nombre  = (c.nombre_cotizacion || "").toLowerCase();
        const pasajero= (c.nombre_pasajero   || "").toLowerCase();
        const agente  = (c.agente            || "").toLowerCase();
        return (
          nombre.includes(q) ||
          pasajero.includes(q) ||
          agente.includes(q)
        );
      });
    }

    // Orden alfabético por nombre_cotizacion
    lista.sort((a, b) =>
      (a.nombre_cotizacion || "").localeCompare(b.nombre_cotizacion || "")
    );

    if (!lista.length) {
      mostrarMensaje("No se encontraron cotizaciones con ese criterio.");
      return;
    }
    mostrarMensaje("");

    lista.forEach((c) => {
      const tr = document.createElement("tr");

      // Nombre de la cotización
      const tdNombre = document.createElement("td");
      tdNombre.textContent = c.nombre_cotizacion || "(sin nombre)";
      tr.appendChild(tdNombre);

      // Pasajero
      const tdPasajero = document.createElement("td");
      tdPasajero.textContent = c.nombre_pasajero || "";
      tr.appendChild(tdPasajero);

      // Agente
      const tdAgente = document.createElement("td");
      tdAgente.textContent = c.agente || "";
      tr.appendChild(tdAgente);

      // Fecha viaje
      const tdFecha = document.createElement("td");
      tdFecha.textContent = formatearFechaYmd(c.fecha_viaje);
      tr.appendChild(tdFecha);

      // Personas
      const tdPersonas = document.createElement("td");
      tdPersonas.textContent = c.total_pasajeros ?? "";
      tr.appendChild(tdPersonas);

      // Acción (Editar)
      const tdAccion = document.createElement("td");
      const btnEditar = document.createElement("button");
      btnEditar.type = "button";
      btnEditar.textContent = "Editar";
      btnEditar.addEventListener("click", () => {
        window.location.href = `cotizacion-editar.html?id=${c.id_cotizacion}`;
      });
      tdAccion.appendChild(btnEditar);
      tr.appendChild(tdAccion);

      tbody.appendChild(tr);
    });
  }

  async function cargarCotizaciones() {
    try {
      mostrarMensaje("Cargando cotizaciones...");
      const resp = await fetch("/api/cotizaciones");
      const data = await resp.json();

      if (!resp.ok || !data.ok) {
        throw new Error(data.mensaje || data.error || "Error al cargar cotizaciones.");
      }

      todas = Array.isArray(data.cotizaciones) ? data.cotizaciones : [];
      if (!todas.length) {
        mostrarMensaje("Aún no tienes cotizaciones creadas.");
        return;
      }

      renderLista("");
    } catch (err) {
      console.error(err);
      mostrarMensaje("No se pudieron cargar las cotizaciones.");
    }
  }

  // Eventos
  btnNueva.addEventListener("click", () => {
    window.location.href = "cotizacion-crear.html";
  });

  txtBuscar.addEventListener("input", () => {
    const q = txtBuscar.value.trim();
    renderLista(q);
  });

  btnLimpiar.addEventListener("click", () => {
    txtBuscar.value = "";
    renderLista("");
  });

  // Init
  cargarCotizaciones();
});
