// src/modules/acceso/services/accesoService.js
import {
  mockUsuarios,
  mockConfiguracion,
  mockDepartamentos,
  mockMarcas,
  mockAuditoriaAcceso
} from "../mocks/datosPruebaAcceso.js";
import {
  obtenerFechaHoraLaPaz,
  validarCredencialesSesion,
  validarRegistroEncargado,
  validarUsuarioGuardar,
  validarConfiguracionGuardar,
  validarDepartamentoGuardar,
  permisosPorDefectoSegunRol
} from "../utils/reglasAcceso.js";

/**
 * Reglas de BACKEND-PARA-LOS-5-MODULOS.md:
 * - Guardar el token solo en memoria.
 * - No confiar en `rolUsuario`, `x-rol-usuario` ni `x-usuario`: la autoridad es la sesión validada por el servidor.
 * - Solo `sesion` y `registro-encargado` son públicos. El autorregistro solo crea Encargado.
 * - Roles exactos: `SuperAdmin`, `Admin`, `Encargado`.
 * - Cerrar sesión elimina el token del estado del frontend. No hay endpoint de renovación; al vencer, volver al ingreso.
 */
let tokenAccesoEnMemoria = "";
let usuarioAccesoEnMemoria = null;
let expiraEnTimestamp = 0;
let sesionMarcadaVencida = false;

let memoriaContratoAcceso = crearMemoriaInicialAcceso();

function crearMemoriaInicialAcceso() {
  return {
    usuarios: structuredClone(mockUsuarios),
    clavesPorId: new Map(
      mockUsuarios.map((u) => [Number(u.idUsuario), "clave-registrada"])
    ),
    configuracion: structuredClone(mockConfiguracion),
    departamentos: structuredClone(mockDepartamentos),
    marcas: structuredClone(mockMarcas),
    auditoria: structuredClone(mockAuditoriaAcceso)
  };
}

export function obtenerTokenAccesoMemoria() {
  return tokenAccesoEnMemoria;
}

export function obtenerSesionAccesoMemoria() {
  return usuarioAccesoEnMemoria;
}

export function obtenerExpiracionSesionMemoria() {
  return expiraEnTimestamp;
}

export function establecerSesionAccesoMemoria(
  nuevoToken = "",
  usuarioActual = null,
  expiresInSegundos = 28800
) {
  tokenAccesoEnMemoria = String(nuevoToken || "");
  usuarioAccesoEnMemoria = usuarioActual;
  sesionMarcadaVencida = false;
  expiraEnTimestamp = tokenAccesoEnMemoria
    ? Date.now() + Number(expiresInSegundos || 28800) * 1000
    : 0;
}

export function cerrarSesionAccesoMemoria() {
  tokenAccesoEnMemoria = "";
  usuarioAccesoEnMemoria = null;
  expiraEnTimestamp = 0;
  sesionMarcadaVencida = false;
}

/**
 * Permite simular el vencimiento inmediato de la sesión activa para comprobar el criterio de aceptación:
 * "una sesión vencida vuelve al acceso".
 */
export function forzarVencimientoSesionMemoria() {
  sesionMarcadaVencida = true;
  expiraEnTimestamp = Date.now() - 1000;
}

export function reiniciarMemoriaSimuladaAcceso() {
  memoriaContratoAcceso = crearMemoriaInicialAcceso();
  return memoriaContratoAcceso;
}

/**
 * Función oficial `llamar` definida en BACKEND-PARA-LOS-5-MODULOS.md.
 * Llama a `POST /api/backend` con `{ operacion, datos }` y `Authorization: Bearer <accessToken>`.
 * Nunca envía `x-rol-usuario` ni `x-usuario`.
 */
