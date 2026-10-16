# Base para el equipo — React JavaScript + API

Solo estructura inicial: no es el proyecto anterior completo ni módulos terminados. Frontend y backend viven en esta misma carpeta y se publican desde un único repositorio en Vercel.

## Empezar

Node.js 24. Ejecutar `npm ci` y `npm run dev`, o abrir INICIAR.cmd. Vite sirve React y las funciones API de ejemplo en desarrollo. `npm run build` genera el frontend en dist. `npm test` verifica los contratos mínimos.

## Carpetas

- src/modules: cinco módulos separados; cada index.jsx es el punto de partida del integrante.
- src/components: componentes compartidos.
- src/services: cliente HTTP del frontend.
- api: funciones Node.js que Vercel ejecuta en el mismo despliegue.
- server: espacio para servicios y conexión al escritorio.
- shared: definición de módulos usada por frontend y backend.
- tests: comprobaciones mínimas de la base.

La API /api/estado funciona. /api/personal responde 501 porque la integración está pendiente. La pantalla muestra el alcance de los módulos y no inventa datos ni simula funciones terminadas. Todavía no existen login, CRUD, sincronización ni reportes reales.

## Trabajo en equipo

Leer INFORME-TECNICO-5-MODULOS.md. Cada integrante trabaja dentro de su módulo; acordar contratos de API antes de integrar. Revisar cambios pequeños, mantener datos de prueba y comprobar build y pruebas antes de unir trabajo.

## Un solo despliegue Vercel

Importar esta carpeta como raíz del repositorio, framework Vite, build npm run build, salida dist. Vercel detecta api/*.js como funciones backend. No subir node_modules, dist, .env ni secretos. npm run preview solo previsualiza el frontend; para probar backend usar npm run dev o Vercel. No se ha publicado.

Conectar después con una API de escritorio accesible y autenticada. El escritorio debe guardar en la misma fuente compartida para que la web vea sus registros. localhost de la oficina no es accesible desde Vercel. Esta integración pertenece a los módulos, no a esta base.

## Teléfonos: requisito obligatorio

Los cinco módulos deben funcionar desde 320 px de ancho, con controles táctiles, formularios en una columna y sin desbordamiento horizontal de la página. Ver los criterios y pruebas móviles obligatorias del informe. La base incluye tarjetas adaptables; cada integrante debe verificar su módulo en móvil antes de integrarlo.
