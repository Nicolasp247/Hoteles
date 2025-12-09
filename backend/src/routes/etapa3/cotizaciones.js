// backend/src/routes/etapa3/cotizaciones.js
const express = require("express");
const router = express.Router();
const db = require("../../db"); // pool mysql2/promise

// =======================
// Helpers
// =======================

// Convierte a entero o 0 si viene vacío / null
function intOrZero(value) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? 0 : n;
}

// Genera el nombre automático de la cotización
// Formato: <YY><MM> <Agente> <Nombre pasajero> <N personas>
function generarNombreCotizacion(fechaViaje, agente, nombrePasajero, totalPasajeros) {
  // fechaViaje se espera en formato 'YYYY-MM-DD'
  const [yearStr, monthStr] = fechaViaje.split("-"); // ["2026","02","15"...]
  const yy = yearStr.slice(-2);                      // "26"
  const mm = monthStr.padStart(2, "0");              // "02"

  const sufijo = totalPasajeros === 1 ? "persona" : "personas";
  return `${yy}${mm} ${agente} ${nombrePasajero} ${totalPasajeros} ${sufijo}`;
}

// Helper para saber si un tipo es alojamiento según el texto
function esTipoAlojamiento(nombreTipo) {
  return (nombreTipo || "").toLowerCase().includes("aloj");
}

// Helper para saber si un tipo no lleva precio (vuelo / tren)
function esTipoSinPrecio(nombreTipo) {
  const t = (nombreTipo || "").toLowerCase();
  return t.includes("vuelo") || t.includes("tren");
}

// =======================
// Rutas
// =======================

/**
 * POST /api/cotizaciones
 * Crea la cabecera de una cotización.
 */
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
      fecha_viaje,   // "YYYY-MM-DD"
      moneda_id,
      nota
    } = req.body || {};

    // Validaciones básicas
    if (!agente || !nombre_pasajero || !fecha_viaje) {
      return res.status(400).json({
        ok: false,
        mensaje: "Faltan campos obligatorios: agente, nombre_pasajero o fecha_viaje."
      });
    }

    // Pasajeros
    const adultos65   = intOrZero(adultos_65);
    const adultos1964 = intOrZero(adultos_19_64);
    const jovenes1218 = intOrZero(jovenes_12_18);
    const ninos311    = intOrZero(ninos_3_11);
    const infantes02  = intOrZero(infantes_0_2);

    const total_pasajeros =
      adultos65 + adultos1964 + jovenes1218 + ninos311 + infantes02;

    if (total_pasajeros <= 0) {
      return res.status(400).json({
        ok: false,
        mensaje: "Debe haber al menos 1 pasajero en la cotización."
      });
    }

    // Nombre automático
    const nombre_cotizacion = generarNombreCotizacion(
      fecha_viaje,
      agente,
      nombre_pasajero,
      total_pasajeros
    );

    // Insert
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

/**
 * GET /api/cotizaciones
 * Listado de cabeceras
 */
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

    return res.json({
      ok: true,
      cotizaciones: rows
    });
  } catch (error) {
    console.error("Error al listar cotizaciones:", error);
    return res.status(500).json({
      ok: false,
      mensaje: "Error interno al listar cotizaciones.",
      error: error.message
    });
  }
});

/**
 * GET /api/cotizaciones/:id
 * Cabecera + items (con tipo, ciudad, noches y precio_usd ya filtrado para vuelo/tren)
 */
