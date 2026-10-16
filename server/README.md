# Backend compartido

Las funciones públicas viven en ../api. Colocar aquí servicios, validaciones y el conector del sistema de escritorio. El navegador no debe recibir credenciales de la base ni claves privadas del conector.

La integración todavía no está implementada. Primero acordar autenticación, permisos y contratos de datos con el escritorio. Elegir una API compartida: Vercel no puede acceder a localhost de una computadora de la oficina desde Internet.
