//public/etapa3/cotizacion-editar/features/load-cotizacion.js

/**
 * Este archivo se encarga de cargar una cotización ya existente.
 *
 * Su trabajo es pedir la cotización al backend, convertir los items al formato
 * que usa la pantalla y dejar la tabla lista para mostrarse.
 *
 * La idea es que el archivo principal no tenga que encargarse también de leer,
 * transformar y pintar esta parte.
 */

export function createLoadCotizacion({
  idCotizacion,
  headerIdEl,
  getServicioTextoById,
  mapRowToItem,
  resetNextIdLocal,
  nextIdLocal,
  setItems,
  actualizarTablaDesdeEstado,
  mostrarError,
  mensajeErrorEl,
}) {
  /**
   * Esta función carga la cotización completa desde el backend.
   *
   * Si todo sale bien:
   * - actualiza el título
   * - reinicia el contador local
   * - transforma los items
   * - guarda el nuevo estado
   * - vuelve a pintar la tabla
   */
  async function cargarCotizacionExistente() {
    if (!idCotizacion) return;

    try {
      const resp = await fetch(`/api/cotizaciones/${idCotizacion}`);
      const data = await resp.json();

      if (!data.ok) {
        console.warn("No se pudo cargar cotización:", data.mensaje);
        return;
      }

      const cabecera = data.cabecera || data.cotizacion;
      if (cabecera?.nombre_cotizacion && headerIdEl) {
        headerIdEl.textContent = cabecera.nombre_cotizacion;
      }

      resetNextIdLocal();

      const lista = data.items || [];
      const servicioTextoById = getServicioTextoById();

      const nuevosItems = lista.map((row) =>
        mapRowToItem(row, {
          nextIdLocal,
          servicioTextoById,
        })
      );

      setItems(nuevosItems);
      actualizarTablaDesdeEstado();
    } catch (err) {
      console.error("Error cargando cotización existente", err);

      if (typeof mostrarError === "function") {
        mostrarError(
          mensajeErrorEl,
          "No se pudo cargar la cotización: " + err.message
        );
      }
    }
  }

  return {
    cargarCotizacionExistente,
  };
}