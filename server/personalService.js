// Servicio de dominio y almacenamiento para el Módulo 02: Personal y Pasantías.
// Diseñado para ser simple, sin dependencias externas y 100% compatible con
// los módulos de Acceso (01), Asistencia (03), Reportes (04) y Operaciones (05),
// así como con la futura sincronización del sistema de escritorio.

export const HORAS_META_PASANTE_DEFECTO = 600;
export const ZONA_HORARIA_OFICIAL = "America/La_Paz";

export const TIPOS_PERSONAL = {
  PLANTA: "planta",
  PASANTE: "pasante"
};

export const ESTADOS_PERSONAL = {
  ACTIVO: "activo",
  BAJA: "baja"
};

export const TURNOS_PERSONAL = {
  manana: {
    id: "manana",
    nombre: "Turno mañana (08:00 a 12:30 · 4.5 h/día)",
    horario: "08:00 - 12:30",
    horasPorDia: 4.5
  },
  tarde: {
    id: "tarde",
    nombre: "Turno tarde (14:00 a 18:30 · 4.5 h/día)",
    horario: "14:00 - 18:30",
    horasPorDia: 4.5
  },
  completo: {
    id: "completo",
    nombre: "Jornada completa (08:00 a 12:30 y 14:00 a 17:30 · 8 h/día)",
    horario: "08:00 - 12:30 / 14:00 - 17:30",
    horasPorDia: 8
  },
  pasantia_6h: {
    id: "pasantia_6h",
    nombre: "Turno pasantía continua (6 h/día)",
    horario: "08:00 - 14:00",
    horasPorDia: 6
  }
};

/**
 * Devuelve fecha YYYY-MM-DD y marca de tiempo legible en zona America/La_Paz.
 */
export function obtenerMarcaTiempoLaPaz(fechaBase = new Date()) {
  const fecha = fechaBase instanceof Date ? fechaBase : new Date(fechaBase);
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA_OFICIAL,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(fecha);

  const mapa = {};
  for (const p of partes) {
    mapa[p.type] = p.value;
  }
  const soloFecha = `${mapa.year}-${mapa.month}-${mapa.day}`;
  const fechaHora = `${soloFecha} ${mapa.hour}:${mapa.minute}`;
  return { soloFecha, fechaHora, iso: fecha.toISOString() };
}

/**
 * Calcula la fecha estimada de finalización de pasantía sumando días hábiles
 * (lunes a viernes) según las horas meta, el turno (horas por día, ej. 4.5h),
 * los feriados y los días de incidencias/permisos.
 */
