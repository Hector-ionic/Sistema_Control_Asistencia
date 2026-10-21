// src/modules/operaciones/utils/reglasOperaciones.js
import { ESTADOS_PROYECTO, REGLAS_VIATICOS_VIGENTES } from "../mocks/datosPrueba.js";

/**
 * Obtiene fecha y hora en zona horaria America/La_Paz.
 */
export function obtenerFechaHoraLaPaz(fechaBase = new Date()) {
  try {
    return new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/La_Paz",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(fechaBase);
  } catch {
    return fechaBase.toISOString().replace("T", " ").slice(0, 19);
  }
}

export function hoyBolivia(fechaBase = new Date()) {
  return obtenerFechaHoraLaPaz(fechaBase).slice(0, 10);
}

/**
 * Comprueba si dos rangos de fechas [inicioA, finA] y [inicioB, finB] se solapan.
 * Si fechaFin es null (abierta), se considera vigente hacia adelante ('9999-12-31').
 */
export function rangosFechasSeSolapan(inicioA, finA, inicioB, finB) {
  if (!inicioA || !inicioB) return false;
  const finRealA = finA || "9999-12-31";
  const finRealB = finB || "9999-12-31";
  return inicioA <= finRealB && finRealA >= inicioB;
}

/**
 * Construye el objeto exacto para la operación `proyectos.guardar` de /api/backend:
 * { idProyecto: 0, codigo, nombre, cliente: '', ubicacion, descripcion, estado: 'Planificado', fechaInicio, fechaFin: null, version: 0 }
 */
export function construirPayloadProyecto(datos = {}) {
  return {
    idProyecto: Number(datos.idProyecto ?? datos.id ?? 0),
    codigo: String(datos.codigo || "").trim(),
    nombre: String(datos.nombre || "").trim(),
    cliente: String(datos.cliente ?? "").trim(),
    ubicacion: String(datos.ubicacion || "").trim(),
    descripcion: String(datos.descripcion || "").trim(),
    estado: datos.estado || "Planificado",
    fechaInicio: String(datos.fechaInicio || "").trim(),
    fechaFin: datos.fechaFin ? String(datos.fechaFin).trim() : null,
    version: Number(datos.version ?? 0)
  };
}

/**
 * 1. Validación de alta y edición de proyectos conforme al esquema C#.
 */
export function validarProyecto(datosProyecto, proyectosExistentes = [], idEdicion = null) {
  const errores = {};
  const payload = construirPayloadProyecto(datosProyecto);
  const idActual = Number(idEdicion ?? payload.idProyecto ?? 0);

  if (!payload.codigo || payload.codigo.length < 2) {
    errores.codigo = "El código del proyecto es obligatorio (ej. PRY-2026-04).";
  } else {
    const codigoDuplicado = proyectosExistentes.some(
      (p) =>
        Number(p.idProyecto ?? p.id) !== idActual &&
        String(p.codigo || "").trim().toLowerCase() === payload.codigo.toLowerCase()
    );
    if (codigoDuplicado) {
      errores.codigo = "Ya existe otro proyecto registrado con este código.";
    }
  }

  if (!payload.nombre || payload.nombre.length < 3) {
    errores.nombre = "El nombre del proyecto debe tener al menos 3 caracteres.";
  }

  if (!payload.ubicacion) {
    errores.ubicacion = "Indique la ubicación o área operativa del proyecto.";
  }

  if (!payload.descripcion) {
    errores.descripcion = "Ingrese la descripción del proyecto.";
  }

  if (!payload.fechaInicio) {
    errores.fechaInicio = "La fecha de inicio del proyecto es obligatoria.";
  }

  if (payload.fechaInicio && payload.fechaFin && payload.fechaInicio > payload.fechaFin) {
    errores.fechaFin = "La fecha de fin no puede ser anterior a la fecha de inicio.";
  }

  if (!ESTADOS_PROYECTO.includes(payload.estado)) {
    errores.estado = `El estado debe ser uno de: ${ESTADOS_PROYECTO.join(", ")}.`;
  }

  return {
    valido: Object.keys(errores).length === 0,
    errores,
    payload
  };
}

