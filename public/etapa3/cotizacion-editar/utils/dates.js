// public/etapa3/cotizacion-editar/utils/dates.js
/**
 * Este archivo reúne todo lo relacionado con fechas del editor de cotizaciones.
 * La idea es que aquí viva la lógica para leer fechas, sumar días, calcular noches
 * y mostrar textos bonitos en pantalla, sin tener que repetirlo por todo el módulo.
 */

export const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export const DIAS_SEMANA = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

/**
 * Esta función toma una fecha en formato YYYY-MM-DD y la convierte en una fecha
 * que JavaScript pueda manejar bien. Nos sirve como punto de partida para sumar días,
 * comparar fechas o mostrar textos más claros.
 */
export function parseYMD(ymd) {
  const [y, m, d] = String(ymd || "").split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/**
 * Esta función suma o resta días a una fecha y devuelve otra vez el resultado
 * en formato YYYY-MM-DD. Es la que usamos cuando un servicio sube o baja de día.
 */
export function sumarDiasYmd(ymd, dias) {
  const fecha = parseYMD(ymd);
  fecha.setDate(fecha.getDate() + dias);

  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

/**
 * Esta función calcula cuántas noches hay entre una fecha inicial y una final.
 * En alojamiento esto es clave, porque permite validar que el check-out sí esté
 * después del check-in y además ayuda a filtrar servicios correctos.
 */
export function calcularNoches(desdeYmd, hastaYmd) {
  if (!desdeYmd || !hastaYmd) return null;

  const fechaInicio = parseYMD(desdeYmd);
  const fechaFin = parseYMD(hastaYmd);

  const diferenciaMs = fechaFin - fechaInicio;
  const diferenciaDias = Math.floor(diferenciaMs / (1000 * 60 * 60 * 24));

  return diferenciaDias;
}

/**
 * Esta función arma un texto más natural para un rango de alojamiento.
 * Por ejemplo, convierte dos fechas sueltas en algo como:
 * "03 – 05 de mayo de 2026".
 */
export function formatoRangoAlojamiento(desdeYmd, hastaYmd) {
  const fechaInicio = parseYMD(desdeYmd);
  const fechaFin = parseYMD(hastaYmd);

  const diaInicio = String(fechaInicio.getDate()).padStart(2, "0");
  const diaFin = String(fechaFin.getDate()).padStart(2, "0");

  const mesInicio = MESES[fechaInicio.getMonth()];
  const mesFin = MESES[fechaFin.getMonth()];

  const anioInicio = fechaInicio.getFullYear();
  const anioFin = fechaFin.getFullYear();

  if (anioInicio === anioFin && mesInicio === mesFin) {
    return `${diaInicio} – ${diaFin} de ${mesInicio} de ${anioInicio}`;
  }

  if (anioInicio === anioFin) {
    return `${diaInicio} de ${mesInicio} a ${diaFin} de ${mesFin} de ${anioInicio}`;
  }

  return `${diaInicio} de ${mesInicio} de ${anioInicio} a ${diaFin} de ${mesFin} de ${anioFin}`;
}

/**
 * Esta función toma una fecha simple y la muestra de una forma más amigable
 * para el usuario. Es la que convierte algo como "2026-03-25" en un texto
 * tipo "Miércoles, 25 de marzo de 2026".
 */
export function formatoFechaServicio(fechaYmd) {
  const fecha = parseYMD(fechaYmd);

  const diaSemana = DIAS_SEMANA[fecha.getDay()];
  const dia = String(fecha.getDate()).padStart(2, "0");
  const mes = MESES[fecha.getMonth()];
  const anio = fecha.getFullYear();

  const diaSemanaCapitalizado =
    diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);

  return `${diaSemanaCapitalizado}, ${dia} de ${mes} de ${anio}`;
}