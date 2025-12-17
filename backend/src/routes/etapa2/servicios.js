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

async function tableHasColumn(conn, tableName, column) {
  const cols = await getTableColumns(conn, tableName);
  return cols.includes(column);
}

// =======================
// Helpers de formato (servicio_texto)
// =======================
function textoEscalas(escalas) {
  const n = Number(escalas);
  if (!Number.isFinite(n) || n <= 0) return "directo";
  return n === 1 ? "1 escala" : `${n} escalas`;
}

function pickOtro(enumVal, otroVal) {
  if (!enumVal) return null;
  if (String(enumVal).toUpperCase() === "OTRO") return otroVal || null;
  return enumVal;
}

function toPrivadoTexto(privado) {
  return privado ? "privado" : "compartido";
}

function toGrupoTexto(privado) {
  return privado ? "privado" : "en grupo";
}

// ===== Pretty helpers (texto lindo) =====
function capSentence(s) {
  s = String(s || "").trim().toLowerCase();
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function prettyCategoriaHotel(code) {
  const c = String(code || "").toUpperCase();
  const map = {
    H3_ECONOMICO: "hotel 3 estrellas económico",
    H3_SUPERIOR: "hotel 3 estrellas superior",
    H4_ECONOMICO: "hotel 4 estrellas económico",
    H4_SUPERIOR: "hotel 4 estrellas superior",
    H5_ECONOMICO: "hotel 5 estrellas económico",
    H5_SUPERIOR: "hotel 5 estrellas superior",
    LUJO_ECONOMICO: "hotel lujo económico",
    LUJO_SUPERIOR: "hotel lujo superior",
  };
  return map[c] || capSentence(c.replaceAll("_", " "));
}

function prettyCategoriaHab(code) {
  const c = String(code || "").toUpperCase();
  const map = {
    ESTANDAR: "habitación estándar",
    STANDARD: "habitación estándar",
    SUPERIOR: "habitación superior",
    SUITE: "habitación suite",
  };
  // si viene algo raro, lo intenta “humanizar”
  return map[c] || ("habitación " + capSentence(c.replaceAll("_", " ")));
}

function prettyRegimen(code) {
  const c = String(code || "").toUpperCase();
  const map = {
    ALOJAMIENTO_DESAYUNO: "desayuno diario",
    SOLO_ALOJAMIENTO: "solo alojamiento",
    MEDIA_PENSION: "media pensión",
    PENSION_COMPLETA: "pensión completa",
    TODO_INCLUIDO: "todo incluido",
  };
  return map[c] || capSentence(c.replaceAll("_", " "));
}

function nochesTxt(n) {
  const x = Number(n || 0);
  if (!Number.isFinite(x) || x <= 0) return "";
  return x === 1 ? "1 noche" : `${x} noches`;
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
      tour,
    } = req.body || {};

    if (!id_tipo || !id_proveedor || !id_ciudad || !nombre_wtravel) {
      return res.status(400).json({
        ok: false,
        mensaje:
          "Faltan campos obligatorios: id_tipo, id_proveedor, id_ciudad, nombre_wtravel.",
      });
    }

    // Detectar nombre del tipo para validar mínimos según formato
    const [[tipoRow]] = await conn.execute(`SELECT nombre FROM tiposervicio WHERE id = ?`, [
      Number(id_tipo),
    ]);
    const tipoNombre = (tipoRow?.nombre || "").toLowerCase();
    const descTrim = String(descripcion || "").trim();

    // =========================
    // Validaciones por tipo (mínimos obligatorios)
    // =========================

    // VUELO: escalas, origen, destino, clase, equipaje
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
          mensaje:
            "Para VUELO son obligatorios: escalas, origen, destino, clase y equipaje.",
        });
      }
    }

    // TREN: escalas, origen, destino, clase, sillas_reservadas
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
          mensaje:
            "Para TREN son obligatorios: escalas, origen, destino, clase y sillas_reservadas.",
        });
      }
    }

    // ALOJAMIENTO: noches, categoria_hab, regimen
    if (tipoNombre.includes("aloj")) {
      const a = alojamiento || {};
      const noches = Number(a.noches);
      const regimen = String(a.regimen || "").trim();
      const catHab = String(a.categoria_hab || "").trim();

      if (!Number.isFinite(noches) || noches <= 0 || !regimen || !catHab) {
        return res.status(400).json({
          ok: false,
          mensaje:
            "Para ALOJAMIENTO son obligatorios: noches, categoría de habitación y régimen.",
        });
      }

      if (regimen === "OTRO" && !String(a.regimen_otro || "").trim()) {
        return res
          .status(400)
          .json({ ok: false, mensaje: "Régimen OTRO requiere especificar regimen_otro." });
      }
      if (catHab === "OTRO" && !String(a.categoria_hab_otro || "").trim()) {
        return res.status(400).json({
          ok: false,
          mensaje: "Categoría habitación OTRO requiere categoria_hab_otro.",
        });
      }
    }

    // TRASLADO: origen, destino (y usa servicio.privado)
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

    // TOUR / VISITA / EXCURSIÓN: descripcion + tipo_guia + idioma
    if (tipoNombre.includes("excurs") || tipoNombre.includes("visita") || tipoNombre.includes("tour")) {
      const tu = tour || {};

      if (!descTrim) {
        return res.status(400).json({
          ok: false,
          mensaje: "Para VISITA/EXCURSIÓN es obligatoria la descripción del servicio.",
        });
      }

      const tipoGuia = String(tu.tipo_guia || "").trim();
      const tipoGuiaOtro = String(tu.tipo_guia_otro || "").trim();

      const idioma = String(tu.idioma || "").trim();
      const idiomaOtro = String(tu.idioma_otro || "").trim();

      if (!tipoGuia) {
        return res
          .status(400)
          .json({ ok: false, mensaje: "Para VISITA/EXCURSIÓN falta tipo_guia." });
      }
      if (!idioma) {
        return res
          .status(400)
          .json({ ok: false, mensaje: "Para VISITA/EXCURSIÓN falta idioma." });
      }
      if (tipoGuia === "OTRO" && !tipoGuiaOtro) {
        return res.status(400).json({
          ok: false,
          mensaje: "tipo_guia OTRO requiere especificar tipo_guia_otro.",
        });
      }
      if (idioma === "OTRO" && !idiomaOtro) {
        return res
          .status(400)
          .json({ ok: false, mensaje: "idioma OTRO requiere especificar idioma_otro." });
      }
    }

    // BOLETO: descripcion + lugar + tipo_entrada + idioma
    if (tipoNombre.includes("boleto")) {
      const be = boleto_entrada || {};
      if (!descTrim) {
        return res.status(400).json({
          ok: false,
          mensaje: "Para BOLETO es obligatoria la descripción del servicio.",
        });
      }

      const lugar = String(be.boleto_entrada || "").trim();
      const tipoEntrada = String(be.tipo_entrada || "").trim();
      const idioma = String(be.idioma || "").trim();

      if (!lugar || !tipoEntrada || !idioma) {
        return res.status(400).json({
          ok: false,
          mensaje: "Para BOLETO son obligatorios: lugar, tipo_entrada e idioma.",
        });
      }

      if (tipoEntrada === "OTRA" && !String(be.tipo_entrada_otro || "").trim()) {
        return res.status(400).json({
          ok: false,
          mensaje: "Tipo de entrada OTRA requiere especificar tipo_entrada_otro.",
        });
      }
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
        descTrim || null,
        link_reserva ? String(link_reserva).trim() : null,
      ]
    );

    const id_servicio = ins.insertId;

    // 2) Subtablas (1:1)

    // ===== ALOJAMIENTO =====
    if (alojamiento) {
      const regimen = alojamiento.regimen ?? null;
      const regimen_otro = String(alojamiento.regimen_otro || "").trim() || null;

      const categoria_hotel = alojamiento.categoria_hotel ?? null;
      const categoria_hotel_otro =
        String(alojamiento.categoria_hotel_otro || "").trim() || null;

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

    // ===== BOLETO =====
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
          tipo_entrada === "OTRA" ? tipo_entrada_otro : null,
          boleto_entrada.audioguia ? 1 : 0,
          boleto_entrada.idioma || null,
        ]
      );

      if (tipo_entrada === "OTRA" && tipo_entrada_otro) {
        await upsertCatalogo(conn, "boleto_tipo_entrada_otro", tipo_entrada_otro);
      }
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
    }

    // ===== TREN =====
    if (tren) {
      await insertDynamicOneToOne(conn, "tren", id_servicio, {
        origen: String(tren.origen || "").trim(),
        destino: String(tren.destino || "").trim(),
        escalas: tren.escalas ?? 0,
        clase: String(tren.clase || "").trim(),
        // si existe en tu tabla lo guarda, si no, lo ignora
        equipaje: tren.equipaje ? String(tren.equipaje).trim() : null,
        sillas_reservadas: tren.sillas_reservadas ? 1 : 0,
      });
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
    }

    // ===== TOUR =====
    if (tour) {
      const tipoGuiaRaw = String(tour.tipo_guia || "").trim();
      const tipoGuiaOtro = String(tour.tipo_guia_otro || "").trim();
      const idiomaRaw = String(tour.idioma || "").trim();
      const idiomaOtro = String(tour.idioma_otro || "").trim();

      // Normalizar OTRO -> texto final guardable en la misma columna
      const tipo_guia = tipoGuiaRaw === "OTRO" ? tipoGuiaOtro : tipoGuiaRaw;
      const idioma = idiomaRaw === "OTRO" ? idiomaOtro : idiomaRaw;

      await insertDynamicOneToOne(conn, "tour", id_servicio, {
        tipo_guia,
        idioma,
      });

      // (Opcional) Guardar "otros" en catálogo para que el select aprenda
      if (tipoGuiaRaw === "OTRO" && tipoGuiaOtro) {
        await upsertCatalogo(conn, "tour_tipo_guia_otro", tipoGuiaOtro);
      }
      if (idiomaRaw === "OTRO" && idiomaOtro) {
        await upsertCatalogo(conn, "tour_idioma_otro", idiomaOtro);
      }
    }

    await conn.commit();

    return res.status(201).json({
      ok: true,
      id_servicio,
      mensaje: "Servicio creado",
    });
  } catch (e) {
    try {
      if (conn) await conn.rollback();
    } catch {}
    console.error("POST /servicios", e);
    return res.status(500).json({
      ok: false,
      mensaje: "Error creando servicio",
      error: e.message,
    });
  } finally {
    try {
      if (conn) conn.release();
    } catch {}
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
        if (!hora) {
          errorCount++;
          continue;
        }
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
   ✅ ahora incluye categoria_hotel + servicio_texto lindo
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

        -- alojamiento (✅ agregar categoria_hotel)
        a.noches             AS aloj_noches,
        a.regimen            AS aloj_regimen,
        a.regimen_otro       AS aloj_regimen_otro,
        a.categoria_hotel    AS aloj_categoria_hotel,
        a.categoria_hotel_otro AS aloj_categoria_hotel_otro,
        a.categoria_hab      AS aloj_categoria_hab,
        a.categoria_hab_otro AS aloj_categoria_hab_otro,

        -- boleto
        be.boleto_entrada    AS be_lugar,
        be.tipo_entrada      AS be_tipo,
        be.tipo_entrada_otro AS be_tipo_otro,
        be.audioguia         AS be_audioguia,
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

    function buildServicioTexto(s) {
      const tipo = (s.tipo || "").toLowerCase();

      // ✅ ALOJAMIENTO: "3 noches, hotel 4 estrellas económico, habitación estándar, desayuno diario"
      if (tipo.includes("aloj")) {
        const noches = s.aloj_noches;

        const catHotel = pickOtro(s.aloj_categoria_hotel, s.aloj_categoria_hotel_otro);
        const catHab = pickOtro(s.aloj_categoria_hab, s.aloj_categoria_hab_otro);
        const regimen = pickOtro(s.aloj_regimen, s.aloj_regimen_otro);

        const partes = [
          nochesTxt(noches),
          catHotel ? prettyCategoriaHotel(catHotel) : null,
          catHab ? prettyCategoriaHab(catHab) : null,
          regimen ? prettyRegimen(regimen) : null,
        ].filter(Boolean);

        if (partes.length) return partes.join(", ");
      }

      // TRASLADO: "Traslado <privado/compartido> <origen> – <destino>"
      if (tipo.includes("trasl") && (s.traslado_origen || s.traslado_destino)) {
        const privTxt = toPrivadoTexto(!!s.privado);
        return `Traslado ${privTxt} ${s.traslado_origen || "origen"} – ${
          s.traslado_destino || "destino"
        }`;
      }

      // VISITA/EXCURSIÓN: "<descripcion>, <privado/en grupo>, <tiempo_servicio>, <tipo_guia> en <idioma>"
      if (tipo.includes("excurs") || tipo.includes("visita") || tipo.includes("tour")) {
        const desc =
          String(s.descripcion || "").trim() || (s.nombre_wtravel || `Servicio #${s.id}`);
        const grupoTxt = toGrupoTexto(!!s.privado);

        const tiempoTxt = String(s.tiempo_servicio || "").trim();
        const tipoGuia = String(s.tour_tipo_guia || "").trim();
        const idioma = String(s.tour_idioma || "").trim();

        const partes = [
          desc,
          grupoTxt,
          tiempoTxt,
          tipoGuia && idioma ? `${tipoGuia} en ${idioma}` : tipoGuia || idioma || "",
        ].filter(Boolean);

        return partes.join(", ");
      }

      // BOLETO: "<descripcion>, <tipo_entrada>, <tipo_guia> en <idioma>"
      if (tipo.includes("boleto") && (s.be_tipo || s.be_lugar || s.be_idioma)) {
        const desc = String(s.descripcion || "").trim() || "Entrada";
        const tipoEntrada = s.be_tipo === "OTRA" && s.be_tipo_otro ? s.be_tipo_otro : s.be_tipo;
        const tipoGuia =
          s.be_audioguia != null && Number(s.be_audioguia) === 1 ? "audioguía" : "guía";
        const idioma = s.be_idioma || "idioma";
        return `${desc}, ${tipoEntrada || "tipo de entrada"}, ${tipoGuia} en ${idioma}`;
      }

      // TREN: "Tren <escalas> <origen> – <destino>, clase X, sillas reservadas/sin sillas reservadas"
      if (tipo.includes("tren") && (s.tren_origen || s.tren_destino)) {
        const esc = textoEscalas(s.tren_escalas);
        const base = `Tren ${esc} ${s.tren_origen || "origen"} – ${s.tren_destino || "destino"}`;
        const clase = s.tren_clase ? `, clase ${s.tren_clase}` : "";
        let sillas = "";
        if (s.tren_sillas_reservadas != null) {
          sillas = s.tren_sillas_reservadas ? ", sillas reservadas" : ", sin sillas reservadas";
        }
        return `${base}${clase}${sillas}`;
      }

      // VUELO: "Vuelo <escalas> <origen> – <destino>, clase X, equipaje Y"
      if (tipo.includes("vuelo") && (s.vuelo_origen || s.vuelo_destino)) {
        const esc = textoEscalas(s.vuelo_escalas);
        const base = `Vuelo ${esc} ${s.vuelo_origen || "origen"} – ${
          s.vuelo_destino || "destino"
        }`;
        const clase = s.vuelo_clase ? `, clase ${s.vuelo_clase}` : "";
        const equipaje = s.vuelo_equipaje ? `, equipaje ${s.vuelo_equipaje}` : "";
        return `${base}${clase}${equipaje}`;
      }

      return s.nombre_wtravel || `Servicio #${s.id}`;
    }

    const rowsFinal = rows.map((r) => ({
      ...r,
      servicio_texto: buildServicioTexto(r),
    }));

    // ✅ devolver consistente
    return res.json({ ok: true, servicios: rowsFinal });
  } catch (e) {
    console.error("GET /servicios", e);
    return res.status(500).json({
      ok: false,
      mensaje: "Error listando servicios",
      error: e.message,
    });
  } finally {
    try {
      if (conn) conn.release();
    } catch {}
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
    try {
      if (conn) conn.release();
    } catch {}
  }
});

/* =========================================================
   PUT /api/servicio/:id
========================================================= */
router.put("/servicio/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { id_tipo, id_proveedor, id_ciudad, nombre_wtravel, tiempo_servicio, privado, descripcion, link_reserva } =
      req.body || {};

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
        id,
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
      await conn.execute("INSERT INTO serviciohora (id_servicio, hora) VALUES (?, ?)", [
        id_servicio,
        toTime(h),
      ]);
    }

    await conn.commit();
    res.json({ ok: true, mensaje: "Horas actualizadas", count: horas.length });
  } catch (e) {
    try {
      if (conn) await conn.rollback();
    } catch {}
    console.error("PUT /servicios/:id/horas", e);
    res.status(500).json({ ok: false, mensaje: "Error actualizando horas", error: e.message });
  } finally {
    try {
      if (conn) conn.release();
    } catch {}
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
   Devuelve lista de meses con precio (solo los que existan)
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
   Body: { precios: [ {mes:1..12, precio_usd:number|null}, ... ] }
   Batch upsert (12 meses de una, sin 12 requests)
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

    // Normaliza por mes (por si llega repetido)
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
        // redondeo a 2 decimales para que quede perfecto con DECIMAL(10,2)
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

    // Upsert en batch
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