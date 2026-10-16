# Documentación Técnica — Módulo 02: Personal y Pasantías

**Responsable:** Gabriel (`gabogarcia2003`)  
**Rama de trabajo:** `Modulo2Gabriel`  
**Módulo asignado:** Módulo 02 — Personal y pasantías (`src/modules/personal/` y `api/personal.js`)

---

## 1. Resumen de la Implementación

Se implementó de forma completa, simple y modular el **Módulo 02 (Personal y Pasantías)** cumpliendo todos los puntos del archivo `INFORME-TECNICO-5-MODULOS.md`:

1. **Alta sencilla con código automático:** Registro con `nombres`, `apellidos` y `tipo` (`planta` o `pasante`), generando automáticamente el código correlativo (`PER-001`, `PER-002`, etc.) sin colisionar con códigos provenientes del escritorio.
2. **Regla estricta Planta vs. Pasantes:**
   - **Personal de planta:** `pasantia: null`. Ni el backend guarda ni el frontend muestra metas de horas ni fecha de fin de pasantía.
   - **Pasantes:** Asignación automática de **600 horas por defecto** (`horasMeta: 600`), cálculo de horas cumplidas, horas pendientes, porcentaje de avance y jornadas restantes.
3. **Cálculo de fecha estimada de finalización:** Toma en cuenta la fecha de inicio, el régimen/turno diario (incluyendo **Turno mañana de `08:00 a 12:30` = `4.5 h/día`**, **Turno tarde de `14:00 a 18:30` = `4.5 h/día`**, **Jornada completa = `8 h/día`** o **Pasantía continua = `6 h/día`**), los **días feriados** y los **días de incidencias/permisos**, excluyendo fines de semana.
4. **Edición, baja lógica y recuperación conservando historial:** Ningún registro se elimina físicamente. Las bajas requieren un motivo, cambian el estado a `"baja"` y permiten su posterior **recuperación/reactivación** (`"activo"`), registrando cada evento con fecha y hora en zona `America/La_Paz` dentro del arreglo `historial`.
5. **Conservación de datos del sistema de escritorio:** Los registros vinculados al escritorio conservan intacto su bloque `datosEscritorio` (`escritorioId`, marcas de sincronización y metadatos biométricos).
6. **Responsividad móvil obligatoria (`320px` a `1280px+`):** Formularios de una sola columna en móvil, controles táctiles con altura mínima de `44 × 44 px`, etiquetas visibles y cero desbordamiento horizontal.

---

## 2. Detalle de Archivos Creados y Modificados

Para **evitar conflictos de combinación (`merge conflicts`) en Git** con los responsables de los Módulos 01, 03, 04 y 05, **no se modificó ningún archivo compartido global** (`src/App.jsx`, `src/styles.css`, `src/services/api.js`, `vite.config.js` ni `tests/base.test.js`). Todo el trabajo se encapsuló en archivos propios del Módulo 02:

| Archivo | Estado | Justificación y Propósito Técnico |
| :--- | :--- | :--- |
| `server/personalService.js` | **Nuevo** | **Lógica de dominio y almacén de datos en el backend.** Se creó para separar las reglas de negocio del controlador HTTP y permitir que otros módulos (como Asistencia o Reportes) importen funciones directas si lo necesitan. Contiene el generador de códigos (`PER-XXX`), la validación de alta mínima (`nombres`, `apellidos`, `tipo`), la regla planta vs. pasante (`600h` por defecto), el cálculo de fecha de fin con turnos (`4.5h`, `6h`, `8h`)/feriados/incidencias, el historial auditable en zona `America/La_Paz` y la sincronización con el escritorio. |
| `api/personal.js` | **Modificado** | **Endpoint Serverless (`/api/personal`).** Antes devolvía únicamente `501`. Se implementó el soporte completo para `GET` (listar/filtrar/buscar por ID o código), `POST` (alta de personal y sincronización con escritorio), `PUT` (edición de ficha) y `PATCH` (baja lógica, recuperación y avance de horas de pasantía). Mantiene compatibilidad con `tests/base.test.js`. |
| `src/modules/personal/personalApi.js` | **Nuevo** | **Cliente HTTP del Módulo 02.** Se creó en lugar de modificar `src/services/api.js` para evitar conflictos de Git con los otros 4 módulos. Provee funciones listas para usar (`obtenerPersonal`, `obtenerFichaPersona`, `registrarNuevaPersona`, `editarFichaPersona`, `cambiarEstadoFichaPersona`, `actualizarProgresoPasantia`). |
| `src/modules/personal/personal.css` | **Nuevo** | **Hoja de estilos exclusiva del Módulo 02.** Se creó en la carpeta del módulo para no alterar `src/styles.css`, respetando las clases nativas (`.detalle-modulo`, `.numero`, `.etiquetas`, `.aceptacion`) y la paleta original del proyecto. Implementa las reglas responsivas para `320px`, `360px`, `390px`, `768px` y `1280px+`, formularios en una columna en teléfonos, botones de mínimo `44 × 44 px` y reglas `@media print`. |
| `src/modules/personal/index.jsx` | **Modificado** | **Interfaz principal del Módulo 02 (en React `.jsx`).** Reemplaza la vista vacía inicial por la aplicación completa de Personal y Pasantías: indicadores superiores, buscador en tiempo real, filtros por tipo y estado, formulario adaptable de alta mínima/edición con previsualización de fin de pasantía, tarjetas de personal, registro rápido de horas/incidencias, baja con motivo, reactivación y visor de historial. |
| `tests/personal.test.js` | **Nuevo** | **Pruebas automatizadas del Módulo 02.** Verifica mediante `node:test` el listado, el código automático, la prohibición de meta de pasantía en personal de planta, las 600 horas por defecto en pasantes, el cálculo de fecha de fin y la conservación del historial y datos de escritorio al editar, dar de baja y recuperar. |
| `MODULO-02-PERSONAL-DOCUMENTACION.md` | **Nuevo** | **Este documento técnico.** Explica la arquitectura, el motivo de cada archivo creado o editado y cómo los demás módulos pueden integrarse de manera simple. |

