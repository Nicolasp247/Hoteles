// backend/src/routes/catalogos.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

// ✅ Pro: una sola fuente de verdad (NO duplicar funciones aquí)
const catalogoNormalize = require("../utils/catalogo-normalize");

// 🔒 Blindaje: si el require sale mal, fallamos con error claro (no con cosas raras)
const normalizeCatalogValue = catalogoNormalize?.normalizeCatalogValue;
const computeValorNorm = catalogoNormalize?.computeValorNorm;
const formatCatalogValueByGroup = catalogoNormalize?.formatCatalogValueByGroup;

if (
  typeof normalizeCatalogValue !== "function" ||
  typeof computeValorNorm !== "function" ||
  typeof formatCatalogValueByGroup !== "function"
) {
  throw new Error(
    "[catalogos.js] utils/catalogo-normalize no exporta funciones válidas. Revisa module.exports en backend/src/utils/catalogo-normalize.js"
  );
}

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
    .map((s) => s.trim().replace(/^'/, "").replace(/'$/, "").replace(/''/g, "'"));
}

// Helper: detectar si existe columna "activo" (para no reventar si no está)
let _hasActivo = null;
async function hasActivoColumn() {
  if (_hasActivo !== null) return _hasActivo;
  const [rows] = await pool.execute(
    `
    SELECT 1 AS ok
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'catalogo_opcion'
      AND COLUMN_NAME = 'activo'
    LIMIT 1
    `
  );
  _hasActivo = rows.length > 0;
  return _hasActivo;
}

function buildWhereActivoSql() {
  // Si existe activo, lo usamos. Si no, no lo referenciamos.
  return _hasActivo ? " AND activo = 1 " : "";
}

// Lista catálogo por grupo
router.get("/catalogos/:grupo", async (req, res) => {
  try {
    const grupo = String(req.params.grupo || "").trim();
    if (!grupo) return res.status(400).json({ ok: false, mensaje: "grupo requerido" });

    await hasActivoColumn();

    const [rows] = await pool.execute(
      `
      SELECT valor
      FROM catalogo_opcion
      WHERE grupo = ?
        ${buildWhereActivoSql()}
        AND valor IS NOT NULL
        AND TRIM(valor) <> ''
      ORDER BY valor ASC
      `,
      [grupo]
    );

    res.json({ ok: true, grupo, valores: rows.map((r) => r.valor) });
  } catch (e) {
    console.error("GET /catalogos/:grupo", e);
    res.status(500).json({ ok: false, mensaje: "Error leyendo catálogo", error: e.message });
  }
});

// Devuelve todo lo que necesita el front (enums + catálogos relevantes)
router.get("/catalogos/config", async (_req, res) => {
  try {
    await hasActivoColumn();

    const [enumRegimen, enumCatHotel, enumCatHab, enumTipoEntrada] = await Promise.all([
      getEnumValues("alojamiento", "regimen"),
      getEnumValues("alojamiento", "categoria_hotel"),
      getEnumValues("alojamiento", "categoria_hab"),
      getEnumValues("boleto_entrada", "tipo_entrada"),
    ]);

    async function getCat(grupo) {
      const [rows] = await pool.execute(
        `
        SELECT valor
        FROM catalogo_opcion
        WHERE grupo = ?
          ${buildWhereActivoSql()}
          AND valor IS NOT NULL
          AND TRIM(valor) <> ''
        ORDER BY valor ASC
        `,
        [grupo]
      );
      return rows.map((r) => r.valor);
    }

    const [catBoletoTipoEntrada, catAlojRegimen, catAlojCatHotel, catAlojCatHab] = await Promise.all([
      getCat("boleto_tipo_entrada_otro"),
      getCat("aloj_regimen_otro"),
      getCat("aloj_categoria_hotel_otro"),
      getCat("aloj_categoria_hab_otro"),
    ]);

    res.json({
      ok: true,
      enums: {
        alojamiento: {
          regimen: enumRegimen,
          categoria_hotel: enumCatHotel,
          categoria_hab: enumCatHab,
        },
        boleto_entrada: {
          tipo_entrada: enumTipoEntrada,
        },
      },
      catalogos: {
        boleto_tipo_entrada_otro: catBoletoTipoEntrada,
        aloj_regimen_otro: catAlojRegimen,
        aloj_categoria_hotel_otro: catAlojCatHotel,
        aloj_categoria_hab_otro: catAlojCatHab,
      },
    });
  } catch (e) {
    console.error("GET /catalogos/config", e);
    res.status(500).json({ ok: false, mensaje: "Error en config de catálogos", error: e.message });
  }
});

router.post("/catalogos/:grupo", async (req, res) => {
  try {
    await hasActivoColumn();

    const grupo = String(req.params.grupo || "").trim();
    const rawValor = req.body?.valor;

    if (!grupo) return res.status(400).json({ ok: false, mensaje: "grupo requerido" });

    // ✅ Parte C: formateo inteligente por grupo (idiomas, códigos, siglas)
    const valor = formatCatalogValueByGroup(grupo, rawValor);
    if (!valor) return res.status(400).json({ ok: false, mensaje: "valor requerido" });

    // ✅ Parte B PRO: valor_norm para UNIQUE(grupo, valor_norm)
    const valor_norm = computeValorNorm(valor);

    // Si existe activo, lo activamos.
    // Si no existe, insert/update sin tocar activo.
    if (_hasActivo) {
      await pool.execute(
        `
        INSERT INTO catalogo_opcion (grupo, valor, valor_norm, activo)
        VALUES (?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE
          activo = 1
        `,
        [grupo, valor, valor_norm]
      );
    } else {
      await pool.execute(
        `
        INSERT INTO catalogo_opcion (grupo, valor, valor_norm)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
          valor = valor
        `,
        [grupo, valor, valor_norm]
      );
    }

    return res.json({ ok: true, grupo, valor });
  } catch (e) {
    console.error("POST /catalogos/:grupo", e);

    if (e && (e.code === "ER_DUP_ENTRY" || String(e.message || "").includes("ER_DUP_ENTRY"))) {
      return res.json({ ok: true, mensaje: "Ya existía (por formato)." });
    }

    return res.status(500).json({ ok: false, mensaje: "Error guardando catálogo", error: e.message });
  }
});

module.exports = router;