/**
 * 2. Para cerrar un proyecto: leerlo, conservar su versión y guardar `estado: 'Finalizado'`.
 * C# cierra sus asignaciones conservando el historial.
 */
export function prepararCierreProyecto(proyectoActual) {
  if (!proyectoActual || !Number(proyectoActual.idProyecto ?? proyectoActual.id)) {
    throw new Error("Debe proporcionar un proyecto válido leído previamente.");
  }
  if (proyectoActual.estado === "Finalizado") {
    throw new Error("El proyecto ya se encuentra en estado Finalizado.");
  }
  return construirPayloadProyecto({
    ...proyectoActual,
    estado: "Finalizado",
    fechaFin: proyectoActual.fechaFin || hoyBolivia()
  });
}

/**
 * Construye el objeto exacto para la operación `asignaciones.guardar` de /api/backend:
 * { idAsignacion: 0, idProyecto, idPasante, rol, fechaInicio, fechaFin: null, activo: true, version: 0 }
 */
export function construirPayloadAsignacion(datos = {}) {
  return {
    idAsignacion: Number(datos.idAsignacion ?? datos.id ?? 0),
    idProyecto: Number(datos.idProyecto || 0),
    idPasante: Number(datos.idPasante ?? datos.idPersonal ?? 0),
    rol: String(datos.rol ?? datos.funcion ?? "").trim(),
    fechaInicio: String(datos.fechaInicio || "").trim(),
    fechaFin: datos.fechaFin ? String(datos.fechaFin).trim() : null,
    activo: datos.activo !== undefined ? Boolean(datos.activo) : true,
    version: Number(datos.version ?? 0)
  };
}

/**
 * Para finalizar una asignación: leerla y guardar `activo: false`, conservando IDs y versión.
 */
export function prepararFinalizacionAsignacion(asignacionActual) {
  if (!asignacionActual || !Number(asignacionActual.idAsignacion ?? asignacionActual.id)) {
    throw new Error("Debe proporcionar una asignación existente para finalizarla.");
  }
  return construirPayloadAsignacion({
    ...asignacionActual,
    activo: false,
    fechaFin: asignacionActual.fechaFin || hoyBolivia()
  });
}

/**
 * 3. Validación de asignaciones:
 * - Respeta las fechas del proyecto.
 * - Previene asignaciones activas duplicadas (mismo idProyecto + idPasante con fechas solapadas).
 */
