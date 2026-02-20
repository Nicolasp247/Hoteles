// backend/src/exports/excel/builders/testWorkbook.builder.js
const ExcelJS = require("exceljs");

async function buildTestWorkbook() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("A", { views: [{ showGridLines: false }] });

  ws.getCell("A1").value = "Test export OK";
  ws.getCell("A1").font = { bold: true };

  ws.getCell("A3").value = "Fecha";
  ws.getCell("B3").value = new Date();
  ws.getCell("B3").numFmt = "yyyy-mm-dd";

  return wb;
}

module.exports = { buildTestWorkbook };