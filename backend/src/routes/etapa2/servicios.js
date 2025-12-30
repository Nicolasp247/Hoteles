// backend/src/routes/etapa2/servicios.js
const express = require("express");
const router = express.Router();
const pool = require("../../db"); // mysql2/promise pool

// ✅ Generador del texto automático (nombre_wtravel)
const { buildNombreWtravel } = require("../etapa3/servicios-texto");

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
const _colsCache = new Map(); // key: tableName -> [cols...]

async function getTableColumns(conn, tableName) {
  if (_colsCache.has(tableName)) return _colsCache.get(tableName);

  const [rows] = await conn.execute(
    `
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
    `,
    [tableName]
  );

  const cols = rows.map((r) => r.COLUMN_NAME);
  _colsCache.set(tableName, cols);
  return cols;
}

async function insertDynamicOneToOne(conn, tableName, id_servicio, obj) {
  // Inserta en tableName con id_servicio + SOLO columnas existentes
  if (!obj || typeof obj !== "object") return false;

  const cols = await getTableColumns(conn, tableName);
  if (!cols.includes("id_servicio")) return false;

  const payload = { ...obj, id_servicio };

  // Filtrar claves que sí existen como columnas
  const keys = Object.keys(payload).filter((k) => cols.includes(k));
  if (keys.length === 0) return false;

  const placeholders = keys.map(() => "?").join(", ");
  const sql = `INSERT INTO ${tableName} (${keys.join(", ")}) VALUES (${placeholders})`;
  const values = keys.map((k) => payload[k]);

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
    res
      .status(500)
      .json({ ok: false, mensaje: "Error listando proveedores", error: e.message });
  }
});

