document.addEventListener("DOMContentLoaded", () => {
  const filtroContinente = document.getElementById("filtro-continente");
  const filtroPais = document.getElementById("filtro-pais");
  const filtroCiudad = document.getElementById("filtro-ciudad");
  const filtroHotel = document.getElementById("filtro-hotel");

  const selCatHotel = document.getElementById("sel-cat-hotel");
  const selCatHab = document.getElementById("sel-cat-hab");
  const selRegimen = document.getElementById("sel-regimen");

  const inpCatHotel = document.getElementById("txt-cat-hotel");
  const inpCatHab = document.getElementById("txt-cat-hab");
  const inpRegimen = document.getElementById("txt-regimen");

  const wrapCatHotelOtro = document.getElementById("wrap-cat-hotel-otro");
  const wrapCatHabOtro = document.getElementById("wrap-cat-hab-otro");
  const wrapRegimenOtro = document.getElementById("wrap-regimen-otro");

  const inpAnio = document.getElementById("inp-anio");
  const selTipoHab = document.getElementById("sel-tipo-hab");

  const btnCargar = document.getElementById("btn-cargar");
  const btnGuardar = document.getElementById("btn-guardar");

  const tbody = document.getElementById("tbody-precios");
  const msg = document.getElementById("msg");

  const MESES = [
    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
  ];

  // =========================
  // Debug: ¿existen los elementos?
  // =========================
  console.log("[DOM] continente:", filtroContinente);
  console.log("[DOM] pais:", filtroPais);
  console.log("[DOM] ciudad:", filtroCiudad);
  console.log("[DOM] hotel:", filtroHotel);

  function setMsg(text, isError = false) {
    msg.textContent = text || "";
    msg.style.color = isError ? "crimson" : "inherit";
  }

  async function fetchJson(url, options) {
    const resp = await fetch(url, options);
    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error(`Respuesta no-JSON desde ${url}: ${text.slice(0, 180)}`); }
    return { resp, data };
  }

  async function fetchLista(url, posiblesKeys = []) {
    const { resp, data } = await fetchJson(url);
    if (!resp.ok) throw new Error(data?.mensaje || data?.error || `Error HTTP ${resp.status}`);

    if (Array.isArray(data)) return data;

    for (const k of posiblesKeys) {
      if (Array.isArray(data?.[k])) return data[k];
    }

    if (Array.isArray(data?.valores)) return data.valores;

    throw new Error(`Formato inesperado desde ${url}`);
  }

  function addOptions(selectEl, opciones, { firstText="(Seleccionar)", firstValue="" } = {}) {
    if (!selectEl) return;
    selectEl.innerHTML = "";
    if (firstText !== null) selectEl.appendChild(new Option(firstText, firstValue));
    (opciones || []).forEach(o => selectEl.appendChild(new Option(o.text, o.value)));
  }

  function renderTabla(precios12) {
    tbody.innerHTML = "";
    for (let m = 1; m <= 12; m++) {
      const row = (precios12 || []).find(x => Number(x.mes) === m);
      const tr = document.createElement("tr");

      const tdMes = document.createElement("td");
      tdMes.textContent = `${m}. ${MESES[m - 1]}`;

      const tdPrecio = document.createElement("td");
      const input = document.createElement("input");
      input.type = "number";
      input.step = "0.01";
      input.min = "0";
      input.dataset.mes = String(m);
      input.value = (row?.precio_usd === null || row?.precio_usd === undefined) ? "" : String(row.precio_usd);
      tdPrecio.appendChild(input);

      tr.appendChild(tdMes);
      tr.appendChild(tdPrecio);
      tbody.appendChild(tr);
    }
  }

  // =========================
  // OTRO con catálogo + escribir + guardar en BD
  // =========================
  async function cargarCatalogo(grupo) {
    // tu API devuelve { ok:true, valores:[...] }
    const lista = await fetchLista(`/api/catalogos/${encodeURIComponent(grupo)}`, ["valores", "items", "opciones"]);
    const norm = (lista || []).map(x => (typeof x === "string" ? { valor: x } : x)).filter(x => x?.valor);
    return norm;
  }

  function show(el, visible) {
    if (!el) return;
    el.style.display = visible ? "" : "none";
  }

  function addOptionsConWrite(selectEl, cat, firstText) {
    const opts = [
      ...(cat || []).map(x => ({ value: x.valor, text: x.valor })),
      { value: "__write__", text: "Escribir nuevo..." }
    ];
    addOptions(selectEl, opts, { firstText, firstValue: "" });
  }

  async function initOtroCatalogo({ grupoCatalogo, selectCatalogoEl, inputTextoEl, wrapOtroEl, firstText }) {
    try {
      const cat = await cargarCatalogo(grupoCatalogo);
      addOptionsConWrite(selectCatalogoEl, cat, firstText);
    } catch {
      addOptions(selectCatalogoEl, [{ value:"__write__", text:"Escribir nuevo..." }], { firstText, firstValue:"" });
    }

    function syncWrite() {
      const wantsWrite = selectCatalogoEl.value === "__write__";
      show(wrapOtroEl, wantsWrite);
      if (!wantsWrite && inputTextoEl) inputTextoEl.value = "";
    }

    selectCatalogoEl.addEventListener("change", syncWrite);
    syncWrite();
  }

  async function guardarValorCatalogo(grupo, valor) {
    const v = String(valor || "").trim();
    if (!v) return null;

    const { resp, data } = await fetchJson(`/api/catalogos/${encodeURIComponent(grupo)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valor: v })
    });

    if (!resp.ok || !data?.ok) {
      throw new Error(data?.mensaje || data?.error || "No se pudo guardar el valor en catálogo");
    }

    return data.valor || v;
  }

  async function leerSelectConOtro({ grupo, selectEl, inputEl, wrapEl, firstText }) {
    const v = String(selectEl.value || "");
    if (!v) return null;

    if (v !== "__write__") return v;

    const escrito = String(inputEl?.value || "").trim();
    if (!escrito) throw new Error("Elegiste 'Escribir nuevo...', pero no escribiste nada.");

    await guardarValorCatalogo(grupo, escrito);

    // recargar y seleccionar el nuevo
    const cat = await cargarCatalogo(grupo);
    addOptionsConWrite(selectEl, cat, firstText);
    selectEl.value = escrito; // selecciona tal cual lo guardaste
    show(wrapEl, false);
    if (inputEl) inputEl.value = "";

    return escrito;
  }

  // =========================
  // Ubicación + Hoteles
  // =========================
  async function cargarContinentes() {
    const lista = await fetchLista("/api/continentes", ["continentes"]);
    addOptions(
      filtroContinente,
      (lista || []).map(x => ({ value: String(x.id), text: x.nombre })),
      { firstText: "(Todos los continentes)", firstValue: "" }
    );
  }

  async function cargarPaises(idContinente) {
    console.log("[cargarPaises] idContinente =", idContinente);

    addOptions(filtroHotel, [], { firstText: "(Selecciona ciudad primero)", firstValue: "" });

    if (!idContinente) {
      addOptions(filtroPais, [], { firstText: "(Todos los países)", firstValue: "" });
      addOptions(filtroCiudad, [], { firstText: "(Todas las ciudades)", firstValue: "" });
      return;
    }

    const lista = await fetchLista(`/api/paises/${idContinente}`, ["paises"]);
    addOptions(
      filtroPais,
      (lista || []).map(x => ({ value: String(x.id), text: x.nombre })),
      { firstText: "(Todos los países)", firstValue: "" }
    );

    addOptions(filtroCiudad, [], { firstText: "(Todas las ciudades)", firstValue: "" });
  }

  async function cargarCiudades(idPais) {
    console.log("[cargarCiudades] idPais =", idPais);

    addOptions(filtroHotel, [], { firstText: "(Selecciona ciudad primero)", firstValue: "" });

    if (!idPais) {
      addOptions(filtroCiudad, [], { firstText: "(Todas las ciudades)", firstValue: "" });
      return;
    }

    const lista = await fetchLista(`/api/ciudades/${idPais}`, ["ciudades"]);
    console.log("[cargarCiudades] ciudades recibidas:", lista);

    addOptions(
      filtroCiudad,
      (lista || []).map(x => ({ value: String(x.id), text: x.nombre })),
      { firstText: "(Todas las ciudades)", firstValue: "" }
    );
  }

  let HOTELES_CACHE = null;

  async function cargarHotelesPorCiudad(idCiudad) {
    console.log("[cargarHotelesPorCiudad] idCiudad =", idCiudad);

    if (!idCiudad) {
      addOptions(filtroHotel, [], { firstText: "(Selecciona ciudad primero)", firstValue: "" });
      return;
    }

    if (!HOTELES_CACHE) {
      const lista = await fetchLista(`/api/hoteles`, ["hoteles"]);
      console.log("[hoteles] respuesta cruda:", lista);

      function extraerIdCiudad(h) {
        let v =
          h.id_ciudad ??
          h.ciudad_id ??
          h.idCiudad ??
          h.id_ciudad_hotel ??
          h.id_ciudad_fk ??
          h.ciudad ??
          h.idCiudadHotel;

        // Si viene como objeto { id: 1, ... }
        if (v && typeof v === "object") {
          v = v.id ?? v.id_ciudad ?? v.value ?? null;
        }

        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      }

      HOTELES_CACHE = (lista || [])
        .map(h => {
          const id = h.id ?? h.id_hotel ?? h.hotel_id;
          const nombre =
            h.nombre ?? h.nombre_hotel ?? h.nombre_wtravel ?? `Hotel #${id}`;

          const id_ciudad = extraerIdCiudad(h);

          return { id, nombre, id_ciudad };
        })
        .filter(h => h.id != null);

      console.log("[hoteles] cache normalizado (primeros 5):", HOTELES_CACHE.slice(0, 5));
    }

    console.log("[hoteles] ids de ciudad (únicos):", [...new Set(HOTELES_CACHE.map(h => h.id_ciudad))]);
    console.log("[hoteles] ejemplo 3 hoteles:", HOTELES_CACHE.slice(0,3));

    const idC = Number(idCiudad);

    const conCiudad = HOTELES_CACHE.filter(h => h.id_ciudad != null);
    console.log("[hoteles] con id_ciudad:", conCiudad.length, "de", HOTELES_CACHE.length);

    const filtrados = HOTELES_CACHE.filter(h => Number(h.id_ciudad) === idC);
    console.log("[hoteles] filtrados para ciudad", idC, "=", filtrados.length);

    addOptions(
      filtroHotel,
      filtrados.map(h => ({ value: String(h.id), text: h.nombre })),
      { firstText: "(Seleccionar hotel)", firstValue: "" }
    );
  }

  // =========================
  // Query base y llamadas API
  // =========================
  function getQueryBase() {
    const hotel_id = filtroHotel.value;
    if (!hotel_id) return { ok:false, msg:"Selecciona hotel." };

    const anio = inpAnio.value;
    if (!anio) return { ok:false, msg:"Selecciona año." };

    return { ok:true, hotel_id: Number(hotel_id), anio: Number(anio) };
  }

  async function cargarPrecios() {
    setMsg("");
    const base = getQueryBase();
    if (!base.ok) return setMsg(base.msg, true);

    try {
      const categoria_hotel = await leerSelectConOtro({
        grupo: "aloj_categoria_hotel",
        selectEl: selCatHotel,
        inputEl: inpCatHotel,
        wrapEl: wrapCatHotelOtro,
        firstText: "(Seleccionar categoría hotel)"
      });

      const categoria_hab = await leerSelectConOtro({
        grupo: "aloj_categoria_hab",
        selectEl: selCatHab,
        inputEl: inpCatHab,
        wrapEl: wrapCatHabOtro,
        firstText: "(Seleccionar categoría habitación)"
      });

      const regimen = await leerSelectConOtro({
        grupo: "aloj_regimen",
        selectEl: selRegimen,
        inputEl: inpRegimen,
        wrapEl: wrapRegimenOtro,
        firstText: "(Seleccionar régimen)"
      });

      if (!categoria_hotel) return setMsg("Selecciona categoría hotel.", true);
      if (!categoria_hab) return setMsg("Selecciona categoría habitación.", true);
      if (!regimen) return setMsg("Selecciona régimen.", true);

      const qs = new URLSearchParams({
        hotel_id: String(base.hotel_id),
        anio: String(base.anio),
        categoria_hotel,
        categoria_hab,
        regimen,
        tipo_habitacion: selTipoHab.value
      });

      const { resp, data } = await fetchJson(`/api/hoteles/precios?${qs.toString()}`);
      if (!resp.ok || !data.ok) return setMsg(data.mensaje || data.error || "Error cargando precios", true);

      renderTabla(data.precios || []);
      setMsg("Precios cargados ✅");
    } catch (e) {
      console.error(e);
      setMsg(e.message, true);
    }
  }

  async function guardarPrecios() {
    setMsg("");
    const base = getQueryBase();
    if (!base.ok) return setMsg(base.msg, true);

    try {
      const categoria_hotel = await leerSelectConOtro({
        grupo: "aloj_categoria_hotel",
        selectEl: selCatHotel,
        inputEl: inpCatHotel,
        wrapEl: wrapCatHotelOtro,
        firstText: "(Seleccionar categoría hotel)"
      });

      const categoria_hab = await leerSelectConOtro({
        grupo: "aloj_categoria_hab",
        selectEl: selCatHab,
        inputEl: inpCatHab,
        wrapEl: wrapCatHabOtro,
        firstText: "(Seleccionar categoría habitación)"
      });

      const regimen = await leerSelectConOtro({
        grupo: "aloj_regimen",
        selectEl: selRegimen,
        inputEl: inpRegimen,
        wrapEl: wrapRegimenOtro,
        firstText: "(Seleccionar régimen)"
      });

      if (!categoria_hotel) return setMsg("Selecciona categoría hotel.", true);
      if (!categoria_hab) return setMsg("Selecciona categoría habitación.", true);
      if (!regimen) return setMsg("Selecciona régimen.", true);

      const inputs = tbody.querySelectorAll("input[type='number']");
      const precios = Array.from(inputs).map(inp => {
        const mes = Number(inp.dataset.mes);
        const raw = String(inp.value || "").trim();
        const n = raw === "" ? null : Number(raw);
        return {
          mes,
          precio_usd: (n == null || Number.isNaN(n) || n < 0) ? null : Math.round(n * 100) / 100
        };
      });

      const qs = new URLSearchParams({
        hotel_id: String(base.hotel_id),
        anio: String(base.anio),
        categoria_hotel,
        categoria_hab,
        regimen,
        tipo_habitacion: selTipoHab.value
      });

      const { resp, data } = await fetchJson(`/api/hoteles/precios?${qs.toString()}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ precios })
      });

      if (!resp.ok || !data.ok) return setMsg(data.mensaje || data.error || "Error guardando precios", true);

      setMsg("Guardado listo ✅");
    } catch (e) {
      console.error(e);
      setMsg(e.message, true);
    }
  }

  // =========================
  // Eventos
  // =========================
  filtroContinente.addEventListener("change", async () => {
    await cargarPaises(filtroContinente.value || null);
  });

  filtroPais.addEventListener("change", async () => {
    await cargarCiudades(filtroPais.value || null);
  });

  filtroCiudad.addEventListener("change", async () => {
    await cargarHotelesPorCiudad(filtroCiudad.value || null);
  });

  btnCargar.addEventListener("click", cargarPrecios);
  btnGuardar.addEventListener("click", guardarPrecios);

  // =========================
  // Init
  // =========================
  inpAnio.value = String(new Date().getFullYear());
  renderTabla([]);

  (async () => {
    try {
      await cargarContinentes();
      addOptions(filtroPais, [], { firstText: "(Todos los países)", firstValue: "" });
      addOptions(filtroCiudad, [], { firstText: "(Todas las ciudades)", firstValue: "" });
      addOptions(filtroHotel, [], { firstText: "(Selecciona ciudad primero)", firstValue: "" });

      await initOtroCatalogo({
        grupoCatalogo: "aloj_categoria_hotel",
        selectCatalogoEl: selCatHotel,
        inputTextoEl: inpCatHotel,
        wrapOtroEl: wrapCatHotelOtro,
        firstText: "(Seleccionar categoría hotel)"
      });

      await initOtroCatalogo({
        grupoCatalogo: "aloj_categoria_hab",
        selectCatalogoEl: selCatHab,
        inputTextoEl: inpCatHab,
        wrapOtroEl: wrapCatHabOtro,
        firstText: "(Seleccionar categoría habitación)"
      });

      await initOtroCatalogo({
        grupoCatalogo: "aloj_regimen",
        selectCatalogoEl: selRegimen,
        inputTextoEl: inpRegimen,
        wrapOtroEl: wrapRegimenOtro,
        firstText: "(Seleccionar régimen)"
      });

      setMsg("");
    } catch (e) {
      console.error(e);
      setMsg(e.message, true);
    }
  })();
});
