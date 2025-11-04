// backend/src/routes/etapa2/alojamientos.js
const router = require('express').Router();
const pool = require('../../db'); // PromisePool de mysql2/promise

// POST: crear Alojamiento vinculado a un Servicio (1:1)
router.post('/alojamiento', async (req, res) => {
  try {
    const {
      id_servicio,

      // nombres “oficiales” según el esquema
      noches,
      habitaciones,
      desayuno,            // 1/0, true/false
      categoria_hotel,
      categoria_hab,
      proveedor_hotel,

      // alias que has usado a veces desde el front
      numero_noches,
      cant_habitaciones,
      incluye_desayuno,
      categoria_habitacion
    } = req.body;

    if (!id_servicio) {
      return res.status(400).json({ error: 'id_servicio es requerido' });
    }

    // Normalización / defaults
    const _noches    = Number(noches ?? numero_noches ?? 0);
    const _habs      = Number(habitaciones ?? cant_habitaciones ?? 0);
    const _desayuno  = (desayuno ?? incluye_desayuno ?? 1) ? 1 : 0;  // default: 1 (con desayuno)
    const _catHotel  = categoria_hotel ?? null;
    const _catHab    = categoria_hab ?? categoria_habitacion ?? null;
    const _provHotel = (proveedor_hotel ?? 'AEI').toString().slice(0, 5); // VARCHAR(5)

    if (!Number.isFinite(_noches) || _noches <= 0) {
      return res.status(400).json({ error: 'noches debe ser un número > 0' });
    }
    if (!Number.isFinite(_habs) || _habs <= 0) {
      return res.status(400).json({ error: 'habitaciones debe ser un número > 0' });
    }

    // 1) Confirmar que el servicio existe y es de tipo "Alojamiento"
    const [servRows] = await pool.query(
      `SELECT ts.nombre AS tipo
         FROM Servicio s
         JOIN TipoServicio ts ON ts.id = s.id_tipo
        WHERE s.id = ?`,
      [id_servicio]
    );

    if (servRows.length === 0) {
      return res.status(400).json({ error: 'El servicio no existe.' });
    }
    if (servRows[0].tipo !== 'Alojamiento') {
      return res.status(400).json({ error: 'El servicio no es de tipo Alojamiento.' });
    }

    // 2) Insertar el Alojamiento (id_servicio es UNIQUE)
    const [ins] = await pool.query(
      `INSERT INTO Alojamiento
        (id_servicio, noches, habitaciones, desayuno, categoria_hotel, categoria_hab, proveedor_hotel)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id_servicio, _noches, _habs, _desayuno, _catHotel, _catHab, _provHotel]
    );

    return res.json({ success: true, id: ins.insertId });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Ese servicio ya tiene un Alojamiento asociado.' });
    }
    console.error('POST /alojamiento', err);
    return res.status(500).json({ error: String(err) });
  }
});

// GET: listar todos los alojamientos (con joins informativos)
router.get('/alojamientos', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.id,
              a.id_servicio,
              a.noches,
              a.habitaciones,
              a.desayuno,
              a.categoria_hotel,
              a.categoria_hab,
              a.proveedor_hotel,
              s.nombre_wtravel,
              ts.nombre   AS tipo_servicio,
              p.nombre    AS proveedor,
              c.nombre    AS ciudad
         FROM Alojamiento a
         JOIN Servicio s      ON s.id = a.id_servicio
         JOIN TipoServicio ts ON ts.id = s.id_tipo
         JOIN Proveedor p     ON p.id = s.id_proveedor
         JOIN Ciudad c        ON c.id = s.id_ciudad
       ORDER BY a.id DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /alojamientos', err);
    res.status(500).json({ error: String(err) });
  }
});

// GET: obtener alojamiento por id_servicio (1:1 con Servicio)
router.get('/alojamiento/:id_servicio', async (req, res) => {
  try {
    const id_servicio = Number(req.params.id_servicio);
    if (!id_servicio) {
      return res.status(400).json({ error: 'id_servicio inválido' });
    }

    const [rows] = await pool.query(
      `SELECT a.id,
              a.id_servicio,
              a.noches,
              a.habitaciones,
              a.desayuno,
              a.categoria_hotel,
              a.categoria_hab,
              a.proveedor_hotel,
              s.nombre_wtravel,
              ts.nombre   AS tipo_servicio,
              p.nombre    AS proveedor,
              c.nombre    AS ciudad
         FROM Alojamiento a
         JOIN Servicio s      ON s.id = a.id_servicio
         JOIN TipoServicio ts ON ts.id = s.id_tipo
         JOIN Proveedor p     ON p.id = s.id_proveedor
         JOIN Ciudad c        ON c.id = s.id_ciudad
        WHERE a.id_servicio = ?
        LIMIT 1`,
      [id_servicio]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No hay alojamiento para ese servicio' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /alojamiento/:id_servicio', err);
    res.status(500).json({ error: String(err) });
  }
});

// PUT: actualizar alojamiento por id_servicio (1:1)
router.put('/alojamiento/:id_servicio', async (req, res) => {
  try {
    const id_servicio = Number(req.params.id_servicio);
    const {
      noches, numero_noches,
      habitaciones, cant_habitaciones,
      desayuno, incluye_desayuno,
      categoria_hotel, categoria_hab, categoria_habitacion,
      proveedor_hotel
    } = req.body;

    const _noches = Number(noches ?? numero_noches ?? 0);
    const _habs   = Number(habitaciones ?? cant_habitaciones ?? 0);
    const _des    = (desayuno ?? incluye_desayuno ?? 1) ? 1 : 0;
    const _catH   = categoria_hotel ?? null;
    const _catHab = categoria_hab ?? categoria_habitacion ?? null;
    const _prov   = (proveedor_hotel ?? 'AEI').toString().slice(0, 5);

    const [r] = await pool.query(
      `UPDATE Alojamiento
          SET noches=?, habitaciones=?, desayuno=?, categoria_hotel=?, categoria_hab=?, proveedor_hotel=?
        WHERE id_servicio=?`,
      [_noches, _habs, _des, _catH, _catHab, _prov, id_servicio]
    );
    if (!r.affectedRows) return res.status(404).json({ error: 'Alojamiento no encontrado' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// DELETE: eliminar alojamiento por id_servicio
router.delete('/alojamiento/:id_servicio', async (req, res) => {
  try {
    const id_servicio = Number(req.params.id_servicio);
    const [r] = await pool.query('DELETE FROM Alojamiento WHERE id_servicio=?', [id_servicio]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Alojamiento no encontrado' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

module.exports = router;
