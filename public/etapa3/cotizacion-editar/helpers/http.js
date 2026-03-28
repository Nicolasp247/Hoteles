// public/etapa3/cotizacion-editar/helpers/http.js

/**
 * Este archivo agrupa ayudas para leer respuestas del backend de una forma más ordenada.
 * No busca hacer una capa enorme, solo concentrar la lógica común para:
 * - llamar una URL
 * - validar que la respuesta venga bien
 * - aceptar algunos formatos conocidos
 *
 * Así evitamos repetir lo mismo en varios puntos del editor.
 */

/**
 * Esta función intenta convertir el texto de la respuesta en JSON.
 * Si no puede, lanza un error claro para que sepamos que el backend devolvió
 * algo distinto a lo esperado.
 */
export function parseJsonSeguro(texto, url = "") {
  try {
    return JSON.parse(texto);
  } catch {
    const vistaPrevia = String(texto || "").slice(0, 180);
    throw new Error(`Respuesta no-JSON desde ${url}: ${vistaPrevia}`);
  }
}

/**
 * Esta función hace un fetch normal y devuelve el JSON ya convertido.
 * No intenta adivinar estructuras, solo trae el contenido tal como venga.
 */
export async function fetchJson(url, options = {}) {
  const resp = await fetch(url, options);
  const text = await resp.text();
  const data = parseJsonSeguro(text, url);

  return {
    okHttp: resp.ok,
    status: resp.status,
    data,
  };
}

/**
 * Esta función está pensada para endpoints que devuelven listas.
 * A veces la lista viene directa, y otras veces viene guardada dentro de una propiedad
 * como "servicios", "tipos", "ciudades" o algo parecido.
 *
 * Aquí centralizamos esa lectura para no repetirla por todo el proyecto.
 */
export async function fetchLista(url, posiblesKeys = []) {
  const { data } = await fetchJson(url);

  if (Array.isArray(data)) {
    return data;
  }

  for (const key of posiblesKeys) {
    if (Array.isArray(data?.[key])) {
      return data[key];
    }
  }

  throw new Error(`Formato inesperado desde ${url}`);
}