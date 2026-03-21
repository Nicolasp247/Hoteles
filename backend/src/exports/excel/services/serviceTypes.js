/**
 * Este archivo guarda los IDs de los tipos de servicio.
 *
 * La idea es tenerlos en un solo lugar para que, si mañana agregamos
 * más tipos como hotel, traslado, excursión o tren, no tengamos que
 * buscarlos dentro de varios archivos.
 *
 * Así el sistema queda más ordenado y es más fácil mantenerlo.
 */

const SERVICE_TYPE_IDS = {
  VUELO: 7,
};

module.exports = {
  SERVICE_TYPE_IDS,
};