export function validarAsignacion(
  datosAsignacion,
  proyectos = [],
  asignacionesExistentes = [],
  idEdicion = null
) {
  const errores = {};
  const payload = construirPayloadAsignacion(datosAsignacion);
  const idActual = Number(idEdicion ?? payload.idAsignacion ?? 0);

  const proyecto = proyectos.find(
    (p) => Number(p.idProyecto ?? p.id) === payload.idProyecto
  );

  if (!payload.idProyecto || !proyecto) {
    errores.idProyecto = "Seleccione un proyecto válido.";
  } else if (proyecto.estado === "Finalizado" && idActual === 0) {
    errores.idProyecto = "No se pueden registrar nuevas asignaciones en un proyecto Finalizado.";
  }

  if (!payload.idPasante) {
    errores.idPasante = "Seleccione una persona del padrón.";
  }

  if (!payload.rol || payload.rol.length < 3) {
    errores.rol = "Especifique el rol o función en el proyecto (mínimo 3 caracteres).";
  }

  if (!payload.fechaInicio) {
    errores.fechaInicio = "La fecha de inicio de la asignación es obligatoria.";
  }

  if (payload.fechaInicio && payload.fechaFin && payload.fechaInicio > payload.fechaFin) {
    errores.fechaFin = "La fecha de fin no puede ser anterior a la fecha de inicio.";
  }

  // Verificar que respete las fechas del proyecto
  if (proyecto && payload.fechaInicio) {
    const fueraDeInicio = payload.fechaInicio < proyecto.fechaInicio;
    const fueraDeFinProyecto =
      proyecto.fechaFin &&
      ((payload.fechaFin && payload.fechaFin > proyecto.fechaFin) ||
        payload.fechaInicio > proyecto.fechaFin);

    if (fueraDeInicio || fueraDeFinProyecto) {
      const rangoTexto = `${proyecto.fechaInicio} al ${proyecto.fechaFin || "sin fecha límite"}`;
      errores.periodo = `Las fechas de asignación deben estar dentro del período del proyecto (${rangoTexto}).`;
    }
  }

  // Prevención de asignaciones activas duplicadas
  if (payload.activo && payload.idProyecto && payload.idPasante && payload.fechaInicio) {
    const asignacionSolapada = asignacionesExistentes.find((a) => {
      const idExistente = Number(a.idAsignacion ?? a.id ?? 0);
      if (idExistente === idActual && idActual > 0) return false;
      const estaActiva = a.activo !== undefined ? Boolean(a.activo) : a.estado === "Activa";
      if (!estaActiva) return false;
      const idPryExistente = Number(a.idProyecto);
      const idPasExistente = Number(a.idPasante ?? a.idPersonal);
      if (idPryExistente !== payload.idProyecto || idPasExistente !== payload.idPasante) {
        return false;
      }
      return rangosFechasSeSolapan(
        payload.fechaInicio,
        payload.fechaFin,
        a.fechaInicio,
        a.fechaFin
      );
    });

    if (asignacionSolapada) {
      errores.duplicado = `Asignación activa duplicada: la persona ya tiene participación activa en este proyecto del ${asignacionSolapada.fechaInicio} al ${asignacionSolapada.fechaFin || "presente"} (${asignacionSolapada.rol || asignacionSolapada.funcion}).`;
    }
  }

  return {
    valido: Object.keys(errores).length === 0,
    errores,
    payload
  };
}

/**
 * Construye el objeto exacto para la operación `viaticos.guardar` de /api/backend:
 * { idViatico: 0, idPasante, fecha, monto, concepto, gastoExtra: 0 }
 * Sin enviar idProyecto, presupuesto, categoria, comprobante ni justificacionAdicional.
 */
export function construirPayloadViatico(datos = {}) {
  return {
    idViatico: Number(datos.idViatico ?? datos.id ?? 0),
    idPasante: Number(datos.idPasante ?? datos.idPersonal ?? 0),
    fecha: String(datos.fecha || "").trim(),
    monto: Number(datos.monto),
    concepto: String(datos.concepto ?? datos.descripcion ?? "").trim(),
    gastoExtra: Number(datos.gastoExtra ?? datos.montoAdicional ?? 0)
  };
}

/**
 * 4. Validación de viáticos según reglas vigentes reales de C# (BACKEND-PARA-LOS-5-MODULOS.md):
 * - Viático base (`monto`): mayor a 0 y hasta 12 Bs (0 < monto <= 12).
 * - Gasto extra (`gastoExtra`): no negativo (>= 0).
 * - Esquema estricto: { idViatico, idPasante, fecha, monto, concepto, gastoExtra }.
 */
export function validarViatico(
  datosViatico,
  reglas = REGLAS_VIATICOS_VIGENTES
) {
  const errores = {};
  const payload = construirPayloadViatico(datosViatico);

  if (!payload.idPasante || payload.idPasante <= 0) {
    errores.idPasante = "Seleccione la persona beneficiaria (idPasante).";
  }

  if (!payload.fecha) {
    errores.fecha = "La fecha del viático es obligatoria (YYYY-MM-DD).";
  }

  if (Number.isNaN(payload.monto) || payload.monto <= 0) {
    errores.monto = "El viático base debe ser mayor a 0 Bs.";
  } else if (payload.monto > reglas.montoBaseMaximo) {
    errores.monto = `Regla vigente del sistema C#: el viático base (Bs ${payload.monto.toFixed(2)}) no puede superar Bs ${reglas.montoBaseMaximo.toFixed(2)}. Registre cualquier excedente en el campo 'gastoExtra'.`;
  }

  if (Number.isNaN(payload.gastoExtra) || payload.gastoExtra < 0) {
    errores.gastoExtra = "El gasto adicional (gastoExtra) no puede ser negativo.";
  }

  if (!payload.concepto || payload.concepto.length < 3) {
    errores.concepto = "Ingrese el concepto del viático (mínimo 3 caracteres).";
  }

  return {
    valido: Object.keys(errores).length === 0,
    errores,
    payload
  };
}

