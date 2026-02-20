// backend/src/routes/etapa2/servicios.js
const express = require("express");
const router = express.Router();
const pool = require("../../db"); // mysql2/promise pool

// ✅ Pro: una sola fuente de verdad para normalización + formato + valor_norm
const {
  normalizeCatalogValue,
  computeValorNorm,
  formatCatalogValueByGroup,
} = require("../../utils/catalogo-normalize");

// ✅ Generador del texto automático (nombre_wtravel)
const { buildNombreWtravel } = require("../etapa3/servicios-texto");

// Helper: normaliza "HH:MM" -> "HH:MM:00"
function toTime(s) {
  if (!s) return null;
  const str = String(s).trim();
  if (/^\d{2}:\d{2}$/.test(str)) return `${str}:00`;
  return str;
}

function requireNumericIdParam(req, res, next) {
  const raw = String(req.params.id || "").trim();
  if (!/^\d+$/.test(raw)) return next(); // 👈 IMPORTANTE: no responder 400, solo saltar
  req.params.id = raw; // normalizado
  next();
}

// Guarda un valor en el catálogo si no existe (auto-aprendizaje)
// ✅ Parte B + C: valor (formateado por grupo) + valor_norm (lower) con UNIQUE(grupo, valor_norm)
async function upsertCatalogo(conn, grupo, valor) {
  const v = formatCatalogValueByGroup(grupo, valor);
  if (!v) return null;

  const vNorm = computeValorNorm(v);

  await conn.execute(
    `INSERT IGNORE INTO catalogo_opcion (grupo, valor, valor_norm) VALUES (?, ?, ?)`,
    [grupo, v, vNorm]
  );

  return v;
}

// =========================
// Helpers para inserts/updates dinámicos (sin adivinar columnas)
// =========================
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

