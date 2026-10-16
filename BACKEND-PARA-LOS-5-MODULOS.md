# Backend común para los cinco módulos

## Entrega y límites

Rama: `backend-api-modulos`. Endpoint nuevo: **`/api/backend`**. No reemplaza `/api/personal`, `/api/operaciones` ni las carpetas de los compañeros. Cada responsable conectará su frontend a este contrato y corregirá su módulo. No se hizo merge de sus ramas ni se alteraron sus commits.

El backend Node comparte PostgreSQL/Neon con el escritorio. `web.registros-dia` consulta directamente esa base. Las operaciones de negocio se transmiten a la API C# actualizada para conservar permisos, cálculos, auditoría y validaciones. Por tanto, **la API C# debe estar disponible**, aunque la aplicación de escritorio esté cerrada. No es una reimplementación de las reglas C# en JavaScript.

Configurar en el servidor `DATABASE_URL` y `REGISTRO_DESKTOP_API_URL`. En local están en `.env.local`, excluido de Git. En Vercel se configuran como variables privadas y la URL C# debe ser HTTPS accesible desde Internet; localhost solo sirve en el equipo local. No se publican credenciales ni se aloja C# dentro de Vercel.

## Llamada común

`GET /api/backend` devuelve el contrato y las operaciones de los cinco módulos, sin consultar datos privados. Toda operación usa:

```js
async function llamar(operacion, datos = {}, accessToken = '') {
  const respuesta = await fetch('/api/backend', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    body: JSON.stringify({ operacion, datos })
  });
  const resultado = await respuesta.json();
  if (!respuesta.ok) throw Object.assign(
    new Error(resultado.mensaje || 'No se pudo completar la operación'),
    { status: respuesta.status, errores: resultado.errores }
  );
  return resultado;
}
```

La respuesta exitosa es el JSON de la operación: lista, objeto, booleano o mensaje. No lleva un envoltorio `items`, `personal` u `ok` agregado por Node. Los errores tienen `{ mensaje, errores? }`. Códigos: 400 validación, 401 sesión requerida/vencida, 403 sin permisos, 404 no encontrado, 409 conflicto, 413 tamaño, 422 validación, 429 límite, 502 respuesta inválida, 503 conexión/configuración y 504 tiempo agotado. No reintentar automáticamente escrituras: salvo las marcaciones rápidas y solicitudes con UUID, no todas son idempotentes.

Guardar el token solo en memoria. No confiar en `rolUsuario`, `x-rol-usuario` ni `x-usuario`: la autoridad es la sesión validada por el servidor. Los cambios de cuenta activa y rol se revisan en cada operación C#.

## Módulo 01 — Acceso y administración

```js
const sesion = await llamar('sesion', { usuario, password });
// { tokenType: 'Bearer', accessToken, expiresIn } (segundos)
const token = sesion.accessToken;
const usuarioActual = await llamar('sesion.actual', {}, token);
await llamar('registro-encargado', { usuario: nuevoUsuario, password: nuevaClave });
```

Solo `sesion` y `registro-encargado` son públicos. El autorregistro solo crea Encargado. Roles exactos: `SuperAdmin`, `Admin`, `Encargado`. Cerrar sesión elimina el token del estado del frontend. No hay endpoint de renovación; al vencer, volver al ingreso.

| Operación | `datos` | Resultado |
| --- | --- | --- |
| `usuarios.listar` | `{}` | usuarios sin hashes |
| `usuarios.guardar` | `{ usuario: { idUsuario, nombreUsuario, rol, activo }, password }` | usuario guardado; password vacío conserva la clave al editar |
| `usuarios.eliminar` | `{ id }` | resultado; solo SuperAdmin |
| `configuracion.obtener` | `{}` | configuración |
| `configuracion.guardar` | objeto previamente leído con horaEntradaEsperada, horaSalidaEsperada, toleranciaMinutos, nombreInstitucion, temaOscuro | configuración guardada; solo SuperAdmin |
| `auditoria.listar` | `{}` | hasta 1000 eventos; solo SuperAdmin |
| `departamentos.listar` / `marcas.listar` | `{}` | catálogos |
| `departamentos.guardar` | `{ idDepartamento: 0, nombre, descripcion }` | área guardada |
| `departamentos.eliminar` | `{ id }` | resultado; rechaza áreas referenciadas |

Para crear un usuario usar `idUsuario: 0`. Solo el propietario/SuperAdmin designa administradores. Los permisos no se toman de valores enviados desde la interfaz.

## Módulo 02 — Personal y pasantías

