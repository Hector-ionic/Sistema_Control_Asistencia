// src/modules/operaciones/utils/reglasOperaciones.js
import { REGLAS_VIATICOS_VIGENTES } from "../mocks/datosPrueba.js";

/**
 * Obtiene marca de tiempo actual formateada en zona horaria America/La_Paz.
 */
export function obtenerFechaHoraLaPaz(fechaBase = new Date()) {
  try {
    const partes = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/La_Paz",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(fechaBase);
    return partes;
  } catch {
    return fechaBase.toISOString().replace("T", " ").slice(0, 19);
  }
}

/**
 * Comprueba si dos rangos de fechas [inicioA, finA] y [inicioB, finB] se solapan.
 */
export function rangosFechasSeSolapan(inicioA, finA, inicioB, finB) {
  if (!inicioA || !finA || !inicioB || !finB) return false;
  return inicioA <= finB && finA >= inicioB;
}

/**
 * 1. Validación de alta y edición de proyectos.
 */
export function validarProyecto(datosProyecto, proyectosExistentes = [], idEdicion = null) {
  const errores = {};
  const nombre = String(datosProyecto?.nombre || "").trim();
  const descripcion = String(datosProyecto?.descripcion || "").trim();
  const ubicacion = String(datosProyecto?.ubicacion || "").trim();
  const fechaInicio = String(datosProyecto?.fechaInicio || "").trim();
  const fechaFin = String(datosProyecto?.fechaFin || "").trim();
  const estado = datosProyecto?.estado || "Activo";
  const presupuesto = Number(datosProyecto?.presupuestoViaticos ?? 0);

  if (!nombre || nombre.length < 3) {
    errores.nombre = "El nombre del proyecto debe tener al menos 3 caracteres.";
  } else {
    const duplicadoNombre = proyectosExistentes.some(
      (p) =>
        Number(p.id) !== Number(idEdicion) &&
        p.nombre.trim().toLowerCase() === nombre.toLowerCase()
    );
    if (duplicadoNombre) {
      errores.nombre = "Ya existe un proyecto registrado con este nombre.";
    }
  }

  if (!descripcion) {
    errores.descripcion = "Ingrese una descripción breve del alcance del proyecto.";
  }

  if (!ubicacion) {
    errores.ubicacion = "Indique la ubicación o área operativa del proyecto.";
  }

  if (!fechaInicio) {
    errores.fechaInicio = "La fecha de inicio del proyecto es obligatoria.";
  }

  if (!fechaFin) {
    errores.fechaFin = "La fecha de finalización del proyecto es obligatoria.";
  }

  if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
    errores.fechaFin = "La fecha de fin no puede ser anterior a la fecha de inicio del proyecto.";
  }

  if (!["Activo", "Pausado", "Cerrado"].includes(estado)) {
    errores.estado = "El estado del proyecto debe ser Activo, Pausado o Cerrado.";
  }

  if (Number.isNaN(presupuesto) || presupuesto < 0) {
    errores.presupuestoViaticos = "El presupuesto referencial de viáticos debe ser un monto válido mayor o igual a 0.";
  }

  return {
    valido: Object.keys(errores).length === 0,
    errores
  };
}

/**
 * 2. Cierre de proyectos conservando participaciones.
 * Exige rol administrador y un motivo de cierre.
 */
