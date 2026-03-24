// backend/src/exports/excel/renderers/services/alojamiento.js

/**
 * Este archivo se encarga de pintar en el Excel
 * un bloque de servicio del tipo alojamiento.
 *
 * A diferencia de otros servicios, el alojamiento
 * usa 2 filas seguidas:
 * - una fila superior con ciudad y país
 * - una fila inferior con fechas, hotel, proveedor y precios
 *
 * La idea es que todo el bloque quede bien presentado
 * y visualmente separado dentro de la tabla principal.
 */

const BLACK = "FF000000";
const LINK_BLUE = "FF0563C1";
const THIN = { style: "thin" };
const USD_ACCOUNTING_0 = '_-"USD"* #,##0_ ;_-"USD"* (#,##0)_ ;_-"USD"* "-"??_ ;_(@_)';

const FILL_FIRST = "FFD9E1F2";      // E, F, G
const FILL_SUPERIOR = "FFFFF2CC";   // H, I, J
const FILL_TRANSPORT = "FFD9D9D9";  // K, L
const FILL_OPTIONAL = "FFFCE4D6";   // M, N

const DETAIL_ROW_COLUMNS = "BCDEFGHIJKLMNO".split("");

/**
 * Esta función aplica bordes finos a una celda,
 * solo en los lados que indiquemos.
 *
 * Así evitamos repetir el mismo bloque
 * una y otra vez en cada celda.
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
 * a una celda del bloque de alojamiento.
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
 * a una celda cuando el bloque lo necesita.
 */
function setFill(cell, fillArgb) {
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: fillArgb },
  };
}

/**
 * Esta función devuelve el nombre del mes en español
 * para una fecha dada.
 */
function getSpanishMonthName(date) {
  return date.toLocaleString("es-ES", { month: "long" });
}

/**
 * Esta función suma una cantidad de noches
 * a una fecha de inicio.
 */
function addNights(startDate, nights) {
  const result = new Date(startDate);
  result.setDate(result.getDate() + nights);
  return result;
}

/**
 * Esta función construye el texto del rango de fechas
 * para el bloque B de la segunda fila del alojamiento.
 *
 * Tiene 3 formas:
 * - mismo mes y mismo año
 * - distinto mes, mismo año
 * - distinto año
 */
function buildStayDateRange(fechaServicio, noches) {
  const startDate = parseToDate(fechaServicio);
  const totalNights = safeNumber(noches);

  if (!startDate || totalNights === null) {
    return "";
  }

  const endDate = addNights(startDate, totalNights);

  const startDay = startDate.getDate();
  const endDay = endDate.getDate();

  const startMonth = getSpanishMonthName(startDate);
  const endMonth = getSpanishMonthName(endDate);

  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  const sameYear = startYear === endYear;
  const sameMonth = sameYear && startDate.getMonth() === endDate.getMonth();

  if (sameMonth) {
    return `${startDay} - ${endDay} de ${startMonth} de ${startYear}`;
  }

  if (sameYear) {
    return `${startDay} de ${startMonth} - ${endDay} de ${endMonth} de ${startYear}`;
  }

  return `${startDay} de ${startMonth} de ${startYear} - ${endDay} de ${endMonth} de ${endYear}`;
}

/**
 * Esta función arma el texto de ciudad y país
 * para la primera fila del bloque.
 *
 * El formato queda así:
 * CIUDAD (PAÍS)
 */
function buildCityCountryLabel(item) {
  const ciudad = String(item?.ciudad_nombre || item?.ciudad || "").trim();
  const pais = String(item?.pais_nombre || "").trim();

  if (ciudad && pais) {
    return `${ciudad} (${pais})`;
  }

  return ciudad || pais || "";
}

/**
 * Esta función aplica el relleno correcto
 * según la columna de la segunda fila.
 */
