// backend/src/routes/etapa3/precios.js
const express = require("express");
const router = express.Router();
const db = require("../../db"); // mysql2/promise pool

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

function esAlojamientoPorNombreTipo(nombreTipo) {
  return String(nombreTipo || "").toLowerCase().includes("aloj");
}

// Devuelve array de 12 meses: [{mes:1, precio_usd:...}, ...]
function build12MesesMap(rows) {
  const map = new Map(rows.map((r) => [Number(r.mes), r.precio_usd]));
  const out = [];
  for (let m = 1; m <= 12; m++) {
    out.push({ mes: m, precio_usd: map.has(m) ? map.get(m) : null });
  }
  return out;
}

// Normaliza precio:
// - null/""/undefined -> null
// - número -> Number redondeado a 2 decimales
// - si NaN -> null
function normalizarPrecioUsd(v) {
  if (v === null || v === undefined) return null;
  const raw = String(v).trim();
  if (raw === "") return null;

  const n = Number(raw);
  if (!Number.isFinite(n)) return null;

  // No permitir negativos (backend hard stop)
  if (n < 0) return null;

  // Redondear a 2 decimales de forma segura
  return Math.round(n * 100) / 100;
}

/* =========================================================
   GET /api/servicios/:id/precios?anio=2025&tipo_habitacion=DBL
   Devuelve 12 meses de precio para ese servicio + año + tipo_habitacion
========================================================= */
router.get("/servicios/:id/precios", async (req, res) => {
  try {
    const id_servicio = toInt(req.params.id);
    if (!id_servicio) return res.status(400).json({ ok: false, mensaje: "id_servicio inválido" });

    const anio = toInt(req.query.anio, new Date().getFullYear());
    if (!anio) return res.status(400).json({ ok: false, mensaje: "anio inválido" });

    const tipo_habitacion = normalizarTipoHabitacion(req.query.tipo_habitacion);

    // Validación: NO alojamientos en esta API/pantalla
    const [[srv]] = await db.execute(
      `
      SELECT ts.nombre AS tipo
      FROM servicio s
      JOIN tiposervicio ts ON ts.id = s.id_tipo
      WHERE s.id = ?
      `,
      [id_servicio]
    );

    if (!srv) return res.status(404).json({ ok: false, mensaje: "Servicio no encontrado" });

    if (esAlojamientoPorNombreTipo(srv.tipo)) {
      return res.status(400).json({
        ok: false,
        mensaje:
          "Este servicio es ALOJAMIENTO. Sus precios se gestionan en la tabla/pantalla de alojamiento.",
      });
    }

    const [rows] = await db.execute(
      `
      SELECT mes, precio_usd
      FROM servicio_precio_mes
      WHERE id_servicio = ?
        AND anio = ?
        AND tipo_habitacion = ?
      ORDER BY mes ASC
      `,
      [id_servicio, anio, tipo_habitacion]
    );

    return res.json({
      ok: true,
      id_servicio,
      anio,
      tipo_habitacion,
      precios: build12MesesMap(rows),
    });
  } catch (e) {
    console.error("GET /servicios/:id/precios", e);
    return res
      .status(500)
      .json({ ok: false, mensaje: "Error obteniendo precios", error: e.message });
  }
});

/* =========================================================
   PUT /api/servicios/:id/precios?anio=2025&tipo_habitacion=DBL
   Body esperado:
   {
     "precios": [
       {"mes":1,"precio_usd":100},
       ...
       {"mes":12,"precio_usd":null}
     ]
   }
   - Si precio_usd es null/"" -> guarda NULL
   - Upsert por PK (id_servicio, anio, mes, tipo_habitacion)
========================================================= */
router.put("/servicios/:id/precios", async (req, res) => {
  let conn;
  try {
    const id_servicio = toInt(req.params.id);
    if (!id_servicio) return res.status(400).json({ ok: false, mensaje: "id_servicio inválido" });

    const anio = toInt(req.query.anio, new Date().getFullYear());
    if (!anio) return res.status(400).json({ ok: false, mensaje: "anio inválido" });

    const tipo_habitacion = normalizarTipoHabitacion(req.query.tipo_habitacion);

    const precios = Array.isArray(req.body?.precios) ? req.body.precios : null;
    if (!precios) {
      return res
        .status(400)
        .json({ ok: false, mensaje: "Body inválido: se requiere precios[] (12 meses)" });
    }

    // Validación: NO alojamientos en esta API/pantalla
    const [[srv]] = await db.execute(
      `
      SELECT ts.nombre AS tipo
      FROM servicio s
      JOIN tiposervicio ts ON ts.id = s.id_tipo
      WHERE s.id = ?
      `,
      [id_servicio]
    );

    if (!srv) return res.status(404).json({ ok: false, mensaje: "Servicio no encontrado" });

    if (esAlojamientoPorNombreTipo(srv.tipo)) {
      return res.status(400).json({
        ok: false,
        mensaje:
          "Este servicio es ALOJAMIENTO. Sus precios se gestionan en la tabla/pantalla de alojamiento.",
      });
    }

    // Normalizar meses y precios
    const norm = precios
      .map((p) => ({
        mes: toInt(p?.mes),
        precio_usd: normalizarPrecioUsd(p?.precio_usd),
      }))
      .filter((p) => p.mes && p.mes >= 1 && p.mes <= 12);

    // Si alguien intentó mandar negativos (quedaron null), puedes elegir:
    // - permitirlos como null (lo actual)
    // - o rechazar con 400 si detectas alguno
    // Aquí lo dejamos como "null" para no romper UX.

    conn = await db.getConnection();
    await conn.beginTransaction();

    const sql = `
      INSERT INTO servicio_precio_mes (id_servicio, anio, mes, tipo_habitacion, precio_usd)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        precio_usd = VALUES(precio_usd)
    `;

    for (const p of norm) {
      await conn.execute(sql, [id_servicio, anio, p.mes, tipo_habitacion, p.precio_usd]);
    }

    await conn.commit();

    return res.json({
      ok: true,
      mensaje: "Precios guardados",
      id_servicio,
      anio,
      tipo_habitacion,
      count: norm.length,
    });
  } catch (e) {
    try {
      if (conn) await conn.rollback();
    } catch {}
    console.error("PUT /servicios/:id/precios", e);
    return res
      .status(500)
      .json({ ok: false, mensaje: "Error guardando precios", error: e.message });
  } finally {
    try {
      if (conn) conn.release();
    } catch {}
  }
});

module.exports = router;