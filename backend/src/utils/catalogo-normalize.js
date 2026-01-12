// backend/src/utils/catalogo-normalize.js

// Normaliza espacios: "  Busán   Centro  " -> "Busán Centro"
function normalizeCatalogValue(v) {
  return String(v ?? "").trim().replace(/\s+/g, " ");
}

// Clave normalizada para evitar duplicados por formato (VIP/Vip/vip)
function computeValorNorm(v) {
  return normalizeCatalogValue(v).toLowerCase();
}

// Title-case suave para idiomas: "ESPAÑOL" -> "Español"
function toTitleSoft(s) {
  const t = normalizeCatalogValue(s);
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

// Decide cómo “se ve” el valor según el grupo.
// OJO: aquí NO tocamos acentos ni hacemos cosas agresivas.
function formatCatalogValueByGroup(grupo, valor) {
  const v = normalizeCatalogValue(valor);
  if (!v) return v;

  const g = String(grupo || "").trim().toLowerCase();

  // 1) Idiomas: Español, Inglés, Francés...
  if (g === "idiomas") return toTitleSoft(v);

  // 2) Valores tipo código (se usan como enums o llaves): AEROPUERTO_HOTEL
  // Si el valor contiene "_" asumimos que es código y lo ponemos en MAYÚSCULAS.
  if (v.includes("_")) return v.toUpperCase();

  // 3) Siglas cortas: VIP, DBL, SGL, TPL...
  // Solo lo forzamos si el GRUPO tiene pinta de “categoría/código”.
  if (v.length <= 5 && /^[a-zA-Z]+$/.test(v)) {
    const likelyAcronymGroup =
      g.includes("clase") ||
      g.includes("equipaje") ||
      g.includes("tipo") ||
      g.includes("categoria") ||
      g.includes("regimen") ||
      g.includes("vip") ||
      g.includes("habitacion") ||
      g.includes("hab");

    if (likelyAcronymGroup) return v.toUpperCase();
  }

  // 4) Default: solo normalización de espacios
  return v;
}

module.exports = {
  normalizeCatalogValue,
  computeValorNorm,
  formatCatalogValueByGroup,
};
