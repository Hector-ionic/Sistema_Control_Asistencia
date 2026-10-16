// src/modules/operaciones/mocks/datosPrueba.js

/**
 * Reglas vigentes de montos de viáticos y gastos adicionales (Moneda: Bs)
 */
export const REGLAS_VIATICOS_VIGENTES = {
  moneda: "Bs",
  topesPorCategoria: {
    Transporte: 200,
    Alimentacion: 150,
    Hospedaje: 350,
    Materiales: 300
  },
  topeMaximoConGastoAdicional: 800,
  requiereComprobanteEnAdicional: true,
  minLongitudJustificacionAdicional: 10
};

/**
 * Catálogo de personal de respaldo mientras /api/personal (Módulo 02) responde 501.
 * Respeta alta mínima: nombres, apellidos y tipo (Planta | Pasante).
 */
export const mockPersonal = [
  { id: 1, codigo: "PER-001", nombres: "Carlos Andres", apellidos: "Apaza Quispe", tipo: "Pasante", activo: true },
  { id: 2, codigo: "PER-002", nombres: "Willy Nelson", apellidos: "Rios Mamani", tipo: "Planta", activo: true },
  { id: 3, codigo: "PER-003", nombres: "Maria Elena", apellidos: "Condori Flores", tipo: "Planta", activo: true },
  { id: 4, codigo: "PER-004", nombres: "Jorge Luis", apellidos: "Vargas Choque", tipo: "Pasante", activo: true }
];

export const mockProyectos = [
  {
    id: 101,
    codigo: "PRY-2026-01",
    nombre: "Mantenimiento General",
    descripcion: "Mantenimiento preventivo de bombas, filtros y red eléctrica del sector norte.",
    ubicacion: "Planta Central - Sector Norte",
    estado: "Activo",
    fechaInicio: "2026-10-01",
    fechaFin: "2026-11-30",
    presupuestoViaticos: 3500.00
  },
  {
    id: 102,
    codigo: "PRY-2026-02",
    nombre: "Auditoría Interna",
    descripcion: "Revisión técnica de activos fijos y control de almacenes.",
    ubicacion: "Oficina Santiago II",
    estado: "Cerrado",
    fechaInicio: "2026-08-01",
    fechaFin: "2026-09-15",
    fechaCierre: "2026-09-15",
    motivoCierre: "Conclusión satisfactoria del cronograma de auditoría.",
    presupuestoViaticos: 1200.00
  },
  {
    id: 103,
    codigo: "PRY-2026-03",
    nombre: "Instalación Puntos QR y Redes",
    descripcion: "Despliegue de terminales de lectura QR para control de asistencia en campo.",
    ubicacion: "Accesos Principales",
    estado: "Activo",
    fechaInicio: "2026-10-10",
    fechaFin: "2026-12-15",
    presupuestoViaticos: 2800.00
  }
];

export const mockAsignaciones = [
  {
    id: 301,
    idProyecto: 101,
    idPersonal: 1,
    funcion: "Soporte técnico de campo",
    fechaInicio: "2026-10-02",
    fechaFin: "2026-10-31",
    estado: "Activa"
  },
  {
    id: 302,
    idProyecto: 101,
    idPersonal: 2,
    funcion: "Supervisor electromecánico",
    fechaInicio: "2026-10-01",
    fechaFin: "2026-11-30",
    estado: "Activa"
  },
  {
    id: 303,
    idProyecto: 102,
    idPersonal: 2,
    funcion: "Responsable de verificación",
    fechaInicio: "2026-08-05",
    fechaFin: "2026-09-15",
    estado: "Cerrada por proyecto"
  }
];

export const mockViaticos = [
  {
    id: 501,
    idProyecto: 101,
    idPersonal: 1,
    categoria: "Transporte",
    monto: 150.00,
    esGastoAdicional: false,
    montoAdicional: 0,
    comprobante: "REC-00142",
    descripcion: "Transporte local a Planta Central",
    justificacionAdicional: "",
    fecha: "2026-10-15",
    estado: "Vigente",
    autorizadoPor: "Administrador"
  },
  {
    id: 502,
    idProyecto: 101,
    idPersonal: 2,
    categoria: "Materiales",
    monto: 250.00,
    esGastoAdicional: true,
    montoAdicional: 95.50,
    comprobante: "FAC-88310",
    descripcion: "Compra de conectores estancos de emergencia",
    justificacionAdicional: "Reemplazo urgente de borneras dañadas por humedad en tablero norte.",
    fecha: "2026-10-16",
    estado: "Vigente",
    autorizadoPor: "Administrador"
  },
  {
    id: 503,
    idProyecto: 102,
    idPersonal: 2,
    categoria: "Alimentacion",
    monto: 120.00,
    esGastoAdicional: false,
    montoAdicional: 0,
    comprobante: "REC-00089",
    descripcion: "Alimentación jornada extendida de cierre de inventario",
    justificacionAdicional: "",
    fecha: "2026-09-10",
    estado: "Vigente",
    autorizadoPor: "Administrador"
  }
];

export const mockAuditoria = [
  {
    id: 901,
    fechaHora: "2026-09-15 18:10:00",
    zonaHoraria: "America/La_Paz",
    usuario: "admin.sii",
    rol: "administrador",
    accion: "CIERRE_PROYECTO",
    entidad: "Proyecto #102",
    detalle: "Cierre de 'Auditoría Interna' conservando 1 participación histórica y 1 viático conciliado."
  },
  {
    id: 902,
    fechaHora: "2026-10-15 09:30:00",
    zonaHoraria: "America/La_Paz",
    usuario: "operador.sii",
    rol: "operador",
    accion: "ALTA_VIATICO",
    entidad: "Viático #501",
    detalle: "Registro de viático de Transporte por Bs 150.00 en proyecto 'Mantenimiento General'."
  }
];