export function ejecutarCierreProyecto({
  idProyecto,
  motivoCierre,
  rolUsuario = "operador",
  proyectos = [],
  asignaciones = []
}) {
  if (rolUsuario !== "administrador") {
    return {
      ok: false,
      codigo: 403,
      mensaje: "Acción no autorizada: solo el rol Administrador puede cerrar un proyecto."
    };
  }

  const proyecto = proyectos.find((p) => Number(p.id) === Number(idProyecto));
  if (!proyecto) {
    return {
      ok: false,
      codigo: 404,
      mensaje: "El proyecto indicado no existe."
    };
  }

  if (proyecto.estado === "Cerrado") {
    return {
      ok: false,
      codigo: 400,
      mensaje: "El proyecto ya se encuentra cerrado."
    };
  }

  const motivoLimpio = String(motivoCierre || "").trim();
  if (motivoLimpio.length < 5) {
    return {
      ok: false,
      codigo: 400,
      mensaje: "Debe registrar un motivo de cierre válido (mínimo 5 caracteres)."
    };
  }

  const fechaCierre = obtenerFechaHoraLaPaz().slice(0, 10);
  let participacionesConservadas = 0;

  const proyectosActualizados = proyectos.map((p) =>
    Number(p.id) === Number(idProyecto)
      ? {
          ...p,
          estado: "Cerrado",
          fechaCierre,
          motivoCierre: motivoLimpio
        }
      : p
  );

  // Se conservan todas las participaciones en el historial pasando las activas a "Cerrada por proyecto"
  const asignacionesActualizadas = asignaciones.map((a) => {
    if (Number(a.idProyecto) === Number(idProyecto)) {
      participacionesConservadas += 1;
      return {
        ...a,
        estado: a.estado === "Activa" ? "Cerrada por proyecto" : a.estado
      };
    }
    return a;
  });

  return {
    ok: true,
    codigo: 200,
    proyectos: proyectosActualizados,
    asignaciones: asignacionesActualizadas,
    participacionesConservadas,
    resumen: `Proyecto '${proyecto.nombre}' cerrado. Se conservaron ${participacionesConservadas} participación(es) en el historial.`
  };
}

/**
 * 3. Validación de asignación de personas, función, período y prevención de duplicados activos.
 * Criterio de aceptación: "Las asignaciones respetan las fechas del proyecto" y "Prevención de asignaciones activas duplicadas".
 */
export function validarAsignacion(
  datosAsignacion,
  proyectos = [],
  asignacionesExistentes = [],
  idEdicion = null
) {
  const errores = {};
  const idProyecto = Number(datosAsignacion?.idProyecto || 0);
  const idPersonal = Number(datosAsignacion?.idPersonal || 0);
  const funcion = String(datosAsignacion?.funcion || "").trim();
  const fechaInicio = String(datosAsignacion?.fechaInicio || "").trim();
  const fechaFin = String(datosAsignacion?.fechaFin || "").trim();

  const proyecto = proyectos.find((p) => Number(p.id) === idProyecto);

  if (!idProyecto || !proyecto) {
    errores.idProyecto = "Seleccione un proyecto válido.";
  } else if (proyecto.estado !== "Activo" && idEdicion === null) {
    errores.idProyecto = `No se pueden registrar nuevas asignaciones en un proyecto en estado '${proyecto.estado}'.`;
  }

  if (!idPersonal) {
    errores.idPersonal = "Seleccione una persona del padrón de personal.";
  }

  if (!funcion || funcion.length < 3) {
    errores.funcion = "Especifique la función o rol a desempeñar (mínimo 3 caracteres).";
  }

  if (!fechaInicio) {
    errores.fechaInicio = "La fecha de inicio de la asignación es obligatoria.";
  }

  if (!fechaFin) {
    errores.fechaFin = "La fecha de fin de la asignación es obligatoria.";
  }

  if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
    errores.fechaFin = "La fecha de fin de la asignación no puede ser anterior a la fecha de inicio.";
  }

  // Verificar que respete el período del proyecto
  if (proyecto && fechaInicio && fechaFin && fechaInicio <= fechaFin) {
    if (fechaInicio < proyecto.fechaInicio || fechaFin > proyecto.fechaFin) {
      errores.periodo = `Las fechas de asignación (${fechaInicio} al ${fechaFin}) deben estar dentro del período del proyecto (${proyecto.fechaInicio} al ${proyecto.fechaFin}).`;
    }
  }

  // Prevención de asignaciones activas duplicadas o solapadas para la misma persona y proyecto
  if (idProyecto && idPersonal && fechaInicio && fechaFin && fechaInicio <= fechaFin) {
    const asignacionSolapada = asignacionesExistentes.find((a) => {
      if (Number(a.id) === Number(idEdicion)) return false;
      if (a.estado !== "Activa") return false;
      if (Number(a.idProyecto) !== idProyecto || Number(a.idPersonal) !== idPersonal) return false;
      return rangosFechasSeSolapan(fechaInicio, fechaFin, a.fechaInicio, a.fechaFin);
    });

    if (asignacionSolapada) {
      errores.duplicado = `Asignación activa duplicada: la persona ya está asignada a este proyecto del ${asignacionSolapada.fechaInicio} al ${asignacionSolapada.fechaFin} (${asignacionSolapada.funcion}).`;
    }
  }

  return {
    valido: Object.keys(errores).length === 0,
    errores
  };
}