async function upsertDynamicOneToOne(conn, tableName, id_servicio, obj) {
  if (!obj || typeof obj !== "object") return false;

  const cols = await getTableColumns(conn, tableName);
  if (!cols.includes("id_servicio")) return false;

  const payload = { ...obj, id_servicio };

  // solo columnas existentes
  const keys = Object.keys(payload).filter((k) => cols.includes(k));
  if (keys.length === 0) return false;

  const placeholders = keys.map(() => "?").join(", ");
  const updates = keys
    .filter((k) => k !== "id_servicio")
    .map((k) => `${k} = VALUES(${k})`)
    .join(", ");

  const sql = `
    INSERT INTO ${tableName} (${keys.join(", ")})
    VALUES (${placeholders})
    ON DUPLICATE KEY UPDATE ${updates || "id_servicio = id_servicio"}
  `;

  const values = keys.map((k) => payload[k]);
  await conn.execute(sql, values);
  return true;
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

// =========================
// Helpers: Tour/Ticket "OTRO" -> valor real (para DB + catálogos)
// =========================
function resolveOtro(value, otro) {
  const v = normalizeCatalogValue(value);
  if (!v) return null;
  if (v === "OTRO" || v === "OTRA") {
    const o = normalizeCatalogValue(otro);
    return o || null;
  }
  return v;
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
router.post("/servicios", async (req, res, next) => {
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
    // Validaciones (alineadas con PUT para no pelearse frontend/backend)
    // ==========================
    if (tipoNombre.includes("vuelo")) {
      const v = vuelo || {};
      const origen = normalizeCatalogValue(v.origen);
      const destino = normalizeCatalogValue(v.destino);
      const escalas = v.escalas;

      if (!origen || !destino || escalas === undefined || escalas === null || escalas === "") {
        return res.status(400).json({
          ok: false,
          mensaje: "VUELO: obligatorios escalas, origen y destino.",
        });
      }
    }

    if (tipoNombre.includes("tren")) {
      const t = tren || {};
      const origen = normalizeCatalogValue(t.origen);
      const destino = normalizeCatalogValue(t.destino);
      const escalas = t.escalas;

      const hasSillas =
        t.sillas_reservadas !== undefined &&
        t.sillas_reservadas !== null &&
        String(t.sillas_reservadas) !== "";

      if (!origen || !destino || escalas === undefined || escalas === null || escalas === "" || !hasSillas) {
        return res.status(400).json({
          ok: false,
          mensaje: "TREN: obligatorios escalas, origen, destino y sillas_reservadas.",
        });
      }
    }

    if (tipoNombre.includes("aloj")) {
      const a = alojamiento || {};
      const noches = Number(a.noches);
      const regimen = normalizeCatalogValue(a.regimen);
      const catHab = normalizeCatalogValue(a.categoria_hab);

      if (!Number.isFinite(noches) || noches <= 0 || !regimen || !catHab) {
        return res.status(400).json({
          ok: false,
          mensaje: "Para ALOJAMIENTO son obligatorios: noches, categoría de habitación y régimen.",
        });
      }

      if (regimen === "OTRO" && !normalizeCatalogValue(a.regimen_otro)) {
        return res.status(400).json({
          ok: false,
          mensaje: "Régimen OTRO requiere especificar regimen_otro.",
        });
      }
      if (catHab === "OTRO" && !normalizeCatalogValue(a.categoria_hab_otro)) {
        return res.status(400).json({
          ok: false,
          mensaje: "Categoría habitación OTRO requiere categoria_hab_otro.",
        });
      }
    }

    if (tipoNombre.includes("trasl")) {
      const tr = traslado || {};
      const origen = normalizeCatalogValue(tr.origen);
      const destino = normalizeCatalogValue(tr.destino);
      if (!origen || !destino) {
        return res.status(400).json({
          ok: false,
          mensaje: "TRASLADO: obligatorios origen y destino.",
        });
      }
    }

    if (tipoNombre.includes("excurs") || tipoNombre.includes("visita") || tipoNombre.includes("tour")) {
      const tu = tour || {};

      if (!descTrim) {
        return res.status(400).json({
          ok: false,
          mensaje: "Para VISITA/EXCURSIÓN es obligatoria la descripción del servicio.",
        });
      }

      const tipoGuiaReal = resolveOtro(tu.tipo_guia, tu.tipo_guia_otro);
      const idiomaReal = resolveOtro(tu.idioma, tu.idioma_otro);

      if (!tipoGuiaReal) return res.status(400).json({ ok: false, mensaje: "TOUR: falta tipo_guia." });
      if (!idiomaReal) return res.status(400).json({ ok: false, mensaje: "TOUR: falta idioma." });
    }

    if (tipoNombre.includes("boleto")) {
      const be = boleto_entrada || {};
      const lugar = normalizeCatalogValue(be.boleto_entrada);
      const tipoEntrada = normalizeCatalogValue(be.tipo_entrada);
      const idioma = normalizeCatalogValue(be.idioma);
      const tipoGuia = normalizeCatalogValue(be.tipo_guia);

      if (!descTrim && !lugar) {
        return res.status(400).json({
          ok: false,
          mensaje: "Para BOLETO es obligatoria la descripción o el lugar del boleto.",
        });
      }

      if (!lugar || !tipoEntrada || !idioma || !tipoGuia) {
        return res.status(400).json({
          ok: false,
          mensaje: "BOLETO: obligatorios boleto_entrada, tipo_entrada, tipo_guia e idioma.",
        });
      }

      if (tipoEntrada === "OTRA" && !normalizeCatalogValue(be.tipo_entrada_otro)) {
        return res.status(400).json({
          ok: false,
          mensaje: "BOLETO: tipo_entrada OTRA requiere tipo_entrada_otro.",
        });
      }
    }

    // ==========================
    // ✅ Construimos nombre_wtravel automático con TU formato
    //    (para tour guardamos valores reales, no "OTRO")
    // ==========================
    const tourForText = tour
      ? {
          ...tour,
          tipo_guia: resolveOtro(tour.tipo_guia, tour.tipo_guia_otro),
          idioma: resolveOtro(tour.idioma, tour.idioma_otro),
          tipo_guia_otro: null,
          idioma_otro: null,
        }
      : null;

    const payloadForText = {
      privado: !!privado,
      descripcion: descTrim || null,
      link_reserva: link_reserva ? normalizeCatalogValue(link_reserva) : null,
      tiempo_servicio: tiempo_servicio ? normalizeCatalogValue(tiempo_servicio) : null,
      alojamiento: alojamiento || null,
      boleto_entrada: boleto_entrada || null,
      vuelo: vuelo || null,
      tren: tren || null,
      traslado: traslado || null,
      tour: tourForText,
    };

    let nombreAuto = buildNombreWtravel(payloadForText);

    // fallback fuerte (nunca guardar vacío)
    if (!normalizeCatalogValue(nombreAuto)) {
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
        normalizeCatalogValue(nombreAuto),
        tiempo_servicio ? normalizeCatalogValue(tiempo_servicio) : null,
        privado ? 1 : 0,
        descTrim || null,
        link_reserva ? normalizeCatalogValue(link_reserva) : null,
      ]
    );

    const id_servicio = ins.insertId;

    // ==========================
    // Inserts 1:1 (detalles)
    // ==========================

    // ===== ALOJAMIENTO =====
    if (alojamiento) {
      const regimen = alojamiento.regimen ?? null;
      const regimen_otro = normalizeCatalogValue(alojamiento.regimen_otro) || null;

      const categoria_hotel = alojamiento.categoria_hotel ?? null;
      const categoria_hotel_otro = normalizeCatalogValue(alojamiento.categoria_hotel_otro) || null;

      const categoria_hab = alojamiento.categoria_hab ?? null;
      const categoria_hab_otro = normalizeCatalogValue(alojamiento.categoria_hab_otro) || null;

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
      const tipo_entrada = normalizeCatalogValue(boleto_entrada.tipo_entrada) || null;
      const tipo_entrada_otro = normalizeCatalogValue(boleto_entrada.tipo_entrada_otro) || null;

      const tipo_guia = normalizeCatalogValue(boleto_entrada.tipo_guia) || null;
      const idioma = normalizeCatalogValue(boleto_entrada.idioma) || null;

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
          normalizeCatalogValue(boleto_entrada.boleto_entrada) || null,
          tipo_entrada,
          tipo_entrada === "OTRA" ? tipo_entrada_otro : null,
          boleto_entrada.audioguia ? 1 : 0,
          tipo_guia,
          idioma,
        ]
      );

      if (tipo_entrada === "OTRA" && tipo_entrada_otro) await upsertCatalogo(conn, "boleto_tipo_entrada_otro", tipo_entrada_otro);
      if (idioma) await upsertCatalogo(conn, "idiomas", idioma);

      if (tipo_guia && !["guia", "audioguia", "ninguno"].includes(tipo_guia.toLowerCase())) {
        await upsertCatalogo(conn, "boleto_tipo_guia_otro", tipo_guia);
      }

      // lugar
      if (boleto_entrada.boleto_entrada) await upsertCatalogo(conn, "boleto_lugar", boleto_entrada.boleto_entrada);
    }

    // ===== VUELO =====
    if (vuelo) {
      await insertDynamicOneToOne(conn, "vuelo", id_servicio, {
        origen: normalizeCatalogValue(vuelo.origen),
        destino: normalizeCatalogValue(vuelo.destino),
        escalas: vuelo.escalas ?? 0,
        clase: normalizeCatalogValue(vuelo.clase) || null,
        equipaje: normalizeCatalogValue(vuelo.equipaje) || null,
      });

      if (vuelo.origen) await upsertCatalogo(conn, "vuelo_origen", vuelo.origen);
      if (vuelo.destino) await upsertCatalogo(conn, "vuelo_destino", vuelo.destino);
      if (vuelo.clase) await upsertCatalogo(conn, "vuelo_clase", vuelo.clase);
      if (vuelo.equipaje) await upsertCatalogo(conn, "vuelo_equipaje", vuelo.equipaje);
    }

    // ===== TREN =====
    if (tren) {
      const sillas = String(tren.sillas_reservadas) === "1" || tren.sillas_reservadas === true ? 1 : 0;

      await insertDynamicOneToOne(conn, "tren", id_servicio, {
        origen: normalizeCatalogValue(tren.origen),
        destino: normalizeCatalogValue(tren.destino),
        escalas: tren.escalas ?? 0,
        clase: normalizeCatalogValue(tren.clase) || null,
        equipaje: tren.equipaje != null ? normalizeCatalogValue(tren.equipaje) : null,
        sillas_reservadas: sillas,
      });

      if (tren.origen) await upsertCatalogo(conn, "tren_origen", tren.origen);
      if (tren.destino) await upsertCatalogo(conn, "tren_destino", tren.destino);
      if (tren.clase) await upsertCatalogo(conn, "tren_clase", tren.clase);
      if (tren.equipaje) await upsertCatalogo(conn, "tren_equipaje", tren.equipaje);
    }

    // ===== TRASLADO =====
    if (traslado) {
      const trPayload = {
        ...traslado,
        origen: normalizeCatalogValue(traslado.origen) || null,
        destino: normalizeCatalogValue(traslado.destino) || null,
        tipo_traslado_otro: normalizeCatalogValue(traslado.tipo_traslado_otro) || null,
        vehiculo_otro: normalizeCatalogValue(traslado.vehiculo_otro) || null,
        nota: traslado.nota ? normalizeCatalogValue(traslado.nota) : null,
      };

      await insertDynamicOneToOne(conn, "traslado", id_servicio, trPayload);

      if (traslado.tipo_traslado === "OTRO" && trPayload.tipo_traslado_otro) {
        await upsertCatalogo(conn, "traslado_tipo_otro", trPayload.tipo_traslado_otro);
      }
      if (traslado.vehiculo === "OTRO" && trPayload.vehiculo_otro) {
        await upsertCatalogo(conn, "traslado_vehiculo_otro", trPayload.vehiculo_otro);
      }
      if (trPayload.origen) await upsertCatalogo(conn, "traslado_origen", trPayload.origen);
      if (trPayload.destino) await upsertCatalogo(conn, "traslado_destino", trPayload.destino);
    }

    // ===== TOUR =====
    if (tour) {
      const tipo_guia_real = resolveOtro(tour.tipo_guia, tour.tipo_guia_otro);
      const idioma_real = resolveOtro(tour.idioma, tour.idioma_otro);

      await insertDynamicOneToOne(conn, "tour", id_servicio, {
        ...tour,
        tipo_guia: tipo_guia_real,
        tipo_guia_otro: null,
        idioma: idioma_real,
        idioma_otro: null,
      });

      if (tipo_guia_real) await upsertCatalogo(conn, "tour_tipo_guia", tipo_guia_real);
      if (idioma_real) await upsertCatalogo(conn, "idiomas", idioma_real);
    }

    await conn.commit();

    return res.status(201).json({
      ok: true,
      id_servicio,
      nombre_wtravel: normalizeCatalogValue(nombreAuto),
      servicio_texto: normalizeCatalogValue(nombreAuto),
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

    return next(e);

  } finally {
    try { if (conn) conn.release(); } catch {}
  }
});

