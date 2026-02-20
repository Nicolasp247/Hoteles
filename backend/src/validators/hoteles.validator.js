// backend/src/validators/hoteles.validator.js
const { z, zId, zNonEmpty, zUrlOptional } = require("./common");

const zEstrellas = z.coerce
  .number()
  .min(0, "estrellas debe ser >= 0")
  .max(5, "estrellas debe ser <= 5");

const zScore = z
  .union([z.null(), z.literal(""), z.undefined(), z.coerce.number()])
  .transform((v) => (v === "" || v === undefined ? null : v))
  .refine((v) => v === null || (typeof v === "number" && v >= 0 && v <= 10), {
    message: "score debe estar entre 0 y 10 (o null)",
  });

const zZonasItem = z.object({
  id_zona: zId,
  metros: z
    .union([z.null(), z.literal(""), z.undefined(), z.coerce.number()])
    .transform((v) => (v === "" || v === undefined ? null : v))
    .refine((v) => v === null || (typeof v === "number" && v >= 0), {
      message: "metros debe ser >= 0 (o null)",
    }),
});

const schemaHotelCreate = z.object({
  nombre: zNonEmpty.transform((v) => v.toUpperCase()),
  estrellas: zEstrellas,
  booking_score: zScore,
  tripadvisor_score: zScore,
  descripcion: z.string().trim().max(2000).optional().nullable().transform((v) => (v ? v : null)),
  link_booking: zUrlOptional,
  link_tripadvisor: zUrlOptional,
  zonas: z.array(zZonasItem).min(1, "Debes seleccionar al menos una zona"),
  id_ciudad: zId,
});

const schemaHotelUpdate = z.object({
  nombre: zNonEmpty.transform((v) => v.toUpperCase()),
  estrellas: zEstrellas,
  booking_score: zScore,
  tripadvisor_score: zScore,
  descripcion: z.string().trim().max(2000).optional().nullable().transform((v) => (v ? v : null)),
  link_booking: zUrlOptional,
  link_tripadvisor: zUrlOptional,
  zonas: z.array(zZonasItem).min(1, "Debes seleccionar al menos una zona"),
});

const schemaHotelIdParams = z.object({
  id: zId,
});

module.exports = {
  schemaHotelCreate,
  schemaHotelUpdate,
  schemaHotelIdParams,
};
