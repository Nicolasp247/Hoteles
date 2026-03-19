// backend/src/exports/excel/builders/cotizacionExcel.builder.js
const ExcelJS = require("exceljs");
//
const { renderRow1 } = require("../renderers/rows/row1");
const { renderRow2 } = require("../renderers/rows/row2");
const { renderRow3y4 } = require("../renderers/rows/row3y4");
const { renderVueloRow } = require("../renderers/services/vuelos");

// ExcelJS usa "width" ~ caracteres, no pixeles.
// Estos valores son aproximados para verse parecido.
const COL_WIDTHS = {
  A: 3,   
  B: 30,  
  C: 80,  
  D: 15,  
  E: 15,
  F: 15,
  G: 15,
  H: 15,
  I: 15,
  J: 15,
  K: 15,
  L: 15,
  M: 15,
  N: 15,
  O: 40,  
  P: 3,   
};

// Formato de contabilidad USD, 0 decimales
const USD_ACCOUNTING_0 = '_-"USD"* #,##0_ ;_-"USD"* (#,##0)_ ;_-"USD"* "-"??_ ;_(@_)';

function applyGlobals(ws) {
  // Ocultar gridlines
  ws.views = [{ showGridLines: true }];

  // Anchos A..P
  Object.entries(COL_WIDTHS).forEach(([letter, width]) => {
    ws.getColumn(letter).width = width;
  });

  // Formatos por columna
  // B: fecha tipo "miércoles, 14 de marzo de 2012"
  ws.getColumn("B").numFmt = 'dddd, d "de" mmmm "de" yyyy';

  // E..N: contabilidad USD, 0 decimales
  ["E","F","G","H","I","J","K","L","M","N"].forEach((col) => {
    ws.getColumn(col).numFmt = USD_ACCOUNTING_0;
  });

  // ==============================
  // 🔵 ALINEACIONES GLOBALES
  // ==============================

  const centerCols = ["A","B","D","E","F","G","H","I","J","K","L","M","N","P"];
  const leftIndentCols = ["C","O"];

  // Centro horizontal + vertical centro
  centerCols.forEach((col) => {
    ws.getColumn(col).alignment = {
      horizontal: "center",
      vertical: "middle"
    };
  });

  // Izquierda con sangría + vertical centro
  leftIndentCols.forEach((col) => {
    ws.getColumn(col).alignment = {
      horizontal: "left",
      vertical: "middle",
      indent: 1   // cambiar a 2 si quieres más sangría
    };
  });

}

/**
 * Helper: aplica fuente base Calibri 11 a un rango.
 * Útil porque ExcelJS no tiene una "fuente global real".
 */
function applyBaseFontToRange(ws, fromRow, toRow, fromColLetter, toColLetter) {
  const colToNumber = (col) => {
    let n = 0;
    const s = String(col).toUpperCase();
    for (let i = 0; i < s.length; i++) {
      n = n * 26 + (s.charCodeAt(i) - 64);
    }
    return n;
  };

  const fromCol = colToNumber(fromColLetter);
  const toCol = colToNumber(toColLetter);

  for (let r = fromRow; r <= toRow; r++) {
    for (let c = fromCol; c <= toCol; c++) {
      const cell = ws.getCell(r, c);
      cell.font = { name: "Calibri", size: 11, ...(cell.font || {}) };
    }
  }
}

/**
 * Crea workbook base para export de cotización.
 * - 1 sola hoja
 * - nombre de hoja: "A"
 * - aplica reglas globales (anchos + formatos)
 */

async function buildCotizacionWorkbookBase(cotizacion, items = []) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "WTravel";
  wb.created = new Date();

  const ws = wb.addWorksheet("A", {
    views: [{ showGridLines: false }],
  });

  applyGlobals(ws);

  // Filas fijas
  renderRow1(ws, cotizacion);
  renderRow2(ws, cotizacion);
  renderRow3y4(ws);

  // Servicios dinámicos arrancan en fila 5
  let currentRow = 5;

  for (const item of items) {
    const tipo = String(item.tipo_servicio || "").toLowerCase();

    if (tipo.includes("vuelo") || tipo.includes("avion") || tipo.includes("avión")) {
      currentRow = renderVueloRow(ws, currentRow, item);
    }
  }

  return wb;
}

module.exports = {
  buildCotizacionWorkbookBase,
  applyBaseFontToRange, // lo exporto para que lo uses en builders de filas
};