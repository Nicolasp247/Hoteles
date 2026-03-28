// public/etapa3/cotizacion-editar/helpers/messages.js

/**
 * Este archivo reúne ayudas pequeñas para mostrar mensajes en pantalla.
 * La idea es no repetir por todo el proyecto la lógica de "si existe el elemento,
 * escribe el texto; si no existe, no pasa nada".
 *
 * Son funciones muy simples, pero ayudan a que el resto del código quede
 * más limpio y fácil de leer.
 */

/**
 * Esta función escribe un mensaje en el espacio de error principal.
 * Si el contenedor no existe, simplemente no hace nada.
 */
export function mostrarError(elementoMensaje, texto) {
  if (!elementoMensaje) return;
  elementoMensaje.textContent = texto || "";
}

/**
 * Esta función limpia el mensaje de error principal.
 * Sirve cuando queremos dejar la pantalla en blanco antes de una nueva acción.
 */
export function limpiarError(elementoMensaje) {
  if (!elementoMensaje) return;
  elementoMensaje.textContent = "";
}

/**
 * Esta función escribe un mensaje corto en el bloque del mini-form.
 * La usamos para avisos como validaciones, éxito o errores al crear un servicio rápido.
 */
export function mostrarMensajeCrearServicio(elementoMensaje, texto) {
  if (!elementoMensaje) return;
  elementoMensaje.textContent = texto || "";
}

/**
 * Esta función limpia el mensaje del mini-form.
 * Es útil cuando abrimos o cerramos el panel y no queremos dejar mensajes viejos colgados.
 */
export function limpiarMensajeCrearServicio(elementoMensaje) {
  if (!elementoMensaje) return;
  elementoMensaje.textContent = "";
}