// public/etapa3/cotizacion-editar/helpers/catalog-cache.js

import { fetchLista } from "./http.js";

/**
 * Este archivo se encarga de manejar el caché de catálogos.
 * La idea es que, si ya pedimos una lista como idiomas, tiempo de servicio
 * o puntos de origen, no tengamos que volver a pedirla cada vez.
 *
 * También deja centralizada la forma de normalizar lo que llega del backend,
 * porque a veces puede venir como texto plano y otras veces como objeto.
 */

const catalogCache = Object.create(null);

/**
 * Esta función limpia un catálogo concreto del caché.
 * Sirve cuando acabamos de crear un valor nuevo y queremos obligar a que
 * la próxima lectura venga fresca desde el backend.
 */
export function invalidateCatalog(grupo) {
  if (!grupo) return;
  delete catalogCache[grupo];
}

/**
 * Esta función vacía por completo el caché de catálogos.
 * No será la más usada en el día a día, pero es útil dejarla lista
 * por si más adelante se necesita refrescar todo de una sola vez.
 */
export function clearCatalogCache() {
  Object.keys(catalogCache).forEach((grupo) => {
    delete catalogCache[grupo];
  });
}

/**
 * Esta función devuelve una copia simple del caché actual.
 * Es útil para depurar o revisar qué catálogos ya fueron cargados.
 */
export function getCatalogCacheSnapshot() {
  return { ...catalogCache };
}

/**
 * Esta función convierte la lista del backend a un formato más consistente.
 * Si viene un texto, lo transforma en objeto. Si el valor no sirve, lo descarta.
 */
export function normalizarCatalogo(lista = []) {
  return (lista || [])
    .map((item) => (typeof item === "string" ? { valor: item } : item))
    .filter((item) => item?.valor);
}

/**
 * Esta función carga un catálogo por nombre.
 * Si ya existe en memoria, lo devuelve desde ahí.
 * Si no existe, lo pide al backend, lo normaliza y lo guarda para reutilizarlo.
 */
export async function cargarCatalogo(grupo) {
  if (!grupo) {
    throw new Error("Debes indicar el nombre del catálogo.");
  }

  if (catalogCache[grupo]) {
    return catalogCache[grupo];
  }

  const lista = await fetchLista(`/api/catalogos/${encodeURIComponent(grupo)}`, [
    "opciones",
    "valores",
    "items",
  ]);

  const catalogoNormalizado = normalizarCatalogo(lista);
  catalogCache[grupo] = catalogoNormalizado;

  return catalogoNormalizado;
}