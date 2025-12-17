const express = require("express");
const router = express.Router();
const db = require("../../db");

function toInt(v, def = null) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

function normalizarTipoHabitacion(v) {
  const t = String(v || "").trim().toUpperCase();
  if (!t) return "DBL";
  if (t === "DBL" || t === "SGL" || t === "TPL") return t;
  return "DBL";
}

function build12MesesMap(rows) {
  const map = new Map(rows.map(r => [Number(r.mes), r.precio_usd]));
  const out = [];
  for (let m = 1; m <= 12; m++) out.push({ mes: m, precio_usd: map.has(m) ? map.get(m) : null });
  return out;
}

function normStr(v) {
  const s = String(v || "").trim();
  return s ? s : null;
}

/**
 * GET /api/alojamiento/precios?id_ciudad=1&categoria=H4_ECONOMICO&categoria_hab=ESTANDAR&regimen=ALOJAMIENTO_DESAYUNO&anio=2025&tipo_habitacion=DBL
 */
router.get("/alojamiento/precios", async (req, res) => {
  try {
    const id_ciudad = toInt(req.query.id_ciudad);
    const anio = toInt(req.query.anio, new Date().getFullYear());
    const tipo_habitacion = normalizarTipoHabitacion(req.query.tipo_habitacion);

    const categoria = normStr(req.query.categoria);
    const categoria_hab = normStr(req.query.categoria_hab) || "ESTANDAR";
    const regimen = normStr(req.query.regimen);

    if (!id_ciudad) return res.status(400).json({ ok: false, mensaje: "id_ciudad inválido" });
    if (!anio) return res.status(400).json({ ok: false, mensaje: "anio inválido" });
    if (!categoria) return res.status(400).json({ ok: false, mensaje: "categoria requerida" });
    if (!regimen) return res.status(400).json({ ok: false, mensaje: "regimen requerido" });

    const [rows] = await db.execute(
      `
      SELECT mes, precio_usd
      FROM alojamiento_precio_mes
      WHERE id_ciudad = ?
        AND categoria = ?
        AND categoria_hab = ?
        AND regimen = ?
        AND anio = ?
        AND tipo_habitacion = ?
      ORDER BY mes ASC
      `,
      [id_ciudad, categoria, categoria_hab, regimen, anio, tipo_habitacion]
    );

    return res.json({
      ok: true,
      id_ciudad,
      categoria,
      categoria_hab,
      regimen,
      anio,
      tipo_habitacion,
      precios: build12MesesMap(rows),
    });
  } catch (e) {
    console.error("GET /alojamiento/precios", e);
    return res.status(500).json({ ok: false, mensaje: "Error obteniendo precios alojamiento", error: e.message });
  }
});

/**
 * PUT /api/alojamiento/precios?... (mismos query params)
 * Body: { precios: [{mes:1, precio_usd:100}, ...] }
 */
router.put("/alojamiento/precios", async (req, res) => {
  let conn;
  try {
    const id_ciudad = toInt(req.query.id_ciudad);
    const anio = toInt(req.query.anio, new Date().getFullYear());
    const tipo_habitacion = normalizarTipoHabitacion(req.query.tipo_habitacion);

    const categoria = normStr(req.query.categoria);
    const categoria_hab = normStr(req.query.categoria_hab) || "ESTANDAR";
    const regimen = normStr(req.query.regimen);

    if (!id_ciudad) return res.status(400).json({ ok: false, mensaje: "id_ciudad inválido" });
    if (!anio) return res.status(400).json({ ok: false, mensaje: "anio inválido" });
    if (!categoria) return res.status(400).json({ ok: false, mensaje: "categoria requerida" });
    if (!regimen) return res.status(400).json({ ok: false, mensaje: "regimen requerido" });

    const precios = Array.isArray(req.body?.precios) ? req.body.precios : null;
    if (!precios) return res.status(400).json({ ok: false, mensaje: "Body inválido: precios[] requerido" });

    const norm = precios
      .map(p => {
        const mes = toInt(p?.mes);
        let precio = (p?.precio_usd === null || p?.precio_usd === "" || p?.precio_usd === undefined)
          ? null
          : (Number.isFinite(Number(p.precio_usd)) ? Number(p.precio_usd) : null);

        // Validación: no negativos
        if (precio != null) {
          if (precio < 0) precio = null;
          // Redondeo 2 decimales
          precio = Math.round(precio * 100) / 100;
        }

        return { mes, precio_usd: precio };
      })
      .filter(p => p.mes && p.mes >= 1 && p.mes <= 12);

    conn = await db.getConnection();
    await conn.beginTransaction();

    const sql = `
      INSERT INTO alojamiento_precio_mes
        (id_ciudad, categoria, categoria_hab, regimen, anio, mes, tipo_habitacion, precio_usd)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        precio_usd = VALUES(precio_usd)
    `;

    for (const p of norm) {
      await conn.execute(sql, [id_ciudad, categoria, categoria_hab, regimen, anio, p.mes, tipo_habitacion, p.precio_usd]);
    }

    await conn.commit();

    return res.json({
      ok: true,
      mensaje: "Precios de alojamiento guardados",
      id_ciudad,
      categoria,
      categoria_hab,
      regimen,
      anio,
      tipo_habitacion,
      count: norm.length
    });
  } catch (e) {
    try { if (conn) await conn.rollback(); } catch {}
    console.error("PUT /alojamiento/precios", e);
    return res.status(500).json({ ok: false, mensaje: "Error guardando precios alojamiento", error: e.message });
  } finally {
    try { if (conn) conn.release(); } catch {}
  }
});

module.exports = router;
