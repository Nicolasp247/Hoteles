// public/etapa3/cotizacion-editar/helpers/export.js

/**
 * Este archivo guarda la acción de exportar la cotización a Excel.
 * Es una función pequeña, pero separarla ayuda a que la página principal
 * no se llene de tareas que no necesitan vivir dentro del flujo grande.
 */

/**
 * Esta función abre la exportación en una nueva pestaña.
 * Si falta el ID de la cotización, muestra una alerta sencilla.
 */
export function exportarExcelCotizacion(idCotizacion) {
  if (!idCotizacion) {
    alert("No hay cotización cargada");
    return;
  }

  window.open(`/api/exports/cotizaciones/${idCotizacion}.xlsx`, "_blank");
}