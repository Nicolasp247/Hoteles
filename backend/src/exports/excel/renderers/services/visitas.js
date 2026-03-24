// backend/src/exports/excel/renderers/services/visitas.js

/**
 * Este archivo se encarga de pintar en el Excel
 * una fila de servicio del tipo visita.
 *
 * Aquí también entran otros servicios que comparten
 * el mismo formato visual, como:
 * - visita
 * - excursión
 * - boleto de entrada
 *
 * La idea es que todos esos tipos usen el mismo renderer
 * para mantener el Excel ordenado y consistente.
 */

const { SERVICE_TYPE_IDS } = require("../../services/serviceTypes");

const BLACK = "FF000000";
const LINK_BLUE = "FF0563C1";
const THIN = { style: "thin" };
const USD_ACCOUNTING_0 = '_-"USD"* #,##0_ ;_-"USD"* (#,##0)_ ;_-"USD"* "-"??_ ;_(@_)';

const FILL_FIRST = "FFD9E1F2";      // E, F, G
const FILL_SUPERIOR = "FFFFF2CC";   // H, I, J
const FILL_TRANSPORT = "FFD9D9D9";  // K, L
const FILL_OPTIONAL = "FFFCE4D6";   // M, N
const FILL_OPTIONAL_ROW = "FFFCE4D6"; // E a N cuando es_opcional = 1

const VISIT_ROW_COLUMNS = "BCDEFGHIJKLMNO".split("");
const NORMAL_PRICE_COLUMNS = ["E", "F", "H", "I"];

/**
 * Esta función aplica bordes finos a una celda,
 * solo en los lados que indiquemos.
 *
 * Así evitamos repetir el mismo bloque
 * de bordes en cada columna.
 */
function setBorder(cell, opts = {}) {
  cell.border = {
    top: opts.top ? THIN : undefined,
    left: opts.left ? THIN : undefined,
    bottom: opts.bottom ? THIN : undefined,
    right: opts.right ? THIN : undefined,
  };
}

/**
 * Esta función intenta convertir una fecha
 * en un objeto Date de JavaScript.
 *
 * Sirve tanto si la fecha ya viene como Date
 * como si llega en texto con formato tipo YYYY-MM-DD.
 *
 * Si no logra entender el valor, devuelve null.
 */
function parseToDate(value) {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const s = String(value).trim();
  const ymd = s.substring(0, 10);
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  return new Date(year, month - 1, day);
}

/**
 * Esta función intenta convertir un valor
 * en número real para usarlo en el Excel.
 *
 * Si el valor no sirve como número,
 * devuelve null.
 */
function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * Esta función aplica el estilo base de texto
 * para cualquier celda de esta fila.
 *
 * No pone relleno, porque cada bloque
 * tiene su color propio o va sin fondo.
 */
function setBaseTextStyle(cell) {
  cell.font = {
    name: "Calibri",
    size: 11,
    color: { argb: BLACK },
  };
}

/**
 * Esta función aplica un color de relleno
 * cuando el bloque lo necesita.
 */
function setFill(cell, fillArgb) {
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: fillArgb },
  };
}

/**
 * Esta función revisa si la fila necesita
 * borde superior o inferior según los vecinos.
 *
 * Reglas:
 * - si el anterior es vuelo o tren, se marca borde superior
 * - si el siguiente es alojamiento, se marca borde inferior
 */
function getVisitRowBorderContext(context = {}) {
  const previousTypeId = Number(context?.previousItem?.tipo_servicio_id);
  const nextTypeId = Number(context?.nextItem?.tipo_servicio_id);

  const needsTopBorder =
    previousTypeId === SERVICE_TYPE_IDS.VUELO ||
    previousTypeId === SERVICE_TYPE_IDS.TREN;

  const needsBottomBorder =
    nextTypeId === SERVICE_TYPE_IDS.ALOJAMIENTO;

  return {
    needsTopBorder,
    needsBottomBorder,
  };
}

/**
 * Esta función revisa si el servicio actual
 * está marcado como opcional.
 */
function isOptionalService(item) {
  return Number(item?.es_opcional) === 1;
}

/**
 * Esta función deja el relleno correcto
 * según la columna de la tabla.
 *
 * Si el servicio es opcional, todo el bloque E a N
 * se pinta del color de opcionales.
 */
