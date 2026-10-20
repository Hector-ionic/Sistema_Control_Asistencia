// Cliente oficial del Módulo 04 (Historial y reportes) conectado a /api/backend.
// Respeta el contrato de BACKEND-PARA-LOS-5-MODULOS.md y las reglas del servidor C#.

export const RUTA_BACKEND = "/api/backend";

/**
 * Obtiene la fecha actual en zona horaria America/La_Paz en formato YYYY-MM-DD.
 */
export function hoyBolivia() {
  try {
    const partes = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/La_Paz",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());
    const y = partes.find((p) => p.type === "year")?.value;
    const m = partes.find((p) => p.type === "month")?.value;
    const d = partes.find((p) => p.type === "day")?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // Fallback
  }
  return new Date().toISOString().slice(0, 10);
}

/**
 * Obtiene el primer día del mes actual en Bolivia (YYYY-MM-01).
 */
export function inicioMesBolivia() {
  return `${hoyBolivia().slice(0, 7)}-01`;
}

/**
 * Convierte minutos totales (incluso > 24 h, ej. 8560 min o 36000 min)
 * en horas y minutos sin usar Date del navegador.
 */
export function formatearMinutos(minutosEntrada) {
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
 * Determina si un registro de persona o seguimiento corresponde a un Pasante con meta de horas.
 * Regla obligatoria: El personal de planta tiene horasRequeridas: 0 y NUNCA recibe metas de pasantía.
 */
export function esPersonaPasante(registro) {
  if (!registro) return false;
  if (registro.tipoContrato === "Personal de planta") return false;
  if (registro.tipoContrato === "Pasante") return true;
  return Number(registro.horasRequeridas) > 0;
}

/**
 * Calcula las horas cumplidas y pendientes exclusivamente para pasantes.
 * Si es Personal de planta (horasRequeridas <= 0), devuelve null.
 */
export function calcularMetricasPasantia(registro, minutosTotalesOverride) {
  if (!esPersonaPasante(registro)) {
    return null;
  }
  const horasRequeridas = Math.max(0, Number(registro.horasRequeridas) || 0);
  if (horasRequeridas <= 0) {
    return null;
  }
  const minutosMeta = horasRequeridas * 60;
  const minutosCumplidos = Math.max(
    0,
    Math.trunc(
      Number(
        minutosTotalesOverride !== undefined
          ? minutosTotalesOverride
          : registro.minutosTotales ?? registro.minutosTrabajados ?? 0
      ) || 0
    )
  );
  const minutosPendientes = Math.max(0, minutosMeta - minutosCumplidos);
  const porcentaje = Math.min(
    100,
    Math.round((minutosCumplidos / minutosMeta) * 100)
  );

  return {
    esPasante: true,
    horasRequeridas,
    minutosMeta,
    minutosCumplidos,
    minutosPendientes,
    cumplido: formatearMinutos(minutosCumplidos),
    pendiente: formatearMinutos(minutosPendientes),
    porcentaje
  };
}

/**
 * Normaliza el filtro común de reportes para garantizar que consulta,
 * impresión y exportación utilicen exactamente los mismos parámetros.
 */
export function normalizarFiltroReporte(filtro = {}) {
  const inicio = String(filtro.inicio || inicioMesBolivia()).slice(0, 10);
  const fin = String(filtro.fin || hoyBolivia()).slice(0, 10);
  const idProyecto =
    filtro.idProyecto !== undefined &&
    filtro.idProyecto !== null &&
    String(filtro.idProyecto).trim() !== ""
      ? Number(filtro.idProyecto)
      : null;
  const id =
    filtro.id !== undefined &&
    filtro.id !== null &&
    String(filtro.id).trim() !== ""
      ? Number(filtro.id)
      : null;
  const codigo =
    filtro.codigo && String(filtro.codigo).trim() !== ""
      ? String(filtro.codigo).trim()
      : null;

  return {
    inicio,
    fin,
    idProyecto: Number.isFinite(idProyecto) && idProyecto > 0 ? idProyecto : null,
    id: Number.isFinite(id) && id > 0 ? id : null,
    codigo
  };
}

/**
 * Concilia totales de asistencia y viáticos por período y por persona.
 */
export function conciliarAsistenciaYViaticos(
  historial = [],
  viaticos = [],
  seguimiento = []
) {
  const mapaPersonas = new Map();

  const asegurarPersona = (clave, datosBase = {}) => {
    if (!mapaPersonas.has(clave)) {
      mapaPersonas.set(clave, {
        clave,
        idPasante: datosBase.idPasante ?? null,
        codigo: datosBase.codigo || "",
        nombreCompleto:
          datosBase.nombreCompleto ||
          `${datosBase.nombres || ""} ${datosBase.apellidos || ""}`.trim() ||
          datosBase.codigo ||
          "Personal",
        tipoContrato:
          datosBase.tipoContrato ||
          (Number(datosBase.horasRequeridas) > 0 ? "Pasante" : "Personal de planta"),
        horasRequeridas: Number(datosBase.horasRequeridas) || 0,
        registrosAsistencia: 0,
        minutosTrabajados: 0,
        cantidadViaticos: 0,
        montoViaticos: 0,
        gastoExtraViaticos: 0,
        totalViaticosBs: 0
      });
    }
    return mapaPersonas.get(clave);
  };

  for (const seg of Array.isArray(seguimiento) ? seguimiento : []) {
    const clave = seg.codigo || `id:${seg.idPasante ?? seg.id}`;
    const item = asegurarPersona(clave, {
      idPasante: seg.idPasante ?? seg.id,
      codigo: seg.codigo,
      nombres: seg.nombres,
      apellidos: seg.apellidos,
      horasRequeridas: seg.horasRequeridas
    });
    if (Number(seg.horasRequeridas) > 0) {
      item.horasRequeridas = Number(seg.horasRequeridas);
      item.tipoContrato = "Pasante";
    }
  }

  let totalMinutosAsistencia = 0;
  let totalRegistrosAsistencia = 0;

  for (const reg of Array.isArray(historial) ? historial : []) {
    const clave = reg.codigo || `id:${reg.idPasante ?? reg.nombreCompleto}`;
    const item = asegurarPersona(clave, {
      idPasante: reg.idPasante,
      codigo: reg.codigo,
      nombreCompleto: reg.nombreCompleto
    });
    const min = Math.max(0, Math.trunc(Number(reg.minutosTrabajados) || 0));
    item.registrosAsistencia += 1;
    item.minutosTrabajados += min;
    totalRegistrosAsistencia += 1;
    totalMinutosAsistencia += min;
  }

  let totalMontoBase = 0;
  let totalGastoExtra = 0;
  let totalViaticos = 0;

  for (const v of Array.isArray(viaticos) ? viaticos : []) {
    let item = null;
    if (v.codigo && mapaPersonas.has(v.codigo)) {
      item = mapaPersonas.get(v.codigo);
    } else if (v.idPasante) {
      for (const existente of mapaPersonas.values()) {
        if (Number(existente.idPasante) === Number(v.idPasante)) {
          item = existente;
          break;
        }
      }
      if (!item) {
        item = asegurarPersona(`id:${v.idPasante}`, {
          idPasante: v.idPasante,
          codigo: v.codigo || `ID-${v.idPasante}`,
          nombreCompleto: v.nombrePersonal || `Personal #${v.idPasante}`
        });
      }
    }

    const monto = Math.max(0, Number(v.monto) || 0);
    const extra = Math.max(0, Number(v.gastoExtra) || 0);
    const suma = Math.round((monto + extra) * 100) / 100;

    totalMontoBase = Math.round((totalMontoBase + monto) * 100) / 100;
    totalGastoExtra = Math.round((totalGastoExtra + extra) * 100) / 100;
    totalViaticos = Math.round((totalViaticos + suma) * 100) / 100;

    if (item) {
      item.cantidadViaticos += 1;
      item.montoViaticos = Math.round((item.montoViaticos + monto) * 100) / 100;
      item.gastoExtraViaticos =
        Math.round((item.gastoExtraViaticos + extra) * 100) / 100;
      item.totalViaticosBs =
        Math.round((item.totalViaticosBs + suma) * 100) / 100;
    }
  }

  const porPersona = Array.from(mapaPersonas.values()).map((p) => ({
    ...p,
    tiempoFormateado: formatearMinutos(p.minutosTrabajados),
    pasantia: calcularMetricasPasantia(p, p.minutosTrabajados)
  }));

  return {
    totalRegistrosAsistencia,
    totalMinutosAsistencia,
    tiempoTotalFormateado: formatearMinutos(totalMinutosAsistencia),
    cantidadViaticos: Array.isArray(viaticos) ? viaticos.length : 0,
    totalMontoBase,
    totalGastoExtra,
    totalViaticosBs: totalViaticos,
    porPersona
  };
}

/**
 * Pagina cualquier lista de resultados garantizando soporte para reportes de varias páginas.
 */
export function paginarResultados(lista = [], pagina = 1, porPagina = 15) {
  const items = Array.isArray(lista) ? lista : [];
  const tamano = Math.max(1, Math.trunc(Number(porPagina) || 15));
  const totalItems = items.length;
  const totalPaginas = Math.max(1, Math.ceil(totalItems / tamano));
  const paginaActual = Math.min(
    totalPaginas,
    Math.max(1, Math.trunc(Number(pagina) || 1))
  );
  const indiceInicio = (paginaActual - 1) * tamano;
  const indiceFin = Math.min(totalItems, indiceInicio + tamano);

  return {
    itemsPagina: items.slice(indiceInicio, indiceFin),
    paginaActual,
    porPagina: tamano,
    totalItems,
    totalPaginas,
    desdeRegistro: totalItems === 0 ? 0 : indiceInicio + 1,
    hastaRegistro: indiceFin
  };
}

/**
 * Escapa un valor para CSV seguro (compatible con Excel y hojas de cálculo).
 */
export function escaparCeldaCsv(valor) {
  if (valor === null || valor === undefined) return "";
  const str = String(valor).replace(/\r?\n/g, " ").trim();
  if (/[",;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Genera contenido CSV (con BOM UTF-8) a partir de columnas y filas.
 */
export function generarCsvReporte(columnas = [], filas = []) {
  const cabecera = columnas.map((c) => escaparCeldaCsv(c.etiqueta)).join(",");
  const lineas = filas.map((fila) =>
    columnas
      .map((c) => {
        const valor =
          typeof c.obtener === "function" ? c.obtener(fila) : fila[c.clave];
        return escaparCeldaCsv(valor);
      })
      .join(",")
  );
  return `\uFEFF${[cabecera, ...lineas].join("\r\n")}`;
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

// Operaciones de autenticación en memoria
export function iniciarSesion(usuario, password, opciones) {
  return llamar("sesion", { usuario, password }, "", opciones);
}

export function obtenerSesionActual(accessToken, opciones) {
  return llamar("sesion.actual", {}, accessToken, opciones);
}

export function registrarEncargado(usuario, password, opciones) {
  return llamar("registro-encargado", { usuario, password }, "", opciones);
}

// Operaciones oficiales del Módulo 04 — Historial y reportes
export function consultarReporteHistorial(filtro = {}, accessToken, opciones) {
  const normalizado = normalizarFiltroReporte(filtro);
  return llamar("reportes.historial", normalizado, accessToken, opciones);
}

export function consultarReporteSeguimiento(filtro = {}, accessToken, opciones) {
  const normalizado = normalizarFiltroReporte(filtro);
  return llamar("reportes.seguimiento", normalizado, accessToken, opciones);
}

export function consultarReporteAsignaciones(
  filtro = {},
  accessToken,
  opciones
) {
  const normalizado = normalizarFiltroReporte(filtro);
  return llamar(
    "reportes.asignaciones",
    {
      idProyecto: normalizado.idProyecto,
      id: normalizado.id
    },
    accessToken,
    opciones
  );
}

export function consultarReporteIndividual(criterio, accessToken, opciones) {
  const datos =
    typeof criterio === "number" || /^\d+$/.test(String(criterio))
      ? { id: Number(criterio) }
      : typeof criterio === "string"
      ? { codigo: criterio.trim() }
      : criterio;
  return llamar("reportes.individual", datos, accessToken, opciones);
}

export function consultarReporteMarcas(filtro = {}, accessToken, opciones) {
  const normalizado = normalizarFiltroReporte(filtro);
  return llamar(
    "reportes.marcas",
    { idProyecto: normalizado.idProyecto },
    accessToken,
    opciones
  );
}

// Catálogos y conciliación de viáticos
export function listarPersonalCatalogo(accessToken, opciones) {
  return llamar("personal.historico", {}, accessToken, opciones);
}

export function listarProyectosCatalogo(accessToken, opciones) {
  return llamar("proyectos.listar", {}, accessToken, opciones);
}

export function listarViaticosPeriodo(filtro = {}, accessToken, opciones) {
  const normalizado = normalizarFiltroReporte(filtro);
  return llamar(
    "viaticos.listar",
    {
      inicio: normalizado.inicio,
      fin: normalizado.fin,
      id: normalizado.id
    },
    accessToken,
    opciones
  );
}
