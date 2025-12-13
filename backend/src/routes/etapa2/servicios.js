// backend/src/routes/etapa2/servicios.js
const express = require("express");
const router = express.Router();
const pool = require("../../db"); // mysql2/promise pool

// Helper: normaliza "HH:MM" -> "HH:MM:00"
function toTime(s) {
  if (!s) return null;
  const str = String(s).trim();
  if (/^\d{2}:\d{2}$/.test(str)) return `${str}:00`;
  return str;
}

/* =========================================================
   GET /api/proveedores
   (para llenar el select del mini-form)
========================================================= */
router.get("/proveedores", async (_req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT id, nombre, iniciales
      FROM proveedor
      ORDER BY nombre ASC
    `);
    res.json({ ok: true, proveedores: rows });
  } catch (e) {
    console.error("GET /proveedores", e);
    res.status(500).json({ ok: false, mensaje: "Error listando proveedores", error: e.message });
  }
});

/* =========================================================
   POST /api/servicios
   Crear servicio + subtabla (alojamiento / boleto / vuelo / tren)
========================================================= */
router.post("/servicios", async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const {
      id_tipo,
      id_proveedor,
      id_ciudad,
      nombre_wtravel,
      tiempo_servicio,
      privado,
      descripcion,
      link_reserva,

      // sub-objetos opcionales
      alojamiento,
      boleto_entrada,
      vuelo,
      tren
    } = req.body || {};

    if (!id_tipo || !id_proveedor || !id_ciudad || !nombre_wtravel) {
      return res.status(400).json({
        ok: false,
        mensaje: "Faltan campos obligatorios: id_tipo, id_proveedor, id_ciudad, nombre_wtravel."
      });
    }

    await conn.beginTransaction();

    // 1) Insert servicio
    const [ins] = await conn.execute(
      `
      INSERT INTO servicio (
        id_tipo, id_proveedor, id_ciudad,
        nombre_wtravel, tiempo_servicio,
        privado, descripcion, link_reserva
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        Number(id_tipo),
        Number(id_proveedor),
        Number(id_ciudad),
        String(nombre_wtravel).trim(),
        tiempo_servicio ? String(tiempo_servicio).trim() : null,
        privado ? 1 : 0,
        descripcion ? String(descripcion).trim() : null,
        link_reserva ? String(link_reserva).trim() : null
      ]
    );

    const id_servicio = ins.insertId;

    // 2) Subtablas (1:1)
    if (alojamiento) {
      await conn.execute(
        `
        INSERT INTO alojamiento (
          id_servicio, noches, habitaciones, regimen,
          categoria_hotel, categoria_hab, proveedor_hotel
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          id_servicio,
          alojamiento.noches ?? 1,
          alojamiento.habitaciones ?? 1,
          alojamiento.regimen ?? null,
          alojamiento.categoria_hotel ?? null,
          alojamiento.categoria_hab ?? null,
          alojamiento.proveedor_hotel ?? null
        ]
      );
    }

    if (boleto_entrada) {
      await conn.execute(
        `
        INSERT INTO boleto_entrada (
          id_servicio, nombre_lugar, tipo_entrada,
          audioguia, idioma
        ) VALUES (?, ?, ?, ?, ?)
        `,
        [
          id_servicio,
          boleto_entrada.nombre_lugar || null,
          boleto_entrada.tipo_entrada || null,
          boleto_entrada.audioguia ? 1 : 0,
          boleto_entrada.idioma || null
        ]
      );
    }

    if (vuelo) {
      await conn.execute(
        `
        INSERT INTO vuelo (
          id_servicio, origen, destino, escalas, clase, equipaje
        ) VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          id_servicio,
          vuelo.origen || "",
          vuelo.destino || "",
          vuelo.escalas ?? 0,
          vuelo.clase || null,
          vuelo.equipaje || null
        ]
      );
    }

    if (tren) {
      await conn.execute(
        `
        INSERT INTO tren (
          id_servicio, origen, destino, escalas, clase, equipaje, sillas_reservadas
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          id_servicio,
          tren.origen || "",
          tren.destino || "",
          tren.escalas ?? 0,
          tren.clase || null,
          tren.equipaje || null,
          tren.sillas_reservadas ? 1 : 0
        ]
      );
    }

    await conn.commit();

    return res.status(201).json({
      ok: true,
      id_servicio,
      mensaje: "Servicio creado"
    });

  } catch (e) {
    try { if (conn) await conn.rollback(); } catch {}
    console.error("POST /servicios", e);
    return res.status(500).json({
      ok: false,
      mensaje: "Error creando servicio",
      error: e.message
    });
  } finally {
    try { if (conn) conn.release(); } catch {}
  }
});

/* =========================================================
   POST /api/servicios/:id/horas
   Agregar horas (bulk)
========================================================= */
router.post("/servicios/:id/horas", async (req, res) => {
  try {
    const id_servicio = Number(req.params.id);
    const horas = Array.isArray(req.body.horas) ? req.body.horas : [];

    if (!id_servicio || horas.length === 0) {
      return res.status(400).json({ ok: false, mensaje: "id_servicio y horas[] requeridos" });
    }

    let errorCount = 0;
    for (const h of horas) {
      try {
        const hora = toTime(h);
        if (!hora) { errorCount++; continue; }
        await pool.execute(
          "INSERT INTO serviciohora (id_servicio, hora) VALUES (?, ?)",
          [id_servicio, hora]
        );
      } catch {
        errorCount++;
      }
    }

    if (errorCount > 0) {
      return res.status(207).json({
        ok: true,
        partial: true,
        errorCount,
        mensaje: "Algunas horas no se insertaron (¿duplicadas o inválidas?)"
      });
    }

    res.json({ ok: true, mensaje: "Horas insertadas" });
  } catch (e) {
    console.error("POST /servicios/:id/horas", e);
    res.status(500).json({ ok: false, mensaje: "Error insertando horas", error: e.message });
  }
});

/* =========================================================
   GET /api/servicios
   Listado para el selector (front de etapa 3 espera un ARRAY)
========================================================= */
router.get("/servicios", async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      `
      SELECT
        s.id,
        s.id_tipo,
        s.id_ciudad,
        s.nombre_wtravel,
        s.tiempo_servicio,
        s.privado,
        s.descripcion,
        s.link_reserva,
        ts.nombre AS tipo,
        p.nombre  AS proveedor,
        c.nombre  AS ciudad,
        pa.id     AS id_pais,
        ct.id     AS id_continente
      FROM servicio s
      JOIN tiposervicio ts ON s.id_tipo = ts.id
      JOIN proveedor   p  ON s.id_proveedor = p.id
      JOIN ciudad      c  ON s.id_ciudad = c.id
      JOIN pais        pa ON c.id_pais = pa.id
      JOIN continente  ct ON pa.id_continente = ct.id
      ORDER BY s.nombre_wtravel
      `
    );

    // IMPORTANTE: tu front de cotizacion-editar.js espera un ARRAY directo
    res.json(rows);
  } catch (e) {
    console.error("GET /servicios", e);
    res.status(500).json({ ok: false, mensaje: "Error listando servicios", error: e.message });
  }
});

/* =========================================================
   GET /api/servicios/:id
   Detalle (base + alojamiento + horas + vuelo + tren + boleto + traslado/tour si existen)
========================================================= */
router.get("/servicios/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, mensaje: "id inválido" });

    const [rows] = await pool.execute(
      `
      SELECT s.id, s.id_tipo, s.id_proveedor, s.id_ciudad,
             s.nombre_wtravel, s.tiempo_servicio, s.privado, s.descripcion, s.link_reserva,
             ts.nombre AS tipo,
             p.nombre  AS proveedor,
             c.nombre  AS ciudad
      FROM servicio s
      JOIN tiposervicio ts ON ts.id = s.id_tipo
      JOIN proveedor   p  ON p.id  = s.id_proveedor
      JOIN ciudad      c  ON c.id  = s.id_ciudad
      WHERE s.id = ?
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: "Servicio no encontrado" });
    }

    const base = rows[0];

    // Alojamiento
    const [alojaRows] = await pool.execute(
      `
      SELECT noches, habitaciones, regimen, categoria_hotel, categoria_hab, proveedor_hotel
      FROM alojamiento
      WHERE id_servicio = ?
      `,
      [id]
    );
    const alojamiento = alojaRows[0] || null;

    // Horas
    const [hrsRows] = await pool.execute(
      `
      SELECT DATE_FORMAT(hora,'%H:%i') AS hora
      FROM serviciohora
      WHERE id_servicio = ?
      ORDER BY hora
      `,
      [id]
    );
    const horas = hrsRows.map(x => x.hora);

    // Boleto entrada
    const [beRows] = await pool.execute(
      `
      SELECT nombre_lugar, tipo_entrada, audioguia, idioma
      FROM boleto_entrada
      WHERE id_servicio = ?
      `,
      [id]
    );
    const boleto_entrada = beRows[0] || null;

    // Vuelo
    const [vueloRows] = await pool.execute(
      `
      SELECT origen, destino, escalas, clase, equipaje
      FROM vuelo
      WHERE id_servicio = ?
      `,
      [id]
    );
    const vuelo = vueloRows[0] || null;

    // Tren
    const [trenRows] = await pool.execute(
      `
      SELECT origen, destino, escalas, clase, equipaje, sillas_reservadas
      FROM tren
      WHERE id_servicio = ?
      `,
      [id]
    );
    const tren = trenRows[0] || null;

    // Si existen en tu BD (si no existen, puedes borrar estos 2 bloques)
    const [trasRows] = await pool.execute(
      `SELECT * FROM traslado WHERE id_servicio = ?`,
      [id]
    ).catch(() => [ [] ]);
    const traslado = trasRows[0] || null;

    const [tourRows] = await pool.execute(
      `SELECT * FROM tour WHERE id_servicio = ?`,
      [id]
    ).catch(() => [ [] ]);
    const tour = tourRows[0] || null;

    res.json({
      ok: true,
      servicio: {
        id: base.id,
        id_tipo: base.id_tipo,
        id_proveedor: base.id_proveedor,
        id_ciudad: base.id_ciudad,
        nombre_wtravel: base.nombre_wtravel,
        tiempo_servicio: base.tiempo_servicio,
        privado: !!base.privado,
        descripcion: base.descripcion,
        link_reserva: base.link_reserva || null,
        tipo: base.tipo,
        proveedor: base.proveedor,
        ciudad: base.ciudad,

        alojamiento,
        horas,
        boleto_entrada,
        vuelo,
        tren,
        traslado,
        tour
      }
    });

  } catch (e) {
    console.error("GET /servicios/:id", e);
    res.status(500).json({ ok: false, mensaje: "Error obteniendo servicio", error: e.message });
  }
});

