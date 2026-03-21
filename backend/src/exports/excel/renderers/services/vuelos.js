/**
 * Este archivo se encarga de pintar en el Excel
 * una fila de servicio del tipo vuelo.
 *
 * Aquí vive todo lo visual de ese bloque:
 * - fecha
 * - nombre del servicio
 * - operador
 * - zona de precios
 * - notas
 *
 * La idea es que el builder solo mande el item correcto
 * y este renderer se encargue de dejarlo bien presentado.
 */

const FILL_GRAY = "FFF2F2F2";
const BLACK = "FF000000";
const THIN = { style: "thin" };
const USD_ACCOUNTING_0 = '_-"USD"* #,##0_ ;_-"USD"* (#,##0)_ ;_-"USD"* "-"??_ ;_(@_)';

const FLIGHT_ROW_COLUMNS = "BCDEFGHIJKLMNO".split("");
const MONEY_COLUMNS = "EFGHIJKLMN".split("");

/**
 * Esta función aplica bordes finos a una celda,
 * solo en los lados que indiquemos.
 *
 * Así evitamos repetir el mismo bloque de bordes
 * una y otra vez en cada columna.
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
 * al formato Date de JavaScript.
 *
 * Acepta fechas que ya vienen como Date
 * o textos tipo YYYY-MM-DD.
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

  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * Esta función aplica el estilo base de la fila:
 * letra, color y fondo general.
 *
 * Luego cada columna puede ajustar encima
 * lo que necesite de forma puntual.
 */
function setBaseStyle(cell) {
  cell.font = {
    name: "Calibri",
    size: 11,
    color: { argb: BLACK },
  };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: FILL_GRAY },
  };
}

/**
 * Esta función pinta una fila completa de vuelo
 * dentro de la tabla principal del Excel.
 *
 * Recibe la hoja, la fila donde debe empezar
 * y el item del servicio.
 *
 * Al final devuelve la siguiente fila libre,
 * para que el builder pueda seguir con el próximo servicio.
 */
function renderVueloRow(ws, row, item) {
  ws.getRow(row).height = 18;

  for (const col of FLIGHT_ROW_COLUMNS) {
    const cell = ws.getCell(`${col}${row}`);
    setBaseStyle(cell);
  }

  // Columna B: fecha
  const b = ws.getCell(`B${row}`);
  b.value = parseToDate(item.fecha_servicio);
  b.numFmt = 'dddd, d "de" mmmm "de" yyyy';
  b.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };
  setBorder(b, { left: true, top: true, bottom: true });

  // Columna C: nombre del servicio
  const c = ws.getCell(`C${row}`);
  c.value = item.titulo_override || item.nombre_servicio || item.descripcion_servicio || "";
  c.alignment = {
    horizontal: "left",
    vertical: "middle",
    indent: 0,
    wrapText: true,
  };
  setBorder(c, { top: true, bottom: true, right: true });

  // Columna D: operador / proveedor
  const d = ws.getCell(`D${row}`);
  d.value = item.proveedor_iniciales || "";
  d.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };
  setBorder(d, { left: true, right: true, top: true, bottom: true });

  if (item.proveedor_link) {
    d.value = {
      text: item.proveedor_iniciales || "",
      hyperlink: item.proveedor_link,
    };
    d.font = {
      name: "Calibri",
      size: 11,
      color: { argb: "FF0563C1" },
      underline: true,
    };
  }

  // Columnas E..N: precios
  for (const col of MONEY_COLUMNS) {
    const cell = ws.getCell(`${col}${row}`);
    cell.numFmt = USD_ACCOUNTING_0;
    cell.alignment = {
      horizontal: "left",
      vertical: "middle",
      indent: 0,
      wrapText: true,
    };
    setBorder(cell, { left: true, right: true, top: true, bottom: true });
    cell.value = null;
  }

  // Columna O: notas
  const o = ws.getCell(`O${row}`);
  o.value = item.nota_linea || "";
  o.alignment = {
    horizontal: "left",
    vertical: "middle",
    wrapText: true,
    indent: 1,
  };
  setBorder(o, { left: true, right: true, top: true, bottom: true });

  return row + 1;
}

module.exports = { renderVueloRow };