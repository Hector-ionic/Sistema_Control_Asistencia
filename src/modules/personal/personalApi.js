// Cliente y contratos del Módulo 02 (Personal y Pasantías) conectados a /api/backend
// Cumple estrictamente con BACKEND-PARA-LOS-5-MODULOS.md y el esquema PostgreSQL / C#.

export const RUTA_BACKEND = "/api/backend";
export const ZONA_HORARIA_BOLIVIA = "America/La_Paz";
export const HORAS_META_DEFECTO = 600;

export const TIPOS_CONTRATO = Object.freeze([
  "Pasante",
  "Personal de planta"
]);

export const TURNOS_CSHARP = Object.freeze([
  "Tiempo Completo",
  "Medio Tiempo",
  "Turno Mañana (Medio Tiempo)",
  "Turno Tarde (Medio Tiempo)"
]);

export const DIAS_TRABAJO_CSHARP = Object.freeze([
  "Lunes a Viernes",
  "Lunes a Sábado",
  "Lunes a Domingo",
  "Sábados y Domingos"
]);

/**
 * Devuelve la fecha actual en zona horaria America/La_Paz en formato YYYY-MM-DD.
 */
export function hoyBolivia(fecha = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA_BOLIVIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(fecha);
}

/**
 * Convierte una cadena base64 de imagen a Data URL reconociendo JPEG, WebP o PNG.
 */
export function fotoUrl(base64) {
  if (!base64 || typeof base64 !== "string") return "";
  if (base64.startsWith("data:image/")) return base64;
  const tipo = base64.startsWith("/9j/")
    ? "image/jpeg"
    : base64.startsWith("UklG")
    ? "image/webp"
    : "image/png";
  return `data:${tipo};base64,${base64}`;
}

/**
 * Formatea acumulados de minutos trabajados (incluso mayores a 24 h)
 * sin usar objetos Date del navegador.
 */
export function formatearMinutosAcumulados(minutosTotales = 0) {
  const total = Math.max(0, Math.trunc(Number(minutosTotales) || 0));
  const horas = Math.floor(total / 60);
  const minutos = total % 60;
  return {
    horas,
    minutos,
    horasDecimales: Math.round((total / 60) * 10) / 10,
    texto: `${horas} h ${String(minutos).padStart(2, "0")} min`
  };
}

/**
 * Calcula el porcentaje de avance de pasantía a partir de los minutos reales
 * registrados en asistencia (reportes.seguimiento / reportes.individual) y
 * las horasRequeridas de la ficha.
 * Para Personal de planta (horasRequeridas: 0) devuelve null.
 */
export function calcularAvanceDesdeMinutos(ficha, minutosTrabajados = 0) {
  if (!ficha || ficha.tipoContrato !== "Pasante") {
    return null;
  }
  const horasRequeridas = Number(ficha.horasRequeridas) || HORAS_META_DEFECTO;
  if (horasRequeridas <= 0) return null;

  const minutosMeta = horasRequeridas * 60;
  const minutosCumplidos = Math.max(0, Math.trunc(Number(minutosTrabajados) || 0));
  const minutosPendientes = Math.max(0, minutosMeta - minutosCumplidos);
  const porcentaje = Math.min(
    100,
    Math.round((minutosCumplidos / minutosMeta) * 1000) / 10
  );

  return {
    horasRequeridas,
    minutosMeta,
    minutosCumplidos,
    minutosPendientes,
    cumplido: formatearMinutosAcumulados(minutosCumplidos),
    pendiente: formatearMinutosAcumulados(minutosPendientes),
    porcentaje
  };
}

/**
 * Crea una ficha inicial con los nombres de campos exactos de C#.
 */