function applyVisitColumnFill(cell, col, item) {
  if (isOptionalService(item) && "EFGHIJKLMN".includes(col)) {
    setFill(cell, FILL_OPTIONAL_ROW);
    return;
  }

  if (["E", "F", "G"].includes(col)) {
    setFill(cell, FILL_FIRST);
    return;
  }

  if (["H", "I", "J"].includes(col)) {
    setFill(cell, FILL_SUPERIOR);
    return;
  }

  if (["K", "L"].includes(col)) {
    setFill(cell, FILL_TRANSPORT);
    return;
  }

  if (["M", "N"].includes(col)) {
    setFill(cell, FILL_OPTIONAL);
    return;
  }

  // B, C, D y O van sin relleno
}

/**
 * Esta función construye el texto de la columna C.
 *
 * Si el servicio es opcional, agrega el prefijo:
 * "Opcional: "
 */
function buildVisitTitle(item) {
  const baseTitle = item?.titulo_override || item?.nombre_servicio || "";

  if (isOptionalService(item)) {
    return `Opcional: ${baseTitle}`;
  }

  return baseTitle;
}

/**
 * Esta función calcula el precio que se debe mostrar
 * cuando el servicio es opcional.
 *
 * La regla actual es:
 * precio_mes_usd / 0.7
 */
function getOptionalPrice(item) {
  const basePrice = safeNumber(item?.precio_mes_usd);
  if (basePrice === null) return null;

  return basePrice / 0.7;
}

/**
 * Esta función pinta una fila completa de visita,
 * excursión o boleto de entrada dentro de la tabla principal.
 *
 * Recibe la hoja, la fila donde debe empezar,
 * el item del servicio y el contexto de vecinos.
 *
 * Al final devuelve la siguiente fila libre,
 * para que el builder pueda seguir con el próximo servicio.
 */
function renderVisitaRow(ws, row, item, context = {}) {
  ws.getRow(row).height = 18;

  const { needsTopBorder, needsBottomBorder } = getVisitRowBorderContext(context);
  const isOptional = isOptionalService(item);

  for (const col of VISIT_ROW_COLUMNS) {
    const cell = ws.getCell(`${col}${row}`);
    setBaseTextStyle(cell);
    applyVisitColumnFill(cell, col, item);
  }

  // Bloque B: fecha
  const b = ws.getCell(`B${row}`);
  b.value = parseToDate(item?.fecha_servicio);
  b.numFmt = 'dddd, d "de" mmmm "de" yyyy';
  b.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };
  setBorder(b, {
    left: true,
    top: needsTopBorder,
    bottom: needsBottomBorder,
  });

  // Bloque C: nombre del servicio
  const c = ws.getCell(`C${row}`);
  c.value = buildVisitTitle(item);
  c.alignment = {
    horizontal: "left",
    vertical: "middle",
    wrapText: true,
  };
  setBorder(c, {
    right: true,
    top: needsTopBorder,
    bottom: needsBottomBorder,
  });

  // Bloque D: proveedor con link
  const d = ws.getCell(`D${row}`);
  d.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };

  if (item?.proveedor_link) {
    d.value = {
      text: item?.proveedor_iniciales || "",
      hyperlink: item.proveedor_link,
    };
    d.font = {
      name: "Calibri",
      size: 11,
      color: { argb: LINK_BLUE },
      underline: true,
    };
  } else {
    d.value = item?.proveedor_iniciales || "";
  }

  setBorder(d, {
    left: true,
    right: true,
    top: needsTopBorder,
    bottom: needsBottomBorder,
  });

  // Bloques E a O
  for (const col of "EFGHIJKLMNO".split("")) {
    const cell = ws.getCell(`${col}${row}`);

    cell.alignment = {
      horizontal: col === "O" ? "left" : "center",
      vertical: "middle",
      wrapText: true,
      indent: col === "O" ? 1 : 0,
    };

    setBorder(cell, {
      left: true,
      right: true,
      top: needsTopBorder,
      bottom: needsBottomBorder,
    });
  }

  // Limpiar primero todos los bloques de precio
  for (const col of "EFGHIJKLMN".split("")) {
    ws.getCell(`${col}${row}`).value = null;
    ws.getCell(`${col}${row}`).numFmt = USD_ACCOUNTING_0;
  }

  if (isOptional) {
    // Si es opcional, el precio va solo en M y se divide por 0.7
    ws.getCell(`M${row}`).value = getOptionalPrice(item);
  } else {
    // Si no es opcional, sigue la lógica normal
    const precioMesUsd = safeNumber(item?.precio_mes_usd);

    for (const col of NORMAL_PRICE_COLUMNS) {
      ws.getCell(`${col}${row}`).value = precioMesUsd;
    }
  }

  // Bloque O: notas
  const o = ws.getCell(`O${row}`);
  o.value = item?.nota_linea || "";

  return row + 1;
}

module.exports = { renderVisitaRow };