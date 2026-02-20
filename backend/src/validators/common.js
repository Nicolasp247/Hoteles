// backend/src/validators/common.js
const { z } = require("zod");

const zId = z.coerce.number().int().positive("Debe ser un entero positivo");
const zNonEmpty = z.string().trim().min(1, "No puede estar vacío");
const zYmd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato requerido YYYY-MM-DD")
  .refine((s) => {
    // valida fecha real (evita 2026-02-31)
    const d = new Date(s + "T00:00:00");
    if (Number.isNaN(d.getTime())) return false;
    const [y, m, day] = s.split("-").map(Number);
    return (
      d.getUTCFullYear() === y &&
      d.getUTCMonth() + 1 === m &&
      d.getUTCDate() === day
    );
  }, "Fecha inválida");

const zUrlOptional = z
  .union([z.string().trim().url("URL inválida"), z.literal(""), z.null(), z.undefined()])
  .transform((v) => (v === "" || v === undefined ? null : v));

const zPrecioNullable = z.union([
  z.null(),
  z.coerce.number().min(0, "No puede ser negativo"),
]);

module.exports = {
  z,
  zId,
  zNonEmpty,
  zYmd,
  zUrlOptional,
  zPrecioNullable,
};
