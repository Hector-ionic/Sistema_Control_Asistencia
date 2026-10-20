// src/modules/acceso/utils/reglasAcceso.js
import { ROLES_VALIDOS } from "../mocks/datosPruebaAcceso.js";

/**
 * Obtiene la fecha/hora actual en la zona horaria oficial America/La_Paz (UTC-04:00).
 */
export function obtenerFechaHoraLaPaz(fechaBase = new Date()) {
  const f = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(fechaBase);
  return f.replace(" ", "T") + "-04:00";
}

/**
 * Normaliza una cadena de hora ('HH:mm' o 'HH:mm:ss') al formato C# TimeSpan ('HH:mm:ss').
 */
export function normalizarHoraTimeSpan(valor) {
  const texto = String(valor ?? "").trim();
  if (!texto) return "";
  const match = texto.match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
  if (!match) return "";
  const [, hh, mm, ss = "00"] = match;
  return `${hh}:${mm}:${ss}`;
}

/**
 * Convierte 'HH:mm:ss' o 'HH:mm' a minutos desde medianoche para comparar horarios.
 */
export function horaAMinutos(valor) {
  const normalizada = normalizarHoraTimeSpan(valor);
  if (!normalizada) return -1;
  const [hh, mm] = normalizada.split(":").map(Number);
  return hh * 60 + mm;
}

/**
 * Valida las credenciales de inicio de sesión (`sesion`).
 */
export function validarCredencialesSesion(datos = {}) {
  const errores = {};
  const usuario = String(datos.usuario ?? "").trim();
  const password = String(datos.password ?? "");

  if (!usuario) {
    errores.usuario = "Ingrese su nombre de usuario.";
  } else if (usuario.length > 50) {
    errores.usuario = "El usuario no puede exceder 50 caracteres.";
  }

  if (!password) {
    errores.password = "Ingrese su contraseña.";
  }

  return {
    valido: Object.keys(errores).length === 0,
    errores,
    datosNormalizados: {
      usuario,
      password
    }
  };
}

/**
 * Valida el autorregistro público de encargado (`registro-encargado`).
 * Según BACKEND-PARA-LOS-5-MODULOS.md:
 * - Solo `sesion` y `registro-encargado` son públicos.
 * - El autorregistro solo crea Encargado.
 * - Contraseña mínima de 8 caracteres.
 */
export function validarRegistroEncargado(datos = {}, usuariosExistentes = []) {
  const errores = {};
  const usuario = String(datos.usuario ?? "").trim();
  const password = String(datos.password ?? "");
  const confirmarPassword =
    datos.confirmarPassword !== undefined ? String(datos.confirmarPassword) : password;

  if (!usuario) {
    errores.usuario = "El nombre de usuario es obligatorio.";
  } else if (usuario.length < 3 || usuario.length > 50) {
    errores.usuario = "El nombre de usuario debe tener entre 3 y 50 caracteres.";
  } else if (/\s/.test(usuario)) {
    errores.usuario = "El nombre de usuario no debe contener espacios.";
  }

  if (!password || password.length < 8) {
    errores.password = "La contraseña debe tener al menos 8 caracteres.";
  }

  if (datos.confirmarPassword !== undefined && password !== confirmarPassword) {
    errores.confirmarPassword = "Las contraseñas no coinciden.";
  }

  const yaExiste = usuariosExistentes.some(
    (u) => String(u.nombreUsuario || "").toLowerCase() === usuario.toLowerCase()
  );
  if (yaExiste) {
    errores.usuario = `El usuario '${usuario}' ya está registrado en el sistema.`;
  }

  return {
    valido: Object.keys(errores).length === 0,
    errores,
    datosNormalizados: {
      usuario,
      password
    }
  };
}

/**
 * Calcula los permisos predeterminados según el rol de C#.
 */
export function permisosPorDefectoSegunRol(rol) {
  if (rol === "SuperAdmin") {
    return {
      permisoPersonal: true,
      permisoAsistencia: true,
      permisoViaticos: true,
      permisoReportes: true,
      permisoConfiguracion: true,
      permisoProyectos: true
    };
  }
  if (rol === "Admin") {
    return {
      permisoPersonal: true,
      permisoAsistencia: true,
      permisoViaticos: true,
      permisoReportes: true,
      permisoConfiguracion: false,
      permisoProyectos: true
    };
  }
  return {
    permisoPersonal: false,
    permisoAsistencia: true,
    permisoViaticos: false,
    permisoReportes: false,
    permisoConfiguracion: false,
    permisoProyectos: false
  };
}

/**
 * Valida la creación o edición de una cuenta (`usuarios.guardar`).
 * Reglas de BACKEND-PARA-LOS-5-MODULOS.md:
 * - Formato: `{ usuario: { idUsuario, nombreUsuario, rol, activo }, password }`
 * - Para crear un usuario usar `idUsuario: 0`.
 * - `password` vacío conserva la clave al editar.
 * - Solo el propietario/SuperAdmin designa administradores (`Admin` / `SuperAdmin`).
 */
