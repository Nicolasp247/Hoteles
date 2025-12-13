// public/etapa3/index-etapa3.js

document.addEventListener("DOMContentLoaded", () => {
  const btnNueva        = document.getElementById("btn-nueva");
  const inputBuscar     = document.getElementById("txt-buscar");
  const tablaBody       = document.getElementById("tabla-cotizaciones-body");
  const mensajeErrorEl  = document.getElementById("mensaje-error");

  let cotizaciones = []; // lista completa traída del backend

  function mostrarError(msg) {
    if (mensajeErrorEl) {
      mensajeErrorEl.textContent = msg || "";
    }
  }

  function formatearFecha(iso) {
    if (!iso) return "";
    const str = String(iso);
    // De MySQL suele venir tipo "2025-12-17T23:00:00.000Z"
    const ymd = str.substring(0, 10); // "YYYY-MM-DD"
    const [y, m, d] = ymd.split("-");
    return `${d}/${m}/${y}`; // 17/12/2025
  }

  function renderTabla(lista) {
    tablaBody.innerHTML = "";

    if (!lista.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 5;
      td.textContent = "No hay cotizaciones que coincidan con la búsqueda.";
      tr.appendChild(td);
      tablaBody.appendChild(tr);
      return;
    }

    lista.forEach((c) => {
      const tr = document.createElement("tr");

      // Nombre cotización
      const tdNombre = document.createElement("td");
      tdNombre.textContent = c.nombre_cotizacion || "";
      tr.appendChild(tdNombre);

      // Fecha viaje
      const tdFecha = document.createElement("td");
      tdFecha.textContent = formatearFecha(c.fecha_viaje);
      tr.appendChild(tdFecha);

      // Total pasajeros
      const tdPasajeros = document.createElement("td");
      tdPasajeros.textContent = c.total_pasajeros ?? "";
      tr.appendChild(tdPasajeros);

      // Agente
      const tdAgente = document.createElement("td");
      tdAgente.textContent = c.agente || "";
      tr.appendChild(tdAgente);

      // Acciones (botón editar)
      const tdAcciones = document.createElement("td");
      const btnEditar = document.createElement("button");
      btnEditar.type = "button";
      btnEditar.textContent = "Editar";
      btnEditar.addEventListener("click", () => {
        window.location.href = `cotizacion-editar.html?id=${c.id_cotizacion}`;
      });
      tdAcciones.appendChild(btnEditar);
      tr.appendChild(tdAcciones);

      tablaBody.appendChild(tr);
    });
  }

  function aplicarFiltro() {
    const q = (inputBuscar.value || "").toLowerCase().trim();

    if (!q) {
      renderTabla(cotizaciones);
      return;
    }

    const filtradas = cotizaciones.filter((c) => {
      const textoBuscar = [
        c.nombre_cotizacion || "",
        c.nombre_pasajero  || "",
        c.agente           || "",
      ]
        .join(" ")
        .toLowerCase();

      return textoBuscar.includes(q);
    });

    renderTabla(filtradas);
  }

  async function cargarCotizaciones() {
    try {
      mostrarError("");
      const resp = await fetch("/api/cotizaciones");
      const data = await resp.json();

      if (!resp.ok || !data.ok) {
        throw new Error(data.mensaje || data.error || "Error al cargar cotizaciones.");
      }

      cotizaciones = Array.isArray(data.cotizaciones) ? data.cotizaciones : [];
      renderTabla(cotizaciones);
    } catch (err) {
      console.error("Error cargando cotizaciones:", err);
      mostrarError("No se pudieron cargar las cotizaciones: " + err.message);
      cotizaciones = [];
      renderTabla(cotizaciones);
    }
  }

  // Eventos
  btnNueva.addEventListener("click", () => {
    window.location.href = "cotizacion-crear.html";
  });

  // Filtro en tiempo real
  inputBuscar.addEventListener("input", aplicarFiltro);

  // Inicialización
  cargarCotizaciones();
});
