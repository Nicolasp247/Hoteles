// backend/src/exports/excel/renderers/rows/row1.js

function buildHeaderLine1(c) {
    const agente = String(c?.agente ?? "").trim();
    const pasajero = String(c?.nombre_pasajero ?? "").trim();

    const total = Number(c?.total_pasajeros ?? 0);

    const ninos = Number(c?.ninos_3_11 ?? 0);
    const adultos = Number(c?.adultos_19_64 ?? 0);
    const jovenes = Number(c?.jovenes_12_18 ?? 0);
    const infantes = Number(c?.infantes_0_2 ?? c?.infante_0_2 ?? 0);
    const adultos65 = Number(c?.adultos_65 ?? 0);

    const parts = [];
    if (ninos > 0) parts.push(`${ninos} NIÑ`);
    if (adultos > 0) parts.push(`${adultos} ADT`);
    if (jovenes > 0) parts.push(`${jovenes} JV`);
    if (infantes > 0) parts.push(`${infantes} INF`);
    if (adultos65 > 0) parts.push(`${adultos65} ADT+65`);

    const totalTxt = `${total} personas`;
    const detailTxt = parts.length ? ` (${parts.join(", ")})` : "";

    return `${agente} // ${pasajero} // ${totalTxt}${detailTxt}`.trim();
}

function setBorder(cell, opts = {}) {
    const thin = { style: "thin" };
    cell.border = {
            top: opts.top ? thin : undefined,
            left: opts.left ? thin : undefined,
            bottom: opts.bottom ? thin : undefined,
            right: opts.right ? thin : undefined,
    };
    }

function renderRow1(ws, cotizacion) {
    // Altura de fila
    ws.getRow(1).height = 30;
  
    // Merge B1:O1
    ws.mergeCells("B1:O1");

    // A1 borde derecho
    const a1 = ws.getCell("A1");
    setBorder(a1, { right: true });

    const b1 = ws.getCell("B1");

    // Color fondo
    b1.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF002060" }
    };

    // Fuente
    b1.font = {
        name: "Calibri",
        size: 14,
        bold: true,
        color: { argb: "FFFFFFFF" }
    };

    // Alineación
    b1.alignment = {
        horizontal: "center",
        vertical: "bottom",
        wrapText: true
    };

    // Bordes del bloque
    const cols = "BCDEFGHIJKLMNO".split("");

    for (const col of cols) {
        const cell = ws.getCell(`${col}1`);

        cell.fill = b1.fill;
        cell.font = b1.font;
        cell.alignment = b1.alignment;

        setBorder(cell, {
        top: true,
        left: col === "B",
        right: col === "O"
        });
    }

    b1.value = buildHeaderLine1(cotizacion);
}

module.exports = { renderRow1 };