export async function llamar(
  operacion,
  datos = {},
  accessToken = tokenAccesoEnMemoria,
  opcionesExtra = {}
) {
  const { fetchImpl = fetch } = opcionesExtra;
  const esPublica = operacion === "sesion" || operacion === "registro-encargado";

  if (!esPublica && sesionMarcadaVencida) {
    cerrarSesionAccesoMemoria();
    throw Object.assign(
      new Error("La sesión ha vencido. Vuelva a iniciar sesión."),
      { status: 401 }
    );
  }

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
      cerrarSesionAccesoMemoria();
    }
    throw Object.assign(
      new Error(resultado?.mensaje || "No se pudo completar la operación"),
      { status: respuesta.status, errores: resultado?.errores }
    );
  }

  if (operacion === "sesion" && resultado?.accessToken) {
    tokenAccesoEnMemoria = String(resultado.accessToken);
    sesionMarcadaVencida = false;
    expiraEnTimestamp =
      Date.now() + Number(resultado.expiresIn || 28800) * 1000;
  } else if (
    operacion === "sesion.actual" &&
    resultado &&
    typeof resultado === "object"
  ) {
    usuarioAccesoEnMemoria = resultado;
  }

  return resultado;
}

/**
 * Simulador del contrato en memoria (sin localStorage) para cuando el servidor C#
 * no está disponible o durante la ejecución de pruebas automatizadas.
 */
