document.addEventListener("DOMContentLoaded", () => {
  const filtroContinente = document.getElementById("filtro-continente");
  const filtroPais = document.getElementById("filtro-pais");
  const filtroCiudad = document.getElementById("filtro-ciudad");

  const selCatHotel = document.getElementById("sel-cat-hotel");
  const selCatHab = document.getElementById("sel-cat-hab");
  const selRegimen = document.getElementById("sel-regimen");

  const inpAnio = document.getElementById("inp-anio");
  const selTipoHab = document.getElementById("sel-tipo-hab");

  const btnCargar = document.getElementById("btn-cargar");
  const btnGuardar = document.getElementById("btn-guardar");

  const tbody = document.getElementById("tbody-precios");
  const msg = document.getElementById("msg");

  const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  function setMsg(text, isError = false) {
    msg.textContent = text || "";
    msg.style.color = isError ? "crimson" : "inherit";
  }

  async function fetchLista(url, posiblesKeys = []) {
    const resp = await fetch(url);
    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error(`Respuesta no-JSON desde ${url}: ${text.slice(0, 180)}`); }

    if (Array.isArray(data)) return data;
    for (const k of posiblesKeys) if (Array.isArray(data?.[k])) return data[k];
    throw new Error(`Formato inesperado desde ${url}`);
  }

  function addOptions(selectEl, opciones, { firstText="(Seleccionar)", firstValue="" } = {}) {
    selectEl.innerHTML = "";
    if (firstText !== null) selectEl.appendChild(new Option(firstText, firstValue));
    opciones.forEach(o => selectEl.appendChild(new Option(o.text, o.value)));
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

  // Catálogos (si los manejas en /api/catalogos)
  async function cargarCatalogo(grupo, selectEl, firstText) {
    try {
      const lista = await fetchLista(`/api/catalogos/${encodeURIComponent(grupo)}`, ["opciones","valores","items"]);
      const norm = lista.map(x => (typeof x === "string" ? { valor: x } : x)).filter(x => x?.valor);
      addOptions(selectEl, norm.map(x => ({ value: x.valor, text: x.valor })), { firstText, firstValue: "" });
    } catch {
      addOptions(selectEl, [], { firstText: "(Sin catálogo)", firstValue: "" });
    }
  }

  // Ubicación
  async function cargarContinentes() {
    const lista = await fetchLista("/api/continentes", ["continentes"]);
    addOptions(filtroContinente, lista.map(x => ({ value: String(x.id), text: x.nombre })), {
      firstText: "(Todos los continentes)", firstValue: ""
    });
  }
  async function cargarPaises(idContinente) {
    if (!idContinente) {
      addOptions(filtroPais, [], { firstText: "(Todos los países)", firstValue: "" });
      addOptions(filtroCiudad, [], { firstText: "(Todas las ciudades)", firstValue: "" });
      return;
    }
    const lista = await fetchLista(`/api/paises/${idContinente}`, ["paises"]);
    addOptions(filtroPais, lista.map(x => ({ value: String(x.id), text: x.nombre })), {
      firstText: "(Todos los países)", firstValue: ""
    });
    addOptions(filtroCiudad, [], { firstText: "(Todas las ciudades)", firstValue: "" });
  }
  async function cargarCiudades(idPais) {
    if (!idPais) {
      addOptions(filtroCiudad, [], { firstText: "(Todas las ciudades)", firstValue: "" });
      return;
    }
    const lista = await fetchLista(`/api/ciudades/${idPais}`, ["ciudades"]);
    addOptions(filtroCiudad, lista.map(x => ({ value: String(x.id), text: x.nombre })), {
      firstText: "(Todas las ciudades)", firstValue: ""
    });
  }

  function getQueryBase() {
    const id_ciudad = filtroCiudad.value;
    const categoria = selCatHotel.value;
    const categoria_hab = selCatHab.value;
    const regimen = selRegimen.value;
    const anio = inpAnio.value;
    const tipo_habitacion = selTipoHab.value;

    if (!id_ciudad) return { ok:false, msg:"Selecciona ciudad." };
    if (!categoria) return { ok:false, msg:"Selecciona categoría hotel." };
    if (!categoria_hab) return { ok:false, msg:"Selecciona categoría habitación." };
    if (!regimen) return { ok:false, msg:"Selecciona régimen." };
    if (!anio) return { ok:false, msg:"Selecciona año." };

    const qs = new URLSearchParams({
      id_ciudad,
      categoria,
      categoria_hab,
      regimen,
      anio,
      tipo_habitacion
    });

    return { ok:true, qs };
  }

  async function cargarPrecios() {
    setMsg("");
    const base = getQueryBase();
    if (!base.ok) return setMsg(base.msg, true);

    const resp = await fetch(`/api/alojamiento/precios?${base.qs.toString()}`);
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok) return setMsg(data.mensaje || data.error || "Error cargando precios", true);

    renderTabla(data.precios || []);
    setMsg("Precios cargados.");
  }

  async function guardarPrecios() {
    setMsg("");
    const base = getQueryBase();
    if (!base.ok) return setMsg(base.msg, true);

    const inputs = tbody.querySelectorAll("input[type='number']");
    const precios = Array.from(inputs).map(inp => {
      const mes = Number(inp.dataset.mes);
      const raw = String(inp.value || "").trim();
      const n = raw === "" ? null : Number(raw);
      return { mes, precio_usd: (n == null || Number.isNaN(n) || n < 0) ? null : Math.round(n * 100) / 100 };
    });

    const resp = await fetch(`/api/alojamiento/precios?${base.qs.toString()}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ precios })
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok) return setMsg(data.mensaje || data.error || "Error guardando precios", true);

    setMsg("Guardado listo ✅");
  }

  // Eventos ubicación
  filtroContinente.addEventListener("change", async () => {
    await cargarPaises(filtroContinente.value || null);
  });
  filtroPais.addEventListener("change", async () => {
    await cargarCiudades(filtroPais.value || null);
  });

  btnCargar.addEventListener("click", cargarPrecios);
  btnGuardar.addEventListener("click", guardarPrecios);

  // Init
  inpAnio.value = String(new Date().getFullYear());
  renderTabla([]);

  (async () => {
    try {
      await cargarContinentes();
      addOptions(filtroPais, [], { firstText: "(Todos los países)", firstValue: "" });
      addOptions(filtroCiudad, [], { firstText: "(Todas las ciudades)", firstValue: "" });

      // Catálogos: ajusta los nombres de grupo a los que ya vienes usando
      await cargarCatalogo("aloj_categoria_hotel", selCatHotel, "(Seleccionar categoría hotel)");
      await cargarCatalogo("aloj_categoria_hab", selCatHab, "(Seleccionar categoría habitación)");
      await cargarCatalogo("aloj_regimen", selRegimen, "(Seleccionar régimen)");

      setMsg("");
    } catch (e) {
      console.error(e);
      setMsg(e.message, true);
    }
  })();
});
