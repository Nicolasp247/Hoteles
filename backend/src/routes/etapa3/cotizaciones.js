// backend/src/routes/etapa3/cotizaciones.js
const express = require("express");
const router = express.Router();
const db = require("../../db"); // pool mysql2/promise

// =======================
// Helpers
// =======================
function intOrZero(value) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? 0 : n;
}

function generarNombreCotizacion(fechaViaje, agente, nombrePasajero, totalPasajeros) {
  const [yearStr, monthStr] = String(fechaViaje).split("-");
  const yy = yearStr.slice(-2);
  const mm = String(monthStr || "").padStart(2, "0");
  const sufijo = totalPasajeros === 1 ? "persona" : "personas";
  return `${yy}${mm} ${agente} ${nombrePasajero} ${totalPasajeros} ${sufijo}`;
}

function esTipoAlojamiento(nombreTipo) {
  return (nombreTipo || "").toLowerCase().includes("aloj");
}

function esTipoSinPrecio(nombreTipo) {
  const t = (nombreTipo || "").toLowerCase();
  return t.includes("vuelo") || t.includes("tren");
}

// Texto “Directo / X escala(s)”
function textoEscalas(escalas) {
  const n = Number(escalas);
  if (!Number.isFinite(n) || n <= 0) return "directo";
  return n === 1 ? "1 escala" : `${n} escalas`;
}

function buildTextoVuelo(row) {
  if (!row.vuelo_origen && !row.vuelo_destino) return null;
  const base = `Vuelo ${textoEscalas(row.vuelo_escalas)} de ${row.vuelo_origen} a ${row.vuelo_destino}`;
  const clase = row.vuelo_clase ? `, clase ${row.vuelo_clase}` : "";
  const equipaje = row.vuelo_equipaje ? `, equipaje ${row.vuelo_equipaje}` : "";
  return `${base}${clase}${equipaje}`;
}

function buildTextoTren(row) {
  if (!row.tren_origen && !row.tren_destino) return null;

  const base = `Tren ${textoEscalas(row.tren_escalas)} de ${row.tren_origen} a ${row.tren_destino}`;
  const clase = row.tren_clase ? `, clase ${row.tren_clase}` : "";

  let sillas = "";
  if (row.tren_sillas_reservadas != null) {
    sillas = row.tren_sillas_reservadas ? `, asientos reservados` : `, sin asientos reservados`;
  }

  return `${base}${clase}${sillas}`;
}

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
  };
  return map[c] || capSentence(c.replaceAll("_", " "));
}