/**
 * 4. Validación de viáticos y gastos adicionales según reglas vigentes.
 */
export function validarViatico(
  datosViatico,
  proyectos = [],
  asignaciones = [],
  reglas = REGLAS_VIATICOS_VIGENTES
) {
  const errores = {};
  const idProyecto = Number(datosViatico?.idProyecto || 0);
  const idPersonal = Number(datosViatico?.idPersonal || 0);
  const categoria = String(datosViatico?.categoria || "Transporte").trim();
  const monto = Number(datosViatico?.monto);
  const esGastoAdicional = Boolean(datosViatico?.esGastoAdicional);
  const montoAdicional = esGastoAdicional ? Number(datosViatico?.montoAdicional || 0) : 0;
  const comprobante = String(datosViatico?.comprobante || "").trim();
  const descripcion = String(datosViatico?.descripcion || "").trim();
  const justificacionAdicional = String(datosViatico?.justificacionAdicional || "").trim();
  const fecha = String(datosViatico?.fecha || "").trim();

  const proyecto = proyectos.find((p) => Number(p.id) === idProyecto);

  if (!idProyecto || !proyecto) {
    errores.idProyecto = "Seleccione un proyecto válido.";
  } else if (proyecto.estado === "Cerrado") {
    errores.idProyecto = "No se pueden registrar o modificar viáticos en un proyecto cerrado.";
  }

  if (!idPersonal) {
    errores.idPersonal = "Seleccione la persona beneficiaria del viático.";
  }

  const topeCategoria = reglas.topesPorCategoria[categoria];
  if (!topeCategoria) {
    errores.categoria = "Seleccione una categoría de viático válida.";
  }

  if (Number.isNaN(monto) || monto <= 0) {
    errores.monto = "El monto base del viático debe ser mayor a 0.";
  } else if (topeCategoria && monto > topeCategoria) {
    errores.monto = `El monto base (${reglas.moneda} ${monto.toFixed(2)}) supera el tope vigente para ${categoria} (${reglas.moneda} ${topeCategoria.toFixed(2)}). Si requiere excedente, registre el resto como gasto adicional justificado.`;
  }

  if (esGastoAdicional) {
    if (Number.isNaN(montoAdicional) || montoAdicional <= 0) {
      errores.montoAdicional = "Ingrese un monto adicional mayor a 0 o desactive la opción de gasto adicional.";
    }
    const montoTotal = (Number.isNaN(monto) ? 0 : monto) + (Number.isNaN(montoAdicional) ? 0 : montoAdicional);
    if (montoTotal > reglas.topeMaximoConGastoAdicional) {
      errores.montoAdicional = `El total acumulado (${reglas.moneda} ${montoTotal.toFixed(2)}) excede el límite máximo autorizado con gasto adicional (${reglas.moneda} ${reglas.topeMaximoConGastoAdicional.toFixed(2)}).`;
    }
    if (reglas.requiereComprobanteEnAdicional && !comprobante) {
      errores.comprobante = "Los gastos adicionales exigen número de factura o comprobante de respaldo.";
    }
    if (justificacionAdicional.length < reglas.minLongitudJustificacionAdicional) {
      errores.justificacionAdicional = `Explique la justificación del gasto adicional (mínimo ${reglas.minLongitudJustificacionAdicional} caracteres).`;
    }
  }

  if (!descripcion || descripcion.length < 4) {
    errores.descripcion = "Ingrese el concepto o descripción del gasto (mínimo 4 caracteres).";
  }

  if (!fecha) {
    errores.fecha = "La fecha del viático es obligatoria.";
  } else if (proyecto && (fecha < proyecto.fechaInicio || fecha > proyecto.fechaFin)) {
    errores.fecha = `La fecha del viático (${fecha}) debe estar dentro de la vigencia del proyecto (${proyecto.fechaInicio} al ${proyecto.fechaFin}).`;
  }

  // Verificar que la persona tenga participación registrada en el proyecto
  if (idProyecto && idPersonal && asignaciones.length > 0) {
    const tieneAsignacionEnProyecto = asignaciones.some(
      (a) =>
        Number(a.idProyecto) === idProyecto &&
        Number(a.idPersonal) === idPersonal &&
        a.estado !== "Cancelada"
    );
    if (!tieneAsignacionEnProyecto) {
      errores.idPersonal = "La persona seleccionada debe contar con una asignación en este proyecto antes de registrarle viáticos.";
    }
  }

  return {
    valido: Object.keys(errores).length === 0,
    errores
  };
}

