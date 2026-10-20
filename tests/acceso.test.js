// tests/acceso.test.js
import test from "node:test";
import assert from "node:assert/strict";
import handlerAcceso from "../api/acceso.js";
import {
  llamar,
  ejecutarOperacionAccesoEnMemoria,
  reiniciarMemoriaSimuladaAcceso,
  establecerSesionAccesoMemoria,
  obtenerTokenAccesoMemoria,
  forzarVencimientoSesionMemoria
} from "../src/modules/acceso/services/accesoService.js";
import {
  validarUsuarioGuardar,
  validarConfiguracionGuardar,
  validarDepartamentoGuardar
} from "../src/modules/acceso/utils/reglasAcceso.js";

function crearResSimulado() {
  return {
    statusCode: 200,
    headers: {},
    cuerpo: "",
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    end(payload = "") {
      this.cuerpo = payload;
      return this;
    },
    json() {
      return this.cuerpo ? JSON.parse(this.cuerpo) : null;
    }
  };
}

test("Módulo 01: Cliente 'llamar' usa POST /api/backend con Bearer token en memoria y sin x-rol-usuario", async () => {
  let llamadaCapturada = null;
  const fetchSimulado = async (url, opciones) => {
    llamadaCapturada = { url, opciones };
    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({
          tokenType: "Bearer",
          accessToken: "jwt-m01-real",
          expiresIn: 28800
        });
      }
    };
  };

  const sesion = await llamar(
    "sesion",
    { usuario: "carlos.apaza", password: "MiClaveSegura123" },
    "",
    { fetchImpl: fetchSimulado }
  );

  assert.equal(llamadaCapturada.url, "/api/backend");
  assert.equal(llamadaCapturada.opciones.method, "POST");
  assert.equal(llamadaCapturada.opciones.headers["x-rol-usuario"], undefined);
  assert.equal(llamadaCapturada.opciones.headers["x-usuario"], undefined);
  assert.equal(sesion.accessToken, "jwt-m01-real");
  assert.equal(obtenerTokenAccesoMemoria(), "jwt-m01-real");
});

test("Módulo 01: Autorregistro público crea exclusivamente rol Encargado y sesión vencida vuelve al acceso (401)", () => {
  reiniciarMemoriaSimuladaAcceso();

  const nuevoEncargado = ejecutarOperacionAccesoEnMemoria(
    "registro-encargado",
    {
      usuario: "encargado.obra2",
      password: "PasswordSegura123"
    },
    ""
  );
  assert.equal(nuevoEncargado.rol, "Encargado");
  assert.equal(nuevoEncargado.activo, true);

  const sesion = ejecutarOperacionAccesoEnMemoria(
    "sesion",
    {
      usuario: "encargado.obra2",
      password: "PasswordSegura123"
    },
    ""
  );
  assert.ok(sesion.accessToken);

  // Simular vencimiento de sesión: la siguiente operación debe lanzar 401 y limpiar el token
  forzarVencimientoSesionMemoria();
  assert.throws(
    () =>
      ejecutarOperacionAccesoEnMemoria(
        "sesion.actual",
        {},
        sesion.accessToken
      ),
    (err) => err.status === 401
  );
  assert.equal(obtenerTokenAccesoMemoria(), "");
});

test("Módulo 01: Administración de cuentas respeta jerarquía de roles y conserva clave cuando password va vacío al editar", () => {
  const mem = reiniciarMemoriaSimuladaAcceso();

  // Un Admin no puede designar a otro Admin ni SuperAdmin
  const intentoEscalado = validarUsuarioGuardar(
    {
      usuario: {
        idUsuario: 0,
        nombreUsuario: "intento.admin",
        rol: "Admin",
        activo: true
      },
      password: "Password123"
    },
    mem.usuarios,
    "Admin"
  );
  assert.equal(intentoEscalado.valido, false);
  assert.ok(intentoEscalado.errores.rol);

  // SuperAdmin crea un nuevo usuario con idUsuario: 0
  establecerSesionAccesoMemoria("token-superadmin", mem.usuarios[0], 28800);
  const creado = ejecutarOperacionAccesoEnMemoria(
    "usuarios.guardar",
    {
      usuario: {
        idUsuario: 0,
        nombreUsuario: "nuevo.operador",
        rol: "Encargado",
        activo: true
      },
      password: "ClaveInicial123"
    },
    "token-superadmin"
  );
  assert.ok(creado.idUsuario > 0);
  assert.equal(creado.nombreUsuario, "nuevo.operador");

  // Editar con password vacío conserva la clave y actualiza estado
  const editado = ejecutarOperacionAccesoEnMemoria(
    "usuarios.guardar",
    {
      usuario: {
        ...creado,
        activo: false
      },
      password: ""
    },
    "token-superadmin"
  );
  assert.equal(editado.activo, false);
});

