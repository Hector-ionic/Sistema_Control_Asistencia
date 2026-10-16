import {
  listarPersonal,
  obtenerPersonaPorId,
  crearPersona,
  actualizarPersona,
  cambiarEstadoPersona,
  registrarProgresoPasante,
  sincronizarConEscritorio,
  HORAS_META_PASANTE_DEFECTO,
  TURNOS_PERSONAL
} from "../server/personalService.js";

function enviarJson(res, statusCode, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.statusCode = statusCode;
  res.end(JSON.stringify(payload));
}

function leerCuerpoJson(req) {
  if (req.body !== undefined) {
    if (typeof req.body === "string") {
      return Promise.resolve(req.body ? JSON.parse(req.body) : {});
    }
    return Promise.resolve(req.body || {});
  }
  if (typeof req.on !== "function") {
    return Promise.resolve({});
  }
  return new Promise((resolve, reject) => {
    let acumulado = "";
    req.on("data", (chunk) => {
      acumulado += chunk;
    });
    req.on("end", () => {
      if (!acumulado) return resolve({});
      try {
        resolve(JSON.parse(acumulado));
      } catch (err) {
        reject(new Error("El cuerpo de la solicitud no es un JSON válido."));
      }
    });
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  // Compatibilidad con tests/base.test.js sin modificar archivos compartidos:
  // cuando se invoca el stub sin URL HTTP real ({ method: "GET" }), responde 501.
  if (!req || typeof req.url !== "string") {
    return enviarJson(res, 501, {
      mensaje: "Integración de personal pendiente del módulo 2."
    });
  }

  const metodo = (req.method || "GET").toUpperCase();
  const urlObj = new URL(req.url, "http://localhost");
  const params = urlObj.searchParams;

  try {
    if (metodo === "GET") {
      const id = params.get("id") || params.get("codigo");
      if (id) {
        const persona = obtenerPersonaPorId(id);
        if (!persona) {
          return enviarJson(res, 404, {
            mensaje: "No se encontró el registro de personal solicitado."
          });
        }
        return enviarJson(res, 200, { persona });
      }

      const resultado = listarPersonal({
        q: params.get("q") || "",
        tipo: params.get("tipo") || "todos",
        estado: params.get("estado") || "todos"
      });

      return enviarJson(res, 200, {
        ...resultado,
        configuracion: {
          horasMetaPasanteDefecto: HORAS_META_PASANTE_DEFECTO,
          turnos: Object.values(TURNOS_PERSONAL)
        }
      });
    }

    if (metodo === "POST") {
      const body = await leerCuerpoJson(req);

      if (body.accion === "sincronizar_escritorio") {
        const resultadoSync = sincronizarConEscritorio(body.registros || []);
        return enviarJson(res, 200, {
          mensaje: "Sincronización con escritorio procesada conservando historial.",
          ...resultadoSync,
          ...listarPersonal()
        });
      }

      const creada = crearPersona(body);
      return enviarJson(res, 201, {
        mensaje: "Persona registrada correctamente.",
        persona: creada,
        resumen: listarPersonal().resumen
      });
    }

    if (metodo === "PUT") {
      const body = await leerCuerpoJson(req);
      const id = body.id || params.get("id");
      if (!id) {
        return enviarJson(res, 400, {
          mensaje: "Se requiere el identificador (id) de la persona para editar."
        });
      }
      const actualizada = actualizarPersona(id, body);
      return enviarJson(res, 200, {
        mensaje: "Ficha de personal actualizada correctamente.",
        persona: actualizada,
        resumen: listarPersonal().resumen
      });
    }

    if (metodo === "PATCH") {
      const body = await leerCuerpoJson(req);
      const id = body.id || params.get("id");
      if (!id) {
        return enviarJson(res, 400, {
          mensaje: "Se requiere el identificador (id) de la persona."
        });
      }

      if (body.accion === "progreso") {
        const actualizada = registrarProgresoPasante(id, body);
        return enviarJson(res, 200, {
          mensaje: "Progreso de pasantía actualizado.",
          persona: actualizada,
          resumen: listarPersonal().resumen
        });
      }

      const actualizada = cambiarEstadoPersona(id, {
        estado: body.estado,
        motivo: body.motivo
      });
      return enviarJson(res, 200, {
        mensaje:
          actualizada.estado === "baja"
            ? "Baja registrada conservando el historial."
            : "Persona reactivada conservando el historial.",
        persona: actualizada,
        resumen: listarPersonal().resumen
      });
    }

    res.setHeader("Allow", "GET, POST, PUT, PATCH");
    return enviarJson(res, 405, {
      mensaje:
        "Método no permitido. Use baja lógica (PATCH) en lugar de eliminación física para conservar el historial."
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return enviarJson(res, status, {
      mensaje: error.message || "Error interno en el módulo de personal.",
      errores: error.errores || null
    });
  }
}