export function crearFichaVacia() {
  return {
    idPasante: 0,
    codigo: "",
    nombres: "",
    apellidos: "",
    tipoContrato: "Pasante",
    horasRequeridas: HORAS_META_DEFECTO,
    fechaInicio: hoyBolivia(),
    fechaFin: null,
    turno: "Turno Mañana (Medio Tiempo)",
    diasTrabajo: "Lunes a Viernes",
    idDepartamento: 1,
    idMarca: 1,
    nombreDepartamento: "General",
    nombreMarca: "General",
    proyectoActual: "",
    proximoProyecto: "",
    ci: "",
    universidad: "",
    carrera: "",
    telefono: "",
    email: "",
    direccion: "",
    contacto: "",
    contactoEmergencia: "",
    telefonoEmergencia: "",
    foto: null,
    activo: true
  };
}

/**
 * Valida y prepara el objeto de ficha de personal antes de enviarlo a `personal.guardar`:
 * - Conserva todos los campos de la ficha existente al editar.
 * - Tipos exactos: 'Pasante' y 'Personal de planta'.
 * - Planta siempre guarda 0 horas (horasRequeridas: 0).
 * - Pasante guarda entre 1 y 20000 horas (600 por defecto).
 * - Cambiar fechaInicio en una persona existente (idPasante > 0) requiere rol SuperAdmin.
 */
export function prepararFichaParaGuardar(
  fichaEntrada,
  { usuarioActual = null, fichaExistente = null } = {}
) {
  const base = fichaExistente ? { ...fichaExistente } : {};
  const combinada = {
    ...crearFichaVacia(),
    ...base,
    ...fichaEntrada
  };

  const nombres = String(combinada.nombres ?? "").trim();
  const apellidos = String(combinada.apellidos ?? "").trim();
  const codigo = String(combinada.codigo ?? "").trim();
  const errores = {};

  if (codigo && (codigo.length < 3 || codigo.length > 10)) {
    errores.codigo = "El código de personal debe tener entre 3 y 10 caracteres.";
  }

  if (nombres.length < 2 || nombres.length > 100) {
    errores.nombres = "Los nombres deben tener entre 2 y 100 caracteres.";
  }
  if (apellidos.length < 2 || apellidos.length > 100) {
    errores.apellidos = "Los apellidos deben tener entre 2 y 100 caracteres.";
  }

  const tipoContrato = combinada.tipoContrato;
  if (!TIPOS_CONTRATO.includes(tipoContrato)) {
    errores.tipoContrato =
      "El tipo de contrato debe ser exactamente 'Pasante' o 'Personal de planta'.";
  }

  let horasRequeridas = 0;
  if (tipoContrato === "Pasante") {
    const h =
      combinada.horasRequeridas === undefined || combinada.horasRequeridas === ""
        ? HORAS_META_DEFECTO
        : Number(combinada.horasRequeridas);
    if (!Number.isFinite(h) || h < 1 || h > 20000) {
      errores.horasRequeridas =
        "Para pasantes, las horas requeridas deben estar entre 1 y 20000 (600 por defecto).";
    } else {
      horasRequeridas = Math.trunc(h);
    }
  } else {
    // Regla obligatoria C#: Planta siempre guarda cero horas
    horasRequeridas = 0;
  }

  const turno = combinada.turno || "Tiempo Completo";
  if (!TURNOS_CSHARP.includes(turno)) {
    errores.turno = `Turno inválido. Use uno de los turnos de C#: ${TURNOS_CSHARP.join(", ")}.`;
  }

  const diasTrabajo = combinada.diasTrabajo || "Lunes a Viernes";
  if (!DIAS_TRABAJO_CSHARP.includes(diasTrabajo)) {
    errores.diasTrabajo = `Días de trabajo inválidos. Use: ${DIAS_TRABAJO_CSHARP.join(", ")}.`;
  }

  const idPasante = Number.isInteger(Number(combinada.idPasante))
    ? Math.max(0, Math.trunc(Number(combinada.idPasante)))
    : 0;

  let fechaInicio = (combinada.fechaInicio || hoyBolivia()).slice(0, 10);
  if (idPasante > 0 && fichaExistente?.fechaInicio) {
    const fechaPrevia = String(fichaExistente.fechaInicio).slice(0, 10);
    if (fechaInicio !== fechaPrevia && usuarioActual?.rol !== "SuperAdmin") {
      errores.fechaInicio =
        "Cambiar la fecha de inicio de una persona registrada requiere rol SuperAdmin.";
    }
  }

  if (Object.keys(errores).length > 0) {
    const error = new Error("Revise los datos de la ficha antes de guardar.");
    error.status = 400;
    error.errores = errores;
    throw error;
  }

  const idDepartamento = Number(combinada.idDepartamento) || 1;
  const idMarca = Number(combinada.idMarca) || 1;

  const payload = {
    ...base,
    ...combinada,
    idPasante,
    codigo: codigo || (idPasante > 0 ? base.codigo : "P00001"),
    nombres,
    apellidos,
    tipoContrato,
    horasRequeridas,
    turno,
    diasTrabajo,
    fechaInicio,
    idDepartamento,
    idMarca,
    carrera: String(combinada.carrera ?? "").trim(),
    universidad: String(combinada.universidad ?? "").trim(),
    ci: String(combinada.ci ?? "").trim(),
    telefono: String(combinada.telefono ?? "").trim(),
    email: String(combinada.email ?? "").trim(),
    direccion: String(combinada.direccion ?? "").trim(),
    contacto: String(combinada.contacto ?? "").trim(),
    contactoEmergencia: String(combinada.contactoEmergencia ?? "").trim(),
    telefonoEmergencia: String(combinada.telefonoEmergencia ?? "").trim(),
    foto: combinada.foto ? String(combinada.foto).trim() || null : null,
    activo: combinada.activo !== undefined ? Boolean(combinada.activo) : true
  };

  if (tipoContrato === "Personal de planta") {
    payload.horasRequeridas = 0;
    payload.fechaFin = null;
  }

  return payload;
}

