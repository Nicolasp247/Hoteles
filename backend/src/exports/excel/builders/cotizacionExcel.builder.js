// backend/src/exports/excel/builders/cotizacionExcel.builder.js
const ExcelJS = require("exceljs");

/**
 * Crea workbook base para export de cotización.
 * - 1 sola hoja
 * - nombre de hoja: "A"
 */
async function buildCotizacionWorkbookBase() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "WTravel";
  wb.created = new Date();

  const ws = wb.addWorksheet("A", {
    views: [{ showGridLines: false }],
  });

  // Placeholder mínimo (luego lo reemplazamos por el layout real)
  ws.getCell("A1").value = "EXPORT COTIZACIÓN (BASE)";
  ws.getCell("A1").font = { bold: true, size: 14 };

  return wb;
}

module.exports = { buildCotizacionWorkbookBase };