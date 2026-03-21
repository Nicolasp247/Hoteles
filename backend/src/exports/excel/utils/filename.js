// backend/src/exports/excel/utils/filename.js
/**
 * Este archivo se encarga de limpiar y preparar
 * los nombres de archivo para que sean válidos
 * al momento de descargar el Excel.
 *
 * Evita caracteres problemáticos y asegura
 * que siempre exista un nombre válido.
 */

const MAX_FILENAME_LENGTH = 140;
const INVALID_FILENAME_CHARS_REGEX = /[<>:"/\\|?*\x00-\x1F]/g;

/**
 * Esta función recibe un nombre y lo transforma
 * en un nombre seguro para usar como archivo.
 *
 * - elimina caracteres inválidos
 * - normaliza espacios
 * - limita la longitud
 * - asegura un valor por defecto si queda vacío
 */
function safeFilename(name) {
  const base = String(name ?? "export")
    .trim()
    .replace(INVALID_FILENAME_CHARS_REGEX, "")
    .replace(/\s+/g, " ")
    .slice(0, MAX_FILENAME_LENGTH);

  return base || "export";
}

module.exports = { safeFilename };