/**
 * Llamada común oficial a POST /api/backend según BACKEND-PARA-LOS-5-MODULOS.md.
 * No envía cabeceras inventadas (x-rol-usuario, x-usuario); usa únicamente
 * Authorization: Bearer <accessToken> cuando hay sesión activa.
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
 * Consulta el contrato público GET /api/backend (no requiere sesión).
 */
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

// Operaciones de sesión (Módulo 01 / compartidas en memoria)
export function iniciarSesion(usuario, password, opciones) {
  return llamar("sesion", { usuario, password }, "", opciones);
}

export function obtenerSesionActual(accessToken, opciones) {
  return llamar("sesion.actual", {}, accessToken, opciones);
}

export function registrarEncargado(usuario, password, opciones) {
  return llamar("registro-encargado", { usuario, password }, "", opciones);
}

// Operaciones oficiales del Módulo 02 — Personal y pasantías
export function listarPersonalActivo(accessToken, idProyecto, opciones) {
  const datos = idProyecto ? { idProyecto: Number(idProyecto) } : {};
  return llamar("personal.listar", datos, accessToken, opciones);
}

export function listarPersonalHistorico(accessToken, opciones) {
  return llamar("personal.historico", {}, accessToken, opciones);
}

export function obtenerPersonal(criterio, accessToken, opciones) {
  const datos =
    typeof criterio === "number" || /^\d+$/.test(String(criterio))
      ? { id: Number(criterio) }
      : typeof criterio === "string"
      ? { codigo: criterio.trim() }
      : criterio;
  return llamar("personal.obtener", datos, accessToken, opciones);
}

export async function verificarExistePersonal(codigo, accessToken, opciones) {
  const res = await llamar(
    "personal.existe",
    { codigo: String(codigo ?? "").trim() },
    accessToken,
    opciones
  );
  return typeof res === "boolean" ? res : Boolean(res?.existe);
}

