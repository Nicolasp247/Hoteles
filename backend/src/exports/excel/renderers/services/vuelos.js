// backend/src/exports/excel/renderers/services/vuelos.js

const FILL_GRAY = "FFF2F2F2";
const BLACK = "FF000000";
const THIN = { style: "thin" };
const USD_ACCOUNTING_0 = '_-"USD"* #,##0_ ;_-"USD"* (#,##0)_ ;_-"USD"* "-"??_ ;_(@_)';

function setBorder(cell, opts = {}) {
  cell.border = {
    top: opts.top ? THIN : undefined,
    left: opts.left ? THIN : undefined,
    bottom: opts.bottom ? THIN : undefined,
    right: opts.right ? THIN : undefined,
  };
}

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

function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Renderiza 1 fila de vuelo.
 * Retorna la siguiente fila disponible.
 *
 * item esperado:
 * - fecha_servicio
 * - nombre_servicio / servicio_texto
 * - proveedor_iniciales
 * - proveedor_link
 * - precio_usd (si algún día decides usarlo)
 */
function renderVueloRow(ws, row, item) {
  ws.getRow(row).height = 18;

  // B..O fondo gris
  const cols = "BCDEFGHIJKLMNO".split("");
  for (const col of cols) {
    const cell = ws.getCell(`${col}${row}`);
    setBaseStyle(cell);
  }

  // =========================
  // Columna B
  // =========================
  const b = ws.getCell(`B${row}`);
  b.value = parseToDate(item.fecha_servicio);
  b.numFmt = 'dddd, d "de" mmmm "de" yyyy';
  b.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };
  setBorder(b, { left: true, top: true, bottom: true });

  // =========================
  // Columna C
  // =========================
  const c = ws.getCell(`C${row}`);
  c.value = item.nombre_servicio || item.servicio_texto || "";
  c.alignment = {
    horizontal: "left",
    vertical: "middle",
    indent: 0,
    wrapText: true,
  };
  setBorder(c, { top: true, bottom: true, right: true });

  // =========================
  // Columna D
  // =========================
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

  // =========================
  // Columnas E..N
  // =========================
  const moneyCols = "EFGHIJKLMN".split("");
  for (const col of moneyCols) {
    const cell = ws.getCell(`${col}${row}`);
    cell.numFmt = USD_ACCOUNTING_0;
    cell.alignment = {
      horizontal: "left",
      vertical: "middle",
      indent: 0,
      wrapText: true,
    };
    setBorder(cell, { left: true, right: true, top: true, bottom: true });

    // Por ahora vacío. Si más adelante decides meter precio en alguna columna, aquí lo asignamos.
    cell.value = null;
  }

  // =========================
  // Columna O
  // =========================
  const o = ws.getCell(`O${row}`);
  o.value = "";
  o.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };
  setBorder(o, { left: true, right: true, top: true, bottom: true });

  return row + 1;
}

module.exports = { renderVueloRow };