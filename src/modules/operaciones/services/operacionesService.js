// src/modules/operaciones/services/operacionesService.js
import {
  mockPersonal,
  mockProyectos,
  mockAsignaciones,
  mockViaticos,
  mockAuditoria,
  REGLAS_VIATICOS_VIGENTES
} from "../mocks/datosPrueba.js";
import {
  validarProyecto,
  ejecutarCierreProyecto,
  validarAsignacion,
  validarViatico,
  ejecutarBajaViatico,
  calcularTotalesYResumenReportes,
  obtenerFechaHoraLaPaz
} from "../utils/reglasOperaciones.js";

const STORAGE_KEY = "sii_modulo05_operaciones_v1";

function cargarEstadoLocal() {
  if (typeof window === "undefined" || !window.localStorage) {
    return crearEstadoBase();
  }
  try {
    const guardado = window.localStorage.getItem(STORAGE_KEY);
    if (!guardado) return crearEstadoBase();
    const parseado = JSON.parse(guardado);
    return {
      personal: Array.isArray(parseado.personal) ? parseado.personal : structuredClone(mockPersonal),
      proyectos: Array.isArray(parseado.proyectos) ? parseado.proyectos : structuredClone(mockProyectos),
      asignaciones: Array.isArray(parseado.asignaciones) ? parseado.asignaciones : structuredClone(mockAsignaciones),
      viaticos: Array.isArray(parseado.viaticos) ? parseado.viaticos : structuredClone(mockViaticos),
      auditoria: Array.isArray(parseado.auditoria) ? parseado.auditoria : structuredClone(mockAuditoria)
    };
  } catch {
    return crearEstadoBase();
  }
}

function guardarEstadoLocal(estado) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
  } catch {
    // Ignorar errores de cuota en navegadores restringidos
  }
}

function crearEstadoBase() {
  return {
    personal: structuredClone(mockPersonal),
    proyectos: structuredClone(mockProyectos),
    asignaciones: structuredClone(mockAsignaciones),
    viaticos: structuredClone(mockViaticos),
    auditoria: structuredClone(mockAuditoria)
  };
}

async function pausaSimulada(modoRed) {
  if (modoRed === "lenta") {
    await new Promise((resolve) => setTimeout(resolve, 900));
  } else {
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  if (modoRed === "error") {
    throw new Error("Error de conexión con el servidor (fallo de red simulado). Verifique su conectividad e intente nuevamente.");
  }
}

/**
 * Consulta no intrusiva a /api/personal (Módulo 02).
 * Si responde 501 (pendiente) o falla, conserva mockPersonal sin interrumpir el flujo.
 */
export async function sincronizarPersonalModulo02() {
  try {
    const resp = await fetch("/api/personal", {
      cache: "no-store",
      signal: AbortSignal.timeout(4000)
    });
    if (resp.status === 501) {
      return {
        origen: "respaldo-local",
        estadoModulo02: "Pendiente (501) — usando padrón de prueba compatible",
        personal: structuredClone(mockPersonal)
      };
    }
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data?.personal) && data.personal.length > 0) {
        return {
          origen: "api-modulo-02",
          estadoModulo02: "Conectado con Módulo 02 (/api/personal)",
          personal: data.personal
        };
      }
    }
  } catch {
    // Fallback silencioso
  }
  return {
    origen: "respaldo-local",
    estadoModulo02: "Respaldo local activo (Módulo 02 aún no conectado)",
    personal: structuredClone(mockPersonal)
  };
}

/**
 * Carga inicial de datos del Módulo 05 intentando /api/operaciones y sincronizando con almacenamiento local.
 */