/* =========================================================
   POST /api/servicios
   ✅ nombre_wtravel es AUTOMÁTICO (generado por buildNombreWtravel)
   ✅ Devuelve también servicio_texto (igual a nombre_wtravel)
========================================================= */
router.post("/servicios", async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const {
      id_tipo,
      id_proveedor,
      id_ciudad,
      tiempo_servicio,
      privado,
      descripcion,
      link_reserva,

      alojamiento,
      boleto_entrada,
      vuelo,
      tren,
      traslado,
      tour,
    } = req.body || {};

    if (!id_tipo || !id_proveedor || !id_ciudad) {
      return res.status(400).json({
        ok: false,
        mensaje: "Faltan campos obligatorios: id_tipo, id_proveedor, id_ciudad.",
      });
    }

    const [[tipoRow]] = await conn.execute(
      `SELECT nombre FROM tiposervicio WHERE id = ?`,
      [Number(id_tipo)]
    );
    const tipoNombre = (tipoRow?.nombre || "").toLowerCase();
    const descTrim = String(descripcion || "").trim();

    // ==========================
    // Validaciones mínimas (las tuyas, con fixes)
    // ==========================
    if (tipoNombre.includes("vuelo")) {
      const v = vuelo || {};
      const origen = String(v.origen || "").trim();
      const destino = String(v.destino || "").trim();
      const clase = String(v.clase || "").trim();
      const equipaje = String(v.equipaje || "").trim();
      const escalas = v.escalas;

      if (
        !origen ||
        !destino ||
        !clase ||
        !equipaje ||
        escalas === undefined ||
        escalas === null ||
        escalas === ""
      ) {
        return res.status(400).json({
          ok: false,
          mensaje: "Para VUELO son obligatorios: escalas, origen, destino, clase y equipaje.",
        });
      }
    }

    if (tipoNombre.includes("tren")) {
      const t = tren || {};
      const origen = String(t.origen || "").trim();
      const destino = String(t.destino || "").trim();
      const clase = String(t.clase || "").trim();
      const escalas = t.escalas;
      const hasSillas =
        t.sillas_reservadas !== undefined &&
        t.sillas_reservadas !== null &&
        t.sillas_reservadas !== "";

      if (
        !origen ||
        !destino ||
        !clase ||
        escalas === undefined ||
        escalas === null ||
        escalas === "" ||
        !hasSillas
      ) {
        return res.status(400).json({
          ok: false,
          mensaje: "Para TREN son obligatorios: escalas, origen, destino, clase y sillas_reservadas.",
        });
      }
    }

    if (tipoNombre.includes("aloj")) {
      const a = alojamiento || {};
      const noches = Number(a.noches);
      const regimen = String(a.regimen || "").trim();
      const catHab = String(a.categoria_hab || "").trim();

      if (!Number.isFinite(noches) || noches <= 0 || !regimen || !catHab) {
        return res.status(400).json({
          ok: false,
          mensaje: "Para ALOJAMIENTO son obligatorios: noches, categoría de habitación y régimen.",
        });
      }

      if (regimen === "OTRO" && !String(a.regimen_otro || "").trim()) {
        return res.status(400).json({
          ok: false,
          mensaje: "Régimen OTRO requiere especificar regimen_otro.",
        });
      }
      if (catHab === "OTRO" && !String(a.categoria_hab_otro || "").trim()) {
        return res.status(400).json({
          ok: false,
          mensaje: "Categoría habitación OTRO requiere categoria_hab_otro.",
        });
      }
    }

    if (tipoNombre.includes("trasl")) {
      const tr = traslado || {};
      const origen = String(tr.origen || "").trim();
      const destino = String(tr.destino || "").trim();
      if (!origen || !destino) {
        return res.status(400).json({
          ok: false,
          mensaje: "Para TRASLADO son obligatorios: origen y destino.",
        });
      }
    }

    if (tipoNombre.includes("excurs") || tipoNombre.includes("visita") || tipoNombre.includes("tour")) {
      const tu = tour || {};
      const tipoGuia = String(tu.tipo_guia || "").trim();
      const idiomaReal = String(tu.idioma || "").trim(); // ✅ FIX: antes estaba leyendo tu.id_servicio

      if (!descTrim) {
        return res.status(400).json({
          ok: false,
          mensaje: "Para VISITA/EXCURSIÓN es obligatoria la descripción del servicio.",
        });
      }
      if (!tipoGuia) return res.status(400).json({ ok: false, mensaje: "Para VISITA/EXCURSIÓN falta tipo_guia." });
      if (!idiomaReal) return res.status(400).json({ ok: false, mensaje: "Para VISITA/EXCURSIÓN falta idioma." });
    }

    if (tipoNombre.includes("boleto")) {
      const be = boleto_entrada || {};
      const lugar = String(be.boleto_entrada || "").trim();
      const tipoEntrada = String(be.tipo_entrada || "").trim();
      const idioma = String(be.idioma || "").trim();
      const tipoGuia = String(be.tipo_guia || "").trim();

      if (!descTrim && !lugar) {
        return res.status(400).json({
          ok: false,
          mensaje: "Para BOLETO es obligatoria la descripción o el lugar del boleto.",
        });
      }

      if (!lugar || !tipoEntrada || !idioma || !tipoGuia) {
        return res.status(400).json({
          ok: false,
          mensaje: "Para BOLETO son obligatorios: lugar, tipo_entrada, tipo_guia e idioma.",
        });
      }

      if (tipoEntrada === "OTRA" && !String(be.tipo_entrada_otro || "").trim()) {
        return res.status(400).json({
          ok: false,
          mensaje: "Tipo de entrada OTRA requiere especificar tipo_entrada_otro.",
        });
      }
    }

    // ==========================
    // ✅ Construimos nombre_wtravel automático con TU formato
    // ==========================
    const payloadForText = {
      privado: !!privado,
      descripcion: descTrim || null,
      link_reserva: link_reserva ? String(link_reserva).trim() : null,
      tiempo_servicio: tiempo_servicio ? String(tiempo_servicio).trim() : null,
      alojamiento: alojamiento || null,
      boleto_entrada: boleto_entrada || null,
      vuelo: vuelo || null,
      tren: tren || null,
      traslado: traslado || null,
      tour: tour || null,
    };

    let nombreAuto = buildNombreWtravel(payloadForText);

    // fallback fuerte (nunca guardar vacío)
    if (!String(nombreAuto || "").trim()) {
      nombreAuto = descTrim || `Servicio tipo ${Number(id_tipo)}`;
    }

    await conn.beginTransaction();

    // 1) Insert servicio (nombre_wtravel = automático)
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
        String(nombreAuto).trim(),
        tiempo_servicio ? String(tiempo_servicio).trim() : null,
        privado ? 1 : 0,
        descTrim || null,
        link_reserva ? String(link_reserva).trim() : null,
      ]
    );

    const id_servicio = ins.insertId;

    // ==========================
    // Inserts 1:1 (detalles)
    // ==========================

    // ===== ALOJAMIENTO =====
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
          regimen === "OTRO" ? regimen_otro : null,
          categoria_hotel,
          categoria_hotel === "OTRO" ? categoria_hotel_otro : null,
          categoria_hab,
          categoria_hab === "OTRO" ? categoria_hab_otro : null,
          alojamiento.proveedor_hotel ?? null,
        ]
      );

      // auto-aprendizaje catálogos
      if (regimen === "OTRO" && regimen_otro) await upsertCatalogo(conn, "aloj_regimen_otro", regimen_otro);
      if (categoria_hotel === "OTRO" && categoria_hotel_otro) await upsertCatalogo(conn, "aloj_categoria_hotel_otro", categoria_hotel_otro);
      if (categoria_hab === "OTRO" && categoria_hab_otro) await upsertCatalogo(conn, "aloj_categoria_hab_otro", categoria_hab_otro);
    }

    // ===== BOLETO =====
    if (boleto_entrada) {
      const tipo_entrada = String(boleto_entrada.tipo_entrada || "").trim() || null;
      const tipo_entrada_otro = String(boleto_entrada.tipo_entrada_otro || "").trim() || null;

      const tipo_guia = String(boleto_entrada.tipo_guia || "").trim() || null;
      const idioma = String(boleto_entrada.idioma || "").trim() || null;

      await conn.execute(
        `
        INSERT INTO boleto_entrada (
          id_servicio,
          boleto_entrada,
          tipo_entrada,
          tipo_entrada_otro,
          audioguia,
          tipo_guia,
          idioma
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          id_servicio,
          boleto_entrada.boleto_entrada || null,
          tipo_entrada,
          tipo_entrada === "OTRA" ? tipo_entrada_otro : null,
          boleto_entrada.audioguia ? 1 : 0,
          tipo_guia,
          idioma,
        ]
      );

      if (tipo_entrada === "OTRA" && tipo_entrada_otro) await upsertCatalogo(conn, "boleto_tipo_entrada_otro", tipo_entrada_otro);
      if (idioma) await upsertCatalogo(conn, "idiomas", idioma);

      // si el tipo_guia viene raro, lo guardas como “otro” (opcional)
      if (tipo_guia && !["guia", "audioguia", "ninguno"].includes(tipo_guia.toLowerCase())) {
        await upsertCatalogo(conn, "boleto_tipo_guia_otro", tipo_guia);
      }

      // lugar también lo puedes “aprender” si quieres
      if (boleto_entrada.boleto_entrada) await upsertCatalogo(conn, "boleto_lugar", boleto_entrada.boleto_entrada);
    }

    // ===== VUELO =====
    if (vuelo) {
      await insertDynamicOneToOne(conn, "vuelo", id_servicio, {
        origen: String(vuelo.origen || "").trim(),
        destino: String(vuelo.destino || "").trim(),
        escalas: vuelo.escalas ?? 0,
        clase: String(vuelo.clase || "").trim(),
        equipaje: String(vuelo.equipaje || "").trim(),
      });

      // auto-aprendizaje
      if (vuelo.origen) await upsertCatalogo(conn, "vuelo_origen", vuelo.origen);
      if (vuelo.destino) await upsertCatalogo(conn, "vuelo_destino", vuelo.destino);
      if (vuelo.clase) await upsertCatalogo(conn, "vuelo_clase", vuelo.clase);
      if (vuelo.equipaje) await upsertCatalogo(conn, "vuelo_equipaje", vuelo.equipaje);
    }

    // ===== TREN =====
    if (tren) {
      await insertDynamicOneToOne(conn, "tren", id_servicio, {
        origen: String(tren.origen || "").trim(),
        destino: String(tren.destino || "").trim(),
        escalas: tren.escalas ?? 0,
        clase: String(tren.clase || "").trim(),
        equipaje: tren.equipaje ? String(tren.equipaje).trim() : null,
        sillas_reservadas: tren.sillas_reservadas ? 1 : 0,
      });

      // auto-aprendizaje
      if (tren.origen) await upsertCatalogo(conn, "tren_origen", tren.origen);
      if (tren.destino) await upsertCatalogo(conn, "tren_destino", tren.destino);
      if (tren.clase) await upsertCatalogo(conn, "tren_clase", tren.clase);
      if (tren.equipaje) await upsertCatalogo(conn, "tren_equipaje", tren.equipaje);
    }

    // ===== TRASLADO =====
    if (traslado) {
      await insertDynamicOneToOne(conn, "traslado", id_servicio, traslado);

      if (traslado.tipo_traslado === "OTRO" && traslado.tipo_traslado_otro) {
        await upsertCatalogo(conn, "traslado_tipo_otro", traslado.tipo_traslado_otro);
      }
      if (traslado.vehiculo === "OTRO" && traslado.vehiculo_otro) {
        await upsertCatalogo(conn, "traslado_vehiculo_otro", traslado.vehiculo_otro);
      }
      if (traslado.origen) await upsertCatalogo(conn, "traslado_origen", traslado.origen);
      if (traslado.destino) await upsertCatalogo(conn, "traslado_destino", traslado.destino);
    }

    // ===== TOUR =====
    if (tour) {
      const tipo_guia = String(tour.tipo_guia || "").trim() || null;
      const idioma = String(tour.idioma || "").trim() || null;

      // Insert dinámico: se adapta si tu tabla tour tiene más columnas
      await insertDynamicOneToOne(conn, "tour", id_servicio, { ...tour, tipo_guia, idioma });

      if (tipo_guia) await upsertCatalogo(conn, "tour_tipo_guia", tipo_guia);
      if (idioma) await upsertCatalogo(conn, "idiomas", idioma);
    }

    await conn.commit();

    return res.status(201).json({
      ok: true,
      id_servicio,
      nombre_wtravel: String(nombreAuto).trim(),
      servicio_texto: String(nombreAuto).trim(), // ✅ para frontend (cotizacion-editar.js)
      mensaje: "Servicio creado",
    });
  } catch (e) {
    try { if (conn) await conn.rollback(); } catch {}

    if (e && e.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        ok: false,
        mensaje:
          "El nombre generado quedó duplicado. Cambia algún campo (por ejemplo origen/destino/clase) o ajustamos el generador para agregar un sufijo.",
        error: e.message,
      });
    }

    console.error("POST /servicios", e);
    return res.status(500).json({
      ok: false,
      mensaje: "Error creando servicio",
      error: e.message,
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
        await pool.execute("INSERT INTO serviciohora (id_servicio, hora) VALUES (?, ?)", [
          id_servicio,
          hora,
        ]);
      } catch {
        errorCount++;
      }
    }

    if (errorCount > 0) {
      return res.status(207).json({
        ok: true,
        partial: true,
        errorCount,
        mensaje: "Algunas horas no se insertaron (¿duplicadas o inválidas?)",
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
   ✅ servicio_texto = nombre_wtravel (ya viene “bonito” por el generador)
========================================================= */
router.get("/servicios", async (_req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const [rows] = await conn.execute(`
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
        a.noches               AS aloj_noches,
        a.regimen              AS aloj_regimen,
        a.regimen_otro         AS aloj_regimen_otro,
        a.categoria_hotel      AS aloj_categoria_hotel,
        a.categoria_hotel_otro AS aloj_categoria_hotel_otro,
        a.categoria_hab        AS aloj_categoria_hab,
        a.categoria_hab_otro   AS aloj_categoria_hab_otro,

        -- boleto
        be.boleto_entrada    AS be_lugar,
        be.tipo_entrada      AS be_tipo,
        be.tipo_entrada_otro AS be_tipo_otro,
        be.audioguia         AS be_audioguia,
        be.tipo_guia         AS be_tipo_guia,
        be.idioma            AS be_idioma,

        -- vuelo
        v.origen   AS vuelo_origen,
        v.destino  AS vuelo_destino,
        v.escalas  AS vuelo_escalas,
        v.clase    AS vuelo_clase,
        v.equipaje AS vuelo_equipaje,

        -- tren
        t.origen            AS tren_origen,
        t.destino           AS tren_destino,
        t.escalas           AS tren_escalas,
        t.clase             AS tren_clase,
        t.sillas_reservadas AS tren_sillas_reservadas,

        -- traslado
        tr.origen  AS traslado_origen,
        tr.destino AS traslado_destino,

        -- tour
        tu.tipo_guia AS tour_tipo_guia,
        tu.idioma    AS tour_idioma

      FROM servicio s
      JOIN tiposervicio ts ON s.id_tipo = ts.id
      JOIN ciudad      c  ON s.id_ciudad = c.id
      JOIN pais        pa ON c.id_pais = pa.id
      JOIN continente  ct ON pa.id_continente = ct.id

      LEFT JOIN alojamiento    a  ON a.id_servicio  = s.id
      LEFT JOIN boleto_entrada be ON be.id_servicio = s.id
      LEFT JOIN vuelo          v  ON v.id_servicio  = s.id
      LEFT JOIN tren           t  ON t.id_servicio  = s.id
      LEFT JOIN traslado       tr ON tr.id_servicio = s.id
      LEFT JOIN tour           tu ON tu.id_servicio = s.id

      ORDER BY s.nombre_wtravel
    `);

    const rowsFinal = rows.map((r) => ({
      ...r,
      servicio_texto: r.nombre_wtravel || `Servicio #${r.id}`,
    }));

    return res.json({ ok: true, servicios: rowsFinal });
  } catch (e) {
    console.error("GET /servicios", e);
    return res.status(500).json({
      ok: false,
      mensaje: "Error listando servicios",
      error: e.message,
    });
  } finally {
    try { if (conn) conn.release(); } catch {}
  }
});

