// public/etapa3/cotizacion-crear.js

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("form-cotizacion");

  const agenteInput = document.getElementById("agente");
  const nombrePasajeroInput = document.getElementById("nombre_pasajero");
  const fechaViajeInput = document.getElementById("fecha_viaje");

  const adultos65Input = document.getElementById("adultos_65");
  const adultos1964Input = document.getElementById("adultos_19_64");
  const jovenes1218Input = document.getElementById("jovenes_12_18");
  const ninos311Input = document.getElementById("ninos_3_11");
  const infantes02Input = document.getElementById("infantes_0_2");

  const categoriasInputs = document.querySelectorAll(".categoria");

  const monedaSelect = document.getElementById("moneda_select");
  const monedaOtroContainer = document.getElementById("moneda_otro_container");
  const monedaOtroInput = document.getElementById("moneda_otro");

  const destinoSelect = document.getElementById("destino");

  const resumenPersonasEl = document.getElementById("resumen-personas");
  const nombrePreviewEl = document.getElementById("nombre_cotizacion_preview");

  const mensajeErrorEl = document.getElementById("mensaje-error");
  const mensajeOkEl = document.getElementById("mensaje-ok");

  // ✅ Cache de continentes para sacar la sigla rápido
  const continentesById = new Map();

  // --- Helpers ---

  function intOrZero(value) {
    const n = parseInt(value, 10);
    return Number.isNaN(n) ? 0 : n;
  }

  function continenteSigla(nombre) {
    return (nombre || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // sin tildes
      .replace(/[^a-zA-Z]/g, "")                       // solo letras
      .toUpperCase()
      .slice(0, 3);
  }

  function getDestinoId() {
    const val = (destinoSelect?.value || "").trim();
    const n = parseInt(val, 10);
    return Number.isNaN(n) ? null : n;
  }

  function getDestinoSigla() {
    const destinoId = getDestinoId();
    if (!destinoId) return "";
    const cont = continentesById.get(destinoId);
    return continenteSigla(cont?.nombre || "");
  }

  function calcularTotalPersonas() {
    const a65 = intOrZero(adultos65Input.value);
    const a1964 = intOrZero(adultos1964Input.value);
    const j1218 = intOrZero(jovenes1218Input.value);
    const n311 = intOrZero(ninos311Input.value);
    const i02 = intOrZero(infantes02Input.value);

    return {
      total: a65 + a1964 + j1218 + n311 + i02,
      detalle: { a65, a1964, j1218, n311, i02 }
    };
  }

  function actualizarResumenPersonasYNombre() {
    const { total, detalle } = calcularTotalPersonas();

    const partes = [];
    if (detalle.a65 > 0) partes.push(`${detalle.a65} adulto(s) +65`);
    if (detalle.a1964 > 0) partes.push(`${detalle.a1964} adulto(s) 19-64`);
    if (detalle.j1218 > 0) partes.push(`${detalle.j1218} joven(es) 12-18`);
    if (detalle.n311 > 0) partes.push(`${detalle.n311} niño(s) 3-11`);
    if (detalle.i02 > 0) partes.push(`${detalle.i02} infante(s) <2`);

    const textoDetalle = partes.length > 0 ? ` (${partes.join(", ")})` : "";
    resumenPersonasEl.textContent = `Total: ${total} persona(s)${textoDetalle}`;

    actualizarNombrePreview(total);
  }

  function actualizarNombrePreview(totalPasajeros) {
    const agente = agenteInput.value.trim();
    const nombrePasajero = nombrePasajeroInput.value.trim();
    const fechaViaje = fechaViajeInput.value; // yyyy-mm-dd
    const destinoId = getDestinoId();
    const sigla = getDestinoSigla();

    if (!destinoId || !sigla) {
      nombrePreviewEl.textContent = "(selecciona destino/continente)";
      return;
    }

    if (!agente || !nombrePasajero || !fechaViaje || totalPasajeros <= 0) {
      nombrePreviewEl.textContent = "(completa destino, agente, pasajero, fecha y pasajeros)";
      return;
    }

    const [yearStr, monthStr] = fechaViaje.split("-");
    const yy = yearStr.slice(-2);
    const mm = (monthStr || "").padStart(2, "0");
    const sufijo = totalPasajeros === 1 ? "persona" : "personas";

    // ✅ Ahora incluye sigla del continente al inicio
    const nombre = `${yy}${mm} ${sigla} ${agente} ${nombrePasajero} ${totalPasajeros} ${sufijo}`;
    nombrePreviewEl.textContent = nombre;
  }

  function obtenerCategoriasSeleccionadas() {
    const valores = [];
    categoriasInputs.forEach((c) => {
      if (c.checked) valores.push(c.value);
    });
    return valores.join(",");
  }

  // ✅ Cargar continentes al select destino
  async function cargarDestinos() {
    if (!destinoSelect) return;

    destinoSelect.innerHTML = `<option value="">(Seleccionar destino)</option>`;

    try {
      const resp = await fetch("/api/continentes");
      const data = await resp.json();

      // ✅ Ajusta aquí si tu API devuelve otro formato
      const lista = Array.isArray(data) ? data : (data.continentes || data.data || []);

      lista.forEach((c) => {
        if (!c || c.id == null) return;
        continentesById.set(Number(c.id), { id: Number(c.id), nombre: c.nombre || "" });

        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.nombre || `Continente ${c.id}`;
        destinoSelect.appendChild(opt);
      });

    } catch (err) {
      console.error("Error cargando continentes:", err);
      destinoSelect.innerHTML = `<option value="">(Error cargando continentes)</option>`;
    }
  }

  // --- Eventos para actualizar resumen y nombre ---
  [
    adultos65Input,
    adultos1964Input,
    jovenes1218Input,
    ninos311Input,
    infantes02Input
  ].forEach((input) => input.addEventListener("input", actualizarResumenPersonasYNombre));

  [agenteInput, nombrePasajeroInput, fechaViajeInput].forEach((input) => {
    input.addEventListener("input", () => {
      const { total } = calcularTotalPersonas();
      actualizarNombrePreview(total);
    });
  });

  // ✅ destino afecta el nombre
  if (destinoSelect) {
    destinoSelect.addEventListener("change", () => {
      const { total } = calcularTotalPersonas();
      actualizarNombrePreview(total);
    });
  }

  // --- Moneda: mostrar/ocultar campo "Otro" ---
  monedaSelect.addEventListener("change", () => {
    if (monedaSelect.value === "OTRO") {
      monedaOtroContainer.style.display = "block";
    } else {
      monedaOtroContainer.style.display = "none";
      monedaOtroInput.value = "";
    }
  });

  // --- Envío del formulario ---
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    mensajeErrorEl.textContent = "";
    mensajeOkEl.textContent = "";

    const { total } = calcularTotalPersonas();
    if (total <= 0) {
      mensajeErrorEl.textContent = "Debe haber al menos 1 pasajero.";
      return;
    }

    const agente = agenteInput.value.trim();
    const nombrePasajero = nombrePasajeroInput.value.trim();
    const fechaViaje = fechaViajeInput.value;

    const destinoRaw = destinoSelect?.value ?? "";
    const destino = destinoRaw !== "" ? Number.parseInt(destinoRaw, 10) : null;

    if (destino === null || Number.isNaN(destino)) {
      mensajeErrorEl.textContent = "Selecciona un destino (continente).";
      return;
    }

    if (!agente || !nombrePasajero || !fechaViaje) {
      mensajeErrorEl.textContent =
        "Destino, agente, nombre del pasajero y fecha de viaje son obligatorios.";
      return;
    }

    const payload = {
      destino,
      agente,
      nombre_pasajero: nombrePasajero,
      adultos_65: intOrZero(adultos65Input.value),
      adultos_19_64: intOrZero(adultos1964Input.value),
      jovenes_12_18: intOrZero(jovenes1218Input.value),
      ninos_3_11: intOrZero(ninos311Input.value),
      infantes_0_2: intOrZero(infantes02Input.value),
      categorias: obtenerCategoriasSeleccionadas(),
      fecha_viaje: fechaViaje,
      moneda_id: null,
      nota: document.getElementById("nota").value.trim()
    };

    try {
      const resp = await fetch("/api/cotizaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await resp.json();

      if (!resp.ok || !data.ok) {
        throw new Error(data.mensaje || data.error || "Error inesperado");
      }

      mensajeOkEl.textContent =
        `Cotización creada con ID ${data.id_cotizacion} y nombre "${data.nombre_cotizacion}". Redirigiendo...`;

      window.location.href = `cotizacion-editar.html?id=${data.id_cotizacion}`;

    } catch (err) {
      console.error(err);
      mensajeErrorEl.textContent =
        "Error al guardar la cotización: " + err.message;
    }
  });

  // Inicializar
  (async () => {
    await cargarDestinos();
    actualizarResumenPersonasYNombre();
  })();
});
