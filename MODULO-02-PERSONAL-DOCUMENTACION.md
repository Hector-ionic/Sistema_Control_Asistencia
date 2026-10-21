# Documentación Técnica — Módulo 02: Personal y Pasantías (Conectado a `/api/backend` y Esquema C# / PostgreSQL)

**Responsable:** Gabriel (`gabogarcia2003`)  
**Rama de trabajo:** `Modulo2Gabriel` (actualizada con `origin/backend-api-modulos`)  
**Módulo asignado:** Módulo 02 — Personal y pasantías (`src/modules/personal/`)

---

## 1. Correcciones Aplicadas según `BACKEND-PARA-LOS-5-MODULOS.md`

En atención a la revisión técnica de `BACKEND-PARA-LOS-5-MODULOS.md`:
> *Hallazgo original en `4c52eeb`: "Cliente `/api/personal`, backend en memoria; usa `per-*`, `pasantia`, turnos 4.5/6 h y progreso manual. Adaptar llamadas y mapeo al contrato real; autenticar."*

Se aplicaron todas las correcciones solicitadas:

1. **Conexión autenticada a `POST /api/backend`:**
   - Se eliminó el almacén en memoria (`server/personalService.js`) y se restauró `api/personal.js` a su estado base original (`501`).
   - Todas las operaciones del Módulo 02 ahora pasan por `POST /api/backend` enviando `{ operacion, datos }` y la cabecera `Authorization: Bearer <accessToken>` (almacenando el token **únicamente en memoria** y cerrando sesión automáticamente ante `401`).
2. **Mapeo exacto al esquema C# / PostgreSQL (`registro."Personal"`):**
   - Se eliminaron los identificadores `per-*` y el subobjeto `pasantia`.
   - Se usan los campos reales de la ficha en C#: `idPasante` (entero, `0` al crear), `codigo` (generado por C#), `nombres`, `apellidos`, `tipoContrato` (`'Pasante'` o `'Personal de planta'`), `horasRequeridas` (`600` por defecto en `'Pasante'`, rango `1..20000`; **`0` siempre en `'Personal de planta'`**), `fechaInicio`, `fechaFin` (calculada por C#), `activo` (`true` / `false`), y los campos opcionales `idDepartamento`, `nombreDepartamento`, `ci`, `universidad`, `carrera`, `telefono`, `email`, `direccion` y `foto` (base64).
3. **Turnos y días de trabajo exactos de C#:**
   - Se eliminaron los turnos de `4.5 h` y `6 h`.
   - Se utilizan exclusivamente los turnos de C#: `'Tiempo Completo'`, `'Medio Tiempo'`, `'Turno Mañana (Medio Tiempo)'`, `'Turno Tarde (Medio Tiempo)'`.
   - Se utilizan exclusivamente los días de trabajo de C#: `'Lunes a Viernes'`, `'Lunes a Sábado'`, `'Lunes a Domingo'`, `'Sábados y Domingos'`.
4. **Progreso real desde asistencias (sin `horasSumar` manual):**
   - Se eliminó la suma manual de horas en el frontend.
   - Las horas cumplidas se calculan a partir de los minutos trabajados reales (`minutosTrabajados`, `minutosPeriodo`, `minutosTotales`) devueltos por `reportes.seguimiento` y `reportes.individual`, formateando acumulados mayores a 24 h sin usar objetos `Date` del navegador.
   - Se integró `personal.recalcular` (`{ id: idPasante }`) para recalcular la fecha de fin en C#.
5. **Reglas de edición, baja lógica y reactivación:**
   - Al editar o reactivar, primero se consulta la ficha completa con `personal.obtener`, se conservan todos sus campos y se envía el objeto completo a `personal.guardar`.
   - Modificar `fechaInicio` en una persona ya registrada (`idPasante > 0`) está restringido exclusivamente al rol `'SuperAdmin'`.
   - La baja lógica utiliza `personal.eliminar` (`{ id: idPasante }`), conservando el historial en la base de datos.

---

## 2. Operaciones del Contrato `/api/backend` Utilizadas en el Módulo 02

| Operación | `datos` | Uso en el Módulo 02 |
| :--- | :--- | :--- |
| `sesion` / `sesion.actual` / `registro-encargado` | `{ usuario, password }` / `{}` | Autenticación Bearer en memoria cuando no se recibe sesión externa. |
| `personal.listar` | `{ idProyecto? }` | Lista de personas activas. |
| `personal.historico` | `{}` | Lista de personas activas e inactivas (bajas lógicas). |
| `personal.obtener` | `{ id }` o `{ codigo }` | Lectura completa de la ficha antes de editar o reactivar. |
| `personal.existe` | `{ codigo }` | Verificación booleana de existencia de un código en la base. |
| `personal.guardar` | `ficha` completa | Alta mínima o edición completa conservando campos existentes. |
| `personal.eliminar` | `{ id: idPasante }` | Baja lógica conservando el historial. |
| `personal.recalcular` | `{ id: idPasante }` | Solicita a C# recalcular la `fechaFin` de pasantía. |
| `personal.para-horas` | `{}` | Lista de códigos y nombres cuando ingresa un usuario con rol `Encargado`. |
| `departamentos.listar` / `feriados.listar` / `marcas.listar` | `{}` | Catálogos de áreas/departamentos, feriados y marcas del sistema. |
| `reportes.seguimiento` / `reportes.individual` | filtro / `{ id: idPasante }` | Lectura de minutos trabajados reales y detalle de asistencias, proyectos y viáticos. |

---

## 3. Archivos del Módulo 02

| Archivo | Estado | Propósito |
| :--- | :--- | :--- |
| `src/modules/personal/personalApi.js` | **Actualizado** | Cliente de `/api/backend` con la función `llamar(operacion, datos, accessToken)`, validaciones del esquema C# (`prepararFichaParaGuardar`), cálculo de avance desde minutos reales (`calcularAvanceDesdeMinutos`) y operaciones del Módulo 02. |
| `src/modules/personal/index.jsx` | **Actualizado** | Interfaz en React `.jsx` conectada a `/api/backend`: ingreso con token en memoria, listado activo/histórico, buscador, verificador `personal.existe`, formulario C# de alta/edición con campos opcionales y foto, botón `personal.recalcular`, historial real `reportes.individual` y credencial imprimible. |
| `src/modules/personal/personal.css` | **Actualizado** | Estilos adaptables (`320px` a `1280px+`) alineados al diseño original de `src/styles.css` y controles táctiles de mínimo `44 × 44 px`. |
| `tests/personal.test.js` | **Actualizado** | Pruebas automatizadas verificando el contrato `/api/backend`, los tipos/turnos/días de C#, la restricción de `SuperAdmin` en `fechaInicio`, las `0` horas en planta, las `600` horas por defecto en pasantes y el cálculo de minutos reales mayores a 24 h. |
