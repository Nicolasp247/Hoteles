// src/routes/etapa1/hoteles.js
const { validate } = require("../../middlewares/validate");
const {
  schemaHotelCreate,
  schemaHotelUpdate,
  schemaHotelIdParams,
} = require("../../validators/hoteles.validator");

const router = require("express").Router();
const pool = require("../../db"); // <-- PromisePool en ../../db

// ==============================
// Crear hotel + relaciones zonas
// ==============================
router.post(
  "/hotel",
  validate({ body: schemaHotelCreate }),
  async (req, res, next) => {
    let conn;
    try {
      // ✅ Ya viene validado/normalizado por Zod
      const {
        nombre,
        estrellas,
        booking_score,
        tripadvisor_score,
        descripcion,
        link_booking,
        link_tripadvisor,
        zonas,
        id_ciudad,
      } = req.body;

      conn = await pool.getConnection();
      await conn.beginTransaction();

      // Validar unicidad de enlaces
      const [dupLinks] = await conn.query(
        `SELECT id
         FROM Hotel
         WHERE (link_booking = ? AND ? IS NOT NULL)
            OR (link_tripadvisor = ? AND ? IS NOT NULL)`,
        [link_booking, link_booking, link_tripadvisor, link_tripadvisor]
      );

      if (dupLinks.length > 0) {
        // No hemos escrito nada, pero igual “cerramos limpio”
        await conn.rollback();
        return res.status(400).json({
          ok: false,
          mensaje: "El enlace de Booking o TripAdvisor ya está registrado.",
        });
      }

      // Validar nombre único
      const [dupName] = await conn.query(
        "SELECT id FROM Hotel WHERE nombre = ?",
        [nombre]
      );

      if (dupName.length > 0) {
        await conn.rollback();
        return res.status(400).json({
          ok: false,
          mensaje: "Ya existe un hotel con ese nombre.",
        });
      }

      // Insertar hotel
      const [insHotel] = await conn.query(
        `INSERT INTO Hotel
          (nombre, estrellas, booking_score, tripadvisor_score, descripcion, link_booking, link_tripadvisor, id_ciudad)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          nombre,
          estrellas,
          booking_score,
          tripadvisor_score,
          descripcion,
          link_booking,
          link_tripadvisor,
          id_ciudad,
        ]
      );

      const hotelId = insHotel.insertId;

      // Insertar zonas
      for (const z of zonas) {
        await conn.query(
          "INSERT INTO HotelZona (hotel_id, zona_id, metros) VALUES (?, ?, ?)",
          [hotelId, z.id_zona, z.metros]
        );
      }

      await conn.commit();
      return res.status(201).json({ ok: true, id: hotelId });
    } catch (err) {
      try {
        if (conn) await conn.rollback();
      } catch {}
      return next(err);
    } finally {
      try {
        if (conn) conn.release();
      } catch {}
    }
  }
);

// ==============================
// Eliminar hotel (y relaciones)
// ==============================
router.delete(
  "/hotel/:id",
  validate({ params: schemaHotelIdParams }),
  async (req, res, next) => {
    let conn;
    try {
      const { id: idHotel } = req.params; // ✅ ya viene int positivo por Zod

      conn = await pool.getConnection();
      await conn.beginTransaction();

      await conn.query("DELETE FROM HotelZona WHERE hotel_id = ?", [idHotel]);

      const [del] = await conn.query("DELETE FROM Hotel WHERE id = ?", [idHotel]);
      if (del.affectedRows === 0) {
        await conn.rollback();
        return res.status(404).json({ ok: false, mensaje: "Hotel no encontrado." });
      }

      await conn.commit();
      return res.json({ ok: true });
    } catch (err) {
      try {
        if (conn) await conn.rollback();
      } catch {}
      return next(err);
    } finally {
      try {
        if (conn) conn.release();
      } catch {}
    }
  }
);

// =========================================
// Listar hoteles (para selección rápida)
// ✅ CORREGIDO: ahora devuelve id_ciudad
// ✅ CORREGIDO: devuelve {ok:true, hoteles:[...]}
// =========================================
router.get("/hoteles", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        h.id,
        h.nombre,
        h.estrellas,
        h.id_ciudad AS id_ciudad,         -- 👈 CLAVE para filtrar en el front
        c.nombre AS ciudad,
        p.nombre AS pais,
        ct.nombre AS continente
      FROM Hotel h
      INNER JOIN Ciudad c ON h.id_ciudad = c.id
      INNER JOIN Pais p ON c.id_pais = p.id
      INNER JOIN Continente ct ON p.id_continente = ct.id
      ORDER BY h.nombre
      `
    );

    // IMPORTANTE: tu front puede leer arrays o keys, pero aquí lo dejamos estándar
    res.json({ ok: true, hoteles: rows });
  } catch (err) {
    console.error("GET /hoteles", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ===================================================
// Buscar hoteles con filtros + 2 zonas (si existen)
// ===================================================
router.post("/buscar-hoteles", async (req, res) => {
  try {
    const { idContinente, idPais, idCiudad, estrellas } = req.body;

    let where = "1=1";
    let params = [];

    if (idContinente) {
      where += " AND Continente.id = ?";
      params.push(idContinente);
    }
    if (idPais) {
      where += " AND Pais.id = ?";
      params.push(idPais);
    }
    if (idCiudad) {
      where += " AND Ciudad.id = ?";
      params.push(idCiudad);
    }
    if (Array.isArray(estrellas) && estrellas.length > 0) {
      where += ` AND Hotel.estrellas IN (${estrellas.map(() => "?").join(",")})`;
      params = params.concat(estrellas);
    }

    const sql = `
      SELECT
        Hotel.id,
        Hotel.nombre,
        Hotel.estrellas,
        Hotel.booking_score,
        Hotel.tripadvisor_score,
        Hotel.descripcion,
        Hotel.link_booking,
        Hotel.link_tripadvisor,
        Ciudad.nombre AS ciudad,
        Pais.nombre AS pais,
        Continente.nombre AS continente,
        MAX(CASE WHEN hz.orden = 1 THEN Zona.nombre END) AS zona1_nombre,
        MAX(CASE WHEN hz.orden = 1 THEN hz.metros END) AS zona1_metros,
        MAX(CASE WHEN hz.orden = 2 THEN Zona.nombre END) AS zona2_nombre,
        MAX(CASE WHEN hz.orden = 2 THEN hz.metros END) AS zona2_metros
      FROM Hotel
      INNER JOIN Ciudad ON Hotel.id_ciudad = Ciudad.id
      INNER JOIN Pais ON Ciudad.id_pais = Pais.id
      INNER JOIN Continente ON Pais.id_continente = Continente.id
      LEFT JOIN (
        SELECT
          hotel_id,
          zona_id,
          metros,
          ROW_NUMBER() OVER (PARTITION BY hotel_id ORDER BY id) AS orden
        FROM HotelZona
      ) AS hz ON hz.hotel_id = Hotel.id
      LEFT JOIN Zona ON hz.zona_id = Zona.id
      WHERE ${where}
      GROUP BY Hotel.id
      ORDER BY Hotel.nombre
    `;

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("POST /buscar-hoteles", err);
    res.status(500).json({ error: String(err) });
  }
});

// ==================================
// Editar: listar por ciudad
// ==================================
router.get("/hoteles-por-ciudad/:id_ciudad", async (req, res) => {
  try {
    const { id_ciudad } = req.params;
    const [rows] = await pool.query(
      "SELECT id, nombre FROM Hotel WHERE id_ciudad = ? ORDER BY nombre",
      [id_ciudad]
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /hoteles-por-ciudad/:id_ciudad", err);
    res.status(500).json({ error: String(err) });
  }
});

// ==================================
// Editar: detalle (con zonas)
// ==================================
router.get("/hotel-detalle/:id_hotel", async (req, res, next) => {
  try {
    const idHotel = Number(req.params.id_hotel);
    if (!Number.isInteger(idHotel) || idHotel <= 0) {
      return res.status(400).json({ error: "ID de hotel inválido." });
    }

    const [hot] = await pool.query("SELECT * FROM Hotel WHERE id = ?", [idHotel]);
    if (hot.length === 0) return res.status(404).json({ error: "Hotel no encontrado" });

    const hotel = hot[0];

    const [zonas] = await pool.query(
      "SELECT zona_id AS id_zona, metros FROM HotelZona WHERE hotel_id = ? ORDER BY zona_id ASC",
      [idHotel]
    );

    hotel.zonas = zonas;
    return res.json(hotel);
  } catch (err) {
    return next(err);
  }
});

// ==================================
// Editar: actualizar hotel + zonas
// ==================================
router.put(
  "/hotel/:id",
  validate({ params: schemaHotelIdParams, body: schemaHotelUpdate }),
  async (req, res, next) => {
    let conn;
    try {
      // ✅ ya viene validado y normalizado por Zod
      const { id: idHotel } = req.params;
      const {
        nombre,
        estrellas,
        booking_score,
        tripadvisor_score,
        descripcion,
        link_booking,
        link_tripadvisor,
        zonas,
      } = req.body;

      conn = await pool.getConnection();
      await conn.beginTransaction();

      // Actualizar hotel
      const [upd] = await conn.query(
        `UPDATE Hotel SET 
          nombre = ?, 
          estrellas = ?, 
          booking_score = ?, 
          tripadvisor_score = ?, 
          descripcion = ?, 
          link_booking = ?, 
          link_tripadvisor = ?
        WHERE id = ?`,
        [
          nombre,
          estrellas,
          booking_score,
          tripadvisor_score,
          descripcion,
          link_booking,
          link_tripadvisor,
          idHotel,
        ]
      );

      if (upd.affectedRows === 0) {
        await conn.rollback();
        return res.status(404).json({ ok: false, mensaje: "Hotel no encontrado." });
      }

      // Reemplazar zonas (todo dentro de la transacción)
      await conn.query("DELETE FROM HotelZona WHERE hotel_id = ?", [idHotel]);

      for (const z of zonas) {
        await conn.query(
          "INSERT INTO HotelZona (hotel_id, zona_id, metros) VALUES (?, ?, ?)",
          [idHotel, z.id_zona, z.metros]
        );
      }

      await conn.commit();
      return res.json({ ok: true });
    } catch (err) {
      try {
        if (conn) await conn.rollback();
      } catch {}
      return next(err);
    } finally {
      try {
        if (conn) conn.release();
      } catch {}
    }
  }
);

module.exports = router;
