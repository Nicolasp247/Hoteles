// backend/src/exports/excel/renderers/totals/totalesFinales.js

/**
 * Este archivo se encarga de pintar las 2 filas finales
 * de resumen que van después del último servicio.
 *
 * Aquí se muestran:
 * - el costo total por columna
 * - el precio final calculado a partir de ese costo
 *
 * Estas filas no dependen del tipo de servicio.
 * Siempre se construyen al final del bloque principal.
 */

const BLACK = "FF000000";
const THIN = { style: "thin" };

const FILL_COSTO = "FFDDEBF7";
const FILL_PRECIO = "FF9BC2E6";

const COST_ROW_COLUMNS = "BCDEFGHIJKLMNO".split("");
const PRICE_DIV_07_COLUMNS = ["E", "F", "G", "H", "I", "J", "M", "N"];
const PRICE_DIV_085_COLUMNS = ["K", "L"];
const SUM_COLUMNS = "EFGHIJKLMN".split("");

/**
 * Esta función aplica bordes finos a una celda,
 * solo en los lados que indiquemos.
 */
function setBorder(cell, opts = {}) {
  cell.border = {
    top: opts.top ? THIN : undefined,
    left: opts.left ? THIN : undefined,
    bottom: opts.bottom ? THIN : undefined,
    right: opts.right ? THIN : undefined,
  };
}

/**
 * Esta función aplica el estilo base de una fila final,
 * usando el color indicado y el peso de fuente necesario.
 */
function setRowBaseStyle(cell, fillArgb, bold = false) {
  cell.font = {
    name: "Calibri",
    size: 11,
    color: { argb: BLACK },
    bold,
  };

  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: fillArgb },
  };
}

/**
 * Esta función deja listas las celdas de una fila final
 * con el color, la alineación y los bordes base.
 */
function prepareSummaryRow(ws, row, fillArgb, bold = false) {
  ws.getRow(row).height = 18;

  for (const col of COST_ROW_COLUMNS) {
    const cell = ws.getCell(`${col}${row}`);
    setRowBaseStyle(cell, fillArgb, bold);

    cell.alignment = {
      horizontal: col === "C" ? "left" : "center",
      vertical: "middle",
      wrapText: true,
      indent: col === "C" ? 1 : 0,
    };
  }

  // B
  setBorder(ws.getCell(`B${row}`), {
    top: true,
    bottom: true,
    left: true,
  });

  // C
  setBorder(ws.getCell(`C${row}`), {
    top: true,
    bottom: true,
  });

  // D
  setBorder(ws.getCell(`D${row}`), {
    top: true,
    bottom: true,
    right: true,
  });

  // E:O
  for (const col of "EFGHIJKLMNO".split("")) {
    setBorder(ws.getCell(`${col}${row}`), {
      top: true,
      bottom: true,
      left: true,
      right: true,
    });
  }
}

/**
 * Esta función pinta la primera fila final,
 * donde se muestran los costos sumados por columna.
 */
function renderCostoRow(ws, row, dataStartRow, dataEndRow) {
  prepareSummaryRow(ws, row, FILL_COSTO, false);

  ws.getCell(`C${row}`).value = "COSTO PT // PP";

  for (const col of SUM_COLUMNS) {
    ws.getCell(`${col}${row}`).value = {
      formula: `SUM(${col}${dataStartRow}:${col}${dataEndRow})`,
    };
  }
}

/**
 * Esta función pinta la segunda fila final,
 * donde se muestran los precios calculados
 * a partir de la fila anterior.
 */
function renderPrecioRow(ws, row, costoRow) {
  prepareSummaryRow(ws, row, FILL_PRECIO, true);

  ws.getCell(`C${row}`).value = "PRECIO PT // PP";

  for (const col of PRICE_DIV_07_COLUMNS) {
    ws.getCell(`${col}${row}`).value = {
      formula: `${col}${costoRow}/0.7`,
    };
  }

  for (const col of PRICE_DIV_085_COLUMNS) {
    ws.getCell(`${col}${row}`).value = {
      formula: `${col}${costoRow}/0.85`,
    };
  }
}

/**
 * Esta función pinta el bloque final de totales.
 *
 * Recibe:
 * - la hoja
 * - la fila donde debe empezar
 * - la primera fila de servicios
 * - la última fila de servicios
 *
 * Devuelve la siguiente fila libre.
 */
function renderTotalesFinales(ws, startRow, dataStartRow, dataEndRow) {
  const costoRow = startRow;
  const precioRow = startRow + 1;

  renderCostoRow(ws, costoRow, dataStartRow, dataEndRow);
  renderPrecioRow(ws, precioRow, costoRow);

  return startRow + 2;
}

module.exports = { renderTotalesFinales };