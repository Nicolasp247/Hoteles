// public/etapa3/cotizacion-editar/utils/service-type.js
/**
 * Este archivo reúne toda la lógica para reconocer tipos de servicio.
 * La idea es dejar de depender tanto del texto visible del tipo y usar,
 * siempre que sea posible, el ID real que viene de la base de datos.
 *
 * Mientras terminamos de refactorizar todo el módulo, este archivo trabaja
 * de forma híbrida: primero intenta resolver por ID y, si todavía no existe
 * ese dato en alguna parte del flujo, usa el texto como respaldo.
 */

/**
 * Aquí guardamos los IDs reales de los tipos de servicio.
 * Tenerlos juntos evita números sueltos por todo el proyecto y hace
 * mucho más fácil mantener la lógica si mañana crecen los casos.
 */
export const SERVICE_TYPE_IDS = {
  ALOJAMIENTO: 1,
  VISITA: 2,
  TRASLADO: 3,
  EXCURSION: 4,
  BOLETO_ENTRADA: 5,
  TREN: 6,
  VUELO: 7,
};

/**
 * Algunos tipos se comportan como la misma familia visual o comercial.
 * Por ejemplo, visita, excursión y boleto de entrada suelen ir por el mismo lado
 * dentro de la cotización, así que los agrupamos aquí.
 */
export const VISIT_SERVICE_TYPE_IDS = [
  SERVICE_TYPE_IDS.VISITA,
  SERVICE_TYPE_IDS.EXCURSION,
  SERVICE_TYPE_IDS.BOLETO_ENTRADA,
];

/**
 * Esta función deja el texto limpio para compararlo sin pelear con mayúsculas,
 * espacios o valores vacíos. Es el respaldo cuando todavía no tenemos ID.
 */
export function normalizarTipoServicio(tipoNombre) {
  return String(tipoNombre || "").trim().toLowerCase();
}

/**
 * Esta función intenta convertir cualquier valor en un número de tipo válido.
 * Si no puede, devuelve null para que el resto del código sepa que no hay ID usable.
 */
export function parseTipoServicioId(tipoServicioId) {
  const n = Number(tipoServicioId);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Esta función revisa si el tipo recibido coincide con un ID concreto.
 * Primero intenta por ID. Si no hay ID disponible, usa texto como plan B.
 */
export function tipoCoincide(tipoServicioId, tipoNombre, { id, texto }) {
  const idNormalizado = parseTipoServicioId(tipoServicioId);
  if (idNormalizado !== null) {
    return idNormalizado === id;
  }

  return normalizarTipoServicio(tipoNombre).includes(texto);
}

/**
 * Esta función responde si el servicio es de alojamiento.
 * Primero mira el ID real y, si no lo tiene, cae a comparación por texto.
 */
export function esTipoAlojamiento(tipoServicioId, tipoNombre = "") {
  return tipoCoincide(tipoServicioId, tipoNombre, {
    id: SERVICE_TYPE_IDS.ALOJAMIENTO,
    texto: "aloj",
  });
}

/**
 * Esta función responde si el servicio es de boleto o entrada.
 */
export function esTipoBoleto(tipoServicioId, tipoNombre = "") {
  return tipoCoincide(tipoServicioId, tipoNombre, {
    id: SERVICE_TYPE_IDS.BOLETO_ENTRADA,
    texto: "boleto",
  });
}

/**
 * Esta función responde si el servicio es de vuelo.
 */
export function esTipoVuelo(tipoServicioId, tipoNombre = "") {
  return tipoCoincide(tipoServicioId, tipoNombre, {
    id: SERVICE_TYPE_IDS.VUELO,
    texto: "vuelo",
  });
}

/**
 * Esta función responde si el servicio es de tren.
 */
export function esTipoTren(tipoServicioId, tipoNombre = "") {
  return tipoCoincide(tipoServicioId, tipoNombre, {
    id: SERVICE_TYPE_IDS.TREN,
    texto: "tren",
  });
}

/**
 * Esta función responde si el servicio es de traslado.
 */
export function esTipoTraslado(tipoServicioId, tipoNombre = "") {
  return tipoCoincide(tipoServicioId, tipoNombre, {
    id: SERVICE_TYPE_IDS.TRASLADO,
    texto: "trasl",
  });
}

/**
 * Esta función responde si el servicio entra en la familia de visitas.
 * Si hay ID, usa la lista oficial. Si no, revisa palabras del nombre.
 */
export function esTipoVisita(tipoServicioId, tipoNombre = "") {
  const idNormalizado = parseTipoServicioId(tipoServicioId);
  if (idNormalizado !== null) {
    return VISIT_SERVICE_TYPE_IDS.includes(idNormalizado);
  }

  const tipo = normalizarTipoServicio(tipoNombre);
  return (
    tipo.includes("excurs") ||
    tipo.includes("visita") ||
    tipo.includes("tour") ||
    tipo.includes("boleto")
  );
}

/**
 * Esta función responde si el tipo no debe mostrar precio directo en pantalla.
 * En la lógica actual esto aplica para vuelo y tren.
 */
export function esTipoSinPrecio(tipoServicioId, tipoNombre = "") {
  return (
    esTipoVuelo(tipoServicioId, tipoNombre) ||
    esTipoTren(tipoServicioId, tipoNombre)
  );
}