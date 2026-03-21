// backend/src/exports/excel/services/cotizacionExcel.service.js

/**
 * Este archivo se encarga de buscar en la base de datos
 * toda la información que necesita el Excel de una cotización.
 *
 * Trae dos grandes bloques:
 * - la cabecera general de la cotización
 * - la lista de servicios que luego se pintan en el Excel
 *
 * La idea es que el builder reciba ya todo junto y solo se enfoque
 * en construir el archivo, sin ponerse a consultar la base de datos.
 */

const pool = require("../../../db");

const GET_COTIZACION_HEADER_QUERY = `
  SELECT 
    ctz.id_cotizacion,
    ctz.nombre_cotizacion,
    ctz.agente,
    ctz.nombre_pasajero,
    ctz.total_pasajeros,
    ctz.ninos_3_11,
    ctz.adultos_19_64,
    ctz.jovenes_12_18,
    ctz.infantes_0_2,
    ctz.adultos_65,
    ctz.destino,
    cont.nombre AS destino_nombre,
    ctz.fecha_viaje
  FROM cotizacion ctz
  LEFT JOIN continente cont ON cont.id = ctz.destino
  WHERE ctz.id_cotizacion = ?
`;

const GET_COTIZACION_ITEMS_QUERY = `
  SELECT
    ci.id_item,
    ci.id_cotizacion,
    ci.id_servicio,
    ci.fecha_servicio,
    ci.orden_dia,
    ci.es_opcional,
    ci.operador_mostrado,
    ci.link_operador,
    ci.titulo_override,
    ci.clase_override,
    ci.idioma_override,
    ci.nota_linea,
    ci.precio_usd,

    s.nombre_wtravel AS nombre_servicio,
    s.descripcion AS descripcion_servicio,
    s.link_reserva AS proveedor_link,
    p.iniciales AS proveedor_iniciales,

    ts.id AS tipo_servicio_id,
    ts.nombre AS tipo_servicio,
    c.nombre AS ciudad,

    v.origen AS vuelo_origen,
    v.destino AS vuelo_destino,
    v.escalas AS vuelo_escalas,
    v.clase AS vuelo_clase,
    v.equipaje AS vuelo_equipaje

  FROM cotizacion_item ci
  JOIN servicio s ON s.id = ci.id_servicio
  JOIN tiposervicio ts ON ts.id = s.id_tipo
  JOIN ciudad c ON c.id = s.id_ciudad
  LEFT JOIN proveedor p ON p.id = s.id_proveedor
  LEFT JOIN vuelo v ON v.id_servicio = s.id
  WHERE ci.id_cotizacion = ?
  ORDER BY ci.fecha_servicio ASC, ci.orden_dia ASC, ci.id_item ASC
`;

/**
 * Esta función busca toda la información necesaria para exportar
 * una cotización a Excel.
 *
 * Devuelve un objeto con:
 * - cabecera: datos generales de la cotización
 * - items: servicios ordenados para pintarlos en el Excel
 *
 * Si la cotización no existe, devuelve null.
 */
async function getCotizacionExportData(idCotizacion) {
  let conn;

  try {
    conn = await pool.getConnection();

    const [headerRows] = await conn.execute(GET_COTIZACION_HEADER_QUERY, [idCotizacion]);

    if (!headerRows.length) {
      return null;
    }

    const cabecera = headerRows[0];

    const [itemRows] = await conn.execute(GET_COTIZACION_ITEMS_QUERY, [idCotizacion]);

    return {
      cabecera,
      items: itemRows,
    };
  } finally {
    try {
      if (conn) conn.release();
    } catch {}
  }
}

module.exports = { getCotizacionExportData };