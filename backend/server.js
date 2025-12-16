// backend/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');

// Pool (mysql2/promise)
const pool = require('./src/db');

// === Crear la app ===
const app = express();

app.use(cors());
app.use(express.json());

// === Servir frontend (carpeta public está FUERA de backend) ===
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

// --- Endpoint de inspección del esquema ---
app.get('/api/_meta/schema', async (_req, res) => {
  try {
    // 1) Columnas de todas las tablas del esquema actual
    const [cols] = await pool.query(`
      SELECT 
        c.TABLE_NAME,
        c.COLUMN_NAME,
        c.COLUMN_TYPE,
        c.IS_NULLABLE,
        c.COLUMN_KEY,
        c.EXTRA
      FROM information_schema.COLUMNS c
      WHERE c.TABLE_SCHEMA = DATABASE()
      ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION
    `);

    // 2) Claves foráneas básicas (sin reglas UPDATE/DELETE)
    const [fks] = await pool.query(`
      SELECT
        kcu.TABLE_NAME          AS tabla_hija,
        kcu.COLUMN_NAME         AS columna_hija,
        kcu.REFERENCED_TABLE_NAME  AS tabla_padre,
        kcu.REFERENCED_COLUMN_NAME AS columna_padre,
        kcu.CONSTRAINT_NAME
      FROM information_schema.KEY_COLUMN_USAGE kcu
      WHERE kcu.TABLE_SCHEMA = DATABASE()
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY tabla_hija, columna_hija
    `);

    res.json({ columns: cols, foreignKeys: fks });
  } catch (e) {
    console.error('ERROR /api/_meta/schema', e);
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
app.use('/api', require('./src/routes/catalogos'));


// --- Rutas Etapa 3 (Cotizaciones) ---
app.use('/api', require('./src/routes/etapa3/cotizaciones'));

// --- Rutas Etapa 3 (Precios) ---
app.use("/api", require("./src/routes/etapa3/precios"));

// 404 solo para rutas de API
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Manejador de errores global
app.use((err, _req, res, next) => {
  if (res.headersSent) return next(err);
  console.error('UNCAUGHT ERROR:', err);
  res.status(500).json({ error: String(err) });
});

// === Iniciar servidor (AL FINAL) ===
const PORT = 3000;
app.listen(PORT, () => {
  console.log('Servidor backend corriendo en puerto', PORT);
});