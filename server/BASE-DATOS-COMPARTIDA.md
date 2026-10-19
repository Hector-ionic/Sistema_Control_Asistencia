# Backend Node y base compartida con C#

La web tiene una conexión PostgreSQL propia mediante `pg`. Usa las tablas del esquema `registro` que administra C#, sin crear otras tablas ni ejecutar migraciones. La conexión local fue comprobada contra la base existente con TLS y validación del certificado. No se alteraron registros durante la comprobación.

## Configuración privada

`DATABASE_URL` vive en `.env.local`, excluido por Git, o en las variables privadas del proyecto Vercel. Nunca usar prefijo `VITE_`. La configuración local se importó del `config.ini` existente sin imprimir su contenido. Para verificar:

```
npm run db:comprobar
```

Devuelve solo estado de conexión, TLS y esquema, sin usuarios ni datos de personal. El pool mantiene como máximo tres conexiones por proceso, con límites de conexión y consulta. [Documentación de pooling](https://node-postgres.com/features/pooling) y [TLS](https://node-postgres.com/features/ssl).

## Lectura directa

`GET /api/registros`, con `Authorization: Bearer TOKEN`, consulta directamente PostgreSQL y devuelve hasta 1000 registros del día actual en America/La_Paz. Incluye nombres, código, horas, minutos y versión. No devuelve contraseñas, CI, foto ni datos de contacto.

Esta primera lectura es para Admin y SuperAdmin. El encargado conserva sus operaciones de registro diario y solicitud de corrección mediante la API existente. Los roles se comprueban de nuevo en la base, incluyendo si la cuenta continúa activa.

La sesión aún se valida contra la API C# mediante `REGISTRO_DESKTOP_API_URL`; no se creó un sistema de contraseñas paralelo ni se reemplazó el módulo de acceso de los compañeros. Por tanto esta ruta necesita la API C# disponible además de la base de datos. La prueba real de conexión se completó; la ruta autenticada tiene pruebas de rechazo y de repositorio con datos de prueba, pero falta verificar el recorrido HTTP completo con una sesión de C# activa.

El consumidor puede consultar esta ruta cada 10 segundos para ver registros nuevos sin caché. La pantalla existente sigue usando el puente C#; no se modificaron las pantallas de los cinco módulos. Las escrituras siguen pasando por C# para mantener sus validaciones, auditoría y cálculos. Todavía no se implementaron escrituras SQL equivalentes en Node ni notificaciones instantáneas.

## Cambios delimitados

Archivos nuevos: `server/database.js`, `server/comprobar-database.js`, `server/configurar-database.js`, `api/registros.js` y pruebas. Se añadieron la dependencia `pg`, un comando de diagnóstico y la ruta local en Vite. Las carpetas de los cinco módulos, sus tareas y el informe original no se modificaron.

No se hizo push, despliegue ni modificación de la base. En Vercel se deben configurar ambas variables privadas; localhost solo funciona en desarrollo local. Las migraciones del esquema siguen siendo responsabilidad del proyecto C#.
