// backend/src/exports/excel/utils/sendExcel.js
/**
 * Este archivo se encarga de enviar el Excel
 * al cliente como un archivo descargable.
 *
 * Aquí no se construye el Excel, solo se toma
 * el workbook ya generado y se devuelve
 * con los headers correctos.
 */

const EXCEL_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Esta función recibe un workbook de ExcelJS
 * y lo envía como respuesta HTTP para descarga.
 *
 * Se encarga de:
 * - generar el buffer
 * - configurar los headers
 * - devolver el archivo al cliente
 */
async function sendWorkbookAsXlsx(res, workbook, filenameBase) {
  const buffer = await workbook.xlsx.writeBuffer();

  res.setHeader("Content-Type", EXCEL_MIME_TYPE);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filenameBase}.xlsx"`
  );
  res.setHeader("Cache-Control", "no-store");

  return res.status(200).send(Buffer.from(buffer));
}

module.exports = { sendWorkbookAsXlsx };