// backend/src/exports/excel/controllers/cotizacionExcel.controller.js
const pool = require("../../../db");
const { sendWorkbookAsXlsx } = require("../utils/sendExcel");
const { safeFilename } = require("../utils/filename");
const { buildCotizacionWorkbookBase } = require("../builders/cotizacionExcel.builder");

module.exports = async function cotizacionExcelController(req, res, next) {
  let conn;
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, mensaje: "ID de cotización inválido." });
    }

    conn = await pool.getConnection();

    // destino = continente.id  -> necesitamos continente.nombre
    const [rows] = await conn.execute(
      `
      SELECT 
        ctz.id_cotizacion,
        ctz.nombre_cotizacion,
        ctz.agente,
        ctz.nombre_pasajero,
        ctz.total_pasajeros,
        ctz.ninos_3_11,
        ctz.adultos_19_64,
        ctz.jovenes_12_18,
        ctz.infantes_0_2,
        ctz.adultos_65,
        ctz.destino,
        cont.nombre AS destino_nombre,
        ctz.fecha_viaje
      FROM cotizacion ctz
      LEFT JOIN continente cont ON cont.id = ctz.destino
      WHERE ctz.id_cotizacion = ?
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ ok: false, mensaje: "Cotización no encontrada." });
    }

    const cotizacion = rows[0];
    const nombreCotizacion = cotizacion.nombre_cotizacion || `Cotizacion_${id}`;

    // Construye Excel (ya con destino_nombre)
    const wb = await buildCotizacionWorkbookBase(cotizacion);

    // ❌ Importante: NO vuelvas a escribir A2/B2 aquí
    await sendWorkbookAsXlsx(res, wb, safeFilename(nombreCotizacion));
  } catch (e) {
    return next(e);
  } finally {
    try { if (conn) conn.release(); } catch {}
  }
};