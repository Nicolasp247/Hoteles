// public/etapa3/cotizacion-editar/features/catalog-loaders.js

/**
 * Este archivo reúne las funciones que cargan información base para la pantalla.
 *
 * Aquí vive la lógica para traer continentes, países, ciudades, tipos de servicio,
 * servicios disponibles y proveedores. La idea es que el archivo principal deje
 * de cargar estas tareas repetitivas y se quede solo con la coordinación general.
 */

import { fetchLista } from "../helpers/http.js";

/**
 * Esta función crea todas las acciones de carga que necesita la pantalla.
 *
 * Recibe los elementos del DOM, el estado compartido y las funciones de apoyo
 * para mostrar errores o refrescar el filtro de servicios cuando cambian los datos.
 */
export function createCatalogLoaders({
  filtroContinente,
  filtroPais,
  filtroCiudad,
  filtroTipoServicio,
  selProveedorNuevo,
  allServiciosRef,
  setServicioTextoById,
  mostrarError,
  mensajeErrorEl,
  filtrarServicios,
}) {
  /**
   * Esta función carga la lista de continentes y llena su select principal.
   * Si algo falla, deja el error visible en pantalla.
   */
  async function cargarContinentes() {
    try {
      const lista = await fetchLista("/api/continentes", ["continentes"]);

      filtroContinente.innerHTML = "";
      filtroContinente.appendChild(new Option("(Todos los continentes)", ""));

      lista.forEach((continente) => {
        filtroContinente.appendChild(
          new Option(continente.nombre, continente.id)
        );
      });
    } catch (err) {
      console.error("Error cargando continentes", err);
      mostrarError(
        mensajeErrorEl,
        "No se pudieron cargar los continentes: " + err.message
      );
    }
  }

  /**
   * Esta función carga los países del continente elegido.
   * Si no hay continente seleccionado, limpia país y ciudad.
   */
  async function cargarPaises(idContinente) {
    try {
      if (!idContinente) {
        filtroPais.innerHTML = "<option value=''> (Todos los países) </option>";
        filtroCiudad.innerHTML = "<option value=''> (Todas las ciudades) </option>";
        return;
      }

      const lista = await fetchLista(`/api/paises/${idContinente}`, ["paises"]);

      filtroPais.innerHTML = "";
      filtroPais.appendChild(new Option("(Todos los países)", ""));

      lista.forEach((pais) => {
        filtroPais.appendChild(new Option(pais.nombre, pais.id));
      });

      filtroCiudad.innerHTML = "<option value=''> (Todas las ciudades) </option>";
    } catch (err) {
      console.error("Error cargando países", err);
      mostrarError(
        mensajeErrorEl,
        "No se pudieron cargar los países: " + err.message
      );
    }
  }

  /**
   * Esta función carga las ciudades del país elegido.
   * Si no hay país, deja el select de ciudades limpio.
   */
  async function cargarCiudades(idPais) {
    try {
      if (!idPais) {
        filtroCiudad.innerHTML = "<option value=''> (Todas las ciudades) </option>";
        return;
      }

      const lista = await fetchLista(`/api/ciudades/${idPais}`, ["ciudades"]);

      filtroCiudad.innerHTML = "";
      filtroCiudad.appendChild(new Option("(Todas las ciudades)", ""));

      lista.forEach((ciudad) => {
        filtroCiudad.appendChild(new Option(ciudad.nombre, ciudad.id));
      });
    } catch (err) {
      console.error("Error cargando ciudades", err);
      mostrarError(
        mensajeErrorEl,
        "No se pudieron cargar las ciudades: " + err.message
      );
    }
  }

  /**
   * Esta función carga los tipos de servicio y llena su select.
   * Deja una primera opción general para no obligar a filtrar de entrada.
   */
  async function cargarTiposServicio() {
    try {
      const lista = await fetchLista("/api/tiposervicio", [
        "tipos",
        "tipos_servicio",
        "tiposervicio",
      ]);

      filtroTipoServicio.innerHTML = "";
      filtroTipoServicio.appendChild(new Option("(Todos los tipos)", ""));

      lista.forEach((tipo) => {
        filtroTipoServicio.appendChild(new Option(tipo.nombre, tipo.id));
      });
    } catch (err) {
      console.error("Error cargando tipos", err);
      mostrarError(
        mensajeErrorEl,
        "No se pudieron cargar los tipos: " + err.message
      );
    }
  }

  /**
   * Esta función carga todos los servicios disponibles, actualiza el estado compartido
   * y además reconstruye el mapa rápido de id de servicio a texto visible.
   *
   * Al final vuelve a aplicar el filtro actual para que el select quede coherente
   * con lo que haya elegido el usuario.
   */
  async function cargarTodosLosServicios() {
    try {
      const lista = await fetchLista("/api/servicios", ["servicios"]);
      allServiciosRef.value = lista;

      const nuevoMapa = new Map(
        (allServiciosRef.value || []).map((servicio) => [
          String(servicio.id),
          (servicio.servicio_texto || "").trim() ||
            (servicio.nombre_wtravel || "").trim() ||
            `Servicio #${servicio.id}`,
        ])
      );

      setServicioTextoById(nuevoMapa);

      if (typeof filtrarServicios === "function") {
        filtrarServicios();
      }
    } catch (err) {
      console.error("Error cargando servicios", err);
      mostrarError(
        mensajeErrorEl,
        "No se pudieron cargar los servicios: " + err.message
      );
    }
  }

  /**
   * Esta función carga los proveedores del mini-form y llena su select.
   * Si falla, solo deja el error en consola porque no bloquea toda la pantalla.
   */
  async function cargarProveedores() {
    try {
      const lista = await fetchLista("/api/proveedores", ["proveedores"]);

      selProveedorNuevo.innerHTML = "";

      lista.forEach((proveedor) => {
        selProveedorNuevo.appendChild(
          new Option(
            `${proveedor.nombre} (${proveedor.iniciales || ""})`,
            proveedor.id
          )
        );
      });
    } catch (err) {
      console.error("Error cargando proveedores", err);
    }
  }

  return {
    cargarContinentes,
    cargarPaises,
    cargarCiudades,
    cargarTiposServicio,
    cargarTodosLosServicios,
    cargarProveedores,
  };
}