/**
 * 5. Baja autorizada de viáticos.
 * Requiere rol Administrador y motivo de baja documentado.
 */
export function ejecutarBajaViatico({
  idViatico,
  motivoBaja,
  rolUsuario = "operador",
  viaticos = []
}) {
  if (rolUsuario !== "administrador") {
    return {
      ok: false,
      codigo: 403,
      mensaje: "Acción rechazada: solo un Administrador está autorizado para dar de baja un viático."
    };
  }

  const viatico = viaticos.find((v) => Number(v.id) === Number(idViatico));
  if (!viatico) {
    return {
      ok: false,
      codigo: 404,
      mensaje: "El viático indicado no existe."
    };
  }

  if (viatico.estado === "Baja") {
    return {
      ok: false,
      codigo: 400,
      mensaje: "Este viático ya fue dado de baja anteriormente."
    };
  }

  const motivoLimpio = String(motivoBaja || "").trim();
  if (motivoLimpio.length < 5) {
    return {
      ok: false,
      codigo: 400,
      mensaje: "Indique el motivo de la baja autorizada (mínimo 5 caracteres)."
    };
  }

  const fechaBaja = obtenerFechaHoraLaPaz();
  const viaticosActualizados = viaticos.map((v) =>
    Number(v.id) === Number(idViatico)
      ? {
          ...v,
          estado: "Baja",
          motivoBaja: motivoLimpio,
          fechaBaja
        }
      : v
  );

  return {
    ok: true,
    codigo: 200,
    viaticos: viaticosActualizados,
    resumen: `Viático #${idViatico} dado de baja con autorización administrativa.`
  };
}

/**
 * Calcula el importe total (base + adicional) de un registro de viático.
 */
export function importeTotalViatico(viatico) {
  const base = Number(viatico?.monto || 0);
  const adicional = viatico?.esGastoAdicional ? Number(viatico?.montoAdicional || 0) : 0;
  return Math.round((base + adicional) * 100) / 100;
}