/**
 * Calcula el importe total (monto + gastoExtra) de un viático.
 */
export function importeTotalViatico(viatico) {
  const base = Number(viatico?.monto || 0);
  const extra = Number(viatico?.gastoExtra ?? 0);
  return Math.round((base + extra) * 100) / 100;
}

/**
 * 5. Cálculo de totales por persona, proyecto y período conciliado con el Módulo 04 (Reportes).
 * - Planta (`Personal de planta`) tiene `horasRequeridas: 0` y `aplicaMetaPasantia: false`.
 * - Relaciona los viáticos del pasante con los proyectos en los que tiene asignación durante la fecha del viático.
 */
export function calcularTotalesYResumenReportes({
  proyectos = [],
  personal = [],
  asignaciones = [],
  viaticos = [],
  filtros = {}
}) {
  const {
    idProyecto = "",
    idPasante = "",
    inicio = "",
    fin = ""
  } = filtros;

  const idPryFiltro = idProyecto ? Number(idProyecto) : null;
  const idPasFiltro = idPasante ? Number(idPasante) : null;

  // Filtrar asignaciones según proyecto, persona y rango de fechas
  const asignacionesFiltradas = asignaciones.filter((a) => {
    const aIdProyecto = Number(a.idProyecto);
    const aIdPasante = Number(a.idPasante ?? a.idPersonal);
    if (idPryFiltro && aIdProyecto !== idPryFiltro) return false;
    if (idPasFiltro && aIdPasante !== idPasFiltro) return false;
    if (inicio && a.fechaFin && a.fechaFin < inicio) return false;
    if (fin && a.fechaInicio > fin) return false;
    return true;
  });

  // Si se filtra por proyecto, determinar qué personas tienen asignación en ese proyecto
  const viaticosFiltrados = viaticos.filter((v) => {
    const vIdPasante = Number(v.idPasante ?? v.idPersonal);
    if (idPasFiltro && vIdPasante !== idPasFiltro) return false;
    if (inicio && v.fecha < inicio) return false;
    if (fin && v.fecha > fin) return false;

    if (idPryFiltro) {
      // Un viático corresponde al proyecto si la persona estuvo asignada a ese proyecto en esa fecha
      const asignadoEnFecha = asignaciones.some((a) => {
        if (Number(a.idProyecto) !== idPryFiltro) return false;
        if (Number(a.idPasante ?? a.idPersonal) !== vIdPasante) return false;
        const finAsig = a.fechaFin || "9999-12-31";
        return v.fecha >= a.fechaInicio && v.fecha <= finAsig;
      });
      if (!asignadoEnFecha) return false;
    }
    return true;
  });

  let totalMontoBase = 0;
  let totalGastoExtra = 0;
  let totalGeneralConciliado = 0;

  for (const v of viaticosFiltrados) {
    const base = Number(v.monto || 0);
    const extra = Number(v.gastoExtra || 0);
    totalMontoBase += base;
    totalGastoExtra += extra;
    totalGeneralConciliado += base + extra;
  }

  totalMontoBase = Math.round(totalMontoBase * 100) / 100;
  totalGastoExtra = Math.round(totalGastoExtra * 100) / 100;
  totalGeneralConciliado = Math.round(totalGeneralConciliado * 100) / 100;

  // Totales agrupados por proyecto
  const porProyecto = proyectos
    .filter((p) => !idPryFiltro || Number(p.idProyecto ?? p.id) === idPryFiltro)
    .map((p) => {
      const pid = Number(p.idProyecto ?? p.id);
      const asignacionesPry = asignacionesFiltradas.filter(
        (a) => Number(a.idProyecto) === pid
      );
      const viaticosPry = viaticosFiltrados.filter((v) => {
        const vidPasante = Number(v.idPasante ?? v.idPersonal);
        return asignaciones.some((a) => {
          if (Number(a.idProyecto) !== pid) return false;
          if (Number(a.idPasante ?? a.idPersonal) !== vidPasante) return false;
          const finAsig = a.fechaFin || "9999-12-31";
          return v.fecha >= a.fechaInicio && v.fecha <= finAsig;
        });
      });

      const totalBasePry = Math.round(
        viaticosPry.reduce((acc, item) => acc + Number(item.monto || 0), 0) * 100
      ) / 100;
      const totalExtraPry = Math.round(
        viaticosPry.reduce((acc, item) => acc + Number(item.gastoExtra || 0), 0) * 100
      ) / 100;
      const totalViaticos = Math.round((totalBasePry + totalExtraPry) * 100) / 100;

      return {
        idProyecto: pid,
        codigo: p.codigo,
        nombre: p.nombre,
        cliente: p.cliente || "",
        estado: p.estado,
        version: p.version ?? 1,
        periodo: `${p.fechaInicio} al ${p.fechaFin || "Abierto"}`,
        participantesCount: asignacionesPry.length,
        activosCount: asignacionesPry.filter((a) => a.activo).length,
        viaticosCount: viaticosPry.length,
        totalBase: totalBasePry,
        totalGastoExtra: totalExtraPry,
        totalViaticos
      };
    });

  // Totales agrupados por persona (respetando tipoContrato: 'Pasante' | 'Personal de planta')
  const porPersona = personal
    .filter((per) => !idPasFiltro || Number(per.idPasante ?? per.id) === idPasFiltro)
    .map((per) => {
      const idPer = Number(per.idPasante ?? per.id);
      const tipoContrato = per.tipoContrato || (per.tipo === "Planta" ? "Personal de planta" : "Pasante");
      const esPasante = tipoContrato === "Pasante";

      const viaticosPer = viaticosFiltrados.filter(
        (v) => Number(v.idPasante ?? v.idPersonal) === idPer
      );
      const asignacionesPer = asignacionesFiltradas.filter(
        (a) => Number(a.idPasante ?? a.idPersonal) === idPer
      );

      const totalBase = Math.round(
        viaticosPer.reduce((acc, item) => acc + Number(item.monto || 0), 0) * 100
      ) / 100;
      const totalExtra = Math.round(
        viaticosPer.reduce((acc, item) => acc + Number(item.gastoExtra || 0), 0) * 100
      ) / 100;
      const totalPersona = Math.round((totalBase + totalExtra) * 100) / 100;

      return {
        idPasante: idPer,
        codigo: per.codigo,
        nombreCompleto: `${per.nombres} ${per.apellidos}`,
        tipoContrato,
        horasRequeridas: esPasante ? Number(per.horasRequeridas ?? 600) : 0,
        aplicaMetaPasantia: esPasante,
        asignacionesCount: asignacionesPer.length,
        viaticosCount: viaticosPer.length,
        totalBase,
        totalGastoExtra: totalExtra,
        totalViaticosConciliado: totalPersona
      };
    });

  return {
    moneda: REGLAS_VIATICOS_VIGENTES.moneda,
    zonaHoraria: "America/La_Paz",
    generadoEn: obtenerFechaHoraLaPaz(),
    filtrosAplicados: {
      inicio: inicio || null,
      fin: fin || null,
      idProyecto: idPryFiltro,
      id: idPasFiltro
    },
    resumenGlobal: {
      totalMontoBase,
      totalGastoExtra,
      totalGeneralConciliado,
      cantidadViaticos: viaticosFiltrados.length,
      totalAsignacionesEnPeriodo: asignacionesFiltradas.length
    },
    porProyecto,
    porPersona,
    registrosConciliados: viaticosFiltrados
  };
}
