// public/etapa3/cotizacion-editar.js
// Versión completa corregida:
// - Flechas ↑/↓ ahora mueven ORDEN + FECHA (↑ resta 1 día, ↓ suma 1 día)
// - Alojamiento: mueve el check-in; el rango se recalcula con noches
// - Opcionales: no muestran precio y no suman al total
// - Render de fecha: se calcula desde fechaYmd (ya no usa it.fecha que no existía)
import {
  mostrarError,
  limpiarError,
  mostrarMensajeCrearServicio,
  limpiarMensajeCrearServicio,
} from "./cotizacion-editar/helpers/messages.js";

import {
  fillSelectFromCatalog,
  initOtroCatalogo,
  fillSelectCatalogoConEscribir,
} from "./cotizacion-editar/helpers/select-options.js";

import { exportarExcelCotizacion } from "./cotizacion-editar/helpers/export.js";

import {
  guardarOrdenEnBackend,
  guardarFechaItemEnBackend,
} from "./cotizacion-editar/api/item-persistence.js";

import {
  calcularNoches,
} from "./cotizacion-editar/utils/dates.js";

import {
  addOptions,
  show,
  initSelectConEscribirNuevo,
  leerSelectOEscribir,
  leerValorOtro,
} from "./cotizacion-editar/utils/selects.js";

import { mapRowToItem } from "./cotizacion-editar/mappers/cotizacion-item.mapper.js";

import { renderTablaItems } from "./cotizacion-editar/render/tabla-items.render.js";

import { createItemActions } from "./cotizacion-editar/features/item-actions.js";

import { createServiceFilters } from "./cotizacion-editar/features/service-filters.js";

import { createCatalogLoaders } from "./cotizacion-editar/features/catalog-loaders.js";