/* =========================================================
   GET /api/servicios/:id
========================================================= */
router.get("/servicios/:id", async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, mensaje: "id inválido" });

    const [rows] = await conn.execute(
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

    const [alojaRows] = await conn.execute(
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

    const [hrsRows] = await conn.execute(
      `
      SELECT DATE_FORMAT(hora,'%H:%i') AS hora
      FROM serviciohora
      WHERE id_servicio = ?
      ORDER BY hora
      `,
      [id]
    );
    const horas = hrsRows.map((x) => x.hora);

    const [beRows] = await conn.execute(
      `
      SELECT
        boleto_entrada,
        tipo_entrada,
        tipo_entrada_otro,
        audioguia,
        tipo_guia,
        idioma
      FROM boleto_entrada
      WHERE id_servicio = ?
      `,
      [id]
    );
    const boleto_entrada = beRows[0] || null;

    const [vueloRows] = await conn.execute(
      `
      SELECT origen, destino, escalas, clase, equipaje
      FROM vuelo
      WHERE id_servicio = ?
      `,
      [id]
    );
    const vuelo = vueloRows[0] || null;

    const [trenRows] = await conn
      .execute(
        `
      SELECT origen, destino, escalas, clase, sillas_reservadas
      FROM tren
      WHERE id_servicio = ?
      `,
        [id]
      )
      .catch(() => [[]]);
    const tren = trenRows[0] || null;

    const [trasRows] = await conn
      .execute(`SELECT * FROM traslado WHERE id_servicio = ?`, [id])
      .catch(() => [[]]);
    const traslado = trasRows[0] || null;

    const [tourRows] = await conn
      .execute(`SELECT * FROM tour WHERE id_servicio = ?`, [id])
      .catch(() => [[]]);
    const tour = tourRows[0] || null;

    return res.json({
      ok: true,
      servicio: {
        id: base.id,
        id_tipo: base.id_tipo,
        id_proveedor: base.id_proveedor,
        id_ciudad: base.id_ciudad,
        nombre_wtravel: base.nombre_wtravel,
        servicio_texto: base.nombre_wtravel, // ✅ compat
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
        tour,
      },
    });
  } catch (e) {
    console.error("GET /servicios/:id", e);
    return res.status(500).json({ ok: false, mensaje: "Error obteniendo servicio", error: e.message });
  } finally {
    try { if (conn) conn.release(); } catch {}
  }
});