export async function cargarDatosOperaciones({ modoRed = "normal" } = {}) {
  await pausaSimulada(modoRed);
  const estadoLocal = cargarEstadoLocal();
  const infoPersonal = await sincronizarPersonalModulo02();

  try {
    const resp = await fetch("/api/operaciones", {
      cache: "no-store",
      signal: AbortSignal.timeout(4000)
    });
    if (resp.ok) {
      const data = await resp.json();
      const consolidado = {
        personal: infoPersonal.personal,
        proyectos: data.proyectos || estadoLocal.proyectos,
        asignaciones: data.asignaciones || estadoLocal.asignaciones,
        viaticos: data.viaticos || estadoLocal.viaticos,
        auditoria: data.auditoria || estadoLocal.auditoria
      };
      guardarEstadoLocal(consolidado);
      return {
        ...consolidado,
        reglasViaticos: REGLAS_VIATICOS_VIGENTES,
        estadoConexion: "API /api/operaciones activa",
        estadoModulo02: infoPersonal.estadoModulo02
      };
    }
  } catch {
    // En desarrollo local sin modificar vite.config.js o sin red, opera con persistencia local validada
  }

  const estadoInicial = {
    ...estadoLocal,
    personal: infoPersonal.personal
  };
  guardarEstadoLocal(estadoInicial);

  return {
    ...estadoInicial,
    reglasViaticos: REGLAS_VIATICOS_VIGENTES,
    estadoConexion: "Modo autónomo con validaciones de contrato activas",
    estadoModulo02: infoPersonal.estadoModulo02
  };
}

export function restaurarDatosPruebaOperaciones() {
  const base = crearEstadoBase();
  guardarEstadoLocal(base);
  return base;
}

/**
 * Ejecuta una operación validando con las mismas reglas de backend y registrando auditoría.
 */
