// api/acceso.js
import {
  ejecutarOperacionAccesoEnMemoria,
  establecerSesionAccesoMemoria
} from "../src/modules/acceso/services/accesoService.js";

/**
 * Endpoint serverless auxiliar del Módulo 01 (`/api/acceso`).
 * Nota: El frontend oficial llama a `POST /api/backend` mediante `llamar(operacion, datos, accessToken)`.
 * Este handler respeta el mismo contrato (`{ operacion, datos }`, `Authorization: Bearer <accessToken>`).
 */
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    res.statusCode = 200;
    return res.end(
      JSON.stringify({
        modulo: "01",
        nombre: "Acceso y administración",
        contratoOficial: "POST /api/backend",
        operacionesPublicas: ["sesion", "registro-encargado"],
        operacionesAutenticadas: [
          "sesion.actual",
          "usuarios.listar",
          "usuarios.guardar",
          "usuarios.eliminar",
          "configuracion.obtener",
          "configuracion.guardar",
          "auditoria.listar",
          "departamentos.listar",
          "departamentos.guardar",
          "departamentos.eliminar",
          "marcas.listar"
        ]
      })
    );
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, POST");
    return res.end(
      JSON.stringify({
        mensaje: "Use GET para consultar el contrato o POST para ejecutar operaciones."
      })
    );
  }

  let body = {};
  try {
    if (req.body && typeof req.body === "object") {
      body = req.body;
    } else if (typeof req.body === "string" && req.body.trim()) {
      body = JSON.parse(req.body);
    }
  } catch {
    res.statusCode = 400;
    return res.end(JSON.stringify({ mensaje: "JSON inválido." }));
  }

  const { operacion, datos = {} } = body || {};
  const esPublica = operacion === "sesion" || operacion === "registro-encargado";
  const authHeader = String(req.headers?.authorization || "");

  if (!esPublica && !/^Bearer \S+$/i.test(authHeader)) {
    res.statusCode = 401;
    return res.end(
      JSON.stringify({
        mensaje: "Inicie sesión para consultar o modificar datos."
      })
    );
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  try {
    if (!esPublica) {
      const rolInferido = token.toLowerCase().includes("encargado")
        ? "Encargado"
        : token.toLowerCase().includes("admin") && !token.toLowerCase().includes("super")
        ? "Admin"
        : "SuperAdmin";
      establecerSesionAccesoMemoria(
        token,
        {
          idUsuario: rolInferido === "SuperAdmin" ? 4 : rolInferido === "Admin" ? 2 : 9,
          nombreUsuario:
            rolInferido === "SuperAdmin"
              ? "hector.manuel"
              : rolInferido === "Admin"
              ? "camila"
              : "operador.obra",
          rol: rolInferido,
          activo: true
        },
        28800
      );
    }

    const resultado = ejecutarOperacionAccesoEnMemoria(operacion, datos, token);
    res.statusCode = 200;
    return res.end(JSON.stringify(resultado));
  } catch (error) {
    res.statusCode = error.status || 400;
    return res.end(
      JSON.stringify({
        mensaje: error.message || "No se pudo completar la operación.",
        ...(error.errores ? { errores: error.errores } : {})
      })
    );
  }
}
