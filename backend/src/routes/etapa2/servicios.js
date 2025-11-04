// backend/src/routes/etapa2/servicios.js
const router = require('express').Router();
const pool = require('../../db'); // PromisePool de mysql2/promise

// Helper: normaliza "HH:MM" -> "HH:MM:00"
const toTime = (s) => {
  if (!s) return null;
  const str = String(s).trim();
  if (/^\d{2}:\d{2}$/.test(str)) return `${str}:00`;
  return str;
};

/* ---------------------------
   POST: crear Servicio
---------------------------- */
router.post('/servicio', async (req, res) => {
  try {
    const {
      id_tipo, id_proveedor, id_ciudad,
      nombre_wtravel,
      tiempo_servicio,   // texto
      tiempo_minutos,    // alias num -> "X min"
      es_privado,        // alias 0/1
      privado,           // preferido 0/1
      descripcion
    } = req.body;

    if (!id_tipo || !id_proveedor || !id_ciudad || !nombre_wtravel) {
      return res.status(400).json({
        error: 'id_tipo, id_proveedor, id_ciudad y nombre_wtravel son obligatorios'
      });
    }

    const priv = (privado ?? es_privado ?? 0) ? 1 : 0;
    let tiempo = tiempo_servicio && String(tiempo_servicio).trim();
    if (!tiempo && tiempo_minutos != null) {
      const min = Number(tiempo_minutos);
      if (!Number.isNaN(min) && min > 0) tiempo = `${min} min`;
    }

    const [ins] = await pool.query(
      `INSERT INTO Servicio
        (id_tipo, id_proveedor, id_ciudad, nombre_wtravel, tiempo_servicio, privado, descripcion)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id_tipo, id_proveedor, id_ciudad, String(nombre_wtravel).trim(), tiempo || null, priv, descripcion ?? null]
    );

    res.json({ success: true, id: ins.insertId });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Ese nombre_wtravel ya existe.' });
    }
    console.error('POST /servicio', err);
    res.status(500).json({ error: String(err) });
  }
});

/* -----------------------------------------
   POST: agregar horas (bulk) a un servicio
------------------------------------------ */
router.post('/servicios/:id/horas', async (req, res) => {
  try {
    const id_servicio = Number(req.params.id);
    const horas = Array.isArray(req.body.horas) ? req.body.horas : [];

    if (!id_servicio || horas.length === 0) {
      return res.status(400).json({ error: 'id de servicio y arreglo horas[] requeridos' });
    }

    let errorCount = 0;
    for (const h of horas) {
      try {
        const hora = toTime(h);
        if (!hora) { errorCount++; continue; }
        await pool.query(
          'INSERT INTO ServicioHora (id_servicio, hora) VALUES (?, ?)',
          [id_servicio, hora]
        );
      } catch {
        errorCount++; // duplicada u otro error individual
      }
    }

    if (errorCount > 0) {
      return res.status(207).json({
        partial: true,
        errorCount,
        message: 'Algunas horas no se insertaron (¿duplicadas o inválidas?)'
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('POST /servicios/:id/horas', err);
    res.status(500).json({ error: String(err) });
  }
});

/* --------------------------------
   GET: listado de servicios (grid)
--------------------------------- */
router.get('/servicios', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.id,
              s.nombre_wtravel,
              s.tiempo_servicio,
              s.privado,
              s.descripcion,
              ts.nombre AS tipo,
              p.nombre  AS proveedor,
              c.nombre  AS ciudad
         FROM Servicio s
         JOIN TipoServicio ts ON s.id_tipo = ts.id
         JOIN Proveedor   p  ON s.id_proveedor = p.id
         JOIN Ciudad      c  ON s.id_ciudad = c.id
       ORDER BY s.nombre_wtravel`
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /servicios', err);
    res.status(500).json({ error: String(err) });
  }
});

/* ------------------------------------------
   GET: detalle de un servicio (panel derecho)
------------------------------------------- */
router.get('/servicios/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'id inválido' });

    const [rows] = await pool.query(
      `SELECT s.id, s.id_tipo, s.id_proveedor, s.id_ciudad,
              s.nombre_wtravel, s.tiempo_servicio, s.privado, s.descripcion,
              ts.nombre AS tipo,
              p.nombre  AS proveedor,
              c.nombre  AS ciudad
         FROM Servicio s
         JOIN TipoServicio ts ON ts.id = s.id_tipo
         JOIN Proveedor   p  ON p.id  = s.id_proveedor
         JOIN Ciudad      c  ON c.id  = s.id_ciudad
        WHERE s.id = ?`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Servicio no encontrado' });

    const base = rows[0];

    const [aloja] = await pool.query(
      `SELECT noches, habitaciones, desayuno, categoria_hotel, categoria_hab, proveedor_hotel
         FROM Alojamiento
        WHERE id_servicio = ?`,
      [id]
    );

    const [hrs] = await pool.query(
      `SELECT DATE_FORMAT(hora,'%H:%i') AS hora
        FROM ServicioHora
        WHERE id_servicio = ?
        ORDER BY hora`,
      [id]
    );

    res.json({
      id: base.id,
      id_tipo: base.id_tipo,
      id_proveedor: base.id_proveedor,
      id_ciudad: base.id_ciudad,
      nombre_wtravel: base.nombre_wtravel,
      tiempo_servicio: base.tiempo_servicio,
      privado: !!base.privado,
      descripcion: base.descripcion,
      tipo: base.tipo,
      proveedor: base.proveedor,
      ciudad: base.ciudad,
      alojamiento: aloja[0] || null,
      horas: hrs.map(x => x.hora)
    });

  } catch (err) {
    console.error('GET /servicios/:id', err);
    res.status(500).json({ error: String(err) });
  }
});

