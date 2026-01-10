// backend/src/routes/etapa3/servicios-texto.js
// Generador central de nombre_wtravel (texto automático) según el tipo de servicio.
// Uso recomendado:
//   const { buildNombreWtravel } = require("./servicios-texto");
//   const nombreAuto = buildNombreWtravel(req.body);
//   // Guardar nombreAuto en servicios.nombre_wtravel

function clean(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(/\s+/g, " ").trim();
}

function capFirst(str) {
  const s = clean(str);
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function pluralizeNoche(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0) return "";
  return `${num} ${num === 1 ? "noche" : "noches"}`;
}

function escalasTexto(escalas) {
  const n = Number(escalas);
  if (!Number.isFinite(n) || n <= 0) return "directo";
  if (n === 1) return "1 escala";
  return `${n} escalas`;
}

function boolSiNo(v) {
  return v ? "sí" : "no";
}

function privadoEnGrupo(privado) {
  return privado ? "privado" : "en grupo";
}

function formatDuracion(duracionMin) {
  const n = Number(duracionMin);
  if (!Number.isFinite(n) || n <= 0) return "";
  const h = Math.floor(n / 60);
  const m = n % 60;

  if (h > 0 && m === 0) return `${h}h`;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

// ---- Mapeos “bonitos” ----
function mapCategoriaHab(categoria) {
  const c = clean(categoria).toUpperCase();
  if (!c) return "";

  const map = {
    ESTANDAR: "estándar",
    STANDARD: "estándar",
    SUPERIOR: "superior",
    SUITE: "suite",
    JUNIOR_SUITE: "junior suite",
    DOBLE: "doble",
    TRIPLE: "triple",
  };

  return map[c] || clean(categoria);
}

function mapRegimen(regimen) {
  const r = clean(regimen).toUpperCase();
  if (!r) return "";

  const map = {
    SOLO_ALOJAMIENTO: "solo alojamiento",
    ALOJAMIENTO_DESAYUNO: "desayuno diario",
    MEDIA_PENSION: "media pensión",
    PENSION_COMPLETA: "pensión completa",
    TODO_INCLUIDO: "todo incluido",
    OTRO: "otro", // por si llega OTRO como marcador
  };

  return map[r] || clean(regimen);
}

function mapTipoEntrada(tipo) {
  const t = clean(tipo).toUpperCase();
  if (!t) return "";

  const map = {
    ESTANDAR: "estándar",
    STANDARD: "estándar",
    VIP: "vip",
    FAST_TRACK: "fast track",
    OTRA: "otra",
    OTRO: "otra",
  };

  return map[t] || clean(tipo);
}

function mapTipoGuia(tipoGuia) {
  const t = clean(tipoGuia).toUpperCase();
  if (!t) return "";

  const map = {
    GUIA: "guía",
    AUDIOGUIA: "audioguía",
    NINGUNO: "sin guía",
    OTRO: "otro",
  };

  return map[t] || clean(tipoGuia);
}

function normalizeIdioma(idioma) {
  const s = clean(idioma);
  if (!s) return "";
  return s.toLowerCase();
}

// ==========================
// Builders por tipo
// ==========================
function buildAlojamiento(servicio, alojamiento) {
  const noches = pluralizeNoche(alojamiento?.noches);

  const catHab = mapCategoriaHab(
    alojamiento?.categoria_hab_otro || alojamiento?.categoria_hab
  );

  const regimen = mapRegimen(
    alojamiento?.regimen_otro || alojamiento?.regimen
  );

  // Formato: "<noches>, habitación <categoria_hab>, <regimen>"
  // Ej: "3 noches, habitación estándar, desayuno diario"
  const partes = [];
  if (noches) partes.push(noches);
  if (catHab) partes.push(`habitación ${catHab}`);
  if (regimen && regimen !== "otro") partes.push(regimen);
  else if (alojamiento?.regimen_otro) partes.push(clean(alojamiento.regimen_otro));

  return partes.join(", ");
}

function buildTraslado(servicio, traslado) {
  const privTxt = privadoEnGrupo(Boolean(servicio?.privado));

  const origen = clean(traslado?.origen);
  const destino = clean(traslado?.destino);

  // Si vienen campos *_otro, priorízalos
  const origenFinal = clean(traslado?.origen_otro) || origen;
  const destinoFinal = clean(traslado?.destino_otro) || destino;

  // Formato: "Traslado <privado/en grupo> <origen> – <destino>"
  const base = `Traslado ${privTxt}`;
  if (origenFinal && destinoFinal) return `${base} ${origenFinal} – ${destinoFinal}`;
  if (origenFinal) return `${base} ${origenFinal}`;
  if (destinoFinal) return `${base} – ${destinoFinal}`;
  return base;
}

function buildTour(servicio, tour) {
  // En tu UI el “nombre” va en descripcion muchas veces.
  // Si algún día llega titulo/nombre, aquí lo agarramos.
  const desc =
    clean(servicio?.descripcion) ||
    clean(tour?.nombre) ||
    clean(tour?.titulo) ||
    "";

  const privTxt = privadoEnGrupo(Boolean(servicio?.privado));

  // Si algún día mandas duracion_min, se usa; si no, se omite
  const dur = formatDuracion(tour?.duracion_min);

  const tipoGuia = mapTipoGuia(tour?.tipo_guia_otro || tour?.tipo_guia);
  const idioma = normalizeIdioma(tour?.idioma_otro || tour?.idioma);

  // Formato: "<descripcion>, <privado/en grupo>, <duracion>, <tipo_guia> en <idioma>"
  const partes = [];
  if (desc) partes.push(desc);
  partes.push(privTxt);
  if (dur) partes.push(dur);

  if (tipoGuia && idioma) partes.push(`${tipoGuia} en ${idioma}`);
  else if (tipoGuia) partes.push(tipoGuia);
  else if (idioma) partes.push(`en ${idioma}`);

  return partes.join(", ");
}

function buildBoleto(servicio, boleto) {
  // Formato deseado:
  // "Boleto <Lugar>, entrada <tipo>, <guía/audioguía> en <idioma>" o "sin guía"
  const lugar =
    clean(boleto?.boleto_entrada) ||
    clean(boleto?.boleto_entrada_otro) ||
    clean(servicio?.descripcion) ||
    "";

  const tipoEntrada = mapTipoEntrada(boleto?.tipo_entrada_otro || boleto?.tipo_entrada);

  // Ojo: en tu payload de boleto no siempre mandas tipo_guia_otro, pero lo soportamos
  const tipoGuia = mapTipoGuia(boleto?.tipo_guia_otro || boleto?.tipo_guia);
  const idioma = normalizeIdioma(boleto?.idioma_otro || boleto?.idioma);

  const partes = [];

  if (lugar) partes.push(`Boleto ${lugar}`);
  else partes.push("Boleto");

  if (tipoEntrada) partes.push(`entrada ${tipoEntrada}`);

  // Si es “sin guía”, no tiene sentido añadir idioma
  if (tipoGuia === "sin guía") {
    partes.push("sin guía");
  } else {
    if (tipoGuia && idioma) partes.push(`${tipoGuia} en ${idioma}`);
    else if (tipoGuia) partes.push(tipoGuia);
    else if (idioma) partes.push(`en ${idioma}`);
  }

  return partes.join(", ");
}

function buildTren(servicio, tren) {
  const esc = escalasTexto(tren?.escalas);
  const origen = clean(tren?.origen);
  const destino = clean(tren?.destino);
  const clase = clean(tren?.clase);
  const sillas = tren?.sillas_reservadas;

  // Formato:
  // "Tren <directo|n escalas> <origen> – <destino>, <clase>, sillas reservadas sí/no"
  const partes = [];

  let ruta = "Tren";
  if (esc) ruta += ` ${esc}`;
  if (origen && destino) ruta += ` ${origen} – ${destino}`;
  else if (origen) ruta += ` ${origen}`;
  else if (destino) ruta += ` – ${destino}`;

  partes.push(ruta);

  if (clase) partes.push(clase.toLowerCase());

  if (typeof sillas === "boolean") {
    partes.push(`sillas reservadas ${boolSiNo(sillas)}`);
  } else if (sillas !== null && sillas !== undefined && String(sillas) !== "") {
    const b = String(sillas) === "1";
    partes.push(`sillas reservadas ${boolSiNo(b)}`);
  }

  return partes.join(", ");
}

function buildVuelo(servicio, vuelo) {
  const esc = escalasTexto(vuelo?.escalas);
  const origen = clean(vuelo?.origen);
  const destino = clean(vuelo?.destino);
  const clase = clean(vuelo?.clase);
  const equipaje = clean(vuelo?.equipaje);

  // Formato:
  // "Vuelo <directo|n escalas> <origen> – <destino>, <clase>, <equipaje>"
  const partes = [];

  let ruta = "Vuelo";
  if (esc) ruta += ` ${esc}`;
  if (origen && destino) ruta += ` ${origen} – ${destino}`;
  else if (origen) ruta += ` ${origen}`;
  else if (destino) ruta += ` – ${destino}`;

  partes.push(ruta);

  if (clase) partes.push(clase.toLowerCase());
  if (equipaje) partes.push(equipaje);

  return partes.join(", ");
}

/**
 * buildNombreWtravel(payloadServicio)
 * - Decide el tipo por el sub-objeto presente.
 * - Devuelve el string final para guardar en servicios.nombre_wtravel.
 */
function buildNombreWtravel(payload = {}) {
  const servicio = payload || {};

  // Prioridad: si existe el sub-objeto, usamos ese formato.
  if (servicio.alojamiento) return buildAlojamiento(servicio, servicio.alojamiento);
  if (servicio.traslado) return buildTraslado(servicio, servicio.traslado);
  if (servicio.tour) return buildTour(servicio, servicio.tour);
  if (servicio.boleto_entrada) return buildBoleto(servicio, servicio.boleto_entrada);
  if (servicio.tren) return buildTren(servicio, servicio.tren);
  if (servicio.vuelo) return buildVuelo(servicio, servicio.vuelo);

  // Fallback: si no hay detalle, devuelve algo usable.
  const desc = clean(servicio.descripcion);
  if (desc) return desc;

  // Por si algún flujo viejo todavía lo manda (o un script interno)
  const nombre = clean(servicio.nombre_wtravel);
  if (nombre) return nombre;

  return "";
}

module.exports = {
  buildNombreWtravel,

  // Por si luego quieres “recalcular masivo” en un script
  _internals: {
    clean,
    capFirst,
    buildAlojamiento,
    buildTraslado,
    buildTour,
    buildBoleto,
    buildTren,
    buildVuelo,
    formatDuracion,
    escalasTexto,
    mapRegimen,
    mapCategoriaHab,
    mapTipoEntrada,
    mapTipoGuia,
    normalizeIdioma,
  },
};