/* =========================================================
   PUT /api/servicio/:id
   ✅ Update real con UPSERT en tablas 1:1
   ✅ Recalcula nombre_wtravel con buildNombreWtravel()
========================================================= */
router.put("/servicio/:id", async (req, res) => {
  let conn;
  try {
    const id = Number(req.params.id);
    const {
      id_tipo, id_proveedor, id_ciudad,
      tiempo_servicio, privado, descripcion, link_reserva,
      alojamiento, boleto_entrada, vuelo, tren, traslado, tour
    } = req.body || {};

    if (!id || !id_tipo || !id_proveedor || !id_ciudad) {
      return res.status(400).json({ ok: false, mensaje: "faltan campos obligatorios" });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const descTrim = descripcion ? String(descripcion).trim() : null;
    const priv = privado ? 1 : 0;

    // =========================
    // 1) UPDATE tabla servicio (sin nombre_wtravel todavía)
    // =========================
    const [r] = await conn.execute(
      `
      UPDATE servicio
      SET id_tipo=?, id_proveedor=?, id_ciudad=?,
          tiempo_servicio=?, privado=?,
          descripcion=?, link_reserva=?
      WHERE id=?
      `,
      [
        id_tipo,
        id_proveedor,
        id_ciudad,
        tiempo_servicio ? String(tiempo_servicio).trim() : null,
        priv,
        descTrim,
        link_reserva ? String(link_reserva).trim() : null,
        id,
      ]
    );

    if (!r.affectedRows) {
      await conn.rollback();
      return res.status(404).json({ ok: false, mensaje: "Servicio no encontrado" });
    }

    // =========================================================
    // 2) UPSERTs reales por tabla detalle (1:1)
    // =========================================================

    // ===== ALOJAMIENTO =====
    if (alojamiento) {
      const noches = Number(alojamiento.noches);
      const habitaciones = Number(alojamiento.habitaciones ?? 1);

      const regimen = alojamiento.regimen ?? null;
      const regimen_otro = String(alojamiento.regimen_otro || "").trim() || null;

      const categoria_hotel = alojamiento.categoria_hotel ?? null;
      const categoria_hotel_otro = String(alojamiento.categoria_hotel_otro || "").trim() || null;

      const categoria_hab = alojamiento.categoria_hab ?? null;
      const categoria_hab_otro = String(alojamiento.categoria_hab_otro || "").trim() || null;

      if (!Number.isFinite(noches) || noches <= 0) {
        await conn.rollback();
        return res.status(400).json({ ok: false, mensaje: "ALOJAMIENTO: noches inválidas" });
      }
      if (!categoria_hab) {
        await conn.rollback();
        return res.status(400).json({ ok: false, mensaje: "ALOJAMIENTO: falta categoria_hab" });
      }
      if (!regimen) {
        await conn.rollback();
        return res.status(400).json({ ok: false, mensaje: "ALOJAMIENTO: falta regimen" });
      }
      if (regimen === "OTRO" && !regimen_otro) {
        await conn.rollback();
        return res.status(400).json({ ok: false, mensaje: "ALOJAMIENTO: regimen OTRO requiere regimen_otro" });
      }
      if (categoria_hab === "OTRO" && !categoria_hab_otro) {
        await conn.rollback();
        return res.status(400).json({ ok: false, mensaje: "ALOJAMIENTO: categoria_hab OTRO requiere categoria_hab_otro" });
      }
      if (categoria_hotel === "OTRO" && !categoria_hotel_otro) {
        await conn.rollback();
        return res.status(400).json({ ok: false, mensaje: "ALOJAMIENTO: categoria_hotel OTRO requiere categoria_hotel_otro" });
      }

      await conn.execute(
        `
        INSERT INTO alojamiento (
          id_servicio,
          noches, habitaciones,
          regimen, regimen_otro,
          categoria_hotel, categoria_hotel_otro,
          categoria_hab, categoria_hab_otro,
          proveedor_hotel
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          noches = VALUES(noches),
          habitaciones = VALUES(habitaciones),
          regimen = VALUES(regimen),
          regimen_otro = VALUES(regimen_otro),
          categoria_hotel = VALUES(categoria_hotel),
          categoria_hotel_otro = VALUES(categoria_hotel_otro),
          categoria_hab = VALUES(categoria_hab),
          categoria_hab_otro = VALUES(categoria_hab_otro),
          proveedor_hotel = VALUES(proveedor_hotel)
        `,
        [
          id,
          noches,
          Number.isFinite(habitaciones) && habitaciones > 0 ? habitaciones : 1,
          regimen,
          regimen === "OTRO" ? regimen_otro : null,
          categoria_hotel,
          categoria_hotel === "OTRO" ? categoria_hotel_otro : null,
          categoria_hab,
          categoria_hab === "OTRO" ? categoria_hab_otro : null,
          alojamiento.proveedor_hotel ?? null,
        ]
      );

      // opcional: “aprendizaje” de catálogos (si quieres)
      if (regimen === "OTRO" && regimen_otro) await upsertCatalogo(conn, "aloj_regimen_otro", regimen_otro);
      if (categoria_hotel === "OTRO" && categoria_hotel_otro) await upsertCatalogo(conn, "aloj_categoria_hotel_otro", categoria_hotel_otro);
      if (categoria_hab === "OTRO" && categoria_hab_otro) await upsertCatalogo(conn, "aloj_categoria_hab_otro", categoria_hab_otro);
    }

    // ===== BOLETO =====
    if (boleto_entrada) {
      const lugar = String(boleto_entrada.boleto_entrada || "").trim();
      const tipo_entrada = String(boleto_entrada.tipo_entrada || "").trim();
      const tipo_entrada_otro = String(boleto_entrada.tipo_entrada_otro || "").trim() || null;
      const tipo_guia = String(boleto_entrada.tipo_guia || "").trim();
      const idioma = String(boleto_entrada.idioma || "").trim();
      const audioguia = boleto_entrada.audioguia ? 1 : 0;

      if (!lugar || !tipo_entrada || !tipo_guia || !idioma) {
        await conn.rollback();
        return res.status(400).json({
          ok: false,
          mensaje: "BOLETO: obligatorios boleto_entrada, tipo_entrada, tipo_guia e idioma.",
        });
      }
      if (tipo_entrada === "OTRA" && !tipo_entrada_otro) {
        await conn.rollback();
        return res.status(400).json({
          ok: false,
          mensaje: "BOLETO: tipo_entrada OTRA requiere tipo_entrada_otro.",
        });
      }

      await conn.execute(
        `
        INSERT INTO boleto_entrada (
          id_servicio,
          boleto_entrada,
          tipo_entrada,
          tipo_entrada_otro,
          audioguia,
          tipo_guia,
          idioma
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          boleto_entrada = VALUES(boleto_entrada),
          tipo_entrada = VALUES(tipo_entrada),
          tipo_entrada_otro = VALUES(tipo_entrada_otro),
          audioguia = VALUES(audioguia),
          tipo_guia = VALUES(tipo_guia),
          idioma = VALUES(idioma)
        `,
        [
          id,
          lugar,
          tipo_entrada,
          tipo_entrada === "OTRA" ? tipo_entrada_otro : null,
          audioguia,
          tipo_guia,
          idioma,
        ]
      );

      if (tipo_entrada === "OTRA" && tipo_entrada_otro) await upsertCatalogo(conn, "boleto_tipo_entrada_otro", tipo_entrada_otro);
      if (idioma) await upsertCatalogo(conn, "idiomas", idioma);
    }

    // ===== VUELO =====
    if (vuelo) {
      const origen = String(vuelo.origen || "").trim();
      const destino = String(vuelo.destino || "").trim();
      const clase = String(vuelo.clase || "").trim() || null;
      const equipaje = String(vuelo.equipaje || "").trim() || null;
      const escalas = vuelo.escalas;

      if (!origen || !destino || escalas === undefined || escalas === null || escalas === "") {
        await conn.rollback();
        return res.status(400).json({
          ok: false,
          mensaje: "VUELO: obligatorios escalas, origen y destino.",
        });
      }

      await conn.execute(
        `
        INSERT INTO vuelo (id_servicio, origen, destino, escalas, clase, equipaje)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          origen = VALUES(origen),
          destino = VALUES(destino),
          escalas = VALUES(escalas),
          clase = VALUES(clase),
          equipaje = VALUES(equipaje)
        `,
        [id, origen, destino, Number(escalas), clase, equipaje]
      );
    }

    // ===== TREN =====
    if (tren) {
      const origen = String(tren.origen || "").trim();
      const destino = String(tren.destino || "").trim();
      const clase = String(tren.clase || "").trim() || null;
      const equipaje = tren.equipaje != null ? String(tren.equipaje).trim() : null;
      const escalas = tren.escalas;

      const hasSillas =
        tren.sillas_reservadas !== undefined &&
        tren.sillas_reservadas !== null &&
        String(tren.sillas_reservadas) !== "";

      if (!origen || !destino || escalas === undefined || escalas === null || escalas === "" || !hasSillas) {
        await conn.rollback();
        return res.status(400).json({
          ok: false,
          mensaje: "TREN: obligatorios escalas, origen, destino y sillas_reservadas.",
        });
      }

      const sillas = String(tren.sillas_reservadas) === "1" || tren.sillas_reservadas === true ? 1 : 0;

      await conn.execute(
        `
        INSERT INTO tren (id_servicio, origen, destino, escalas, clase, equipaje, sillas_reservadas)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          origen = VALUES(origen),
          destino = VALUES(destino),
          escalas = VALUES(escalas),
          clase = VALUES(clase),
          equipaje = VALUES(equipaje),
          sillas_reservadas = VALUES(sillas_reservadas)
        `,
        [id, origen, destino, Number(escalas), clase, equipaje, sillas]
      );
    }

    // ===== TRASLADO =====
    if (traslado) {
      const origen = String(traslado.origen || "").trim();
      const destino = String(traslado.destino || "").trim();

      if (!origen || !destino) {
        await conn.rollback();
        return res.status(400).json({ ok: false, mensaje: "TRASLADO: obligatorios origen y destino." });
      }

      const tipo_traslado = traslado.tipo_traslado ?? null;
      const tipo_traslado_otro = String(traslado.tipo_traslado_otro || "").trim() || null;

      const vehiculo = traslado.vehiculo ?? null;
      const vehiculo_otro = String(traslado.vehiculo_otro || "").trim() || null;

      await conn.execute(
        `
        INSERT INTO traslado (
          id_servicio,
          origen, destino,
          tipo_traslado, tipo_traslado_otro,
          vehiculo, vehiculo_otro,
          nota
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          origen = VALUES(origen),
          destino = VALUES(destino),
          tipo_traslado = VALUES(tipo_traslado),
          tipo_traslado_otro = VALUES(tipo_traslado_otro),
          vehiculo = VALUES(vehiculo),
          vehiculo_otro = VALUES(vehiculo_otro),
          nota = VALUES(nota)
        `,
        [
          id,
          origen,
          destino,
          tipo_traslado,
          tipo_traslado === "OTRO" ? tipo_traslado_otro : null,
          vehiculo,
          vehiculo === "OTRO" ? vehiculo_otro : null,
          traslado.nota ? String(traslado.nota).trim() : null,
        ]
      );

      if (tipo_traslado === "OTRO" && tipo_traslado_otro) await upsertCatalogo(conn, "traslado_tipo_otro", tipo_traslado_otro);
      if (vehiculo === "OTRO" && vehiculo_otro) await upsertCatalogo(conn, "traslado_vehiculo_otro", vehiculo_otro);
      if (origen) await upsertCatalogo(conn, "traslado_origen", origen);
      if (destino) await upsertCatalogo(conn, "traslado_destino", destino);
    }

    // ===== TOUR =====
    if (tour) {
      const tipo_guia = String(tour.tipo_guia || "").trim() || null;
      const tipo_guia_otro = String(tour.tipo_guia_otro || "").trim() || null;

      const idioma = String(tour.idioma || "").trim() || null;
      const idioma_otro = String(tour.idioma_otro || "").trim() || null;

      if (!tipo_guia) {
        await conn.rollback();
        return res.status(400).json({ ok: false, mensaje: "TOUR: falta tipo_guia." });
      }
      if (!idioma) {
        await conn.rollback();
        return res.status(400).json({ ok: false, mensaje: "TOUR: falta idioma." });
      }

      const duracion_min =
        tour.duracion_min !== undefined && tour.duracion_min !== null && String(tour.duracion_min) !== ""
          ? Number(tour.duracion_min)
          : null;

      await conn.execute(
        `
        INSERT INTO tour (
          id_servicio,
          duracion_min,
          tipo_guia,
          tipo_guia_otro,
          idioma,
          idioma_otro
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          duracion_min = VALUES(duracion_min),
          tipo_guia = VALUES(tipo_guia),
          tipo_guia_otro = VALUES(tipo_guia_otro),
          idioma = VALUES(idioma),
          idioma_otro = VALUES(idioma_otro)
        `,
        [
          id,
          Number.isFinite(duracion_min) ? duracion_min : null,
          tipo_guia,
          tipo_guia === "OTRO" ? tipo_guia_otro : null,
          idioma,
          idioma === "OTRO" ? idioma_otro : null,
        ]
      );

      if (tipo_guia) await upsertCatalogo(conn, "tour_tipo_guia", tipo_guia);
      if (idioma) await upsertCatalogo(conn, "idiomas", idioma);
    }

    // =========================================================
    // 3) Recalcular nombre_wtravel con los detalles del body
    // =========================================================
    let nombreAuto = buildNombreWtravel({
      privado: !!privado,
      descripcion: descTrim,
      tiempo_servicio: tiempo_servicio ? String(tiempo_servicio).trim() : null,
      link_reserva: link_reserva ? String(link_reserva).trim() : null,
      alojamiento: alojamiento || null,
      boleto_entrada: boleto_entrada || null,
      vuelo: vuelo || null,
      tren: tren || null,
      traslado: traslado || null,
      tour: tour || null,
    });

    if (!String(nombreAuto || "").trim()) {
      nombreAuto = descTrim || null;
    }

    if (nombreAuto) {
      await conn.execute(
        `UPDATE servicio SET nombre_wtravel=? WHERE id=?`,
        [String(nombreAuto).trim(), id]
      );
    }

    await conn.commit();

    return res.json({
      ok: true,
      mensaje: "Servicio actualizado",
      nombre_wtravel: nombreAuto ? String(nombreAuto).trim() : null,
    });
  } catch (e) {
    try { if (conn) await conn.rollback(); } catch {}
    if (e.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ ok: false, mensaje: "nombre_wtravel duplicado", error: e.message });
    }
    console.error("PUT /servicio/:id", e);
    return res.status(500).json({ ok: false, mensaje: "Error actualizando servicio", error: e.message });
  } finally {
    try { if (conn) conn.release(); } catch {}
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
      await conn.execute("INSERT INTO serviciohora (id_servicio, hora) VALUES (?, ?)", [
        id_servicio,
        toTime(h),
      ]);
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

    const [r] = await pool.execute("DELETE FROM serviciohora WHERE id_servicio=? AND hora=?", [
      id_servicio,
      hora,
    ]);

    if (!r.affectedRows) return res.status(404).json({ ok: false, mensaje: "No existía esa hora" });
    res.json({ ok: true, mensaje: "Hora eliminada" });
  } catch (e) {
    console.error("DELETE /servicios/:id/horas/:hora", e);
    res.status(500).json({ ok: false, mensaje: "Error eliminando hora", error: e.message });
  }
});

