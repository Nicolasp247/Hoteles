// backend/src/exports/excel/controllers/cotizacionExcel.controller.js
const { sendWorkbookAsXlsx } = require("../utils/sendExcel");
const { safeFilename } = require("../utils/filename");
const { getCotizacionExportData } = require("../services/cotizacionExcel.service");
const { buildCotizacionWorkbookBase } = require("../builders/cotizacionExcel.builder");

module.exports = async function cotizacionExcelController(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, mensaje: "ID de cotización inválido." });
    }

    const data = await getCotizacionExportData(id);

    if (!data) {
      return res.status(404).json({ ok: false, mensaje: "Cotización no encontrada." });
    }

    const { cabecera, items } = data;
    const nombreCotizacion = cabecera.nombre_cotizacion || `Cotizacion_${id}`;

    const wb = await buildCotizacionWorkbookBase(cabecera, items);

    await sendWorkbookAsXlsx(res, wb, safeFilename(nombreCotizacion));
  } catch (e) {
    return next(e);
  }
};