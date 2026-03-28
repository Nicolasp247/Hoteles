//public/etapa3/cotizacion-editar/utils/selects.js
/**
 * Este archivo agrupa ayudas pequeñas para trabajar con selects e inputs relacionados.
 * La meta es que cargar opciones, mostrar campos extra o leer valores escritos por el usuario
 * sea algo claro y reutilizable, sin repetir la misma lógica en varias partes.
 */

/**
 * Esta función borra el contenido actual de un select y lo vuelve a llenar
 * con nuevas opciones. También puede dejar una primera opción como
 * "(Seleccionar)" o la que necesitemos en cada caso.
 */
export function addOptions(
  selectEl,
  opciones,
  { firstText = "(Seleccionar)", firstValue = "" } = {}
) {
  if (!selectEl) return;

  selectEl.innerHTML = "";

  if (firstText !== null) {
    selectEl.appendChild(new Option(firstText, firstValue));
  }

  (opciones || []).forEach((opcion) => {
    selectEl.appendChild(new Option(opcion.text, opcion.value));
  });
}

/**
 * Esta función solo muestra u oculta un elemento visual.
 * Parece pequeña, pero ayuda a que el código sea más limpio cuando
 * una sección debe aparecer o desaparecer según el caso.
 */
export function show(elemento, visible) {
  if (!elemento) return;
  elemento.style.display = visible ? "" : "none";
}

/**
 * Esta función conecta un select con un input de texto.
 * Cuando el usuario escoge "Escribir nuevo...", aparece el input para que escriba.
 * Si elige una opción normal, el input se oculta y se limpia.
 */
export function initSelectConEscribirNuevo(selectEl, inputEl) {
  if (!selectEl) return;

  function sync() {
    const quiereEscribir = selectEl.value === "__write__";

    if (inputEl) {
      inputEl.style.display = quiereEscribir ? "" : "none";

      if (!quiereEscribir) {
        inputEl.value = "";
      }
    }
  }

  selectEl.addEventListener("change", sync);
  sync();
}

/**
 * Esta función lee el valor final de un select que puede tener opción de escribir.
 * Si el usuario eligió una opción normal, devuelve esa.
 * Si eligió "Escribir nuevo...", devuelve lo que haya escrito en el input.
 */
export function leerSelectOEscribir(selectEl, inputEl) {
  if (!selectEl) return null;

  const valor = selectEl.value || "";
  if (!valor) return null;

  if (valor !== "__write__") {
    return valor;
  }

  const texto = (inputEl?.value || "").trim();
  return texto || null;
}

/**
 * Esta función hace lo mismo que la anterior, pero pensada para casos donde
 * manejamos un select de catálogo más un campo libre. La dejamos separada porque
 * el nombre ayuda a entender mejor la intención cuando se usa en formularios.
 */
export function leerValorOtro({ selectCatalogoEl, inputTextoEl }) {
  if (!selectCatalogoEl) return null;

  const valor = selectCatalogoEl.value || "";
  if (!valor) return null;

  if (valor !== "__write__") {
    return valor;
  }

  const texto = (inputTextoEl?.value || "").trim();
  return texto || null;
}

/**
 * Esta función mete una opción nueva en un select solo si todavía no existe.
 * Es útil cuando acabamos de crear algo nuevo y queremos dejarlo ya seleccionado
 * sin duplicar opciones ni romper la lista actual.
 */
export function upsertOptionIntoSelect(
  selectEl,
  value,
  { keepWriteOption = true } = {}
) {
  if (!selectEl || !value) return;

  const valorNormalizado = String(value).trim();
  if (!valorNormalizado) return;

  const opciones = Array.from(selectEl.options || []);
  const yaExiste = opciones.some(
    (opcion) =>
      String(opcion.value).trim().toLowerCase() ===
      valorNormalizado.toLowerCase()
  );

  if (!yaExiste) {
    const opcionEscribir = opciones.find((opcion) => opcion.value === "__write__");
    const nuevaOpcion = new Option(valorNormalizado, valorNormalizado);

    if (opcionEscribir && keepWriteOption) {
      selectEl.insertBefore(nuevaOpcion, opcionEscribir);
    } else {
      selectEl.add(nuevaOpcion);
    }
  }

  selectEl.value = valorNormalizado;
}