/* =========================================================
   GET /api/servicios/:id/precios?anio=YYYY&tipo_habitacion=DBL
========================================================= */
router.get("/servicios/:id/precios", async (req, res) => {
  let conn;
  try {
    const id_servicio = Number(req.params.id);
    const anio = Number(req.query.anio);
    const tipo_habitacion = String(req.query.tipo_habitacion || "DBL").trim().toUpperCase();

    if (!id_servicio) return res.status(400).json({ ok: false, mensaje: "id_servicio inválido" });
    if (!Number.isFinite(anio) || anio < 2000 || anio > 2100) {
      return res.status(400).json({ ok: false, mensaje: "anio inválido" });
    }
    if (!["DBL", "SGL", "TPL"].includes(tipo_habitacion)) {
      return res.status(400).json({ ok: false, mensaje: "tipo_habitacion inválido (DBL/SGL/TPL)" });
    }

    conn = await pool.getConnection();
    const [rows] = await conn.execute(
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

    return res.json({ ok: true, precios: rows });
  } catch (e) {
    console.error("GET /servicios/:id/precios", e);
    return res.status(500).json({ ok: false, mensaje: "Error cargando precios", error: e.message });
  } finally {
    try { if (conn) conn.release(); } catch {}
  }
});

/* =========================================================
   PUT /api/servicios/:id/precios?anio=YYYY&tipo_habitacion=DBL
========================================================= */
router.put("/servicios/:id/precios", async (req, res) => {
  let conn;
  try {
    const id_servicio = Number(req.params.id);
    const anio = Number(req.query.anio);
    const tipo_habitacion = String(req.query.tipo_habitacion || "DBL").trim().toUpperCase();
    const precios = Array.isArray(req.body?.precios) ? req.body.precios : [];

    if (!id_servicio) return res.status(400).json({ ok: false, mensaje: "id_servicio inválido" });
    if (!Number.isFinite(anio) || anio < 2000 || anio > 2100) {
      return res.status(400).json({ ok: false, mensaje: "anio inválido" });
    }
    if (!["DBL", "SGL", "TPL"].includes(tipo_habitacion)) {
      return res.status(400).json({ ok: false, mensaje: "tipo_habitacion inválido (DBL/SGL/TPL)" });
    }
    if (precios.length === 0) {
      return res.status(400).json({ ok: false, mensaje: "Body requiere precios[]" });
    }

    const byMes = new Map();
    for (const p of precios) {
      const mes = Number(p?.mes);
      if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
        return res.status(400).json({ ok: false, mensaje: `Mes inválido: ${p?.mes}` });
      }

      const raw = p?.precio_usd;
      let precio = null;

      if (raw !== null && raw !== undefined && String(raw).trim() !== "") {
        const num = Number(raw);
        if (!Number.isFinite(num)) {
          return res.status(400).json({ ok: false, mensaje: `precio_usd inválido en mes ${mes}` });
        }
        if (num < 0) {
          return res.status(400).json({ ok: false, mensaje: `No se permiten negativos (mes ${mes})` });
        }
        precio = Math.round(num * 100) / 100;
      }

      byMes.set(mes, precio);
    }

    const values = Array.from(byMes.entries()).map(([mes, precio_usd]) => ([
      id_servicio,
      anio,
      mes,
      tipo_habitacion,
      precio_usd
    ]));

    conn = await pool.getConnection();
    await conn.beginTransaction();

    await conn.query(
      `
      INSERT INTO servicio_precio_mes (id_servicio, anio, mes, tipo_habitacion, precio_usd)
      VALUES ?
      ON DUPLICATE KEY UPDATE
        precio_usd = VALUES(precio_usd)
      `,
      [values]
    );

    await conn.commit();
    return res.json({ ok: true, mensaje: "Precios guardados", count: values.length });
  } catch (e) {
    try { if (conn) await conn.rollback(); } catch {}
    console.error("PUT /servicios/:id/precios", e);
    return res.status(500).json({ ok: false, mensaje: "Error guardando precios", error: e.message });
  } finally {
    try { if (conn) conn.release(); } catch {}
  }
});

module.exports = router;