/* ---------------------------
   PUT: actualizar servicio
---------------------------- */
router.put('/servicio/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      id_tipo, id_proveedor, id_ciudad,
      nombre_wtravel, tiempo_servicio, tiempo_minutos,
      privado, es_privado, descripcion
    } = req.body;

    if (!id || !id_tipo || !id_proveedor || !id_ciudad || !nombre_wtravel) {
      return res.status(400).json({ error: 'faltan campos obligatorios' });
    }

    const priv = (privado ?? es_privado ?? 0) ? 1 : 0;
    const tiempo = tiempo_servicio ?? (tiempo_minutos != null ? `${tiempo_minutos} min` : null);

    const [r] = await pool.query(
      `UPDATE Servicio
          SET id_tipo=?, id_proveedor=?, id_ciudad=?, nombre_wtravel=?, tiempo_servicio=?, privado=?, descripcion=?
        WHERE id=?`,
      [id_tipo, id_proveedor, id_ciudad, nombre_wtravel.trim(), tiempo, priv, descripcion || null, id]
    );
    if (!r.affectedRows) return res.status(404).json({ error: 'Servicio no encontrado' });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'nombre_wtravel duplicado.' });
    res.status(500).json({ error: String(err) });
  }
});

/* ------------------------------------------------
   PUT: reemplazar horas (borra y re-inserta todas)
------------------------------------------------- */
router.put('/servicios/:id/horas', async (req, res) => {
  let conn;
  try {
    const id_servicio = Number(req.params.id);
    const horas = Array.isArray(req.body.horas) ? req.body.horas : [];
    if (!id_servicio) return res.status(400).json({ error: 'id_servicio inválido' });

    conn = await pool.getConnection();
    await conn.beginTransaction();

    await conn.query('DELETE FROM ServicioHora WHERE id_servicio=?', [id_servicio]);
    for (const h of horas) {
      await conn.query(
        'INSERT INTO ServicioHora (id_servicio, hora) VALUES (?, ?)',
        [id_servicio, toTime(h)]
      );
    }

    await conn.commit();
    res.json({ success: true, count: horas.length });
  } catch (err) {
    try { if (conn) await conn.rollback(); } catch {}
    res.status(500).json({ error: String(err) });
  } finally {
    try { if (conn) conn.release(); } catch {}
  }
});

/* ---------------------------------
   DELETE: eliminar servicio y horas
---------------------------------- */
// DELETE: eliminar servicio (borra sus horas y alojamiento por ON DELETE CASCADE)
router.delete('/servicio/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'id inválido' });

    const [r] = await pool.query('DELETE FROM Servicio WHERE id=?', [id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Servicio no encontrado' });

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /servicio/:id', err);
    res.status(500).json({ error: String(err) });
  }
});

/* -----------------------------------------
   DELETE: eliminar una hora concreta (1 fila)
------------------------------------------ */
router.delete('/servicios/:id/horas/:hora', async (req, res) => {
  try {
    const id_servicio = Number(req.params.id);
    const hora = toTime(req.params.hora);
    const [r] = await pool.query(
      'DELETE FROM ServicioHora WHERE id_servicio=? AND hora=?',
      [id_servicio, hora]
    );
    if (!r.affectedRows) return res.status(404).json({ error: 'No existía esa hora' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

module.exports = router;