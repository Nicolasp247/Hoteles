// backend/src/exports/excel/renderers/rows/row2.js

/**
 * Este archivo se encarga de pintar la segunda fila fija
 * del encabezado principal del Excel.
 *
 * Aquí se muestra la línea con el destino y la fecha del viaje,
 * usando el estilo visual definido para la cabecera.
 */

const HEADER_ROW_2_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF002060" } };
const HEADER_ROW_2_FONT = { name: "Calibri", size: 14, bold: true, color: { argb: "FFBDD7EE" } };
const HEADER_ROW_2_ALIGNMENT = { horizontal: "center", vertical: "top", wrapText: true };
const HEADER_ROW_2_COLUMNS = "BCDEFGHIJKLMNO".split("");

/**
 * Esta función aplica bordes finos a una celda,
 * solo en los lados que indiquemos.
 *
 * Así evitamos repetir el mismo bloque
 * cada vez que pintamos una fila.
 */
function setBorder(cell, opts = {}) {
  const thin = { style: "thin" };
  cell.border = {
    top: opts.top ? thin : undefined,
    left: opts.left ? thin : undefined,
    bottom: opts.bottom ? thin : undefined,
    right: opts.right ? thin : undefined,
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
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!m) return null;

  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);

  return new Date(y, mo - 1, d);
}

/**
 * Esta función arma la fecha en un formato más amigable
 * para mostrarla en la cabecera del Excel.
 *
 * El resultado queda así:
 * 05 - marzo - 2026
 */
function formatFechaEsDDMesYYYY(value) {
  const dt = parseToDate(value);
  if (!dt) return "";

  const day = String(dt.getDate()).padStart(2, "0");
  const year = dt.getFullYear();
  const monthEs = dt.toLocaleString("es-ES", { month: "long" });

  return `${day} - ${monthEs} - ${year}`;
}

/**
 * Esta función construye el texto principal de la fila 2,
 * uniendo destino y fecha del viaje.
 *
 * Si alguno de los dos valores no existe,
 * devuelve solo la parte disponible.
 */
function buildHeaderLine2(cotizacion) {
  const destinoNombre = String(cotizacion?.destino_nombre ?? "").trim();
  const destinoTxt = destinoNombre || "";

  const fechaTxt = formatFechaEsDDMesYYYY(cotizacion?.fecha_viaje);

  if (destinoTxt && fechaTxt) return `${destinoTxt} // ${fechaTxt}`;
  return destinoTxt || fechaTxt || "";
}

/**
 * Esta función pinta la fila 2 del encabezado,
 * con su merge, colores, bordes y texto principal.
 */
function renderRow2(ws, cotizacion) {
  ws.getRow(2).height = 30;
  ws.mergeCells("B2:O2");

  const a2 = ws.getCell("A2");
  setBorder(a2, { right: true });

  const b2 = ws.getCell("B2");

  for (const col of HEADER_ROW_2_COLUMNS) {
    const cell = ws.getCell(`${col}2`);
    cell.fill = HEADER_ROW_2_FILL;
    cell.font = HEADER_ROW_2_FONT;
    cell.alignment = HEADER_ROW_2_ALIGNMENT;
    setBorder(cell, { left: col === "B", right: col === "O", bottom: true });
  }

  b2.value = buildHeaderLine2(cotizacion);
}

module.exports = { renderRow2 };