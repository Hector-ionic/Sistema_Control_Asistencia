// src/modules/acceso/mocks/datosPruebaAcceso.js

/**
 * Datos semilla para el simulador de contrato en memoria del Módulo 01 (Acceso y administración).
 * Sigue exactamente los nombres de campos del contrato C# / PostgreSQL (esquema `registro`):
 * - Usuarios: { idUsuario, nombreUsuario, rol, activo, permisoPersonal, permisoAsistencia, permisoViaticos, permisoReportes, permisoConfiguracion, permisoProyectos }
 * - Configuracion: { id, horaEntradaEsperada, horaSalidaEsperada, toleranciaMinutos, nombreInstitucion, temaOscuro }
 * - Departamentos: { idDepartamento, nombre, descripcion }
 * - Marcas: { idMarca, nombreMarca }
 * - Auditoria: { idLog, fecha, usuario, accion, detalle }
 */

export const ROLES_VALIDOS = ["SuperAdmin", "Admin", "Encargado"];

export const DESCRIPCION_ROLES = [
  {
    rol: "SuperAdmin",
    titulo: "Superadministrador (Propietario)",
    resumen:
      "Control total del sistema: designa administradores, elimina cuentas, modifica la configuración institucional de horarios y consulta la auditoría completa.",
    operacionesPermitidas: [
      "Inicio y cierre de sesi?n",
      "Autorregistro de cuenta de encargado",
      "Consulta de horarios predeterminados",
      "Consulta de ?reas y marcas"
    ]
  },
  {
    rol: "Admin",
    titulo: "Administrador",
    resumen:
      "Gestiona operadores/encargados, consulta catálogos de áreas, marcas y horarios predeterminados, y administra operaciones de personal, asistencia y proyectos.",
    operacionesPermitidas: [
      "sesion",
      "sesion.actual",
      "usuarios.listar",
      "usuarios.guardar (Encargado)",
      "configuracion.obtener",
      "departamentos.listar",
      "departamentos.guardar",
      "marcas.listar"
    ]
  },
  {
    rol: "Encargado",
    titulo: "Operador / Encargado",
    resumen:
      "Opera el registro diario de asistencia, solicita correcciones y consulta la configuración básica y catálogos activos sin alterar cuentas ni parámetros globales.",
    operacionesPermitidas: [
      "sesion",
      "sesion.actual",
      "registro-encargado (autorregistro público)",
      "configuracion.obtener",
      "departamentos.listar",
      "marcas.listar"
    ]
  }
];

export const mockUsuarios = [
  {
    idUsuario: 4,
    nombreUsuario: "hector.manuel",
    rol: "SuperAdmin",
    activo: true,
    permisoPersonal: true,
    permisoAsistencia: true,
    permisoViaticos: true,
    permisoReportes: true,
    permisoConfiguracion: true,
    permisoProyectos: true
  },
  {
    idUsuario: 7,
    nombreUsuario: "carlos.apaza",
    rol: "SuperAdmin",
    activo: true,
    permisoPersonal: true,
    permisoAsistencia: true,
    permisoViaticos: true,
    permisoReportes: true,
    permisoConfiguracion: true,
    permisoProyectos: true
  },
  {
    idUsuario: 8,
    nombreUsuario: "gabriel.garcia.admin",
    rol: "SuperAdmin",
    activo: true,
    permisoPersonal: true,
    permisoAsistencia: true,
    permisoViaticos: true,
    permisoReportes: true,
    permisoConfiguracion: true,
    permisoProyectos: true
  },
  {
    idUsuario: 2,
    nombreUsuario: "camila",
    rol: "Admin",
    activo: true,
    permisoPersonal: true,
    permisoAsistencia: true,
    permisoViaticos: true,
    permisoReportes: true,
    permisoConfiguracion: false,
    permisoProyectos: true
  },
  {
    idUsuario: 9,
    nombreUsuario: "operador.obra",
    rol: "Encargado",
    activo: true,
    permisoPersonal: false,
    permisoAsistencia: true,
    permisoViaticos: false,
    permisoReportes: false,
    permisoConfiguracion: false,
    permisoProyectos: false
  }
];

export const mockConfiguracion = {
  id: 1,
  horaEntradaEsperada: "08:00:00",
  horaSalidaEsperada: "18:30:00",
  toleranciaMinutos: 20,
  nombreInstitucion: "Oficina Santiago II",
  temaOscuro: false
};

export const mockDepartamentos = [
  {
    idDepartamento: 1,
    nombre: "General",
    descripcion: "Departamento inicial",
    referenciadoPorPersonal: true
  },
  {
    idDepartamento: 2,
    nombre: "Ingeniería Civil y Obra",
    descripcion: "Frentes de construcción y supervisión técnica",
    referenciadoPorPersonal: true
  },
  {
    idDepartamento: 3,
    nombre: "Administración y Logística",
    descripcion: "Control administrativo, compras y soporte operativo",
    referenciadoPorPersonal: false
  }
];

export const mockMarcas = [
  {
    idMarca: 1,
    nombreMarca: "General"
  },
  {
    idMarca: 2,
    nombreMarca: "Constructora Aqua Park"
  },
  {
    idMarca: 3,
    nombreMarca: "Oficina Santiago II"
  }
];

export const mockAuditoriaAcceso = [
  {
    idLog: 33,
    fecha: "2026-10-20T09:15:00-04:00",
    usuario: "hector.manuel",
    accion: "configuracion.guardar",
    detalle: "Horario predeterminado verificado: 08:00:00 a 18:30:00 (tolerancia 20 min)."
  },
  {
    idLog: 31,
    fecha: "2026-10-19T15:49:07-04:00",
    usuario: "hector.manuel",
    accion: "usuarios.guardar",
    detalle: "Usuario 7: carlos.apaza (SuperAdmin, activo)"
  },
  {
    idLog: 30,
    fecha: "2026-10-19T15:43:09-04:00",
    usuario: "hector.manuel",
    accion: "usuarios.guardar",
    detalle: "Usuario 8: gabriel.garcia.admin (SuperAdmin, activo)"
  },
  {
    idLog: 28,
    fecha: "2026-10-18T10:20:00-04:00",
    usuario: "camila",
    accion: "departamentos.guardar",
    detalle: "Área registrada: Administración y Logística"
  }
];
