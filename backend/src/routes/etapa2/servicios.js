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

// Guarda un valor en el catálogo si no existe (auto-aprendizaje)
async function upsertCatalogo(conn, grupo, valor) {
  const v = String(valor || "").trim();
  if (!v) return;
  await conn.execute(
    `INSERT IGNORE INTO catalogo_opcion (grupo, valor) VALUES (?, ?)`,
    [grupo, v]
  );
}

// ===== Helpers para inserts dinámicos (sin adivinar columnas) =====
async function getTableColumns(conn, tableName) {
  const [rows] = await conn.execute(
    `
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
    `,
    [tableName]
  );
  return rows.map(r => r.COLUMN_NAME);
}

async function insertDynamicOneToOne(conn, tableName, id_servicio, obj) {
  // Inserta en tableName con id_servicio + SOLO columnas existentes
  if (!obj || typeof obj !== "object") return false;

  const cols = await getTableColumns(conn, tableName);
  if (!cols.includes("id_servicio")) {
    // Si la tabla no tiene id_servicio, no hacemos nada (evita errores)
    return false;
  }

  const payload = { ...obj, id_servicio };

  // Filtrar claves que sí existen como columnas
  const keys = Object.keys(payload).filter(k => cols.includes(k));
  if (keys.length === 0) return false;

  const placeholders = keys.map(() => "?").join(", ");
  const sql = `INSERT INTO ${tableName} (${keys.join(", ")}) VALUES (${placeholders})`;
  const values = keys.map(k => payload[k]);

  await conn.execute(sql, values);
  return true;
}

