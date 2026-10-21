import test from "node:test";
import assert from "node:assert/strict";
import {
  RUTA_BACKEND,
  hoyBolivia,
  normalizarHoraCSharp,
  formatearHoraVista,
  formatearMinutosJornada,
  evaluarEstadoJornada,
  validarSecuenciaJornada,
  construirRegistroManual,
  ejecutarConReintentoIdempotente,
  registrarMarcacionRapidaIdempotente,
  enviarSolicitudCorreccionIdempotente,
  revisarSolicitudCorreccion,
  revisarSolicitudQr
} from "../src/modules/asistencia/asistenciaApi.js";

test("Módulo 03: normaliza horas al formato C# HH:mm:ss y formatea minutos de jornada", () => {
  assert.equal(normalizarHoraCSharp("08:30"), "08:30:00");
  assert.equal(normalizarHoraCSharp("10:40:49.4735890"), "10:40:49");
  assert.equal(formatearHoraVista("10:40:49.4735890"), "10:40:49");
  assert.equal(formatearHoraVista(null), "—");

  const t = formatearMinutosJornada(510);
  assert.equal(t.horas, 8);
  assert.equal(t.minutos, 30);
  assert.equal(t.texto, "8 h 30 min");
});

test("Módulo 03: valida secuencia de jornada y evita marcaciones duplicadas", () => {
  // Sin registro previo: solo entrada permitida
  const vacio = {};
  assert.equal(validarSecuenciaJornada(vacio, "entrada").valido, true);
  assert.equal(validarSecuenciaJornada(vacio, "inicio-almuerzo").valido, false);
  assert.equal(validarSecuenciaJornada(vacio, "fin-almuerzo").valido, false);
  assert.equal(validarSecuenciaJornada(vacio, "salida").valido, false);

  // Con entrada registrada: no permite duplicar entrada; permite inicio-almuerzo o salida
  const conEntrada = { horaEntrada: "08:00:00" };
  assert.equal(validarSecuenciaJornada(conEntrada, "entrada").valido, false);
  assert.equal(validarSecuenciaJornada(conEntrada, "inicio-almuerzo").valido, true);
  assert.equal(validarSecuenciaJornada(conEntrada, "fin-almuerzo").valido, false);
  assert.equal(validarSecuenciaJornada(conEntrada, "salida").valido, true);

  // En almuerzo: exige fin-almuerzo antes de salida
  const enAlmuerzo = { horaEntrada: "08:00:00", horaInicioAlmuerzo: "12:00:00" };
  assert.equal(validarSecuenciaJornada(enAlmuerzo, "inicio-almuerzo").valido, false);
  assert.equal(validarSecuenciaJornada(enAlmuerzo, "salida").valido, false);
  assert.equal(validarSecuenciaJornada(enAlmuerzo, "fin-almuerzo").valido, true);

  // Almuerzo finalizado: permite salida
  const finAlmuerzo = {
    horaEntrada: "08:00:00",
    horaInicioAlmuerzo: "12:00:00",
    horaFinAlmuerzo: "13:00:00"
  };
  assert.equal(validarSecuenciaJornada(finAlmuerzo, "fin-almuerzo").valido, false);
  assert.equal(validarSecuenciaJornada(finAlmuerzo, "salida").valido, true);

  // Jornada finalizada: bloquea duplicar salida
  const cerrada = {
    horaEntrada: "08:00:00",
    horaSalida: "17:00:00"
  };
  assert.equal(evaluarEstadoJornada(cerrada).etapa, "Jornada finalizada");
  assert.equal(validarSecuenciaJornada(cerrada, "salida").valido, false);
});

