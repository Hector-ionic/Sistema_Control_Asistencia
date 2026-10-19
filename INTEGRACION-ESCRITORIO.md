# Integración independiente con C#

Abrir `/integracion.html`. La portada y los cinco módulos del equipo permanecen intactos. Esta página es una referencia funcional separada, escrita en React y JavaScript, sin TypeScript. No reemplaza entregas ni criterios de aceptación de los compañeros.

## Ejecutar

1. Iniciar la API C# actualizada con `Iniciar-API-React.cmd` del proyecto de escritorio.
2. Crear `.env.local` en esta carpeta con `REGISTRO_DESKTOP_API_URL=http://localhost:5088`.
3. Ejecutar `npm run dev` y abrir la URL que indique Vite, agregando `/integracion.html`.

La integración usa las cuentas reales del sistema C#. No contiene usuarios, contraseñas ni registros ficticios. Crear cuenta siempre solicita el rol Encargado al backend; los permisos los decide C#.

## Alcance

- Sesión en memoria, cierre de sesión y detección de sesión vencida; al recargar hay que ingresar otra vez.
- Registro diario directo y solicitudes para corregir registros existentes.
- Encargados ven únicamente sus solicitudes; Admin/SuperAdmin pueden aprobar o rechazar con motivo.
- Ficha con fecha de ingreso editable únicamente por SuperAdmin para personal existente.
- Metas individuales de pasantía (360, 400, 600 u otra cantidad). Planta guarda cero. El servidor calcula el fin estimado; se muestra el resultado después de guardar.
- Foto y datos opcionales; credencial imprimible desde el navegador con los datos guardados. La impresión está limitada a la credencial, sin mostrar la pantalla de administración.
- Consultas cada 10 segundos, ajuste a teléfono y controles táctiles. La edición abierta no se sobrescribe con las actualizaciones.

## Archivos nuevos y puntos de conexión

`src/integracion/`, `integracion.html` y `api/integracion.js` son nuevos. Solo se amplió `vite.config.js` para atender la ruta local, leer la variable privada y compilar ambas páginas. No se alteraron `src/modules/`, `shared/modulos.js`, `src/App.jsx`, el cliente API original ni el informe de los cinco módulos.

## Vercel

La misma compilación incluye las dos páginas y la función Node. Configurar `REGISTRO_DESKTOP_API_URL` como variable privada del servidor, sin prefijo VITE_. Debe apuntar a una API C# accesible por HTTPS desde Vercel. `localhost` en Vercel no apunta al equipo de la oficina. La aplicación C# no se ejecuta dentro de Vercel: la función Node actúa como puente autenticado y transmite el token de la sesión. No se publica ni configura infraestructura externa automáticamente.

Las reglas y operaciones están en `API-ROLES-Y-ACCESOS.md` del proyecto C#. Los módulos del equipo podrán adoptar esta referencia después, de forma acordada.