export async function procesarOperacionModulo05({
  tipoOperacion,
  datos,
  rolUsuario = "administrador",
  usuario = "admin.sii",
  modoRed = "normal"
}) {
  await pausaSimulada(modoRed);
  const estado = cargarEstadoLocal();

  const agregarAuditoria = (accion, entidad, detalle) => {
    const evento = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      fechaHora: obtenerFechaHoraLaPaz(),
      zonaHoraria: "America/La_Paz",
      usuario,
      rol: rolUsuario,
      accion,
      entidad,
      detalle
    };
    estado.auditoria = [evento, ...estado.auditoria];
  };

  if (tipoOperacion === "GUARDAR_PROYECTO") {
    const idEdicion = datos?.id ? Number(datos.id) : null;
    const validacion = validarProyecto(datos, estado.proyectos, idEdicion);
    if (!validacion.valido) {
      return {
        ok: false,
        codigo: 400,
        mensaje: "Revisa los campos marcados en el formulario de proyecto.",
        errores: validacion.errores
      };
    }

    if (idEdicion) {
      estado.proyectos = estado.proyectos.map((p) =>
        Number(p.id) === idEdicion
          ? {
              ...p,
              nombre: datos.nombre.trim(),
              descripcion: datos.descripcion.trim(),
              ubicacion: datos.ubicacion.trim(),
              fechaInicio: datos.fechaInicio,
              fechaFin: datos.fechaFin,
              estado: datos.estado || p.estado,
              presupuestoViaticos: Number(datos.presupuestoViaticos || 0)
            }
          : p
      );
      agregarAuditoria(
        "EDICION_PROYECTO",
        `Proyecto #${idEdicion}`,
        `Edición de proyecto '${datos.nombre.trim()}' (${datos.fechaInicio} al ${datos.fechaFin}).`
      );
    } else {
      const nuevoId = estado.proyectos.reduce((max, p) => Math.max(max, Number(p.id)), 100) + 1;
      const correlativo = String(estado.proyectos.length + 1).padStart(2, "0");
      const nuevoProyecto = {
        id: nuevoId,
        codigo: datos.codigo || `PRY-2026-${correlativo}`,
        nombre: datos.nombre.trim(),
        descripcion: datos.descripcion.trim(),
        ubicacion: datos.ubicacion.trim(),
        estado: datos.estado || "Activo",
        fechaInicio: datos.fechaInicio,
        fechaFin: datos.fechaFin,
        presupuestoViaticos: Number(datos.presupuestoViaticos || 0)
      };
      estado.proyectos = [nuevoProyecto, ...estado.proyectos];
      agregarAuditoria(
        "ALTA_PROYECTO",
        `Proyecto #${nuevoId}`,
        `Alta de nuevo proyecto '${nuevoProyecto.nombre}' (${nuevoProyecto.fechaInicio} al ${nuevoProyecto.fechaFin}).`
      );
    }

    guardarEstadoLocal(estado);
    return {
      ok: true,
      mensaje: idEdicion ? "Proyecto actualizado correctamente." : "Proyecto registrado correctamente.",
      estado
    };
  }

  if (tipoOperacion === "CERRAR_PROYECTO") {
    const resultado = ejecutarCierreProyecto({
      idProyecto: datos?.idProyecto,
      motivoCierre: datos?.motivoCierre,
      rolUsuario,
      proyectos: estado.proyectos,
      asignaciones: estado.asignaciones
    });

    if (!resultado.ok) {
      return resultado;
    }

    estado.proyectos = resultado.proyectos;
    estado.asignaciones = resultado.asignaciones;
    agregarAuditoria(
      "CIERRE_PROYECTO",
      `Proyecto #${datos.idProyecto}`,
      `${resultado.resumen} Motivo: ${datos.motivoCierre.trim()}`
    );
    guardarEstadoLocal(estado);
    return {
      ok: true,
      mensaje: resultado.resumen,
      estado
    };
  }

  if (tipoOperacion === "GUARDAR_ASIGNACION") {
    const idEdicion = datos?.id ? Number(datos.id) : null;
    const validacion = validarAsignacion(
      datos,
      estado.proyectos,
      estado.asignaciones,
      idEdicion
    );

    if (!validacion.valido) {
      return {
        ok: false,
        codigo: 400,
        mensaje: Object.values(validacion.errores)[0] || "Datos de asignación inválidos.",
        errores: validacion.errores
      };
    }

    const personaObj = estado.personal.find((p) => Number(p.id) === Number(datos.idPersonal));
    const proyectoObj = estado.proyectos.find((p) => Number(p.id) === Number(datos.idProyecto));
    const etiquetaPersona = personaObj ? `${personaObj.nombres} ${personaObj.apellidos}` : `Persona #${datos.idPersonal}`;
    const etiquetaProyecto = proyectoObj ? proyectoObj.nombre : `Proyecto #${datos.idProyecto}`;

    if (idEdicion) {
      estado.asignaciones = estado.asignaciones.map((a) =>
        Number(a.id) === idEdicion
          ? {
              ...a,
              idProyecto: Number(datos.idProyecto),
              idPersonal: Number(datos.idPersonal),
              funcion: datos.funcion.trim(),
              fechaInicio: datos.fechaInicio,
              fechaFin: datos.fechaFin,
              estado: datos.estado || a.estado
            }
          : a
      );
      agregarAuditoria(
        "EDICION_ASIGNACION",
        `Asignación #${idEdicion}`,
        `Actualización de asignación de ${etiquetaPersona} en '${etiquetaProyecto}' (${datos.fechaInicio} al ${datos.fechaFin}).`
      );
    } else {
      const nuevoId = estado.asignaciones.reduce((max, a) => Math.max(max, Number(a.id)), 300) + 1;
      const nuevaAsignacion = {
        id: nuevoId,
        idProyecto: Number(datos.idProyecto),
        idPersonal: Number(datos.idPersonal),
        funcion: datos.funcion.trim(),
        fechaInicio: datos.fechaInicio,
        fechaFin: datos.fechaFin,
        estado: "Activa"
      };
      estado.asignaciones = [nuevaAsignacion, ...estado.asignaciones];
      agregarAuditoria(
        "ALTA_ASIGNACION",
        `Asignación #${nuevoId}`,
        `Asignación de ${etiquetaPersona} como '${nuevaAsignacion.funcion}' en '${etiquetaProyecto}' (${nuevaAsignacion.fechaInicio} al ${nuevaAsignacion.fechaFin}).`
      );
    }

    guardarEstadoLocal(estado);
    return {
      ok: true,
      mensaje: idEdicion ? "Asignación actualizada correctamente." : "Asignación registrada correctamente.",
      estado
    };
  }

  if (tipoOperacion === "FINALIZAR_ASIGNACION") {
    const idAsignacion = Number(datos?.idAsignacion || 0);
    const existente = estado.asignaciones.find((a) => Number(a.id) === idAsignacion);
    if (!existente) {
      return { ok: false, codigo: 404, mensaje: "La asignación seleccionada no existe." };
    }
    estado.asignaciones = estado.asignaciones.map((a) =>
      Number(a.id) === idAsignacion ? { ...a, estado: "Finalizada" } : a
    );
    agregarAuditoria(
      "FINALIZAR_ASIGNACION",
      `Asignación #${idAsignacion}`,
      `Finalización de participación activa en Proyecto #${existente.idProyecto}. Se conserva en historial.`
    );
    guardarEstadoLocal(estado);
    return {
      ok: true,
      mensaje: "Participación marcada como finalizada y conservada en el historial.",
      estado
    };
  }

  if (tipoOperacion === "GUARDAR_VIATICO") {
    const idEdicion = datos?.id ? Number(datos.id) : null;
    const validacion = validarViatico(
      datos,
      estado.proyectos,
      estado.asignaciones,
      REGLAS_VIATICOS_VIGENTES
    );

    if (!validacion.valido) {
      return {
        ok: false,
        codigo: 400,
        mensaje: Object.values(validacion.errores)[0] || "El viático no cumple las reglas vigentes.",
        errores: validacion.errores
      };
    }

    const montoBase = Number(datos.monto);
    const montoAdic = datos.esGastoAdicional ? Number(datos.montoAdicional || 0) : 0;

    if (idEdicion) {
      estado.viaticos = estado.viaticos.map((v) =>
        Number(v.id) === idEdicion
          ? {
              ...v,
              idProyecto: Number(datos.idProyecto),
              idPersonal: Number(datos.idPersonal),
              categoria: datos.categoria,
              monto: montoBase,
              esGastoAdicional: Boolean(datos.esGastoAdicional),
              montoAdicional: montoAdic,
              comprobante: String(datos.comprobante || "").trim(),
              descripcion: datos.descripcion.trim(),
              justificacionAdicional: datos.esGastoAdicional ? String(datos.justificacionAdicional || "").trim() : "",
              fecha: datos.fecha
            }
          : v
      );
      agregarAuditoria(
        "EDICION_VIATICO",
        `Viático #${idEdicion}`,
        `Actualización de viático (${datos.categoria}) por Bs ${(montoBase + montoAdic).toFixed(2)}.`
      );
    } else {
      const nuevoId = estado.viaticos.reduce((max, v) => Math.max(max, Number(v.id)), 500) + 1;
      const nuevoViatico = {
        id: nuevoId,
        idProyecto: Number(datos.idProyecto),
        idPersonal: Number(datos.idPersonal),
        categoria: datos.categoria,
        monto: montoBase,
        esGastoAdicional: Boolean(datos.esGastoAdicional),
        montoAdicional: montoAdic,
        comprobante: String(datos.comprobante || "").trim(),
        descripcion: datos.descripcion.trim(),
        justificacionAdicional: datos.esGastoAdicional ? String(datos.justificacionAdicional || "").trim() : "",
        fecha: datos.fecha,
        estado: "Vigente",
        autorizadoPor: rolUsuario === "administrador" ? "Administrador" : "Operador"
      };
      estado.viaticos = [nuevoViatico, ...estado.viaticos];
      agregarAuditoria(
        "ALTA_VIATICO",
        `Viático #${nuevoId}`,
        `Registro de viático (${nuevoViatico.categoria}) por Bs ${(montoBase + montoAdic).toFixed(2)} en Proyecto #${nuevoViatico.idProyecto}.`
      );
    }

    guardarEstadoLocal(estado);
    return {
      ok: true,
      mensaje: idEdicion ? "Viático actualizado correctamente." : "Viático registrado correctamente.",
      estado
    };
  }

  if (tipoOperacion === "BAJA_VIATICO") {
    const resultado = ejecutarBajaViatico({
      idViatico: datos?.idViatico,
      motivoBaja: datos?.motivoBaja,
      rolUsuario,
      viaticos: estado.viaticos
    });

    if (!resultado.ok) {
      return resultado;
    }

    estado.viaticos = resultado.viaticos;
    agregarAuditoria(
      "BAJA_VIATICO",
      `Viático #${datos.idViatico}`,
      `${resultado.resumen} Motivo: ${datos.motivoBaja.trim()}`
    );
    guardarEstadoLocal(estado);
    return {
      ok: true,
      mensaje: resultado.resumen,
      estado
    };
  }

  return { ok: false, codigo: 400, mensaje: "Operación no soportada." };
}

/**
 * Contrato público de enlace con el Módulo 04 (Historial y reportes).
 * Permite consultar los totales conciliados aplicando exactamente los mismos filtros.
 */
export function obtenerDatosConciliadosParaReportes(filtros = {}) {
  const estado = cargarEstadoLocal();
  return calcularTotalesYResumenReportes({
    proyectos: estado.proyectos,
    personal: estado.personal,
    asignaciones: estado.asignaciones,
    viaticos: estado.viaticos,
    filtros
  });
}