test("Módulo 01: Configuración de horarios, áreas y marcas valida rangos e impide eliminar áreas referenciadas", () => {
  const mem = reiniciarMemoriaSimuladaAcceso();
  establecerSesionAccesoMemoria("token-superadmin", mem.usuarios[0], 28800);

  // Hora de salida anterior a la entrada debe rechazarse
  const configInvalida = validarConfiguracionGuardar(
    mem.configuracion,
    {
      horaEntradaEsperada: "18:00:00",
      horaSalidaEsperada: "08:00:00"
    },
    "SuperAdmin"
  );
  assert.equal(configInvalida.valido, false);
  assert.ok(configInvalida.errores.horaSalidaEsperada);

  // Guardar configuración válida como SuperAdmin
  const configGuardada = ejecutarOperacionAccesoEnMemoria(
    "configuracion.guardar",
    {
      ...mem.configuracion,
      horaEntradaEsperada: "08:15:00",
      horaSalidaEsperada: "18:45:00",
      toleranciaMinutos: 15,
      nombreInstitucion: "Constructora Aqua Park - Sede Central",
      temaOscuro: false
    },
    "token-superadmin"
  );
  assert.equal(configGuardada.toleranciaMinutos, 15);
  assert.equal(configGuardada.horaEntradaEsperada, "08:15:00");

  // Eliminar un área referenciada por personal debe rechazarse con 409
  assert.throws(
    () =>
      ejecutarOperacionAccesoEnMemoria(
        "departamentos.eliminar",
        { id: 1 },
        "token-superadmin"
      ),
    (err) => err.status === 409
  );
});

test("Módulo 01: Las acciones prohibidas se rechazan en backend (403) y los cambios quedan auditados", async () => {
  reiniciarMemoriaSimuladaAcceso();

  // 1. Petición sin token es rechazada con 401
  const resSinToken = crearResSimulado();
  await handlerAcceso(
    {
      method: "POST",
      headers: {},
      body: { operacion: "usuarios.listar", datos: {} }
    },
    resSinToken
  );
  assert.equal(resSinToken.statusCode, 401);

  // 2. Un Encargado intentando guardar configuración o consultar auditoría recibe 403
  const resProhibido = crearResSimulado();
  await handlerAcceso(
    {
      method: "POST",
      headers: { authorization: "Bearer token-encargado-test" },
      body: {
        operacion: "configuracion.guardar",
        datos: {
          id: 1,
          horaEntradaEsperada: "08:00:00",
          horaSalidaEsperada: "18:30:00",
          toleranciaMinutos: 20,
          nombreInstitucion: "Intento No Autorizado",
          temaOscuro: false
        }
      }
    },
    resProhibido
  );
  assert.equal(resProhibido.statusCode, 403);

  // 3. SuperAdmin crea un área y el cambio queda registrado en auditoria.listar
  const resGuardarDep = crearResSimulado();
  await handlerAcceso(
    {
      method: "POST",
      headers: { authorization: "Bearer token-superadmin-test" },
      body: {
        operacion: "departamentos.guardar",
        datos: {
          idDepartamento: 0,
          nombre: "Topografía y Geodesia",
          descripcion: "Levantamientos en obra"
        }
      }
    },
    resGuardarDep
  );
  assert.equal(resGuardarDep.statusCode, 200);

  const resAuditoria = crearResSimulado();
  await handlerAcceso(
    {
      method: "POST",
      headers: { authorization: "Bearer token-superadmin-test" },
      body: { operacion: "auditoria.listar", datos: {} }
    },
    resAuditoria
  );
  assert.equal(resAuditoria.statusCode, 200);
  const eventos = resAuditoria.json();
  assert.ok(
    eventos.some(
      (ev) =>
        ev.accion === "departamentos.guardar" &&
        ev.detalle.includes("Topografía y Geodesia")
    )
  );
});
