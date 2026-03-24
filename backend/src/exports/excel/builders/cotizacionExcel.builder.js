// backend/src/exports/excel/builders/cotizacionExcel.builder.js
/**
 * Este archivo se encarga de construir el Excel base
 * de una cotización.
 *
 * Aquí se prepara la hoja principal, se aplican
 * los estilos globales, se pintan las filas fijas
 * y luego se recorren los servicios dinámicos
 * para enviarlos al renderer que corresponda.
 */

const ExcelJS = require("exceljs");
const { renderRow1 } = require("../renderers/rows/row1");
const { renderRow2 } = require("../renderers/rows/row2");
const { renderRow3y4 } = require("../renderers/rows/row3y4");
const { renderTransportRow } = require("../renderers/services/vuelos");
const { renderVisitaRow } = require("../renderers/services/visitas");
const { renderTrasladoRow } = require("../renderers/services/traslados");
const { renderAlojamientoRow } = require("../renderers/services/alojamiento");
const { SERVICE_TYPE_IDS, VISIT_SERVICE_TYPE_IDS } = require("../services/serviceTypes");
const { renderTotalesFinales } = require("../renderers/totals/totalesFinales");

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

/**
 * Esta función aplica la configuración global de la hoja:
 * anchos de columnas, formatos y alineaciones base.
 */
function applyGlobals(ws) {
  ws.views = [{ showGridLines: true }];

  Object.entries(COL_WIDTHS).forEach(([letter, width]) => {
    ws.getColumn(letter).width = width;
  });

  ws.getColumn("B").numFmt = 'dddd, d "de" mmmm "de" yyyy';

  ["E", "F", "G", "H", "I", "J", "K", "L", "M", "N"].forEach((col) => {
    ws.getColumn(col).numFmt = USD_ACCOUNTING_0;
  });

  const centerCols = ["A", "B", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "P"];
  const leftIndentCols = ["C", "O"];

  centerCols.forEach((col) => {
    ws.getColumn(col).alignment = {
      horizontal: "center",
      vertical: "middle",
    };
  });

  leftIndentCols.forEach((col) => {
    ws.getColumn(col).alignment = {
      horizontal: "left",
      vertical: "middle",
      indent: 1,
    };
  });
}

/**
 * Esta función mira el tipo de servicio de un item y decide
 * qué renderer se debe usar para pintarlo en el Excel.
 *
 * Si todavía no existe un renderer para ese tipo,
 * devuelve null para que el builder use la fila de aviso.
 */
function getServiceRenderer(item) {
  const tipoId = Number(item?.tipo_servicio_id);

  if (tipoId === SERVICE_TYPE_IDS.ALOJAMIENTO) {
    return renderAlojamientoRow;
  }

  if (
    tipoId === SERVICE_TYPE_IDS.VUELO ||
    tipoId === SERVICE_TYPE_IDS.TREN
  ) {
    return renderTransportRow;
  }

  if (tipoId === SERVICE_TYPE_IDS.TRASLADO) {
    return renderTrasladoRow;
  }

  if (VISIT_SERVICE_TYPE_IDS.includes(tipoId)) {
    return renderVisitaRow;
  }

  return null;
}

const UNSUPPORTED_SERVICE_COLUMNS = ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O"];
const WARNING_FILL = "FFFFF2CC";
const WARNING_NOTE = "Revisar renderer pendiente";

/**
 * Esta función pinta una fila de aviso cuando llega un servicio
 * que todavía no tiene renderer propio.
 *
 * Así el Excel no pierde información y nos deja ver
 * claramente qué tipo falta por implementar.
 */
function renderUnsupportedServiceRow(ws, row, item) {
  ws.getRow(row).height = 18;

  UNSUPPORTED_SERVICE_COLUMNS.forEach((col) => {
    const cell = ws.getCell(`${col}${row}`);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: WARNING_FILL },
    };
    cell.font = {
      name: "Calibri",
      size: 11,
      color: { argb: "FF000000" },
      italic: col === "C",
    };
    cell.alignment = {
      horizontal: col === "C" || col === "O" ? "left" : "center",
      vertical: "middle",
      wrapText: true,
      indent: col === "C" || col === "O" ? 1 : 0,
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "thin", color: { argb: "FF000000" } },
      ...(col === "B" ? { left: { style: "thin", color: { argb: "FF000000" } } } : {}),
      ...(col === "O" ? { right: { style: "thin", color: { argb: "FF000000" } } } : {}),
    };
  });

  ws.getCell(`B${row}`).value = item?.fecha_servicio || null;
  ws.getCell(`C${row}`).value = `Tipo de servicio no soportado aún: ${item?.tipo_servicio || "Sin tipo"}`;
  ws.getCell(`D${row}`).value = item?.tipo_servicio_id ?? "";
  ws.getCell(`O${row}`).value = WARNING_NOTE;

  return row + 1;
}

/**
 * Convierte una letra de columna de Excel en su número real.
 * Por ejemplo: A -> 1, Z -> 26, AA -> 27.
 */
function columnLetterToNumber(col) {
  let n = 0;
  const s = String(col).toUpperCase();

  for (let i = 0; i < s.length; i++) {
    n = n * 26 + (s.charCodeAt(i) - 64);
  }

  return n;
}

/**
 * Esta función aplica la fuente base del proyecto
 * a un rango completo de celdas.
 *
 * Sirve cuando queremos dejar una zona con el mismo
 * tipo y tamaño de letra sin repetir estilo celda por celda.
 */
function applyBaseFontToRange(ws, fromRow, toRow, fromColLetter, toColLetter) {
  const fromCol = columnLetterToNumber(fromColLetter);
  const toCol = columnLetterToNumber(toColLetter);

  for (let r = fromRow; r <= toRow; r++) {
    for (let c = fromCol; c <= toCol; c++) {
      const cell = ws.getCell(r, c);
      cell.font = { name: "Calibri", size: 11, ...(cell.font || {}) };
    }
  }
}

/**
 * Esta función construye el Excel base de una cotización.
 *
 * Se encarga de:
 * - crear el workbook
 * - preparar la hoja principal
 * - aplicar estilos globales
 * - pintar las filas fijas
 * - recorrer los servicios dinámicos
 * - agregar el bloque final de totales
 */
async function buildCotizacionWorkbookBase(cotizacion, items = []) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "WTravel";
  workbook.created = new Date();

  const ws = workbook.addWorksheet("A", {
    views: [{ showGridLines: false }],
  });

  applyGlobals(ws);

  renderRow1(ws, cotizacion);
  renderRow2(ws, cotizacion);
  renderRow3y4(ws);

  let currentRow = 5;
  const DATA_START_ROW = 5;

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const previousItem = index > 0 ? items[index - 1] : null;
    const nextItem = index < items.length - 1 ? items[index + 1] : null;

    const renderer = getServiceRenderer(item);

    if (renderer) {
      currentRow = renderer(ws, currentRow, item, {
        previousItem,
        nextItem,
        totalPasajeros: cotizacion?.total_pasajeros,
      });
    } else {
      currentRow = renderUnsupportedServiceRow(ws, currentRow, item);
    }
  }

  if (currentRow > DATA_START_ROW) {
    const lastServiceRow = currentRow - 1;
    currentRow = renderTotalesFinales(ws, currentRow, DATA_START_ROW, lastServiceRow);
  }

  return workbook;
}

module.exports = {
  buildCotizacionWorkbookBase,
  applyBaseFontToRange,
};