// backend/src/exports/excel/controllers/testExcel.controller.js
const { buildTestWorkbook } = require("../builders/testWorkbook.builder");
const { sendWorkbookAsXlsx } = require("../utils/sendExcel");
const { safeFilename } = require("../utils/filename");

module.exports = async function testExcelController(_req, res, next) {
  try {
    const wb = await buildTestWorkbook();
    await sendWorkbookAsXlsx(res, wb, safeFilename("test_export"));
  } catch (e) {
    return next(e);
  }
};