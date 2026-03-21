// backend/src/exports/excel/controllers/cotizacionExcel.controller.js
/**
 * Este archivo se encarga de recibir la petición HTTP
 * para exportar una cotización a Excel.
 *
 * Aquí solo se controla el flujo general:
 * - validar el id
 * - buscar la información
 * - construir el workbook
 * - enviarlo como archivo descargable
 *
 * La idea es que el controller no se meta
 * ni con la base de datos ni con el diseño del Excel.
 */

const { sendWorkbookAsXlsx } = require("../utils/sendExcel");
const { safeFilename } = require("../utils/filename");
const { getCotizacionExportData } = require("../services/cotizacionExcel.service");
const { buildCotizacionWorkbookBase } = require("../builders/cotizacionExcel.builder");

/**
 * Esta función intenta convertir el valor recibido
 * en un id válido de cotización.
 *
 * Si el valor no sirve, devuelve null.
 */
function parseCotizacionId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Esta función atiende la petición de exportar
 * una cotización a Excel.
 *
 * Valida el id, pide los datos necesarios,
 * construye el archivo y lo envía al cliente.
 */
module.exports = async function cotizacionExcelController(req, res, next) {
  try {
    const idCotizacion = parseCotizacionId(req.params.id);

    if (!idCotizacion) {
      return res.status(400).json({
        ok: false,
        mensaje: "ID de cotización inválido.",
      });
    }

    const data = await getCotizacionExportData(idCotizacion);

    if (!data) {
      return res.status(404).json({
        ok: false,
        mensaje: "Cotización no encontrada.",
      });
    }

    const { cabecera, items } = data;
    const nombreCotizacion = cabecera.nombre_cotizacion || `Cotizacion_${idCotizacion}`;

    const workbook = await buildCotizacionWorkbookBase(cabecera, items);

    await sendWorkbookAsXlsx(res, workbook, safeFilename(nombreCotizacion));
  } catch (error) {
    return next(error);
  }
};