//hoteles/backend/src/exports/excel/services/serviceTypes.js
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
  ALOJAMIENTO: 1,
  VISITA: 2,
  TRASLADO: 3,
  EXCURSION: 4,
  BOLETO_ENTRADA: 5,
  TREN: 6,
  VUELO: 7,
};

const VISIT_SERVICE_TYPE_IDS = [
  SERVICE_TYPE_IDS.VISITA,
  SERVICE_TYPE_IDS.EXCURSION,
  SERVICE_TYPE_IDS.BOLETO_ENTRADA,
];

module.exports = {
  SERVICE_TYPE_IDS,
  VISIT_SERVICE_TYPE_IDS,
};