// backend/src/exports/excel/utils/sendExcel.js

async function sendWorkbookAsXlsx(res, workbook, filenameBase) {
  // ExcelJS: workbook.xlsx.writeBuffer() devuelve un Buffer/ArrayBuffer
  const buffer = await workbook.xlsx.writeBuffer();

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filenameBase}.xlsx"`
  );
  res.setHeader("Cache-Control", "no-store");

  return res.status(200).send(Buffer.from(buffer));
}

module.exports = { sendWorkbookAsXlsx };