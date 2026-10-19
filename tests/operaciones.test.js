import test from "node:test";
import assert from "node:assert/strict";
import handlerOperaciones, { reiniciarMemoriaOperaciones } from "../api/operaciones.js";
import {
  llamar,
  ejecutarOperacionContratoEnMemoria,
  establecerTokenMemoria
} from "../src/modules/operaciones/services/operacionesService.js";
import {
  validarAsignacion,
  validarViatico,
  prepararCierreProyecto,
  prepararFinalizacionAsignacion,
  calcularTotalesYResumenReportes
} from "../src/modules/operaciones/utils/reglasOperaciones.js";
import {
  mockPersonal,
  mockProyectos,
  mockAsignaciones,
  mockViaticos
} from "../src/modules/operaciones/mocks/datosPrueba.js";

const crearRespuestaMock = () => ({
  statusCode: 200,
  headers: {},
  body: null,
  setHeader(k, v) {
    this.headers[k] = v;
  },
  end(v) {
    this.body = v ? JSON.parse(v) : null;
  }
});

test("Módulo 05: Cliente 'llamar' usa POST /api/backend con Bearer token y sin x-rol-usuario", async () => {
  let peticionCapturada = null;
  const fetchMock = async (url, opciones) => {
    peticionCapturada = { url, opciones, body: JSON.parse(opciones.body) };
    return new Response(JSON.stringify([{ idProyecto: 101 }]), { status: 200 });
  };

  const resultado = await llamar(
    "proyectos.listar",
    {},
    "token-memoria-123",
    { fetchImpl: fetchMock }
  );

  assert.equal(peticionCapturada.url, "/api/backend");
  assert.equal(peticionCapturada.opciones.method, "POST");
  assert.equal(
    peticionCapturada.opciones.headers.Authorization,
    "Bearer token-memoria-123"
  );
  assert.equal(peticionCapturada.opciones.headers["x-rol-usuario"], undefined);
  assert.equal(peticionCapturada.body.operacion, "proyectos.listar");
  assert.equal(resultado.length, 1);
});

test("Módulo 05: Las asignaciones respetan las fechas del proyecto y el esquema C# (idAsignacion, idPasante, rol, activo, version)", () => {
  // Proyecto 101 va del 2026-10-01 al 2026-11-30
  const fueraDeRango = validarAsignacion(
    {
      idAsignacion: 0,
      idProyecto: 101,
      idPasante: 3,
      rol: "Técnica de control",
      fechaInicio: "2026-09-25",
      fechaFin: "2026-10-20",
      activo: true,
      version: 0
    },
    mockProyectos,
    mockAsignaciones
  );
  assert.equal(fueraDeRango.valido, false);
  assert.ok(fueraDeRango.errores.periodo);

  const dentroDeRango = validarAsignacion(
    {
      idAsignacion: 0,
      idProyecto: 101,
      idPasante: 3,
      rol: "Técnica de control",
      fechaInicio: "2026-10-05",
      fechaFin: "2026-10-25",
      activo: true,
      version: 0
    },
    mockProyectos,
    mockAsignaciones
  );
  assert.equal(dentroDeRango.valido, true);
  assert.deepEqual(Object.keys(dentroDeRango.payload), [
    "idAsignacion",
    "idProyecto",
    "idPasante",
    "rol",
    "fechaInicio",
    "fechaFin",
    "activo",
    "version"
  ]);
});

test("Módulo 05: Prevención de asignaciones activas duplicadas y finalización con activo: false", () => {
  // idPasante 1 ya tiene asignación activa en Proyecto 101 del 2026-10-02 al 2026-10-31
  const duplicada = validarAsignacion(
    {
      idAsignacion: 0,
      idProyecto: 101,
      idPasante: 1,
      rol: "Apoyo adicional",
      fechaInicio: "2026-10-15",
      fechaFin: "2026-11-10",
      activo: true,
      version: 0
    },
    mockProyectos,
    mockAsignaciones
  );
  assert.equal(duplicada.valido, false);
  assert.ok(duplicada.errores.duplicado);

  // Finalizar asignación conserva IDs y versión poniendo activo: false
  const payloadFinalizar = prepararFinalizacionAsignacion(mockAsignaciones[0]);
  assert.equal(payloadFinalizar.idAsignacion, 301);
  assert.equal(payloadFinalizar.idProyecto, 101);
  assert.equal(payloadFinalizar.idPasante, 1);
  assert.equal(payloadFinalizar.activo, false);
  assert.equal(payloadFinalizar.version, 1);
});