import { createLoadCotizacion } from "./cotizacion-editar/features/load-cotizacion.js";

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const idCotizacion = params.get("id");
  const headerIdEl = document.getElementById("header-id");
  if (headerIdEl) headerIdEl.textContent = idCotizacion ? `#${idCotizacion}` : "(sin id)";

  const filtroContinente = document.getElementById("filtro-continente");
  const filtroPais = document.getElementById("filtro-pais");
  const filtroCiudad = document.getElementById("filtro-ciudad");
  const filtroTipoServicio = document.getElementById("filtro-tipo-servicio");

  const wrapperFechaHasta = document.getElementById("wrapper-fecha-hasta");
  const fechaDesdeInput = document.getElementById("fecha-desde");
  const fechaHastaInput = document.getElementById("fecha-hasta");

  const selectServicio = document.getElementById("select-servicio");
  const chkOpcional = document.getElementById("chk-opcional");

  const tablaBody = document.getElementById("tabla-servicios-body");
  const totalUsdInput = document.getElementById("total-usd");

  const btnInsertarServicio = document.getElementById("btn-insertar-servicio");
  const btnCrearServicio = document.getElementById("btn-crear-servicio");
  const mensajeErrorEl = document.getElementById("mensaje-error");

  const btnToggleCrear = document.getElementById("btn-toggle-crear-servicio");
  const panelCrear = document.getElementById("panel-crear-servicio");
  const selProveedorNuevo = document.getElementById("nuevo-id-proveedor");
  const inpLinkReserva = document.getElementById("nuevo-link-reserva");

  // Preview del nombre automático (si existe en el HTML)
  const inpNombreAutoPreview = document.getElementById("nuevo-nombre-auto-preview");

  // tiempo_servicio: select + txt
  const selTiempoServicio = document.getElementById("nuevo-tiempo-servicio-select");
  const txtTiempoServicio = document.getElementById("nuevo-tiempo-servicio-txt");

  const selPrivado = document.getElementById("nuevo-privado");
  const inpDesc = document.getElementById("nuevo-descripcion");
  const contDinamico = document.getElementById("nuevo-campos-dinamicos");
  const btnGuardarSrv = document.getElementById("btn-guardar-servicio-rapido");
  const btnCancelarSrv = document.getElementById("btn-cancelar-servicio-rapido");
  const msgCrearSrv = document.getElementById("msg-crear-servicio");

  const allServiciosRef = { value: [] };
  const serviciosRef = { value: [] };
  const nochesFiltroAlojRef = { value: null };

  /**
   * Aquí dejamos conectada la carga de una cotización ya existente.
   * Este bloque se encarga de pedir la información al backend,
   * transformar los items y repintar la tabla.
   */
  const { cargarCotizacionExistente } = createLoadCotizacion({
    idCotizacion,
    headerIdEl,
    getServicioTextoById: () => servicioTextoById,
    mapRowToItem,
    resetNextIdLocal: () => {
      nextIdLocal = 1;
    },
    nextIdLocal: () => nextIdLocal++,
    setItems: (nuevosItems) => {
      items = nuevosItems;
    },
    actualizarTablaDesdeEstado,
    mostrarError,
    mensajeErrorEl,
  });

  let items = [];
  let nextIdLocal = 1;

  // Mapa global: id_servicio (string) -> servicio_texto (string)
  let servicioTextoById = new Map();

  /**
   * Esta función le pide al renderizador que reconstruya la tabla
   * usando el estado actual de items y las acciones disponibles.
   * Aquí ya no armamos filas a mano, solo coordinamos.
   */
  function actualizarTablaDesdeEstado() {
    renderTablaItems({
      tablaBody,
      items,
      totalUsdInput,
      onMover: moverItem,
      onEliminar: eliminarItem,
    });
  }

  /**
   * Aquí conectamos las acciones reales de la tabla con el estado actual
   * de la página. De esta forma, mover y eliminar ya no viven dentro
   * del archivo principal.
   */
  const { moverItem, eliminarItem } = createItemActions({
    idCotizacion,
    items,
    actualizarTablaDesdeEstado,
    mostrarError,
    mensajeErrorEl,
    guardarFechaItemEnBackend,
    guardarOrdenEnBackend,
  });

  /**
   * Aquí conectamos toda la lógica de filtros y selección de servicios.
   * Este bloque se encarga de manejar alojamiento, noches, visibilidad
   * de la fecha hasta y el refresco del select de servicios.
   */
  const {
    esTipoAlojamientoSeleccionado,
    actualizarVisibilidadFechaHasta,
    actualizarNochesYFiltrarServicios,
    filtrarServicios,
    bindFilterEvents,
  } = createServiceFilters({
    filtroContinente,
    filtroPais,
    filtroCiudad,
    filtroTipoServicio,
    wrapperFechaHasta,
    fechaDesdeInput,
    fechaHastaInput,
    selectServicio,
    allServiciosRef,
    serviciosRef,
    nochesFiltroAlojRef,
    mostrarError,
    limpiarError,
    mensajeErrorEl,
    onTipoChangeExtra: () => {
      renderCamposDinamicosPorTipo();
    },
  });

  /**
   * Aquí conectamos todas las cargas base de la pantalla:
   * ubicaciones, tipos, servicios y proveedores.
   *
   * Este bloque deja listo el acceso a los datos que alimentan
   * tanto los filtros como el mini-form.
   */
  const {
    cargarContinentes,
    cargarPaises,
    cargarCiudades,
    cargarTiposServicio,
    cargarTodosLosServicios,
    cargarProveedores,
  } = createCatalogLoaders({
    filtroContinente,
    filtroPais,
    filtroCiudad,
    filtroTipoServicio,
    selProveedorNuevo,
    allServiciosRef,
    setServicioTextoById: (nuevoMapa) => {
      servicioTextoById = nuevoMapa;
    },
    mostrarError,
    mensajeErrorEl,
    filtrarServicios,
  });

  bindFilterEvents({
    cargarPaises,
    cargarCiudades,
  });

  // ==========================
  // Mini-form (Crear servicio rápido)
  // ==========================
  btnToggleCrear?.addEventListener("click", () => {
    const visible = window.getComputedStyle(panelCrear).display !== "none";
    panelCrear.style.display = visible ? "none" : "block";
    limpiarMensajeCrearServicio(msgCrearSrv);

    if (inpNombreAutoPreview) {
      inpNombreAutoPreview.value = "Se genera automáticamente al guardar";
    }

    renderCamposDinamicosPorTipo();
  });

  btnCancelarSrv?.addEventListener("click", () => {
    panelCrear.style.display = "none";
    limpiarMensajeCrearServicio(msgCrearSrv);
  });

  let _miniFormInited = false;

  function ocultarTodasLasSecciones() {
    ["sec-alojamiento", "sec-boleto", "sec-vuelo", "sec-tren", "sec-traslado", "sec-tour"].forEach((id) =>
      show(document.getElementById(id), false)
    );
  }

  async function initMiniFormOnce() {
    if (_miniFormInited) return;
    _miniFormInited = true;

    await initOtroCatalogo({
      grupoCatalogo: "tiempo_servicio",
      selectCatalogoEl: selTiempoServicio,
      inputTextoEl: txtTiempoServicio,
    });

    // ===== ALOJAMIENTO =====
    addOptions(
      document.getElementById("aloj-regimen"),
      [
        { value: "SOLO_ALOJAMIENTO", text: "Solo alojamiento" },
        { value: "ALOJAMIENTO_DESAYUNO", text: "Alojamiento y desayuno" },
        { value: "MEDIA_PENSION", text: "Media pensión" },
        { value: "PENSION_COMPLETA", text: "Pensión completa" },
        { value: "TODO_INCLUIDO", text: "Todo incluido" },
        { value: "__write__", text: "Escribir nuevo..." },
      ],
      { firstText: "(Seleccionar)", firstValue: "" }
    );

    addOptions(
      document.getElementById("aloj-categoria-hotel"),
      [
        { value: "H3_ECONOMICO", text: "3* Económico" },
        { value: "H3_SUPERIOR", text: "3* Superior" },
        { value: "H4_ECONOMICO", text: "4* Económico" },
        { value: "H4_SUPERIOR", text: "4* Superior" },
        { value: "H5_ECONOMICO", text: "5* Económico" },
        { value: "H5_SUPERIOR", text: "5* Superior" },
        { value: "LUJO_ECONOMICO", text: "Lujo Económico" },
        { value: "LUJO_SUPERIOR", text: "Lujo Superior" },
        { value: "__write__", text: "Escribir nuevo..." },
      ],
      { firstText: "(Seleccionar)", firstValue: "" }
    );

    addOptions(
      document.getElementById("aloj-categoria-hab"),
      [
        { value: "ESTANDAR", text: "Estándar" },
        { value: "SUPERIOR", text: "Superior" },
        { value: "SUITE", text: "Suite" },
        { value: "__write__", text: "Escribir nuevo..." },
      ],
      { firstText: "(Seleccionar)", firstValue: "" }
    );

    initSelectConEscribirNuevo(document.getElementById("aloj-regimen"), document.getElementById("aloj-regimen-txt"));
    initSelectConEscribirNuevo(
      document.getElementById("aloj-categoria-hotel"),
      document.getElementById("aloj-categoria-hotel-txt")
    );
    initSelectConEscribirNuevo(
      document.getElementById("aloj-categoria-hab"),
      document.getElementById("aloj-categoria-hab-txt")
    );

    // ===== BOLETO =====
    addOptions(
      document.getElementById("be-tipo-entrada"),
      [
        { value: "ESTANDAR", text: "Estándar" },
        { value: "VIP", text: "VIP" },
        { value: "FAST_TRACK", text: "Fast track" },
        { value: "__write__", text: "Escribir nuevo..." },
      ],
      { firstText: "(Seleccionar tipo)", firstValue: "" }
    );
    initSelectConEscribirNuevo(
      document.getElementById("be-tipo-entrada"),
      document.getElementById("be-tipo-entrada-txt")
    );

    await initOtroCatalogo({
      grupoCatalogo: "boleto_lugar",
      selectCatalogoEl: document.getElementById("be-lugar-select"),
      inputTextoEl: document.getElementById("be-lugar-txt"),
    });

    await fillSelectCatalogoConEscribir(
      document.getElementById("be-idioma"),
      document.getElementById("be-idioma-txt"),
      "idiomas",
      { firstText: "(Seleccionar idioma)", firstValue: "" }
    );

    addOptions(
      document.getElementById("be-tipo-guia"),
      [
        { value: "GUIA", text: "Guía" },
        { value: "AUDIOGUIA", text: "Audioguía" },
        { value: "NINGUNO", text: "Ninguno" },
        { value: "__write__", text: "Escribir nuevo..." },
      ],
      { firstText: "(Seleccionar)", firstValue: "" }
    );
    initSelectConEscribirNuevo(document.getElementById("be-tipo-guia"), document.getElementById("be-tipo-guia-txt"));

    // ===== VUELO =====
    await fillSelectCatalogoConEscribir(
      document.getElementById("vu-origen"),
      document.getElementById("vu-origen-txt"),
      "vuelo_origen",
      { firstText: "(Seleccionar)", firstValue: "" }
    );

    await fillSelectFromCatalog(document.getElementById("vu-destino"), "vuelo_destino", {
      firstText: "(Seleccionar)",
      firstValue: "",
    });

    await fillSelectFromCatalog(document.getElementById("vu-clase"), "vuelo_clase", {
      firstText: "(Seleccionar)",
      firstValue: "",
    });

    await fillSelectFromCatalog(document.getElementById("vu-equipaje"), "vuelo_equipaje", {
      firstText: "(Seleccionar)",
      firstValue: "",
    });

    const selVuEsc = document.getElementById("vu-escalas");
    if (selVuEsc) {
      addOptions(
        selVuEsc,
        [0, 1, 2, 3].map((n) => ({ value: String(n), text: String(n) })),
        { firstText: "(Seleccionar)", firstValue: "" }
      );
    }

    // ===== TREN =====
    await fillSelectCatalogoConEscribir(
      document.getElementById("tr-origen"),
      document.getElementById("tr-origen-txt"),
      "tren_origen",
      { firstText: "(Seleccionar)", firstValue: "" }
    );

    await fillSelectFromCatalog(document.getElementById("tr-destino"), "tren_destino", {
      firstText: "(Seleccionar)",
      firstValue: "",
    });

    await fillSelectFromCatalog(document.getElementById("tr-clase"), "tren_clase", {
      firstText: "(Seleccionar)",
      firstValue: "",
    });

    await fillSelectFromCatalog(document.getElementById("tr-equipaje"), "tren_equipaje", {
      firstText: "(Seleccionar)",
      firstValue: "",
    });

    const selTrEsc = document.getElementById("tr-escalas");
    if (selTrEsc) {
      addOptions(
        selTrEsc,
        [0, 1, 2, 3].map((n) => ({ value: String(n), text: String(n) })),
        { firstText: "(Seleccionar)", firstValue: "" }
      );
    }

    // ===== TRASLADO =====
    addOptions(
      document.getElementById("tr-tipo"),
      [
        { value: "AEROPUERTO_HOTEL", text: "Aeropuerto → Hotel" },
        { value: "HOTEL_AEROPUERTO", text: "Hotel → Aeropuerto" },
        { value: "ESTACION_HOTEL", text: "Estación → Hotel" },
        { value: "HOTEL_ESTACION", text: "Hotel → Estación" },
        { value: "PUERTO_HOTEL", text: "Puerto → Hotel" },
        { value: "HOTEL_PUERTO", text: "Hotel → Puerto" },
        { value: "HOTEL_HOTEL", text: "Hotel → Hotel" },
        { value: "__write__", text: "Escribir nuevo..." },
      ],
      { firstText: "(Seleccionar)", firstValue: "" }
    );
    initSelectConEscribirNuevo(document.getElementById("tr-tipo"), document.getElementById("tr-tipo-otro"));

    addOptions(
      document.getElementById("tr-vehiculo"),
      [
        { value: "SEDAN", text: "Sedán" },
        { value: "VAN", text: "Van" },
        { value: "MINIBUS", text: "Minibús" },
        { value: "BUS", text: "Bus" },
        { value: "__write__", text: "Escribir nuevo..." },
      ],
      { firstText: "(Seleccionar)", firstValue: "" }
    );
    initSelectConEscribirNuevo(document.getElementById("tr-vehiculo"), document.getElementById("tr-vehiculo-txt"));

    await initOtroCatalogo({
      grupoCatalogo: "traslado_origen",
      selectCatalogoEl: document.getElementById("tr-origen-select"),
      inputTextoEl: document.getElementById("tr-origen-txt"),
    });
    await initOtroCatalogo({
      grupoCatalogo: "traslado_destino",
      selectCatalogoEl: document.getElementById("tr-destino-select"),
      inputTextoEl: document.getElementById("tr-destino-txt"),
    });

    // ===== TOUR =====
    addOptions(
      document.getElementById("tu-tipo-guia"),
      [
        { value: "GUIA", text: "Guía" },
        { value: "AUDIOGUIA", text: "Audioguía" },
        { value: "CHOFER_GUIA", text: "Chofer-guía" },
        { value: "__write__", text: "Escribir nuevo..." },
      ],
      { firstText: "(Seleccionar)", firstValue: "" }
    );
    initSelectConEscribirNuevo(document.getElementById("tu-tipo-guia"), document.getElementById("tu-tipo-guia-otro"));

    await fillSelectCatalogoConEscribir(
      document.getElementById("tu-idioma"),
      document.getElementById("tu-idioma-txt"),
      "idiomas",
      { firstText: "(Seleccionar idioma)", firstValue: "" }
    );
  }

  async function renderCamposDinamicosPorTipo() {
    if (!contDinamico) return;
    await initMiniFormOnce();
    ocultarTodasLasSecciones();

    const opt = filtroTipoServicio?.options?.[filtroTipoServicio.selectedIndex];
    const tipoTexto = (opt?.textContent || "").toLowerCase();

    if (tipoTexto.includes("aloj")) return show(document.getElementById("sec-alojamiento"), true);
    if (tipoTexto.includes("boleto")) return show(document.getElementById("sec-boleto"), true);
    if (tipoTexto.includes("vuelo")) return show(document.getElementById("sec-vuelo"), true);
    if (tipoTexto.includes("tren")) return show(document.getElementById("sec-tren"), true);
    if (tipoTexto.includes("trasl")) return show(document.getElementById("sec-traslado"), true);
    if (tipoTexto.includes("excurs") || tipoTexto.includes("visita") || tipoTexto.includes("tour"))
      return show(document.getElementById("sec-tour"), true);
  }

  // ==========================
  // Guardar servicio rápido
  // ==========================
  btnGuardarSrv?.addEventListener("click", async () => {
    limpiarMensajeCrearServicio(msgCrearSrv);

    const id_ciudad = filtroCiudad?.value;
    const id_tipo = filtroTipoServicio?.value;
    const prov = selProveedorNuevo?.value;

    if (!prov) return mostrarMensajeCrearServicio(msgCrearSrv, "Selecciona un proveedor.");
    if (!id_ciudad) return mostrarMensajeCrearServicio(msgCrearSrv, "Selecciona una ciudad.");
    if (!id_tipo) return mostrarMensajeCrearServicio(msgCrearSrv, "Selecciona el tipo de servicio.");

    const tiempoServicioFinal = leerValorOtro({
      selectCatalogoEl: selTiempoServicio,
      inputTextoEl: txtTiempoServicio,
    });

    const payload = {
      id_tipo: Number(id_tipo),
      id_proveedor: Number(prov),
      id_ciudad: Number(id_ciudad),
      tiempo_servicio: tiempoServicioFinal || null,
      privado: selPrivado?.value === "1",
      descripcion: (inpDesc?.value || "").trim() || null,
      link_reserva: (inpLinkReserva?.value || "").trim() || null,
    };

    const tipoTexto = (filtroTipoServicio?.options?.[filtroTipoServicio.selectedIndex]?.textContent || "").toLowerCase();

    // ALOJAMIENTO
    if (tipoTexto.includes("aloj")) {
      const selReg = document.getElementById("aloj-regimen");
      const selCatHotel = document.getElementById("aloj-categoria-hotel");
      const selCatHab = document.getElementById("aloj-categoria-hab");

      const regVal = leerSelectOEscribir(selReg, document.getElementById("aloj-regimen-txt"));
      const catHotelVal = leerSelectOEscribir(selCatHotel, document.getElementById("aloj-categoria-hotel-txt"));
      const catHabVal = leerSelectOEscribir(selCatHab, document.getElementById("aloj-categoria-hab-txt"));

      payload.alojamiento = {
        noches: Number(document.getElementById("aloj-noches")?.value || 1),
        habitaciones: Number(document.getElementById("aloj-habitaciones")?.value || 1),

        regimen: selReg?.value === "__write__" ? "OTRO" : selReg?.value || null,
        regimen_otro: selReg?.value === "__write__" ? regVal : null,

        categoria_hotel: selCatHotel?.value === "__write__" ? "OTRO" : selCatHotel?.value || null,
        categoria_hotel_otro: selCatHotel?.value === "__write__" ? catHotelVal : null,

        categoria_hab: selCatHab?.value === "__write__" ? "OTRO" : selCatHab?.value || null,
        categoria_hab_otro: selCatHab?.value === "__write__" ? catHabVal : null,
      };
    }

    // BOLETO
    if (tipoTexto.includes("boleto")) {
      const tipoEntradaSel = document.getElementById("be-tipo-entrada");
      const tipoEntradaTxt = document.getElementById("be-tipo-entrada-txt");
      const tipoEntradaVal = leerSelectOEscribir(tipoEntradaSel, tipoEntradaTxt);

      const lugarFinal = leerValorOtro({
        selectCatalogoEl: document.getElementById("be-lugar-select"),
        inputTextoEl: document.getElementById("be-lugar-txt"),
      });

      const idiomaSel = document.getElementById("be-idioma");
      const idiomaTxt = document.getElementById("be-idioma-txt");
      const idiomaVal = leerSelectOEscribir(idiomaSel, idiomaTxt);

      const tipoGuiaSel = document.getElementById("be-tipo-guia");
      const tipoGuiaTxt = document.getElementById("be-tipo-guia-txt");
      const tipoGuiaVal = leerSelectOEscribir(tipoGuiaSel, tipoGuiaTxt);

      payload.boleto_entrada = {
        boleto_entrada: lugarFinal || null,
        tipo_entrada: tipoEntradaSel?.value === "__write__" ? "OTRA" : tipoEntradaSel?.value || null,
        tipo_entrada_otro: tipoEntradaSel?.value === "__write__" ? tipoEntradaVal : null,
        audioguia: tipoGuiaVal === "AUDIOGUIA",
        tipo_guia: tipoGuiaVal || null,
        idioma: idiomaVal || null,
      };
    }

    // TRASLADO
    if (tipoTexto.includes("trasl")) {
      const tipoSel = document.getElementById("tr-tipo");
      const tipoTxt = document.getElementById("tr-tipo-otro");
      const tipoFinal = leerSelectOEscribir(tipoSel, tipoTxt);

      const vehSel = document.getElementById("tr-vehiculo");
      const vehTxt = document.getElementById("tr-vehiculo-txt");
      const vehFinal = leerSelectOEscribir(vehSel, vehTxt);

      const origenFinal = leerValorOtro({
        selectCatalogoEl: document.getElementById("tr-origen-select"),
        inputTextoEl: document.getElementById("tr-origen-txt"),
      });
      const destinoFinal = leerValorOtro({
        selectCatalogoEl: document.getElementById("tr-destino-select"),
        inputTextoEl: document.getElementById("tr-destino-txt"),
      });

      payload.traslado = {
        origen: origenFinal || null,
        destino: destinoFinal || null,
        tipo_traslado: tipoSel?.value === "__write__" ? "OTRO" : tipoSel?.value || null,
        tipo_traslado_otro: tipoSel?.value === "__write__" ? tipoFinal : null,
        vehiculo: vehSel?.value === "__write__" ? "OTRO" : vehSel?.value || null,
        vehiculo_otro: vehSel?.value === "__write__" ? vehFinal : null,
        nota: document.getElementById("tr-nota")?.value?.trim() || null,
      };
    }

    // TOUR
    if (tipoTexto.includes("excurs") || tipoTexto.includes("visita") || tipoTexto.includes("tour")) {
      const tipoGuiaSel = document.getElementById("tu-tipo-guia");
      const tipoGuiaTxt = document.getElementById("tu-tipo-guia-otro");
      const tipoGuiaVal = leerSelectOEscribir(tipoGuiaSel, tipoGuiaTxt);

      const idiomaSel = document.getElementById("tu-idioma");
      const idiomaTxt = document.getElementById("tu-idioma-txt");
      const idiomaVal = leerSelectOEscribir(idiomaSel, idiomaTxt);

      payload.tour = {
        tipo_guia: tipoGuiaSel?.value === "__write__" ? "OTRO" : tipoGuiaSel?.value || null,
        tipo_guia_otro: tipoGuiaSel?.value === "__write__" ? tipoGuiaVal : null,
        idioma: idiomaSel?.value === "__write__" ? "OTRO" : idiomaSel?.value || null,
        idioma_otro: idiomaSel?.value === "__write__" ? idiomaVal : null,
      };
    }

    // VUELO
    if (tipoTexto.includes("vuelo")) {
      const origen = leerSelectOEscribir(document.getElementById("vu-origen"), document.getElementById("vu-origen-txt"));
      const destino = (document.getElementById("vu-destino")?.value || "").trim();
      const clase = (document.getElementById("vu-clase")?.value || "").trim();
      const equipaje = (document.getElementById("vu-equipaje")?.value || "").trim();
      const escalasSel = document.getElementById("vu-escalas");
      const escalasVal = (escalasSel?.value || "").trim();
      const n = Number(escalasVal);
      const escalasNum = Number.isFinite(n) ? n : 0;

      payload.vuelo = {
        origen: origen || "",
        destino: destino || "",
        escalas: escalasNum,
        clase: clase || "",
        equipaje: equipaje || "",
      };
    }

    // TREN
    if (tipoTexto.includes("tren")) {
      const origen = leerSelectOEscribir(document.getElementById("tr-origen"), document.getElementById("tr-origen-txt"));
      const destino = (document.getElementById("tr-destino")?.value || "").trim();
      const clase = (document.getElementById("tr-clase")?.value || "").trim();
      const equipaje = (document.getElementById("tr-equipaje")?.value || "").trim();
      const escalasSel = document.getElementById("tr-escalas");
      const escalasVal = (escalasSel?.value || "").trim();
      const n = Number(escalasVal);
      const escalasNum = Number.isFinite(n) ? n : 0;

      payload.tren = {
        origen: origen || "",
        destino: destino || "",
        escalas: escalasNum,
        clase: clase || "",
        equipaje: equipaje || null,
        sillas_reservadas: document.getElementById("tr-sillas")?.value === "1",
      };
    }

    try {
      const resp = await fetch("/api/servicios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok) throw new Error(data.mensaje || data.error || "Error creando servicio");

      await cargarTodosLosServicios();

      if (selectServicio) selectServicio.value = String(data.id_servicio);

      panelCrear.style.display = "none";
    } catch (e) {
      console.error(e);
      mostrarMensajeCrearServicio(msgCrearSrv, e.message);
    }
  });

  // ==========================
  // Insertar servicio
  // ==========================
  btnInsertarServicio?.addEventListener("click", async () => {
    limpiarError(mensajeErrorEl);

    if (!idCotizacion) return mostrarError(mensajeErrorEl, "Falta el ID de cotización en la URL.");

    const fechaDesde = fechaDesdeInput?.value;
    const fechaHasta = fechaHastaInput?.value;
    const idServicioSeleccionado = selectServicio?.value;

    if (!idServicioSeleccionado) return mostrarError(mensajeErrorEl, "Selecciona un servicio antes de insertarlo.");
    if (!fechaDesde) return mostrarError(mensajeErrorEl, "Selecciona la fecha de servicio.");

    if (esTipoAlojamientoSeleccionado()) {
      if (!fechaHasta) return mostrarError(mensajeErrorEl, "En alojamiento debes seleccionar también la fecha hasta (check-out).");

      const noches = calcularNoches(fechaDesde, fechaHasta);
      if (!Number.isFinite(noches) || noches < 1) {
        return mostrarError(mensajeErrorEl, "La fecha hasta debe ser posterior a la fecha desde (mínimo 1 noche).");
      }
    }

    const esOpcional = chkOpcional && chkOpcional.checked ? 1 : 0;

    try {
      const resp = await fetch(`/api/cotizaciones/${idCotizacion}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_servicio: Number(idServicioSeleccionado),
          fecha_servicio: fechaDesde,
          es_opcional: esOpcional,
        }),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok) throw new Error(data.mensaje || data.error || "Error al insertar servicio.");

      // ✅ completa texto si backend no lo devuelve
      const row = data.item || {};
      if (!row.servicio_texto) {
        const idSrvKey = String(row.id_servicio || idServicioSeleccionado);
        if (servicioTextoById.has(idSrvKey)) row.servicio_texto = servicioTextoById.get(idSrvKey);
      }

      const nuevoItem = mapRowToItem(row, {
        nextIdLocal: () => nextIdLocal++,
        servicioTextoById,
      });
      items.push(nuevoItem);
      actualizarTablaDesdeEstado();
      await guardarOrdenEnBackend(idCotizacion, items);
    } catch (err) {
      console.error(err);
      mostrarError(mensajeErrorEl, "No se pudo insertar el servicio: " + err.message);
    }
  });

  btnCrearServicio?.addEventListener("click", () => {
    window.location.href = "../etapa2/servicios-crear.html";
  });

  // ==========================
  // Init
  // ==========================
  (async () => {
    await cargarContinentes();
    await cargarTiposServicio();
    await cargarTodosLosServicios();
    await cargarProveedores();
    await cargarCotizacionExistente();
    actualizarVisibilidadFechaHasta();
    actualizarNochesYFiltrarServicios();

    if (inpNombreAutoPreview) {
      inpNombreAutoPreview.value = "Se genera automáticamente al guardar";
    }
  })();

  document.getElementById("btn-export-excel")
    ?.addEventListener("click", () => exportarExcelCotizacion(idCotizacion));

});