/* =========================================================
   PUT /api/servicio/:id
   Actualizar servicio (mantengo tu ruta "singular" por compatibilidad)
========================================================= */
router.put("/servicio/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      id_tipo, id_proveedor, id_ciudad,
      nombre_wtravel, tiempo_servicio,
      privado, descripcion, link_reserva
    } = req.body || {};

    if (!id || !id_tipo || !id_proveedor || !id_ciudad || !nombre_wtravel) {
      return res.status(400).json({ ok: false, mensaje: "faltan campos obligatorios" });
    }

    const priv = privado ? 1 : 0;

    const [r] = await pool.execute(
      `
      UPDATE servicio
      SET id_tipo=?, id_proveedor=?, id_ciudad=?,
          nombre_wtravel=?, tiempo_servicio=?, privado=?,
          descripcion=?, link_reserva=?
      WHERE id=?
      `,
      [
        id_tipo,
        id_proveedor,
        id_ciudad,
        String(nombre_wtravel).trim(),
        tiempo_servicio ? String(tiempo_servicio).trim() : null,
        priv,
        descripcion ? String(descripcion).trim() : null,
        link_reserva ? String(link_reserva).trim() : null,
        id
      ]
    );

    if (!r.affectedRows) return res.status(404).json({ ok: false, mensaje: "Servicio no encontrado" });

    res.json({ ok: true, mensaje: "Servicio actualizado" });
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") return res.status(400).json({ ok: false, mensaje: "nombre_wtravel duplicado" });
    console.error("PUT /servicio/:id", e);
    res.status(500).json({ ok: false, mensaje: "Error actualizando servicio", error: e.message });
  }
});

