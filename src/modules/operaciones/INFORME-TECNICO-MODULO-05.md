# Informe Técnico de Avance y Adaptación a Contrato — Módulo 05: Proyectos y Viáticos

**Fecha de actualización:** 19/10/2026  
**Módulo:** 05 — Proyectos y viáticos (`src/modules/operaciones/` y `api/operaciones.js`)  
**Rama de trabajo:** `modulo-05-operaciones`  
**Contrato aplicado:** `BACKEND-PARA-LOS-5-MODULOS.md` (`POST /api/backend` + Reglas C# / PostgreSQL).

---

## 1. Correcciones Aplicadas según Revisión de `backend-api-modulos`

Atendiendo las observaciones de revisión sobre el commit `2483d54` en `BACKEND-PARA-LOS-5-MODULOS.md`, se realizaron los siguientes ajustes estructurales sin tocar archivos de otros módulos:

1. **Sustitución de `localStorage` y cabeceras `x-rol-usuario` por `POST /api/backend` autenticado:**
   - La función `llamar(operacion, datos, accessToken)` en `src/modules/operaciones/services/operacionesService.js` envía todas las operaciones a `POST /api/backend` con `Authorization: Bearer <accessToken>`.
   - El token y los datos de sesión (`sesion` y `sesion.actual`) se almacenan **únicamente en memoria**; nunca se guardan en `localStorage` ni se envían cabeceras `x-rol-usuario` o `x-usuario`.
   - No se reintentan escrituras automáticamente ante fallos de red.

2. **Alineación exacta a las operaciones y esquemas reales de C#:**
   - **`proyectos.listar` / `proyectos.guardar`:**  
     Esquema `{ idProyecto: 0, codigo, nombre, cliente: '', ubicacion, descripcion, estado: 'Planificado' | 'En curso' | 'Pausado' | 'Finalizado', fechaInicio, fechaFin: null, version: 0 }`.
   - **Cierre de proyectos conservando participaciones:**  
     Para cerrar un proyecto se lee su estado actual, se conserva su `version` y se guarda `estado: 'Finalizado'` mediante `proyectos.guardar`. Ante un conflicto de versión (`409`), se recargan los datos para que el usuario revise antes de guardar.
   - **`asignaciones.listar` / `asignaciones.guardar`:**  
     Esquema `{ idAsignacion: 0, idProyecto, idPasante, rol, fechaInicio, fechaFin: null, activo: true, version: 0 }`. Para finalizar una participación se lee la asignación actual y se envía `activo: false` conservando IDs y `version`.
   - **`viaticos.listar` / `viaticos.guardar` / `viaticos.eliminar`:**  
     Esquema `{ idViatico: 0, idPasante, fecha, monto, concepto, gastoExtra: 0 }`.
     - **Regla vigente de C#:** El viático base (`monto`) valida estrictamente **`0 < monto <= 12 Bs`** y el gasto adicional (`gastoExtra`) valida **`>= 0 Bs`**.
     - Se eliminaron del payload los campos que no pertenecen a la tabla real `Viatico` (`idProyecto`, `presupuesto`, `categoria`, `comprobante`, `justificacionAdicional`).
     - Se documenta en interfaz y servicio que `viaticos.eliminar` (`{ id }`) ejecuta la eliminación física existente en C# y no sustituye una baja lógica.

3. **Conciliación con Módulo 02 (Personal) y Módulo 04 (Reportes):**
   - Compatible con `personal.listar` (`idPasante`, `codigo`, `nombres`, `apellidos`, `tipoContrato`: `'Pasante'` y `'Personal de planta'`, donde planta mantiene `horasRequeridas: 0`).
   - El panel de totales emplea el filtro común `{ inicio, fin, idProyecto, id }` compatible con `reportes.historial`, `reportes.asignaciones` y `reportes.individual`.
