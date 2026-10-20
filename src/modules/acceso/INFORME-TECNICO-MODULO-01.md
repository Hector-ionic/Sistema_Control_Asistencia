# Informe Técnico — Módulo 01: Acceso y Administración

## 1. Alcance y Cumplimiento del Contrato (`/api/backend`)
El Módulo 01 (`src/modules/acceso/`) implementa el control de cuentas, sesiones, roles, permisos, áreas/departamentos, marcas, horarios predeterminados y auditoría del sistema conectándose al contrato oficial `POST /api/backend` mediante `llamar(operacion, datos, accessToken)`.

- **Sesión exclusivamente en memoria:** El token (`Authorization: Bearer <accessToken>`) se almacena únicamente en memoria (`accesoService.js`). No se utiliza `localStorage` ni se envían cabeceras `x-rol-usuario` o `x-usuario`.
- **Operaciones públicas soportadas:**
  - `sesion`: Inicio de sesión con `{ usuario, password }`, devolviendo `{ tokenType, accessToken, expiresIn }`.
  - `registro-encargado`: Autorregistro público que crea exclusivamente cuentas con rol `Encargado`.
- **Operaciones autenticadas soportadas:**
  - `sesion.actual`: Consulta del perfil y rol vigentes en la sesión activa.
  - `usuarios.listar`, `usuarios.guardar` (`{ usuario: { idUsuario, nombreUsuario, rol, activo, ... }, password }`), `usuarios.eliminar` (`{ id }`).
  - `configuracion.obtener`, `configuracion.guardar` (`{ id, horaEntradaEsperada, horaSalidaEsperada, toleranciaMinutos, nombreInstitucion, temaOscuro }`).
  - `departamentos.listar`, `departamentos.guardar` (`{ idDepartamento, nombre, descripcion }`), `departamentos.eliminar` (`{ id }`).
  - `marcas.listar`.
  - `auditoria.listar` (hasta 1000 eventos).

## 2. Criterios de Aceptación Funcional y Móvil
1. **Rechazo de acciones prohibidas en backend (`403`):** Solo `SuperAdmin` designa administradores (`Admin` / `SuperAdmin`), elimina cuentas, modifica la configuración institucional o consulta la auditoría completa.
2. **Vencimiento y recuperación de sesión (`401`):** Al vencer o invalidarse el token, el sistema limpia la sesión en memoria y redirige inmediatamente al formulario de acceso.
3. **Auditoría de cambios:** Todas las altas, ediciones, activaciones/desactivaciones y cambios de configuración quedan registrados con fecha/hora (`America/La_Paz`), usuario, acción y detalle.
4. **Responsividad móvil (`320px` a `1280px+`):** Diseño adaptable a una columna en teléfono, sin desplazamiento horizontal de página y con controles táctiles $\ge 44 \times 44\text{ px}$.