/* =========================================================
   PUT /api/servicios/:id/horas
   Reemplazar horas (borra y re-inserta)
========================================================= */
router.put("/servicios/:id/horas", async (req, res) => {
  let conn;
  try {
    const id_servicio = Number(req.params.id);
    const horas = Array.isArray(req.body.horas) ? req.body.horas : [];
    if (!id_servicio) return res.status(400).json({ ok: false, mensaje: "id_servicio inválido" });

    conn = await pool.getConnection();
    await conn.beginTransaction();

    await conn.execute("DELETE FROM serviciohora WHERE id_servicio=?", [id_servicio]);
    for (const h of horas) {
      await conn.execute(
        "INSERT INTO serviciohora (id_servicio, hora) VALUES (?, ?)",
        [id_servicio, toTime(h)]
      );
    }

    await conn.commit();
    res.json({ ok: true, mensaje: "Horas actualizadas", count: horas.length });
  } catch (e) {
    try { if (conn) await conn.rollback(); } catch {}
    console.error("PUT /servicios/:id/horas", e);
    res.status(500).json({ ok: false, mensaje: "Error actualizando horas", error: e.message });
  } finally {
    try { if (conn) conn.release(); } catch {}
  }
});

/* =========================================================
   DELETE /api/servicio/:id
========================================================= */
router.delete("/servicio/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, mensaje: "id inválido" });

    const [r] = await pool.execute("DELETE FROM servicio WHERE id=?", [id]);
    if (!r.affectedRows) return res.status(404).json({ ok: false, mensaje: "Servicio no encontrado" });

    res.json({ ok: true, mensaje: "Servicio eliminado" });
  } catch (e) {
    console.error("DELETE /servicio/:id", e);
    res.status(500).json({ ok: false, mensaje: "Error eliminando servicio", error: e.message });
  }
});

/* =========================================================
   DELETE /api/servicios/:id/horas/:hora
========================================================= */
router.delete("/servicios/:id/horas/:hora", async (req, res) => {
  try {
    const id_servicio = Number(req.params.id);
    const hora = toTime(req.params.hora);

    const [r] = await pool.execute(
      "DELETE FROM serviciohora WHERE id_servicio=? AND hora=?",
      [id_servicio, hora]
    );

    if (!r.affectedRows) return res.status(404).json({ ok: false, mensaje: "No existía esa hora" });
    res.json({ ok: true, mensaje: "Hora eliminada" });
  } catch (e) {
    console.error("DELETE /servicios/:id/horas/:hora", e);
    res.status(500).json({ ok: false, mensaje: "Error eliminando hora", error: e.message });
  }
});

module.exports = router;