export function calcularFechaFinPasantia({
  fechaInicio,
  horasMeta = HORAS_META_PASANTE_DEFECTO,
  horasPorDia = 4.5,
  diasFeriados = 0,
  diasIncidencias = 0
}) {
  const fechaBaseStr =
    typeof fechaInicio === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fechaInicio)
      ? fechaInicio
      : obtenerMarcaTiempoLaPaz().soloFecha;

  const [anio, mes, dia] = fechaBaseStr.split("-").map(Number);
  const cursor = new Date(Date.UTC(anio, mes - 1, dia));

  const metaSegura = Math.max(1, Number(horasMeta) || HORAS_META_PASANTE_DEFECTO);
  const horasDiaSeguras = Math.max(0.5, Number(horasPorDia) || 4.5);
  const feriadosSeguros = Math.max(0, Math.trunc(Number(diasFeriados) || 0));
  const incidenciasSeguras = Math.max(0, Math.trunc(Number(diasIncidencias) || 0));

  // Total de jornadas hábiles requeridas para completar la pasantía
  // más días adicionales por feriados e incidencias registradas.
  const diasJornadaRequeridos = Math.ceil(metaSegura / horasDiaSeguras);
  const totalDiasHabilesASumar = Math.max(
    0,
    diasJornadaRequeridos - 1 + feriadosSeguros + incidenciasSeguras
  );

  // Si la fecha de inicio cae en sábado (6) o domingo (0), avanzar al lunes
  while (cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  let restantes = totalDiasHabilesASumar;
  while (restantes > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const diaSemana = cursor.getUTCDay();
    if (diaSemana !== 0 && diaSemana !== 6) {
      restantes -= 1;
    }
  }

  const yyyy = cursor.getUTCFullYear();
  const mm = String(cursor.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(cursor.getUTCDate()).padStart(2, "0");

  return {
    fechaInicio: fechaBaseStr,
    fechaFinEstimada: `${yyyy}-${mm}-${dd}`,
    diasJornadaRequeridos,
    totalDiasHabiles: diasJornadaRequeridos + feriadosSeguros + incidenciasSeguras
  };
}

/**
 * Construye el objeto de seguimiento de pasantía exclusivamente para pasantes.
 * Para personal de planta devuelve SIEMPRE null (regla obligatoria de aceptación).
 */
export function construirDatosPasantia(tipo, datosEntrada = {}, pasantiaPrevia = null) {
  if (tipo !== TIPOS_PERSONAL.PASANTE) {
    return null;
  }

  const turnoId =
    datosEntrada.turno && TURNOS_PERSONAL[datosEntrada.turno]
      ? datosEntrada.turno
      : pasantiaPrevia?.turno && TURNOS_PERSONAL[pasantiaPrevia.turno]
      ? pasantiaPrevia.turno
      : "manana";

  const turnoInfo = TURNOS_PERSONAL[turnoId];

  // Regla obligatoria: Pasantes tienen 600 horas por defecto
  const horasMetaRaw =
    datosEntrada.horasMeta !== undefined && datosEntrada.horasMeta !== ""
      ? Number(datosEntrada.horasMeta)
      : pasantiaPrevia?.horasMeta !== undefined
      ? Number(pasantiaPrevia.horasMeta)
      : HORAS_META_PASANTE_DEFECTO;

  const horasMeta =
    Number.isFinite(horasMetaRaw) && horasMetaRaw > 0
      ? Math.round(horasMetaRaw)
      : HORAS_META_PASANTE_DEFECTO;

  const horasCumplidasRaw =
    datosEntrada.horasCumplidas !== undefined && datosEntrada.horasCumplidas !== ""
      ? Number(datosEntrada.horasCumplidas)
      : pasantiaPrevia?.horasCumplidas !== undefined
      ? Number(pasantiaPrevia.horasCumplidas)
      : 0;

  const horasCumplidas = Math.max(
    0,
    Math.round((Number.isFinite(horasCumplidasRaw) ? horasCumplidasRaw : 0) * 10) / 10
  );

  const horasPorDiaRaw =
    datosEntrada.horasPorDia !== undefined && datosEntrada.horasPorDia !== ""
      ? Number(datosEntrada.horasPorDia)
      : turnoInfo.horasPorDia;

  const horasPorDia =
    Number.isFinite(horasPorDiaRaw) && horasPorDiaRaw >= 0.5 && horasPorDiaRaw <= 12
      ? Math.round(horasPorDiaRaw * 10) / 10
      : turnoInfo.horasPorDia;

  const diasFeriados = Math.max(
    0,
    Math.trunc(
      Number(
        datosEntrada.diasFeriados !== undefined
          ? datosEntrada.diasFeriados
          : pasantiaPrevia?.diasFeriados ?? 0
      ) || 0
    )
  );

  const diasIncidencias = Math.max(
    0,
    Math.trunc(
      Number(
        datosEntrada.diasIncidencias !== undefined
          ? datosEntrada.diasIncidencias
          : pasantiaPrevia?.diasIncidencias ?? 0
      ) || 0
    )
  );

  const detalleIncidencias = String(
    datosEntrada.detalleIncidencias !== undefined
      ? datosEntrada.detalleIncidencias
      : pasantiaPrevia?.detalleIncidencias ?? ""
  ).trim();

  const fechaInicio =
    datosEntrada.fechaInicio ||
    pasantiaPrevia?.fechaInicio ||
    obtenerMarcaTiempoLaPaz().soloFecha;

  const horasPendientes = Math.max(0, Math.round((horasMeta - horasCumplidas) * 10) / 10);
  const porcentajeProgreso = Math.min(
    100,
    Math.round((horasCumplidas / horasMeta) * 1000) / 10
  );

  const calculoFechas = calcularFechaFinPasantia({
    fechaInicio,
    horasMeta,
    horasPorDia,
    diasFeriados,
    diasIncidencias
  });

  const jornadasRestantes = Math.ceil(horasPendientes / horasPorDia);

  return {
    horasMeta,
    horasCumplidas,
    horasPendientes,
    porcentajeProgreso,
    turno: turnoId,
    turnoNombre: turnoInfo.nombre,
    horario: turnoInfo.horario,
    horasPorDia,
    fechaInicio: calculoFechas.fechaInicio,
    diasFeriados,
    diasIncidencias,
    detalleIncidencias,
    diasJornadaRequeridos: calculoFechas.diasJornadaRequeridos,
    jornadasRestantes,
    fechaFinEstimada: calculoFechas.fechaFinEstimada,
    estadoPasantia: horasPendientes === 0 ? "completada" : "en_curso"
  };
}

/**
 * Datos iniciales representativos para desarrollo e integración entre módulos.
 * Incluye registros de planta, pasantes y metadatos provenientes de escritorio.
 */
function crearSemillaInicial() {
  return [
    {
      id: "per-1",
      codigo: "PER-001",
      nombres: "Carlos Andrés",
      apellidos: "Mendoza Quispe",
      nombreCompleto: "Carlos Andrés Mendoza Quispe",
      tipo: TIPOS_PERSONAL.PLANTA,
      turno: "completo",
      estado: ESTADOS_PERSONAL.ACTIVO,
      motivoBaja: null,
      pasantia: null,
      origenEscritorio: true,
      datosEscritorio: {
        escritorioId: "ESC-101",
        sincronizadoEn: "2026-10-15 08:30",
        biometricoActivo: true
      },
      fechaAlta: "2026-09-01",
      actualizadoEn: "2026-10-15 08:30",
      historial: [
        {
          id: "hist-1",
          fecha: "2026-09-01 08:00",
          accion: "ALTA_ESCRITORIO",
          detalle: "Registro original sincronizado desde sistema de escritorio (ESC-101)."
        }
      ]
    },
    {
      id: "per-2",
      codigo: "PER-002",
      nombres: "Valeria",
      apellidos: "Flores Condori",
      nombreCompleto: "Valeria Flores Condori",
      tipo: TIPOS_PERSONAL.PASANTE,
      turno: "manana",
      estado: ESTADOS_PERSONAL.ACTIVO,
      motivoBaja: null,
      pasantia: construirDatosPasantia(TIPOS_PERSONAL.PASANTE, {
        horasMeta: 600,
        horasCumplidas: 225,
        turno: "manana",
        horasPorDia: 4.5,
        fechaInicio: "2026-08-17",
        diasFeriados: 2,
        diasIncidencias: 1,
        detalleIncidencias: "1 día de permiso académico justificado"
      }),
      origenEscritorio: true,
      datosEscritorio: {
        escritorioId: "ESC-102",
        sincronizadoEn: "2026-10-15 18:10"
      },
      fechaAlta: "2026-08-17",
      actualizadoEn: "2026-10-15 18:10",
      historial: [
        {
          id: "hist-2",
          fecha: "2026-08-17 08:00",
          accion: "ALTA",
          detalle: "Alta como pasante en turno mañana (08:00 a 12:30 · 4.5 h/día), meta de 600 horas."
        },
        {
          id: "hist-3",
          fecha: "2026-10-15 18:10",
          accion: "PROGRESO_PASANTIA",
          detalle: "Actualización de avance acumulada: 225 / 600 h (1 incidencia registrada)."
        }
      ]
    },
    {
      id: "per-3",
      codigo: "PER-003",
      nombres: "Diego Armando",
      apellidos: "Choque Mamani",
      nombreCompleto: "Diego Armando Choque Mamani",
      tipo: TIPOS_PERSONAL.PASANTE,
      turno: "tarde",
      estado: ESTADOS_PERSONAL.ACTIVO,
      motivoBaja: null,
      pasantia: construirDatosPasantia(TIPOS_PERSONAL.PASANTE, {
        horasMeta: 600,
        horasCumplidas: 90,
        turno: "tarde",
        horasPorDia: 4.5,
        fechaInicio: "2026-09-14",
        diasFeriados: 1,
        diasIncidencias: 0,
        detalleIncidencias: ""
      }),
      origenEscritorio: false,
      datosEscritorio: null,
      fechaAlta: "2026-09-14",
      actualizadoEn: "2026-10-14 12:30",
      historial: [
        {
          id: "hist-4",
          fecha: "2026-09-14 08:00",
          accion: "ALTA",
          detalle: "Alta de pasante en turno tarde (14:00 a 18:30 · 4.5 h/día), meta 600 horas."
        }
      ]
    },
    {
      id: "per-4",
      codigo: "PER-004",
      nombres: "Lucía Fernanda",
      apellidos: "Rojas Vargas",
      nombreCompleto: "Lucía Fernanda Rojas Vargas",
      tipo: TIPOS_PERSONAL.PLANTA,
      turno: "completo",
      estado: ESTADOS_PERSONAL.BAJA,
      motivoBaja: "Finalización de contrato temporal",
      pasantia: null,
      origenEscritorio: true,
      datosEscritorio: {
        escritorioId: "ESC-094",
        sincronizadoEn: "2026-09-30 17:00"
      },
      fechaAlta: "2026-03-10",
      actualizadoEn: "2026-09-30 17:00",
      historial: [
        {
          id: "hist-5",
          fecha: "2026-03-10 09:00",
          accion: "ALTA_ESCRITORIO",
          detalle: "Alta inicial en sistema de escritorio (ESC-094)."
        },
        {
          id: "hist-6",
          fecha: "2026-09-30 17:00",
          accion: "BAJA",
          detalle: "Baja registrada conservando historial: Finalización de contrato temporal."
        }
      ]
    }
  ];
}

// Almacén en memoria del proceso Node (compatible con Vite dev server y Vercel serverless)
let registrosPersonal = crearSemillaInicial();
let secuenciaId = registrosPersonal.length + 1;

/**
 * Reinicia el almacén a su estado inicial (útil para pruebas automatizadas).
 */
export function reiniciarAlmacenPersonal() {
  registrosPersonal = crearSemillaInicial();
  secuenciaId = registrosPersonal.length + 1;
  return listarPersonal();
}

/**
 * Genera el siguiente código automático correlativo (ej. PER-005) sin colisionar
 * con códigos ya existentes o importados desde el escritorio.
 */
export function generarSiguienteCodigo(lista = registrosPersonal) {
  let maxNumero = 0;
  for (const item of lista) {
    const coincidencia = /^PER-(\d+)$/i.exec(String(item.codigo || "").trim());
    if (coincidencia) {
      const num = parseInt(coincidencia[1], 10);
      if (num > maxNumero) maxNumero = num;
    }
  }
  const siguiente = maxNumero + 1;
  return `PER-${String(siguiente).padStart(3, "0")}`;
}

function clonar(objeto) {
  return JSON.parse(JSON.stringify(objeto));
}

function normalizarTexto(texto) {
  return String(texto ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizarBusqueda(texto) {
  return normalizarTexto(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Calcula indicadores globales para tarjetas de resumen y para el Módulo 04 (Reportes).
 */
export function calcularResumenPersonal(lista = registrosPersonal) {
  let activos = 0;
  let bajas = 0;
  let planta = 0;
  let pasantes = 0;
  let pasantesActivos = 0;
  let horasMetaTotalPasantes = 0;
  let horasCumplidasTotalPasantes = 0;

  for (const persona of lista) {
    if (persona.estado === ESTADOS_PERSONAL.ACTIVO) activos += 1;
    else bajas += 1;

    if (persona.tipo === TIPOS_PERSONAL.PLANTA) {
      planta += 1;
    } else if (persona.tipo === TIPOS_PERSONAL.PASANTE) {
      pasantes += 1;
      if (persona.estado === ESTADOS_PERSONAL.ACTIVO) {
        pasantesActivos += 1;
      }
      if (persona.pasantia) {
        horasMetaTotalPasantes += persona.pasantia.horasMeta || 0;
        horasCumplidasTotalPasantes += persona.pasantia.horasCumplidas || 0;
      }
    }
  }

  return {
    total: lista.length,
    activos,
    bajas,
    planta,
    pasantes,
    pasantesActivos,
    horasMetaTotalPasantes,
    horasCumplidasTotalPasantes,
    horasPendientesTotalPasantes: Math.max(
      0,
      Math.round((horasMetaTotalPasantes - horasCumplidasTotalPasantes) * 10) / 10
    )
  };
}

/**
 * Lista y filtra el personal registrado.
 * Compatible con consultas de Asistencia (?estado=activo), Reportes y Operaciones.
 */
export function listarPersonal(filtros = {}) {
  const q = normalizarBusqueda(filtros.q || filtros.busqueda || "");
  const tipo = String(filtros.tipo || "todos").toLowerCase();
  const estado = String(filtros.estado || "todos").toLowerCase();

  const filtrados = registrosPersonal.filter((persona) => {
    if (tipo !== "todos" && tipo !== "" && persona.tipo !== tipo) {
      return false;
    }
    if (estado !== "todos" && estado !== "" && persona.estado !== estado) {
      return false;
    }
    if (q) {
      const campos = [
        persona.codigo,
        persona.nombres,
        persona.apellidos,
        persona.nombreCompleto,
        persona.datosEscritorio?.escritorioId
      ]
        .filter(Boolean)
        .map(normalizarBusqueda)
        .join(" ");
      if (!campos.includes(q)) {
        return false;
      }
    }
    return true;
  });

  return {
    items: clonar(filtrados),
    resumen: calcularResumenPersonal(registrosPersonal),
    zonaHoraria: ZONA_HORARIA_OFICIAL
  };
}

/**
 * Obtiene una persona por su ID interno, código (ej. PER-001) o ID de escritorio.
 */
export function obtenerPersonaPorId(identificador) {
  if (!identificador) return null;
  const buscado = String(identificador).trim().toLowerCase();
  const encontrada = registrosPersonal.find(
    (p) =>
      p.id.toLowerCase() === buscado ||
      p.codigo.toLowerCase() === buscado ||
      String(p.datosEscritorio?.escritorioId || "").toLowerCase() === buscado
  );
  return encontrada ? clonar(encontrada) : null;
}

/**
 * Valida los datos mínimos obligatorios para alta o edición (nombres, apellidos y tipo).
 */
export function validarDatosPersona(datos = {}) {
  const errores = {};
  const nombres = normalizarTexto(datos.nombres);
  const apellidos = normalizarTexto(datos.apellidos);
  const tipo = String(datos.tipo || "").trim().toLowerCase();

  if (!nombres || nombres.length < 2) {
    errores.nombres = "Ingrese los nombres (mínimo 2 caracteres).";
  }
  if (!apellidos || apellidos.length < 2) {
    errores.apellidos = "Ingrese los apellidos (mínimo 2 caracteres).";
  }
  if (tipo !== TIPOS_PERSONAL.PLANTA && tipo !== TIPOS_PERSONAL.PASANTE) {
    errores.tipo = "Seleccione un tipo válido: Personal de planta o Pasante.";
  }

  if (tipo === TIPOS_PERSONAL.PASANTE) {
    if (datos.horasCumplidas !== undefined && datos.horasCumplidas !== "") {
      const hc = Number(datos.horasCumplidas);
      if (!Number.isFinite(hc) || hc < 0) {
        errores.horasCumplidas = "Las horas cumplidas no pueden ser negativas.";
      }
    }
    if (datos.horasPorDia !== undefined && datos.horasPorDia !== "") {
      const hpd = Number(datos.horasPorDia);
      if (!Number.isFinite(hpd) || hpd < 0.5 || hpd > 12) {
        errores.horasPorDia = "Las horas por jornada deben estar entre 0.5 y 12.";
      }
    }
    if (datos.diasFeriados !== undefined && datos.diasFeriados !== "") {
      const df = Number(datos.diasFeriados);
      if (!Number.isFinite(df) || df < 0) {
        errores.diasFeriados = "Los días feriados no pueden ser negativos.";
      }
    }
    if (datos.diasIncidencias !== undefined && datos.diasIncidencias !== "") {
      const di = Number(datos.diasIncidencias);
      if (!Number.isFinite(di) || di < 0) {
        errores.diasIncidencias = "Los días de incidencia no pueden ser negativos.";
      }
    }
  }

  return {
    valido: Object.keys(errores).length === 0,
    errores,
    datosNormalizados: {
      nombres,
      apellidos,
      nombreCompleto: `${nombres} ${apellidos}`.trim(),
      tipo,
      turno:
        datos.turno && TURNOS_PERSONAL[datos.turno]
          ? datos.turno
          : tipo === TIPOS_PERSONAL.PASANTE
          ? "manana"
          : "completo"
    }
  };
}

/**
 * Crea una nueva ficha de personal (planta o pasante) con alta mínima:
 * nombres, apellidos y tipo.
 */
export function crearPersona(datos = {}) {
  const validacion = validarDatosPersona(datos);
  if (!validacion.valido) {
    const error = new Error("Datos de personal inválidos.");
    error.statusCode = 400;
    error.errores = validacion.errores;
    throw error;
  }

  const { nombres, apellidos, nombreCompleto, tipo, turno } =
    validacion.datosNormalizados;
  const marca = obtenerMarcaTiempoLaPaz();

  // Respetar código si viene desde el sistema de escritorio y no está duplicado
  const codigoSolicitado = normalizarTexto(datos.codigo).toUpperCase();
  const codigoOcupado =
    codigoSolicitado &&
    registrosPersonal.some((p) => p.codigo.toUpperCase() === codigoSolicitado);
  const codigo =
    codigoSolicitado && !codigoOcupado
      ? codigoSolicitado
      : generarSiguienteCodigo(registrosPersonal);

  // Regla crítica: Planta NO guarda ni muestra meta de pasantía (pasantia: null).
  // Pasante recibe 600 horas por defecto.
  const pasantia =
    tipo === TIPOS_PERSONAL.PASANTE
      ? construirDatosPasantia(tipo, {
          ...datos,
          horasMeta:
            datos.horasMeta !== undefined && datos.horasMeta !== ""
              ? datos.horasMeta
              : HORAS_META_PASANTE_DEFECTO,
          turno
        })
      : null;

  const nuevaPersona = {
    id: `per-${secuenciaId++}`,
    codigo,
    nombres,
    apellidos,
    nombreCompleto,
    tipo,
    turno,
    estado: ESTADOS_PERSONAL.ACTIVO,
    motivoBaja: null,
    pasantia,
    origenEscritorio: Boolean(datos.origenEscritorio || datos.datosEscritorio),
    datosEscritorio: datos.datosEscritorio ? clonar(datos.datosEscritorio) : null,
    fechaAlta: datos.fechaAlta || marca.soloFecha,
    actualizadoEn: marca.fechaHora,
    historial: [
      {
        id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        fecha: marca.fechaHora,
        accion: "ALTA",
        detalle:
          tipo === TIPOS_PERSONAL.PASANTE
            ? `Alta de pasante (${codigo}) con meta de ${pasantia.horasMeta} horas (${pasantia.horasPorDia} h/día).`
            : `Alta de personal de planta (${codigo}) sin meta de pasantía.`
      }
    ]
  };

  registrosPersonal.unshift(nuevaPersona);
  return clonar(nuevaPersona);
}

/**
 * Edita una ficha existente conservando historial y datos del escritorio.
 */
export function actualizarPersona(id, cambios = {}) {
  const indice = registrosPersonal.findIndex(
    (p) => p.id === id || p.codigo === id
  );
  if (indice === -1) {
    const error = new Error("No se encontró la persona solicitada.");
    error.statusCode = 404;
    throw error;
  }

  const actual = registrosPersonal[indice];
  const datosCombinados = {
    nombres: cambios.nombres !== undefined ? cambios.nombres : actual.nombres,
    apellidos: cambios.apellidos !== undefined ? cambios.apellidos : actual.apellidos,
    tipo: cambios.tipo !== undefined ? cambios.tipo : actual.tipo,
    turno: cambios.turno !== undefined ? cambios.turno : actual.turno,
    horasMeta: cambios.horasMeta,
    horasCumplidas: cambios.horasCumplidas,
    horasPorDia: cambios.horasPorDia,
    fechaInicio: cambios.fechaInicio,
    diasFeriados: cambios.diasFeriados,
    diasIncidencias: cambios.diasIncidencias,
    detalleIncidencias: cambios.detalleIncidencias
  };

  const validacion = validarDatosPersona(datosCombinados);
  if (!validacion.valido) {
    const error = new Error("Error de validación al editar la ficha.");
    error.statusCode = 400;
    error.errores = validacion.errores;
    throw error;
  }

  const { nombres, apellidos, nombreCompleto, tipo, turno } =
    validacion.datosNormalizados;
  const marca = obtenerMarcaTiempoLaPaz();

  // Si pasa a planta, pasantia se limpia a null. Si es pasante, calcula o inicializa con 600h.
  const pasantiaActualizada =
    tipo === TIPOS_PERSONAL.PASANTE
      ? construirDatosPasantia(
          tipo,
          {
            ...datosCombinados,
            turno
          },
          actual.pasantia
        )
      : null;

  // Construir resumen de cambios para conservar historial auditable
  const detallesCambio = [];
  if (actual.nombreCompleto !== nombreCompleto) {
    detallesCambio.push(`Nombre: "${actual.nombreCompleto}" → "${nombreCompleto}"`);
  }
  if (actual.tipo !== tipo) {
    detallesCambio.push(`Tipo: ${actual.tipo} → ${tipo}`);
  }
  if (actual.turno !== turno) {
    detallesCambio.push(`Turno: ${actual.turno} → ${turno}`);
  }
  if (tipo === TIPOS_PERSONAL.PASANTE && pasantiaActualizada) {
    const prevHoras = actual.pasantia?.horasCumplidas ?? 0;
    if (prevHoras !== pasantiaActualizada.horasCumplidas) {
      detallesCambio.push(
        `Horas cumplidas: ${prevHoras}h → ${pasantiaActualizada.horasCumplidas}h`
      );
    }
    const prevFeriados = actual.pasantia?.diasFeriados ?? 0;
    const prevIncidencias = actual.pasantia?.diasIncidencias ?? 0;
    if (
      prevFeriados !== pasantiaActualizada.diasFeriados ||
      prevIncidencias !== pasantiaActualizada.diasIncidencias
    ) {
      detallesCambio.push(
        `Ajuste calendario: ${pasantiaActualizada.diasFeriados} feriados, ${pasantiaActualizada.diasIncidencias} días incidencia (fin estimado: ${pasantiaActualizada.fechaFinEstimada})`
      );
    }
  }

  const textoDetalle =
    detallesCambio.length > 0
      ? `Edición de ficha (${detallesCambio.join("; ")}).`
      : "Actualización de ficha de personal.";

  // Conservar datos existentes del escritorio sin sobrescribirlos
  const datosEscritorioConservados = actual.datosEscritorio
    ? {
        ...clonar(actual.datosEscritorio),
        ...(cambios.datosEscritorio ? clonar(cambios.datosEscritorio) : {})
      }
    : cambios.datosEscritorio
    ? clonar(cambios.datosEscritorio)
    : null;

  const personaActualizada = {
    ...actual,
    nombres,
    apellidos,
    nombreCompleto,
    tipo,
    turno,
    pasantia: pasantiaActualizada,
    datosEscritorio: datosEscritorioConservados,
    actualizadoEn: marca.fechaHora,
    historial: [
      {
        id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        fecha: marca.fechaHora,
        accion: "EDICION",
        detalle: textoDetalle
      },
      ...actual.historial
    ]
  };

  registrosPersonal[indice] = personaActualizada;
  return clonar(personaActualizada);
}

/**
 * Baja lógica o recuperación (reactivación) conservando todo el historial y datos previos.
 */
export function cambiarEstadoPersona(id, { estado, motivo = "" } = {}) {
  const indice = registrosPersonal.findIndex(
    (p) => p.id === id || p.codigo === id
  );
  if (indice === -1) {
    const error = new Error("No se encontró la persona solicitada.");
    error.statusCode = 404;
    throw error;
  }

  const nuevoEstado = String(estado || "").toLowerCase();
  if (
    nuevoEstado !== ESTADOS_PERSONAL.ACTIVO &&
    nuevoEstado !== ESTADOS_PERSONAL.BAJA
  ) {
    const error = new Error("El estado debe ser 'activo' o 'baja'.");
    error.statusCode = 400;
    throw error;
  }

  const motivoLimpio = normalizarTexto(motivo);
  if (nuevoEstado === ESTADOS_PERSONAL.BAJA && !motivoLimpio) {
    const error = new Error("Indique el motivo de la baja para conservar en el historial.");
    error.statusCode = 400;
    error.errores = { motivo: "El motivo de baja es obligatorio." };
    throw error;
  }

  const actual = registrosPersonal[indice];
  const marca = obtenerMarcaTiempoLaPaz();

  const accionHistorial =
    nuevoEstado === ESTADOS_PERSONAL.BAJA ? "BAJA" : "RECUPERACION";
  const detalleHistorial =
    nuevoEstado === ESTADOS_PERSONAL.BAJA
      ? `Baja lógica registrada. Motivo: ${motivoLimpio}.`
      : `Recuperación / reactivación de personal${
          motivoLimpio ? ` (${motivoLimpio})` : ""
        }. Se conserva historial previo.`;

  const actualizada = {
    ...actual,
    estado: nuevoEstado,
    motivoBaja: nuevoEstado === ESTADOS_PERSONAL.BAJA ? motivoLimpio : null,
    actualizadoEn: marca.fechaHora,
    historial: [
      {
        id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        fecha: marca.fechaHora,
        accion: accionHistorial,
        detalle: detalleHistorial
      },
      ...actual.historial
    ]
  };

  registrosPersonal[indice] = actualizada;
  return clonar(actualizada);
}

/**
 * Registra avance de horas o incidencias para un pasante.
 * Punto de integración directo para el Módulo 03 (Asistencia e incidencias).
 */
export function registrarProgresoPasante(
  id,
  { horasSumar = 0, horasCumplidas, diasFeriados, diasIncidencias, detalleIncidencias, motivo = "" } = {}
) {
  const indice = registrosPersonal.findIndex(
    (p) => p.id === id || p.codigo === id
  );
  if (indice === -1) {
    const error = new Error("No se encontró la persona solicitada.");
    error.statusCode = 404;
    throw error;
  }

  const actual = registrosPersonal[indice];
  if (actual.tipo !== TIPOS_PERSONAL.PASANTE || !actual.pasantia) {
    const error = new Error(
      "El personal de planta no tiene meta de horas ni seguimiento de pasantía."
    );
    error.statusCode = 400;
    throw error;
  }

  const nuevasHorasCumplidas =
    horasCumplidas !== undefined && horasCumplidas !== ""
      ? Number(horasCumplidas)
      : Number(actual.pasantia.horasCumplidas || 0) + Number(horasSumar || 0);

  if (!Number.isFinite(nuevasHorasCumplidas) || nuevasHorasCumplidas < 0) {
    const error = new Error("El total de horas cumplidas no es válido.");
    error.statusCode = 400;
    throw error;
  }

  const pasantiaActualizada = construirDatosPasantia(
    TIPOS_PERSONAL.PASANTE,
    {
      horasMeta: actual.pasantia.horasMeta,
      horasCumplidas: nuevasHorasCumplidas,
      turno: actual.pasantia.turno,
      horasPorDia: actual.pasantia.horasPorDia,
      fechaInicio: actual.pasantia.fechaInicio,
      diasFeriados:
        diasFeriados !== undefined ? diasFeriados : actual.pasantia.diasFeriados,
      diasIncidencias:
        diasIncidencias !== undefined
          ? diasIncidencias
          : actual.pasantia.diasIncidencias,
      detalleIncidencias:
        detalleIncidencias !== undefined
          ? detalleIncidencias
          : actual.pasantia.detalleIncidencias
    },
    actual.pasantia
  );

  const marca = obtenerMarcaTiempoLaPaz();
  const notaMotivo = normalizarTexto(motivo);

  const actualizada = {
    ...actual,
    pasantia: pasantiaActualizada,
    actualizadoEn: marca.fechaHora,
    historial: [
      {
        id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        fecha: marca.fechaHora,
        accion: "PROGRESO_PASANTIA",
        detalle: `Avance actualizado: ${pasantiaActualizada.horasCumplidas}h / ${
          pasantiaActualizada.horasMeta
        }h (${pasantiaActualizada.porcentajeProgreso}%). Fin estimado: ${
          pasantiaActualizada.fechaFinEstimada
        }${notaMotivo ? ` — ${notaMotivo}` : ""}.`
      },
      ...actual.historial
    ]
  };

  registrosPersonal[indice] = actualizada;
  return clonar(actualizada);
}

/**
 * Sincroniza o fusiona registros provenientes del sistema de escritorio
 * conservando siempre los datos existentes, códigos y el historial.
 */
export function sincronizarConEscritorio(registrosExternos = []) {
  if (!Array.isArray(registrosExternos)) {
    const error = new Error("Se esperaba una lista de registros de escritorio.");
    error.statusCode = 400;
    throw error;
  }

  let creados = 0;
  let actualizados = 0;
  const marca = obtenerMarcaTiempoLaPaz();

  for (const reg of registrosExternos) {
    if (!reg || !reg.nombres || !reg.apellidos) continue;
    const escritorioId = reg.escritorioId || reg.datosEscritorio?.escritorioId;
    const codigo = normalizarTexto(reg.codigo).toUpperCase();

    const existente = registrosPersonal.find(
      (p) =>
        (escritorioId && p.datosEscritorio?.escritorioId === escritorioId) ||
        (codigo && p.codigo.toUpperCase() === codigo)
    );

    if (existente) {
      actualizarPersona(existente.id, {
        nombres: reg.nombres,
        apellidos: reg.apellidos,
        tipo: reg.tipo || existente.tipo,
        horasCumplidas:
          reg.horasCumplidas !== undefined
            ? reg.horasCumplidas
            : existente.pasantia?.horasCumplidas,
        datosEscritorio: {
          ...(existente.datosEscritorio || {}),
          ...(reg.datosEscritorio || {}),
          ...(escritorioId ? { escritorioId } : {}),
          sincronizadoEn: marca.fechaHora
        }
      });
      actualizados += 1;
    } else {
      crearPersona({
        ...reg,
        origenEscritorio: true,
        datosEscritorio: {
          ...(reg.datosEscritorio || {}),
          ...(escritorioId ? { escritorioId } : {}),
          sincronizadoEn: marca.fechaHora
        }
      });
      creados += 1;
    }
  }

  return {
    creados,
    actualizados,
    total: registrosPersonal.length,
    sincronizadoEn: marca.fechaHora
  };
}