router.get("/cotizaciones/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, mensaje: "ID de cotización inválido." });
    }

    // Cabecera
    const [cabRows] = await db.execute(
      "SELECT * FROM cotizacion WHERE id_cotizacion = ?",
      [id]
    );
    if (cabRows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: "Cotización no encontrada." });
    }
    const cabecera = cabRows[0];

    // Items + datos de servicio / tipo / ciudad / alojamiento
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
        -- precio_usd, pero dejando Vuelo / Tren sin precio
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
        a.noches                AS noches_alojamiento
      FROM cotizacion_item ci
      JOIN servicio     s  ON s.id        = ci.id_servicio
      JOIN tiposervicio ts ON ts.id       = s.id_tipo
      JOIN ciudad       c  ON c.id        = s.id_ciudad
      LEFT JOIN alojamiento a ON a.id_servicio = s.id
      WHERE ci.id_cotizacion = ?
      ORDER BY ci.fecha_servicio ASC, ci.orden_dia ASC, ci.id_item ASC
      `,
      [id]
    );

    const items = itemRowsRaw.map(row => {
      let base = row.titulo_override || row.nombre_servicio || "";
      const tipo = row.tipo_servicio || "";

      // Prefijo de alojamiento
      if (esTipoAlojamiento(tipo)) {
        base = `Alojamiento: ${base}`;
      }

      // Prefijo de opcional
      if (row.es_opcional) {
        base = `Opcional: ${base}`;
      }

      return {
        ...row,
        servicio_texto: base
      };
    });

    return res.json({
      ok: true,
      cotizacion: cabecera, // compatibilidad
      cabecera,             // nombre más semántico
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

/**
 * POST /api/cotizaciones/:id/items
 * Inserta un servicio en una cotización
 * Ahora:
 *  - Calcula precio_usd según la tabla servicio_precio_mes y el mes de fecha_servicio.
 *  - Para Vuelo / Tren deja precio_usd en NULL.
 */
router.post("/cotizaciones/:id/items", async (req, res) => {
  try {
    const idCotizacion = parseInt(req.params.id, 10);
    if (Number.isNaN(idCotizacion)) {
      return res.status(400).json({ ok: false, mensaje: "ID de cotización inválido." });
    }

    const {
      id_servicio,
      fecha_servicio,      // "YYYY-MM-DD"
      es_opcional,
      operador_mostrado,
      link_operador,
      titulo_override,
      clase_override,
      idioma_override,
      nota_linea
      // precio_usd: se IGNORA, lo calculamos nosotros
    } = req.body || {};

    if (!id_servicio || !fecha_servicio) {
      return res.status(400).json({
        ok: false,
        mensaje: "Faltan campos obligatorios: id_servicio y fecha_servicio."
      });
    }

    const esOpcional = es_opcional ? 1 : 0;

    // 1) Obtenemos el tipo de servicio para saber si es vuelo/tren
    const [servRows] = await db.execute(
      `
      SELECT s.id, ts.nombre AS tipo_servicio
      FROM servicio s
      JOIN tiposervicio ts ON ts.id = s.id_tipo
      WHERE s.id = ?
      `,
      [id_servicio]
    );

    if (!servRows.length) {
      return res.status(400).json({
        ok: false,
        mensaje: "Servicio no encontrado."
      });
    }

    const tipoServicioNombre = servRows[0].tipo_servicio || "";
    const esSinPrecio = esTipoSinPrecio(tipoServicioNombre);

    // 2) Calculamos precio_usd_final según mes (si NO es vuelo/tren)
    let precio_usd_final = null;

    if (!esSinPrecio) {
      // Tomamos el mes de fecha_servicio
      const [precioRows] = await db.execute(
        `
        SELECT spm.precio_usd
        FROM servicio_precio_mes spm
        WHERE spm.id_servicio = ?
          AND spm.mes = MONTH(?)
        `,
        [id_servicio, fecha_servicio]
      );

      if (precioRows.length) {
        precio_usd_final = precioRows[0].precio_usd;
      } else {
        // Si no hay precio definido para ese mes, lo dejamos en NULL.
        precio_usd_final = null;
      }
    }

    // 3) Siguiente orden dentro del día
    const [maxRows] = await db.execute(
      `
      SELECT COALESCE(MAX(orden_dia), 0) AS maxOrden
      FROM cotizacion_item
      WHERE id_cotizacion = ? AND fecha_servicio = ?
      `,
      [idCotizacion, fecha_servicio]
    );
    const siguienteOrden = (maxRows[0]?.maxOrden || 0) + 1;

    // 4) Insert item
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
        precio_usd_final
      ]
    );

    const idItem = result.insertId;

    // 5) Volver a leer el item con datos de servicio / tipo / ciudad / alojamiento
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
        a.noches                AS noches_alojamiento
      FROM cotizacion_item ci
      JOIN servicio     s  ON s.id        = ci.id_servicio
      JOIN tiposervicio ts ON ts.id       = s.id_tipo
      JOIN ciudad       c  ON c.id        = s.id_ciudad
      LEFT JOIN alojamiento a ON a.id_servicio = s.id
      WHERE ci.id_item = ?
      `,
      [idItem]
    );

    const row = rows[0];
    let base = row.titulo_override || row.nombre_servicio || "";
    const tipo = row.tipo_servicio || "";

    if (esTipoAlojamiento(tipo)) {
      base = `Alojamiento: ${base}`;
    }
    if (row.es_opcional) {
      base = `Opcional: ${base}`;
    }

    return res.status(201).json({
      ok: true,
      item: {
        ...row,
        servicio_texto: base
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

/**
 * PUT /api/cotizaciones/:id/items/orden
 * Actualiza orden_dia de todos los items de una cotización.
 * Body:
 *   { orden: [ { id_item, orden_dia }, ... ] }
 */
router.put("/cotizaciones/:id/items/orden", async (req, res) => {
  try {
    const idCotizacion = Number(req.params.id);
    if (!idCotizacion) {
      return res.status(400).json({ ok: false, mensaje: "ID de cotización inválido." });
    }

    const orden = Array.isArray(req.body.orden) ? req.body.orden : [];
    if (!orden.length) {
      return res.status(400).json({ ok: false, mensaje: "No se recibió orden para actualizar." });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      for (const item of orden) {
        const idItem = Number(item.id_item);
        const ordenDia = Number(item.orden_dia);
        if (!idItem || !ordenDia) continue;

        await conn.execute(
          `
          UPDATE cotizacion_item
          SET orden_dia = ?
          WHERE id_item = ? AND id_cotizacion = ?
          `,
          [ordenDia, idItem, idCotizacion]
        );
      }

      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    return res.json({ ok: true, mensaje: "Orden actualizado correctamente." });
  } catch (error) {
    console.error("Error al actualizar orden de items:", error);
    return res.status(500).json({
      ok: false,
      mensaje: "Error interno al actualizar el orden de los items.",
      error: error.message
    });
  }
});

/**
 * DELETE /api/cotizaciones/items/:id_item
 * Elimina un item concreto de una cotización.
 */
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