export function ejecutarOperacionAccesoEnMemoria(
  operacion,
  datos = {},
  accessToken = tokenAccesoEnMemoria
) {
  const esPublica = operacion === "sesion" || operacion === "registro-encargado";

  if (!esPublica) {
    if (!accessToken || sesionMarcadaVencida || (expiraEnTimestamp > 0 && Date.now() > expiraEnTimestamp)) {
      cerrarSesionAccesoMemoria();
      throw Object.assign(
        new Error("Inicie sesión para consultar o modificar datos."),
        { status: 401 }
      );
    }
  }

  const registrarEventoAuditoria = (accion, detalle, usuarioAutor) => {
    const autor =
      usuarioAutor ||
      usuarioAccesoEnMemoria?.nombreUsuario ||
      "sistema";
    const maxId = memoriaContratoAcceso.auditoria.reduce(
      (max, item) => Math.max(max, Number(item.idLog) || 0),
      0
    );
    const nuevoEvento = {
      idLog: maxId + 1,
      fecha: obtenerFechaHoraLaPaz(),
      usuario: autor,
      accion,
      detalle
    };
    memoriaContratoAcceso.auditoria = [
      nuevoEvento,
      ...memoriaContratoAcceso.auditoria
    ].slice(0, 1000);
    return nuevoEvento;
  };

  // --- 1. Operación pública: `sesion` ---
  if (operacion === "sesion") {
    const validacion = validarCredencialesSesion(datos);
    if (!validacion.valido) {
      throw Object.assign(
        new Error(Object.values(validacion.errores)[0]),
        { status: 400, errores: validacion.errores }
      );
    }

    const { usuario, password } = validacion.datosNormalizados;
    let cuenta = memoriaContratoAcceso.usuarios.find(
      (u) => u.nombreUsuario.toLowerCase() === usuario.toLowerCase()
    );

    // Atajos de prueba ("superadmin", "admin", "encargado") en modo memoria
    if (!cuenta) {
      if (usuario.toLowerCase() === "superadmin") {
        cuenta = memoriaContratoAcceso.usuarios.find((u) => u.rol === "SuperAdmin" && u.activo);
      } else if (usuario.toLowerCase() === "admin") {
        cuenta = memoriaContratoAcceso.usuarios.find((u) => u.rol === "Admin" && u.activo);
      } else if (usuario.toLowerCase() === "encargado") {
        cuenta = memoriaContratoAcceso.usuarios.find((u) => u.rol === "Encargado" && u.activo);
      }
    }

    if (!cuenta) {
      throw Object.assign(
        new Error("Usuario o contraseña incorrectos."),
        { status: 401 }
      );
    }

    if (!cuenta.activo) {
      throw Object.assign(
        new Error(`La cuenta '${cuenta.nombreUsuario}' está desactivada. Contacte al SuperAdmin.`),
        { status: 403 }
      );
    }

    if (!password) {
      throw Object.assign(
        new Error("Usuario o contraseña incorrectos."),
        { status: 401 }
      );
    }

    const tokenGenerado = `mem-m01-${cuenta.rol.toLowerCase()}-${cuenta.idUsuario}-${Date.now()}`;
    establecerSesionAccesoMemoria(tokenGenerado, structuredClone(cuenta), 28800);
    registrarEventoAuditoria(
      "sesion",
      `Inicio de sesión correcto con rol ${cuenta.rol}.`,
      cuenta.nombreUsuario
    );

    return {
      tokenType: "Bearer",
      accessToken: tokenGenerado,
      expiresIn: 28800
    };
  }

  // --- 2. Operación pública: `registro-encargado` ---
  if (operacion === "registro-encargado") {
    const validacion = validarRegistroEncargado(
      datos,
      memoriaContratoAcceso.usuarios
    );
    if (!validacion.valido) {
      throw Object.assign(
        new Error(Object.values(validacion.errores)[0]),
        { status: 400, errores: validacion.errores }
      );
    }

    const maxId = memoriaContratoAcceso.usuarios.reduce(
      (max, u) => Math.max(max, Number(u.idUsuario) || 0),
      0
    );
    const nuevoEncargado = {
      idUsuario: maxId + 1,
      nombreUsuario: validacion.datosNormalizados.usuario,
      rol: "Encargado",
      activo: true,
      ...permisosPorDefectoSegunRol("Encargado")
    };

    memoriaContratoAcceso.usuarios.push(nuevoEncargado);
    memoriaContratoAcceso.clavesPorId.set(
      nuevoEncargado.idUsuario,
      validacion.datosNormalizados.password
    );
    registrarEventoAuditoria(
      "usuarios.autoregistro-encargado",
      "Cuenta de encargado creada por su titular.",
      nuevoEncargado.nombreUsuario
    );

    return structuredClone(nuevoEncargado);
  }

  // Verificar que la cuenta de la sesión siga existiendo y activa en cada operación (regla C#)
  const cuentaSesion =
    memoriaContratoAcceso.usuarios.find(
      (u) => Number(u.idUsuario) === Number(usuarioAccesoEnMemoria?.idUsuario)
    ) ||
    usuarioAccesoEnMemoria || {
      idUsuario: 1,
      nombreUsuario: "hector.manuel",
      rol: "SuperAdmin",
      activo: true
    };

  if (!cuentaSesion.activo) {
    cerrarSesionAccesoMemoria();
    throw Object.assign(
      new Error("Su cuenta fue desactivada. Sesión finalizada."),
      { status: 401 }
    );
  }

  const rolActual = cuentaSesion.rol || "SuperAdmin";

  // --- 3. `sesion.actual` ---
  if (operacion === "sesion.actual") {
    usuarioAccesoEnMemoria = structuredClone(cuentaSesion);
    return structuredClone(cuentaSesion);
  }

  // --- 4. `usuarios.listar` ---
  if (operacion === "usuarios.listar") {
    if (rolActual !== "SuperAdmin" && rolActual !== "Admin") {
      throw Object.assign(
        new Error("No tiene permisos para listar las cuentas del sistema."),
        { status: 403 }
      );
    }
    return structuredClone(memoriaContratoAcceso.usuarios);
  }

  // --- 5. `usuarios.guardar` ---
  if (operacion === "usuarios.guardar") {
    if (rolActual !== "SuperAdmin" && rolActual !== "Admin") {
      throw Object.assign(
        new Error("Su rol no tiene permiso para crear ni modificar cuentas de usuario."),
        { status: 403 }
      );
    }

    const validacion = validarUsuarioGuardar(
      datos,
      memoriaContratoAcceso.usuarios,
      rolActual
    );
    if (!validacion.valido) {
      const esErrorPermiso = Boolean(
        validacion.errores.permisos ||
          (rolActual !== "SuperAdmin" && validacion.errores.rol)
      );
      throw Object.assign(
        new Error(Object.values(validacion.errores)[0]),
        { status: esErrorPermiso ? 403 : 400, errores: validacion.errores }
      );
    }

    const { usuario: uGuardar, password } = validacion.datosNormalizados;

    if (uGuardar.idUsuario > 0) {
      const idx = memoriaContratoAcceso.usuarios.findIndex(
        (u) => Number(u.idUsuario) === uGuardar.idUsuario
      );
      if (idx === -1) {
        throw Object.assign(
          new Error(`El usuario con idUsuario ${uGuardar.idUsuario} no existe.`),
          { status: 404 }
        );
      }
      const actualizado = {
        ...memoriaContratoAcceso.usuarios[idx],
        ...uGuardar
      };
      memoriaContratoAcceso.usuarios[idx] = actualizado;
      if (password) {
        memoriaContratoAcceso.clavesPorId.set(actualizado.idUsuario, password);
      }
      if (Number(usuarioAccesoEnMemoria?.idUsuario) === actualizado.idUsuario) {
        usuarioAccesoEnMemoria = structuredClone(actualizado);
      }
      registrarEventoAuditoria(
        "usuarios.guardar",
        `Usuario ${actualizado.idUsuario}: ${actualizado.nombreUsuario} (${actualizado.rol}, ${
          actualizado.activo ? "activo" : "inactivo"
        }${password ? ", clave actualizada" : ", clave conservada"})`
      );
      return structuredClone(actualizado);
    }

    const maxId = memoriaContratoAcceso.usuarios.reduce(
      (max, u) => Math.max(max, Number(u.idUsuario) || 0),
      0
    );
    const creado = {
      ...uGuardar,
      idUsuario: maxId + 1
    };
    memoriaContratoAcceso.usuarios.push(creado);
    memoriaContratoAcceso.clavesPorId.set(creado.idUsuario, password);
    registrarEventoAuditoria(
      "usuarios.guardar",
      `Usuario ${creado.idUsuario}: ${creado.nombreUsuario} (${creado.rol}, activo)`
    );
    return structuredClone(creado);
  }

  // --- 6. `usuarios.eliminar` ---
  if (operacion === "usuarios.eliminar") {
    if (rolActual !== "SuperAdmin") {
      throw Object.assign(
        new Error("Solo SuperAdmin puede eliminar cuentas de usuario."),
        { status: 403 }
      );
    }
    const idEliminar = Number(datos?.id || datos?.idUsuario || 0);
    const idx = memoriaContratoAcceso.usuarios.findIndex(
      (u) => Number(u.idUsuario) === idEliminar
    );
    if (idx === -1) {
      throw Object.assign(
        new Error(`El usuario #${idEliminar} no existe.`),
        { status: 404 }
      );
    }
    const objetivo = memoriaContratoAcceso.usuarios[idx];
    if (Number(cuentaSesion.idUsuario) === idEliminar) {
      throw Object.assign(
        new Error("No puede eliminar su propia cuenta en sesión activa."),
        { status: 400 }
      );
    }
    if (objetivo.rol === "SuperAdmin") {
      const otrosSuperAdmin = memoriaContratoAcceso.usuarios.filter(
        (u) => Number(u.idUsuario) !== idEliminar && u.rol === "SuperAdmin" && u.activo
      );
      if (otrosSuperAdmin.length === 0) {
        throw Object.assign(
          new Error("No se puede eliminar al único SuperAdmin activo del sistema."),
          { status: 400 }
        );
      }
    }

    const [eliminado] = memoriaContratoAcceso.usuarios.splice(idx, 1);
    memoriaContratoAcceso.clavesPorId.delete(idEliminar);
    registrarEventoAuditoria(
      "usuarios.eliminar",
      `Cuenta eliminada: #${eliminado.idUsuario} (${eliminado.nombreUsuario}).`
    );
    return { eliminado: true, id: idEliminar };
  }

  // --- 7. `configuracion.obtener` ---
  if (operacion === "configuracion.obtener") {
    return structuredClone(memoriaContratoAcceso.configuracion);
  }

  // --- 8. `configuracion.guardar` ---
  if (operacion === "configuracion.guardar") {
    if (rolActual !== "SuperAdmin") {
      throw Object.assign(
        new Error("Solo SuperAdmin puede modificar la configuración del sistema."),
        { status: 403 }
      );
    }
    const validacion = validarConfiguracionGuardar(
      memoriaContratoAcceso.configuracion,
      datos,
      rolActual
    );
    if (!validacion.valido) {
      throw Object.assign(
        new Error(Object.values(validacion.errores)[0]),
        { status: 400, errores: validacion.errores }
      );
    }

    memoriaContratoAcceso.configuracion = structuredClone(
      validacion.datosNormalizados
    );
    registrarEventoAuditoria(
      "configuracion.guardar",
      `Institución: '${memoriaContratoAcceso.configuracion.nombreInstitucion}' | Horario: ${memoriaContratoAcceso.configuracion.horaEntradaEsperada} a ${memoriaContratoAcceso.configuracion.horaSalidaEsperada} (Tolerancia ${memoriaContratoAcceso.configuracion.toleranciaMinutos} min).`
    );
    return structuredClone(memoriaContratoAcceso.configuracion);
  }

  // --- 9. `departamentos.listar` ---
  if (operacion === "departamentos.listar") {
    return structuredClone(
      memoriaContratoAcceso.departamentos.map(
        ({ idDepartamento, nombre, descripcion }) => ({
          idDepartamento,
          nombre,
          descripcion
        })
      )
    );
  }

  // --- 10. `departamentos.guardar` ---
  if (operacion === "departamentos.guardar") {
    if (rolActual !== "SuperAdmin" && rolActual !== "Admin") {
      throw Object.assign(
        new Error("Solo Administradores pueden guardar áreas o departamentos."),
        { status: 403 }
      );
    }
    const validacion = validarDepartamentoGuardar(
      datos,
      memoriaContratoAcceso.departamentos,
      rolActual
    );
    if (!validacion.valido) {
      throw Object.assign(
        new Error(Object.values(validacion.errores)[0]),
        { status: 400, errores: validacion.errores }
      );
    }

    const { idDepartamento, nombre, descripcion } = validacion.datosNormalizados;
    if (idDepartamento > 0) {
      const idx = memoriaContratoAcceso.departamentos.findIndex(
        (d) => Number(d.idDepartamento) === idDepartamento
      );
      if (idx === -1) {
        throw Object.assign(
          new Error(`El área #${idDepartamento} no existe.`),
          { status: 404 }
        );
      }
      memoriaContratoAcceso.departamentos[idx] = {
        ...memoriaContratoAcceso.departamentos[idx],
        nombre,
        descripcion
      };
      registrarEventoAuditoria(
        "departamentos.guardar",
        `Área actualizada #${idDepartamento}: ${nombre}`
      );
      return { idDepartamento, nombre, descripcion };
    }

    const maxId = memoriaContratoAcceso.departamentos.reduce(
      (max, d) => Math.max(max, Number(d.idDepartamento) || 0),
      0
    );
    const nuevoDep = {
      idDepartamento: maxId + 1,
      nombre,
      descripcion,
      referenciadoPorPersonal: false
    };
    memoriaContratoAcceso.departamentos.push(nuevoDep);
    registrarEventoAuditoria(
      "departamentos.guardar",
      `Área creada #${nuevoDep.idDepartamento}: ${nuevoDep.nombre}`
    );
    return {
      idDepartamento: nuevoDep.idDepartamento,
      nombre: nuevoDep.nombre,
      descripcion: nuevoDep.descripcion
    };
  }

  // --- 11. `departamentos.eliminar` ---
  if (operacion === "departamentos.eliminar") {
    if (rolActual !== "SuperAdmin" && rolActual !== "Admin") {
      throw Object.assign(
        new Error("Solo Administradores pueden eliminar áreas o departamentos."),
        { status: 403 }
      );
    }
    const idEliminar = Number(datos?.id || datos?.idDepartamento || 0);
    const idx = memoriaContratoAcceso.departamentos.findIndex(
      (d) => Number(d.idDepartamento) === idEliminar
    );
    if (idx === -1) {
      throw Object.assign(
        new Error(`El área #${idEliminar} no existe.`),
        { status: 404 }
      );
    }
    const dep = memoriaContratoAcceso.departamentos[idx];
    if (dep.idDepartamento === 1 || dep.referenciadoPorPersonal) {
      throw Object.assign(
        new Error(
          `No se puede eliminar el área '${dep.nombre}' porque está referenciada por registros de personal.`
        ),
        { status: 409 }
      );
    }
    memoriaContratoAcceso.departamentos.splice(idx, 1);
    registrarEventoAuditoria(
      "departamentos.eliminar",
      `Área eliminada #${dep.idDepartamento}: ${dep.nombre}`
    );
    return { eliminado: true, id: idEliminar };
  }

  // --- 12. `marcas.listar` ---
  if (operacion === "marcas.listar") {
    return structuredClone(memoriaContratoAcceso.marcas);
  }

  // --- 13. `auditoria.listar` ---
  if (operacion === "auditoria.listar") {
    if (rolActual !== "SuperAdmin") {
      throw Object.assign(
        new Error("Solo SuperAdmin puede consultar el registro de auditoría del sistema."),
        { status: 403 }
      );
    }
    return structuredClone(memoriaContratoAcceso.auditoria.slice(0, 1000));
  }

  throw Object.assign(
    new Error(`Operación '${operacion}' no disponible en el Módulo 01.`),
    { status: 400 }
  );
}

