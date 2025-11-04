// backend/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');

// Pool (mysql2/promise)
const pool = require('./src/db');

// === Crear la app (esto es lo que faltaba) ===
const app = express();

app.use(cors());
app.use(express.json());

// === Servir el frontend (carpeta public está FUERA de backend) ===
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR));
console.log('[STATIC] Sirviendo desde:', PUBLIC_DIR);

// --- Health / Ping ---
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/ping', async (_req, res) => {
  try {
    const [dbRow]   = await pool.query('SELECT DATABASE() AS db');
    const [contRow] = await pool.query('SELECT COUNT(*) AS n FROM Continente');
    const [paisRow] = await pool.query('SELECT COUNT(*) AS n FROM Pais');
    res.json({
      database: dbRow[0]?.db || null,
      continentes: contRow[0]?.n ?? 0,
      paises: paisRow[0]?.n ?? 0,
    });
  } catch (e) {
    console.error('PING ERROR:', e);
    res.status(500).json({ error: String(e) });
  }
});

// --- Rutas Etapa 1 ---
app.use('/api', require('./src/routes/etapa1/ubicaciones'));
app.use('/api', require('./src/routes/etapa1/hoteles'));

// --- Rutas Etapa 2 ---
app.use('/api', require('./src/routes/etapa2/tiposervicio'));
app.use('/api', require('./src/routes/etapa2/proveedores'));
app.use('/api', require('./src/routes/etapa2/servicios'));
app.use('/api', require('./src/routes/etapa2/alojamientos'));

// 404 solo para rutas de API
app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Manejador de errores
app.use((err, _req, res, _next) => {
  console.error('UNCAUGHT ERROR:', err);
  res.status(500).json({ error: String(err) });
});

// --- Inicio servidor ---
const PORT = 3000;
app.listen(PORT, () => {
  console.log('Servidor backend corriendo en puerto', PORT);
});
