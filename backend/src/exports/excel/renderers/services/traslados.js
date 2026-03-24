//backend /src/exports/excel/renderers/services/traslados.js

/**
 * Este archivo se encarga de pintar en el Excel
 * una fila de servicio del tipo traslado.
 *
 * Visualmente se parece mucho al formato de visitas,
 * pero tiene una regla especial en el precio:
 * el valor se divide entre la cantidad total
 * de pasajeros de la cotización.
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

const TRASLADO_ROW_COLUMNS = "BCDEFGHIJKLMNO".split("");
const TRASLADO_PRICE_COLUMNS = ["E", "F", "H", "I"];

/**
 * Esta función aplica bordes finos a una celda,
 * solo en los lados que indiquemos.
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
 * según la columna de la tabla.
 */
function setFill(cell, fillArgb) {
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: fillArgb },
  };
}

/**
 * Esta función deja el relleno correcto
 * según la columna de la tabla.
 */
function applyTrasladoColumnFill(cell, col) {
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
 * Esta función revisa si la fila necesita
 * borde superior o inferior según los vecinos.
 *
 * Reglas:
 * - si el anterior es vuelo o tren, se marca borde superior
 * - si el siguiente es alojamiento, se marca borde inferior
 */
function getTrasladoRowBorderContext(context = {}) {
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
 * Esta función calcula el precio unitario del traslado
 * dividiendo el precio mensual entre el total de pasajeros.
 *
 * Si falta alguno de los datos o el total no sirve,
 * devuelve null.
 */
function getTrasladoUnitPrice(item, context = {}) {
  const totalPasajeros = safeNumber(context?.totalPasajeros);
  const precioBase = safeNumber(item?.precio_mes_usd);

  if (precioBase === null || totalPasajeros === null || totalPasajeros <= 0) {
    return null;
  }

  return precioBase / totalPasajeros;
}

/**
 * Esta función pinta una fila completa de traslado
 * dentro de la tabla principal del Excel.
 *
 * Recibe la hoja, la fila donde debe empezar,
 * el item del servicio y el contexto de vecinos.
 *
 * Al final devuelve la siguiente fila libre.
 */
function renderTrasladoRow(ws, row, item, context = {}) {
  ws.getRow(row).height = 18;

  const { needsTopBorder, needsBottomBorder } = getTrasladoRowBorderContext(context);

  for (const col of TRASLADO_ROW_COLUMNS) {
    const cell = ws.getCell(`${col}${row}`);
    setBaseTextStyle(cell);
    applyTrasladoColumnFill(cell, col);
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
  c.value = item?.titulo_override || item?.nombre_servicio || "";
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

  const unitPrice = getTrasladoUnitPrice(item, context);

  for (const col of TRASLADO_PRICE_COLUMNS) {
    ws.getCell(`${col}${row}`).value = unitPrice;
  }

  // Bloque O: notas
  const o = ws.getCell(`O${row}`);
  o.value = item?.nota_linea || "";

  return row + 1;
}

module.exports = { renderTrasladoRow };