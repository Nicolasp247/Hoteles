// public/etapa3/cotizacion-editar/render/tabla-items.render.js

/**
 * Este archivo se encarga de pintar la tabla principal de servicios
 * dentro del editor de cotización.
 *
 * La idea es sacar del archivo principal todo lo que tenga que ver con
 * construir filas, mostrar fechas, mostrar precios y conectar botones
 * de la tabla. Así el archivo grande deja de hacer de todo al mismo tiempo.
 */

import {
  sumarDiasYmd,
  formatoRangoAlojamiento,
  formatoFechaServicio,
} from "../utils/dates.js";

import { recalcularTotal } from "../helpers/totals.js";

/**
 * Esta función arma la fila especial de ciudad para los alojamientos.
 * Se usa cuando cambia la ciudad y queremos dejar una separación visual clara
 * antes de listar los hoteles o servicios de ese bloque.
 */
function crearFilaCiudad(ciudad) {
  const trCiudad = document.createElement("tr");
  trCiudad.classList.add("fila-ciudad");

  const tdCiudad = document.createElement("td");
  tdCiudad.colSpan = 6;
  tdCiudad.textContent = String(ciudad || "").toUpperCase();

  trCiudad.appendChild(tdCiudad);
  return trCiudad;
}

/**
 * Esta función decide cómo mostrar la fecha de un item.
 * Si es alojamiento, muestra el rango completo.
 * Si no lo es, muestra una sola fecha en formato amigable.
 */
function construirTextoFecha(item) {
  if (item.esAlojamiento && item.noches_alojamiento && Number(item.noches_alojamiento) > 0) {
    const desde = item.fechaYmd;
    const hasta = sumarDiasYmd(desde, Number(item.noches_alojamiento));
    return formatoRangoAlojamiento(desde, hasta);
  }

  return item.fechaYmd ? formatoFechaServicio(item.fechaYmd) : "";
}

/**
 * Esta función decide qué poner en la celda de precio.
 * Los opcionales no muestran precio visible y los demás intentan
 * mostrarse con dos decimales cuando el valor sí es numérico.
 */
function construirTextoPrecio(item) {
  if (item.es_opcional) {
    return "-";
  }

  if (item.precio != null && item.precio !== "") {
    const num = Number(item.precio);
    return Number.isNaN(num) ? String(item.precio) : num.toFixed(2);
  }

  return "-";
}

/**
 * Esta función crea una fila normal de servicio y conecta los botones
 * de subir, bajar y eliminar con las funciones que reciba por parámetro.
 */
function crearFilaItem(item, index, { onMover, onEliminar }) {
  const row = document.createElement("tr");
  row.dataset.idLocal = item.idLocal;

  const colOrden = document.createElement("td");

  const btnUp = document.createElement("button");
  btnUp.type = "button";
  btnUp.textContent = "↑";
  btnUp.classList.add("btn-small");
  btnUp.addEventListener("click", () => onMover(index, -1));

  const btnDown = document.createElement("button");
  btnDown.type = "button";
  btnDown.textContent = "↓";
  btnDown.classList.add("btn-small");
  btnDown.addEventListener("click", () => onMover(index, +1));

  colOrden.appendChild(btnUp);
  colOrden.appendChild(document.createTextNode(" "));
  colOrden.appendChild(btnDown);

  const colIndice = document.createElement("td");
  colIndice.classList.add("celda-indice");
  colIndice.textContent = index + 1;

  const colFecha = document.createElement("td");
  colFecha.textContent = construirTextoFecha(item);

  const colServicio = document.createElement("td");
  colServicio.textContent = item.servicioTexto || "";

  const colPrecio = document.createElement("td");
  colPrecio.textContent = construirTextoPrecio(item);

  const colEliminar = document.createElement("td");
  const btnEliminar = document.createElement("button");
  btnEliminar.type = "button";
  btnEliminar.textContent = "✕";
  btnEliminar.classList.add("btn-small");
  btnEliminar.addEventListener("click", () => onEliminar(item, index));
  colEliminar.appendChild(btnEliminar);

  row.appendChild(colOrden);
  row.appendChild(colIndice);
  row.appendChild(colFecha);
  row.appendChild(colServicio);
  row.appendChild(colPrecio);
  row.appendChild(colEliminar);

  return row;
}

/**
 * Esta es la función principal del archivo.
 * Recibe la tabla, los items, el input del total y las acciones
 * que debe usar cuando el usuario mueve o elimina una fila.
 *
 * Su trabajo es dejar la tabla completamente repintada según el estado actual.
 */
export function renderTablaItems({
  tablaBody,
  items,
  totalUsdInput,
  onMover,
  onEliminar,
}) {
  if (!tablaBody) return;

  tablaBody.innerHTML = "";

  let ultimaCiudadCabecera = null;

  (items || []).forEach((item, index) => {
    if (item.esAlojamiento && item.ciudad && item.ciudad !== ultimaCiudadCabecera) {
      tablaBody.appendChild(crearFilaCiudad(item.ciudad));
      ultimaCiudadCabecera = item.ciudad;
    }

    tablaBody.appendChild(
      crearFilaItem(item, index, {
        onMover,
        onEliminar,
      })
    );
  });

  recalcularTotal(items, totalUsdInput);
}