// src/modules/operaciones/mocks/datosPrueba.js

/**
 * Reglas vigentes reales del sistema C# (BACKEND-PARA-LOS-5-MODULOS.md):
 * - Viático base (monto): mayor a 0 y hasta 12 Bs (0 < monto <= 12).
 * - Gasto extra (gastoExtra): no negativo (>= 0).
 * - Estados de proyecto: 'Planificado', 'En curso', 'Pausado', 'Finalizado'.
 * - Tipos de contrato de personal: 'Pasante' y 'Personal de planta' (Planta guarda 0 horasRequeridas).
 */
export const REGLAS_VIATICOS_VIGENTES = Object.freeze({
  moneda: "Bs",
  montoBaseMinimo: 0.01,
  montoBaseMaximo: 12.00,
  gastoExtraMinimo: 0.00
});

export const ESTADOS_PROYECTO = Object.freeze([
  "Planificado",
  "En curso",
  "Pausado",
  "Finalizado"
]);

export const ROLES_SISTEMA = Object.freeze([
  "SuperAdmin",
  "Admin",
  "Encargado"
]);

/**
 * Datos de referencia con el esquema real de C# / PostgreSQL
 * (usados únicamente para pruebas unitarias y vista previa en memoria cuando la API C# no está activa).
 */
export const mockPersonal = [
  {
    idPasante: 1,
    codigo: "1001",
    nombres: "Carlos Andres",
    apellidos: "Apaza Quispe",
    tipoContrato: "Pasante",
    horasRequeridas: 600,
    turno: "Tiempo Completo",
    diasTrabajo: "Lunes a Viernes",
    activo: true
  },
  {
    idPasante: 2,
    codigo: "1002",
    nombres: "Willy Nelson",
    apellidos: "Rios Mamani",
    tipoContrato: "Personal de planta",
    horasRequeridas: 0,
    turno: "Tiempo Completo",
    diasTrabajo: "Lunes a Viernes",
    activo: true
  },
  {
    idPasante: 3,
    codigo: "1003",
    nombres: "Maria Elena",
    apellidos: "Condori Flores",
    tipoContrato: "Personal de planta",
    horasRequeridas: 0,
    turno: "Tiempo Completo",
    diasTrabajo: "Lunes a Sábado",
    activo: true
  },
  {
    idPasante: 4,
    codigo: "1004",
    nombres: "Jorge Luis",
    apellidos: "Vargas Choque",
    tipoContrato: "Pasante",
    horasRequeridas: 600,
    turno: "Turno Mañana (Medio Tiempo)",
    diasTrabajo: "Lunes a Viernes",
    activo: true
  }
];

export const mockProyectos = [
  {
    idProyecto: 101,
    codigo: "PRY-2026-01",
    nombre: "Mantenimiento General",
    cliente: "SII Oficina Santiago II",
    ubicacion: "Planta Central - Sector Norte",
    descripcion: "Mantenimiento preventivo de bombas, filtros y red eléctrica del sector norte.",
    estado: "En curso",
    fechaInicio: "2026-10-01",
    fechaFin: "2026-11-30",
    version: 1
  },
  {
    idProyecto: 102,
    codigo: "PRY-2026-02",
    nombre: "Auditoría Interna",
    cliente: "Dirección Administrativa",
    ubicacion: "Oficina Santiago II",
    descripcion: "Revisión técnica de activos fijos y control de almacenes.",
    estado: "Finalizado",
    fechaInicio: "2026-08-01",
    fechaFin: "2026-09-15",
    version: 2
  },
  {
    idProyecto: 103,
    codigo: "PRY-2026-03",
    nombre: "Instalación Puntos QR y Redes",
    cliente: "SII Control de Asistencia",
    ubicacion: "Accesos Principales",
    descripcion: "Despliegue de terminales de lectura QR para control de asistencia en campo.",
    estado: "Planificado",
    fechaInicio: "2026-10-10",
    fechaFin: "2026-12-15",
    version: 1
  }
];

export const mockAsignaciones = [
  {
    idAsignacion: 301,
    idProyecto: 101,
    idPasante: 1,
    rol: "Soporte técnico de campo",
    fechaInicio: "2026-10-02",
    fechaFin: "2026-10-31",
    activo: true,
    version: 1
  },
  {
    idAsignacion: 302,
    idProyecto: 101,
    idPasante: 2,
    rol: "Supervisor electromecánico",
    fechaInicio: "2026-10-01",
    fechaFin: "2026-11-30",
    activo: true,
    version: 1
  },
  {
    idAsignacion: 303,
    idProyecto: 102,
    idPasante: 2,
    rol: "Responsable de verificación",
    fechaInicio: "2026-08-05",
    fechaFin: "2026-09-15",
    activo: false,
    version: 2
  }
];

export const mockViaticos = [
  {
    idViatico: 501,
    idPasante: 1,
    fecha: "2026-10-15",
    monto: 12.00,
    concepto: "Pasaje urbano a Planta Central",
    gastoExtra: 0.00
  },
  {
    idViatico: 502,
    idPasante: 2,
    fecha: "2026-10-16",
    monto: 10.50,
    concepto: "Transporte operativo y conectores de emergencia",
    gastoExtra: 25.00
  },
  {
    idViatico: 503,
    idPasante: 2,
    fecha: "2026-09-10",
    monto: 12.00,
    concepto: "Viático jornada de cierre de inventario",
    gastoExtra: 0.00
  }
];

export const mockAuditoria = [
  {
    idAuditoria: 901,
    fechaHora: "2026-09-15 18:10:00",
    zonaHoraria: "America/La_Paz",
    usuario: "superadmin",
    rol: "SuperAdmin",
    operacion: "proyectos.guardar",
    entidad: "Proyecto #102",
    detalle: "Cambio de estado a 'Finalizado' (versión 2) conservando participaciones históricas."
  },
  {
    idAuditoria: 902,
    fechaHora: "2026-10-15 09:30:00",
    zonaHoraria: "America/La_Paz",
    usuario: "admin",
    rol: "Admin",
    operacion: "viaticos.guardar",
    entidad: "Viático #501",
    detalle: "Registro de viático base Bs 12.00 (gastoExtra Bs 0.00) para idPasante 1."
  }
];