/**
 * Ejecuta una operación del Módulo 01 contra `POST /api/backend` o contra el simulador en memoria.
 */
export async function ejecutarOperacionModulo01(
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
    return ejecutarOperacionAccesoEnMemoria(operacion, datos, tokenAccesoEnMemoria);
  }

  return llamar(operacion, datos, tokenAccesoEnMemoria);
}

/**
 * Carga las colecciones del Módulo 01 según los permisos de la sesión activa.
 */
export async function cargarColeccionesModulo01(opciones = {}) {
  const [configuracion, departamentos, marcas] = await Promise.all([
    ejecutarOperacionModulo01("configuracion.obtener", {}, opciones),
    ejecutarOperacionModulo01("departamentos.listar", {}, opciones),
    ejecutarOperacionModulo01("marcas.listar", {}, opciones)
  ]);

  let usuarios = [];
  try {
    usuarios = await ejecutarOperacionModulo01("usuarios.listar", {}, opciones);
  } catch (err) {
    if (err.status === 401) throw err;
    usuarios = [];
  }

  let auditoria = [];
  try {
    auditoria = await ejecutarOperacionModulo01("auditoria.listar", {}, opciones);
  } catch (err) {
    if (err.status === 401) throw err;
    auditoria = [];
  }

  return {
    configuracion: configuracion || mockConfiguracion,
    departamentos: Array.isArray(departamentos) ? departamentos : [],
    marcas: Array.isArray(marcas) ? marcas : [],
    usuarios: Array.isArray(usuarios) ? usuarios : [],
    auditoria: Array.isArray(auditoria) ? auditoria : []
  };
}
