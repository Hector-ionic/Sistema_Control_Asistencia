# Informe técnico y plan de trabajo — cinco módulos

Fecha: 16/10/2026. Entrega: estructura base en React/JavaScript y funciones Node.js, un solo repositorio para Vercel. Sin TypeScript, C# ni proyecto de escritorio incluido.

## Estado de la base

Navegación con tarjetas grandes, un archivo inicial por módulo, cliente HTTP, endpoint de estado y endpoint de personal marcado como pendiente (501). No se entregan funcionalidades de negocio completas.

## Módulo 01: Acceso y administración

Cuentas, sesiones, permisos y configuración del sistema.

**Carpeta:** `src/modules/acceso/`

**Trabajo:**

- Inicio y cierre de sesión con API.
- Roles y permisos de administrador y operador.
- Administración de cuentas y activación.
- Vencimiento y recuperación de sesión.
- Configuración de área, marca y horarios predeterminados.
- Auditoría de cambios y acciones administrativas.

**Aceptación móvil obligatoria:** cumplir todos los criterios de responsividad de este informe, además de los criterios funcionales siguientes.

**Aceptación funcional:** Las acciones prohibidas se rechazan en backend, una sesión vencida vuelve al acceso y los cambios quedan auditados.

## Módulo 02: Personal y pasantías

Registro sencillo, ficha de personal y seguimiento exclusivo de pasantes.

**Carpeta:** `src/modules/personal/`

**Trabajo:**

- Alta con nombres, apellidos y tipo.
- Código automático y búsqueda de personas.
- Edición, baja y recuperación conservando historial.
- Personal de planta sin meta de horas ni fin de pasantía.
- Pasantes con 600 horas por defecto y progreso real.
- Cálculo de fin con turnos, feriados e incidencias.
- Conservación de datos existentes del escritorio.

**Aceptación móvil obligatoria:** cumplir todos los criterios de responsividad de este informe, además de los criterios funcionales siguientes.

**Aceptación funcional:** Planta no muestra ni guarda meta de pasantía; pasantes tienen 600 horas por defecto; los cambios respetan historial y datos existentes.

## Módulo 03: Asistencia e incidencias

Jornada laboral, permisos y sincronización con el sistema de escritorio.

**Carpeta:** `src/modules/asistencia/`

**Trabajo:**

- Entrada, inicio y fin de almuerzo, salida.
- Estado de jornada y tiempo trabajado.
- Validación de secuencia y duplicados en backend.
- Permisos, faltas y correcciones con motivo.
- Reintentos idempotentes ante errores de red.
- Lectura periódica y estado de conexión.
- Integración QR con revisión del encargado.
- Zona horaria America/La_Paz.

**Aceptación móvil obligatoria:** cumplir todos los criterios de responsividad de este informe, además de los criterios funcionales siguientes.

**Aceptación funcional:** No se duplica una marcación, los tiempos son coherentes y los cambios confirmados por escritorio aparecen a través de la API compartida.

## Módulo 04: Historial y reportes

Consultas, seguimiento, impresión y exportación desde los datos del sistema.

**Carpeta:** `src/modules/reportes/`

**Trabajo:**

- Historial por fechas, persona y proyecto.
- Reportes individuales y del equipo.
- Horas cumplidas y pendientes solo para pasantes.
- Totales de asistencia y viáticos conciliados.
- Impresión A4 y guardado PDF desde navegador.
- Exportación CSV y formatos adicionales acordados.
- Paginación, estados vacíos y errores de consulta.
- Pruebas de reportes con varias páginas.

**Aceptación móvil obligatoria:** cumplir todos los criterios de responsividad de este informe, además de los criterios funcionales siguientes.

**Aceptación funcional:** Consulta, impresión y exportación usan los mismos filtros y datos; el personal de planta no recibe metas de pasantía.

## Módulo 05: Proyectos y viáticos

Proyectos, asignaciones del equipo, gastos y control de operaciones.

**Carpeta:** `src/modules/operaciones/`

**Trabajo:**

- Alta, edición y estado de proyectos.
- Asignación de personas, función y período.
- Cierre de proyectos conservando participaciones.
- Prevención de asignaciones activas duplicadas.
- Alta, edición y baja autorizada de viáticos.
- Reglas vigentes de montos y gastos adicionales.
- Totales por persona, proyecto y período.
- Auditoría y enlace con reportes.

