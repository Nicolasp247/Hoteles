// backend/src/routes/etapa3/alojamiento-precios.js
const express = require("express");
const router = express.Router();
const db = require("../../db");

function toInt(v, def = null) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}
function normTipoHab(v) {
  const t = String(v || "").trim().toUpperCase();
  return (t === "DBL" || t === "SGL" || t === "TPL") ? t : "DBL";
}
function build12(rows) {
  const map = new Map(rows.map(r => [Number(r.mes), r.precio_usd]));
  const out = [];
  for (let m=1;m<=12;m++) out.push({ mes: m, precio_usd: map.has(m) ? map.get(m) : null });
  return out;
}

router.get("/alojamiento/precios", async (req, res) => {
  try {
    const id_ciudad = toInt(req.query.id_ciudad);
    const anio = toInt(req.query.anio);
    const categoria = String(req.query.categoria || "").trim();
    const categoria_hab = String(req.query.categoria_hab || "").trim();
    const regimen = String(req.query.regimen || "").trim();
    const tipo_habitacion = normTipoHab(req.query.tipo_habitacion);

    if (!id_ciudad) return res.status(400).json({ ok:false, mensaje:"id_ciudad inválido" });
    if (!anio) return res.status(400).json({ ok:false, mensaje:"anio inválido" });
    if (!categoria) return res.status(400).json({ ok:false, mensaje:"categoria requerida" });
    if (!categoria_hab) return res.status(400).json({ ok:false, mensaje:"categoria_hab requerida" });
    if (!regimen) return res.status(400).json({ ok:false, mensaje:"regimen requerido" });

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
      id_ciudad, categoria, categoria_hab, regimen, anio, tipo_habitacion,
      precios: build12(rows)
    });
  } catch (e) {
    console.error("GET /alojamiento/precios", e);
    return res.status(500).json({ ok:false, mensaje:"Error obteniendo precios", error:e.message });
  }
});

router.put("/alojamiento/precios", async (req, res) => {
  let conn;
  try {
    const id_ciudad = toInt(req.query.id_ciudad);
    const anio = toInt(req.query.anio);
    const categoria = String(req.query.categoria || "").trim();
    const categoria_hab = String(req.query.categoria_hab || "").trim();
    const regimen = String(req.query.regimen || "").trim();
    const tipo_habitacion = normTipoHab(req.query.tipo_habitacion);

    if (!id_ciudad) return res.status(400).json({ ok:false, mensaje:"id_ciudad inválido" });
    if (!anio) return res.status(400).json({ ok:false, mensaje:"anio inválido" });
    if (!categoria) return res.status(400).json({ ok:false, mensaje:"categoria requerida" });
    if (!categoria_hab) return res.status(400).json({ ok:false, mensaje:"categoria_hab requerida" });
    if (!regimen) return res.status(400).json({ ok:false, mensaje:"regimen requerido" });

    const precios = Array.isArray(req.body?.precios) ? req.body.precios : null;
    if (!precios) return res.status(400).json({ ok:false, mensaje:"Body inválido: precios[] requerido" });

    const norm = precios
      .map(p => ({
        mes: toInt(p?.mes),
        precio_usd:
          (p?.precio_usd === null || p?.precio_usd === "" || p?.precio_usd === undefined)
            ? null
            : (Number.isFinite(Number(p.precio_usd)) ? Number(p.precio_usd) : null)
      }))
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
      await conn.execute(sql, [
        id_ciudad, categoria, categoria_hab, regimen, anio, p.mes, tipo_habitacion, p.precio_usd
      ]);
    }

    await conn.commit();
    return res.json({ ok:true, mensaje:"Precios guardados", count:norm.length });

  } catch (e) {
    try { if (conn) await conn.rollback(); } catch {}
    console.error("PUT /alojamiento/precios", e);
    return res.status(500).json({ ok:false, mensaje:"Error guardando precios", error:e.message });
  } finally {
    try { if (conn) conn.release(); } catch {}
  }
});

module.exports = router;
