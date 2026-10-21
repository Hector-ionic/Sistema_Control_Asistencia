import {
  ejecutarOperacionContratoEnMemoria,
  establecerTokenMemoria,
  reiniciarMemoriaSimulada
} from "../src/modules/operaciones/services/operacionesService.js";

export function reiniciarMemoriaOperaciones() {
  reiniciarMemoriaSimulada();
  establecerTokenMemoria("", null);
}

function responderJson(res, codigo, cuerpo) {
  res.statusCode = codigo;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.end(JSON.stringify(cuerpo));
}

/**
 * Endpoint del Módulo 05 alineado con el contrato oficial de /api/backend:
 * - Usa POST con `{ operacion, datos }` y `Authorization: Bearer <accessToken>`.
 * - No admite `x-rol-usuario`, `x-usuario` ni identidades suministradas por cabeceras del navegador.
 */
export default function handler(req, res) {
  const metodo = req.method || "GET";

  if (metodo === "GET") {
    return responderJson(res, 200, {
      modulo: "operaciones",
      contrato: "/api/backend",
      metodoOperaciones: "POST",
      autenticacion: "Authorization: Bearer <accessToken>",
      operaciones: [
        "proyectos.listar",
        "proyectos.guardar",
        "asignaciones.listar",
        "asignaciones.guardar",
        "viaticos.listar",
        "viaticos.guardar",
        "viaticos.eliminar"
      ]
    });
  }

  if (metodo !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return responderJson(res, 405, {
      mensaje: "Use GET para el contrato o POST para operaciones."
    });
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  } catch {
    return responderJson(res, 400, { mensaje: "JSON inválido." });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return responderJson(res, 400, { mensaje: "El cuerpo debe ser un objeto JSON." });
  }

  const { operacion, datos = {} } = body;
  const esPublica = operacion === "sesion" || operacion === "registro-encargado";
  const autorizacion = req.headers?.authorization;

  if (!esPublica && (typeof autorizacion !== "string" || !/^Bearer \S+$/i.test(autorizacion))) {
    return responderJson(res, 401, {
      mensaje: "Inicie sesión para consultar o modificar datos."
    });
  }

  const token = esPublica ? "" : autorizacion.replace(/^Bearer\s+/i, "").trim();

  try {
    const resultado = ejecutarOperacionContratoEnMemoria(operacion, datos, token);
    return responderJson(res, 200, resultado);
  } catch (error) {
    const codigo = [400, 401, 403, 404, 409, 413, 422, 429, 502, 503, 504].includes(
      error.status
    )
      ? error.status
      : 503;
    return responderJson(res, codigo, {
      mensaje: error.message || "No se pudo completar la operación.",
      ...(error.errores ? { errores: error.errores } : {})
    });
  }
}
