// backend/src/routes/etapa2/tiposervicio.js
const express = require('express');
const router = express.Router();
const db = require('../../db');

// GET: listar tipos
router.get('/tipos-servicio', async (_req, res) => {
  try {
    const [rows] = await db.query('SELECT id, nombre FROM TipoServicio ORDER BY nombre');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err });
  }
});

// POST: crear tipo (nombre único)
router.post('/tipo-servicio', async (req, res) => {
  try {
    const nombre = (req.body.nombre || '').trim();
    if (!nombre) return res.status(400).json({ error: 'nombre es requerido' });

    await db.query('INSERT INTO TipoServicio (nombre) VALUES (?)', [nombre]);
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'El nombre de tipo ya existe.' });
    }
    res.status(500).json({ error: err });
  }
});

// PUT: actualizar tipo
router.put('/tipo-servicio/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const nombre = (req.body.nombre || '').trim();
    if (!id || !nombre) return res.status(400).json({ error: 'id y nombre son obligatorios' });

    const [r] = await db.query('UPDATE TipoServicio SET nombre=? WHERE id=?', [nombre, id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Tipo no encontrado' });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Nombre ya existe.' });
    res.status(500).json({ error: err });
  }
});

// DELETE: eliminar tipo
router.delete('/tipo-servicio/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [r] = await db.query('DELETE FROM TipoServicio WHERE id=?', [id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Tipo no encontrado' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err });
  }
});

module.exports = router;