/* =========================================================
   GET /api/proveedores
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
   Crear servicio + subtabla (alojamiento / boleto / vuelo / tren / traslado / tour)
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
      tren,
      traslado,
      tour
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

    // ===== ALOJAMIENTO (Camino 2: enum + *_otro + auto-alimentación) =====
    if (alojamiento) {
      const regimen = alojamiento.regimen ?? null;
      const regimen_otro = String(alojamiento.regimen_otro || "").trim() || null;

      const categoria_hotel = alojamiento.categoria_hotel ?? null;
      const categoria_hotel_otro = String(alojamiento.categoria_hotel_otro || "").trim() || null;

      const categoria_hab = alojamiento.categoria_hab ?? null;
      const categoria_hab_otro = String(alojamiento.categoria_hab_otro || "").trim() || null;

      await conn.execute(
        `
        INSERT INTO alojamiento (
          id_servicio,
          noches,
          habitaciones,
          regimen,
          regimen_otro,
          categoria_hotel,
          categoria_hotel_otro,
          categoria_hab,
          categoria_hab_otro,
          proveedor_hotel
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          id_servicio,
          alojamiento.noches ?? 1,
          alojamiento.habitaciones ?? 1,
          regimen,
          (regimen === "OTRO") ? regimen_otro : null,
          categoria_hotel,
          (categoria_hotel === "OTRO") ? categoria_hotel_otro : null,
          categoria_hab,
          (categoria_hab === "OTRO") ? categoria_hab_otro : null,
          alojamiento.proveedor_hotel ?? null
        ]
      );

      // Auto-alimentar catálogos
      if (regimen === "OTRO" && regimen_otro) {
        await upsertCatalogo(conn, "aloj_regimen_otro", regimen_otro);
      }
      if (categoria_hotel === "OTRO" && categoria_hotel_otro) {
        await upsertCatalogo(conn, "aloj_categoria_hotel_otro", categoria_hotel_otro);
      }
      if (categoria_hab === "OTRO" && categoria_hab_otro) {
        await upsertCatalogo(conn, "aloj_categoria_hab_otro", categoria_hab_otro);
      }
    }

    // ===== BOLETO (tipo_entrada + tipo_entrada_otro + auto-alimentación) =====
    if (boleto_entrada) {
      const tipo_entrada = String(boleto_entrada.tipo_entrada || "").trim() || null;
      const tipo_entrada_otro = String(boleto_entrada.tipo_entrada_otro || "").trim() || null;

      await conn.execute(
        `
        INSERT INTO boleto_entrada (
          id_servicio,
          boleto_entrada,
          tipo_entrada,
          tipo_entrada_otro,
          audioguia,
          idioma
        ) VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          id_servicio,
          boleto_entrada.boleto_entrada || null,
          tipo_entrada,
          (tipo_entrada === "OTRA") ? tipo_entrada_otro : null,
          boleto_entrada.audioguia ? 1 : 0,
          boleto_entrada.idioma || null
        ]
      );

      if (tipo_entrada === "OTRA" && tipo_entrada_otro) {
        await upsertCatalogo(conn, "boleto_tipo_entrada_otro", tipo_entrada_otro);
      }
    }

    // ===== VUELO (inserta solo si columnas existen) =====
    if (vuelo) {
      // vuelo suele existir completo, pero lo hacemos robusto igual
      await insertDynamicOneToOne(conn, "vuelo", id_servicio, {
        origen: vuelo.origen || "",
        destino: vuelo.destino || "",
        escalas: vuelo.escalas ?? 0,
        clase: vuelo.clase || null,
        equipaje: vuelo.equipaje || null
      });
    }

    // ===== TREN (tu BD puede NO tener equipaje) =====
    if (tren) {
      const trenObj = {
        origen: tren.origen || "",
        destino: tren.destino || "",
        escalas: tren.escalas ?? 0,
        clase: tren.clase || null,
        // equipaje solo si existe en tabla (insertDynamic lo ignora si no está)
        equipaje: tren.equipaje || null,
        sillas_reservadas: tren.sillas_reservadas ? 1 : 0
      };
      await insertDynamicOneToOne(conn, "tren", id_servicio, trenObj);
    }

    // ===== TRASLADO (mini-form) =====
    if (traslado) {
      // Insert dinámico según columnas reales
      await insertDynamicOneToOne(conn, "traslado", id_servicio, traslado);

      // Auto-alimentación de catálogos para OTRO
      if (traslado.tipo_traslado === "OTRO" && traslado.tipo_traslado_otro) {
        await upsertCatalogo(conn, "traslado_tipo_otro", traslado.tipo_traslado_otro);
      }
      if (traslado.vehiculo === "OTRO" && traslado.vehiculo_otro) {
        await upsertCatalogo(conn, "traslado_vehiculo_otro", traslado.vehiculo_otro);
      }
    }

    // ===== TOUR (Excursión / Visita / Tour) =====
    if (tour) {
      // 1) Normalizar nombres (front → BD)
      // La tabla exige "idioma"
      if (!tour.idioma && tour.idioma_guia) {
        tour.idioma = tour.idioma_guia;
      }

      if (!tour.idioma_otro && tour.idioma_guia_otro) {
        tour.idioma_otro = tour.idioma_guia_otro;
      }

      // 2) Validación fuerte (idioma es obligatorio en BD)
      const idioma = String(tour.idioma || "").trim();
      if (!idioma) {
        return res.status(400).json({
          ok: false,
          mensaje: "Falta el idioma del guía (campo obligatorio para Excursión / Visita)."
        });
      }

      // 3) Insert dinámico (solo columnas reales)
      await insertDynamicOneToOne(conn, "tour", id_servicio, {
        lugar: tour.lugar || null,
        punto_encuentro: tour.punto_encuentro || null,
        duracion: tour.duracion || null,
        idioma: idioma,
        idioma_otro: (idioma === "OTRO") ? tour.idioma_otro : null,
        incluye: tour.incluye || null,
        observaciones: tour.observaciones || null
      });

      // 4) Auto-alimentar catálogo si es OTRO
      if ((idioma === "OTRO") && tour.idioma_otro) {
        await upsertCatalogo(conn, "tour_idioma_guia_otro", tour.idioma_otro);
      }
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
    // Detectar si tren tiene equipaje (para no petar en SELECT)
    const [trenColsRows] = await pool.execute(
      `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'tren'
        AND COLUMN_NAME = 'equipaje'
      `
    );
    const trenTieneEquipaje = trenColsRows.length > 0;

    const trenEquipajeSelect = trenTieneEquipaje ? ", t.equipaje AS tren_equipaje" : "";

    const [rows] = await pool.execute(`
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
        c.nombre  AS ciudad,
        pa.id     AS id_pais,
        ct.id     AS id_continente,

        -- alojamiento
        a.noches AS noches_alojamiento,

        -- boleto
        be.boleto_entrada     AS be_lugar,
        be.tipo_entrada       AS be_tipo,
        be.tipo_entrada_otro  AS be_tipo_otro,
        be.audioguia          AS be_audioguia,
        be.idioma             AS be_idioma,

        -- vuelo
        v.origen   AS vuelo_origen,
        v.destino  AS vuelo_destino,
        v.escalas  AS vuelo_escalas,
        v.clase    AS vuelo_clase,
        v.equipaje AS vuelo_equipaje,

        -- tren
        t.origen   AS tren_origen,
        t.destino  AS tren_destino,
        t.escalas  AS tren_escalas,
        t.clase    AS tren_clase
        ${trenEquipajeSelect},
        t.sillas_reservadas AS tren_sillas_reservadas

      FROM servicio s
      JOIN tiposervicio ts ON s.id_tipo = ts.id
      JOIN ciudad      c  ON s.id_ciudad = c.id
      JOIN pais        pa ON c.id_pais = pa.id
      JOIN continente  ct ON pa.id_continente = ct.id

      LEFT JOIN alojamiento    a  ON a.id_servicio  = s.id
      LEFT JOIN boleto_entrada be ON be.id_servicio = s.id
      LEFT JOIN vuelo          v  ON v.id_servicio  = s.id
      LEFT JOIN tren           t  ON t.id_servicio  = s.id

      ORDER BY s.nombre_wtravel
    `);

    function textoEscalas(escalas) {
      const n = Number(escalas);
      if (!Number.isFinite(n) || n <= 0) return "directo";
      return n === 1 ? "1 escala" : `${n} escalas`;
    }

    function buildServicioTexto(s) {
      const tipo = (s.tipo || "").toLowerCase();
      let base = s.nombre_wtravel || `Servicio #${s.id}`;

      // Vuelo
      if (tipo.includes("vuelo") && (s.vuelo_origen || s.vuelo_destino)) {
        base = `Vuelo ${textoEscalas(s.vuelo_escalas)} de ${s.vuelo_origen} a ${s.vuelo_destino}`;
        if (s.vuelo_clase) base += `, clase ${s.vuelo_clase}`;
        if (s.vuelo_equipaje) base += `, equipaje ${s.vuelo_equipaje}`;
        return base;
      }

      // Tren
      if (tipo.includes("tren") && (s.tren_origen || s.tren_destino)) {
        base = `Tren ${textoEscalas(s.tren_escalas)} de ${s.tren_origen} a ${s.tren_destino}`;
        if (s.tren_clase) base += `, clase ${s.tren_clase}`;
        if (s.tren_equipaje) base += `, equipaje ${s.tren_equipaje}`;
        if (s.tren_sillas_reservadas != null) {
          base += s.tren_sillas_reservadas ? `, asientos reservados` : `, sin asientos reservados`;
        }
        return base;
      }

      // Boleto
      if (tipo.includes("boleto") && (s.be_lugar || s.be_tipo)) {
        base = `Entrada: ${s.be_lugar || "Lugar"}`;
        if (s.be_tipo) base += `, ${s.be_tipo}`;
        if (s.be_tipo === "OTRA" && s.be_tipo_otro) base += ` (${s.be_tipo_otro})`;
        if (s.be_audioguia != null) base += s.be_audioguia ? `, con audioguía` : `, sin audioguía`;
        if (s.be_idioma) base += `, idioma ${s.be_idioma}`;
        return base;
      }

      // Alojamiento
      if (tipo.includes("aloj") && s.noches_alojamiento) {
        return `Alojamiento: ${base} (${s.noches_alojamiento} noche(s))`;
      }

      return base;
    }

    const rowsFinal = rows.map(r => ({
      ...r,
      servicio_texto: buildServicioTexto(r)
    }));

    return res.json(rowsFinal);

  } catch (e) {
    console.error("GET /servicios", e);
    return res.status(500).json({
      ok: false,
      mensaje: "Error listando servicios",
      error: e.message
    });
  }
});

/* =========================================================
   GET /api/servicios/:id
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

    // Alojamiento (incluye *_otro)
    const [alojaRows] = await pool.execute(
      `
      SELECT
        noches,
        habitaciones,
        regimen,
        regimen_otro,
        categoria_hotel,
        categoria_hotel_otro,
        categoria_hab,
        categoria_hab_otro,
        proveedor_hotel
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
      SELECT
        boleto_entrada,
        tipo_entrada,
        tipo_entrada_otro,
        audioguia,
        idioma
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

    // Tren (equipaje puede no existir)
    const [trenColsRows] = await pool.execute(
      `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'tren'
        AND COLUMN_NAME = 'equipaje'
      `
    );
    const trenTieneEquipaje = trenColsRows.length > 0;

    const trenSelect = trenTieneEquipaje
      ? `SELECT origen, destino, escalas, clase, equipaje, sillas_reservadas FROM tren WHERE id_servicio = ?`
      : `SELECT origen, destino, escalas, clase, sillas_reservadas FROM tren WHERE id_servicio = ?`;

    const [trenRows] = await pool.execute(trenSelect, [id]);
    const tren = trenRows[0] || null;

    // Traslado / Tour (si no existen, no rompe)
    const [trasRows] = await pool.execute(
      `SELECT * FROM traslado WHERE id_servicio = ?`,
      [id]
    ).catch(() => [[]]);
    const traslado = trasRows[0] || null;

    const [tourRows] = await pool.execute(
      `SELECT * FROM tour WHERE id_servicio = ?`,
      [id]
    ).catch(() => [[]]);
    const tour = tourRows[0] || null;

    return res.json({
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
    return res.status(500).json({ ok: false, mensaje: "Error obteniendo servicio", error: e.message });
  }
});

/* =========================================================
   PUT /api/servicio/:id
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