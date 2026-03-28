// public/etapa3/cotizacion-editar/helpers/service-text.js

/**
 * Este archivo concentra la lógica para sacar el texto visible de un servicio.
 * Parece una tontería, pero en este módulo ese nombre se usa en varios puntos:
 * - en el mapa de servicios cargados
 * - en la tabla de la cotización
 * - en los selects
 * - en el respaldo cuando el backend no manda el texto completo
 *
 * Tener esta lógica en un solo lugar evita inconsistencias y textos armados distinto
 * en cada parte.
 */

/**
 * Esta función construye el texto visible de un servicio usando el objeto completo.
 * Primero intenta con el texto ya preparado. Si no existe, cae al nombre interno.
 * Y si tampoco existe, deja una etiqueta simple con el ID.
 */
export function labelServicio(servicio) {
  return (
    (servicio?.servicio_texto || "").trim() ||
    (servicio?.nombre_wtravel || "").trim() ||
    `Servicio #${servicio?.id ?? "?"}`
  );
}

/**
 * Esta función arma un mapa rápido de id_servicio -> texto visible.
 * Así luego es más fácil completar nombres cuando algún endpoint no devuelve
 * el texto completo del servicio.
 */
export function buildServicioTextoMap(servicios = []) {
  return new Map(
    (servicios || []).map((servicio) => [
      String(servicio.id),
      labelServicio(servicio),
    ])
  );
}

/**
 * Esta función intenta sacar el mejor texto visible posible para una fila de cotización.
 * Primero revisa si la fila ya lo trae directo.
 * Si no, busca en el mapa cargado.
 * Y si tampoco aparece, prueba con nombres alternos.
 */
export function getServicioTextoFromRow(row, servicioTextoById = new Map()) {
  const textoDirecto = (row?.servicio_texto || "").trim();
  if (textoDirecto) return textoDirecto;

  const idServicio = row?.id_servicio != null ? String(row.id_servicio) : null;
  if (idServicio && servicioTextoById.has(idServicio)) {
    return servicioTextoById.get(idServicio);
  }

  const textoAlterno =
    (row?.nombre_servicio || "").trim() ||
    (row?.nombre_wtravel || "").trim() ||
    (row?.nombre || "").trim();

  return textoAlterno || "";
}