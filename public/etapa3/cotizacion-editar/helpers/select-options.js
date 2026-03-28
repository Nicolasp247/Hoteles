//public/etapa3/cotizacion-editar/helpers/select-options.js

/**
 * Este archivo reúne ayudas para llenar selects desde catálogos y para manejar
 * los casos donde el usuario puede escoger una opción existente o escribir una nueva.
 *
 * La idea es no repetir esa lógica en cada parte del editor, porque este patrón
 * aparece mucho en el mini-form de creación rápida.
 */

import {
  addOptions,
  show,
  initSelectConEscribirNuevo,
} from "../utils/selects.js";

import { cargarCatalogo } from "./catalog-cache.js";

/**
 * Esta función llena un select usando un catálogo del backend.
 * Si algo falla, deja una opción vacía o un texto sencillo para que
 * la pantalla no quede rota.
 */
export async function fillSelectFromCatalog(
  selectEl,
  grupo,
  { firstText = "(Seleccionar)", firstValue = "" } = {}
) {
  if (!selectEl) return;

  try {
    const catalogo = await cargarCatalogo(grupo);

    addOptions(
      selectEl,
      catalogo.map((item) => ({
        value: item.valor,
        text: item.valor,
      })),
      { firstText, firstValue }
    );
  } catch {
    addOptions(selectEl, [], {
      firstText: "(Sin catálogo)",
      firstValue: "",
    });
  }
}

/**
 * Esta función prepara un select que puede tomar valores de catálogo
 * o dejar que el usuario escriba uno nuevo.
 */
export async function initOtroCatalogo({
  grupoCatalogo,
  selectCatalogoEl,
  inputTextoEl,
}) {
  if (!selectCatalogoEl) return;

  try {
    const catalogo = await cargarCatalogo(grupoCatalogo);

    const opciones = [
      ...catalogo.map((item) => ({
        value: item.valor,
        text: item.valor,
      })),
      { value: "__write__", text: "Escribir nuevo..." },
    ];

    addOptions(selectCatalogoEl, opciones, {
      firstText: "(Elegir de catálogo)",
      firstValue: "",
    });
  } catch {
    addOptions(
      selectCatalogoEl,
      [{ value: "__write__", text: "Escribir nuevo..." }],
      {
        firstText: "(Elegir de catálogo)",
        firstValue: "",
      }
    );
  }

  /**
   * Esta función interna solo decide si el campo de texto debe mostrarse
   * o esconderse según la opción elegida.
   */
  function syncWrite() {
    const quiereEscribir = selectCatalogoEl.value === "__write__";
    show(inputTextoEl, quiereEscribir);

    if (!quiereEscribir && inputTextoEl) {
      inputTextoEl.value = "";
    }
  }

  selectCatalogoEl.addEventListener("change", syncWrite);
  syncWrite();
}

/**
 * Esta función llena un select de catálogo y además deja preparada
 * la opción "Escribir nuevo..." con su input relacionado.
 */
export async function fillSelectCatalogoConEscribir(
  selectEl,
  inputEl,
  grupoCatalogo,
  { firstText, firstValue } = {}
) {
  if (!selectEl) return;

  const firstT = firstText ?? "(Seleccionar)";
  const firstV = firstValue ?? "";

  try {
    const catalogo = await cargarCatalogo(grupoCatalogo);

    const opciones = [
      ...catalogo.map((item) => ({
        value: item.valor,
        text: item.valor,
      })),
      { value: "__write__", text: "Escribir nuevo..." },
    ];

    addOptions(selectEl, opciones, {
      firstText: firstT,
      firstValue: firstV,
    });
  } catch {
    addOptions(
      selectEl,
      [{ value: "__write__", text: "Escribir nuevo..." }],
      {
        firstText: "(Sin catálogo)",
        firstValue: "",
      }
    );
  }

  initSelectConEscribirNuevo(selectEl, inputEl);
}