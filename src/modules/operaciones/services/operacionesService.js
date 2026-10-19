// src/modules/operaciones/services/operacionesService.js
import {
  mockPersonal,
  mockProyectos,
  mockAsignaciones,
  mockViaticos,
  mockAuditoria,
  REGLAS_VIATICOS_VIGENTES
} from "../mocks/datosPrueba.js";
import {
  validarProyecto,
  prepararCierreProyecto,
  validarAsignacion,
  prepararFinalizacionAsignacion,
  validarViatico,
  calcularTotalesYResumenReportes,
  obtenerFechaHoraLaPaz
} from "../utils/reglasOperaciones.js";

/**
 * Regla de BACKEND-PARA-LOS-5-MODULOS.md:
 * "Guardar el token solo en memoria. No confiar en rolUsuario, x-rol-usuario ni x-usuario:
 * la autoridad es la sesión validada por el servidor."
 * "No reintentar automáticamente escrituras: salvo las marcaciones rápidas y solicitudes con UUID, no todas son idempotentes."
 */
let tokenEnMemoria = "";
let sesionActualEnMemoria = null;

// Memoria volátil exclusiva para cuando la API C# remota no está disponible localmente (sin usar localStorage)
let memoriaContratoLocal = crearMemoriaInicial();

function crearMemoriaInicial() {
  return {
    personal: structuredClone(mockPersonal),
    proyectos: structuredClone(mockProyectos),
    asignaciones: structuredClone(mockAsignaciones),
    viaticos: structuredClone(mockViaticos),
    auditoria: structuredClone(mockAuditoria)
  };
}

export function obtenerTokenMemoria() {
  return tokenEnMemoria;
}

export function establecerTokenMemoria(nuevoToken = "", usuarioActual = null) {
  tokenEnMemoria = String(nuevoToken || "");
  sesionActualEnMemoria = usuarioActual;
}

export function cerrarSesionMemoria() {
  tokenEnMemoria = "";
  sesionActualEnMemoria = null;
}

export function obtenerSesionMemoria() {
  return sesionActualEnMemoria;
}

export function reiniciarMemoriaSimulada() {
  memoriaContratoLocal = crearMemoriaInicial();
  return memoriaContratoLocal;
}

/**
 * Función oficial `llamar` definida en BACKEND-PARA-LOS-5-MODULOS.md.
 * Envía POST /api/backend con { operacion, datos } y cabecera Authorization: Bearer <accessToken>.
 * Nunca envía x-rol-usuario ni x-usuario.
 */
export async function llamar(operacion, datos = {}, accessToken = tokenEnMemoria, opcionesExtra = {}) {
  const { fetchImpl = fetch } = opcionesExtra;
  const respuesta = await fetchImpl("/api/backend", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    body: JSON.stringify({ operacion, datos })
  });

  const texto = await respuesta.text();
  let resultado = {};
  try {
    resultado = texto ? JSON.parse(texto) : {};
  } catch {
    throw Object.assign(new Error("La API devolvió una respuesta inválida."), {
      status: 502
    });
  }

  if (!respuesta.ok) {
    if (respuesta.status === 401) {
      cerrarSesionMemoria();
    }
    throw Object.assign(
      new Error(resultado?.mensaje || "No se pudo completar la operación"),
      { status: respuesta.status, errores: resultado?.errores }
    );
  }

  if (operacion === "sesion" && resultado?.accessToken) {
    tokenEnMemoria = String(resultado.accessToken);
  } else if (operacion === "sesion.actual" && resultado && typeof resultado === "object") {
    sesionActualEnMemoria = resultado;
  }

  return resultado;
}

/**
 * Ejecutor de contrato en memoria (sin localStorage) cuando el servidor C# no está encendido
 * o la rama aún se prueba de forma aislada antes de levantar REGISTRO_DESKTOP_API_URL.
 * Respeta exactamente las operaciones, nombres de campos, control de versión (409) y reglas C#.
 */
