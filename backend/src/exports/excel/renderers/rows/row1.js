// backend/src/exports/excel/renderers/rows/row1.js

/**
 * Este archivo se encarga de pintar la primera fila fija
 * del encabezado principal del Excel.
 *
 * Aquí se muestra la línea general con:
 * - agente
 * - pasajero principal
 * - total de personas
 * - desglose por tipo de pasajero
 */

const HEADER_ROW_1_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF002060" } };
const HEADER_ROW_1_FONT = { name: "Calibri", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
const HEADER_ROW_1_ALIGNMENT = { horizontal: "center", vertical: "bottom", wrapText: true };
const HEADER_ROW_1_COLUMNS = "BCDEFGHIJKLMNO".split("");

/**
 * Esta función arma el texto principal de la fila 1,
 * juntando agente, pasajero y resumen de pasajeros.
 *
 * También agrega el desglose por tipo de viajero
 * cuando esos valores vienen informados.
 */
function buildHeaderLine1(cotizacion) {
  const agente = String(cotizacion?.agente ?? "").trim();
  const pasajero = String(cotizacion?.nombre_pasajero ?? "").trim();

  const total = Number(cotizacion?.total_pasajeros ?? 0);

  const ninos = Number(cotizacion?.ninos_3_11 ?? 0);
  const adultos = Number(cotizacion?.adultos_19_64 ?? 0);
  const jovenes = Number(cotizacion?.jovenes_12_18 ?? 0);
  const infantes = Number(cotizacion?.infantes_0_2 ?? cotizacion?.infante_0_2 ?? 0);
  const adultos65 = Number(cotizacion?.adultos_65 ?? 0);

  const detallePasajeros = [];
  if (ninos > 0) detallePasajeros.push(`${ninos} NIÑ`);
  if (adultos > 0) detallePasajeros.push(`${adultos} ADT`);
  if (jovenes > 0) detallePasajeros.push(`${jovenes} JV`);
  if (infantes > 0) detallePasajeros.push(`${infantes} INF`);
  if (adultos65 > 0) detallePasajeros.push(`${adultos65} ADT+65`);

  const totalTxt = `${total} personas`;
  const pasajerosTxt = detallePasajeros.length ? `${totalTxt} (${detallePasajeros.join(", ")})` : totalTxt;

  const bloques = [agente, pasajero, pasajerosTxt].filter(Boolean);
  return bloques.join(" // ");
}

/**
 * Esta función aplica bordes finos a una celda,
 * solo en los lados que indiquemos.
 *
 * Así evitamos repetir el mismo bloque
 * cada vez que pintamos la cabecera.
 */
function setBorder(cell, opts = {}) {
    const thin = { style: "thin" };
    cell.border = {
            top: opts.top ? thin : undefined,
            left: opts.left ? thin : undefined,
            bottom: opts.bottom ? thin : undefined,
            right: opts.right ? thin : undefined,
    };
}

/**
 * Esta función pinta la fila 1 del encabezado,
 * con su merge, estilos, bordes y texto principal.
 */
function renderRow1(ws, cotizacion) {
  ws.getRow(1).height = 30;
  ws.mergeCells("B1:O1");

  const a1 = ws.getCell("A1");
  setBorder(a1, { right: true });

  const b1 = ws.getCell("B1");

  for (const col of HEADER_ROW_1_COLUMNS) {
    const cell = ws.getCell(`${col}1`);
    cell.fill = HEADER_ROW_1_FILL;
    cell.font = HEADER_ROW_1_FONT;
    cell.alignment = HEADER_ROW_1_ALIGNMENT;

    setBorder(cell, {
      top: true,
      left: col === "B",
      right: col === "O",
    });
  }

  b1.value = buildHeaderLine1(cotizacion);
}

module.exports = { renderRow1 };