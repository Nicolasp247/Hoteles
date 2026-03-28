// public/etapa3/cotizacion-editar/api/itemp-persistence.js

/**
 * Este archivo reúne acciones pequeñas para guardar cambios de items
 * en el backend. Por ahora se ocupa de fecha y orden.
 *
 * Más adelante, si quieres, esto puede crecer y convertirse en una capa API
 * más completa de cotizaciones.
 */

/**
 * Esta función envía al backend el orden actual de los items.
 * No modifica la lista por sí sola, solo persiste la posición
 * que ya existe en memoria.
 */
export async function guardarOrdenEnBackend(idCotizacion, items = []) {
  if (!idCotizacion) return;

  try {
    const payload = {
      orden: (items || []).map((item, index) => ({
        id_item: item.id_item,
        orden_dia: index + 1,
      })),
    };

    const resp = await fetch(`/api/cotizaciones/${idCotizacion}/items/orden`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok || !data.ok) {
      console.warn(
        "No se pudo guardar el orden:",
        data.mensaje || data.error || "Error"
      );
    }
  } catch (error) {
    console.error("Error guardando orden:", error);
  }
}

/**
 * Esta función guarda la nueva fecha de un item concreto.
 * Es útil cuando el usuario sube o baja un servicio en la tabla.
 */
export async function guardarFechaItemEnBackend(idItem, fechaYmd) {
  if (!idItem) return;

  try {
    const resp = await fetch(`/api/cotizaciones/items/${idItem}/fecha`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fecha_servicio: fechaYmd }),
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok || !data.ok) {
      console.warn(
        "No se pudo guardar la fecha:",
        data.mensaje || data.error || "Error"
      );
    }
  } catch (error) {
    console.error("Error guardando fecha:", error);
  }
}