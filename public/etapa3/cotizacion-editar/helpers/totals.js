// public/etapa3/cotizacion-editar/helpers/totals.js

/**
 * Este archivo se encarga de calcular el total visible de la cotización.
 * La regla actual es simple: sumar precios válidos y no contar los opcionales.
 */

/**
 * Esta función suma el total de los items y, si recibe un input de salida,
 * también deja el valor escrito allí con dos decimales.
 */
export function recalcularTotal(items = [], totalUsdInput = null) {
  let total = 0;

  (items || []).forEach((item) => {
    if (item?.es_opcional) return;

    const precio = Number(item?.precio);
    if (!Number.isNaN(precio) && precio > 0) {
      total += precio;
    }
  });

  if (totalUsdInput) {
    totalUsdInput.value = total.toFixed(2);
  }

  return total;
}