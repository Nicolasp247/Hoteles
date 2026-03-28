// public/etapa3/cotizacion-editar/features/service-filters.js

/**
 * Este archivo se encarga de todo lo relacionado con los filtros
 * del bloque de selección de servicios.
 *
 * Aquí vive la lógica para:
 * - saber si el tipo actual es alojamiento
 * - decidir si se debe mostrar la fecha hasta
 * - calcular noches cuando aplica
 * - filtrar la lista de servicios disponibles
 * - volver a llenar el select con los resultados
 *
 * La idea es que el archivo principal deje de cargar esta parte
 * y se convierta cada vez más en un punto de coordinación.
 */

import { labelServicio } from "../helpers/service-text.js";
import { calcularNoches } from "../utils/dates.js";

/**
 * Esta función crea todo el bloque de filtros usando las dependencias
 * que le entregue la página principal.
 *
 * Recibe los elementos del DOM, el estado actual y las funciones
 * necesarias para mostrar errores o limpiar mensajes.
 */
export function createServiceFilters({
  filtroContinente,
  filtroPais,
  filtroCiudad,
  filtroTipoServicio,
  wrapperFechaHasta,
  fechaDesdeInput,
  fechaHastaInput,
  selectServicio,
  allServiciosRef,
  serviciosRef,
  nochesFiltroAlojRef,
  mostrarError,
  limpiarError,
  mensajeErrorEl,
  onTipoChangeExtra,
}) {
  /**
   * Esta función revisa si el tipo que está seleccionado en pantalla
   * corresponde a alojamiento.
   *
   * Por ahora sigue mirando el texto visible del select, porque esa es
   * la lógica que ya trae esta pantalla y no queremos romperla aún.
   */
  function esTipoAlojamientoSeleccionado() {
    const opt = filtroTipoServicio?.options?.[filtroTipoServicio.selectedIndex];
    if (!opt) return false;
    return opt.textContent.toLowerCase().includes("aloj");
  }

  /**
   * Esta función muestra u oculta la fecha hasta según el tipo de servicio.
   * Si el tipo no es alojamiento, limpia ese campo y también resetea
   * el filtro de noches.
   */
  function actualizarVisibilidadFechaHasta() {
    if (!wrapperFechaHasta || !fechaHastaInput) return;

    if (esTipoAlojamientoSeleccionado()) {
      wrapperFechaHasta.style.display = "";
    } else {
      wrapperFechaHasta.style.display = "none";
      fechaHastaInput.value = "";
      nochesFiltroAlojRef.value = null;
    }
  }

  /**
   * Esta función rellena el select de servicios con la lista filtrada actual.
   * También deja una opción inicial vacía para que el usuario tenga que elegir.
   */
  function rellenarSelectServicios() {
    if (!selectServicio) return;

    selectServicio.innerHTML = "";
    selectServicio.appendChild(new Option("(Seleccionar servicio)", ""));

    (serviciosRef.value || []).forEach((servicio) => {
      const texto = labelServicio(servicio);
      selectServicio.appendChild(new Option(texto, servicio.id));
    });
  }

  /**
   * Esta función aplica todos los filtros actuales sobre la lista completa
   * de servicios y guarda el resultado en el estado compartido.
   *
   * Si el tipo es alojamiento y ya hay noches calculadas, también aplica
   * ese filtro adicional.
   */
  function filtrarServicios() {
    const idCont = filtroContinente?.value || null;
    const idPais = filtroPais?.value || null;
    const idCiud = filtroCiudad?.value || null;
    const idTipo = filtroTipoServicio?.value || null;

    serviciosRef.value = (allServiciosRef.value || []).filter((servicio) => {
      if (idCont && String(servicio.id_continente ?? "") !== String(idCont)) return false;
      if (idPais && String(servicio.id_pais ?? "") !== String(idPais)) return false;
      if (idCiud && String(servicio.id_ciudad ?? "") !== String(idCiud)) return false;
      if (idTipo && String(servicio.id_tipo ?? "") !== String(idTipo)) return false;

      if (esTipoAlojamientoSeleccionado() && nochesFiltroAlojRef.value != null) {
        const nochesServicio = Number(
          servicio.aloj_noches ??
          servicio.noches ??
          servicio.noches_alojamiento ??
          servicio.alojamiento_noches
        );

        if (!Number.isFinite(nochesServicio) || nochesServicio !== nochesFiltroAlojRef.value) {
          return false;
        }
      }

      return true;
    });

    rellenarSelectServicios();

    if (selectServicio) {
      selectServicio.value = "";
    }
  }

  /**
   * Esta función recalcula el filtro de noches cuando el tipo actual
   * es alojamiento.
   *
   * Si las fechas no son válidas, limpia el valor de noches, muestra
   * un mensaje y vuelve a filtrar para no dejar la pantalla desordenada.
   */
  function actualizarNochesYFiltrarServicios() {
    if (!esTipoAlojamientoSeleccionado()) {
      nochesFiltroAlojRef.value = null;
      return;
    }

    const desde = fechaDesdeInput?.value;
    const hasta = fechaHastaInput?.value;

    if (!desde || !hasta) {
      nochesFiltroAlojRef.value = null;
      filtrarServicios();
      return;
    }

    const noches = calcularNoches(desde, hasta);

    if (!Number.isFinite(noches) || noches < 1) {
      nochesFiltroAlojRef.value = null;
      mostrarError(
        mensajeErrorEl,
        "En alojamiento, la fecha hasta debe ser posterior a la fecha desde (mínimo 1 noche)."
      );
      filtrarServicios();
      return;
    }

    limpiarError(mensajeErrorEl);
    nochesFiltroAlojRef.value = noches;
    filtrarServicios();
  }

  /**
   * Esta función conecta todos los eventos de cambio relacionados
   * con los filtros de servicios.
   *
   * Así dejamos la lógica de reacción al usuario dentro del mismo bloque
   * que controla el filtrado.
   */
  function bindFilterEvents({ cargarPaises, cargarCiudades } = {}) {
    filtroContinente?.addEventListener("change", async () => {
      const idCont = filtroContinente.value || null;

      if (typeof cargarPaises === "function") {
        await cargarPaises(idCont);
      }

      filtrarServicios();
    });

    filtroPais?.addEventListener("change", async () => {
      const idPais = filtroPais.value || null;

      if (typeof cargarCiudades === "function") {
        await cargarCiudades(idPais);
      }

      filtrarServicios();
    });

    filtroCiudad?.addEventListener("change", () => {
      filtrarServicios();
    });

    filtroTipoServicio?.addEventListener("change", () => {
      actualizarVisibilidadFechaHasta();
      actualizarNochesYFiltrarServicios();
      filtrarServicios();

      if (typeof onTipoChangeExtra === "function") {
        onTipoChangeExtra();
      }
    });

    fechaDesdeInput?.addEventListener("change", () => {
      if (esTipoAlojamientoSeleccionado()) {
        actualizarNochesYFiltrarServicios();
      }
    });

    fechaHastaInput?.addEventListener("change", () => {
      if (esTipoAlojamientoSeleccionado()) {
        actualizarNochesYFiltrarServicios();
      }
    });
  }

  return {
    esTipoAlojamientoSeleccionado,
    actualizarVisibilidadFechaHasta,
    actualizarNochesYFiltrarServicios,
    filtrarServicios,
    rellenarSelectServicios,
    bindFilterEvents,
  };
}