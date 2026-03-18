// backend/src/exports/excel/builders/testWorkbook.builder.js
const ExcelJS = require("exceljs");

async function buildTestWorkbook() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("A", { views: [{ showGridLines: false }] });

    ws.getCell("A10").value = "Hola mundo";

  return wb;
}

module.exports = { buildTestWorkbook };