import test from "node:test";
import assert from "node:assert/strict";
import { crearBackend } from "../server/backend-modulos.js";
import {
  TIPOS_CONTRATO,
  TURNOS_CSHARP,
  DIAS_TRABAJO_CSHARP,
  HORAS_META_DEFECTO,
  formatearMinutosAcumulados,
  calcularAvanceDesdeMinutos,
  prepararFichaParaGuardar,
  guardarPersonal,
  listarPersonalActivo,
  listarPersonalHistorico,
  obtenerPersonal,
  eliminarPersonal,
  recalcularPersonal
} from "../src/modules/personal/personalApi.js";

function crearFetchConBackend(upstreamHandler) {
  const handler = crearBackend({
    configuracion: () => "https://api.example",
    fetchApi: upstreamHandler
  });

  return async function fetchSimulado(url, opciones = {}) {
    assert.equal(url, "/api/backend");
    const req = {
      method: opciones.method || "GET",
      headers: {
        authorization:
          opciones.headers?.Authorization || opciones.headers?.authorization
      },
      body: opciones.body
    };
    const res = {
      statusCode: 200,
      headers: {},
      texto: "",
      setHeader(k, v) {
        this.headers[k] = v;
      },
      end(str) {
        this.texto = str;
      }
    };
    await handler(req, res);
    return new Response(res.texto, { status: res.statusCode, headers: res.headers });
  };
}

test("Módulo 02: Constantes respetan exactamente los tipos, turnos y días de C#", () => {
  assert.deepEqual(TIPOS_CONTRATO, ["Pasante", "Personal de planta"]);
  assert.deepEqual(TURNOS_CSHARP, [
    "Tiempo Completo",
    "Medio Tiempo",
    "Turno Mañana (Medio Tiempo)",
    "Turno Tarde (Medio Tiempo)"
  ]);
  assert.deepEqual(DIAS_TRABAJO_CSHARP, [
    "Lunes a Viernes",
    "Lunes a Sábado",
    "Lunes a Domingo",
    "Sábados y Domingos"
  ]);
  assert.equal(HORAS_META_DEFECTO, 600);
});

test("Módulo 02: Personal de planta guarda siempre 0 horas y Pasante usa 600 por defecto", () => {
  const planta = prepararFichaParaGuardar({
    nombres: "Carlos Andrés",
    apellidos: "Mendoza Quispe",
    tipoContrato: "Personal de planta",
    horasRequeridas: 600
  });
  assert.equal(planta.tipoContrato, "Personal de planta");
  assert.equal(planta.horasRequeridas, 0);
  assert.equal(planta.fechaFin, null);
  assert.equal(calcularAvanceDesdeMinutos(planta, 12000), null);

  const pasante = prepararFichaParaGuardar({
    nombres: "Valeria",
    apellidos: "Flores Condori",
    tipoContrato: "Pasante"
  });
  assert.equal(pasante.tipoContrato, "Pasante");
  assert.equal(pasante.horasRequeridas, 600);
  assert.equal(pasante.idPasante, 0);
});

test("Módulo 02: Cambiar fechaInicio de persona existente exige SuperAdmin y edición conserva campos", () => {
  const fichaOriginal = {
    idPasante: 15,
    codigo: "P0015",
    nombres: "Valeria",
    apellidos: "Flores",
    tipoContrato: "Pasante",
    horasRequeridas: 600,
    fechaInicio: "2026-08-17",
    turno: "Turno Mañana (Medio Tiempo)",
    diasTrabajo: "Lunes a Viernes",
    universidad: "UMSA",
    activo: true
  };

  assert.throws(
    () =>
      prepararFichaParaGuardar(
        { ...fichaOriginal, fechaInicio: "2026-09-01" },
        { usuarioActual: { rol: "Admin" }, fichaExistente: fichaOriginal }
      ),
    (err) => err.status === 400 && Boolean(err.errores?.fechaInicio)
  );

  const editadaPorSuperAdmin = prepararFichaParaGuardar(
    { ...fichaOriginal, fechaInicio: "2026-09-01", apellidos: "Flores Condori" },
    { usuarioActual: { rol: "SuperAdmin" }, fichaExistente: fichaOriginal }
  );
  assert.equal(editadaPorSuperAdmin.fechaInicio, "2026-09-01");
  assert.equal(editadaPorSuperAdmin.universidad, "UMSA");
  assert.equal(editadaPorSuperAdmin.codigo, "P0015");
});

test("Módulo 02: Tiempos en minutos mayores a 24 h se calculan desde asistencias sin Date del navegador", () => {
  const acumulado = formatearMinutosAcumulados(14430); // 240 h 30 min
  assert.equal(acumulado.horas, 240);
  assert.equal(acumulado.minutos, 30);
  assert.equal(acumulado.texto, "240 h 30 min");

  const avance = calcularAvanceDesdeMinutos(
    { tipoContrato: "Pasante", horasRequeridas: 600 },
    18000 // 300 horas
  );
  assert.equal(avance.porcentaje, 50);
  assert.equal(avance.cumplido.texto, "300 h 00 min");
  assert.equal(avance.pendiente.texto, "300 h 00 min");
});

test("Módulo 02: Operaciones cliente llaman a POST /api/backend con Bearer token y mapean a C#", async () => {
  const operacionesRecibidas = [];
  const fetchSimulado = crearFetchConBackend(async (url, opciones) => {
    const rutaOperacion = url.replace("https://api.example/api/operaciones/", "");
    const cuerpo = JSON.parse(opciones.body);
    operacionesRecibidas.push({
      rutaOperacion,
      auth: opciones.headers.Authorization,
      cuerpo
    });
    return new Response(
      JSON.stringify({
        ...cuerpo,
        idPasante: 7,
        codigo: "P0007"
      }),
      { status: 200 }
    );
  });

  const guardada = await guardarPersonal(
    {
      nombres: "Diego",
      apellidos: "Choque",
      tipoContrato: "Pasante",
      horasRequeridas: 600,
      turno: "Turno Mañana (Medio Tiempo)",
      diasTrabajo: "Lunes a Viernes"
    },
    "token-real",
    { fetchImpl: fetchSimulado }
  );

  assert.equal(guardada.idPasante, 7);
  assert.equal(guardada.codigo, "P0007");

  await listarPersonalActivo("token-real", 3, { fetchImpl: fetchSimulado });
  await listarPersonalHistorico("token-real", { fetchImpl: fetchSimulado });
  await obtenerPersonal("P0007", "token-real", { fetchImpl: fetchSimulado });
  await recalcularPersonal(7, "token-real", { fetchImpl: fetchSimulado });
  await eliminarPersonal(7, "token-real", { fetchImpl: fetchSimulado });

  assert.deepEqual(
    operacionesRecibidas.map((o) => o.rutaOperacion),
    [
      "personal.guardar",
      "personal.listar",
      "personal.historico",
      "personal.obtener",
      "personal.recalcular",
      "personal.eliminar"
    ]
  );
  assert.ok(operacionesRecibidas.every((o) => o.auth === "Bearer token-real"));
});
