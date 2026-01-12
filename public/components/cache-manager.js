// public/components/cache-manager.js
// Cache reutilizable para páginas del front (precios, cotizador, etc.)

export function createCacheManager() {
  const catalogCache = new Map();      // grupo -> [{valor}]
  const detalleCacheById = new Map();  // id -> detalle servicio
  const servicioCacheById = new Map(); // id -> item de lista servicios

  function norm(v) {
    return String(v ?? "").trim().replace(/\s+/g, " ");
  }

  // -------------------------
  // CATALOGOS
  // -------------------------
  function getCatalog(grupo) {
    return catalogCache.get(String(grupo));
  }
  function setCatalog(grupo, value) {
    catalogCache.set(String(grupo), value);
  }
  function invalidateCatalog(grupo) {
    if (!grupo) return;
    catalogCache.delete(String(grupo));
  }

  function invalidateCatalogsFromPayload(tipoLower, payload) {
    if (!payload || typeof payload !== "object") return;

    if (payload.tiempo_servicio) invalidateCatalog("tiempo_servicio");

    if (tipoLower.includes("boleto") && payload.boleto_entrada) {
      if (payload.boleto_entrada.boleto_entrada) invalidateCatalog("boleto_lugar");
      if (payload.boleto_entrada.idioma) invalidateCatalog("idiomas");
    }

    if ((tipoLower.includes("excurs") || tipoLower.includes("visita") || tipoLower.includes("tour")) && payload.tour) {
      if (payload.tour.idioma || payload.tour.idioma_otro) invalidateCatalog("idiomas");
    }

    if (tipoLower.includes("trasl") && payload.traslado) {
      if (payload.traslado.origen) invalidateCatalog("traslado_origen");
      if (payload.traslado.destino) invalidateCatalog("traslado_destino");
    }

    if (tipoLower.includes("vuelo") && payload.vuelo) {
      if (payload.vuelo.origen) invalidateCatalog("vuelo_origen");
      if (payload.vuelo.destino) invalidateCatalog("vuelo_destino");
    }

    if (tipoLower.includes("tren") && payload.tren) {
      if (payload.tren.origen) invalidateCatalog("tren_origen");
      if (payload.tren.destino) invalidateCatalog("tren_destino");
    }
  }

  // -------------------------
  // DETALLE SERVICIO
  // -------------------------
  function getDetalle(id) {
    return detalleCacheById.get(String(id));
  }
  function setDetalle(id, det) {
    detalleCacheById.set(String(id), det);
  }
  function invalidateDetalle(id) {
    detalleCacheById.delete(String(id));
  }

  // -------------------------
  // LISTA SERVICIOS
  // -------------------------
  function getServicio(id) {
    return servicioCacheById.get(String(id));
  }
  function setServiciosList(lista) {
    servicioCacheById.clear();
    (lista || []).forEach((s) => servicioCacheById.set(String(s.id), s));
  }

  // Patch rápido del nombre en el cache de lista (para UX instantánea)
  function patchServicioAfterSave(servicioId, payload, putResponse) {
    const s = getServicio(servicioId);
    if (!s) return;

    const nombre =
      norm(putResponse?.nombre_wtravel || putResponse?.servicio_texto || payload?.nombre_wtravel || "") || null;

    if (nombre) {
      s.nombre_wtravel = nombre;
      s.servicio_texto = nombre;
    }

    if (payload?.id_ciudad) s.id_ciudad = payload.id_ciudad;
    if (payload?.id_tipo) s.id_tipo = payload.id_tipo;
  }

  // -------------------------
  // INVALIDACION CENTRAL (PENDIENTE 7)
  // -------------------------
  async function invalidateAfterSave({
    servicioId,
    tipoLower,
    payload,
    putResponse,

    // hooks para que cada página decida qué refrescar
    refreshCatalogosAfterSave, // async (tipoLower, payload) => void
    reloadServicios,           // async () => void
    reloadPendientes,          // async () => void
  }) {
    // 1) invalidar catálogos relevantes
    invalidateCatalogsFromPayload(tipoLower, payload);

    // 2) refrescar selects de catálogos (si la página tiene editor)
    if (typeof refreshCatalogosAfterSave === "function") {
      await refreshCatalogosAfterSave(tipoLower, payload);
    }

    // 3) invalidar detalle
    invalidateDetalle(servicioId);

    // 4) patch rápido del listado cache
    patchServicioAfterSave(servicioId, payload, putResponse);

    // 5) reload de lista + pendientes
    if (typeof reloadServicios === "function") await reloadServicios();
    if (typeof reloadPendientes === "function") await reloadPendientes();
  }

  return {
    // raw
    norm,

    // catalog
    getCatalog,
    setCatalog,
    invalidateCatalog,
    invalidateCatalogsFromPayload,

    // detalle
    getDetalle,
    setDetalle,
    invalidateDetalle,

    // lista
    getServicio,
    setServiciosList,
    patchServicioAfterSave,

    // central
    invalidateAfterSave,
  };
}