export function validarUsuarioGuardar(
  entrada = {},
  usuariosExistentes = [],
  rolSesionActual = "SuperAdmin"
) {
  const errores = {};
  const nodoUsuario = entrada.usuario && typeof entrada.usuario === "object" ? entrada.usuario : entrada;
  const idUsuario = Number(nodoUsuario.idUsuario || 0);
  const nombreUsuario = String(nodoUsuario.nombreUsuario ?? "").trim();
  const rol = String(nodoUsuario.rol || "Encargado").trim();
  const activo = nodoUsuario.activo !== undefined ? Boolean(nodoUsuario.activo) : true;
  const password = String(entrada.password ?? "");

  if (rolSesionActual !== "SuperAdmin" && rolSesionActual !== "Admin") {
    errores.permisos = "Su rol no tiene autorización para administrar cuentas de usuario.";
  }

  if (!nombreUsuario || nombreUsuario.length < 3) {
    errores.nombreUsuario = "El nombre de usuario debe tener al menos 3 caracteres.";
  } else if (nombreUsuario.length > 50) {
    errores.nombreUsuario = "El nombre de usuario no puede superar 50 caracteres.";
  } else if (/\s/.test(nombreUsuario)) {
    errores.nombreUsuario = "El nombre de usuario no debe contener espacios.";
  }

  if (!ROLES_VALIDOS.includes(rol)) {
    errores.rol = `El rol debe ser uno de: ${ROLES_VALIDOS.join(", ")}.`;
  }

  // Solo SuperAdmin puede crear o editar cuentas Admin o SuperAdmin
  if (rolSesionActual !== "SuperAdmin" && (rol === "SuperAdmin" || rol === "Admin")) {
    errores.rol = "Solo el SuperAdmin puede designar o modificar cuentas Admin o SuperAdmin.";
  }

  const usuarioExistente = usuariosExistentes.find(
    (u) => Number(u.idUsuario) === idUsuario
  );

  if (
    rolSesionActual !== "SuperAdmin" &&
    usuarioExistente &&
    (usuarioExistente.rol === "SuperAdmin" || usuarioExistente.rol === "Admin")
  ) {
    errores.permisos = "Solo el SuperAdmin puede modificar una cuenta de Administrador.";
  }

  const duplicado = usuariosExistentes.find(
    (u) =>
      String(u.nombreUsuario || "").toLowerCase() === nombreUsuario.toLowerCase() &&
      Number(u.idUsuario) !== idUsuario
  );
  if (duplicado) {
    errores.nombreUsuario = `Ya existe otra cuenta con el nombre '${nombreUsuario}'.`;
  }

  // Al crear (idUsuario === 0) la contraseña es obligatoria; al editar (idUsuario > 0) vacía conserva la actual
  if (idUsuario === 0) {
    if (!password || password.length < 6) {
      errores.password = "Para una cuenta nueva, ingrese una contraseña de al menos 6 caracteres.";
    }
  } else if (password && password.length < 6) {
    errores.password = "Si desea cambiar la contraseña, debe tener al menos 6 caracteres (o déjela vacía para conservar la actual).";
  }

  // Evitar dejar el sistema sin ningún SuperAdmin activo
  if (
    idUsuario > 0 &&
    usuarioExistente?.rol === "SuperAdmin" &&
    (!activo || rol !== "SuperAdmin")
  ) {
    const otrosSuperAdminActivos = usuariosExistentes.filter(
      (u) =>
        Number(u.idUsuario) !== idUsuario &&
        u.rol === "SuperAdmin" &&
        u.activo === true
    );
    if (otrosSuperAdminActivos.length === 0) {
      errores.activo = "No se puede desactivar ni degradar al único SuperAdmin activo del sistema.";
    }
  }

  const basePermisos = permisosPorDefectoSegunRol(rol);
  const usuarioNormalizado = {
    idUsuario: idUsuario > 0 ? idUsuario : 0,
    nombreUsuario,
    rol,
    activo,
    permisoPersonal:
      rol === "SuperAdmin"
        ? true
        : nodoUsuario.permisoPersonal !== undefined
        ? Boolean(nodoUsuario.permisoPersonal)
        : basePermisos.permisoPersonal,
    permisoAsistencia:
      rol === "SuperAdmin"
        ? true
        : nodoUsuario.permisoAsistencia !== undefined
        ? Boolean(nodoUsuario.permisoAsistencia)
        : basePermisos.permisoAsistencia,
    permisoViaticos:
      rol === "SuperAdmin"
        ? true
        : nodoUsuario.permisoViaticos !== undefined
        ? Boolean(nodoUsuario.permisoViaticos)
        : basePermisos.permisoViaticos,
    permisoReportes:
      rol === "SuperAdmin"
        ? true
        : nodoUsuario.permisoReportes !== undefined
        ? Boolean(nodoUsuario.permisoReportes)
        : basePermisos.permisoReportes,
    permisoConfiguracion:
      rol === "SuperAdmin"
        ? true
        : nodoUsuario.permisoConfiguracion !== undefined
        ? Boolean(nodoUsuario.permisoConfiguracion)
        : basePermisos.permisoConfiguracion,
    permisoProyectos:
      rol === "SuperAdmin"
        ? true
        : nodoUsuario.permisoProyectos !== undefined
        ? Boolean(nodoUsuario.permisoProyectos)
        : basePermisos.permisoProyectos
  };

  return {
    valido: Object.keys(errores).length === 0,
    errores,
    datosNormalizados: {
      usuario: usuarioNormalizado,
      password
    }
  };
}

