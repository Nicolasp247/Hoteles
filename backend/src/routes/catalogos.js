// backend/src/routes/catalogos.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

// Lee valores ENUM desde information_schema
async function getEnumValues(table, column) {
  const [rows] = await pool.execute(
    `
    SELECT COLUMN_TYPE
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
    `,
    [table, column]
  );

  const ct = rows?.[0]?.COLUMN_TYPE || "";
  // ct: enum('A','B','C')
  const m = ct.match(/^enum\((.*)\)$/i);
  if (!m) return [];
  return m[1]
    .split(",")
    .map(s => s.trim().replace(/^'/, "").replace(/'$/, "").replace(/''/g, "'"));
}

// Lista catálogo por grupo
router.get("/catalogos/:grupo", async (req, res) => {
  try {
    const grupo = String(req.params.grupo || "").trim();
    if (!grupo) return res.status(400).json({ ok: false, mensaje: "grupo requerido" });

    const [rows] = await pool.execute(
      `SELECT valor FROM catalogo_opcion WHERE grupo=? AND activo=1 ORDER BY valor ASC`,
      [grupo]
    );

    res.json({ ok: true, grupo, valores: rows.map(r => r.valor) });
  } catch (e) {
    console.error("GET /catalogos/:grupo", e);
    res.status(500).json({ ok: false, mensaje: "Error leyendo catálogo", error: e.message });
  }
});

// Devuelve todo lo que necesita el front (enums + catálogos relevantes)
router.get("/catalogos/config", async (_req, res) => {
  try {
    const [
      enumRegimen,
      enumCatHotel,
      enumCatHab,
      enumTipoEntrada
    ] = await Promise.all([
      getEnumValues("alojamiento", "regimen"),
      getEnumValues("alojamiento", "categoria_hotel"),
      getEnumValues("alojamiento", "categoria_hab"),
      getEnumValues("boleto_entrada", "tipo_entrada"),
    ]);

    async function getCat(grupo) {
      const [rows] = await pool.execute(
        `SELECT valor FROM catalogo_opcion WHERE grupo=? AND activo=1 ORDER BY valor ASC`,
        [grupo]
      );
      return rows.map(r => r.valor);
    }

    const [
      catBoletoTipoEntrada,
      catAlojRegimen,
      catAlojCatHotel,
      catAlojCatHab
    ] = await Promise.all([
      getCat("boleto_tipo_entrada_otro"),
      getCat("aloj_regimen_otro"),
      getCat("aloj_categoria_hotel_otro"),
      getCat("aloj_categoria_hab_otro")
    ]);

    res.json({
      ok: true,
      enums: {
        alojamiento: {
          regimen: enumRegimen,
          categoria_hotel: enumCatHotel,
          categoria_hab: enumCatHab
        },
        boleto_entrada: {
          tipo_entrada: enumTipoEntrada
        }
      },
      catalogos: {
        boleto_tipo_entrada_otro: catBoletoTipoEntrada,
        aloj_regimen_otro: catAlojRegimen,
        aloj_categoria_hotel_otro: catAlojCatHotel,
        aloj_categoria_hab_otro: catAlojCatHab
      }
    });
  } catch (e) {
    console.error("GET /catalogos/config", e);
    res.status(500).json({ ok: false, mensaje: "Error en config de catálogos", error: e.message });
  }
});

router.post("/catalogos/:grupo", async (req, res) => {
  try {
    const grupo = String(req.params.grupo || "").trim();
    let valor = String(req.body?.valor || "").trim();

    if (!grupo) return res.status(400).json({ ok:false, mensaje:"grupo requerido" });
    if (!valor) return res.status(400).json({ ok:false, mensaje:"valor requerido" });

    // Normaliza (si quieres para alojamiento, en código)
    valor = valor.toUpperCase();

    await pool.execute(
      `
      INSERT INTO catalogo_opcion (grupo, valor, activo)
      VALUES (?, ?, 1)
      ON DUPLICATE KEY UPDATE activo = 1
      `,
      [grupo, valor]
    );

    return res.json({ ok:true, grupo, valor });
  } catch (e) {
    console.error("POST /catalogos/:grupo", e);
    return res.status(500).json({ ok:false, mensaje:"Error guardando catálogo", error:e.message });
  }
});

module.exports = router;