---

## 3. Compatibilidad e Integración con los Otros Módulos

El Módulo 02 fue diseñado con contratos JSON simples y predecibles para que los demás integrantes del equipo puedan conectarse sin fricción:

### Estructura de una Ficha de Personal (`Persona`)
```json
{
  "id": "per-2",
  "codigo": "PER-002",
  "nombres": "Valeria",
  "apellidos": "Flores Condori",
  "nombreCompleto": "Valeria Flores Condori",
  "tipo": "pasante",
  "turno": "manana",
  "estado": "activo",
  "motivoBaja": null,
  "pasantia": {
    "horasMeta": 600,
    "horasCumplidas": 225,
    "horasPendientes": 375,
    "porcentajeProgreso": 37.5,
    "turno": "manana",
    "horario": "08:00 - 12:30",
    "horasPorDia": 4.5,
    "fechaInicio": "2026-08-17",
    "diasFeriados": 2,
    "diasIncidencias": 1,
    "fechaFinEstimada": "2027-02-23",
    "estadoPasantia": "en_curso"
  },
  "origenEscritorio": true,
  "datosEscritorio": {
    "escritorioId": "ESC-102",
    "sincronizadoEn": "2026-10-15 18:10"
  },
  "fechaAlta": "2026-08-17",
  "actualizadoEn": "2026-10-15 18:10",
  "historial": []
}
```
*(Si `"tipo": "planta"`, el campo `"pasantia"` es siempre `null`).*

### ¿Cómo se conectan los demás módulos con el Módulo 02?
* **Módulo 01 (Acceso y administración):** Puede consultar `GET /api/personal?id=PER-001` para asociar cuentas de usuario u operadores a una ficha de personal existente.
* **Módulo 03 (Asistencia e incidencias):**
  1. Puede listar únicamente el personal activo llamando a `GET /api/personal?estado=activo`.
  2. Cuando un pasante cierra su jornada o registra un permiso/falta, Asistencia puede enviar `PATCH /api/personal` con `{ "id": "per-2", "accion": "progreso", "horasSumar": 6, "diasIncidencias": 1, "motivo": "Jornada registrada" }` (o invocar `registrarProgresoPasante` desde `server/personalService.js`).
* **Módulo 04 (Historial y reportes):**
  1. `GET /api/personal` devuelve tanto el arreglo `items` como el objeto `resumen` con los totales consolidados (`activos`, `planta`, `pasantes`, `horasMetaTotalPasantes`, `horasCumplidasTotalPasantes`, `horasPendientesTotalPasantes`).
  2. Garantiza por contrato que el personal de planta tiene `pasantia: null`, cumpliendo el criterio del Módulo 04 (*"el personal de planta no recibe metas de pasantía"*).
* **Módulo 05 (Proyectos y viáticos):** Puede consumir `GET /api/personal?estado=activo` para poblar los selectores de asignación de personas a proyectos usando `id`, `codigo`, `nombreCompleto` y `area`.

---

## 4. Verificación de Pruebas y Compilación

Se verificó el módulo con los comandos oficiales del proyecto:
- `npm test`: **8/8 pruebas aprobadas** (4 pruebas de la base original + 4 pruebas integrales del Módulo 02).
- `npm run build`: Compilación de producción con Vite en `dist/` sin errores ni advertencias.