/* =========================================================
   GET /api/servicios
   ✅ servicio_texto = nombre_wtravel
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
        ct.id     AS id_continente

      FROM servicio s
      JOIN tiposervicio ts ON s.id_tipo = ts.id
      JOIN ciudad      c  ON s.id_ciudad = c.id
      JOIN pais        pa ON c.id_pais = pa.id
      JOIN continente  ct ON pa.id_continente = ct.id

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

router.get("/servicios/:id", requireNumericIdParam, async (req, res) => {
  let conn;
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, mensaje: "ID inválido." });
    }

    conn = await pool.getConnection();

    const [[srv]] = await conn.execute(
      `
      SELECT
        s.id,
        s.id_tipo,
        s.id_proveedor,
        s.id_ciudad,
        s.nombre_wtravel,
        s.tiempo_servicio,
        s.privado,
        s.descripcion,
        s.link_reserva,
        ts.nombre AS tipo,
        c.nombre  AS ciudad,
        pa.id     AS id_pais,
        ct.id     AS id_continente
      FROM servicio s
      JOIN tiposervicio ts ON s.id_tipo = ts.id
      JOIN ciudad c        ON s.id_ciudad = c.id
      JOIN pais pa         ON c.id_pais = pa.id
      JOIN continente ct   ON pa.id_continente = ct.id
      WHERE s.id = ?
      `,
      [id]
    );

    if (!srv) {
      return res.status(404).json({ ok: false, mensaje: "Servicio no encontrado." });
    }

    const [[aloj]] = await conn.execute(`SELECT * FROM alojamiento WHERE id_servicio = ?`, [id]);
    const [[bole]] = await conn.execute(`SELECT * FROM boleto_entrada WHERE id_servicio = ?`, [id]);
    const [[vue]]  = await conn.execute(`SELECT * FROM vuelo WHERE id_servicio = ?`, [id]);
    const [[tre]]  = await conn.execute(`SELECT * FROM tren WHERE id_servicio = ?`, [id]);
    const [[tra]]  = await conn.execute(`SELECT * FROM traslado WHERE id_servicio = ?`, [id]);
    const [[tou]]  = await conn.execute(`SELECT * FROM tour WHERE id_servicio = ?`, [id]);

    return res.json({
      ok: true,
      servicio: {
        ...srv,
        servicio_texto: srv.nombre_wtravel || `Servicio #${srv.id}`,
      },
      detalles: {
        alojamiento: aloj || null,
        boleto_entrada: bole || null,
        vuelo: vue || null,
        tren: tre || null,
        traslado: tra || null,
        tour: tou || null,
      },
    });
  } catch (e) {
    console.error("GET /servicios/:id", e);
    return res.status(500).json({ ok: false, mensaje: "Error leyendo servicio", error: e.message });
  } finally {
    try { if (conn) conn.release(); } catch {}
  }
});

router.put("/servicios/:id", requireNumericIdParam, async (req, res) => {
  let conn;
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, mensaje: "ID inválido." });
    }

    const body = req.body || {};
    const {
      nombre_wtravel,
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
    } = body;

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [upd] = await conn.execute(
      `
      UPDATE servicio
      SET
        nombre_wtravel = COALESCE(?, nombre_wtravel),
        tiempo_servicio = COALESCE(?, tiempo_servicio),
        privado = COALESCE(?, privado),
        descripcion = COALESCE(?, descripcion),
        link_reserva = COALESCE(?, link_reserva)
      WHERE id = ?
      `,
      [
        nombre_wtravel != null ? normalizeCatalogValue(nombre_wtravel) : null,
        tiempo_servicio != null ? toTime(tiempo_servicio) : null,
        privado === undefined ? null : (privado ? 1 : 0),
        descripcion != null ? String(descripcion).trim() : null,
        link_reserva != null ? String(link_reserva).trim() : null,
        id,
      ]
    );

    if (upd.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ ok: false, mensaje: "Servicio no encontrado." });
    }

    // Upserts 1:1 (solo si vienen en el body)
    if (alojamiento)     await upsertDynamicOneToOne(conn, "alojamiento", id, alojamiento);
    if (boleto_entrada)  await upsertDynamicOneToOne(conn, "boleto_entrada", id, boleto_entrada);
    if (vuelo)           await upsertDynamicOneToOne(conn, "vuelo", id, vuelo);
    if (tren)            await upsertDynamicOneToOne(conn, "tren", id, tren);
    if (traslado)        await upsertDynamicOneToOne(conn, "traslado", id, traslado);
    if (tour)            await upsertDynamicOneToOne(conn, "tour", id, tour);

    await conn.commit();
    return res.json({ ok: true, mensaje: "Servicio actualizado", id_servicio: id });
  } catch (e) {
    try { if (conn) await conn.rollback(); } catch {}
    console.error("PUT /servicios/:id", e);
    return res.status(500).json({ ok: false, mensaje: "Error actualizando servicio", error: e.message });
  } finally {
    try { if (conn) conn.release(); } catch {}
  }
});


module.exports = router;
