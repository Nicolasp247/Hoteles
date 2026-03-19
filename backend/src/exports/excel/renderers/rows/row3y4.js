// backend/src/exports/excel/renderers/rows/row3y4.js

function setBorder(cell, opts = {}) {
    const thin = { style: "thin" };
    cell.border = {
        top: opts.top ? thin : undefined,
        left: opts.left ? thin : undefined,
        bottom: opts.bottom ? thin : undefined,
        right: opts.right ? thin : undefined,
    };
}

function applyBlock(ws, range, { fillArgb, bold = true, size = 11, text = "", align = "center", vAlign = "center" }) {
    // range ejemplo: "B3:B4" o "E3:G3"
    const [start, end] = range.split(":");
    const startCol = start.match(/[A-Z]+/)[0];
    const startRow = Number(start.match(/\d+/)[0]);
    const endCol = end.match(/[A-Z]+/)[0];
    const endRow = Number(end.match(/\d+/)[0]);

    // merge
    ws.mergeCells(range);

    const master = ws.getCell(start);
    master.value = text;

    const fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: fillArgb },
    };

    const font = {
        name: "Calibri",
        size,
        bold,
        color: { argb: "FF000000" },
    };

    const alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
    };

    // aplicar estilo a todas las celdas dentro del bloque (como hiciste en row1/row2)
    const cols = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const colIndex = (letter) => cols.indexOf(letter);
    const from = colIndex(startCol);
    const to = colIndex(endCol);

    for (let r = startRow; r <= endRow; r++) {
        for (let ci = from; ci <= to; ci++) {
            const col = cols[ci];
            const cell = ws.getCell(`${col}${r}`);
            cell.fill = fill;
            cell.font = font;
            cell.alignment = alignment;

            // borde marcado en TODO el bloque
            setBorder(cell, { top: true, left: true, bottom: true, right: true });
        }
    }
}

function renderRow3y4(ws) {
    // Alturas (si no dijiste, te dejo 18 como base. Si quieres exacto, lo cambias aquí)
    ws.getRow(3).height = 18;
    ws.getRow(4).height = 18;

    // A3 y A4: solo borde derecho marcado
    const a3 = ws.getCell("A3");
    const a4 = ws.getCell("A4");
    setBorder(a3, { right: true });
    setBorder(a4, { right: true });

    // P3 y P4: solo borde izquierdo marcado
    const p3 = ws.getCell("P3");
    const p4 = ws.getCell("P4");
    setBorder(p3, { left: true });
    setBorder(p4, { left: true });

    // === BLOQUES FIJOS B..D (se unen verticalmente en filas 3-4) ===
    applyBlock(ws, "B3:B4", { fillArgb: "FFE2EFDA", text: "FECHAS" });
    applyBlock(ws, "C3:C4", { fillArgb: "FFE2EFDA", text: "SERVICIO INCLUIDO" });
    applyBlock(ws, "D3:D4", { fillArgb: "FFFFFFFF", text: "OPERADOR" });

    // === FILA 3 (encabezados grandes) ===
    applyBlock(ws, "E3:G3", { fillArgb: "FF8EA9DB", text: "PRIMERA *" });
    applyBlock(ws, "H3:J3", { fillArgb: "FFFFD966", text: "PRIMERA SUPERIOR*" });
    applyBlock(ws, "K3:L3", { fillArgb: "FFAEAAAA", text: "TRANSPORTE" });
    applyBlock(ws, "M3:N3", { fillArgb: "FFF8CBAD", text: "OPCIONALES" });

    // O3 (solo fila 3)
    applyBlock(ws, "O3:O3", { fillArgb: "FFFFFFFF", text: "NOTAS" });

    // === FILA 4 (sub-encabezados) ===
    applyBlock(ws, "E4:E4", { fillArgb: "FFB4C6E7", bold: false, text: "DOBLE" });
    applyBlock(ws, "F4:F4", { fillArgb: "FFB4C6E7", bold: false, text: "TRIPLE" });
    applyBlock(ws, "G4:G4", { fillArgb: "FFB4C6E7", bold: false, text: "NIÑO <10" });

    applyBlock(ws, "H4:H4", { fillArgb: "FFFFE699", bold: false, text: "DOBLE" });
    applyBlock(ws, "I4:I4", { fillArgb: "FFFFE699", bold: false, text: "TRIPLE" });
    applyBlock(ws, "J4:J4", { fillArgb: "FFFFE699", bold: false, text: "NIÑO <10" });

    applyBlock(ws, "K4:K4", { fillArgb: "FFD9D9D9", bold: false, text: "ADULTO" });
    applyBlock(ws, "L4:L4", { fillArgb: "FFD9D9D9", bold: false, text: "NIÑO <10" });

    applyBlock(ws, "M4:M4", { fillArgb: "FFFCE4D6", bold: false, text: "ADULTO" });
    applyBlock(ws, "N4:N4", { fillArgb: "FFFCE4D6", bold: false, text: "NIÑO <10" });

    applyBlock(ws, "O4:O4", { fillArgb: "FFFFFFFF", bold: false, text: "Horario / Estaciones - Aeropuerto, etc." });
}

module.exports = { renderRow3y4 };