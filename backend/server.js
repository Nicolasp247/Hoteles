// backend/server.js
require("dotenv").config();

const isProd = process.env.NODE_ENV === "production";

const express = require("express");
const cors = require("cors");
const path = require("path");

// Pool (mysql2/promise)
const pool = require("./src/db");

// === Crear la app ===
const app = express();

app.use(cors());
app.use(express.json());

// === Servir frontend (carpeta public está FUERA de backend) ===
const PUBLIC_DIR = path.resolve(__dirname, "..", "public");
app.use(express.static(PUBLIC_DIR));
console.log("[STATIC] Sirviendo desde:", PUBLIC_DIR);

// --- Health / Ping ---
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/ping", async (_req, res) => {
  try {
    const [dbRow] = await pool.query("SELECT DATABASE() AS db");
    const [contRow] = await pool.query("SELECT COUNT(*) AS n FROM Continente");
    const [paisRow] = await pool.query("SELECT COUNT(*) AS n FROM Pais");
    res.json({
      database: dbRow[0]?.db || null,
      continentes: contRow[0]?.n ?? 0,
      paises: paisRow[0]?.n ?? 0,
    });
  } catch (e) {
    return next(e);
  }
});

// --- Endpoint de inspección del esquema ---
app.get("/api/_meta/schema", async (_req, res) => {
  if (isProd) return res.status(404).send("Not found");

  try {
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

    const [fks] = await pool.query(`
      SELECT
        kcu.TABLE_NAME             AS tabla_hija,
        kcu.COLUMN_NAME            AS columna_hija,
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
    return next(e);
  }
});

// --- Rutas Etapa 3 (solo sin-precio) ---
app.use("/api", require("./src/routes/etapa3/servicios_sin_precios"));

// --- Rutas Etapa 1 ---
app.use("/api", require("./src/routes/etapa1/ubicaciones"));
app.use("/api", require("./src/routes/etapa1/hoteles"));

// --- Rutas Etapa 2 ---
app.use("/api", require("./src/routes/etapa2/tiposervicio"));
app.use("/api", require("./src/routes/etapa2/proveedores"));

const serviciosRouter = require("./src/routes/etapa2/servicios");
app.use("/api", serviciosRouter);

app.use("/api", require("./src/routes/etapa2/alojamientos"));
app.use("/api", require("./src/routes/catalogos"));

// --- Rutas Etapa 3 (Cotizaciones + Precios) ---
app.use("/api", require("./src/routes/etapa3/cotizaciones"));
app.use("/api", require("./src/routes/etapa3/alojamiento-precio"));
app.use("/api", require("./src/routes/etapa3/precios"));
app.use("/api", require("./src/routes/etapa3/hotel_precios"));

// 404 solo para rutas de API
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

// Manejador de errores global (SIEMPRE al final, antes de app.listen)
app.use((err, _req, res, next) => {
  if (res.headersSent) return next(err);

  const status = err.status || 500;

  if (!isProd) {
    console.error("UNCAUGHT ERROR:", err);
    return res.status(status).json({
      error: err.message || "Error interno del servidor",
      stack: err.stack,
    });
  }

  // En producción, log mínimo, sin stack al cliente
  console.error("UNCAUGHT ERROR:", err.message || "Error interno del servidor");
  return res.status(status).json({
    error: "Error interno del servidor",
  });
});

// === Iniciar servidor (AL FINAL) ===
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});