/**
 * 6. Totales por persona, proyecto y período + contrato conciliado para el Módulo 04 (Reportes).
 * Criterio de aceptación: "los totales coinciden con los reportes" y "el personal de planta no recibe metas de pasantía".
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
    idPersonal = "",
    fechaDesde = "",
    fechaHasta = "",
    incluirBajas = false
  } = filtros;

  // Filtrar viáticos según criterios
  const viaticosFiltrados = viaticos.filter((v) => {
    if (!incluirBajas && v.estado === "Baja") return false;
    if (idProyecto && Number(v.idProyecto) !== Number(idProyecto)) return false;
    if (idPersonal && Number(v.idPersonal) !== Number(idPersonal)) return false;
    if (fechaDesde && v.fecha < fechaDesde) return false;
    if (fechaHasta && v.fecha > fechaHasta) return false;
    return true;
  });

  // Filtrar asignaciones según criterios
  const asignacionesFiltradas = asignaciones.filter((a) => {
    if (idProyecto && Number(a.idProyecto) !== Number(idProyecto)) return false;
    if (idPersonal && Number(a.idPersonal) !== Number(idPersonal)) return false;
    if (fechaDesde && a.fechaFin < fechaDesde) return false;
    if (fechaHasta && a.fechaInicio > fechaHasta) return false;
    return true;
  });

  let totalMontoBase = 0;
  let totalMontoAdicional = 0;
  let totalGeneralConciliado = 0;
  let cantidadVigentes = 0;
  let cantidadBajas = 0;

  for (const v of viaticos) {
    const pasaFiltrosContexto =
      (!idProyecto || Number(v.idProyecto) === Number(idProyecto)) &&
      (!idPersonal || Number(v.idPersonal) === Number(idPersonal)) &&
      (!fechaDesde || v.fecha >= fechaDesde) &&
      (!fechaHasta || v.fecha <= fechaHasta);

    if (!pasaFiltrosContexto) continue;

    if (v.estado === "Baja") {
      cantidadBajas += 1;
      if (!incluirBajas) continue;
    } else {
      cantidadVigentes += 1;
    }

    const base = Number(v.monto || 0);
    const adicional = v.esGastoAdicional ? Number(v.montoAdicional || 0) : 0;
    totalMontoBase += base;
    totalMontoAdicional += adicional;
    totalGeneralConciliado += base + adicional;
  }

  totalMontoBase = Math.round(totalMontoBase * 100) / 100;
  totalMontoAdicional = Math.round(totalMontoAdicional * 100) / 100;
  totalGeneralConciliado = Math.round(totalGeneralConciliado * 100) / 100;

  // Totales agrupados por proyecto
  const porProyecto = proyectos
    .filter((p) => !idProyecto || Number(p.id) === Number(idProyecto))
    .map((p) => {
      const viaticosProyecto = viaticosFiltrados.filter(
        (v) => Number(v.idProyecto) === Number(p.id) && v.estado !== "Baja"
      );
      const asignacionesProyecto = asignacionesFiltradas.filter(
        (a) => Number(a.idProyecto) === Number(p.id)
      );
      const totalViaticos = Math.round(
        viaticosProyecto.reduce((acc, item) => acc + importeTotalViatico(item), 0) * 100
      ) / 100;
      const presupuesto = Number(p.presupuestoViaticos || 0);
      const saldoPresupuesto = Math.round((presupuesto - totalViaticos) * 100) / 100;

      return {
        idProyecto: p.id,
        codigo: p.codigo || `PRY-${p.id}`,
        nombre: p.nombre,
        estado: p.estado,
        periodo: `${p.fechaInicio} al ${p.fechaFin}`,
        participantesCount: asignacionesProyecto.length,
        viaticosCount: viaticosProyecto.length,
        presupuestoViaticos: presupuesto,
        totalViaticos,
        saldoPresupuesto
      };
    });

  // Totales agrupados por persona (respetando regla del Módulo 2/4: Planta sin meta de horas de pasantía)
  const porPersona = personal
    .filter((per) => !idPersonal || Number(per.id) === Number(idPersonal))
    .map((per) => {
      const viaticosPersona = viaticosFiltrados.filter(
        (v) => Number(v.idPersonal) === Number(per.id) && v.estado !== "Baja"
      );
      const asignacionesPersona = asignacionesFiltradas.filter(
        (a) => Number(a.idPersonal) === Number(per.id)
      );
      const totalBase = Math.round(
        viaticosPersona.reduce((acc, item) => acc + Number(item.monto || 0), 0) * 100
      ) / 100;
      const totalAdicional = Math.round(
        viaticosPersona.reduce(
          (acc, item) => acc + (item.esGastoAdicional ? Number(item.montoAdicional || 0) : 0),
          0
        ) * 100
      ) / 100;
      const totalPersona = Math.round((totalBase + totalAdicional) * 100) / 100;

      return {
        idPersonal: per.id,
        codigo: per.codigo || `PER-00${per.id}`,
        nombreCompleto: `${per.nombres} ${per.apellidos}`,
        tipo: per.tipo,
        // Regla inter-módulo: solo Pasante tiene meta de pasantía (600h); Planta siempre null
        aplicaMetaPasantia: per.tipo === "Pasante",
        asignacionesCount: asignacionesPersona.length,
        viaticosCount: viaticosPersona.length,
        totalBase,
        totalAdicional,
        totalViaticosConciliado: totalPersona
      };
    });

  return {
    moneda: REGLAS_VIATICOS_VIGENTES.moneda,
    zonaHoraria: "America/La_Paz",
    generadoEn: obtenerFechaHoraLaPaz(),
    filtrosAplicados: {
      idProyecto: idProyecto ? Number(idProyecto) : null,
      idPersonal: idPersonal ? Number(idPersonal) : null,
      fechaDesde: fechaDesde || null,
      fechaHasta: fechaHasta || null
    },
    resumenGlobal: {
      totalMontoBase,
      totalMontoAdicional,
      totalGeneralConciliado,
      cantidadVigentes,
      cantidadBajas,
      totalAsignacionesEnPeriodo: asignacionesFiltradas.length
    },
    porProyecto,
    porPersona,
    registrosConciliados: viaticosFiltrados
  };
}
