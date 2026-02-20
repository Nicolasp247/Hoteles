// backend/src/routes/etapa3/hotel_precios.js
const express = require("express");
const router = express.Router();
const db = require("../../db"); // ✅ correcto: backend/src/db

function toInt(v) {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : null;
}

function toMes(v) {
  const n = toInt(v);
  return n != null && n >= 1 && n <= 12 ? n : null;
}

router.get("/hoteles/precios", async (req, res) => {
  try {
    const hotel_id = toInt(req.query.hotel_id);
    const anio = toInt(req.query.anio);
    const categoria_hotel = String(req.query.categoria_hotel || "").trim();
    const categoria_hab = String(req.query.categoria_hab || "").trim();
    const regimen = String(req.query.regimen || "").trim();
    const tipo_habitacion = String(req.query.tipo_habitacion || "DBL").trim().toUpperCase();

    if (!hotel_id) return res.status(400).json({ ok: false, mensaje: "hotel_id requerido" });
    if (!anio) return res.status(400).json({ ok: false, mensaje: "anio requerido" });
    if (!categoria_hotel) return res.status(400).json({ ok: false, mensaje: "categoria_hotel requerido" });
    if (!categoria_hab) return res.status(400).json({ ok: false, mensaje: "categoria_hab requerido" });
    if (!regimen) return res.status(400).json({ ok: false, mensaje: "regimen requerido" });

    const [rows] = await db.execute(
      `
      SELECT mes, precio_usd
      FROM hotel_precio_mes
      WHERE hotel_id = ?
        AND categoria_hotel = ?
        AND categoria_hab = ?
        AND regimen = ?
        AND anio = ?
        AND tipo_habitacion = ?
      ORDER BY mes ASC
      `,
      [hotel_id, categoria_hotel, categoria_hab, regimen, anio, tipo_habitacion]
    );

    res.json({ ok: true, precios: rows });
  } catch (e) {
    console.error("GET /hoteles/precios", e);
    res.status(500).json({ ok: false, mensaje: "Error cargando precios", error: e.message });
  }
});

router.put("/hoteles/precios", async (req, res, next) => {
  let conn;
  try {
    const hotel_id = toInt(req.query.hotel_id);
    const anio = toInt(req.query.anio);
    const categoria_hotel = String(req.query.categoria_hotel || "").trim();
    const categoria_hab = String(req.query.categoria_hab || "").trim();
    const regimen = String(req.query.regimen || "").trim();
    const tipo_habitacion = String(req.query.tipo_habitacion || "DBL").trim().toUpperCase();

    if (!hotel_id) return res.status(400).json({ ok: false, mensaje: "hotel_id requerido" });
    if (!anio) return res.status(400).json({ ok: false, mensaje: "anio requerido" });
    if (!categoria_hotel) return res.status(400).json({ ok: false, mensaje: "categoria_hotel requerido" });
    if (!categoria_hab) return res.status(400).json({ ok: false, mensaje: "categoria_hab requerido" });
    if (!regimen) return res.status(400).json({ ok: false, mensaje: "regimen requerido" });

    const precios = Array.isArray(req.body?.precios) ? req.body.precios : [];
    if (precios.length === 0) return res.status(400).json({ ok: false, mensaje: "precios[] requerido" });

    const sql = `
      INSERT INTO hotel_precio_mes
        (hotel_id, categoria_hotel, categoria_hab, regimen, anio, mes, tipo_habitacion, precio_usd)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        precio_usd = VALUES(precio_usd)
    `;

    conn = await db.getConnection();
    await conn.beginTransaction();

    for (const p of precios) {
      const mes = toMes(p.mes);
      const precio = (p.precio_usd === null || p.precio_usd === "" || p.precio_usd === undefined)
        ? null
        : Number(p.precio_usd);

      if (!mes) continue;

      const precioFinal = (precio == null || Number.isNaN(precio) || precio < 0) ? null : precio;

      await conn.execute(sql, [
        hotel_id, categoria_hotel, categoria_hab, regimen, anio, mes, tipo_habitacion, precioFinal
      ]);
    }

    await conn.commit();
    return res.json({ ok: true, mensaje: "Guardado" });
  } catch (e) {
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    return next(e);
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
