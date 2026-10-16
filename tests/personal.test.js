import test from "node:test";
import assert from "node:assert/strict";
import personalHandler from "../api/personal.js";
import {
  reiniciarAlmacenPersonal,
  HORAS_META_PASANTE_DEFECTO
} from "../server/personalService.js";

function crearRespuestaMock() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    end(payload) {
      this.body = payload ? JSON.parse(payload) : null;
    }
  };
}

test("Módulo 02: GET /api/personal lista registros y calcula resumen", async () => {
  reiniciarAlmacenPersonal();
  const res = crearRespuestaMock();
  await personalHandler({ method: "GET", url: "/api/personal" }, res);

  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.body.items));
  assert.equal(res.body.items.length, 4);
  assert.equal(res.body.resumen.total, 4);
  assert.equal(res.body.configuracion.horasMetaPasanteDefecto, 600);
});

test("Módulo 02: Personal de planta no guarda ni muestra meta de pasantía", async () => {
  reiniciarAlmacenPersonal();
  const res = crearRespuestaMock();
  await personalHandler(
    {
      method: "POST",
      url: "/api/personal",
      body: {
        nombres: "Roberto",
        apellidos: "Salazar",
        tipo: "planta",
        horasMeta: 600 // Incluso si alguien envía horasMeta, planta debe ignorarlo
      }
    },
    res
  );

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.persona.codigo, "PER-005");
  assert.equal(res.body.persona.tipo, "planta");
  assert.equal(res.body.persona.pasantia, null);
});

test("Módulo 02: Pasante recibe 600 horas por defecto y calcula fecha de fin con turnos, feriados e incidencias", async () => {
  reiniciarAlmacenPersonal();
  const res = crearRespuestaMock();
  await personalHandler(
    {
      method: "POST",
      url: "/api/personal",
      body: {
        nombres: "Ana Sofía",
        apellidos: "Torrez",
        tipo: "pasante",
        turno: "pasantia_6h",
        fechaInicio: "2026-10-05",
        diasFeriados: 2,
        diasIncidencias: 1
      }
    },
    res
  );

  assert.equal(res.statusCode, 201);
  const p = res.body.persona;
  assert.equal(p.tipo, "pasante");
  assert.ok(p.pasantia);
  assert.equal(p.pasantia.horasMeta, HORAS_META_PASANTE_DEFECTO);
  assert.equal(p.pasantia.horasCumplidas, 0);
  assert.equal(p.pasantia.horasPendientes, 600);
  assert.equal(p.pasantia.diasFeriados, 2);
  assert.equal(p.pasantia.diasIncidencias, 1);
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(p.pasantia.fechaFinEstimada));
});

test("Módulo 02: Edición, baja lógica, recuperación y progreso conservan historial y datos de escritorio", async () => {
  reiniciarAlmacenPersonal();

  // 1. Editar pasante existente (per-2 tiene datosEscritorio ESC-102)
  const resEdit = crearRespuestaMock();
  await personalHandler(
    {
      method: "PUT",
      url: "/api/personal",
      body: {
        id: "per-2",
        nombres: "Valeria Alejandra",
        apellidos: "Flores Condori",
        tipo: "pasante",
        horasCumplidas: 300,
        diasFeriados: 3,
        diasIncidencias: 2
      }
    },
    resEdit
  );

  assert.equal(resEdit.statusCode, 200);
  assert.equal(resEdit.body.persona.pasantia.horasCumplidas, 300);
  assert.equal(resEdit.body.persona.pasantia.horasPendientes, 300);
  assert.equal(resEdit.body.persona.pasantia.porcentajeProgreso, 50);
  // Conserva datos existentes del escritorio
  assert.equal(resEdit.body.persona.datosEscritorio.escritorioId, "ESC-102");

  // 2. Registrar baja lógica con motivo
  const resBaja = crearRespuestaMock();
  await personalHandler(
    {
      method: "PATCH",
      url: "/api/personal",
      body: {
        id: "per-2",
        estado: "baja",
        motivo: "Pausa temporal por exámenes"
      }
    },
    resBaja
  );

  assert.equal(resBaja.statusCode, 200);
  assert.equal(resBaja.body.persona.estado, "baja");
  assert.equal(resBaja.body.persona.motivoBaja, "Pausa temporal por exámenes");

  // 3. Recuperar / reactivar conservando historial acumulado
  const resRec = crearRespuestaMock();
  await personalHandler(
    {
      method: "PATCH",
      url: "/api/personal",
      body: {
        id: "per-2",
        estado: "activo",
        motivo: "Reincorporación autorizada"
      }
    },
    resRec
  );

  assert.equal(resRec.statusCode, 200);
  assert.equal(resRec.body.persona.estado, "activo");
  assert.ok(resRec.body.persona.historial.length >= 5);
});
