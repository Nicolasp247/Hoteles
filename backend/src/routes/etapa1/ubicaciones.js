// src/routes/etapa1/ubicaciones.js
const router = require('express').Router();
const pool = require('../../db'); // asegúrate que ../../db exporta el promise pool

// ========== CONTINENTE ==========

// Listar continentes
router.get('/continentes', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM Continente ORDER BY nombre');
    res.json(rows);
  } catch (err) {
    console.error('GET /continentes', err);
    res.status(500).json({ error: String(err) });
  }
});

// Añadir continente
router.post('/continente', async (req, res) => {
  try {
    let { nombre_continente } = req.body;
    if (!nombre_continente) return res.status(400).json({ error: 'Falta nombre_continente.' });
    nombre_continente = nombre_continente.trim().toUpperCase();

    const [exists] = await pool.query(
      'SELECT id FROM Continente WHERE nombre = ?',
      [nombre_continente]
    );
    if (exists.length > 0) return res.status(400).json({ error: 'El continente ya existe.' });

    const [result] = await pool.query(
      'INSERT INTO Continente (nombre) VALUES (?)',
      [nombre_continente]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('POST /continente', err);
    res.status(500).json({ error: String(err) });
  }
});

// ========== PAÍS ==========

// Listar países por continente
router.get('/paises/:id_continente', async (req, res) => {
  try {
    const { id_continente } = req.params;
    const [rows] = await pool.query(
      'SELECT * FROM Pais WHERE id_continente = ? ORDER BY nombre',
      [id_continente]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /paises/:id_continente', err);
    res.status(500).json({ error: String(err) });
  }
});

// Añadir país
router.post('/pais', async (req, res) => {
  try {
    let { nombre_pais, id_continente } = req.body;
    if (!nombre_pais || !id_continente) {
      return res.status(400).json({ error: 'Faltan nombre_pais o id_continente.' });
    }
    nombre_pais = nombre_pais.trim().toUpperCase();

    const [exists] = await pool.query(
      'SELECT id FROM Pais WHERE nombre = ? AND id_continente = ?',
      [nombre_pais, id_continente]
    );
    if (exists.length > 0) {
      return res.status(400).json({ error: 'El país ya existe en ese continente.' });
    }

    const [result] = await pool.query(
      'INSERT INTO Pais (nombre, id_continente) VALUES (?, ?)',
      [nombre_pais, id_continente]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('POST /pais', err);
    res.status(500).json({ error: String(err) });
  }
});

// ========== CIUDAD ==========

// Listar ciudades por país
router.get('/ciudades/:id_pais', async (req, res) => {
  try {
    const { id_pais } = req.params;
    const [rows] = await pool.query(
      'SELECT * FROM Ciudad WHERE id_pais = ? ORDER BY nombre',
      [id_pais]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /ciudades/:id_pais', err);
    res.status(500).json({ error: String(err) });
  }
});

// Añadir ciudad
router.post('/ciudad', async (req, res) => {
  try {
    let { nombre_ciudad, id_pais } = req.body;
    if (!nombre_ciudad || !id_pais) {
      return res.status(400).json({ error: 'Faltan nombre_ciudad o id_pais.' });
    }
    nombre_ciudad = nombre_ciudad.trim().toUpperCase();

    const [exists] = await pool.query(
      'SELECT id FROM Ciudad WHERE nombre = ? AND id_pais = ?',
      [nombre_ciudad, id_pais]
    );
    if (exists.length > 0) {
      return res.status(400).json({ error: 'La ciudad ya existe en ese país.' });
    }

    const [result] = await pool.query(
      'INSERT INTO Ciudad (nombre, id_pais) VALUES (?, ?)',
      [nombre_ciudad, id_pais]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('POST /ciudad', err);
    res.status(500).json({ error: String(err) });
  }
});

// ========== ZONA ==========

// Listar zonas por ciudad
router.get('/zonas/:id_ciudad', async (req, res) => {
  try {
    const { id_ciudad } = req.params;
    const [rows] = await pool.query(
      'SELECT * FROM Zona WHERE id_ciudad = ? ORDER BY nombre',
      [id_ciudad]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /zonas/:id_ciudad', err);
    res.status(500).json({ error: String(err) });
  }
});

// Añadir zona
router.post('/zona', async (req, res) => {
  try {
    let { nombre_zona, descripcion_zona, id_ciudad } = req.body;
    if (!nombre_zona || !id_ciudad) {
      return res.status(400).json({ error: 'Faltan nombre_zona o id_ciudad.' });
    }
    nombre_zona = nombre_zona.trim().toUpperCase();
    descripcion_zona = (descripcion_zona ?? '').trim();

    const [exists] = await pool.query(
      'SELECT id FROM Zona WHERE nombre = ? AND id_ciudad = ?',
      [nombre_zona, id_ciudad]
    );
    if (exists.length > 0) {
      return res.status(400).json({ error: 'La zona ya existe en esa ciudad.' });
    }

    const [result] = await pool.query(
      'INSERT INTO Zona (nombre, descripcion, id_ciudad) VALUES (?, ?, ?)',
      [nombre_zona, descripcion_zona, id_ciudad]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('POST /zona', err);
    res.status(500).json({ error: String(err) });
  }
});

// Listar todas las zonas (para selects de borrar)
router.get('/zonas', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT z.id, z.nombre, c.nombre AS ciudad, p.nombre AS pais, ct.nombre AS continente
       FROM Zona z
       INNER JOIN Ciudad c ON z.id_ciudad = c.id
       INNER JOIN Pais p ON c.id_pais = p.id
       INNER JOIN Continente ct ON p.id_continente = ct.id
       ORDER BY z.nombre`
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /zonas', err);
    res.status(500).json({ error: String(err) });
  }
});

// Eliminar una zona y sus referencias en HotelZona (ATÓMICO)
router.delete("/zona/:id", async (req, res, next) => {
  let conn;
  try {
    const idZona = Number(req.params.id);
    if (!Number.isInteger(idZona) || idZona <= 0) {
      return res.status(400).json({ error: "ID de zona inválido." });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    await conn.query("DELETE FROM HotelZona WHERE zona_id = ?", [idZona]);
    const [result] = await conn.query("DELETE FROM Zona WHERE id = ?", [idZona]);

    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Zona no encontrada." });
    }

    await conn.commit();
    return res.json({ success: true });
  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    return next(err);
  } finally {
    if (conn) conn.release();
  }
});


// Listar TODOS los países (opcionalmente con continente)
router.get('/paises', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.id, p.nombre AS pais, c.nombre AS continente, p.id_continente
      FROM Pais p
      JOIN Continente c ON c.id = p.id_continente
      ORDER BY c.nombre, p.nombre
    `);
    res.json(rows);
  } catch (err) {
    console.error('GET /paises', err);
    res.status(500).json({ error: String(err) });
  }
});

// Obtener una ciudad por id (incluye id_pais)
router.get('/ciudad/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT c.id, c.nombre, c.id_pais, p.nombre AS pais
       FROM Ciudad c JOIN Pais p ON p.id = c.id_pais
       WHERE c.id = ?`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Ciudad no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /ciudad/:id', err);
    res.status(500).json({ error: String(err) });
  }
});


module.exports = router;