| Operación | `datos` | Resultado |
| --- | --- | --- |
| `personal.listar` | `{ idProyecto? }` | personas activas |
| `personal.historico` | `{}` | activas e inactivas |
| `personal.obtener` | `{ id }` o `{ codigo }` | ficha o null |
| `personal.existe` | `{ codigo }` | booleano |
| `personal.guardar` | ficha | ficha guardada |
| `personal.eliminar` | `{ id }` | baja lógica, conserva historial |
| `personal.recalcular` | `{ id }` | recalcula fin de pasantía |
| `personal.para-horas` | `{}` | códigos/nombres, accesible al encargado |
| `feriados.listar` | `{}` | fechas de feriados |

Alta mínima:

```js
const ficha = await llamar('personal.guardar', {
  nombres: 'Nombre de ejemplo', apellidos: 'Apellido de ejemplo',
  tipoContrato: 'Pasante', horasRequeridas: 360
}, token);
// idPasante, codigo, nombres, apellidos, tipoContrato,
// horasRequeridas, fechaInicio, fechaFin, turno, diasTrabajo, ...
```

Tipos exactos: `Pasante` y `Personal de planta`. Planta siempre guarda cero horas. Metas de 1 a 20000; 600 es el valor por defecto. El código es generado por C#, no `PER-XXX` de los mocks. Los IDs reales son enteros.

Turnos soportados por C#: `Tiempo Completo` (8 h), `Medio Tiempo`, `Turno Mañana (Medio Tiempo)`, `Turno Tarde (Medio Tiempo)` (4 h). No interpretar turnos de 4.5 o 6 h de la rama como equivalentes: requieren una ampliación de negocio acordada. Días: `Lunes a Viernes`, `Lunes a Sábado`, `Lunes a Domingo`, `Sábados y Domingos`.

Para editar, leer la ficha, conservar sus campos y enviar el objeto completo modificado. Cambiar `fechaInicio` de una persona existente requiere SuperAdmin. Foto base64 opcional; CI, institución (`universidad`), carrera y contacto son opcionales. La fecha de fin la calcula C#.

Las horas cumplidas se calculan desde las asistencias reales (`reportes.seguimiento` o `reportes.individual`), no enviando `horasSumar`. No hay sincronización masiva de mocks, carga de progreso arbitrario ni historial ficticio. React no debe sumar nuevamente horas que ya están registradas. La reactivación requiere una ficha completa con `activo: true` y permisos de personal.

## Módulo 03 — Asistencia e incidencias

| Operación | `datos` |
| --- | --- |
| `asistencia.estado` | `{ codigo }` |
| `asistencia.resumen` | `{ idProyecto? }` |
| `asistencia.historial` | filtro de fechas descrito abajo |
| `asistencia.registrar` | `{ codigo, accion, observaciones?, jornadaExtendida? }` |
| `asistencia.manual` | `{ codigo, fecha, horaEntrada, horaSalida, horaInicioAlmuerzo: null, horaFinAlmuerzo: null, observaciones: null, jornadaExtendida: false, reemplazarExistente: false }` |
| `asistencia.rapida` | `{ idOperacion: UUID, codigo, accion, origen: 'codigo' }` |
| `correcciones.listar` | `{}` |
| `correcciones.enviar` | `{ id: UUID, registro: objeto de asistencia.manual, motivo }` |
| `correcciones.revisar` | `{ id: UUID, aprobar: true/false, motivo }` |
| `web.registros-dia` | `{}`; lectura directa PostgreSQL solo Admin/SuperAdmin |
| `qr.existe` / `qr.emitir` / `qr.pendientes` | `{}` |
| `qr.solicitudes` | `{ soloPendientes: true }` |
| `qr.revisar` | `{ id: UUID, aprobar: true/false, motivo }` |

Acciones de marcación: `entrada`, `inicio-almuerzo`, `fin-almuerzo`, `salida`. Para ausencias administrativas, `asistencia.registrar` admite `accion: 'Permiso'` o `'Falta'`, fecha y observaciones. C# valida el periodo de la persona, secuencia y permisos.

Fechas `YYYY-MM-DD`; horas `HH:mm:ss`; zona America/La_Paz. Encargado solo registra hoy, sin reemplazar registros. Correcciones no alteran horas hasta que Admin/SuperAdmin aprueba; el rechazo exige motivo. Reutilizar el UUID de una marcación rápida o solicitud al reintentarla. El envío público de un escaneo firmado sigue en el portal QR C#; no se inventó un endpoint de tickets en Node.

`web.registros-dia` devuelve `{ registros, actualizadoEn, zonaHoraria, limite: 1000 }`. Puede consultarse cada 10 segundos (sin solicitudes simultáneas y deteniendo el temporizador al salir). Es actualización periódica, no SignalR. `registros` contiene código, nombres, apellidos, fecha, entrada, salida, almuerzo, minutos y versión; no CI ni credenciales.

## Módulo 04 — Historial y reportes

Filtro común:

```js
const filtro = {
  inicio: '2026-10-01', fin: '2026-10-31',
  idProyecto: null, id: null, codigo: null
};
const historial = await llamar('reportes.historial', filtro, token);
const seguimiento = await llamar('reportes.seguimiento', filtro, token);
const individual = await llamar('reportes.individual', { id: idPasante }, token);
```

Operaciones: `reportes.historial`, `reportes.seguimiento`, `reportes.asignaciones`, `reportes.individual` y `reportes.marcas`. `reportes.asignaciones` acepta `{ idProyecto?, id? }`; `reportes.marcas` acepta `{ idProyecto? }`. `reportes.individual` devuelve `{ personal, asistencias, viaticos, proyectos }`; para mantener el contrato existente, `proyectos` contiene asignaciones, no solo fichas de proyecto.

Los tiempos se devuelven en minutos (`minutosTrabajados`, `minutosPeriodo`, `minutosTotales`). Mostrar acumulados mayores a 24 h sin usar una fecha/hora del navegador. Planta tiene `horasRequeridas: 0`, sin porcentaje de pasantía. El backend entrega JSON; la impresión/PDF/CSV del navegador queda a cargo del módulo. No se implementó un generador PDF Node.

## Módulo 05 — Proyectos y viáticos

| Operación | `datos` | Resultado |
| --- | --- | --- |
| `proyectos.listar` | `{}` | proyectos |
| `proyectos.guardar` | `{ idProyecto: 0, codigo, nombre, cliente: '', ubicacion, descripcion, estado: 'Planificado', fechaInicio, fechaFin: null, version: 0 }` | proyecto guardado |
| `asignaciones.listar` | `{ idProyecto?, id? }` | asignaciones; `id` es idPasante |
| `asignaciones.guardar` | `{ idAsignacion: 0, idProyecto, idPasante, rol, fechaInicio, fechaFin: null, activo: true, version: 0 }` | asignación guardada |
| `viaticos.listar` | `{ inicio?, fin?, id? }` | viáticos; `id` es idPasante |
| `viaticos.guardar` | `{ idViatico: 0, idPasante, fecha, monto, concepto, gastoExtra: 0 }` | viático guardado |
| `viaticos.eliminar` | `{ id }` | eliminación existente en C#; no equivale a una baja lógica |

Estados reales: `Planificado`, `En curso`, `Pausado`, `Finalizado`. Para cerrar un proyecto leerlo, conservar su versión y guardar `estado: 'Finalizado'`; C# cierra sus asignaciones conservando historial. Para finalizar una asignación, leerla y guardar `activo: false`, conservando IDs y versión. Ante conflicto de versión, volver a consultar y revisar antes de guardar.

Reglas vigentes de C#: viático base **mayor a 0 y hasta 12 Bs**, extra no negativo. El esquema actual no tiene `idProyecto`, presupuesto, categoría, comprobante ni justificación separada en Viatico; no se aceptan como si fueran campos persistidos. No convertir silenciosamente los montos de los mocks de la rama en valores reales. La baja lógica de viáticos pedida en el módulo exige ampliar el esquema/negocio antes; no usar `viaticos.eliminar` como sustituto de esa funcionalidad.

## Revisión de las ramas (sin cambios)

| Rama / commit revisado | Hallazgo para el responsable |
| --- | --- |
| `Modulo2Gabriel` / `4c52eeb` | Cliente `/api/personal`, backend en memoria; usa `per-*`, `pasantia`, turnos 4.5/6 h y progreso manual. Adaptar llamadas y mapeo al contrato real; autenticar. |
| `modulo-05-operaciones` / `2483d54` | Escrituras principales en localStorage, GET `/api/operaciones`, mocks y rol elegido en frontend/cabeceras. Sustituir esas escrituras por las operaciones autenticadas del backend y revisar las diferencias de esquema. |
| `main` / `13d586e` | Estructura base. No se fusionaron ni reemplazaron sus cinco módulos. |

Los responsables harán sus correcciones. Se mantienen intactos sus archivos y ramas. Los endpoints anteriores no se redirigen automáticamente para que no cambie el comportamiento de su trabajo sin que lo adapten.

## Verificación y despliegue

`npm test`, `npm run build`, `npm run db:comprobar`. Las pruebas de contrato usan API simulada y verifican sesión, rutas, errores y cuerpos HTTP. La conexión PostgreSQL real se comprobó sin escrituras. No se afirma que las escrituras de todos los módulos se hayan probado contra producción. La API C# debe publicarse/configurarse aparte para verificar el recorrido completo autenticado.

No hay credenciales ni `.env.local` en Git. No se modifican esquemas ni se ejecutan migraciones desde Node. Configurar las variables privadas en Vercel antes de probar con datos reales.