export function ejecutarOperacionContratoEnMemoria(operacion, datos = {}, accessToken = tokenEnMemoria) {
  const esPublica = operacion === "sesion" || operacion === "registro-encargado";
  if (!esPublica && !accessToken) {
    throw Object.assign(
      new Error("Inicie sesión para consultar o modificar datos."),
      { status: 401 }
    );
  }

  const registrarAuditoria = (op, entidad, detalle) => {
    const usuario = sesionActualEnMemoria?.nombreUsuario || "admin";
    const rol = sesionActualEnMemoria?.rol || "SuperAdmin";
    memoriaContratoLocal.auditoria = [
      {
        idAuditoria: Date.now() + Math.floor(Math.random() * 1000),
        fechaHora: obtenerFechaHoraLaPaz(),
        zonaHoraria: "America/La_Paz",
        usuario,
        rol,
        operacion: op,
        entidad,
        detalle
      },
      ...memoriaContratoLocal.auditoria
    ];
  };

  if (operacion === "sesion") {
    const usuarioNombre = String(datos?.usuario || "").trim();
    const password = String(datos?.password || "");
    if (!usuarioNombre || !password) {
      throw Object.assign(new Error("Ingrese usuario y contraseña."), { status: 400 });
    }
    const rolDetectado =
      usuarioNombre.toLowerCase().includes("encargado")
        ? "Encargado"
        : usuarioNombre.toLowerCase().includes("super")
        ? "SuperAdmin"
        : "Admin";
    const tokenGenerado = `mem-token-${rolDetectado.toLowerCase()}-${Date.now()}`;
    const perfil = {
      idUsuario: rolDetectado === "SuperAdmin" ? 1 : rolDetectado === "Admin" ? 2 : 3,
      nombreUsuario: usuarioNombre,
      rol: rolDetectado,
      activo: true
    };
    establecerTokenMemoria(tokenGenerado, perfil);
    return {
      tokenType: "Bearer",
      accessToken: tokenGenerado,
      expiresIn: 28800
    };
  }

  if (operacion === "sesion.actual") {
    return (
      sesionActualEnMemoria || {
        idUsuario: 1,
        nombreUsuario: "admin",
        rol: "SuperAdmin",
        activo: true
      }
    );
  }

  if (operacion === "personal.listar") {
    const idPry = datos?.idProyecto ? Number(datos.idProyecto) : null;
    const activos = memoriaContratoLocal.personal.filter((p) => p.activo !== false);
    if (!idPry) return structuredClone(activos);
    const idsAsignados = new Set(
      memoriaContratoLocal.asignaciones
        .filter((a) => Number(a.idProyecto) === idPry && a.activo)
        .map((a) => Number(a.idPasante))
    );
    return structuredClone(activos.filter((p) => idsAsignados.has(Number(p.idPasante))));
  }

  if (operacion === "proyectos.listar") {
    return structuredClone(memoriaContratoLocal.proyectos);
  }

  if (operacion === "proyectos.guardar") {
    const idEdicion = Number(datos?.idProyecto || 0);
    const validacion = validarProyecto(datos, memoriaContratoLocal.proyectos, idEdicion);
    if (!validacion.valido) {
      throw Object.assign(
        new Error(Object.values(validacion.errores)[0] || "Datos de proyecto inválidos."),
        { status: 400, errores: validacion.errores }
      );
    }

    const payload = validacion.payload;

    if (idEdicion > 0) {
      const existente = memoriaContratoLocal.proyectos.find(
        (p) => Number(p.idProyecto) === idEdicion
      );
      if (!existente) {
        throw Object.assign(new Error("El proyecto indicado no existe."), { status: 404 });
      }
      if (Number(payload.version) !== Number(existente.version)) {
        throw Object.assign(
          new Error(
            "Conflicto de versión (409): el proyecto fue modificado por otro usuario. Se recargaron los datos actuales; revíselos antes de guardar."
          ),
          { status: 409 }
        );
      }

      const actualizado = {
        ...existente,
        ...payload,
        version: Number(existente.version) + 1
      };
      memoriaContratoLocal.proyectos = memoriaContratoLocal.proyectos.map((p) =>
        Number(p.idProyecto) === idEdicion ? actualizado : p
      );

      // Si el proyecto pasa a 'Finalizado', C# cierra sus asignaciones activas conservando el historial
      if (actualizado.estado === "Finalizado") {
        memoriaContratoLocal.asignaciones = memoriaContratoLocal.asignaciones.map((a) =>
          Number(a.idProyecto) === idEdicion && a.activo
            ? {
                ...a,
                activo: false,
                fechaFin: a.fechaFin || actualizado.fechaFin,
                version: Number(a.version || 1) + 1
              }
            : a
        );
      }

      registrarAuditoria(
        "proyectos.guardar",
        `Proyecto #${idEdicion}`,
        `Actualización de '${actualizado.nombre}' (estado: ${actualizado.estado}, versión: ${actualizado.version}).`
      );
      return structuredClone(actualizado);
    }

    const nuevoId =
      memoriaContratoLocal.proyectos.reduce(
        (max, p) => Math.max(max, Number(p.idProyecto)),
        100
      ) + 1;
    const creado = {
      ...payload,
      idProyecto: nuevoId,
      version: 1
    };
    memoriaContratoLocal.proyectos = [creado, ...memoriaContratoLocal.proyectos];
    registrarAuditoria(
      "proyectos.guardar",
      `Proyecto #${nuevoId}`,
      `Alta de proyecto '${creado.nombre}' (${creado.codigo}) en estado '${creado.estado}'.`
    );
    return structuredClone(creado);
  }

  if (operacion === "asignaciones.listar") {
    const idPry = datos?.idProyecto ? Number(datos.idProyecto) : null;
    const idPas = datos?.id ? Number(datos.id) : null;
    return structuredClone(
      memoriaContratoLocal.asignaciones.filter((a) => {
        if (idPry && Number(a.idProyecto) !== idPry) return false;
        if (idPas && Number(a.idPasante) !== idPas) return false;
        return true;
      })
    );
  }

  if (operacion === "asignaciones.guardar") {
    const idEdicion = Number(datos?.idAsignacion || 0);
    const validacion = validarAsignacion(
      datos,
      memoriaContratoLocal.proyectos,
      memoriaContratoLocal.asignaciones,
      idEdicion
    );
    if (!validacion.valido) {
      throw Object.assign(
        new Error(Object.values(validacion.errores)[0] || "Asignación inválida."),
        { status: 400, errores: validacion.errores }
      );
    }

    const payload = validacion.payload;

    if (idEdicion > 0) {
      const existente = memoriaContratoLocal.asignaciones.find(
        (a) => Number(a.idAsignacion) === idEdicion
      );
      if (!existente) {
        throw Object.assign(new Error("La asignación indicada no existe."), { status: 404 });
      }
      if (Number(payload.version) !== Number(existente.version)) {
        throw Object.assign(
          new Error(
            "Conflicto de versión (409): la asignación fue modificada previamente. Vuelva a consultar y revise antes de guardar."
          ),
          { status: 409 }
        );
      }
      const actualizada = {
        ...existente,
        ...payload,
        version: Number(existente.version) + 1
      };
      memoriaContratoLocal.asignaciones = memoriaContratoLocal.asignaciones.map((a) =>
        Number(a.idAsignacion) === idEdicion ? actualizada : a
      );
      registrarAuditoria(
        "asignaciones.guardar",
        `Asignación #${idEdicion}`,
        `Actualización de asignación (idProyecto: ${actualizada.idProyecto}, idPasante: ${actualizada.idPasante}, activo: ${actualizada.activo}, versión: ${actualizada.version}).`
      );
      return structuredClone(actualizada);
    }

    const nuevoId =
      memoriaContratoLocal.asignaciones.reduce(
        (max, a) => Math.max(max, Number(a.idAsignacion)),
        300
      ) + 1;
    const creada = {
      ...payload,
      idAsignacion: nuevoId,
      version: 1
    };
    memoriaContratoLocal.asignaciones = [creada, ...memoriaContratoLocal.asignaciones];
    registrarAuditoria(
      "asignaciones.guardar",
      `Asignación #${nuevoId}`,
      `Alta de asignación para idPasante ${creada.idPasante} en idProyecto ${creada.idProyecto} (${creada.rol}).`
    );
    return structuredClone(creada);
  }

  if (operacion === "viaticos.listar") {
    const inicio = datos?.inicio || "";
    const fin = datos?.fin || "";
    const idPas = datos?.id ? Number(datos.id) : null;
    return structuredClone(
      memoriaContratoLocal.viaticos.filter((v) => {
        if (idPas && Number(v.idPasante) !== idPas) return false;
        if (inicio && v.fecha < inicio) return false;
        if (fin && v.fecha > fin) return false;
        return true;
      })
    );
  }

  if (operacion === "viaticos.guardar") {
    const validacion = validarViatico(datos, REGLAS_VIATICOS_VIGENTES);
    if (!validacion.valido) {
      throw Object.assign(
        new Error(Object.values(validacion.errores)[0] || "Viático inválido según reglas C#."),
        { status: 400, errores: validacion.errores }
      );
    }

    const payload = validacion.payload;
    if (payload.idViatico > 0) {
      const existente = memoriaContratoLocal.viaticos.find(
        (v) => Number(v.idViatico) === payload.idViatico
      );
      if (!existente) {
        throw Object.assign(new Error("El viático indicado no existe."), { status: 404 });
      }
      const actualizado = { ...payload };
      memoriaContratoLocal.viaticos = memoriaContratoLocal.viaticos.map((v) =>
        Number(v.idViatico) === payload.idViatico ? actualizado : v
      );
      registrarAuditoria(
        "viaticos.guardar",
        `Viático #${payload.idViatico}`,
        `Edición de viático para idPasante ${actualizado.idPasante}: monto Bs ${actualizado.monto.toFixed(2)}, gastoExtra Bs ${actualizado.gastoExtra.toFixed(2)}.`
      );
      return structuredClone(actualizado);
    }

    const nuevoId =
      memoriaContratoLocal.viaticos.reduce(
        (max, v) => Math.max(max, Number(v.idViatico)),
        500
      ) + 1;
    const creado = {
      ...payload,
      idViatico: nuevoId
    };
    memoriaContratoLocal.viaticos = [creado, ...memoriaContratoLocal.viaticos];
    registrarAuditoria(
      "viaticos.guardar",
      `Viático #${nuevoId}`,
      `Alta de viático para idPasante ${creado.idPasante}: monto Bs ${creado.monto.toFixed(2)}, gastoExtra Bs ${creado.gastoExtra.toFixed(2)}.`
    );
    return structuredClone(creado);
  }

  if (operacion === "viaticos.eliminar") {
    const rolActual = sesionActualEnMemoria?.rol || "SuperAdmin";
    if (!["SuperAdmin", "Admin"].includes(rolActual)) {
      throw Object.assign(
        new Error("No tiene permiso para eliminar viáticos. Se requiere rol Admin o SuperAdmin."),
        { status: 403 }
      );
    }
    const idEliminar = Number(datos?.id || 0);
    const existente = memoriaContratoLocal.viaticos.find(
      (v) => Number(v.idViatico) === idEliminar
    );
    if (!existente) {
      throw Object.assign(new Error("El viático indicado no existe."), { status: 404 });
    }
    memoriaContratoLocal.viaticos = memoriaContratoLocal.viaticos.filter(
      (v) => Number(v.idViatico) !== idEliminar
    );
    registrarAuditoria(
      "viaticos.eliminar",
      `Viático #${idEliminar}`,
      `Eliminación física en C# de viático #${idEliminar} (Bs ${existente.monto.toFixed(2)}).`
    );
    return { eliminado: true, id: idEliminar };
  }

  if (operacion === "auditoria.listar") {
    const rolActual = sesionActualEnMemoria?.rol || "SuperAdmin";
    if (rolActual !== "SuperAdmin") {
      throw Object.assign(
        new Error("Solo SuperAdmin puede consultar auditoria.listar."),
        { status: 403 }
      );
    }
    return structuredClone(memoriaContratoLocal.auditoria.slice(0, 1000));
  }

  if (operacion === "reportes.individual") {
    const idPasante = Number(datos?.id || 0);
    const persona = memoriaContratoLocal.personal.find(
      (p) => Number(p.idPasante) === idPasante
    );
    return {
      personal: persona || null,
      asistencias: [],
      viaticos: memoriaContratoLocal.viaticos.filter(
        (v) => Number(v.idPasante) === idPasante
      ),
      // Para mantener el contrato existente de C#, `proyectos` contiene asignaciones
      proyectos: memoriaContratoLocal.asignaciones.filter(
        (a) => Number(a.idPasante) === idPasante
      )
    };
  }

  if (operacion === "reportes.asignaciones") {
    return ejecutarOperacionContratoEnMemoria("asignaciones.listar", datos, accessToken);
  }

  throw Object.assign(
    new Error(`Operación '${operacion}' no disponible.`),
    { status: 400 }
  );
}

