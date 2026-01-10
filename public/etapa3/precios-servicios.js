// public/etapa3/precios-servicios.js
document.addEventListener("DOMContentLoaded", () => {
  // =========================
  // Config
  // =========================
  const ANIOS_UI = [2025, 2026];
  const TIPO_HAB_DEFAULT = "DBL";
  const MESES = [
    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
  ];

  // =========================
  // Helpers DOM
  // =========================
  const $ = (id) => document.getElementById(id);
  const show = (el, visible) => { if (el) el.style.display = visible ? "" : "none"; };

  // =========================
  // DOM: filtros + selección
  // =========================
  const filtroContinente = $("filtro-continente");
  const filtroPais       = $("filtro-pais");
  const filtroCiudad     = $("filtro-ciudad");
  const filtroTipo       = $("filtro-tipo");

  const selServicio      = $("sel-servicio");
  const selAnio          = $("sel-anio");

  const btnServicioDatos  = $("btn-servicio-datos");
  const btnServicioPrecio = $("btn-servicio-precio");

  // =========================
  // DOM: tabla sin precio
  // =========================
  const tbodySinPrecio = $("tbody-sin-precio");
  const btnRecargarSinPrecio = $("btn-recargar-sin-precio");
  const msgSinPrecio = $("msg-sin-precio");

  // =========================
  // DOM: Modal DATOS
  // =========================
  const modalDatos = $("modal-datos");
  const btnModalDatosCerrar = $("btn-modal-datos-cerrar");
  const btnModalDatosAbrirPrecios = $("btn-modal-datos-abrir-precios");

  // Vista bonita (existentes en tu HTML)
  const mdNombre = $("modal-datos-nombre");
  const mdCiudad = $("modal-datos-ciudad");
  const mdTipo = $("md-tipo");
  const mdProveedor = $("md-proveedor");
  const mdTiempo = $("md-tiempo");
  const mdPrivado = $("md-privado");
  const mdDescripcion = $("md-descripcion");
  const mdLink = $("md-link");

  // Contenedores view/edit (si existen)
  const modalDatosView = $("modal-datos-view");
  const modalDatosEdit = $("modal-datos-edit");

  // Botones edición
  const btnModalDatosEditar   = $("btn-modal-datos-editar");
  const btnModalDatosGuardar  = $("btn-modal-datos-guardar");
  const btnModalDatosCancelar = $("btn-modal-datos-cancelar");
  const msgEditar             = $("msg-editar-servicio");

  // =========================
  // DOM: Modal PRECIOS
  // =========================
  const modalPrecios = $("modal-precios");
  const btnModalPreciosCerrar = $("btn-modal-precios-cerrar");
  const modalTbodyPrecios = $("modal-tbody-precios");
  const btnModalGuardarPrecios = $("btn-modal-guardar-precios");
  const modalMsgPrecios = $("modal-msg-precios"); // (puede no existir en tu HTML)

  // Contexto bonito modal precios
  const mpServicioNombre = $("modal-precios-servicio-nombre");
  const mpAnio = $("modal-precios-anio");

  // =========================
  // Estado
  // =========================
  let tiposServicioCache = [];
  let allServicios = [];
  let serviciosFiltrados = [];

  let modalPreciosServicioId = null;
  let modalDatosServicioId = null;
  let modalDatosIsEditing = false;

  let proveedoresCache = [];
  const catalogCache = {}; // /api/catalogos/:grupo

  const servicioCacheById = new Map(); // id -> objeto de /api/servicios lista
  const detalleCacheById = new Map();  // id -> detalle /api/servicios/:id

  // =========================
  // Helpers UI
  // =========================
  function safeText(v) { return v == null ? "" : String(v); }
  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

  function setMsgSinPrecio(text, isError = false) {
    if (!msgSinPrecio) return;
    msgSinPrecio.textContent = text || "";
    msgSinPrecio.style.color = isError ? "crimson" : "inherit";
  }
  function setMsgModalPrecios(text, isError = false) {
    if (!modalMsgPrecios) return;
    modalMsgPrecios.textContent = text || "";
    modalMsgPrecios.style.color = isError ? "crimson" : "inherit";
  }
  function setMsgEditar(text, isError = false) {
    if (!msgEditar) return;
    msgEditar.textContent = text || "";
    msgEditar.style.color = isError ? "crimson" : "inherit";
  }

  function getAnioUI() {
    const n = Number(String(selAnio?.value || "").trim());
    if (!Number.isFinite(n)) return ANIOS_UI[0];
    if (!ANIOS_UI.includes(n)) return ANIOS_UI[0];
    return n;
  }
  function getTipoHabUI() { return TIPO_HAB_DEFAULT; }

  // =========================
  // Fetch helpers
  // =========================
  async function fetchJSON(url, opts) {
    const resp = await fetch(url, opts);
    const text = await resp.text();

    let data = null;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Respuesta no-JSON desde ${url}: ${text.slice(0, 180)}`);
    }

    if (!resp.ok) {
      const m = data?.mensaje || data?.error || `HTTP ${resp.status}`;
      throw new Error(m);
    }

    if (data && typeof data === "object" && data.ok === false) {
      const m = data?.mensaje || data?.error || "Operación no exitosa";
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

  // =========================
  // Catálogos (igual idea que cotizacion-editar)
  // =========================
  async function cargarCatalogo(grupo) {
    if (catalogCache[grupo]) return catalogCache[grupo];
    const lista = await fetchLista(`/api/catalogos/${encodeURIComponent(grupo)}`, ["opciones","valores","items"]);
    const norm = (lista || [])
      .map(x => (typeof x === "string" ? { valor: x } : x))
      .filter(x => x?.valor);
    catalogCache[grupo] = norm;
    return norm;
  }

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

  async function fillSelectFromCatalog(selectEl, grupo, { firstText="(Seleccionar)", firstValue="" } = {}) {
    if (!selectEl) return;
    try {
      const cat = await cargarCatalogo(grupo);
      addOptions(selectEl, cat.map(x => ({ value: x.valor, text: x.valor })), { firstText, firstValue });
    } catch {
      addOptions(selectEl, [], { firstText: "(Sin catálogo)", firstValue: "" });
    }
  }

  async function fillSelectCatalogoConEscribir(selectEl, inputEl, grupoCatalogo, { firstText="(Seleccionar)", firstValue="" } = {}) {
    if (!selectEl) return;
    try {
      const cat = await cargarCatalogo(grupoCatalogo);
      const opts = [
        ...cat.map(x => ({ value: x.valor, text: x.valor })),
        { value: "__write__", text: "Escribir nuevo..." },
      ];
      addOptions(selectEl, opts, { firstText, firstValue });
    } catch {
      addOptions(selectEl, [{ value:"__write__", text:"Escribir nuevo..." }], { firstText:"(Sin catálogo)", firstValue:"" });
    }
    initSelectConEscribirNuevo(selectEl, inputEl);
  }

  // =========================
  // Construcción dinámica del EDITOR (sin tocar HTML)
  // =========================
  function elFromHTML(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function ensureEditorDOM() {
    if (document.getElementById("form-editar-servicio")) return;
    if (!modalDatosEdit) return;

    // Si ya existe, no lo recreamos
    if ($("edit-continente") && $("edit-tipo-servicio")) return;

    // Contenedor principal
    const root = elFromHTML(`
      <div id="ps-editor-root" style="display:flex; flex-direction:column; gap:14px; margin-top:10px;">
        <div style="display:grid; grid-template-columns: 200px 1fr; gap:10px; align-items:center;">
          <div class="muted">Continente</div>
          <select id="edit-continente"></select>

          <div class="muted">País</div>
          <select id="edit-pais"></select>

          <div class="muted">Ciudad</div>
          <select id="edit-ciudad"></select>

          <div class="muted">Tipo de servicio</div>
          <select id="edit-tipo-servicio"></select>

          <div class="muted">Proveedor</div>
          <select id="edit-id-proveedor"></select>

          <div class="muted">Tiempo del servicio</div>
          <div>
            <select id="edit-tiempo-servicio-select"></select>
            <input id="edit-tiempo-servicio-txt" placeholder="Escribe el tiempo..." style="margin-top:6px; width:100%; display:none;" />
          </div>

          <div class="muted">Privado</div>
          <select id="edit-privado">
            <option value="0">No</option>
            <option value="1">Sí</option>
          </select>

          <div class="muted">Link de reserva</div>
          <input id="edit-link-reserva" placeholder="https://..." />

          <div class="muted">Descripción</div>
          <textarea id="edit-descripcion" rows="3" placeholder="Describe el servicio..."></textarea>

          <div class="muted">Nombre del servicio (auto)</div>
          <input id="edit-nombre-auto" readonly />
        </div>

        <hr/>

        <div id="edit-sec-boleto" style="display:none;">
          <h4 style="margin:0 0 8px 0;">Boleto de entrada</h4>
          <div style="display:grid; grid-template-columns: 200px 1fr; gap:10px; align-items:center;">
            <div class="muted">Lugar</div>
            <div>
              <select id="edit-be-lugar-select"></select>
              <input id="edit-be-lugar-txt" placeholder="Escribe lugar..." style="margin-top:6px; width:100%; display:none;" />
            </div>

            <div class="muted">Tipo de entrada</div>
            <div>
              <select id="edit-be-tipo-entrada"></select>
              <input id="edit-be-tipo-entrada-txt" placeholder="Escribe tipo entrada..." style="margin-top:6px; width:100%; display:none;" />
            </div>

            <div class="muted">Tipo de guía</div>
            <div>
              <select id="edit-be-tipo-guia"></select>
              <input id="edit-be-tipo-guia-txt" placeholder="Escribe tipo guía..." style="margin-top:6px; width:100%; display:none;" />
            </div>

            <div class="muted">Idioma</div>
            <div>
              <select id="edit-be-idioma"></select>
              <input id="edit-be-idioma-txt" placeholder="Escribe idioma..." style="margin-top:6px; width:100%; display:none;" />
            </div>
          </div>
        </div>

        <div id="edit-sec-tour" style="display:none;">
          <h4 style="margin:0 0 8px 0;">Excursión / Visita</h4>
          <div style="display:grid; grid-template-columns: 200px 1fr; gap:10px; align-items:center;">
            <div class="muted">Tipo de guía</div>
            <div>
              <select id="edit-tu-tipo-guia"></select>
              <input id="edit-tu-tipo-guia-otro" placeholder="Escribe tipo guía..." style="margin-top:6px; width:100%; display:none;" />
            </div>

            <div class="muted">Idioma</div>
            <div>
              <select id="edit-tu-idioma"></select>
              <input id="edit-tu-idioma-txt" placeholder="Escribe idioma..." style="margin-top:6px; width:100%; display:none;" />
            </div>
          </div>
        </div>

        <div id="edit-sec-traslado" style="display:none;">
          <h4 style="margin:0 0 8px 0;">Traslado</h4>
          <div style="display:grid; grid-template-columns: 200px 1fr; gap:10px; align-items:center;">
            <div class="muted">Origen</div>
            <div>
              <select id="edit-tr-origen-select"></select>
              <input id="edit-tr-origen-txt" placeholder="Escribe origen..." style="margin-top:6px; width:100%; display:none;" />
            </div>

            <div class="muted">Destino</div>
            <div>
              <select id="edit-tr-destino"></select>
              <input id="edit-tr-destino-txt" placeholder="Escribe destino..." style="margin-top:6px; width:100%; display:none;" />
            </div>

            <div class="muted">Tipo de traslado</div>
            <div>
              <select id="edit-tr-tipo"></select>
              <input id="edit-tr-tipo-otro" placeholder="Escribe tipo traslado..." style="margin-top:6px; width:100%; display:none;" />
            </div>

            <div class="muted">Vehículo</div>
            <div>
              <select id="edit-tr-vehiculo"></select>
              <input id="edit-tr-vehiculo-txt" placeholder="Escribe vehículo..." style="margin-top:6px; width:100%; display:none;" />
            </div>

            <div class="muted">Nota</div>
            <textarea id="edit-tr-nota" rows="2" placeholder="Opcional..."></textarea>
          </div>
        </div>

        <div id="edit-sec-vuelo" style="display:none;">
          <h4 style="margin:0 0 8px 0;">Vuelo</h4>
          <div style="display:grid; grid-template-columns: 200px 1fr; gap:10px; align-items:center;">
            <div class="muted">Origen</div>
            <div>
              <select id="edit-vu-origen"></select>
              <input id="edit-vu-origen-txt" placeholder="Escribe origen..." style="margin-top:6px; width:100%; display:none;" />
            </div>

            <div class="muted">Destino</div>
            <div>
              <select id="edit-vu-destino"></select>
              <input id="edit-vu-destino-txt" placeholder="Escribe destino..." style="margin-top:6px; width:100%; display:none;" />
            </div>

            <div class="muted">Escalas</div>
            <select id="edit-vu-escalas"></select>

            <div class="muted">Clase</div>
            <select id="edit-vu-clase"></select>

            <div class="muted">Equipaje</div>
            <select id="edit-vu-equipaje"></select>
          </div>
        </div>

        <div id="edit-sec-tren" style="display:none;">
          <h4 style="margin:0 0 8px 0;">Tren</h4>
          <div style="display:grid; grid-template-columns: 200px 1fr; gap:10px; align-items:center;">
            <div class="muted">Origen</div>
            <div>
              <select id="edit-tr-origen"></select>
              <input id="edit-tr-origen-txt" placeholder="Escribe origen..." style="margin-top:6px; width:100%; display:none;" />
            </div>

            <div class="muted">Destino</div>
            <div>
              <select id="edit-tr-destino"></select>
              <input id="edit-tr-destino-txt" placeholder="Escribe el destino..." style="margin-top:6px; width:100%; display:none;" />
            </div>

            <div class="muted">Escalas</div>
            <select id="edit-tr-escalas"></select>

            <div class="muted">Clase</div>
            <select id="edit-tr-clase"></select>

            <div class="muted">Equipaje</div>
            <select id="edit-tr-equipaje"></select>

            <div class="muted">Asientos reservados</div>
            <select id="edit-tr-sillas">
              <option value="0">No</option>
              <option value="1">Sí</option>
            </select>
          </div>
        </div>

        <div id="edit-sec-alojamiento" style="display:none;">
          <h4 style="margin:0 0 8px 0;">Alojamiento (no usado aquí)</h4>
          <div class="muted">Este módulo es “NO alojamiento”, pero el editor soporta el tipo si lo necesitas.</div>
        </div>
      </div>
    `);

    // Insertamos al inicio del modal edit, sin borrar lo que tengas
    modalDatosEdit.prepend(root);
  }

  // =========================
  // Proveedores
  // =========================
  async function cargarProveedoresEditor() {
    const editProveedor = $("edit-id-proveedor");
    if (!editProveedor) return;

    const lista = await fetchLista("/api/proveedores", ["proveedores"]);
    proveedoresCache = Array.isArray(lista) ? lista : [];

    editProveedor.innerHTML = "";
    editProveedor.appendChild(new Option("(Seleccionar)", ""));
    proveedoresCache.forEach((p) => {
      const id = String(p.id ?? "");
      const nombre = String(p.nombre ?? `Proveedor ${id}`);
      if (id) editProveedor.appendChild(new Option(`${nombre} (${p.iniciales || ""})`, id));
    });
  }

  // =========================
  // Tipos / helpers
  // =========================
  function getTipoNombreById(idTipo) {
    const t = tiposServicioCache.find(x => String(x.id) === String(idTipo));
    return t?.nombre || "";
  }
  function esAlojamientoByTipoId(idTipo) {
    const nombre = getTipoNombreById(idTipo);
    return nombre.toLowerCase().includes("aloj");
  }

  function upsertOptionIntoSelect(selectEl, value, { keepWriteOption=true } = {}) {
    if (!selectEl || !value) return;

    const v = String(value).trim();
    if (!v) return;

    const opts = Array.from(selectEl.options || []);
    const exists = opts.some(o => String(o.value).trim().toLowerCase() === v.toLowerCase());

    if (!exists) {
      // Insertar antes de "__write__" si existe
      const writeOpt = opts.find(o => o.value === "__write__");
      const newOpt = new Option(v, v);

      if (writeOpt && keepWriteOption) {
        selectEl.insertBefore(newOpt, writeOpt);
      } else {
        selectEl.add(newOpt);
      }
    }

    selectEl.value = v;
  }

  function invalidateCatalog(grupo) {
    if (!grupo) return;
    delete catalogCache[grupo];
  }

  // Esta es la que llamas después de guardar exitosamente
  function refreshCatalogosAfterSave(tipoLower, payload) {
    // === TIEMPO SERVICIO ===
    if (payload?.tiempo_servicio) {
      invalidateCatalog("tiempo_servicio");
      upsertOptionIntoSelect($("edit-tiempo-servicio-select"), payload.tiempo_servicio);
      // ocultar txt si existe
      if ($("edit-tiempo-servicio-txt")) $("edit-tiempo-servicio-txt").style.display = "none";
    }

    // === BOLETO ===
    if (tipoLower.includes("boleto") && payload?.boleto_entrada) {
      const b = payload.boleto_entrada;

      if (b.boleto_entrada) {
        invalidateCatalog("boleto_lugar");
        upsertOptionIntoSelect($("edit-be-lugar-select"), b.boleto_entrada);
        if ($("edit-be-lugar-txt")) $("edit-be-lugar-txt").style.display = "none";
      }

      // idioma en boleto
      if (b.idioma) {
        invalidateCatalog("idiomas");
        upsertOptionIntoSelect($("edit-be-idioma"), b.idioma);
        if ($("edit-be-idioma-txt")) $("edit-be-idioma-txt").style.display = "none";
      }

      // tipo_entrada_otro si aplica
      if (b.tipo_entrada === "OTRA" && b.tipo_entrada_otro) {
        // aquí no es catálogo, pero sí select local: lo insertamos
        upsertOptionIntoSelect($("edit-be-tipo-entrada"), b.tipo_entrada_otro);
        if ($("edit-be-tipo-entrada-txt")) $("edit-be-tipo-entrada-txt").style.display = "none";
      }

      // tipo_guia si es escrito
      if (b.tipo_guia && b.tipo_guia !== "GUIA" && b.tipo_guia !== "AUDIOGUIA" && b.tipo_guia !== "NINGUNO") {
        upsertOptionIntoSelect($("edit-be-tipo-guia"), b.tipo_guia);
        if ($("edit-be-tipo-guia-txt")) $("edit-be-tipo-guia-txt").style.display = "none";
      }
    }

    // === TOUR ===
    if ((tipoLower.includes("excurs") || tipoLower.includes("visita") || tipoLower.includes("tour")) && payload?.tour) {
      const t = payload.tour;

      if (t.idioma && t.idioma !== "OTRO") {
        invalidateCatalog("idiomas");
        upsertOptionIntoSelect($("edit-tu-idioma"), t.idioma);
        if ($("edit-tu-idioma-txt")) $("edit-tu-idioma-txt").style.display = "none";
      }
      if (t.idioma === "OTRO" && t.idioma_otro) {
        invalidateCatalog("idiomas");
        upsertOptionIntoSelect($("edit-tu-idioma"), t.idioma_otro);
        if ($("edit-tu-idioma-txt")) $("edit-tu-idioma-txt").style.display = "none";
      }

      if (t.tipo_guia === "OTRO" && t.tipo_guia_otro) {
        // tipo guía tour NO viene de catalogo_opcion (por ahora), igual lo metemos al select local
        upsertOptionIntoSelect($("edit-tu-tipo-guia"), t.tipo_guia_otro);
        if ($("edit-tu-tipo-guia-otro")) $("edit-tu-tipo-guia-otro").style.display = "none";
      }
    }

    // === TRASLADO ===
    if (tipoLower.includes("trasl") && payload?.traslado) {
      const tr = payload.traslado;

      if (tr.origen) {
        invalidateCatalog("traslado_origen");
        upsertOptionIntoSelect($("edit-trs-origen-select"), tr.origen);
        if ($("edit-trs-origen-txt")) $("edit-trs-origen-txt").style.display = "none";
      }

      if (tr.destino) {
        invalidateCatalog("traslado_destino");
        upsertOptionIntoSelect($("edit-trs-destino-select"), tr.destino);
        if ($("edit-trs-destino-txt")) $("edit-trs-destino-txt").style.display = "none";
      }
    }

    // === VUELO ===
    if (tipoLower.includes("vuelo") && payload?.vuelo) {
      const v = payload.vuelo;

      if (v.origen) {
        invalidateCatalog("vuelo_origen");
        upsertOptionIntoSelect($("edit-vu-origen"), v.origen);
        if ($("edit-vu-origen-txt")) $("edit-vu-origen-txt").style.display = "none";
      }
      if (v.destino) {
        invalidateCatalog("vuelo_destino");
        upsertOptionIntoSelect($("edit-vu-destino"), v.destino);
      }
    }

    // === TREN ===
    if (tipoLower.includes("tren") && payload?.tren) {
      const t = payload.tren;

      if (t.origen) {
        invalidateCatalog("tren_origen");
        upsertOptionIntoSelect($("edit-tr-origen"), t.origen);
        if ($("edit-tr-origen-txt")) $("edit-tr-origen-txt").style.display = "none";
      }
      if (t.destino) {
        invalidateCatalog("tren_destino");
        upsertOptionIntoSelect($("edit-tr-destino"), t.destino);
        if ($("edit-tr-destino-txt")) $("edit-tr-destino-txt").style.display = "none";
      }
    }
  }

  function inferTipoTextoFromDetalle(det) {
    const txt = String(det?.tipo || det?.tipo_servicio || "").trim();
    if (txt) return txt.toLowerCase();
    const idTipo = det?.id_tipo ?? det?.tipo_id ?? det?.idTipo;
    if (idTipo != null) return String(getTipoNombreById(idTipo)).toLowerCase();
    return "";
  }

  function labelServicio(s) {
    const ciudad = (s.ciudad || "").trim();
    const txtBase = (s.servicio_texto || s.nombre_wtravel || `Servicio #${s.id}`).trim();
    return ciudad ? `[${ciudad}] ${txtBase}` : txtBase;
  }

  // =========================
  // Modal 1: Vista bonita (extendida + por tipo)
  // =========================
  function ensureMdExtraContainer() {
    const view = $("modal-datos-view");
    if (!view) return null;

    // Busca el grid existente
    const grid = view.querySelector(".modal-kv-grid") || view;
    let extra = $("md-extra");
    if (!extra) {
      extra = document.createElement("div");
      extra.id = "md-extra";
      // se mete al final del grid
      grid.appendChild(extra);
    }
    return extra;
  }

  function resetModalDatosBonito() {
    if (mdNombre) mdNombre.textContent = "—";
    if (mdCiudad) mdCiudad.textContent = "—";
    if (mdTipo) mdTipo.textContent = "—";
    if (mdProveedor) mdProveedor.textContent = "—";
    if (mdTiempo) mdTiempo.textContent = "—";
    if (mdPrivado) mdPrivado.textContent = "—";
    if (mdDescripcion) mdDescripcion.textContent = "—";

    if (mdLink) {
      mdLink.textContent = "—";
      mdLink.href = "#";
      mdLink.style.pointerEvents = "none";
      mdLink.style.opacity = "0.6";
    }

    const extra = ensureMdExtraContainer();
    if (extra) extra.innerHTML = "";
  }

  function kvRow(label, value) {
    const wrap = document.createElement("div");
    wrap.style.display = "contents";

    const k = document.createElement("div");
    k.className = "muted";
    k.textContent = label;

    const v = document.createElement("div");
    v.textContent = value || "—";

    wrap.appendChild(k);
    wrap.appendChild(v);
    return wrap;
  }

  // Lector flexible
  function pick(det, keys, fallback=null) {
    for (const k of keys) {
      const v = det?.[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return fallback;
  }

  function renderModalDatosBonito(det) {
    if (!det) return resetModalDatosBonito();

    const nombre = (det.nombre_wtravel || det.servicio_texto || det.nombre || "").trim();
    const ciudad = safeText(det.ciudad).trim();

    if (mdNombre) mdNombre.textContent = nombre || `Servicio #${det.id ?? ""}`;
    if (mdCiudad) mdCiudad.textContent = ciudad || "—";

    if (mdTipo) mdTipo.textContent = safeText(det.tipo || det.tipo_servicio) || "—";
    if (mdProveedor) mdProveedor.textContent = safeText(det.proveedor) || "—";
    if (mdTiempo) mdTiempo.textContent = safeText(det.tiempo_servicio) || "—";
    if (mdPrivado) mdPrivado.textContent = det.privado ? "Sí" : "No";
    if (mdDescripcion) mdDescripcion.textContent = safeText(det.descripcion) || "(sin descripción)";

    const link = safeText(det.link_reserva).trim();
    if (mdLink) {
      if (link) {
        mdLink.textContent = link;
        mdLink.href = link;
        mdLink.style.pointerEvents = "auto";
        mdLink.style.opacity = "1";
      } else {
        mdLink.textContent = "(sin link)";
        mdLink.href = "#";
        mdLink.style.pointerEvents = "none";
        mdLink.style.opacity = "0.6";
      }
    }

    // EXTRA: ubicación + campos por tipo
    const extra = ensureMdExtraContainer();
    if (!extra) return;
    extra.innerHTML = "";

    const base = servicioCacheById.get(String(det.id ?? "")) || null;

    const continente = pick(det, ["continente"], pick(base, ["continente_nombre","continente"], ""));
    const pais       = pick(det, ["pais"], pick(base, ["pais_nombre","pais"], ""));
    const ciudadTxt   = pick(det, ["ciudad"], pick(base, ["ciudad_nombre","ciudad"], ""));

    extra.appendChild(kvRow("Continente", safeText(continente) || "—"));
    extra.appendChild(kvRow("País", safeText(pais) || "—"));
    extra.appendChild(kvRow("Ciudad", safeText(ciudadTxt) || "—"));

    const tipoLower = inferTipoTextoFromDetalle(det);

    const bol  = det?.boleto_entrada || det?.boleto || det?.detalle_boleto || null;
    const trs  = det?.traslado || det?.detalle_traslado || null;
    const tour = det?.tour || det?.detalle_tour || null;
    const vue  = det?.vuelo || det?.detalle_vuelo || null;
    const tren = det?.tren || det?.detalle_tren || null;

    if (tipoLower.includes("boleto")) {
      extra.appendChild(kvRow("Lugar", safeText(pick(bol, ["boleto_entrada","lugar","entrada"], ""))));
      extra.appendChild(kvRow("Tipo de entrada", safeText(pick(bol, ["tipo_entrada_otro","tipo_entrada"], ""))));
      extra.appendChild(kvRow("Tipo de guía", safeText(pick(bol, ["tipo_guia_otro","tipo_guia"], ""))));
      extra.appendChild(kvRow("Idioma", safeText(pick(bol, ["idioma_otro","idioma"], ""))));
    }

    if (tipoLower.includes("excurs") || tipoLower.includes("visita") || tipoLower.includes("tour")) {
      extra.appendChild(kvRow("Tipo de guía", safeText(pick(tour, ["tipo_guia_otro","tipo_guia"], ""))));
      extra.appendChild(kvRow("Idioma", safeText(pick(tour, ["idioma_otro","idioma"], ""))));
    }

    if (tipoLower.includes("trasl")) {
      extra.appendChild(kvRow("Origen", safeText(pick(trs, ["origen_otro","origen"], ""))));
      extra.appendChild(kvRow("Destino", safeText(pick(trs, ["destino_otro","destino"], ""))));
      extra.appendChild(kvRow("Tipo de traslado", safeText(pick(trs, ["tipo_traslado_otro","tipo_traslado"], ""))));
      extra.appendChild(kvRow("Vehículo", safeText(pick(trs, ["vehiculo_otro","vehiculo"], ""))));
    }

    if (tipoLower.includes("vuelo")) {
      extra.appendChild(kvRow("Origen", safeText(pick(vue, ["origen_otro","origen"], ""))));
      extra.appendChild(kvRow("Destino", safeText(pick(vue, ["destino"], ""))));
      extra.appendChild(kvRow("Escalas", safeText(pick(vue, ["escalas"], ""))));
      extra.appendChild(kvRow("Clase", safeText(pick(vue, ["clase"], ""))));
      extra.appendChild(kvRow("Equipaje", safeText(pick(vue, ["equipaje"], ""))));
    }

    if (tipoLower.includes("tren")) {
      extra.appendChild(kvRow("Origen", safeText(pick(tren, ["origen_otro","origen"], ""))));
      extra.appendChild(kvRow("Destino", safeText(pick(tren, ["destino"], ""))));
      extra.appendChild(kvRow("Escalas", safeText(pick(tren, ["escalas"], ""))));
      extra.appendChild(kvRow("Clase", safeText(pick(tren, ["clase"], ""))));
      extra.appendChild(kvRow("Equipaje", safeText(pick(tren, ["equipaje"], ""))));
      extra.appendChild(kvRow("Asientos reservados", pick(tren, ["sillas_reservadas"], false) ? "Sí" : "No"));
    }
  }

  // =========================
  // Modal 1: edición FULL
  // =========================
  function toggleEditModalDatos(on) {
    modalDatosIsEditing = !!on;
    setMsgEditar("");

    if (modalDatosView) show(modalDatosView, !on);
    if (modalDatosEdit) show(modalDatosEdit, on);

    if (btnModalDatosEditar)   show(btnModalDatosEditar, !on);
    if (btnModalDatosGuardar)  show(btnModalDatosGuardar, on);
    if (btnModalDatosCancelar) show(btnModalDatosCancelar, on);
  }

  function ocultarTodasLasSeccionesEdit() {
    ["edit-sec-alojamiento","edit-sec-boleto","edit-sec-vuelo","edit-sec-tren","edit-sec-traslado","edit-sec-tour"]
      .forEach(id => show($(id), false));
  }

  function mostrarSeccionEditPorTipo(tipoLower) {
    ocultarTodasLasSeccionesEdit();

    if (!tipoLower) return;
    if (tipoLower.includes("aloj")) return show($("edit-sec-alojamiento"), true);
    if (tipoLower.includes("boleto")) return show($("edit-sec-boleto"), true);
    if (tipoLower.includes("vuelo")) return show($("edit-sec-vuelo"), true);
    if (tipoLower.includes("tren")) return show($("edit-sec-tren"), true);
    if (tipoLower.includes("trasl")) return show($("edit-sec-traslado"), true);
    if (tipoLower.includes("excurs") || tipoLower.includes("visita") || tipoLower.includes("tour")) return show($("edit-sec-tour"), true);
  }

  // =========================
  // Editor: ubicación + tipo
  // =========================
  async function cargarContinentesEditor() {
    const editContinente = $("edit-continente");
    if (!editContinente) return;
    const lista = await fetchLista("/api/continentes", ["continentes"]);
    addOptions(
      editContinente,
      lista.map(x => ({ value: String(x.id), text: x.nombre })),
      { firstText: "(Seleccionar)", firstValue: "" }
    );
  }

  async function cargarPaisesEditor(idContinente) {
    const editPais = $("edit-pais");
    const editCiudad = $("edit-ciudad");
    if (!editPais || !editCiudad) return;

    if (!idContinente) {
      addOptions(editPais, [], { firstText: "(Seleccionar)", firstValue: "" });
      addOptions(editCiudad, [], { firstText: "(Seleccionar)", firstValue: "" });
      return;
    }
    const lista = await fetchLista(`/api/paises/${idContinente}`, ["paises"]);
    addOptions(
      editPais,
      lista.map(x => ({ value: String(x.id), text: x.nombre })),
      { firstText: "(Seleccionar)", firstValue: "" }
    );
    addOptions(editCiudad, [], { firstText: "(Seleccionar)", firstValue: "" });
  }

  async function cargarCiudadesEditor(idPais) {
    const editCiudad = $("edit-ciudad");
    if (!editCiudad) return;
    if (!idPais) {
      addOptions(editCiudad, [], { firstText: "(Seleccionar)", firstValue: "" });
      return;
    }
    const lista = await fetchLista(`/api/ciudades/${idPais}`, ["ciudades"]);
    addOptions(
      editCiudad,
      lista.map(x => ({ value: String(x.id), text: x.nombre })),
      { firstText: "(Seleccionar)", firstValue: "" }
    );
  }

  async function cargarTiposServicioEditor() {
    const editTipoServ = $("edit-tipo-servicio");
    if (!editTipoServ) return;
    const lista = await fetchLista("/api/tiposervicio", ["tipos", "tipos_servicio", "tiposervicio"]);
    addOptions(
      editTipoServ,
      (lista || []).map(t => ({ value: String(t.id), text: t.nombre })),
      { firstText: "(Seleccionar)", firstValue: "" }
    );
  }

  function getTipoLowerFromEditor() {
    const editTipoServ = $("edit-tipo-servicio");
    const txt = (editTipoServ?.selectedOptions?.[0]?.textContent || "").trim().toLowerCase();
    if (txt) return txt;
    const v = (editTipoServ?.value || "").trim();
    if (v) return String(getTipoNombreById(v)).toLowerCase();
    return "";
  }

  // =========================
  // Tiempo servicio (catálogo + escribir)
  // =========================
  async function initTiempoServicioEditor() {
    const editTiempoSelect = $("edit-tiempo-servicio-select");
    const editTiempoTxt = $("edit-tiempo-servicio-txt");
    if (!editTiempoSelect) return;
    try {
      const cat = await cargarCatalogo("tiempo_servicio");
      const opts = [
        ...cat.map(x => ({ value: x.valor, text: x.valor })),
        { value: "__write__", text: "Escribir nuevo..." },
      ];
      addOptions(editTiempoSelect, opts, { firstText: "(Elegir de catálogo)", firstValue: "" });
    } catch {
      addOptions(editTiempoSelect, [{ value:"__write__", text:"Escribir nuevo..." }], { firstText:"(Elegir de catálogo)", firstValue:"" });
    }
    initSelectConEscribirNuevo(editTiempoSelect, editTiempoTxt);
  }

  function getTiempoEditValue() {
    const editTiempoSelect = $("edit-tiempo-servicio-select");
    const editTiempoTxt = $("edit-tiempo-servicio-txt");
    const v = String(editTiempoSelect?.value || "").trim();
    if (!v) return null;
    if (v !== "__write__") return v;
    return String(editTiempoTxt?.value || "").trim() || null;
  }

  // =========================
  // Nombre automático (estilo cotizacion-editar)
  // =========================
  function valOrTxtFromSelectWrite(selId, txtId) {
    return (leerSelectOEscribir($(selId), $(txtId)) || "").trim();
  }

  function recomputeNombreAuto() {
    const editNombreAuto = $("edit-nombre-auto");
    if (!editNombreAuto) return;

    const editDesc = $("edit-descripcion");
    const editPrivado = $("edit-privado");

    const tipoLower = getTipoLowerFromEditor();
    const desc = (editDesc?.value || "").trim();
    const privado = String(editPrivado?.value || "0") === "1";
    const tiempo = (getTiempoEditValue() || "").trim();

    const parts = [];

    if (desc) parts.push(desc);
    parts.push(privado ? "privado" : "en grupo");
    if (tiempo) parts.push(tiempo);

    // ===== BOLETO =====
    if (tipoLower.includes("boleto")) {
      const lugar = valOrTxtFromSelectWrite("edit-be-lugar-select", "edit-be-lugar-txt");
      const tipoEntrada = valOrTxtFromSelectWrite("edit-be-tipo-entrada", "edit-be-tipo-entrada-txt");
      const tipoGuia = valOrTxtFromSelectWrite("edit-be-tipo-guia", "edit-be-tipo-guia-txt");
      const idioma = valOrTxtFromSelectWrite("edit-be-idioma", "edit-be-idioma-txt");

      const extra = [];
      if (lugar) extra.push(lugar);
      if (tipoEntrada) extra.push(tipoEntrada);
      if (tipoGuia && tipoGuia !== "NINGUNO") extra.push(tipoGuia.toLowerCase());
      if (idioma) extra.push(`en ${idioma}`);

      if (extra.length) parts.unshift(extra.join(", "));
    }

    // ===== TRASLADO =====
    if (tipoLower.includes("trasl")) {
      const origen  = valOrTxtFromSelectWrite("edit-trs-origen-select", "edit-trs-origen-txt");
      const destino = valOrTxtFromSelectWrite("edit-trs-destino-select", "edit-trs-destino-txt");
      const tipoTr  = valOrTxtFromSelectWrite("edit-trs-tipo", "edit-trs-tipo-otro");
      const veh     = valOrTxtFromSelectWrite("edit-trs-vehiculo", "edit-trs-vehiculo-txt");

      const extra = [];
      if (origen && destino) extra.push(`${origen} → ${destino}`);
      else if (origen) extra.push(origen);
      if (tipoTr) extra.push(tipoTr.replaceAll("_", " ").toLowerCase());
      if (veh) extra.push(veh.toLowerCase());

      if (extra.length) parts.unshift(extra.join(", "));
    }

    // ===== TOUR =====
    if (tipoLower.includes("excurs") || tipoLower.includes("visita") || tipoLower.includes("tour")) {
      const tg = valOrTxtFromSelectWrite("edit-tu-tipo-guia", "edit-tu-tipo-guia-otro");
      const id = valOrTxtFromSelectWrite("edit-tu-idioma", "edit-tu-idioma-txt");
      const extra = [];
      if (tg) extra.push(tg.toLowerCase());
      if (id) extra.push(`en ${id}`);
      if (extra.length) parts.push(extra.join(", "));
    }

    // ===== VUELO =====
    if (tipoLower.includes("vuelo")) {
      const origen = valOrTxtFromSelectWrite("edit-vu-origen", "edit-vu-origen-txt");

      // ✅ CAMBIO: destino también con escribir nuevo
      const destino = valOrTxtFromSelectWrite("edit-vu-destino", "edit-vu-destino-txt");

      const clase = ($("edit-vu-clase")?.value || "").trim();
      const escalas = ($("edit-vu-escalas")?.value || "").trim();
      const equipaje = ($("edit-vu-equipaje")?.value || "").trim();

      const extra = [];
      if (origen && destino) extra.push(`${origen} → ${destino}`);
      if (clase) extra.push(clase.toLowerCase());
      if (escalas) extra.push(`${escalas} escala(s)`);
      if (equipaje) extra.push(equipaje.toLowerCase());
      if (extra.length) parts.unshift(extra.join(", "));
    }

    // ===== TREN =====
    if (tipoLower.includes("tren")) {
      const origen  = valOrTxtFromSelectWrite("edit-tr-origen", "edit-tr-origen-txt");
      const destino = valOrTxtFromSelectWrite("edit-tr-destino", "edit-tr-destino-txt");
      const clase = ($("edit-tr-clase")?.value || "").trim();
      const escalas = ($("edit-tr-escalas")?.value || "").trim();
      const equipaje = ($("edit-tr-equipaje")?.value || "").trim();
      const sillas = ($("edit-tr-sillas")?.value || "0") === "1";

      const extra = [];
      if (origen && destino) extra.push(`${origen} → ${destino}`);
      if (clase) extra.push(clase.toLowerCase());
      if (escalas) extra.push(`${escalas} escala(s)`);
      if (equipaje) extra.push(equipaje.toLowerCase());
      if (sillas) extra.push("asientos reservados");
      if (extra.length) parts.unshift(extra.join(", "));
    }

    const ciudadTxt = $("edit-ciudad")?.selectedOptions?.[0]?.textContent?.trim() || "";
    if (ciudadTxt) parts.push(ciudadTxt.toUpperCase());

    const final = parts.map(x => String(x).trim()).filter(Boolean).join(" · ");
    editNombreAuto.value = final || desc || "Servicio";
  }

  // =========================
  // Inicializa selects del editor (catálogos + escribir)
  // =========================
  let _editorInited = false;
  async function initEditorOnce() {
    if (_editorInited) return;
    _editorInited = true;

    // 1) Creamos DOM faltante
    ensureEditorDOM();

    // 2) Cargamos catálogos base
    await cargarProveedoresEditor();
    await initTiempoServicioEditor();
    await cargarContinentesEditor();
    await cargarTiposServicioEditor();

    // 3) Selections especiales
    addOptions($("edit-be-tipo-entrada"), [
      { value:"ESTANDAR", text:"Estándar" },
      { value:"VIP", text:"VIP" },
      { value:"FAST_TRACK", text:"Fast track" },
      { value:"__write__", text:"Escribir nuevo..." },
    ], { firstText:"(Seleccionar tipo)", firstValue:"" });
    initSelectConEscribirNuevo($("edit-be-tipo-entrada"), $("edit-be-tipo-entrada-txt"));

    addOptions($("edit-be-tipo-guia"), [
      { value:"GUIA", text:"Guía" },
      { value:"AUDIOGUIA", text:"Audioguía" },
      { value:"NINGUNO", text:"Ninguno" },
      { value:"__write__", text:"Escribir nuevo..." },
    ], { firstText:"(Seleccionar)", firstValue:"" });
    initSelectConEscribirNuevo($("edit-be-tipo-guia"), $("edit-be-tipo-guia-txt"));

    addOptions($("edit-trs-tipo"), [
      { value:"AEROPUERTO_HOTEL", text:"Aeropuerto → Hotel" },
      { value:"HOTEL_AEROPUERTO", text:"Hotel → Aeropuerto" },
      { value:"ESTACION_HOTEL", text:"Estación → Hotel" },
      { value:"HOTEL_ESTACION", text:"Hotel → Estación" },
      { value:"PUERTO_HOTEL", text:"Puerto → Hotel" },
      { value:"HOTEL_PUERTO", text:"Hotel → Puerto" },
      { value:"HOTEL_HOTEL", text:"Hotel → Hotel" },
      { value:"__write__", text:"Escribir nuevo..." },
    ], { firstText:"(Seleccionar)", firstValue:"" });
    initSelectConEscribirNuevo($("edit-trs-tipo"), $("edit-trs-tipo-otro"));

    addOptions($("edit-trs-vehiculo"), [
      { value:"SEDAN", text:"Sedán" },
      { value:"VAN", text:"Van" },
      { value:"MINIBUS", text:"Minibús" },
      { value:"BUS", text:"Bus" },
      { value:"__write__", text:"Escribir nuevo..." },
    ], { firstText:"(Seleccionar)", firstValue:"" });
    initSelectConEscribirNuevo($("edit-trs-vehiculo"), $("edit-trs-vehiculo-txt"));

    addOptions($("edit-tu-tipo-guia"), [
      { value:"GUIA", text:"Guía" },
      { value:"AUDIOGUIA", text:"Audioguía" },
      { value:"CHOFER_GUIA", text:"Chofer-guía" },
      { value:"__write__", text:"Escribir nuevo..." },
    ], { firstText:"(Seleccionar)", firstValue:"" });
    initSelectConEscribirNuevo($("edit-tu-tipo-guia"), $("edit-tu-tipo-guia-otro"));

    // ✅ NUEVO: Idioma de TOUR (igual que boleto, viene de catálogo "idiomas")
    await fillSelectCatalogoConEscribir(
      $("edit-tu-idioma"),
      $("edit-tu-idioma-txt"),
      "idiomas",
      { firstText:"(Seleccionar idioma)", firstValue:"" }
    );

    // 4) Catálogos con “escribir”
    await fillSelectCatalogoConEscribir($("edit-be-lugar-select"), $("edit-be-lugar-txt"), "boleto_lugar", { firstText:"(Elegir de catálogo)", firstValue:"" });
    await fillSelectCatalogoConEscribir($("edit-be-idioma"), $("edit-be-idioma-txt"), "idiomas", { firstText:"(Seleccionar idioma)", firstValue:"" });

    await fillSelectCatalogoConEscribir($("edit-trs-origen-select"),$("edit-trs-origen-txt"),"traslado_origen",{ firstText:"(Elegir de catálogo)", firstValue:"" });
    await fillSelectCatalogoConEscribir($("edit-trs-destino-select"),$("edit-trs-destino-txt"),"traslado_destino",{ firstText:"(Elegir de catálogo)", firstValue:"" });

    // ===== VUELO (con escribir en origen y destino) =====
    await fillSelectCatalogoConEscribir($("edit-vu-origen"), $("edit-vu-origen-txt"), "vuelo_origen", { firstText:"(Seleccionar)", firstValue:"" });
    await fillSelectCatalogoConEscribir($("edit-vu-destino"), $("edit-vu-destino-txt"), "vuelo_destino", { firstText:"(Seleccionar)", firstValue:"" });
    await fillSelectFromCatalog($("edit-vu-clase"), "vuelo_clase", { firstText:"(Seleccionar)", firstValue:"" });
    await fillSelectFromCatalog($("edit-vu-equipaje"), "vuelo_equipaje", { firstText:"(Seleccionar)", firstValue:"" });
    addOptions($("edit-vu-escalas"), [0,1,2,3].map(n => ({ value:String(n), text:String(n) })), { firstText:"(Seleccionar)", firstValue:"" });

    // ===== TREN (con escribir en origen y destino) =====
    await fillSelectCatalogoConEscribir($("edit-tr-origen"), $("edit-tr-origen-txt"), "tren_origen", { firstText:"(Seleccionar)", firstValue:"" });
    await fillSelectCatalogoConEscribir($("edit-tr-destino"), $("edit-tr-destino-txt"), "tren_destino", { firstText:"(Seleccionar)", firstValue:"" });
    await fillSelectFromCatalog($("edit-tr-clase"), "tren_clase", { firstText:"(Seleccionar)", firstValue:"" });
    await fillSelectFromCatalog($("edit-tr-equipaje"), "tren_equipaje", { firstText:"(Seleccionar)", firstValue:"" });
    addOptions($("edit-tr-escalas"), [0,1,2,3].map(n => ({ value:String(n), text:String(n) })), { firstText:"(Seleccionar)", firstValue:"" });

    // 5) listeners cascada ubicación
    $("edit-continente")?.addEventListener("change", async () => {
      await cargarPaisesEditor($("edit-continente").value || null);
      recomputeNombreAuto();
    });

    $("edit-pais")?.addEventListener("change", async () => {
      await cargarCiudadesEditor($("edit-pais").value || null);
      recomputeNombreAuto();
    });

    $("edit-ciudad")?.addEventListener("change", recomputeNombreAuto);

    $("edit-tipo-servicio")?.addEventListener("change", () => {
      const tipoLower = getTipoLowerFromEditor();
      mostrarSeccionEditPorTipo(tipoLower);
      recomputeNombreAuto();
    });

    // triggers nombre
    [
      "edit-privado","edit-descripcion",
      "edit-tiempo-servicio-select","edit-tiempo-servicio-txt",
      "edit-be-lugar-select","edit-be-lugar-txt","edit-be-tipo-entrada","edit-be-tipo-entrada-txt","edit-be-tipo-guia","edit-be-tipo-guia-txt","edit-be-idioma","edit-be-idioma-txt",
      "edit-tu-tipo-guia","edit-tu-tipo-guia-otro","edit-tu-idioma","edit-tu-idioma-txt",
      "edit-trs-origen-select","edit-trs-origen-txt","edit-trs-destino-select","edit-trs-destino-txt","edit-trs-tipo","edit-trs-tipo-otro","edit-trs-vehiculo","edit-trs-vehiculo-txt","edit-trs-nota",
      "edit-vu-origen","edit-vu-origen-txt","edit-vu-destino","edit-vu-clase","edit-vu-equipaje","edit-vu-escalas",
      "edit-tr-origen","edit-tr-origen-txt","edit-tr-destino","edit-tr-destino-txt","edit-tr-clase","edit-tr-equipaje","edit-tr-escalas","edit-tr-sillas"
    ].forEach(id => $(id)?.addEventListener(
      id.endsWith("-txt") || id.endsWith("-otro") ? "input" : "change",
      recomputeNombreAuto
    ));
  }


  function fillBaseEditFromDetalle(det) {
    const editProveedor = $("edit-id-proveedor");
    const editTiempoSelect = $("edit-tiempo-servicio-select");
    const editTiempoTxt = $("edit-tiempo-servicio-txt");
    const editPrivado = $("edit-privado");
    const editLink = $("edit-link-reserva");
    const editDesc = $("edit-descripcion");

    if (editProveedor) editProveedor.value = String(pick(det, ["id_proveedor","proveedor_id","idProveedor"], ""));

    const tiempo = String(pick(det, ["tiempo_servicio","tiempo"], "")).trim();
    if (editTiempoSelect) {
      const opts = Array.from(editTiempoSelect.options || []);
      const exists = opts.some(o => o.value === tiempo);
      if (exists) {
        editTiempoSelect.value = tiempo;
        if (editTiempoTxt) show(editTiempoTxt, false);
      } else {
        editTiempoSelect.value = "__write__";
        if (editTiempoTxt) {
          show(editTiempoTxt, true);
          editTiempoTxt.value = tiempo;
        }
      }
    }

    if (editPrivado) editPrivado.value = det?.privado ? "1" : "0";
    if (editLink) editLink.value = String(pick(det, ["link_reserva","link","url"], "") || "");
    if (editDesc) editDesc.value = String(pick(det, ["descripcion","descripcion_servicio","desc"], "") || "");
  }

  function fillDinamicoEditFromDetalle(det, tipoLower) {
  const bol  = det?.boleto_entrada || det?.boleto || det?.detalle_boleto || null;
  const trs  = det?.traslado || det?.detalle_traslado || null;
  const tour = det?.tour || det?.detalle_tour || null;
  const vue  = det?.vuelo || det?.detalle_vuelo || null;
  const tren = det?.tren || det?.detalle_tren || null;

  // ===== BOLETO =====
  if (tipoLower.includes("boleto")) {
    const lugarSel = $("edit-be-lugar-select");
    const lugarTxt = $("edit-be-lugar-txt");
    const lugarVal = pick(bol, ["boleto_entrada","lugar","entrada"], pick(det, ["boleto_entrada"], ""));
    if (lugarSel) {
      const exists = Array.from(lugarSel.options || []).some(o => o.value === lugarVal);
      if (exists) { lugarSel.value = lugarVal; show(lugarTxt, false); }
      else if (lugarVal) { lugarSel.value = "__write__"; show(lugarTxt, true); if (lugarTxt) lugarTxt.value = String(lugarVal); }
      else { lugarSel.value = ""; show(lugarTxt, false); }
    }

    const teSel = $("edit-be-tipo-entrada");
    const teTxt = $("edit-be-tipo-entrada-txt");
    const teVal = pick(bol, ["tipo_entrada","tipo_entrada_otro"], "");
    if (teSel) {
      const exists = Array.from(teSel.options || []).some(o => o.value === teVal);
      if (exists) { teSel.value = teVal; show(teTxt, false); }
      else if (teVal) { teSel.value = "__write__"; show(teTxt, true); if (teTxt) teTxt.value = String(teVal); }
      else { teSel.value = ""; show(teTxt, false); }
    }

    const tgSel = $("edit-be-tipo-guia");
    const tgTxt = $("edit-be-tipo-guia-txt");
    const tgVal = pick(bol, ["tipo_guia","tipo_guia_otro"], pick(det, ["tipo_guia"], ""));
    if (tgSel) {
      const exists = Array.from(tgSel.options || []).some(o => o.value === tgVal);
      if (exists) { tgSel.value = tgVal; show(tgTxt, false); }
      else if (tgVal) { tgSel.value = "__write__"; show(tgTxt, true); if (tgTxt) tgTxt.value = String(tgVal); }
      else { tgSel.value = ""; show(tgTxt, false); }
    }

    const idSel = $("edit-be-idioma");
    const idTxt = $("edit-be-idioma-txt");
    const idVal = pick(bol, ["idioma","idioma_otro"], "");
    if (idSel) {
      const exists = Array.from(idSel.options || []).some(o => o.value === idVal);
      if (exists) { idSel.value = idVal; show(idTxt, false); }
      else if (idVal) { idSel.value = "__write__"; show(idTxt, true); if (idTxt) idTxt.value = String(idVal); }
      else { idSel.value = ""; show(idTxt, false); }
    }
  }

  // ===== TRASLADO =====
  if (tipoLower.includes("trasl")) {
    const oSel = $("edit-trs-origen-select");
    const oTxt = $("edit-trs-origen-txt");
    const oVal = pick(trs, ["origen","origen_otro"], "");
    if (oSel) {
      const exists = Array.from(oSel.options || []).some(o => o.value === oVal);
      if (exists) { oSel.value = oVal; show(oTxt, false); }
      else if (oVal) { oSel.value = "__write__"; show(oTxt, true); if (oTxt) oTxt.value = String(oVal); }
      else { oSel.value = ""; show(oTxt, false); }
    }

    const dSel = $("edit-trs-destino-select");
    const dTxt = $("edit-trs-destino-txt");
    const dVal = pick(trs, ["destino","destino_otro"], "");
    if (dSel) {
      const exists = Array.from(dSel.options || []).some(o => o.value === dVal);
      if (exists) { dSel.value = dVal; show(dTxt, false); }
      else if (dVal) { dSel.value = "__write__"; show(dTxt, true); if (dTxt) dTxt.value = String(dVal); }
      else { dSel.value = ""; show(dTxt, false); }
    }

    const ttSel = $("edit-trs-tipo");
    const ttTxt = $("edit-trs-tipo-otro");
    const ttVal = pick(trs, ["tipo_traslado","tipo_traslado_otro"], "");
    if (ttSel) {
      const exists = Array.from(ttSel.options || []).some(o => o.value === ttVal);
      if (exists) { ttSel.value = ttVal; show(ttTxt, false); }
      else if (ttVal) { ttSel.value = "__write__"; show(ttTxt, true); if (ttTxt) ttTxt.value = String(ttVal); }
      else { ttSel.value = ""; show(ttTxt, false); }
    }

    const vhSel = $("edit-trs-vehiculo");
    const vhTxt = $("edit-trs-vehiculo-txt");
    const vhVal = pick(trs, ["vehiculo","vehiculo_otro"], "");
    if (vhSel) {
      const exists = Array.from(vhSel.options || []).some(o => o.value === vhVal);
      if (exists) { vhSel.value = vhVal; show(vhTxt, false); }
      else if (vhVal) { vhSel.value = "__write__"; show(vhTxt, true); if (vhTxt) vhTxt.value = String(vhVal); }
      else { vhSel.value = ""; show(vhTxt, false); }
    }

    if ($("edit-trs-nota")) $("edit-trs-nota").value = String(pick(trs, ["nota"], "")) || "";
  }

  // ===== TOUR =====
  if (tipoLower.includes("excurs") || tipoLower.includes("visita") || tipoLower.includes("tour")) {
    const tgSel = $("edit-tu-tipo-guia");
    const tgTxt = $("edit-tu-tipo-guia-otro");
    const tgVal = pick(tour, ["tipo_guia","tipo_guia_otro"], "");
    if (tgSel) {
      const exists = Array.from(tgSel.options || []).some(o => o.value === tgVal);
      if (exists) { tgSel.value = tgVal; show(tgTxt, false); }
      else if (tgVal) { tgSel.value = "__write__"; show(tgTxt, true); if (tgTxt) tgTxt.value = String(tgVal); }
      else { tgSel.value = ""; show(tgTxt, false); }
    }

    const idSel = $("edit-tu-idioma");
    const idTxt = $("edit-tu-idioma-txt");
    const idVal = pick(tour, ["idioma","idioma_otro"], "");
    if (idSel) {
      const exists = Array.from(idSel.options || []).some(o => o.value === idVal);
      if (exists) { idSel.value = idVal; show(idTxt, false); }
      else if (idVal) { idSel.value = "__write__"; show(idTxt, true); if (idTxt) idTxt.value = String(idVal); }
      else { idSel.value = ""; show(idTxt, false); }
    }
  }

  // ===== VUELO =====
  if (tipoLower.includes("vuelo")) {
    // ✅ ORIGEN (faltaba en tu función)
    const oSel = $("edit-vu-origen");
    const oTxt = $("edit-vu-origen-txt");
    const oVal = String(pick(vue, ["origen","origen_otro"], "") || "").trim();
    if (oSel) {
      const exists = Array.from(oSel.options || []).some(o => o.value === oVal);
      if (exists) { oSel.value = oVal; show(oTxt, false); }
      else if (oVal) { oSel.value = "__write__"; show(oTxt, true); if (oTxt) oTxt.value = oVal; }
      else { oSel.value = ""; show(oTxt, false); }
    }

    // ✅ DESTINO (lo dejé como lo tenías, está bien)
    const dSel = $("edit-vu-destino");
    const dTxt = $("edit-vu-destino-txt");
    const dVal = String(pick(vue, ["destino"], "") || "").trim();
    if (dSel) {
      const exists = Array.from(dSel.options || []).some(o => o.value === dVal);
      if (exists) { dSel.value = dVal; show(dTxt, false); }
      else if (dVal) { dSel.value = "__write__"; show(dTxt, true); if (dTxt) dTxt.value = dVal; }
      else { dSel.value = ""; show(dTxt, false); }
    }

    if ($("edit-vu-clase")) $("edit-vu-clase").value = String(pick(vue, ["clase"], "")) || "";
    if ($("edit-vu-equipaje")) $("edit-vu-equipaje").value = String(pick(vue, ["equipaje"], "")) || "";
    if ($("edit-vu-escalas")) $("edit-vu-escalas").value = String(pick(vue, ["escalas"], "")) || "";
  }

  // ===== TREN =====
  if (tipoLower.includes("tren")) {
    // ✅ ORIGEN (faltaba en tu función)
    const oSel = $("edit-tr-origen");
    const oTxt = $("edit-tr-origen-txt");
    const oVal = String(pick(tren, ["origen","origen_otro"], "") || "").trim();
    if (oSel) {
      const exists = Array.from(oSel.options || []).some(o => o.value === oVal);
      if (exists) { oSel.value = oVal; show(oTxt, false); }
      else if (oVal) { oSel.value = "__write__"; show(oTxt, true); if (oTxt) oTxt.value = oVal; }
      else { oSel.value = ""; show(oTxt, false); }
    }

    // ✅ DESTINO (tu versión estaba bien, le puse trim)
    const dSel = $("edit-tr-destino");
    const dTxt = $("edit-tr-destino-txt");
    const dVal = String(pick(tren, ["destino"], "") || "").trim();
    if (dSel) {
      const exists = Array.from(dSel.options || []).some(o => o.value === dVal);
      if (exists) { dSel.value = dVal; show(dTxt, false); }
      else if (dVal) { dSel.value = "__write__"; show(dTxt, true); if (dTxt) dTxt.value = dVal; }
      else { dSel.value = ""; show(dTxt, false); }
    }

    if ($("edit-tr-clase")) $("edit-tr-clase").value = String(pick(tren, ["clase"], "")) || "";
    if ($("edit-tr-equipaje")) $("edit-tr-equipaje").value = String(pick(tren, ["equipaje"], "")) || "";
    if ($("edit-tr-escalas")) $("edit-tr-escalas").value = String(pick(tren, ["escalas"], "")) || "";
    if ($("edit-tr-sillas")) $("edit-tr-sillas").value = pick(tren, ["sillas_reservadas"], false) ? "1" : "0";
  }
}


  function buildPayloadFromEditor(tipoLower) {
    const editTipoServ = $("edit-tipo-servicio");
    const editCiudad = $("edit-ciudad");
    const editNombreAuto = $("edit-nombre-auto");
    const editProveedor = $("edit-id-proveedor");
    const editPrivado = $("edit-privado");
    const editDesc = $("edit-descripcion");
    const editLink = $("edit-link-reserva");

    const idTipo = Number(String(editTipoServ?.value || "").trim() || 0);
    const idCiudad = Number(String(editCiudad?.value || "").trim() || 0);

    const payload = {
      id_tipo: idTipo || undefined,
      id_ciudad: idCiudad || undefined,

      // solo manda si hay algo
      nombre_wtravel: (editNombreAuto?.value || "").trim() || undefined,

      id_proveedor: Number(String(editProveedor?.value || "").trim() || 0) || undefined,
      tiempo_servicio: getTiempoEditValue() || undefined,

      // privado siempre manda (porque el select siempre tiene 0/1)
      privado: String(editPrivado?.value || "0") === "1",

      descripcion: (editDesc?.value || "").trim() || undefined,
      link_reserva: (editLink?.value || "").trim() || undefined,
    };

    if (tipoLower.includes("boleto")) {
      const teSel = $("edit-be-tipo-entrada");
      const teTxt = $("edit-be-tipo-entrada-txt");
      const lugarSel = $("edit-be-lugar-select");
      const lugarTxt = $("edit-be-lugar-txt");
      const idiomaSel = $("edit-be-idioma");
      const idiomaTxt = $("edit-be-idioma-txt");
      const tgSel = $("edit-be-tipo-guia");
      const tgTxt = $("edit-be-tipo-guia-txt");

      const teVal = leerSelectOEscribir(teSel, teTxt);
      const lugarVal = leerSelectOEscribir(lugarSel, lugarTxt);
      const idiomaVal = leerSelectOEscribir(idiomaSel, idiomaTxt);
      const tgVal = leerSelectOEscribir(tgSel, tgTxt);

      payload.boleto_entrada = {
        boleto_entrada: lugarVal || null,
        tipo_entrada: teSel?.value === "__write__" ? "OTRA" : (teSel?.value || null),
        tipo_entrada_otro: teSel?.value === "__write__" ? teVal : null,
        tipo_guia: tgSel?.value === "__write__" ? tgVal : (tgSel?.value || null),
        idioma: idiomaVal || null,
      };
    }

    if (tipoLower.includes("trasl")) {
      const tipoSel = $("edit-trs-tipo");
      const tipoTxt = $("edit-trs-tipo-otro");
      const vehSel  = $("edit-trs-vehiculo");
      const vehTxt  = $("edit-trs-vehiculo-txt");
      const origSel = $("edit-trs-origen-select");
      const origTxt = $("edit-trs-origen-txt");
      const destSel = $("edit-trs-destino-select");
      const destTxt = $("edit-trs-destino-txt");

      const tipoFinal = leerSelectOEscribir(tipoSel, tipoTxt);
      const vehFinal  = leerSelectOEscribir(vehSel, vehTxt);
      const origenFinal  = leerSelectOEscribir(origSel, origTxt);
      const destinoFinal = leerSelectOEscribir(destSel, destTxt);

      payload.traslado = {
        origen: origenFinal || null,
        destino: destinoFinal || null,
        tipo_traslado: tipoSel?.value === "__write__" ? "OTRO" : (tipoSel?.value || null),
        tipo_traslado_otro: tipoSel?.value === "__write__" ? tipoFinal : null,
        vehiculo: vehSel?.value === "__write__" ? "OTRO" : (vehSel?.value || null),
        vehiculo_otro: vehSel?.value === "__write__" ? vehFinal : null,
        nota: ($("edit-trs-nota")?.value || "").trim() || null,
      };
    }

    if (tipoLower.includes("excurs") || tipoLower.includes("visita") || tipoLower.includes("tour")) {
      const tgSel = $("edit-tu-tipo-guia");
      const tgTxt = $("edit-tu-tipo-guia-otro");
      const idSel = $("edit-tu-idioma");
      const idTxt = $("edit-tu-idioma-txt");

      const tgVal = leerSelectOEscribir(tgSel, tgTxt);
      const idVal = leerSelectOEscribir(idSel, idTxt);

      payload.tour = {
        tipo_guia: tgSel?.value === "__write__" ? "OTRO" : (tgSel?.value || null),
        tipo_guia_otro: tgSel?.value === "__write__" ? tgVal : null,
        idioma: idSel?.value === "__write__" ? "OTRO" : (idSel?.value || null),
        idioma_otro: idSel?.value === "__write__" ? idVal : null,
      };
    }

    if (tipoLower.includes("vuelo")) {
      const origen = leerSelectOEscribir($("edit-vu-origen"), $("edit-vu-origen-txt"));
      const destino = ($("edit-vu-destino")?.value || "").trim();
      const clase = ($("edit-vu-clase")?.value || "").trim();
      const equipaje = ($("edit-vu-equipaje")?.value || "").trim();
      const nEsc = Number(($("edit-vu-escalas")?.value || "").trim());
      const vueloObj = {
        origen: origen || undefined,
        destino: destino || undefined,
        escalas: Number.isFinite(nEsc) ? nEsc : undefined,
        clase: clase || undefined,
        equipaje: equipaje || undefined,
      };

      payload.vuelo = objectOrNull(cleanObject(vueloObj)) || undefined;
    }

    if (tipoLower.includes("tren")) {
      const origen  = leerSelectOEscribir($("edit-tr-origen"), $("edit-tr-origen-txt"));
      const destino = leerSelectOEscribir($("edit-tr-destino"), $("edit-tr-destino-txt"));

      const clase = ($("edit-tr-clase")?.value || "").trim();
      const equipaje = ($("edit-tr-equipaje")?.value || "").trim();
      const nEsc = Number(($("edit-tr-escalas")?.value || "").trim());

      const trenObj = {
        origen: origen || undefined,
        destino: destino || undefined,
        escalas: Number.isFinite(nEsc) ? nEsc : undefined,
        clase: clase || undefined,
        equipaje: equipaje || undefined,
        sillas_reservadas: ($("edit-tr-sillas")?.value || "0") === "1",
      };

      payload.tren = objectOrNull(cleanObject(trenObj)) || undefined;
    }

    return payload;
  }

  // =========================
  // API: detalle servicio
  // =========================
  async function cargarDetalleServicio(idServicio) {
    const key = String(idServicio);
    if (detalleCacheById.has(key)) return detalleCacheById.get(key);

    const data = await fetchJSON(`/api/servicios/${idServicio}`);
    const det = (data && typeof data === "object" && (data.servicio || data.item))
      ? (data.servicio || data.item)
      : data;

    if (!det || typeof det !== "object") {
      throw new Error("No se pudo cargar el detalle del servicio.");
    }

    detalleCacheById.set(key, det);
    return det;
  }

  // =========================
  // Modal DATOS (abrir/cerrar)
  // =========================
  async function abrirModalDatos(idServicio) {
    try {
      modalDatosServicioId = idServicio;
      toggleEditModalDatos(false);
      setMsgEditar("");

      const det = await cargarDetalleServicio(idServicio);
      renderModalDatosBonito(det);

      modalDatos?.showModal();
    } catch (e) {
      modalDatosServicioId = null;
      resetModalDatosBonito();
      alert(e.message);
    }
  }

  function cerrarModalDatos() {
    modalDatos?.close();
    modalDatosServicioId = null;
    toggleEditModalDatos(false);
    setMsgEditar("");
  }

  // Entrar a edición
  async function entrarEdicionModalDatos() {
    if (!modalDatosServicioId) return;

    setMsgEditar("");
    await initEditorOnce();

    const det = await cargarDetalleServicio(modalDatosServicioId);
    const base = servicioCacheById.get(String(modalDatosServicioId)) || null;

    const editContinente = $("edit-continente");
    const editPais = $("edit-pais");
    const editCiudad = $("edit-ciudad");
    const editTipoServ = $("edit-tipo-servicio");
    const editNombreAuto = $("edit-nombre-auto");

    // cascada ubicación con base (si existe)
    if (editContinente) {
      if (base?.id_continente != null) {
        editContinente.value = String(base.id_continente);
        await cargarPaisesEditor(editContinente.value || null);
      } else {
        editContinente.value = "";
        await cargarPaisesEditor(null);
      }
    }

    if (editPais) {
      if (base?.id_pais != null) {
        editPais.value = String(base.id_pais);
        await cargarCiudadesEditor(editPais.value || null);
      } else {
        editPais.value = "";
        await cargarCiudadesEditor(null);
      }
    }

    if (editCiudad) {
      if (base?.id_ciudad != null) editCiudad.value = String(base.id_ciudad);
      else editCiudad.value = String(pick(det, ["id_ciudad","ciudad_id","idCiudad"], "") || "");
    }

    if (editTipoServ) {
      if (base?.id_tipo != null) editTipoServ.value = String(base.id_tipo);
      else editTipoServ.value = String(pick(det, ["id_tipo","tipo_id","idTipo"], "") || "");
    }

    const tipoLower = getTipoLowerFromEditor() || inferTipoTextoFromDetalle(det);
    mostrarSeccionEditPorTipo(tipoLower);

    fillBaseEditFromDetalle(det);
    fillDinamicoEditFromDetalle(det, tipoLower);

    if (editNombreAuto) {
      const nombreDet = (det?.nombre_wtravel || det?.servicio_texto || "").trim();
      editNombreAuto.value = nombreDet || "";
    }
    recomputeNombreAuto();

    toggleEditModalDatos(true);
  }

  async function cancelarEdicionModalDatos() {
    if (!modalDatosServicioId) return toggleEditModalDatos(false);
    setMsgEditar("");

    const det = await cargarDetalleServicio(modalDatosServicioId);
    renderModalDatosBonito(det);

    toggleEditModalDatos(false);
  }

  function isEmptyValue(v) {
    return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
  }

  function cleanObject(obj) {
    if (!obj || typeof obj !== "object") return obj;

    // Limpia recursivo
    for (const k of Object.keys(obj)) {
      const v = obj[k];

      if (v && typeof v === "object" && !Array.isArray(v)) {
        obj[k] = cleanObject(v);
        // si quedó vacío, bórralo
        if (obj[k] && typeof obj[k] === "object" && Object.keys(obj[k]).length === 0) {
          delete obj[k];
        }
        continue;
      }

      // borra vacíos
      if (isEmptyValue(v)) delete obj[k];
    }

    return obj;
  }

  // Si el objeto está completamente vacío, retorna null
  function objectOrNull(o) {
    if (!o || typeof o !== "object") return null;
    return Object.keys(o).length ? o : null;
  }

  async function guardarEdicionModalDatos() {
    setMsgEditar("");
    if (!modalDatosServicioId) return setMsgEditar("No hay servicio seleccionado.", true);

    const det = await cargarDetalleServicio(modalDatosServicioId);
    const tipoLower = getTipoLowerFromEditor() || inferTipoTextoFromDetalle(det);

    const editTipoServ = $("edit-tipo-servicio");
    const editCiudad = $("edit-ciudad");
    const editProveedor = $("edit-id-proveedor");

    const idTipo = Number(String(editTipoServ?.value || "").trim() || 0);
    if (!idTipo) return setMsgEditar("Selecciona el tipo de servicio.", true);

    const idCiud = Number(String(editCiudad?.value || "").trim() || 0);
    if (!idCiud) return setMsgEditar("Selecciona la ciudad.", true);

    const prov = Number(String(editProveedor?.value || "").trim());
    if (!prov) return setMsgEditar("Selecciona un proveedor.", true);

    recomputeNombreAuto();

    let payload = buildPayloadFromEditor(tipoLower);
    payload = cleanObject(payload);

    const url = `/api/servicios/${modalDatosServicioId}`;

    try {
      const data = await fetchJSON(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (data?.ok !== true && data?.success !== true) {
        if (data?.mensaje || data?.error) throw new Error(data.mensaje || data.error);
      }

      // ✅ Invalida catálogos para que lo “nuevo” aparezca al volver a abrir
      ["tiempo_servicio","boleto_lugar","traslado_origen","traslado_destino","tren_origen","tren_destino","vuelo_origen"]
        .forEach(g => { try { delete catalogCache[g]; } catch {} });

      detalleCacheById.delete(String(modalDatosServicioId));
      const detNuevo = await cargarDetalleServicio(modalDatosServicioId);

      renderModalDatosBonito(detNuevo);
      toggleEditModalDatos(false);

      setMsgEditar("Guardado listo ✅");

      await cargarServicios();
      await cargarServiciosSinPrecio();
    } catch (e) {
      setMsgEditar(`No se pudo guardar. Backend dice: "${e.message}". Ruta usada: ${url}`, true);
    }
  }

  // =========================
  // Modal 2: contexto (nombre + año)
  // =========================
  function nombreServicioSimpleById(idServicio) {
    const s = servicioCacheById.get(String(idServicio));
    if (!s) return null;
    return (s.servicio_texto || s.nombre_wtravel || `Servicio #${s.id}`).trim();
  }

  function setContextoModalPrecios(idServicio) {
    const nombre =
      nombreServicioSimpleById(idServicio) ||
      (detalleCacheById.get(String(idServicio))?.nombre_wtravel || null) ||
      `Servicio #${idServicio}`;

    if (mpServicioNombre) mpServicioNombre.textContent = nombre;
    if (mpAnio) mpAnio.textContent = String(getAnioUI());
  }

  // =========================
  // Tabla PRECIOS (Modal Precios)
  // =========================
  function renderTablaPreciosModal(precios12) {
    if (!modalTbodyPrecios) return;
    modalTbodyPrecios.innerHTML = "";

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
      modalTbodyPrecios.appendChild(tr);
    }
  }

  async function cargarPreciosServicio(idServicio) {
    const anio = getAnioUI();
    const tipoHab = getTipoHabUI();

    const data = await fetchJSON(
      `/api/servicios/${idServicio}/precios?anio=${encodeURIComponent(anio)}&tipo_habitacion=${encodeURIComponent(tipoHab)}`
    );
    if (!data.ok) throw new Error(data.mensaje || data.error || "Error cargando precios");
    return data.precios || [];
  }

  async function abrirModalPrecios(idServicio) {
    try {
      modalPreciosServicioId = idServicio;
      setMsgModalPrecios("");

      setContextoModalPrecios(idServicio);

      const precios = await cargarPreciosServicio(idServicio);
      renderTablaPreciosModal(precios);

      modalPrecios?.showModal();
      setMsgModalPrecios(`Precios cargados ✅ (${getAnioUI()} - ${getTipoHabUI()})`);
    } catch (e) {
      modalPreciosServicioId = null;
      renderTablaPreciosModal([]);
      setMsgModalPrecios(e.message, true);
      modalPrecios?.showModal();
    }
  }

  function cerrarModalPrecios() {
    modalPrecios?.close();
    modalPreciosServicioId = null;
    setMsgModalPrecios("");

    if (mpServicioNombre) mpServicioNombre.textContent = "—";
    if (mpAnio) mpAnio.textContent = "—";
  }

  async function guardarPreciosModal() {
    setMsgModalPrecios("");

    if (!modalPreciosServicioId) {
      return setMsgModalPrecios("No hay servicio seleccionado.", true);
    }
    if (!modalTbodyPrecios) {
      return setMsgModalPrecios("No encuentro la tabla de precios.", true);
    }

    const anio = getAnioUI();
    const tipoHab = getTipoHabUI();

    const inputs = modalTbodyPrecios.querySelectorAll("input[type='number']");
    const preciosPayload = [];

    for (const inp of inputs) {
      const mes = Number(inp.dataset.mes);
      const raw = String(inp.value || "").trim();

      // vacío => NULL
      if (!raw) {
        preciosPayload.push({ mes, precio_usd: null });
        continue;
      }

      const n = Number(raw);
      if (!Number.isFinite(n)) {
        return setMsgModalPrecios(`Precio inválido en mes ${mes}.`, true);
      }
      if (n < 0) {
        return setMsgModalPrecios(`No se permiten negativos (mes ${mes}).`, true);
      }

      preciosPayload.push({ mes, precio_usd: round2(n) });
    }

    try {
      const data = await fetchJSON(
        `/api/servicios/${modalPreciosServicioId}/precios?anio=${encodeURIComponent(anio)}&tipo_habitacion=${encodeURIComponent(tipoHab)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ precios: preciosPayload }),
        }
      );

      // fetchJSON ya lanza error si !ok, pero lo dejo por claridad
      if (!data.ok) throw new Error(data.mensaje || data.error || "Error guardando precios");

      setMsgModalPrecios(
        `Guardado listo ✅ (upsert: ${data.upsert ?? "?"}, deleted: ${data.deleted ?? "?"})`
      );

      const precios = await cargarPreciosServicio(modalPreciosServicioId);
      renderTablaPreciosModal(precios);

      await cargarServiciosSinPrecio();
    } catch (e) {
      setMsgModalPrecios(e.message, true);
    }
  }

  // =========================
  // Cargar catálogos (filtros)
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

    const filtrados = (lista || []).filter(t => !String(t.nombre || "").toLowerCase().includes("aloj"));
    addOptions(
      filtroTipo,
      filtrados.map(t => ({ value: String(t.id), text: t.nombre })),
      { firstText: "(Todos los tipos)", firstValue: "" }
    );
  }

  // =========================
  // Servicios (select) + filtrado
  // =========================
  async function cargarServicios() {
    const lista = await fetchLista("/api/servicios", ["servicios"]);

    allServicios = (lista || []).filter(s => !esAlojamientoByTipoId(s.id_tipo));
    servicioCacheById.clear();
    allServicios.forEach(s => servicioCacheById.set(String(s.id), s));

    filtrarServiciosYRenderSelect();
  }

  function filtrarServiciosYRenderSelect() {
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
  }

  // =========================
  // Tabla sin precio
  // =========================
  function buildSinPrecioQuery() {
    const params = new URLSearchParams();
    params.set("anio", String(getAnioUI()));
    params.set("tipo_habitacion", getTipoHabUI());

    if (filtroContinente?.value) params.set("id_continente", filtroContinente.value);
    if (filtroPais?.value) params.set("id_pais", filtroPais.value);
    if (filtroCiudad?.value) params.set("id_ciudad", filtroCiudad.value);
    if (filtroTipo?.value) params.set("id_tipo", filtroTipo.value);

    return `/api/servicios/sin-precio?${params.toString()}`;
  }

  async function cargarServiciosSinPrecio() {
    if (!tbodySinPrecio) return;

    setMsgSinPrecio(`Cargando pendientes ${getAnioUI()}...`);
    tbodySinPrecio.innerHTML = `<tr><td colspan="3" class="muted">Cargando...</td></tr>`;

    try {
      const data = await fetchJSON(buildSinPrecioQuery());
      const rows = Array.isArray(data.servicios) ? data.servicios : [];

      if (!rows.length) {
        tbodySinPrecio.innerHTML = `<tr><td colspan="3" class="muted">No hay servicios pendientes para ${getAnioUI()}</td></tr>`;
        setMsgSinPrecio("");
        return;
      }

      tbodySinPrecio.innerHTML = "";

      rows.forEach((s) => {
        const idServicio = s.id_servicio || s.id || s.servicio_id;

        const tr = document.createElement("tr");

        const tdCiudad = document.createElement("td");
        tdCiudad.textContent = safeText(s.ciudad || "");

        const tdNombre = document.createElement("td");
        tdNombre.textContent = safeText(s.nombre_wtravel || "");

        const tdAcciones = document.createElement("td");

        const btnDatos = document.createElement("button");
        btnDatos.type = "button";
        btnDatos.className = "btn-secondary";
        btnDatos.textContent = "Mostrar datos";
        btnDatos.addEventListener("click", () => abrirModalDatos(idServicio));

        const btnPrecio = document.createElement("button");
        btnPrecio.type = "button";
        btnPrecio.className = "btn-primary";
        btnPrecio.textContent = "Mostrar precio";
        btnPrecio.addEventListener("click", () => abrirModalPrecios(idServicio));

        tdAcciones.appendChild(btnDatos);
        tdAcciones.appendChild(document.createTextNode(" "));
        tdAcciones.appendChild(btnPrecio);

        tr.appendChild(tdCiudad);
        tr.appendChild(tdNombre);
        tr.appendChild(tdAcciones);

        tbodySinPrecio.appendChild(tr);
      });

      setMsgSinPrecio("");
    } catch (e) {
      console.error(e);
      tbodySinPrecio.innerHTML = `<tr><td colspan="3" style="color:crimson;">${safeText(e.message)}</td></tr>`;
      setMsgSinPrecio(e.message, true);
    }
  }

  // =========================
  // Acciones desde SELECT
  // =========================
  function getServicioSeleccionadoId() {
    const id = Number(String(selServicio?.value || "").trim());
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  async function onClickMostrarDatosDesdeSelect() {
    const id = getServicioSeleccionadoId();
    if (!id) return alert("Selecciona un servicio primero.");
    await abrirModalDatos(id);
  }

  async function onClickMostrarPrecioDesdeSelect() {
    const id = getServicioSeleccionadoId();
    if (!id) return alert("Selecciona un servicio primero.");
    await abrirModalPrecios(id);
  }

  // =========================
  // Eventos
  // =========================
  filtroContinente?.addEventListener("change", async () => {
    await cargarPaises(filtroContinente.value || null);
    filtrarServiciosYRenderSelect();
    await cargarServiciosSinPrecio();
  });

  filtroPais?.addEventListener("change", async () => {
    await cargarCiudades(filtroPais.value || null);
    filtrarServiciosYRenderSelect();
    await cargarServiciosSinPrecio();
  });

  filtroCiudad?.addEventListener("change", async () => {
    filtrarServiciosYRenderSelect();
    await cargarServiciosSinPrecio();
  });

  filtroTipo?.addEventListener("change", async () => {
    filtrarServiciosYRenderSelect();
    await cargarServiciosSinPrecio();
  });

  selAnio?.addEventListener("change", async () => {
    await cargarServiciosSinPrecio();

    if (modalPrecios?.open && modalPreciosServicioId) {
      setContextoModalPrecios(modalPreciosServicioId);
      const precios = await cargarPreciosServicio(modalPreciosServicioId);
      renderTablaPreciosModal(precios);
      setMsgModalPrecios(`Precios recargados ✅ (${getAnioUI()} - ${getTipoHabUI()})`);
    }
  });

  btnRecargarSinPrecio?.addEventListener("click", cargarServiciosSinPrecio);
  btnServicioDatos?.addEventListener("click", onClickMostrarDatosDesdeSelect);
  btnServicioPrecio?.addEventListener("click", onClickMostrarPrecioDesdeSelect);

  btnModalDatosCerrar?.addEventListener("click", cerrarModalDatos);
  btnModalPreciosCerrar?.addEventListener("click", cerrarModalPrecios);
  btnModalGuardarPrecios?.addEventListener("click", guardarPreciosModal);

  btnModalDatosAbrirPrecios?.addEventListener("click", async () => {
    if (!modalDatosServicioId) return alert("No hay servicio seleccionado.");
    const id = modalDatosServicioId;
    cerrarModalDatos();
    await abrirModalPrecios(id);
  });

  btnModalDatosEditar?.addEventListener("click", entrarEdicionModalDatos);
  btnModalDatosCancelar?.addEventListener("click", cancelarEdicionModalDatos);
  btnModalDatosGuardar?.addEventListener("click", guardarEdicionModalDatos);

  // =========================
  // Init
  // =========================
  (async () => {
    try {
      if (selAnio) {
        selAnio.innerHTML = "";
        ANIOS_UI.forEach(y => selAnio.appendChild(new Option(String(y), String(y))));
        selAnio.value = String(ANIOS_UI[0]);
      }

      resetModalDatosBonito();
      renderTablaPreciosModal([]);
      setMsgSinPrecio("");
      setMsgModalPrecios("");
      setMsgEditar("");

      if (mpServicioNombre) mpServicioNombre.textContent = "—";
      if (mpAnio) mpAnio.textContent = "—";

      await cargarContinentes();
      await cargarTiposServicio();
      await cargarServicios();

      addOptions(filtroPais, [], { firstText: "(Todos los países)", firstValue: "" });
      addOptions(filtroCiudad, [], { firstText: "(Todas las ciudades)", firstValue: "" });

      await cargarServiciosSinPrecio();

      toggleEditModalDatos(false);
    } catch (e) {
      console.error(e);
      setMsgSinPrecio(e.message, true);
    }
  })();
});
