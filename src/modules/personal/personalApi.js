// Cliente HTTP para el Módulo 02 (Personal y Pasantías)
// Se comunica con /api/personal y ofrece funciones claras y reutilizables
// por los módulos de Asistencia (03), Reportes (04) y Operaciones (05).

const RUTA_API_PERSONAL = "/api/personal";
const TIMEOUT_MS = 10000;

async function peticionJson(url, opciones = {}) {
  const respuesta = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      "Content-Type": "application/json",
      ...(opciones.headers || {})
    },
    ...opciones
  });

  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const error = new Error(
      datos.mensaje || "No se pudo completar la operación con el servidor."
    );
    error.statusCode = respuesta.status;
    error.errores = datos.errores || null;
    throw error;
  }
  return datos;
}

/**
 * Obtiene la lista de personal aplicando filtros opcionales:
 * { q, tipo: "todos" | "planta" | "pasante", estado: "todos" | "activo" | "baja" }
 */
export async function obtenerPersonal(filtros = {}) {
  const params = new URLSearchParams();
  if (filtros.q) params.set("q", filtros.q);
  if (filtros.tipo && filtros.tipo !== "todos") params.set("tipo", filtros.tipo);
  if (filtros.estado && filtros.estado !== "todos") params.set("estado", filtros.estado);

  const query = params.toString();
  const url = query ? `${RUTA_API_PERSONAL}?${query}` : RUTA_API_PERSONAL;
  return peticionJson(url, { method: "GET" });
}

/**
 * Consulta una persona específica por ID o código (ej. "PER-001").
 */
export async function obtenerFichaPersona(idOCodigo) {
  const params = new URLSearchParams({ id: idOCodigo });
  return peticionJson(`${RUTA_API_PERSONAL}?${params.toString()}`, {
    method: "GET"
  });
}

/**
 * Registra una nueva persona (planta o pasante).
 */
export async function registrarNuevaPersona(datos) {
  return peticionJson(RUTA_API_PERSONAL, {
    method: "POST",
    body: JSON.stringify(datos)
  });
}

/**
 * Edita los datos de una persona existente conservando su historial.
 */
export async function editarFichaPersona(id, cambios) {
  return peticionJson(RUTA_API_PERSONAL, {
    method: "PUT",
    body: JSON.stringify({ id, ...cambios })
  });
}

/**
 * Da de baja lógica o recupera (reactiva) una persona conservando su historial.
 */
export async function cambiarEstadoFichaPersona(id, { estado, motivo }) {
  return peticionJson(RUTA_API_PERSONAL, {
    method: "PATCH",
    body: JSON.stringify({ id, estado, motivo })
  });
}

/**
 * Actualiza el progreso de horas cumplidas, feriados o incidencias de un pasante.
 */
export async function actualizarProgresoPasantia(id, datosProgreso) {
  return peticionJson(RUTA_API_PERSONAL, {
    method: "PATCH",
    body: JSON.stringify({
      id,
      accion: "progreso",
      ...datosProgreso
    })
  });
}
