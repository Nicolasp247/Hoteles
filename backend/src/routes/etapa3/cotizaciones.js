const express = require("express");
const router = express.Router();
const db = require("../../db"); // pool de mysql2/promise

// =======================
// Helpers
// =======================

// Convierte a entero o 0 si viene vacío / null
function intOrZero(value) {
    const n = parseInt(value, 10);
    return Number.isNaN(n) ? 0 : n;
}

// Genera el nombre automático de la cotización
// Formato: <YY><MM> <Agente> <Nombre pasajero> <N personas>
function generarNombreCotizacion(fechaViaje, agente, nombrePasajero, totalPasajeros) {
    // fechaViaje se espera en formato 'YYYY-MM-DD'
    const [yearStr, monthStr] = fechaViaje.split("-"); // ["2026", "02", "15"...]
    const yy = yearStr.slice(-2);                      // "26"
    const mm = monthStr.padStart(2, "0");              // "02"

    const sufijo = totalPasajeros === 1 ? "persona" : "personas";

    return `${yy}${mm} ${agente} ${nombrePasajero} ${totalPasajeros} ${sufijo}`;
}

// =======================
// Rutas
// =======================

/**
 * POST /api/cotizaciones
 * Crea la cabecera de una cotización.
 * Body esperado:
 * {
 *   agente: "NT",
 *   nombre_pasajero: "Juan Perez",
 *   adultos_65: 0,
 *   adultos_19_64: 2,
 *   jovenes_12_18: 3,
 *   ninos_3_11: 0,
 *   infantes_0_2: 0,
 *   categorias: "3*,4*",
 *   fecha_viaje: "2026-02-02",   // IMPORTANTE: formato YYYY-MM-DD
 *   moneda_id: 1,                // opcional
 *   nota: "Texto libre"          // opcional
 * }
 */
router.post("/cotizaciones", async (req, res) => {
    try {
        const {
            agente,
            nombre_pasajero,
            adultos_65,
            adultos_19_64,
            jovenes_12_18,
            ninos_3_11,
            infantes_0_2,
            categorias,
            fecha_viaje,
            moneda_id,
            nota
        } = req.body || {};

        // --------- Validaciones básicas ---------
        if (!agente || !nombre_pasajero || !fecha_viaje) {
            return res.status(400).json({
                ok: false,
                mensaje: "Faltan campos obligatorios: agente, nombre_pasajero o fecha_viaje."
            });
        }

        // Convertimos todos los grupos de pasajeros a enteros
        const adultos65    = intOrZero(adultos_65);
        const adultos1964  = intOrZero(adultos_19_64);
        const jovenes1218  = intOrZero(jovenes_12_18);
        const ninos311     = intOrZero(ninos_3_11);
        const infantes02   = intOrZero(infantes_0_2);

        const total_pasajeros =
            adultos65 + adultos1964 + jovenes1218 + ninos311 + infantes02;

        if (total_pasajeros <= 0) {
            return res.status(400).json({
                ok: false,
                mensaje: "Debe haber al menos 1 pasajero en la cotización."
            });
        }

        // Generar nombre automático de la cotización
        const nombre_cotizacion = generarNombreCotizacion(
            fecha_viaje,
            agente,
            nombre_pasajero,
            total_pasajeros
        );

        // --------- Insert en la base de datos ---------
        const sql = `
            INSERT INTO cotizacion (
                agente,
                nombre_pasajero,
                adultos_65,
                adultos_19_64,
                jovenes_12_18,
                ninos_3_11,
                infantes_0_2,
                total_pasajeros,
                categorias,
                fecha_viaje,
                nombre_cotizacion,
                moneda_id,
                nota
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
            agente,
            nombre_pasajero,
            adultos65,
            adultos1964,
            jovenes1218,
            ninos311,
            infantes02,
            total_pasajeros,
            categorias || null,
            fecha_viaje,
            nombre_cotizacion,
            moneda_id || null,
            nota || null
        ];

        const [result] = await db.execute(sql, params);

        return res.status(201).json({
            ok: true,
            id_cotizacion: result.insertId,
            nombre_cotizacion,
            mensaje: "Cotización creada correctamente."
        });

    } catch (error) {
        console.error("Error al crear cotización:", error);

        // Si el nombre_cotizacion ya existe, MySQL lanza ER_DUP_ENTRY
        if (error && error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                ok: false,
                mensaje:
                    "Ya existe una cotización con el mismo nombre. " +
                    "Revisa los datos de fecha, agente, pasajero y número de personas."
            });
        }

        return res.status(500).json({
            ok: false,
            mensaje: "Error interno del servidor al crear la cotización.",
            error: error.message
        });
    }
});


// Exportamos el router para usarlo en server.js
module.exports = router;