function prettyCategoriaHab(code) {
  const c = String(code || "").toUpperCase();
  const map = {
    ESTANDAR: "habitación estándar",
    STANDARD: "habitación estándar",
    SUITE: "habitación suite",
  };
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

// Construye servicio_texto final (con prefijos + subtipos)
function buildServicioTexto(row) {
  const tipo = row.tipo_servicio || "";

  const textoVuelo = buildTextoVuelo(row);
  const textoTren = buildTextoTren(row);

  // ALOJAMIENTO: formateo especial
  if (esTipoAlojamiento(tipo)) {
    const partes = [
      nochesTxt(row.noches_alojamiento),
      prettyCategoriaHotel(row.categoria_hotel),
      prettyCategoriaHab(row.categoria_hab),
      prettyRegimen(row.regimen_alojamiento),
    ].filter(Boolean);

    let base = partes.join(", ");
    if (row.es_opcional) base = `Opcional: ${base}`;
    return base;
  }

  // Otros tipos
  let base = row.titulo_override || textoVuelo || textoTren || row.nombre_servicio || "";

  if (row.es_opcional) base = `Opcional: ${base}`;
  return base;
}

// =======================
// Rutas
// =======================

router.post("/cotizaciones", async (req, res) => {
  try {
    const {
      agente,
      nombre_pasajero,
      adultos_65,
      adultos_19_64,
      jovenes_12_18,
      ninos_3_11,
      infantes_0_2,
      categorias,
      fecha_viaje,
      moneda_id,
      nota
    } = req.body || {};

    if (!agente || !nombre_pasajero || !fecha_viaje) {
      return res.status(400).json({
        ok: false,
        mensaje: "Faltan campos obligatorios: agente, nombre_pasajero o fecha_viaje."
      });
    }

    const adultos65 = intOrZero(adultos_65);
    const adultos1964 = intOrZero(adultos_19_64);
    const jovenes1218 = intOrZero(jovenes_12_18);
    const ninos311 = intOrZero(ninos_3_11);
    const infantes02 = intOrZero(infantes_0_2);

    const total_pasajeros = adultos65 + adultos1964 + jovenes1218 + ninos311 + infantes02;

    if (total_pasajeros <= 0) {
      return res.status(400).json({
        ok: false,
        mensaje: "Debe haber al menos 1 pasajero en la cotización."
      });
    }

    const nombre_cotizacion = generarNombreCotizacion(
      fecha_viaje,
      agente,
      nombre_pasajero,
      total_pasajeros
    );

    const sql = `
      INSERT INTO cotizacion (
        agente,
        nombre_pasajero,
        adultos_65,
        adultos_19_64,
        jovenes_12_18,
        ninos_3_11,
        infantes_0_2,
        total_pasajeros,
        categorias,
        fecha_viaje,
        nombre_cotizacion,
        moneda_id,
        nota
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      agente,
      nombre_pasajero,
      adultos65,
      adultos1964,
      jovenes1218,
      ninos311,
      infantes02,
      total_pasajeros,
      categorias || null,
      fecha_viaje,
      nombre_cotizacion,
      moneda_id || null,
      nota || null
    ];

    const [result] = await db.execute(sql, params);

    return res.status(201).json({
      ok: true,
      id_cotizacion: result.insertId,
      nombre_cotizacion,
      mensaje: "Cotización creada correctamente."
    });

  } catch (error) {
    console.error("Error al crear cotización:", error);

    if (error && error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        ok: false,
        mensaje:
          "Ya existe una cotización con el mismo nombre. " +
          "Revisa los datos de fecha, agente, pasajero y número de personas."
      });
    }

    return res.status(500).json({
      ok: false,
      mensaje: "Error interno del servidor al crear la cotización.",
      error: error.message
    });
  }
});

router.get("/cotizaciones", async (_req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT
        id_cotizacion,
        nombre_cotizacion,
        agente,
        nombre_pasajero,
        fecha_viaje,
        total_pasajeros,
        fecha_creacion
      FROM cotizacion
      ORDER BY fecha_creacion DESC, id_cotizacion DESC
    `);

    return res.json({ ok: true, cotizaciones: rows });
  } catch (error) {
    console.error("Error al listar cotizaciones:", error);
    return res.status(500).json({
      ok: false,
      mensaje: "Error interno al listar cotizaciones.",
      error: error.message
    });
  }
});