function applyAlojamientoDetailFill(cell, col) {
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
 * Esta función calcula el precio por persona
 * para habitación doble.
 *
 * Regla:
 * precio DBL / 2
 */
function getDblPrice(item) {
  const basePrice = safeNumber(item?.alojamiento_precio_dbl_usd);
  if (basePrice === null) return null;
  return basePrice / 2;
}

/**
 * Esta función calcula el precio por persona
 * para habitación triple.
 *
 * Regla:
 * precio TRP / 3
 */
function getTrpPrice(item) {
  const basePrice = safeNumber(item?.alojamiento_precio_trp_usd);
  if (basePrice === null) return null;
  return basePrice / 3;
}

/**
 * Esta función pinta la primera fila del bloque,
 * que funciona como encabezado del alojamiento.
 *
 * Aquí se muestra la ciudad y el país.
 */
function renderAlojamientoHeaderRow(ws, row, item) {
  ws.getRow(row).height = 18;

  ws.mergeCells(`B${row}:C${row}`);

  // B:C
  const b = ws.getCell(`B${row}`);
  b.value = buildCityCountryLabel(item);
  b.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };
  b.font = {
    name: "Calibri",
    size: 11,
    color: { argb: BLACK },
    bold: true,
  };
  setBorder(b, {
    top: true,
    left: true,
    right: true,
  });

  const c = ws.getCell(`C${row}`);
  setBorder(c, {
    top: true,
    left: true,
    right: true,
  });

  // D:O
  for (const col of "DEFGHIJKLMNO".split("")) {
    const cell = ws.getCell(`${col}${row}`);
    setBaseTextStyle(cell);
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };

    setBorder(cell, {
      top: true,
      left: col === "D" || "EFGHIJKLMNO".includes(col),
      right: col === "D" || "EFGHIJKLMNO".includes(col),
    });
  }
}

/**
 * Esta función pinta la segunda fila del bloque,
 * que contiene fechas, hotel, proveedor y precios.
 */
function renderAlojamientoDetailRow(ws, row, item) {
  ws.getRow(row).height = 18;

  for (const col of DETAIL_ROW_COLUMNS) {
    const cell = ws.getCell(`${col}${row}`);
    setBaseTextStyle(cell);
    applyAlojamientoDetailFill(cell, col);
  }

  // Bloque B: rango de fechas
  const b = ws.getCell(`B${row}`);
  b.value = buildStayDateRange(item?.fecha_servicio, item?.alojamiento_noches);
  b.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };
  setBorder(b, {
    left: true,
  });

  // Bloque C: nombre del hotel
  const c = ws.getCell(`C${row}`);
  c.value = item?.titulo_override || item?.nombre_servicio || "";
  c.alignment = {
    horizontal: "left",
    vertical: "middle",
    wrapText: true,
  };
  setBorder(c, {
    right: true,
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
    });
  }

  // Precios
  const e = ws.getCell(`E${row}`);
  e.numFmt = USD_ACCOUNTING_0;
  e.value = getDblPrice(item);

  const f = ws.getCell(`F${row}`);
  f.numFmt = USD_ACCOUNTING_0;
  f.value = getTrpPrice(item);

  // G:N vacíos por ahora
  for (const col of "GHIJKLMN".split("")) {
    const cell = ws.getCell(`${col}${row}`);
    cell.numFmt = USD_ACCOUNTING_0;
    cell.value = null;
  }

  // O: notas
  const o = ws.getCell(`O${row}`);
  o.value = item?.nota_linea || "";
}

/**
 * Esta función pinta el bloque completo de alojamiento.
 *
 * Un alojamiento ocupa 2 filas seguidas:
 * - fila superior: ciudad y país
 * - fila inferior: detalle del hotel
 *
 * Al final devuelve la siguiente fila libre.
 */
function renderAlojamientoRow(ws, row, item) {
  renderAlojamientoHeaderRow(ws, row, item);
  renderAlojamientoDetailRow(ws, row + 1, item);

  return row + 2;
}

module.exports = { renderAlojamientoRow };