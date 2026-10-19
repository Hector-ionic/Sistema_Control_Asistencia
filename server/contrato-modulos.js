// Contrato nuevo del backend. No importa ni modifica código de los compañeros.
export const modulosBackend = Object.freeze({
 acceso: ['sesion.actual','usuarios.listar','usuarios.guardar','usuarios.eliminar','configuracion.obtener','configuracion.guardar','auditoria.listar','departamentos.listar','departamentos.guardar','departamentos.eliminar','marcas.listar'],
 personal: ['personal.listar','personal.historico','personal.obtener','personal.existe','personal.guardar','personal.eliminar','personal.recalcular','personal.para-horas','feriados.listar','departamentos.listar','marcas.listar'],
 asistencia: ['asistencia.estado','asistencia.resumen','asistencia.historial','asistencia.registrar','asistencia.manual','asistencia.rapida','correcciones.enviar','correcciones.listar','correcciones.revisar','qr.existe','qr.emitir','qr.revisar','qr.solicitudes','qr.pendientes','web.registros-dia'],
 reportes: ['reportes.historial','reportes.asignaciones','reportes.individual','reportes.seguimiento','reportes.marcas'],
 operaciones: ['proyectos.listar','proyectos.guardar','asignaciones.listar','asignaciones.guardar','viaticos.listar','viaticos.guardar','viaticos.eliminar']
});
export const operacionesBackend = new Set(Object.values(modulosBackend).flat());
export const contratoBackend = {version:1,ruta:'/api/backend',metodo:'POST',formato:{operacion:'nombre.de.operacion',datos:{}},autenticacion:'Authorization: Bearer <accessToken>',zonaHoraria:'America/La_Paz',sesion:['sesion','registro-encargado'],modulos:modulosBackend};
