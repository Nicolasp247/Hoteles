// public/etapa3/cotizacion-editar/features/item-actions.js

/**
 * Este archivo reúne las acciones que el usuario puede hacer sobre los items
 * ya insertados en la cotización.
 *
 * Aquí vive la lógica de mover un servicio de día, reordenarlo cuando toca
 * y eliminarlo de la cotización. La idea es que el archivo principal deje
 * de cargar con estas tareas y se vuelva más un coordinador que un todoterreno.
 */

import { sumarDiasYmd } from "../utils/dates.js";

/**
 * Esta función fabrica las acciones de la tabla usando las dependencias
 * que le pase la página principal.
 *
 * En vez de depender de variables sueltas por todo lado, recibe todo lo que necesita:
 * el ID de la cotización, la lista de items, cómo repintar la tabla,
 * cómo mostrar errores y cómo guardar cambios en el backend.
 */
export function createItemActions({
  idCotizacion,
  items,
  actualizarTablaDesdeEstado,
  mostrarError,
  mensajeErrorEl,
  guardarFechaItemEnBackend,
  guardarOrdenEnBackend,
}) {
  /**
   * Esta función mueve un item un día hacia arriba o hacia abajo.
   *
   * Primero le cambia la fecha, luego guarda ese cambio en backend y después
   * revisa si además debe cambiar de posición con el vecino.
   * Si sí cambia de lugar, guarda también el nuevo orden.
   */
  async function moverItem(idx, delta) {
    if (idx < 0 || idx >= items.length) return;

    const moved = items[idx];
    if (!moved || !moved.fechaYmd) return;

    const nuevaFecha = sumarDiasYmd(moved.fechaYmd, delta);
    moved.fechaYmd = nuevaFecha;

    await guardarFechaItemEnBackend(moved.id_item, moved.fechaYmd);

    let swapped = false;

    if (delta === -1 && idx > 0) {
      const prev = items[idx - 1];
      if (prev?.fechaYmd && moved.fechaYmd < prev.fechaYmd) {
        items[idx] = prev;
        items[idx - 1] = moved;
        swapped = true;
      }
    }

    if (delta === +1 && idx < items.length - 1) {
      const next = items[idx + 1];
      if (next?.fechaYmd && moved.fechaYmd > next.fechaYmd) {
        items[idx] = next;
        items[idx + 1] = moved;
        swapped = true;
      }
    }

    actualizarTablaDesdeEstado();

    if (swapped) {
      await guardarOrdenEnBackend(idCotizacion, items);
    }
  }

  /**
   * Esta función elimina un item de la cotización después de pedir confirmación.
   *
   * Si el backend responde bien, lo saca de la lista local y vuelve a pintar la tabla.
   * Si algo falla, muestra un mensaje claro en pantalla.
   */
  async function eliminarItem(item, index) {
    const seguro = window.confirm("¿Eliminar este servicio de la cotización?");
    if (!seguro) return;

    try {
      const resp = await fetch(`/api/cotizaciones/items/${item.id_item}`, {
        method: "DELETE",
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok || !data.ok) {
        throw new Error(data.mensaje || data.error || "Error al eliminar el item.");
      }

      items.splice(index, 1);
      actualizarTablaDesdeEstado();
    } catch (err) {
      console.error(err);
      mostrarError(mensajeErrorEl, "No se pudo eliminar el servicio: " + err.message);
    }
  }

  return {
    moverItem,
    eliminarItem,
  };
}