// public/etapa3/cotizacion-editar/mappers/cotizacion-item.mapper.js

// public/etapa3/cotizacion-editar/mappers/cotizacion-item.mapper.js

/**
 * Este archivo se encarga de transformar la respuesta del backend en un objeto
 * más cómodo para trabajar dentro del editor de cotizaciones.
 *
 * La idea es que la pantalla tenga siempre una estructura clara y predecible,
 * aunque el backend devuelva algunos campos con nombres distintos o con valores vacíos.
 */

import {
  esTipoAlojamiento,
  esTipoSinPrecio,
} from "../utils/service-type.js";

import { getServicioTextoFromRow } from "../helpers/service-text.js";

/**
 * Esta función toma una fila del backend y la convierte en el formato
 * que usa el editor por dentro.
 *
 * Aquí también decidimos cosas importantes del comportamiento visual,
 * por ejemplo si el item debe tratarse como alojamiento o si el precio
 * no debe mostrarse directamente.
 */
export function mapRowToItem(
  row,
  {
    nextIdLocal,
    servicioTextoById = new Map(),
  } = {}
) {
  if (typeof nextIdLocal !== "function") {
    throw new Error("mapRowToItem necesita una función nextIdLocal().");
  }

  const tipoServicioId = row?.tipo_servicio_id ?? null;
  const tipoServicio = row?.tipo_servicio || "";

  const esAlojamiento = esTipoAlojamiento(tipoServicioId, tipoServicio);

  const fechaRaw = row?.fecha_servicio ?? "";
  const fechaYmd = String(fechaRaw).substring(0, 10);

  const servicioTexto = getServicioTextoFromRow(row, servicioTextoById);

  let precio = row?.precio_usd ?? null;
  if (esTipoSinPrecio(tipoServicioId, tipoServicio)) {
    precio = null;
  }

  return {
    idLocal: nextIdLocal(),
    id_item: row?.id_item ?? null,
    id_servicio: row?.id_servicio ?? null,
    tipo_servicio_id: tipoServicioId,
    tipo_servicio: tipoServicio,
    ciudad: row?.ciudad ?? "",
    esAlojamiento,
    fechaYmd,
    noches_alojamiento: row?.noches_alojamiento ?? null,
    servicioTexto,
    precio,
    es_opcional: Number(row?.es_opcional) === 1,
  };
}