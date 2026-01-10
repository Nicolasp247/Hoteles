// backend/src/routes/etapa3/servicios_sin_precios.js
const express = require("express");
const router = express.Router();
const pool = require("../../db"); // usa el mismo pool mysql2/promise

function intOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
function clampYear(y, def) {
  if (!y) return def;
  if (y < 2000) return 2000;
  if (y > 2100) return 2100;
  return y;
}

// GET /api/servicios/sin-precio?anio=2025
router.get("/servicios/sin-precio", async (req, res) => {
  try {
    const anio = clampYear(intOrNull(req.query.anio), 2025);
    const totalMesesEsperados = 12;

    const [rows] = await pool.execute(
      `
      SELECT
        s.id AS id_servicio,
        s.nombre_wtravel,
        s.descripcion,
        s.tiempo_servicio,
        s.privado,
        s.link_reserva,

        ts.nombre AS tipo_servicio,
        c.nombre  AS ciudad,

        COUNT(spm.precio_usd) AS meses_con_precio

      FROM servicio s
      JOIN tiposervicio ts ON ts.id = s.id_tipo
      JOIN ciudad c ON c.id = s.id_ciudad

      LEFT JOIN servicio_precio_mes spm
        ON spm.id_servicio = s.id
       AND spm.anio = ?
       AND spm.mes BETWEEN 1 AND 12
       AND spm.tipo_habitacion = 'DBL'

      WHERE LOWER(ts.nombre) NOT LIKE '%aloj%'
        AND LOWER(ts.nombre) NOT LIKE '%vuelo%'
        AND LOWER(ts.nombre) NOT LIKE '%tren%'

      GROUP BY
        s.id, s.nombre_wtravel, s.descripcion, s.tiempo_servicio, s.privado, s.link_reserva,
        ts.nombre, c.nombre

      HAVING COUNT(spm.precio_usd) < ?
      ORDER BY c.nombre ASC, ts.nombre ASC, s.nombre_wtravel ASC
      `,
      [anio, totalMesesEsperados]
    );

    return res.json({
      ok: true,
      anio,
      total_meses_esperados: totalMesesEsperados,
      servicios: rows,
    });
  } catch (error) {
    console.error("GET /servicios/sin-precio", error);
    return res.status(500).json({
      ok: false,
      mensaje: "Error interno listando servicios sin precio",
      error: error.message,
    });
  }
});

module.exports = router;