test("Módulo 05: Cierre de proyecto guarda estado 'Finalizado', conserva versión/historial y rechaza conflicto 409", () => {
  reiniciarMemoriaOperaciones();
  establecerTokenMemoria("token-prueba", {
    idUsuario: 1,
    nombreUsuario: "superadmin",
    rol: "SuperAdmin",
    activo: true
  });

  const proyectos = ejecutarOperacionContratoEnMemoria(
    "proyectos.listar",
    {},
    "token-prueba"
  );
  const pry101 = proyectos.find((p) => p.idProyecto === 101);
  const payloadCierre = prepararCierreProyecto(pry101);
  assert.equal(payloadCierre.estado, "Finalizado");
  assert.equal(payloadCierre.version, pry101.version);

  const cerrado = ejecutarOperacionContratoEnMemoria(
    "proyectos.guardar",
    payloadCierre,
    "token-prueba"
  );
  assert.equal(cerrado.estado, "Finalizado");
  assert.equal(cerrado.version, pry101.version + 1);

  // Las asignaciones de 101 se conservan en el historial con activo: false
  const asignaciones101 = ejecutarOperacionContratoEnMemoria(
    "asignaciones.listar",
    { idProyecto: 101 },
    "token-prueba"
  );
  assert.equal(asignaciones101.length, 2);
  assert.ok(asignaciones101.every((a) => a.activo === false));

  // Intentar guardar con la versión vieja debe lanzar 409 Conflict
  assert.throws(
    () =>
      ejecutarOperacionContratoEnMemoria(
        "proyectos.guardar",
        payloadCierre,
        "token-prueba"
      ),
    (err) => err.status === 409
  );
});

test("Módulo 05: Viáticos cumplen regla vigente C# (0 < monto <= 12 Bs, gastoExtra >= 0) y esquema exacto", () => {
  // Excede el tope base de 12 Bs
  const excede12Bs = validarViatico({
    idViatico: 0,
    idPasante: 1,
    fecha: "2026-10-18",
    monto: 15.0,
    concepto: "Transporte local",
    gastoExtra: 0
  });
  assert.equal(excede12Bs.valido, false);
  assert.ok(excede12Bs.errores.monto);

  // Gasto extra negativo se rechaza
  const extraNegativo = validarViatico({
    idViatico: 0,
    idPasante: 1,
    fecha: "2026-10-18",
    monto: 12.0,
    concepto: "Transporte local",
    gastoExtra: -5
  });
  assert.equal(extraNegativo.valido, false);
  assert.ok(extraNegativo.errores.gastoExtra);

  // Viático válido: 0 < monto <= 12 Bs + gastoExtra >= 0, sin campos inventados
  const valido = validarViatico({
    idViatico: 0,
    idPasante: 1,
    fecha: "2026-10-18",
    monto: 12.0,
    concepto: "Pasaje urbano y traslado de herramientas",
    gastoExtra: 20.0,
    idProyecto: 101,
    categoria: "Transporte",
    comprobante: "REC-01"
  });
  assert.equal(valido.valido, true);
  assert.deepEqual(Object.keys(valido.payload), [
    "idViatico",
    "idPasante",
    "fecha",
    "monto",
    "concepto",
    "gastoExtra"
  ]);
});

test("Módulo 05: Endpoint exige Bearer token (401), valida permisos (403) y concilia totales con Reportes", () => {
  reiniciarMemoriaOperaciones();

  // Sin Bearer token -> 401
  const resSinToken = crearRespuestaMock();
  handlerOperaciones(
    {
      method: "POST",
      headers: {},
      body: { operacion: "proyectos.listar", datos: {} }
    },
    resSinToken
  );
  assert.equal(resSinToken.statusCode, 401);

  // Iniciar sesión como Encargado y verificar que no puede eliminar viáticos (403)
  const resLoginEncargado = crearRespuestaMock();
  handlerOperaciones(
    {
      method: "POST",
      headers: {},
      body: {
        operacion: "sesion",
        datos: { usuario: "encargado.campo", password: "123" }
      }
    },
    resLoginEncargado
  );
  assert.equal(resLoginEncargado.statusCode, 200);
  const tokenEncargado = resLoginEncargado.body.accessToken;

  const resEliminarProhibido = crearRespuestaMock();
  handlerOperaciones(
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${tokenEncargado}`,
        "x-rol-usuario": "SuperAdmin" // No se confía en x-rol-usuario
      },
      body: { operacion: "viaticos.eliminar", datos: { id: 501 } }
    },
    resEliminarProhibido
  );
  assert.equal(resEliminarProhibido.statusCode, 403);

  // Conciliación de totales: Personal de planta guarda 0 horasRequeridas y aplicaMetaPasantia === false
  const resumen = calcularTotalesYResumenReportes({
    proyectos: mockProyectos,
    personal: mockPersonal,
    asignaciones: mockAsignaciones,
    viaticos: mockViaticos,
    filtros: { idProyecto: 101 }
  });
  const planta = resumen.porPersona.find(
    (p) => p.tipoContrato === "Personal de planta"
  );
  const pasante = resumen.porPersona.find((p) => p.tipoContrato === "Pasante");
  assert.equal(planta.horasRequeridas, 0);
  assert.equal(planta.aplicaMetaPasantia, false);
  assert.equal(pasante.aplicaMetaPasantia, true);
});
