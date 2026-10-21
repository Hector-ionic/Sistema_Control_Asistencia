// Cliente oficial del Módulo 03 (Asistencia e incidencias) conectado a POST /api/backend.
// Compartido entre Parte 1 (Gabriel: PanelJornada.jsx) y Parte 2 (Carlos: PanelIncidenciasQr.jsx).

export const RUTA_BACKEND = "/api/backend";
export const ZONA_HORARIA_BOLIVIA = "America/La_Paz";

export const ACCIONES_JORNADA = Object.freeze([
  { id: "entrada", etiqueta: "1. Marcar Entrada" },
  { id: "inicio-almuerzo", etiqueta: "2. Inicio de Almuerzo" },
  { id: "fin-almuerzo", etiqueta: "3. Fin de Almuerzo" },
  { id: "salida", etiqueta: "4. Marcar Salida" }
]);

export const TIPOS_INCIDENCIA = Object.freeze([
  { id: "Permiso", etiqueta: "Permiso administrativo" },
  { id: "Falta", etiqueta: "Falta registrada" }
]);

/**
 * Obtiene la fecha actual en zona horaria America/La_Paz en formato YYYY-MM-DD.
 */
export function hoyBolivia(fechaBase = new Date()) {
  try {
    const partes = new Intl.DateTimeFormat("en-CA", {
      timeZone: ZONA_HORARIA_BOLIVIA,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(fechaBase);
    const y = partes.find((p) => p.type === "year")?.value;
    const m = partes.find((p) => p.type === "month")?.value;
    const d = partes.find((p) => p.type === "day")?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // Fallback ISO
  }
  return fechaBase.toISOString().slice(0, 10);
}

/**
 * Obtiene la hora actual en zona horaria America/La_Paz en formato HH:mm:ss.
 */
export function horaActualBolivia(fechaBase = new Date()) {
  try {
    return new Intl.DateTimeFormat("es-BO", {
      timeZone: ZONA_HORARIA_BOLIVIA,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(fechaBase);
  } catch {
    return fechaBase.toTimeString().slice(0, 8);
  }
}

/**
 * Normaliza una hora de formulario (ej. "08:30" o "08:30:00.12345") al formato C# "HH:mm:ss".
 */
export function normalizarHoraCSharp(hora) {
  if (!hora || String(hora).trim() === "") return null;
  const limpio = String(hora).trim();
  const match = limpio.match(/^(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return limpio;
  const hh = match[1];
  const mm = match[2];
  const ss = match[3] || "00";
  return `${hh}:${mm}:${ss}`;
}

/**
 * Formatea una hora de C# (ej. "10:40:49.4735890") para mostrar limpia en interfaz ("10:40:49").
 */
export function formatearHoraVista(hora) {
  if (!hora) return "—";
  return normalizarHoraCSharp(hora) || "—";
}

/**
 * Convierte minutos trabajados en horas y minutos sin usar Date del navegador.
 */
export function formatearMinutosJornada(minutosEntrada) {
  const totalMinutos = Math.max(0, Math.trunc(Number(minutosEntrada) || 0));
  const horas = Math.floor(totalMinutos / 60);
  const minutos = totalMinutos % 60;
  return {
    totalMinutos,
    horas,
    minutos,
    texto: `${horas} h ${String(minutos).padStart(2, "0")} min`,
    textoCorto: `${horas}h ${String(minutos).padStart(2, "0")}m`
  };
}

/**
 * Genera un UUID v4 para operaciones idempotentes (asistencia.rapida, correcciones.enviar).
 */
export function generarUuidOperacion() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Valida la secuencia coherente de marcaciones de una jornada antes de enviarla al backend C#,
 * y determina qué acciones están habilitadas según el estado actual de la persona.
 */
export function evaluarEstadoJornada(registroEstado = {}) {
  const tieneEntrada = Boolean(
    registroEstado?.tieneEntrada || registroEstado?.horaEntrada || registroEstado?.entrada
  );
  const tieneInicioAlmuerzo = Boolean(
    registroEstado?.enAlmuerzo ||
      registroEstado?.almuerzoFinalizado ||
      registroEstado?.horaInicioAlmuerzo ||
      registroEstado?.inicioAlmuerzo
  );
  const tieneFinAlmuerzo = Boolean(
    registroEstado?.almuerzoFinalizado ||
      registroEstado?.horaFinAlmuerzo ||
      registroEstado?.finAlmuerzo
  );
  const tieneSalida = Boolean(
    registroEstado?.tieneSalida || registroEstado?.horaSalida || registroEstado?.salida
  );

  let etapa = "Sin registro hoy";
  let siguienteAccionSugerida = "entrada";

  if (tieneSalida) {
    etapa = "Jornada finalizada";
    siguienteAccionSugerida = null;
  } else if (tieneInicioAlmuerzo && !tieneFinAlmuerzo) {
    etapa = "En almuerzo";
    siguienteAccionSugerida = "fin-almuerzo";
  } else if (tieneEntrada) {
    etapa = tieneFinAlmuerzo
      ? "En jornada (almuerzo completado)"
      : "En jornada activa";
    siguienteAccionSugerida = tieneFinAlmuerzo ? "salida" : "salida";
  }

  return {
    tieneEntrada,
    tieneInicioAlmuerzo,
    tieneFinAlmuerzo,
    tieneSalida,
    etapa: registroEstado?.estadoTexto || registroEstado?.estado || etapa,
    siguienteAccionSugerida,
    accionesPermitidas: {
      entrada: !tieneEntrada && !tieneSalida,
      "inicio-almuerzo": tieneEntrada && !tieneInicioAlmuerzo && !tieneSalida,
      "fin-almuerzo": tieneInicioAlmuerzo && !tieneFinAlmuerzo && !tieneSalida,
      salida:
        tieneEntrada &&
        (!tieneInicioAlmuerzo || tieneFinAlmuerzo) &&
        !tieneSalida
    }
  };
}

/**
 * Verifica que una acción de marcación respete la secuencia y no esté duplicada.
 */
export function validarSecuenciaJornada(registroEstado, accion) {
  const evalJornada = evaluarEstadoJornada(registroEstado);
  if (accion === "entrada" && evalJornada.tieneEntrada) {
    return {
      valido: false,
      mensaje: "La entrada de hoy ya fue registrada (no se permite duplicar)."
    };
  }
  if (accion === "inicio-almuerzo") {
    if (!evalJornada.tieneEntrada) {
      return {
        valido: false,
        mensaje: "Debe registrar la Entrada antes de iniciar el almuerzo."
      };
    }
    if (evalJornada.tieneInicioAlmuerzo) {
      return {
        valido: false,
        mensaje: "El inicio de almuerzo ya fue registrado hoy."
      };
    }
    if (evalJornada.tieneSalida) {
      return {
        valido: false,
        mensaje: "La jornada ya tiene registrada la salida."
      };
    }
  }
  if (accion === "fin-almuerzo") {
    if (!evalJornada.tieneInicioAlmuerzo) {
      return {
        valido: false,
        mensaje: "Debe registrar el Inicio de almuerzo antes del Fin de almuerzo."
      };
    }
    if (evalJornada.tieneFinAlmuerzo) {
      return {
        valido: false,
        mensaje: "El fin de almuerzo ya fue registrado hoy."
      };
    }
  }
  if (accion === "salida") {
    if (!evalJornada.tieneEntrada) {
      return {
        valido: false,
        mensaje: "Debe registrar la Entrada antes de marcar la Salida."
      };
    }
    if (evalJornada.tieneInicioAlmuerzo && !evalJornada.tieneFinAlmuerzo) {
      return {
        valido: false,
        mensaje: "Debe finalizar el almuerzo antes de registrar la Salida."
      };
    }
    if (evalJornada.tieneSalida) {
      return {
        valido: false,
        mensaje: "La salida de hoy ya fue registrada (no se permite duplicar)."
      };
    }
  }
  return { valido: true, mensaje: "" };
}

/**
 * Construye el objeto de registro manual de asistencia según el contrato de C#.
 */
export function construirRegistroManual(form = {}, rolUsuario = "Encargado") {
  const esEncargado = rolUsuario === "Encargado";
  const fecha = esEncargado
    ? hoyBolivia()
    : String(form.fecha || hoyBolivia()).slice(0, 10);
  const horaEntrada = normalizarHoraCSharp(form.horaEntrada || form.entrada);
  const horaSalida = normalizarHoraCSharp(form.horaSalida || form.salida);
  const horaInicioAlmuerzo = normalizarHoraCSharp(
    form.horaInicioAlmuerzo || form.almuerzoInicio
  );
  const horaFinAlmuerzo = normalizarHoraCSharp(
    form.horaFinAlmuerzo || form.almuerzoFin
  );

  return {
    codigo: String(form.codigo || "").trim(),
    fecha,
    horaEntrada,
    horaSalida,
    horaInicioAlmuerzo: horaInicioAlmuerzo || null,
    horaFinAlmuerzo: horaFinAlmuerzo || null,
    observaciones:
      form.observaciones && String(form.observaciones).trim() !== ""
        ? String(form.observaciones).trim()
        : null,
    jornadaExtendida: Boolean(form.jornadaExtendida),
    reemplazarExistente: esEncargado ? false : Boolean(form.reemplazarExistente)
  };
}

/**
 * Llamada común oficial a POST /api/backend según BACKEND-PARA-LOS-5-MODULOS.md.
 */
export async function llamar(
  operacion,
  datos = {},
  accessToken = "",
  { fetchImpl = fetch, signal } = {}
) {
  const respuesta = await fetchImpl(RUTA_BACKEND, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    body: JSON.stringify({ operacion, datos }),
    signal: signal ?? AbortSignal.timeout(20000)
  });

  const texto = await respuesta.text();
  let resultado = {};
  try {
    resultado = texto ? JSON.parse(texto) : {};
  } catch {
    resultado = { mensaje: "Respuesta inválida del servidor." };
  }

  if (!respuesta.ok) {
    throw Object.assign(
      new Error(resultado?.mensaje || "No se pudo completar la operación"),
      { status: respuesta.status, errores: resultado?.errores }
    );
  }
  return resultado;
}

/**
 * Ejecuta una operación idempotente (con UUID fijo como asistencia.rapida o correcciones.enviar)
 * reintentando automáticamente con el MISMO UUID solo ante fallos de red o 503/504,
 * sin reintentar errores de validación (400, 401, 403, 409, 422).
 */
export async function ejecutarConReintentoIdempotente(
  fnOperacionConUuid,
  { idOperacion = generarUuidOperacion(), maxIntentos = 3, esperaMs = 350 } = {}
) {
  let ultimoError = null;
  for (let intento = 1; intento <= maxIntentos; intento++) {
    try {
      const resultado = await fnOperacionConUuid(idOperacion, intento);
      return { resultado, idOperacion, intentos: intento };
    } catch (err) {
      ultimoError = err;
      const status = Number(err?.status) || 0;
      const esFalloRedOTemporal =
        status === 0 || status === 502 || status === 503 || status === 504;
      if (!esFalloRedOTemporal || intento >= maxIntentos) {
        err.idOperacion = idOperacion;
        err.intentos = intento;
        throw err;
      }
      if (esperaMs > 0) {
        await new Promise((r) => setTimeout(r, esperaMs));
      }
    }
  }
  throw ultimoError;
}

export async function obtenerContratoBackend({ fetchImpl = fetch } = {}) {
  const respuesta = await fetchImpl(RUTA_BACKEND, {
    method: "GET",
    headers: { Accept: "application/json" }
  });
  if (!respuesta.ok) {
    throw new Error("No se pudo obtener el contrato de /api/backend.");
  }
  return respuesta.json();
}

// --- Autenticación en memoria ---
export function iniciarSesion(usuario, password, opciones) {
  return llamar("sesion", { usuario, password }, "", opciones);
}

export function obtenerSesionActual(accessToken, opciones) {
  return llamar("sesion.actual", {}, accessToken, opciones);
}

export function registrarEncargado(usuario, password, opciones) {
  return llamar("registro-encargado", { usuario, password }, "", opciones);
}

// --- Operaciones Parte 1 (Gabriel: Jornada laboral, marcaciones, manual y sincronización) ---
export function consultarEstadoAsistencia(codigo, accessToken, opciones) {
  return llamar(
    "asistencia.estado",
    { codigo: String(codigo || "").trim() },
    accessToken,
    opciones
  );
}

export function consultarResumenAsistencia(idProyecto, accessToken, opciones) {
  const datos =
    idProyecto !== undefined &&
    idProyecto !== null &&
    String(idProyecto).trim() !== ""
      ? { idProyecto: Number(idProyecto) }
      : {};
  return llamar("asistencia.resumen", datos, accessToken, opciones);
}

export function consultarHistorialAsistencia(filtro = {}, accessToken, opciones) {
  return llamar(
    "asistencia.historial",
    {
      inicio: String(filtro.inicio || hoyBolivia()).slice(0, 10),
      fin: String(filtro.fin || hoyBolivia()).slice(0, 10),
      idProyecto: filtro.idProyecto ? Number(filtro.idProyecto) : null,
      id: filtro.id ? Number(filtro.id) : null,
      codigo: filtro.codigo ? String(filtro.codigo).trim() : null
    },
    accessToken,
    opciones
  );
}

export function registrarMarcacionAsistencia(
  { codigo, accion, fecha, observaciones = null, jornadaExtendida = false },
  accessToken,
  opciones
) {
  const payload = {
    codigo: String(codigo || "").trim(),
    accion,
    ...(fecha ? { fecha: String(fecha).slice(0, 10) } : {}),
    ...(observaciones ? { observaciones: String(observaciones).trim() } : {}),
    jornadaExtendida: Boolean(jornadaExtendida)
  };
  return llamar("asistencia.registrar", payload, accessToken, opciones);
}

export function registrarMarcacionRapidaIdempotente(
  { idOperacion, codigo, accion, origen = "codigo" },
  accessToken,
  opciones
) {
  const uuid = idOperacion || generarUuidOperacion();
  return ejecutarConReintentoIdempotente(
    (idOp) =>
      llamar(
        "asistencia.rapida",
        {
          idOperacion: idOp,
          codigo: String(codigo || "").trim(),
          accion,
          origen
        },
        accessToken,
        opciones
      ),
    { idOperacion: uuid, maxIntentos: opciones?.maxIntentos ?? 3, esperaMs: opciones?.esperaMs ?? 300 }
  );
}

export function registrarAsistenciaManual(
  datosManual,
  rolUsuario,
  accessToken,
  opciones
) {
  const payload = construirRegistroManual(datosManual, rolUsuario);
  return llamar("asistencia.manual", payload, accessToken, opciones);
}

export function leerRegistrosDiaDirecto(accessToken, opciones) {
  return llamar("web.registros-dia", {}, accessToken, opciones);
}

export function listarPersonalAsistencia(rolUsuario, accessToken, opciones) {
  const operacion =
    rolUsuario === "Encargado" ? "personal.para-horas" : "personal.listar";
  return llamar(operacion, {}, accessToken, opciones);
}

export function listarProyectosAsistencia(accessToken, opciones) {
  return llamar("proyectos.listar", {}, accessToken, opciones);
}

// --- Operaciones Parte 2 (Carlos: Permisos, faltas, correcciones con motivo e integración QR) ---
export function listarCorrecciones(accessToken, opciones) {
  return llamar("correcciones.listar", {}, accessToken, opciones);
}

export function enviarSolicitudCorreccionIdempotente(
  { id, registro, motivo },
  rolUsuario,
  accessToken,
  opciones
) {
  const uuid = id || generarUuidOperacion();
  const registroNormalizado = construirRegistroManual(registro, "Admin");
  return ejecutarConReintentoIdempotente(
    (idOp) =>
      llamar(
        "correcciones.enviar",
        {
          id: idOp,
          registro: registroNormalizado,
          motivo: String(motivo || "").trim()
        },
        accessToken,
        opciones
      ),
    { idOperacion: uuid, maxIntentos: opciones?.maxIntentos ?? 3, esperaMs: opciones?.esperaMs ?? 300 }
  );
}

export function revisarSolicitudCorreccion(
  { id, aprobar, motivo = "" },
  accessToken,
  opciones
) {
  return llamar(
    "correcciones.revisar",
    {
      id,
      aprobar: Boolean(aprobar),
      motivo: String(motivo || "").trim()
    },
    accessToken,
    opciones
  );
}

export function verificarExisteQr(accessToken, opciones) {
  return llamar("qr.existe", {}, accessToken, opciones);
}

export function emitirCredencialQr(accessToken, opciones) {
  return llamar("qr.emitir", {}, accessToken, opciones);
}

export function contarPendientesQr(accessToken, opciones) {
  return llamar("qr.pendientes", {}, accessToken, opciones);
}

export function listarSolicitudesQr(
  { soloPendientes = true } = {},
  accessToken,
  opciones
) {
  return llamar(
    "qr.solicitudes",
    { soloPendientes: Boolean(soloPendientes) },
    accessToken,
    opciones
  );
}

export function revisarSolicitudQr(
  { id, aprobar, motivo = "" },
  accessToken,
  opciones
) {
  return llamar(
    "qr.revisar",
    {
      id,
      aprobar: Boolean(aprobar),
      motivo: String(motivo || "").trim()
    },
    accessToken,
    opciones
  );
}
