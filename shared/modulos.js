export const modulos = [
  {
    "id": "acceso",
    "numero": "01",
    "nombre": "Acceso y administración",
    "descripcion": "Cuentas, sesiones, permisos y configuración del sistema.",
    "tareas": [
      "Inicio y cierre de sesión con API",
      "Roles y permisos de administrador y operador",
      "Administración de cuentas y activación",
      "Vencimiento y recuperación de sesión",
      "Configuración de área, marca y horarios predeterminados",
      "Auditoría de cambios y acciones administrativas"
    ],
    "aceptacion": "Las acciones prohibidas se rechazan en backend, una sesión vencida vuelve al acceso y los cambios quedan auditados."
  },
  {
    "id": "personal",
    "numero": "02",
    "nombre": "Personal y pasantías",
    "descripcion": "Registro sencillo, ficha de personal y seguimiento exclusivo de pasantes.",
    "tareas": [
      "Alta con nombres, apellidos y tipo",
      "Código automático y búsqueda de personas",
      "Edición, baja y recuperación conservando historial",
      "Personal de planta sin meta de horas ni fin de pasantía",
      "Pasantes con 600 horas por defecto y progreso real",
      "Cálculo de fin con turnos, feriados e incidencias",
      "Conservación de datos existentes del escritorio"
    ],
    "aceptacion": "Planta no muestra ni guarda meta de pasantía; pasantes tienen 600 horas por defecto; los cambios respetan historial y datos existentes."
  },
  {
    "id": "asistencia",
    "numero": "03",
    "nombre": "Asistencia e incidencias",
    "descripcion": "Jornada laboral, permisos y sincronización con el sistema de escritorio.",
    "tareas": [
      "Entrada, inicio y fin de almuerzo, salida",
      "Estado de jornada y tiempo trabajado",
      "Validación de secuencia y duplicados en backend",
      "Permisos, faltas y correcciones con motivo",
      "Reintentos idempotentes ante errores de red",
      "Lectura periódica y estado de conexión",
      "Integración QR con revisión del encargado",
      "Zona horaria America/La_Paz"
    ],
    "aceptacion": "No se duplica una marcación, los tiempos son coherentes y los cambios confirmados por escritorio aparecen a través de la API compartida."
  },
  {
    "id": "reportes",
    "numero": "04",
    "nombre": "Historial y reportes",
    "descripcion": "Consultas, seguimiento, impresión y exportación desde los datos del sistema.",
    "tareas": [
      "Historial por fechas, persona y proyecto",
      "Reportes individuales y del equipo",
      "Horas cumplidas y pendientes solo para pasantes",
      "Totales de asistencia y viáticos conciliados",
      "Impresión A4 y guardado PDF desde navegador",
      "Exportación CSV y formatos adicionales acordados",
      "Paginación, estados vacíos y errores de consulta",
      "Pruebas de reportes con varias páginas"
    ],
    "aceptacion": "Consulta, impresión y exportación usan los mismos filtros y datos; el personal de planta no recibe metas de pasantía."
  },
  {
    "id": "operaciones",
    "numero": "05",
    "nombre": "Proyectos y viáticos",
    "descripcion": "Proyectos, asignaciones del equipo, gastos y control de operaciones.",
    "tareas": [
      "Alta, edición y estado de proyectos",
      "Asignación de personas, función y período",
      "Cierre de proyectos conservando participaciones",
      "Prevención de asignaciones activas duplicadas",
      "Alta, edición y baja autorizada de viáticos",
      "Reglas vigentes de montos y gastos adicionales",
      "Totales por persona, proyecto y período",
      "Auditoría y enlace con reportes"
    ],
    "aceptacion": "Las asignaciones respetan las fechas del proyecto, los viáticos cumplen sus reglas y los totales coinciden con los reportes."
  }
];