**Aceptación móvil obligatoria:** cumplir todos los criterios de responsividad de este informe, además de los criterios funcionales siguientes.

**Aceptación funcional:** Las asignaciones respetan las fechas del proyecto, los viáticos cumplen sus reglas y los totales coinciden con los reportes.

## Orden e integración

1. Acordar contratos, autenticación y fuente compartida con el escritorio.
2. Desarrollar acceso y personal; después asistencia.
3. Completar operaciones y reportes; revisar integración entre módulos.
4. Probar en conjunto con datos de prueba antes del repositorio/publicación.

Los reportes deben consultar datos reales de la API y permitir imprimir; no se implementan todavía. La actualización periódica o por eventos se decidirá al desarrollar asistencia. Mantener nombres, apellidos y tipo como alta mínima. Solo pasantes tienen meta de 600 horas por defecto.

## Antes del repositorio y Vercel

Excluir secretos y generados. Conservar package-lock.json, código, pruebas y este informe. Ejecutar npm ci, npm test y npm run build. Configurar variables privadas solo en backend. Importar la raíz con api y src en un único proyecto Vercel. Probar permisos, conectividad, sincronización e impresión cuando los módulos existan. No se ha publicado ni conectado con datos reales.

## Responsividad obligatoria en los cinco módulos

El sistema debe poder utilizarse desde teléfono. La responsividad forma parte de la aceptación de cada módulo; no se deja para una etapa opcional ni para después de publicar.

### Tamaños y orientación

- Verificar 320, 360 y 390 px de ancho en teléfono; 768 px en tableta; 1280 px o más en escritorio.
- Probar orientación vertical y horizontal. Usar CSS adaptable y contenido fluido, sin depender de un único modelo de teléfono.
- No debe existir desplazamiento horizontal de toda la página, texto cortado ni botones fuera de pantalla. Una tabla ancha puede tener desplazamiento dentro de su propio contenedor, claramente identificable.
- En teléfono, tarjetas y formularios pasan a una columna. Los módulos de la base ya tienen ese comportamiento inicial.

### Interacción táctil y accesibilidad

- Objetivo de diseño: botones y controles táctiles con área de al menos 44 × 44 px y separación suficiente.
- Las acciones deben funcionar al tocar; no depender de hover, clic derecho o mouse.
- Etiquetas visibles en campos, foco identificable, mensajes de error junto al dato correspondiente y navegación con teclado.
- Mantener texto de lectura cómodo; no obligar al usuario a ampliar la página para completar una operación.
- Al aparecer el teclado del teléfono, el campo activo y la acción de guardar deben seguir siendo accesibles mediante desplazamiento normal.

### Comprobaciones por módulo

| Módulo | Prueba obligatoria desde teléfono |
|---|---|
| Acceso | Entrar, corregir un error de credenciales, navegar y salir sin cortes ni controles ocultos. |
| Personal | Buscar, crear, editar y consultar planta/pasante con formularios en una columna. |
| Asistencia | Elegir persona y acción con botones táctiles; mostrar confirmación o fallo sin exigir ampliar la pantalla. |
| Historial y reportes | Cambiar fechas, buscar y abrir reporte; tablas contenidas o tarjetas; impresión con estilos propios para papel. |
| Proyectos y viáticos | Completar asignaciones y gastos desde teléfono, con fechas, montos y validaciones accesibles. |

### Validación antes de cerrar cada módulo

Adjuntar evidencia de uso a 360/390 px y en escritorio, comprobar 320 px y orientación horizontal, y realizar una prueba en un teléfono real cuando esté disponible. Verificar también conexión lenta, estado de carga y error de red. Registrar si la prueba fue en navegador emulado o dispositivo real; no afirmar una prueba física si no se hizo.

La vista en pantalla y la impresión son diseños distintos: la primera se adapta a teléfono; la segunda debe permitir reportes A4 con encabezados y tablas legibles, sin imprimir menús o botones.

## Verificación de esta base

Compilación Vite correcta y 4/4 pruebas de contratos básicos. Se comprobó en navegador el endpoint de estado junto con el frontend y la ausencia de desbordamiento horizontal de la portada en viewports de 320, 360, 390, 768 y 1280 px. Es una verificación en navegador emulado, no en teléfono físico, y no certifica los módulos futuros. Cada módulo deberá aportar sus propias pruebas móviles.
