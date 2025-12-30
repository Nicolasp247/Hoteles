// public/etapa3/precios-servicios.js
document.addEventListener("DOMContentLoaded", () => {
  // =========================
  // Config
  // =========================
  const ANIOS_UI = [2025, 2026];
  const MESES = [
    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
  ];

  // =========================
  // DOM (filtros + selección)
  // =========================
  const filtroContinente = document.getElementById("filtro-continente");
  const filtroPais       = document.getElementById("filtro-pais");
  const filtroCiudad     = document.getElementById("filtro-ciudad");
  const filtroTipo       = document.getElementById("filtro-tipo");

  const selServicio = document.getElementById("sel-servicio");
  const selAnio     = document.getElementById("sel-anio");

  // =========================
  // DOM (tabla sin precio + panel seleccionado)
  // =========================
  const btnSinPrecio          = document.getElementById("btn-sin-precio");
  const cardSinPrecio         = document.getElementById("card-sin-precio");
  const tbodySinPrecio        = document.getElementById("tbody-sin-precio");
  const btnCerrarSinPrecio    = document.getElementById("btn-cerrar-sin-precio");

  const cardServicioSel       = document.getElementById("card-servicio-seleccionado");
  const srvSelResumen         = document.getElementById("srv-seleccionado-resumen");
  const btnAbrirEditarModal   = document.getElementById("btn-abrir-editar-modal");
  const btnAbrirPreciosModal  = document.getElementById("btn-abrir-precios-modal");
  const btnCancelarServicio   = document.getElementById("btn-cancelar-servicio");

  // =========================
  // DOM (modal dialog)
  // =========================
  const modalServicio   = document.getElementById("modal-servicio");
  const btnModalEditar  = document.getElementById("btn-modal-editar");
  const btnModalPrecios = document.getElementById("btn-modal-precios");
  const btnModalCerrar  = document.getElementById("btn-modal-cerrar");

  // Modal: detalle + edición
  const srvDetalle = document.getElementById("srv-detalle");
  const srvEditar  = document.getElementById("srv-editar");

  const btnEditar            = document.getElementById("btn-editar");
  const btnCancelarEdicion   = document.getElementById("btn-cancelar-edicion");
  const btnGuardarEdicion    = document.getElementById("btn-guardar-edicion");

  const edNombre     = document.getElementById("ed-nombre");
  const edProveedor  = document.getElementById("ed-proveedor");
  const edTiempo     = document.getElementById("ed-tiempo");
  const edPrivado    = document.getElementById("ed-privado");
  const edLink       = document.getElementById("ed-link");
  const edDesc       = document.getElementById("ed-desc");
  const edReadonly   = document.getElementById("ed-readonly");

  // Modal: precios
  const tbodyPrecios = document.getElementById("tbody-precios");
  const btnGuardarPrecios = document.getElementById("btn-guardar");
  const msg = document.getElementById("msg");

  // (Opcional) si existe en tu HTML, lo usamos. Si no, DBL por defecto.
  const selTipoHab = document.getElementById("sel-tipo-hab");

  // =========================
  // Estado
  // =========================
  let allServicios = [];
  let serviciosFiltrados = [];
  let detalleActual = null;

  let proveedoresCache = [];
  let tiposServicioCache = [];

  let servicioSeleccionadoTablaId = null; // cuando viene desde "sin precio"

  // =========================
  // Helpers
  // =========================
  function show(el, v) {
    if (!el) return;
    el.classList.toggle("hide", !v);
  }

  function setMsg(text, isError = false) {
    if (!msg) return;
    msg.textContent = text || "";
    msg.style.color = isError ? "crimson" : "inherit";
  }

  function safeText(v) {
    return v == null ? "" : String(v);
  }

  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function getAnioUI() {
    const n = Number(String(selAnio?.value || "").trim());
    if (!Number.isFinite(n)) return ANIOS_UI[0];
    if (!ANIOS_UI.includes(n)) return ANIOS_UI[0];
    return n;
  }

  function getTipoHabUI() {
    const v = String(selTipoHab?.value || "DBL").trim().toUpperCase();
    if (!["DBL", "SGL", "TPL"].includes(v)) return "DBL";
    return v;
  }

  async function fetchJSON(url, opts) {
    const resp = await fetch(url, opts);
    const text = await resp.text();
    let data = null;
    try { data = text ? JSON.parse(text) : {}; }
    catch { throw new Error(`Respuesta no-JSON desde ${url}: ${text.slice(0, 180)}`); }

    if (!resp.ok) {
      const m = data?.mensaje || data?.error || `HTTP ${resp.status}`;
      throw new Error(m);
    }
    return data;
  }

  async function fetchLista(url, posiblesKeys = []) {
    const data = await fetchJSON(url);
    if (Array.isArray(data)) return data;
    for (const k of posiblesKeys) if (Array.isArray(data?.[k])) return data[k];
    throw new Error(`Formato inesperado desde ${url}`);
  }

  function addOptions(selectEl, opciones, { firstText = "(Seleccionar)", firstValue = "" } = {}) {
    if (!selectEl) return;
    selectEl.innerHTML = "";
    if (firstText !== null) selectEl.appendChild(new Option(firstText, firstValue));
    (opciones || []).forEach(o => selectEl.appendChild(new Option(o.text, o.value)));
  }

  function getTipoNombreById(idTipo) {
    const t = tiposServicioCache.find(x => String(x.id) === String(idTipo));
    return t?.nombre || "";
  }

  function esAlojamientoByTipoId(idTipo) {
    const nombre = getTipoNombreById(idTipo);
    return nombre.toLowerCase().includes("aloj");
  }

  function labelServicio(s) {
    const ciudad = (s.ciudad || "").trim();
    const txtBase = (s.servicio_texto || s.nombre_wtravel || `Servicio #${s.id}`).trim();
    return ciudad ? `[${ciudad}] ${txtBase}` : txtBase;
  }

  function resetDetalleUI() {
    detalleActual = null;
    renderDetalle(null);
    show(btnEditar, false);
    show(btnCancelarEdicion, false);
    show(btnGuardarEdicion, false);
    show(srvEditar, false);
  }

  function cerrarPanelSeleccionado() {
    servicioSeleccionadoTablaId = null;
    show(cardServicioSel, false);
    if (srvSelResumen) {
      srvSelResumen.innerHTML = `<div class="muted">Aún no has seleccionado un servicio de la tabla.</div>`;
    }
  }

  // =========================
  // Render Detalle (modal)
  // =========================
  function renderDetalle(det) {
    if (!srvDetalle) return;
    srvDetalle.innerHTML = "";

    if (!det) {
      srvDetalle.innerHTML = `<div class="muted">Selecciona un servicio para ver detalles.</div>`;
      return;
    }

    const kv = [
      ["Tipo", safeText(det.tipo)],
      ["Ciudad", safeText(det.ciudad)],
      ["Proveedor", safeText(det.proveedor)],
      ["Tiempo", safeText(det.tiempo_servicio)],
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

  // =========================
  // Tabla de precios (modal)
  // =========================
  function renderTablaPrecios(precios12) {
    if (!tbodyPrecios) return;
    tbodyPrecios.innerHTML = "";

    const map = new Map();
    (precios12 || []).forEach(x => {
      const mes = Number(x?.mes);
      if (Number.isFinite(mes) && mes >= 1 && mes <= 12) map.set(mes, x?.precio_usd);
    });

    for (let m = 1; m <= 12; m++) {
      const tr = document.createElement("tr");

      const tdMes = document.createElement("td");
      tdMes.textContent = `${m}. ${MESES[m - 1]}`;

      const tdPrecio = document.createElement("td");
      const input = document.createElement("input");
      input.type = "number";
      input.step = "0.01";
      input.min = "0";
      input.dataset.mes = String(m);

      const val = map.has(m) ? map.get(m) : null;
      input.value = (val === null || val === undefined) ? "" : String(val);

      tdPrecio.appendChild(input);
      tr.appendChild(tdMes);
      tr.appendChild(tdPrecio);
      tbodyPrecios.appendChild(tr);
    }
  }

  // =========================
  // Cargar catálogos
  // =========================
  async function cargarContinentes() {
    const lista = await fetchLista("/api/continentes", ["continentes"]);
    addOptions(
      filtroContinente,
      lista.map(x => ({ value: String(x.id), text: x.nombre })),
      { firstText: "(Todos los continentes)", firstValue: "" }
    );
  }

  async function cargarPaises(idContinente) {
    if (!idContinente) {
      addOptions(filtroPais, [], { firstText: "(Todos los países)", firstValue: "" });
      addOptions(filtroCiudad, [], { firstText: "(Todas las ciudades)", firstValue: "" });
      return;
    }
    const lista = await fetchLista(`/api/paises/${idContinente}`, ["paises"]);
    addOptions(
      filtroPais,
      lista.map(x => ({ value: String(x.id), text: x.nombre })),
      { firstText: "(Todos los países)", firstValue: "" }
    );
    addOptions(filtroCiudad, [], { firstText: "(Todas las ciudades)", firstValue: "" });
  }

  async function cargarCiudades(idPais) {
    if (!idPais) {
      addOptions(filtroCiudad, [], { firstText: "(Todas las ciudades)", firstValue: "" });
      return;
    }
    const lista = await fetchLista(`/api/ciudades/${idPais}`, ["ciudades"]);
    addOptions(
      filtroCiudad,
      lista.map(x => ({ value: String(x.id), text: x.nombre })),
      { firstText: "(Todas las ciudades)", firstValue: "" }
    );
  }

  async function cargarTiposServicio() {
    const lista = await fetchLista("/api/tiposervicio", ["tipos", "tipos_servicio", "tiposervicio"]);
    tiposServicioCache = lista || [];

    // pantalla precios-servicios: no queremos alojamiento
    const filtrados = (lista || []).filter(t => !String(t.nombre || "").toLowerCase().includes("aloj"));
    addOptions(
      filtroTipo,
      filtrados.map(t => ({ value: String(t.id), text: t.nombre })),
      { firstText: "(Todos los tipos)", firstValue: "" }
    );
  }

  async function cargarProveedores() {
    proveedoresCache = await fetchLista("/api/proveedores", ["proveedores"]);
    if (!edProveedor) return;
    edProveedor.innerHTML = "";
    proveedoresCache.forEach(p => {
      edProveedor.appendChild(new Option(`${p.nombre} (${p.iniciales || ""})`, String(p.id)));
    });
  }

  // =========================
  // Servicios + filtrado
  // =========================
  async function cargarServicios() {
    const lista = await fetchLista("/api/servicios", ["servicios"]);
    // sin alojamiento
    allServicios = (lista || []).filter(s => !esAlojamientoByTipoId(s.id_tipo));
    filtrarServicios();
  }

  function filtrarServicios() {
    const idCont = filtroContinente?.value || null;
    const idPais = filtroPais?.value || null;
    const idCiud = filtroCiudad?.value || null;
    const idTipo = filtroTipo?.value || null;

    serviciosFiltrados = allServicios.filter(s => {
      if (idCont && String(s.id_continente ?? "") !== String(idCont)) return false;
      if (idPais && String(s.id_pais ?? "") !== String(idPais)) return false;
      if (idCiud && String(s.id_ciudad ?? "") !== String(idCiud)) return false;
      if (idTipo && String(s.id_tipo ?? "") !== String(idTipo)) return false;
      return true;
    });

    serviciosFiltrados.sort((a, b) => {
      const aa = (a.servicio_texto || a.nombre_wtravel || "").toLowerCase();
      const bb = (b.servicio_texto || b.nombre_wtravel || "").toLowerCase();
      return aa.localeCompare(bb);
    });

    if (selServicio) {
      selServicio.innerHTML = "";
      selServicio.appendChild(new Option("(Seleccionar servicio)", ""));
      serviciosFiltrados.forEach(s => {
        selServicio.appendChild(new Option(labelServicio(s), String(s.id)));
      });
    }

    resetDetalleUI();
  }

  // =========================
  // Detalle de servicio
  // =========================
  async function cargarDetalleServicio(idServicio) {
    if (!idServicio) return;
    setMsg("");

    try {
      const data = await fetchJSON(`/api/servicios/${idServicio}`);
      if (!data.ok) throw new Error(data.mensaje || data.error || "No se pudo cargar el detalle");

      detalleActual = data.servicio;
      renderDetalle(detalleActual);

      show(btnEditar, true);
      show(btnCancelarEdicion, false);
      show(btnGuardarEdicion, false);
      show(srvEditar, false);
    } catch (e) {
      setMsg(e.message, true);
      resetDetalleUI();
    }
  }

  // =========================
  // Modal: modos (editar / precios)
  // =========================
  function abrirModal() {
    if (!modalServicio) return;
    modalServicio.showModal();
  }

  function cerrarModal() {
    if (!modalServicio) return;
    modalServicio.close();
    setMsg("");
    // dejar el modal limpio de edición visible
    show(srvEditar, false);
    show(btnEditar, !!detalleActual);
    show(btnCancelarEdicion, false);
    show(btnGuardarEdicion, false);
  }

  function modalModoEditar() {
    if (!detalleActual) return;

    // cargar inputs
    if (edNombre) edNombre.value = detalleActual.nombre_wtravel || "";
    if (edTiempo) edTiempo.value = detalleActual.tiempo_servicio || "";
    if (edPrivado) edPrivado.value = detalleActual.privado ? "1" : "0";
    if (edLink) edLink.value = detalleActual.link_reserva || "";
    if (edDesc) edDesc.value = detalleActual.descripcion || "";

    if (edProveedor && detalleActual.id_proveedor != null) {
      edProveedor.value = String(detalleActual.id_proveedor);
    }

    if (edReadonly) {
      edReadonly.textContent =
        `Nota: Tipo y Ciudad se mantienen. (Tipo: ${detalleActual.tipo || ""} | Ciudad: ${detalleActual.ciudad || ""})`;
    }

    // mostrar form
    show(srvEditar, true);

    // botones: usamos los de arriba del card detalle
    show(btnEditar, false);
    show(btnCancelarEdicion, true);
    show(btnGuardarEdicion, true);

    // precios no se esconden porque en tu HTML están en el mismo modal,
    // pero tú eliges con botones. Aquí solo preparamos edición.
    setMsg("");
  }

  async function modalModoPrecios() {
    if (!detalleActual) return;
    setMsg("");

    // Cargar precios del año UI actual
    await cargarPreciosDeServicio(detalleActual.id, getAnioUI(), getTipoHabUI());
  }

  // =========================
  // Guardar edición (PUT servicio)
  // =========================
  async function guardarEdicion() {
    if (!detalleActual) return;
    setMsg("");

    const id = detalleActual.id;

    const payload = {
      id_tipo: detalleActual.id_tipo,
      id_proveedor: Number(edProveedor?.value),
      id_ciudad: detalleActual.id_ciudad,

      tiempo_servicio: (edTiempo?.value || "").trim() || null,
      privado: String(edPrivado?.value) === "1",
      descripcion: (edDesc?.value || "").trim() || null,
      link_reserva: (edLink?.value || "").trim() || null
      // nombre_wtravel NO lo mandamos (tu backend lo recalcula)
    };

    try {
      const data = await fetchJSON(`/api/servicio/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!data.ok) throw new Error(data.mensaje || data.error || "Error guardando cambios");

      setMsg("Servicio actualizado ✅");

      // refrescar lista y detalle
      await cargarServicios();
      if (selServicio) selServicio.value = String(id);
      await cargarDetalleServicio(id);

      // cerrar edición visual
      show(srvEditar, false);
      show(btnEditar, true);
      show(btnCancelarEdicion, false);
      show(btnGuardarEdicion, false);

    } catch (e) {
      setMsg(e.message, true);
    }
  }

  // =========================
  // Precios (GET/PUT)
  // =========================
  async function cargarPreciosDeServicio(idServicio, anio, tipoHab) {
    if (!idServicio) return;

    try {
      const data = await fetchJSON(
        `/api/servicios/${idServicio}/precios?anio=${encodeURIComponent(anio)}&tipo_habitacion=${encodeURIComponent(tipoHab)}`
      );
      if (!data.ok) throw new Error(data.mensaje || data.error || "Error cargando precios");

      renderTablaPrecios(data.precios || []);
      setMsg(`Precios cargados ✅ (${anio} - ${tipoHab})`);
    } catch (e) {
      setMsg(e.message, true);
      renderTablaPrecios([]);
    }
  }

  async function guardarPreciosDeServicio() {
    setMsg("");

    if (!detalleActual) return setMsg("Primero selecciona un servicio.", true);
    const idServicio = detalleActual.id;
    const anio = getAnioUI();
    const tipoHab = getTipoHabUI();

    if (!tbodyPrecios) return setMsg("No encuentro la tabla de precios en el HTML.", true);

    const inputs = tbodyPrecios.querySelectorAll("input[type='number']");
    const precios = [];

    for (const inp of inputs) {
      const mes = Number(inp.dataset.mes);
      const raw = String(inp.value || "").trim();

      if (!raw) {
        precios.push({ mes, precio_usd: null });
        continue;
      }

      const n = Number(raw);
      if (!Number.isFinite(n)) return setMsg(`Precio inválido en mes ${mes} (${MESES[mes - 1]}).`, true);
      if (n < 0) return setMsg(`No se permiten negativos (mes ${mes}: ${MESES[mes - 1]}).`, true);

      precios.push({ mes, precio_usd: round2(n) });
    }

    try {
      const data = await fetchJSON(
        `/api/servicios/${idServicio}/precios?anio=${encodeURIComponent(anio)}&tipo_habitacion=${encodeURIComponent(tipoHab)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ precios })
        }
      );
      if (!data.ok) throw new Error(data.mensaje || data.error || "Error guardando precios");

      setMsg("Guardado listo ✅");
      await cargarPreciosDeServicio(idServicio, anio, tipoHab);
    } catch (e) {
      setMsg(e.message, true);
    }
  }

  // =========================
  // Servicios sin precio (card)
  // =========================
  function toggleCardSinPrecio(open) {
    show(cardSinPrecio, !!open);
  }

  function buildSinPrecioQuery() {
    // Si tu endpoint acepta filtros, aquí se los mandamos.
    // Si NO los acepta, igual funciona, solo ignora params.
    const params = new URLSearchParams();

    // años (internamente solo 2025/2026)
    params.set("anio_desde", "2025");
    params.set("anio_hasta", "2026");

    // filtros actuales (opcional)
    if (filtroContinente?.value) params.set("id_continente", filtroContinente.value);
    if (filtroPais?.value) params.set("id_pais", filtroPais.value);
    if (filtroCiudad?.value) params.set("id_ciudad", filtroCiudad.value);
    if (filtroTipo?.value) params.set("id_tipo", filtroTipo.value);

    // año elegido en pantalla (por si tu endpoint lista por un año específico)
    params.set("anio", String(getAnioUI()));

    // tipo hab (si tu endpoint lo usa)
    params.set("tipo_habitacion", getTipoHabUI());

    return `/api/servicios/sin-precio?${params.toString()}`;
  }

  async function cargarServiciosSinPrecio() {
    if (!tbodySinPrecio) return;

    tbodySinPrecio.innerHTML = `
      <tr><td colspan="3" class="muted">Cargando...</td></tr>
    `;

    try {
      const data = await fetchJSON(buildSinPrecioQuery());

      const rows = Array.isArray(data.servicios) ? data.servicios : (Array.isArray(data) ? data : []);
      if (!rows.length) {
        tbodySinPrecio.innerHTML = `
          <tr><td colspan="3" class="muted">No hay servicios pendientes 🎉</td></tr>
        `;
        return;
      }

      tbodySinPrecio.innerHTML = "";

      rows.forEach((s) => {
        const tr = document.createElement("tr");

        const tdCiudad = document.createElement("td");
        tdCiudad.textContent = safeText(s.ciudad || s.nombre_ciudad || "");

        const tdNombre = document.createElement("td");
        tdNombre.textContent = safeText(s.nombre_wtravel || s.servicio_texto || "");

        const tdAccion = document.createElement("td");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn-primary";
        btn.textContent = "Llenar precio";
        btn.addEventListener("click", async () => {
          const idServicio = s.id_servicio || s.id || s.servicio_id;
          if (!idServicio) return;

          servicioSeleccionadoTablaId = Number(idServicio);

          // cargar detalle para mostrar resumen y preparar modal
          await cargarDetalleServicio(servicioSeleccionadoTablaId);

          // panel “Servicio seleccionado”
          show(cardServicioSel, true);
          if (srvSelResumen) {
            srvSelResumen.innerHTML = `
              <div class="muted">Ciudad</div><div>${safeText(detalleActual?.ciudad || "")}</div>
              <div class="muted">Nombre WTravel</div><div>${safeText(detalleActual?.nombre_wtravel || "")}</div>
              <div class="muted">Tipo</div><div>${safeText(detalleActual?.tipo || "")}</div>
              <div class="muted">Proveedor</div><div>${safeText(detalleActual?.proveedor || "")}</div>
            `;
          }
        });

        tdAccion.appendChild(btn);

        tr.appendChild(tdCiudad);
        tr.appendChild(tdNombre);
        tr.appendChild(tdAccion);
        tbodySinPrecio.appendChild(tr);
      });

    } catch (e) {
      console.error(e);
      tbodySinPrecio.innerHTML = `
        <tr><td colspan="3" style="color:crimson;">${safeText(e.message)}</td></tr>
      `;
    }
  }

  // =========================
  // Eventos
  // =========================
  filtroContinente?.addEventListener("change", async () => {
    setMsg("");
    await cargarPaises(filtroContinente.value || null);
    filtrarServicios();
  });

  filtroPais?.addEventListener("change", async () => {
    setMsg("");
    await cargarCiudades(filtroPais.value || null);
    filtrarServicios();
  });

  filtroCiudad?.addEventListener("change", () => { setMsg(""); filtrarServicios(); });
  filtroTipo?.addEventListener("change", () => { setMsg(""); filtrarServicios(); });

  selServicio?.addEventListener("change", async () => {
    setMsg("");
    const id = selServicio.value;
    if (!id) {
      resetDetalleUI();
      return;
    }
    // si cambias en el select, cargamos detalle, pero no abrimos modal
    await cargarDetalleServicio(id);
  });

  // Año cambia: si el modal está abierto y estás en precios, puedes recargar manual con botón “Poner precios”
  selAnio?.addEventListener("change", () => setMsg(""));

  // Card sin precio
  btnSinPrecio?.addEventListener("click", async () => {
    toggleCardSinPrecio(true);
    await cargarServiciosSinPrecio();
  });

  btnCerrarSinPrecio?.addEventListener("click", () => {
    toggleCardSinPrecio(false);
  });

  // Panel “Servicio seleccionado”
  btnCancelarServicio?.addEventListener("click", () => {
    cerrarPanelSeleccionado();
  });

  btnAbrirEditarModal?.addEventListener("click", () => {
    if (!detalleActual) return setMsg("Primero selecciona un servicio.", true);
    abrirModal();
    // empezamos en modo “vista”, y luego al botón editar
    // pero tú querías que “Editar información” ya lo abra listo:
    modalModoEditar();
  });

  btnAbrirPreciosModal?.addEventListener("click", async () => {
    if (!detalleActual) return setMsg("Primero selecciona un servicio.", true);
    abrirModal();
    await modalModoPrecios();
  });

  // Modal top buttons
  btnModalCerrar?.addEventListener("click", cerrarModal);

  btnModalEditar?.addEventListener("click", () => {
    if (!detalleActual) return setMsg("Primero selecciona un servicio.", true);
    modalModoEditar();
  });

  btnModalPrecios?.addEventListener("click", async () => {
    if (!detalleActual) return setMsg("Primero selecciona un servicio.", true);
    await modalModoPrecios();
  });

  // Botones dentro del card detalle (modal)
  btnEditar?.addEventListener("click", modalModoEditar);
  btnCancelarEdicion?.addEventListener("click", () => {
    setMsg("");
    show(srvEditar, false);
    show(btnEditar, true);
    show(btnCancelarEdicion, false);
    show(btnGuardarEdicion, false);
  });
  btnGuardarEdicion?.addEventListener("click", guardarEdicion);

  // Guardar precios (modal)
  btnGuardarPrecios?.addEventListener("click", guardarPreciosDeServicio);

  // Cerrar modal con ESC o cierre nativo
  modalServicio?.addEventListener("close", () => {
    setMsg("");
  });

  // =========================
  // Init
  // =========================
  (async () => {
    try {
      setMsg("");

      // Años UI 2025/2026
      if (selAnio) {
        selAnio.innerHTML = "";
        ANIOS_UI.forEach(y => selAnio.appendChild(new Option(String(y), String(y))));
        selAnio.value = String(ANIOS_UI[0]);
      }

      // tablas limpias
      renderTablaPrecios([]);

      // ocultar secciones al inicio
      toggleCardSinPrecio(false);
      cerrarPanelSeleccionado();

      await cargarContinentes();
      await cargarTiposServicio();
      await cargarServicios();
      await cargarProveedores();

      addOptions(filtroPais, [], { firstText: "(Todos los países)", firstValue: "" });
      addOptions(filtroCiudad, [], { firstText: "(Todas las ciudades)", firstValue: "" });

    } catch (e) {
      console.error(e);
      setMsg(e.message, true);
    }
  })();
});