router.get("/cotizaciones/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, mensaje: "ID de cotización inválido." });
    }

    const [cabRows] = await db.execute(
      "SELECT * FROM cotizacion WHERE id_cotizacion = ?",
      [id]
    );
    if (cabRows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: "Cotización no encontrada." });
    }
    const cabecera = cabRows[0];

    // 👇 OJO: acá devolvemos precio_usd ya guardado en el item.
    // Para vuelo/tren devolvemos NULL como ya estabas haciendo.
    const [itemRowsRaw] = await db.execute(
      `
      SELECT
        ci.id_item,
        ci.id_cotizacion,
        ci.id_servicio,
        ci.fecha_servicio,
        ci.orden_dia,
        ci.es_opcional,
        ci.operador_mostrado,
        ci.link_operador,
        ci.titulo_override,
        ci.clase_override,
        ci.idioma_override,
        ci.nota_linea,
        CASE
          WHEN LOWER(ts.nombre) LIKE '%vuelo%'
            OR LOWER(ts.nombre) LIKE '%tren%'
          THEN NULL
          ELSE ci.precio_usd
        END AS precio_usd,

        s.nombre_wtravel        AS nombre_servicio,
        s.descripcion           AS descripcion_servicio,
        ts.nombre               AS tipo_servicio,
        c.nombre                AS ciudad,
        a.noches          AS noches_alojamiento,
        a.categoria_hotel AS categoria_hotel,
        a.categoria_hab   AS categoria_hab,
        a.regimen         AS regimen_alojamiento,


        v.origen   AS vuelo_origen,
        v.destino  AS vuelo_destino,
        v.escalas  AS vuelo_escalas,
        v.clase    AS vuelo_clase,
        v.equipaje AS vuelo_equipaje,

        t.origen            AS tren_origen,
        t.destino           AS tren_destino,
        t.escalas           AS tren_escalas,
        t.clase             AS tren_clase,
        t.sillas_reservadas AS tren_sillas_reservadas

      FROM cotizacion_item ci
      JOIN servicio     s  ON s.id        = ci.id_servicio
      JOIN tiposervicio ts ON ts.id       = s.id_tipo
      JOIN ciudad       c  ON c.id        = s.id_ciudad
      LEFT JOIN alojamiento a ON a.id_servicio = s.id
      LEFT JOIN vuelo v       ON v.id_servicio = s.id
      LEFT JOIN tren  t       ON t.id_servicio = s.id
      WHERE ci.id_cotizacion = ?
      ORDER BY ci.fecha_servicio ASC, ci.orden_dia ASC, ci.id_item ASC
      `,
      [id]
    );

    const items = itemRowsRaw.map(row => ({
      ...row,
      servicio_texto: buildServicioTexto(row)
    }));

    return res.json({
      ok: true,
      cotizacion: cabecera,
      cabecera,
      items
    });

  } catch (error) {
    console.error("Error al obtener cotización:", error);
    return res.status(500).json({
      ok: false,
      mensaje: "Error interno al obtener la cotización.",
      error: error.message
    });
  }
});

