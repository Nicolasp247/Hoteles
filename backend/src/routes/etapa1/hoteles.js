// src/routes/etapa1/hoteles.js
const router = require('express').Router();
const pool = require('../../db'); // <-- exporta un PromisePool en ../../db

// ==============================
// Crear hotel + relaciones zonas
// ==============================
router.post('/hotel', async (req, res) => {
  try {
    let {
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

    if (!nombre || !id_ciudad || !estrellas) {
      return res.status(400).json({ error: 'Faltan campos obligatorios (nombre, estrellas, id_ciudad).' });
    }

    nombre = nombre.trim().toUpperCase();
    link_booking = link_booking ? link_booking.trim() : null;
    link_tripadvisor = link_tripadvisor ? link_tripadvisor.trim() : null;

    // Validar unicidad de enlaces
    const [dupLinks] = await pool.query(
      'SELECT id FROM Hotel WHERE (link_booking = ? AND ? IS NOT NULL) OR (link_tripadvisor = ? AND ? IS NOT NULL)',
      [link_booking, link_booking, link_tripadvisor, link_tripadvisor]
    );
    if (dupLinks.length > 0) {
      return res.status(400).json({ error: 'El enlace de Booking o TripAdvisor ya está registrado.' });
    }

    // Validar nombre
    const [dupName] = await pool.query('SELECT id FROM Hotel WHERE nombre = ?', [nombre]);
    if (dupName.length > 0) {
      return res.status(400).json({ error: 'Ya existe un hotel con ese nombre.' });
    }

    // Insertar hotel
    const [insHotel] = await pool.query(
      `INSERT INTO Hotel
       (nombre, estrellas, booking_score, tripadvisor_score, descripcion, link_booking, link_tripadvisor, id_ciudad)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [nombre, estrellas, booking_score, tripadvisor_score, descripcion, link_booking, link_tripadvisor, id_ciudad]
    );
    const hotelId = insHotel.insertId;

    // Validación zonas
    if (!Array.isArray(zonas) || zonas.length === 0) {
      return res.status(400).json({ error: 'Debes seleccionar al menos una zona.' });
    }

    // Insertar zonas
    for (const z of zonas) {
      await pool.query(
        'INSERT INTO HotelZona (hotel_id, zona_id, metros) VALUES (?, ?, ?)',
        [hotelId, z.id_zona, z.metros]
      );
    }

    res.json({ success: true, id: hotelId });
  } catch (err) {
    console.error('POST /hotel', err);
    res.status(500).json({ error: String(err) });
  }
});

// ==============================
// Eliminar hotel (y relaciones)
// ==============================
router.delete('/hotel/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM HotelZona WHERE hotel_id = ?', [id]);
    const [del] = await pool.query('DELETE FROM Hotel WHERE id = ?', [id]);
    if (del.affectedRows === 0) return res.status(404).json({ error: 'Hotel no encontrado.' });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /hotel/:id', err);
    res.status(500).json({ error: String(err) });
  }
});

// =========================================
// Listar hoteles (para selección rápida)
// =========================================
router.get('/hoteles', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT h.id, h.nombre, h.estrellas, c.nombre AS ciudad, p.nombre AS pais, ct.nombre AS continente
       FROM Hotel h
       INNER JOIN Ciudad c ON h.id_ciudad = c.id
       INNER JOIN Pais p ON c.id_pais = p.id
       INNER JOIN Continente ct ON p.id_continente = ct.id
       ORDER BY h.nombre`
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /hoteles', err);
    res.status(500).json({ error: String(err) });
  }
});

// ===================================================
// Buscar hoteles con filtros + 2 zonas (si existen)
// ===================================================
router.post('/buscar-hoteles', async (req, res) => {
  try {
    const { idContinente, idPais, idCiudad, estrellas } = req.body;

    let where = '1=1';
    let params = [];

    if (idContinente) { where += ' AND Continente.id = ?'; params.push(idContinente); }
    if (idPais)       { where += ' AND Pais.id = ?';       params.push(idPais); }
    if (idCiudad)     { where += ' AND Ciudad.id = ?';     params.push(idCiudad); }
    if (Array.isArray(estrellas) && estrellas.length > 0) {
      where += ` AND Hotel.estrellas IN (${estrellas.map(() => '?').join(',')})`;
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
    console.error('POST /buscar-hoteles', err);
    res.status(500).json({ error: String(err) });
  }
});

// ==================================
// Editar: listar por ciudad
// ==================================
router.get('/hoteles-por-ciudad/:id_ciudad', async (req, res) => {
  try {
    const { id_ciudad } = req.params;
    const [rows] = await pool.query(
      'SELECT id, nombre FROM Hotel WHERE id_ciudad = ? ORDER BY nombre',
      [id_ciudad]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /hoteles-por-ciudad/:id_ciudad', err);
    res.status(500).json({ error: String(err) });
  }
});

// ==================================
// Editar: detalle (con zonas)
// ==================================
router.get('/hotel-detalle/:id_hotel', async (req, res) => {
  try {
    const { id_hotel } = req.params;

    const [hot] = await pool.query('SELECT * FROM Hotel WHERE id = ?', [id_hotel]);
    if (hot.length === 0) return res.status(404).json({ error: 'Hotel no encontrado' });
    const hotel = hot[0];

    const [zonas] = await pool.query(
      'SELECT zona_id AS id_zona, metros FROM HotelZona WHERE hotel_id = ? ORDER BY id ASC LIMIT 2',
      [id_hotel]
    );
    hotel.zonas = zonas;

    res.json(hotel);
  } catch (err) {
    console.error('GET /hotel-detalle/:id_hotel', err);
    res.status(500).json({ error: String(err) });
  }
});

// ==================================
// Editar: actualizar hotel + zonas
// ==================================
router.put('/hotel/:id', async (req, res) => {
  try {
    const idHotel = req.params.id;
    const { nombre, estrellas, booking_score, tripadvisor_score, descripcion, link_booking, link_tripadvisor, zonas } = req.body;

    const [upd] = await pool.query(
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
        nombre.trim().toUpperCase(),
        estrellas,
        booking_score,
        tripadvisor_score,
        descripcion,
        link_booking ? link_booking.trim() : null,
        link_tripadvisor ? link_tripadvisor.trim() : null,
        idHotel
      ]
    );
    if (upd.affectedRows === 0) return res.status(404).json({ error: 'Hotel no encontrado.' });

    await pool.query('DELETE FROM HotelZona WHERE hotel_id = ?', [idHotel]);

    if (Array.isArray(zonas) && zonas.length > 0) {
      for (const z of zonas) {
        await pool.query(
          'INSERT INTO HotelZona (hotel_id, zona_id, metros) VALUES (?, ?, ?)',
          [idHotel, z.id_zona, z.metros]
        );
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('PUT /hotel/:id', err);
    res.status(500).json({ error: String(err) });
  }
});

module.exports = router;
