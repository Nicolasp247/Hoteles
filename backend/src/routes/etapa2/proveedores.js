// backend/src/routes/etapa2/proveedores.js
const express = require('express');
const router = express.Router();
const db = require('../../db');

// --- GET: lista
router.get('/proveedores', async (_req, res) => {
  try {
    const [rows] = await db.query('SELECT id, nombre, web, iniciales FROM Proveedor ORDER BY nombre');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// --- POST: crear
router.post('/proveedor', async (req, res) => {
  try {
    const nombre    = (req.body.nombre || '').trim();
    const iniciales = (req.body.iniciales || '').trim().toUpperCase();
    const web       = (req.body.web || null);

    if (!nombre)    return res.status(400).json({ error: 'El nombre es requerido.' });
    if (!iniciales) return res.status(400).json({ error: 'Las iniciales son requeridas.' });

    await db.query(
      'INSERT INTO Proveedor (nombre, web, iniciales) VALUES (?, ?, ?)',
      [nombre, web, iniciales]
    );
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'La URL (web) ya está registrada.' });
    }
    res.status(500).json({ error: String(err) });
  }
});

// --- PUT: actualizar
router.put('/proveedor/:id', async (req, res) => {
  try {
    const id        = Number(req.params.id);
    const nombre    = (req.body.nombre || '').trim();
    const iniciales = (req.body.iniciales || '').trim().toUpperCase();
    const web       = (req.body.web || null);

    if (!id)        return res.status(400).json({ error: 'ID inválido.' });
    if (!nombre)    return res.status(400).json({ error: 'El nombre es requerido.' });
    if (!iniciales) return res.status(400).json({ error: 'Las iniciales son requeridas.' });

    const [r] = await db.query(
      'UPDATE Proveedor SET nombre=?, web=?, iniciales=? WHERE id=?',
      [nombre, web, iniciales, id]
    );
    if (!r.affectedRows) return res.status(404).json({ error: 'Proveedor no encontrado.' });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'La URL (web) ya está registrada.' });
    }
    res.status(500).json({ error: String(err) });
  }
});

// --- DELETE: eliminar
router.delete('/proveedor/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID inválido.' });

    // Si existe FK en Servicio → Proveedor, MySQL impedirá borrar si hay servicios.
    const [r] = await db.query('DELETE FROM Proveedor WHERE id=?', [id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Proveedor no encontrado.' });
    res.json({ success: true });
  } catch (err) {
    // Si falla por integridad referencial, devuelve 409
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
      return res.status(409).json({ error: 'No se puede eliminar: el proveedor tiene servicios asociados.' });
    }
    res.status(500).json({ error: String(err) });
  }
});

module.exports = router;