test("Módulo 03: reintentos idempotentes reutilizan el mismo UUID ante error 503 y no reintentan error 409", async () => {
  const uuidsRecibidos = [];
  let llamadas = 0;

  const fetchConFalloTemporal = async (_url, opciones) => {
    llamadas++;
    const body = JSON.parse(opciones.body);
    uuidsRecibidos.push(body.datos.idOperacion);
    if (llamadas < 3) {
      return new Response(JSON.stringify({ mensaje: "Fallo temporal de red" }), {
        status: 503
      });
    }
    return new Response(JSON.stringify({ ok: true, mensaje: "Registrado" }), {
      status: 200
    });
  };

  const res = await registrarMarcacionRapidaIdempotente(
    { codigo: "P00002", accion: "entrada" },
    "token-demo",
    { fetchImpl: fetchConFalloTemporal, maxIntentos: 3, esperaMs: 5 }
  );

  assert.equal(res.intentos, 3);
  assert.equal(uuidsRecibidos.length, 3);
  assert.equal(uuidsRecibidos[0], uuidsRecibidos[1]);
  assert.equal(uuidsRecibidos[1], uuidsRecibidos[2]);

  // Ante conflicto de negocio 409 no debe reintentar
  let llamadasConflicto = 0;
  await assert.rejects(
    () =>
      ejecutarConReintentoIdempotente(
        async () => {
          llamadasConflicto++;
          const err = new Error("Marcación duplicada");
          err.status = 409;
          throw err;
        },
        { maxIntentos: 3, esperaMs: 5 }
      ),
    /Marcación duplicada/
  );
  assert.equal(llamadasConflicto, 1);
});

test("Módulo 03: construirRegistroManual restringe fecha y reemplazo para Encargado", () => {
  const hoy = hoyBolivia();
  const regEncargado = construirRegistroManual(
    {
      codigo: "P00002",
      fecha: "2026-01-15",
      horaEntrada: "08:00",
      horaSalida: "17:00",
      reemplazarExistente: true
    },
    "Encargado"
  );
  assert.equal(regEncargado.fecha, hoy);
  assert.equal(regEncargado.reemplazarExistente, false);
  assert.equal(regEncargado.horaEntrada, "08:00:00");
  assert.equal(regEncargado.horaSalida, "17:00:00");

  const regAdmin = construirRegistroManual(
    {
      codigo: "P00002",
      fecha: "2026-10-14",
      horaEntrada: "08:00",
      horaSalida: "18:40",
      reemplazarExistente: true
    },
    "SuperAdmin"
  );
  assert.equal(regAdmin.fecha, "2026-10-14");
  assert.equal(regAdmin.reemplazarExistente, true);
});

test("Módulo 03: correcciones y revisión QR envían el contrato exacto a /api/backend", async () => {
  const llamadas = [];
  const fetchMock = async (url, opciones) => {
    llamadas.push({ url, body: JSON.parse(opciones.body) });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  await enviarSolicitudCorreccionIdempotente(
    {
      id: "11111111-2222-4333-8444-555555555555",
      registro: {
        codigo: "P00002",
        fecha: "2026-10-15",
        horaEntrada: "08:00",
        horaSalida: "17:00"
      },
      motivo: "Olvidó marcar salida a tiempo"
    },
    "Encargado",
    "token-demo",
    { fetchImpl: fetchMock }
  );

  await revisarSolicitudCorreccion(
    { id: "11111111-2222-4333-8444-555555555555", aprobar: false, motivo: "Horario no coincide" },
    "token-demo",
    { fetchImpl: fetchMock }
  );

  await revisarSolicitudQr(
    { id: "99999999-2222-4333-8444-555555555555", aprobar: true, motivo: "Verificado en puerta" },
    "token-demo",
    { fetchImpl: fetchMock }
  );

  assert.equal(llamadas.length, 3);
  assert.equal(llamadas[0].url, RUTA_BACKEND);
  assert.equal(llamadas[0].body.operacion, "correcciones.enviar");
  assert.equal(llamadas[0].body.datos.id, "11111111-2222-4333-8444-555555555555");
  assert.equal(llamadas[1].body.operacion, "correcciones.revisar");
  assert.equal(llamadas[1].body.datos.aprobar, false);
  assert.equal(llamadas[2].body.operacion, "qr.revisar");
  assert.equal(llamadas[2].body.datos.aprobar, true);
});