/**
 * Valida la configuración global (`configuracion.guardar`).
 * Regla de BACKEND-PARA-LOS-5-MODULOS.md:
 * - Enviar el objeto previamente leído con `horaEntradaEsperada`, `horaSalidaEsperada`,
 *   `toleranciaMinutos`, `nombreInstitucion`, `temaOscuro`.
 * - Solo `SuperAdmin` puede guardar configuración.
 */
export function validarConfiguracionGuardar(
  configuracionActual = {},
  cambios = {},
  rolSesionActual = "SuperAdmin"
) {
  const errores = {};
  if (rolSesionActual !== "SuperAdmin") {
    errores.permisos = "Solo SuperAdmin tiene autorización para modificar la configuración del sistema.";
  }

  const combinado = {
    ...configuracionActual,
    ...cambios
  };

  const nombreInstitucion = String(combinado.nombreInstitucion ?? "").trim();
  const horaEntradaEsperada = normalizarHoraTimeSpan(combinado.horaEntradaEsperada);
  const horaSalidaEsperada = normalizarHoraTimeSpan(combinado.horaSalidaEsperada);
  const toleranciaMinutos = Number(combinado.toleranciaMinutos);
  const temaOscuro = Boolean(combinado.temaOscuro);

  if (!nombreInstitucion) {
    errores.nombreInstitucion = "El nombre de la institución o sede es obligatorio.";
  } else if (nombreInstitucion.length > 120) {
    errores.nombreInstitucion = "El nombre de la institución no puede exceder 120 caracteres.";
  }

  if (!horaEntradaEsperada) {
    errores.horaEntradaEsperada = "Ingrese una hora de entrada válida (HH:mm o HH:mm:ss).";
  }

  if (!horaSalidaEsperada) {
    errores.horaSalidaEsperada = "Ingrese una hora de salida válida (HH:mm o HH:mm:ss).";
  }

  if (
    horaEntradaEsperada &&
    horaSalidaEsperada &&
    horaAMinutos(horaSalidaEsperada) <= horaAMinutos(horaEntradaEsperada)
  ) {
    errores.horaSalidaEsperada =
      "La hora de salida esperada debe ser posterior a la hora de entrada esperada.";
  }

  if (
    !Number.isInteger(toleranciaMinutos) ||
    toleranciaMinutos < 0 ||
    toleranciaMinutos > 180
  ) {
    errores.toleranciaMinutos =
      "La tolerancia de ingreso debe ser un número entero entre 0 y 180 minutos.";
  }

  return {
    valido: Object.keys(errores).length === 0,
    errores,
    datosNormalizados: {
      ...combinado,
      id: Number(combinado.id || 1),
      horaEntradaEsperada,
      horaSalidaEsperada,
      toleranciaMinutos: Number.isInteger(toleranciaMinutos) ? toleranciaMinutos : 0,
      nombreInstitucion,
      temaOscuro
    }
  };
}

/**
 * Valida la creación o edición de un área/departamento (`departamentos.guardar`).
 * Formato C#: `{ idDepartamento: 0, nombre, descripcion }`.
 */
export function validarDepartamentoGuardar(
  datos = {},
  departamentosExistentes = [],
  rolSesionActual = "SuperAdmin"
) {
  const errores = {};
  if (rolSesionActual !== "SuperAdmin" && rolSesionActual !== "Admin") {
    errores.permisos = "Solo Administradores pueden registrar o modificar áreas/departamentos.";
  }

  const idDepartamento = Number(datos.idDepartamento || 0);
  const nombre = String(datos.nombre ?? "").trim();
  const descripcion = String(datos.descripcion ?? "").trim();

  if (!nombre || nombre.length < 2) {
    errores.nombre = "El nombre del área/departamento debe tener al menos 2 caracteres.";
  } else if (nombre.length > 100) {
    errores.nombre = "El nombre del área no puede superar 100 caracteres.";
  }

  if (descripcion.length > 250) {
    errores.descripcion = "La descripción no puede superar 250 caracteres.";
  }

  const duplicado = departamentosExistentes.find(
    (d) =>
      String(d.nombre || "").toLowerCase() === nombre.toLowerCase() &&
      Number(d.idDepartamento) !== idDepartamento
  );
  if (duplicado) {
    errores.nombre = `Ya existe un área registrada con el nombre '${nombre}'.`;
  }

  return {
    valido: Object.keys(errores).length === 0,
    errores,
    datosNormalizados: {
      idDepartamento: idDepartamento > 0 ? idDepartamento : 0,
      nombre,
      descripcion
    }
  };
}
