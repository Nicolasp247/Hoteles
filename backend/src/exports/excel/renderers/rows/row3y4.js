// backend/src/exports/excel/renderers/rows/row3y4.js
/**
 * Este archivo se encarga de pintar las filas 3 y 4
 * del encabezado fijo de la tabla principal del Excel.
 *
 * Aquí se construye la parte de títulos y subtítulos
 * de las columnas, con sus colores, merges y bordes.
 */

const HEADER_FONT_NAME = "Calibri";
const HEADER_FONT_COLOR = "FF000000";
const ROW_3_HEIGHT = 18;
const ROW_4_HEIGHT = 18;
const EXCEL_COLUMNS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const HEADER_VERTICAL_BLOCKS = [
  { range: "B3:B4", fillArgb: "FFE2EFDA", text: "FECHAS" },
  { range: "C3:C4", fillArgb: "FFE2EFDA", text: "SERVICIO INCLUIDO" },
  { range: "D3:D4", fillArgb: "FFFFFFFF", text: "OPERADOR" },
];

const HEADER_ROW_3_BLOCKS = [
  { range: "E3:G3", fillArgb: "FF8EA9DB", text: "PRIMERA *" },
  { range: "H3:J3", fillArgb: "FFFFD966", text: "PRIMERA SUPERIOR*" },
  { range: "K3:L3", fillArgb: "FFAEAAAA", text: "TRANSPORTE" },
  { range: "M3:N3", fillArgb: "FFF8CBAD", text: "OPCIONALES" },
  { range: "O3:O3", fillArgb: "FFFFFFFF", text: "NOTAS" },
];

const HEADER_ROW_4_BLOCKS = [
  { range: "E4:E4", fillArgb: "FFB4C6E7", bold: false, text: "DOBLE" },
  { range: "F4:F4", fillArgb: "FFB4C6E7", bold: false, text: "TRIPLE" },
  { range: "G4:G4", fillArgb: "FFB4C6E7", bold: false, text: "NIÑO <10" },

  { range: "H4:H4", fillArgb: "FFFFE699", bold: false, text: "DOBLE" },
  { range: "I4:I4", fillArgb: "FFFFE699", bold: false, text: "TRIPLE" },
  { range: "J4:J4", fillArgb: "FFFFE699", bold: false, text: "NIÑO <10" },

  { range: "K4:K4", fillArgb: "FFD9D9D9", bold: false, text: "ADULTO" },
  { range: "L4:L4", fillArgb: "FFD9D9D9", bold: false, text: "NIÑO <10" },

  { range: "M4:M4", fillArgb: "FFFCE4D6", bold: false, text: "ADULTO" },
  { range: "N4:N4", fillArgb: "FFFCE4D6", bold: false, text: "NIÑO <10" },

  { range: "O4:O4", fillArgb: "FFFFFFFF", bold: false, text: "Horario / Estaciones - Aeropuerto, etc." },
];

/**
 * Esta función convierte una letra de columna
 * en su posición dentro del alfabeto de Excel.
 *
 * Sirve para recorrer bloques completos
 * entre una columna inicial y una final.
 */
function getColumnIndex(letter) {
  return EXCEL_COLUMNS.indexOf(letter);
}

/**
 * Esta función aplica bordes finos a una celda,
 * solo en los lados que indiquemos.
 *
 * Así mantenemos el mismo estilo de borde
 * en todo el encabezado.
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
 * Esta función pinta un bloque del encabezado.
 *
 * Puede usarse tanto para una sola celda
 * como para un rango combinado con merge.
 *
 * Se encarga de:
 * - unir el rango
 * - poner texto
 * - aplicar color
 * - aplicar fuente
 * - aplicar alineación
 * - marcar bordes en todo el bloque
 */
function applyBlock(
  ws,
  range,
  { fillArgb, bold = true, size = 11, text = "", align = "center", vAlign = "middle" }
) {
  const [start, end] = range.split(":");
  const startCol = start.match(/[A-Z]+/)[0];
  const startRow = Number(start.match(/\d+/)[0]);
  const endCol = end.match(/[A-Z]+/)[0];
  const endRow = Number(end.match(/\d+/)[0]);

  ws.mergeCells(range);

  const masterCell = ws.getCell(start);
  masterCell.value = text;

  const fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: fillArgb },
  };

  const font = {
    name: HEADER_FONT_NAME,
    size,
    bold,
    color: { argb: HEADER_FONT_COLOR },
  };

  const alignment = {
    horizontal: align,
    vertical: vAlign,
    wrapText: true,
  };

  const fromCol = getColumnIndex(startCol);
  const toCol = getColumnIndex(endCol);

  for (let row = startRow; row <= endRow; row++) {
    for (let colIndex = fromCol; colIndex <= toCol; colIndex++) {
      const col = EXCEL_COLUMNS[colIndex];
      const cell = ws.getCell(`${col}${row}`);
      cell.fill = fill;
      cell.font = font;
      cell.alignment = alignment;
      setBorder(cell, { top: true, left: true, bottom: true, right: true });
    }
  }
}

/**
 * Esta función pinta por completo las filas 3 y 4
 * del encabezado de la tabla.
 *
 * Aquí se aplican las alturas, los bordes laterales
 * y todos los bloques de títulos y subtítulos.
 */
function renderRow3y4(ws) {
  ws.getRow(3).height = ROW_3_HEIGHT;
  ws.getRow(4).height = ROW_4_HEIGHT;

  const a3 = ws.getCell("A3");
  const a4 = ws.getCell("A4");
  setBorder(a3, { right: true });
  setBorder(a4, { right: true });

  const p3 = ws.getCell("P3");
  const p4 = ws.getCell("P4");
  setBorder(p3, { left: true });
  setBorder(p4, { left: true });

  for (const block of HEADER_VERTICAL_BLOCKS) {
    applyBlock(ws, block.range, block);
  }

  for (const block of HEADER_ROW_3_BLOCKS) {
    applyBlock(ws, block.range, block);
  }

  for (const block of HEADER_ROW_4_BLOCKS) {
    applyBlock(ws, block.range, block);
  }
}

module.exports = { renderRow3y4 };