export function guardarPersonal(
  ficha,
  accessToken,
  { usuarioActual = null, fichaExistente = null, ...opciones } = {}
) {
  const fichaValidada = prepararFichaParaGuardar(ficha, {
    usuarioActual,
    fichaExistente
  });
  // Adaptación estricta para ASP.NET Core C# (evita "La solicitud no tiene un formato válido."):
  // 1. FechaFin en C# es non-nullable DateTime. Enviar null o "" provoca JsonException.
  //    Se omite en el payload para que el servidor C# calcule automáticamente la fecha fin
  //    (9998-12-31 para Personal de planta, o cálculo basado en horas y calendario para Pasante).
  // 2. FechaNacimiento en C# es DateTime?. Enviar "" provoca JsonException; debe enviarse null si está vacía.
  // 3. Foto debe ser base64 puro (sin prefijo "data:image/...;base64,").
  const datosEnvio = { ...fichaValidada };
  if (
    datosEnvio.fechaFin === null ||
    datosEnvio.fechaFin === "" ||
    datosEnvio.tipoContrato === "Personal de planta"
  ) {
    delete datosEnvio.fechaFin;
  }
  if (!datosEnvio.fechaNacimiento) {
    datosEnvio.fechaNacimiento = null;
  }
  if (typeof datosEnvio.foto === "string" && datosEnvio.foto.includes(",")) {
    datosEnvio.foto = datosEnvio.foto.split(",")[1];
  }
  if (!datosEnvio.foto) {
    datosEnvio.foto = null;
  }
  return llamar("personal.guardar", datosEnvio, accessToken, opciones);
}

export function eliminarPersonal(idPasante, accessToken, opciones) {
  return llamar(
    "personal.eliminar",
    { id: Number(idPasante) },
    accessToken,
    opciones
  );
}

export function recalcularPersonal(idPasante, accessToken, opciones) {
  return llamar(
    "personal.recalcular",
    { id: Number(idPasante) },
    accessToken,
    opciones
  );
}

export function listarPersonalParaHoras(accessToken, opciones) {
  return llamar("personal.para-horas", {}, accessToken, opciones);
}

export function listarFeriados(accessToken, opciones) {
  return llamar("feriados.listar", {}, accessToken, opciones);
}

export function listarDepartamentos(accessToken, opciones) {
  return llamar("departamentos.listar", {}, accessToken, opciones);
}

export function listarMarcas(accessToken, opciones) {
  return llamar("marcas.listar", {}, accessToken, opciones);
}

// Operaciones de lectura de progreso real de horas (sin horasSumar manual)
export function consultarSeguimientoReal(filtro = {}, accessToken, opciones) {
  const hoy = hoyBolivia();
  const anioActual = hoy.slice(0, 4);
  const payload = {
    inicio: filtro.inicio || `${anioActual}-01-01`,
    fin: filtro.fin || `${anioActual}-12-31`,
    idProyecto: filtro.idProyecto ?? null,
    id: filtro.id ?? null,
    codigo: filtro.codigo ?? null
  };
  return llamar("reportes.seguimiento", payload, accessToken, opciones);
}

export function consultarIndividualReal(idPasante, accessToken, opciones) {
  return llamar(
    "reportes.individual",
    { id: Number(idPasante) },
    accessToken,
    opciones
  );
}

// Operaciones de proyectos y asignaciones de personal
export function listarProyectos(accessToken, opciones) {
  return llamar("proyectos.listar", {}, accessToken, opciones);
}

export function listarAsignaciones(accessToken, opciones) {
  return llamar("asignaciones.listar", {}, accessToken, opciones);
}

export function guardarAsignacion(datos, accessToken, opciones) {
  const payload = {
    idAsignacion: Number(datos.idAsignacion) || 0,
    idProyecto: Number(datos.idProyecto),
    idPasante: Number(datos.idPasante),
    rol: String(datos.rol || "Ayudante").trim(),
    fechaInicio: (datos.fechaInicio || hoyBolivia()).slice(0, 10),
    fechaFin: datos.fechaFin ? String(datos.fechaFin).slice(0, 10) : null,
    activo: datos.activo !== undefined ? Boolean(datos.activo) : true,
    version: Number(datos.version) || 0
  };
  return llamar("asignaciones.guardar", payload, accessToken, opciones);
}
