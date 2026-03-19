// backend/src/exports/excel/renderers/rows/row2.js

function setBorder(cell, opts = {}) {
  const thin = { style: "thin" };
  cell.border = {
    top: opts.top ? thin : undefined,
    left: opts.left ? thin : undefined,
    bottom: opts.bottom ? thin : undefined,
    right: opts.right ? thin : undefined,
  };
}

// Acepta:
// - Date (MySQL a veces devuelve Date)
// - "YYYY-MM-DD"
// - ISO "YYYY-MM-DDTHH:mm:ss..."
// - Cualquier cosa que tenga YYYY-MM-DD en los primeros 10 chars
function parseToDate(value) {
  if (!value) return null;

  // 1) Si ya es Date
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  // 2) Si viene como string
  const s = String(value).trim();
  const ymd = s.substring(0, 10); // intenta sacar YYYY-MM-DD
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;

  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);

  // Local, sin offset UTC
  return new Date(y, mo - 1, d);
}

function formatFechaEsDDMesYYYY(value) {
  const dt = parseToDate(value);
  if (!dt) return "";

  const day = String(dt.getDate()).padStart(2, "0");
  const year = dt.getFullYear();
  const monthEs = dt.toLocaleString("es-ES", { month: "long" });

  return `${day} - ${monthEs} - ${year}`;
}

function buildHeaderLine2(c) {
  const destinoNombre = String(c?.destino_nombre ?? "").trim();
  const destinoTxt = destinoNombre || "";

  const fechaTxt = formatFechaEsDDMesYYYY(c?.fecha_viaje);

  if (destinoTxt && fechaTxt) return `${destinoTxt} // ${fechaTxt}`;
  return destinoTxt || fechaTxt || "";
}

function renderRow2(ws, cotizacion) {
  ws.getRow(2).height = 30;
  ws.mergeCells("B2:O2");

  const a2 = ws.getCell("A2");
  setBorder(a2, { right: true });

  const b2 = ws.getCell("B2");

  const fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF002060" } };
  const font = { name: "Calibri", size: 14, bold: true, color: { argb: "FFBDD7EE" } };
  const alignment = { horizontal: "center", vertical: "top", wrapText: true };

  const cols = "BCDEFGHIJKLMNO".split("");
  for (const col of cols) {
    const cell = ws.getCell(`${col}2`);
    cell.fill = fill;
    cell.font = font;
    cell.alignment = alignment;
    setBorder(cell, { left: col === "B", right: col === "O", bottom: true });
  }

  b2.value = buildHeaderLine2(cotizacion);
}

module.exports = { renderRow2 };