/**
 * Ejecuta una operación contra `POST /api/backend` (modo real autenticado)
 * o contra el contrato en memoria si el usuario activó el modo de prueba sin servidor C#.
 */
export async function ejecutarOperacionModulo05(
  operacion,
  datos = {},
  { usarContratoMemoria = false, modoRed = "normal" } = {}
) {
  if (modoRed === "lenta") {
    await new Promise((r) => setTimeout(r, 850));
  }
  if (modoRed === "error") {
    throw Object.assign(
      new Error("No se pudo completar la operación. Revise la conexión del backend."),
      { status: 503 }
    );
  }

  if (usarContratoMemoria) {
    return ejecutarOperacionContratoEnMemoria(operacion, datos, tokenEnMemoria);
  }

  return llamar(operacion, datos, tokenEnMemoria);
}

/**
 * Carga inicial o recarga completa de las colecciones del Módulo 05 usando las operaciones oficiales:
 * `proyectos.listar`, `asignaciones.listar`, `viaticos.listar`, `personal.listar`, `auditoria.listar`.
 */
export async function cargarColeccionesModulo05(opciones = {}) {
  const [proyectos, asignaciones, viaticos, personal] = await Promise.all([
    ejecutarOperacionModulo05("proyectos.listar", {}, opciones),
    ejecutarOperacionModulo05("asignaciones.listar", {}, opciones),
    ejecutarOperacionModulo05("viaticos.listar", {}, opciones),
    ejecutarOperacionModulo05("personal.listar", {}, opciones)
  ]);

  let auditoria = [];
  try {
    auditoria = await ejecutarOperacionModulo05("auditoria.listar", {}, opciones);
  } catch {
    // Si el usuario es Admin o Encargado (no SuperAdmin), auditoria.listar responde 403 según contrato
    auditoria = [];
  }

  return {
    proyectos: Array.isArray(proyectos) ? proyectos : [],
    asignaciones: Array.isArray(asignaciones) ? asignaciones : [],
    viaticos: Array.isArray(viaticos) ? viaticos : [],
    personal: Array.isArray(personal) ? personal : [],
    auditoria: Array.isArray(auditoria) ? auditoria : []
  };
}

export {
  prepararCierreProyecto,
  prepararFinalizacionAsignacion,
  calcularTotalesYResumenReportes
};