// =========================================================
// POST /api/cotizaciones/:id/items
// ✅ Plan A Alojamiento: autocalcular precio_usd = precio_noche_mes * noches
// =========================================================
router.post("/cotizaciones/:id/items", async (req, res) => {
  try {
    const idCotizacion = parseInt(req.params.id, 10);
    if (Number.isNaN(idCotizacion)) {
      return res.status(400).json({ ok: false, mensaje: "ID de cotización inválido." });
    }

    const {
      id_servicio,
      fecha_servicio,
      es_opcional,
      operador_mostrado,
      link_operador,
      titulo_override,
      clase_override,
      idioma_override,
      nota_linea,
      precio_usd
    } = req.body || {};

    if (!id_servicio || !fecha_servicio) {
      return res.status(400).json({
        ok: false,
        mensaje: "Faltan campos obligatorios: id_servicio y fecha_servicio."
      });
    }

    const esOpcional = es_opcional ? 1 : 0;

    // 1) Traer info del servicio + tipo + ciudad
    const [[srv]] = await db.execute(
      `
      SELECT
        s.id,
        s.id_ciudad,
        ts.nombre AS tipo_servicio
      FROM servicio s
      JOIN tiposervicio ts ON ts.id = s.id_tipo
      WHERE s.id = ?
      `,
      [id_servicio]
    );

    if (!srv) {
      return res.status(404).json({ ok: false, mensaje: "Servicio no encontrado." });
    }

    const tipoServicioNombre = srv.tipo_servicio || "";

    // 2) Normalizar precio (si viene explícito lo respetamos)
    let precioNormalizado = null;
    if (precio_usd !== undefined && precio_usd !== null && precio_usd !== "") {
      const n = Number(precio_usd);
      if (!Number.isNaN(n)) precioNormalizado = n;
    }

    // 3) ✅ Si es alojamiento y NO llegó precio_usd, lo calculamos por tabla alojamiento_precio_mes
    if (esTipoAlojamiento(tipoServicioNombre) && (precioNormalizado === null)) {
      // a) datos del alojamiento
      const [[aloj]] = await db.execute(
        `
        SELECT noches, categoria_hotel, regimen
        FROM alojamiento
        WHERE id_servicio = ?
        `,
        [id_servicio]
      );

      if (aloj) {
        const noches = Number(aloj.noches || 0);
        const categoria = aloj.categoria_hotel || null;   // ✅ esta es la que debe cruzar con alojamiento_precio_mes.categoria
        const regimen = aloj.regimen || null;

        // b) año/mes desde fecha_servicio (YYYY-MM-DD)
        const fs = String(fecha_servicio || "");
        const y = Number(fs.slice(0, 4));
        const m = Number(fs.slice(5, 7));

        // c) por ahora fijo DBL (después lo conectamos a SGL/TPL)
        const tipoHab = "DBL";

        // DEBUG útil (lo puedes dejar o quitar luego)
        console.log("[ALOJ PRECIO] lookup", {
          id_servicio,
          id_ciudad: srv.id_ciudad,
          categoria,
          regimen,
          anio: y,
          mes: m,
          tipoHab,
          noches,
        });

        if (noches > 0 && categoria && regimen && y && m) {
          const [[pm]] = await db.execute(
            `
            SELECT precio_usd
            FROM alojamiento_precio_mes
            WHERE id_ciudad = ?
              AND categoria = ?
              AND regimen = ?
              AND anio = ?
              AND mes = ?
              AND tipo_habitacion = ?
            LIMIT 1
            `,
            [srv.id_ciudad, categoria, regimen, y, m, tipoHab]
          );

          console.log("[ALOJ PRECIO] resultado", pm);

          if (pm && pm.precio_usd != null) {
            const precioNoche = Number(pm.precio_usd);
            if (Number.isFinite(precioNoche)) {
              precioNormalizado = precioNoche * noches;
            }
          }
        }
      }
    }


    // 4) Orden del día (por fecha)
    const [maxRows] = await db.execute(
      `
      SELECT COALESCE(MAX(orden_dia), 0) AS maxOrden
      FROM cotizacion_item
      WHERE id_cotizacion = ? AND fecha_servicio = ?
      `,
      [idCotizacion, fecha_servicio]
    );
    const siguienteOrden = (maxRows[0]?.maxOrden || 0) + 1;

    // 5) Insert item
    const [result] = await db.execute(
      `
      INSERT INTO cotizacion_item (
        id_cotizacion,
        id_servicio,
        fecha_servicio,
        orden_dia,
        es_opcional,
        operador_mostrado,
        link_operador,
        titulo_override,
        clase_override,
        idioma_override,
        nota_linea,
        precio_usd
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        idCotizacion,
        id_servicio,
        fecha_servicio,
        siguienteOrden,
        esOpcional,
        operador_mostrado || null,
        link_operador || null,
        titulo_override || null,
        clase_override || null,
        idioma_override || null,
        nota_linea || null,
        precioNormalizado
      ]
    );

    const idItem = result.insertId;

    // 6) devolver item armado
    const [rows] = await db.execute(
      `
      SELECT
        ci.id_item,
        ci.id_cotizacion,
        ci.id_servicio,
        ci.fecha_servicio,
        ci.orden_dia,
        ci.es_opcional,
        ci.operador_mostrado,
        ci.link_operador,
        ci.titulo_override,
        ci.clase_override,
        ci.idioma_override,
        ci.nota_linea,
        CASE
          WHEN LOWER(ts.nombre) LIKE '%vuelo%'
            OR LOWER(ts.nombre) LIKE '%tren%'
          THEN NULL
          ELSE ci.precio_usd
        END AS precio_usd,

        s.nombre_wtravel        AS nombre_servicio,
        s.descripcion           AS descripcion_servicio,
        ts.nombre               AS tipo_servicio,
        c.nombre                AS ciudad,
        a.noches                AS noches_alojamiento,
        a.categoria_hotel       AS categoria_hotel,
        a.categoria_hab         AS categoria_hab,
        a.regimen               AS regimen_alojamiento,

        v.origen   AS vuelo_origen,
        v.destino  AS vuelo_destino,
        v.escalas  AS vuelo_escalas,
        v.clase    AS vuelo_clase,
        v.equipaje AS vuelo_equipaje,

        t.origen            AS tren_origen,
        t.destino           AS tren_destino,
        t.escalas           AS tren_escalas,
        t.clase             AS tren_clase,
        t.sillas_reservadas AS tren_sillas_reservadas

      FROM cotizacion_item ci
      JOIN servicio     s  ON s.id        = ci.id_servicio
      JOIN tiposervicio ts ON ts.id       = s.id_tipo
      JOIN ciudad       c  ON c.id        = s.id_ciudad
      LEFT JOIN alojamiento a ON a.id_servicio = s.id
      LEFT JOIN vuelo v       ON v.id_servicio = s.id
      LEFT JOIN tren  t       ON t.id_servicio = s.id
      WHERE ci.id_item = ?
      `,
      [idItem]
    );

    const row = rows[0];

    return res.status(201).json({
      ok: true,
      item: {
        ...row,
        servicio_texto: buildServicioTexto(row)
      }
    });

  } catch (error) {
    console.error("Error al crear item de cotización:", error);
    return res.status(500).json({
      ok: false,
      mensaje: "Error interno al crear el item de la cotización.",
      error: error.message
    });
  }
});

// =========================================================
// PUT /api/cotizaciones/:id/items/orden
// =========================================================
router.put("/cotizaciones/:id/items/orden", async (req, res) => {
  let conn;
  try {
    const idCotizacion = Number(req.params.id);
    const orden = Array.isArray(req.body?.orden) ? req.body.orden : [];

    if (!idCotizacion) {
      return res.status(400).json({ ok: false, mensaje: "ID de cotización inválido." });
    }
    if (orden.length === 0) {
      return res.status(400).json({ ok: false, mensaje: "Payload inválido: orden[] requerido." });
    }

    const rows = orden
      .map(x => ({
        id_item: Number(x.id_item),
        orden_dia: Number(x.orden_dia),
      }))
      .filter(x => Number.isFinite(x.id_item) && x.id_item > 0 && Number.isFinite(x.orden_dia) && x.orden_dia > 0);

    if (rows.length === 0) {
      return res.status(400).json({ ok: false, mensaje: "No hay filas válidas en orden[] (id_item/orden_dia)." });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    const sql = `
      UPDATE cotizacion_item
      SET orden_dia = ?
      WHERE id_item = ?
        AND id_cotizacion = ?
    `;

    for (const r of rows) {
      const [result] = await conn.execute(sql, [r.orden_dia, r.id_item, idCotizacion]);
      if (!result.affectedRows) {
        throw new Error(`No se pudo actualizar id_item=${r.id_item} (no existe o no pertenece a la cotización ${idCotizacion}).`);
      }
    }

    await conn.commit();
    return res.json({ ok: true, mensaje: "Orden actualizado", count: rows.length });

  } catch (error) {
    try { if (conn) await conn.rollback(); } catch {}
    console.error("PUT /cotizaciones/:id/items/orden", error);
    return res.status(500).json({
      ok: false,
      mensaje: "Error guardando el orden.",
      error: error.message
    });
  } finally {
    try { if (conn) conn.release(); } catch {}
  }
});

router.delete("/cotizaciones/items/:id_item", async (req, res) => {
  try {
    const idItem = Number(req.params.id_item);
    if (!idItem) {
      return res.status(400).json({ ok: false, mensaje: "id_item inválido" });
    }

    const [result] = await db.execute(
      "DELETE FROM cotizacion_item WHERE id_item = ?",
      [idItem]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ ok: false, mensaje: "Item no encontrado" });
    }

    res.json({ ok: true, mensaje: "Item eliminado" });
  } catch (error) {
    console.error("DELETE /cotizaciones/items/:id_item", error);
    res.status(500).json({
      ok: false,
      mensaje: "Error interno al eliminar el item.",
      error: error.message
    });
  }
});

module.exports = router;

