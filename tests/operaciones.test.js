import test from "node:test";
import assert from "node:assert/strict";
import handlerOperaciones, { reiniciarMemoriaOperaciones } from "../api/operaciones.js";
import {
  validarAsignacion,
  validarViatico,
  ejecutarCierreProyecto,
  ejecutarBajaViatico,
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

test("Módulo 05: Las asignaciones respetan las fechas del proyecto", () => {
  // Proyecto 101 va del 2026-10-01 al 2026-11-30
  const fueraDeRango = validarAsignacion(
    {
      idProyecto: 101,
      idPersonal: 3,
      funcion: "Técnica de control",
      fechaInicio: "2026-09-25",
      fechaFin: "2026-10-20"
    },
    mockProyectos,
    mockAsignaciones
  );
  assert.equal(fueraDeRango.valido, false);
  assert.ok(fueraDeRango.errores.periodo);

  const dentroDeRango = validarAsignacion(
    {
      idProyecto: 101,
      idPersonal: 3,
      funcion: "Técnica de control",
      fechaInicio: "2026-10-05",
      fechaFin: "2026-10-25"
    },
    mockProyectos,
    mockAsignaciones
  );
  assert.equal(dentroDeRango.valido, true);
});

test("Módulo 05: Prevención de asignaciones activas duplicadas en períodos solapados", () => {
  // Persona 1 ya está asignada activamente en Proyecto 101 del 2026-10-02 al 2026-10-31
  const duplicada = validarAsignacion(
    {
      idProyecto: 101,
      idPersonal: 1,
      funcion: "Apoyo adicional",
      fechaInicio: "2026-10-15",
      fechaFin: "2026-11-10"
    },
    mockProyectos,
    mockAsignaciones
  );
  assert.equal(duplicada.valido, false);
  assert.ok(duplicada.errores.duplicado);
});

test("Módulo 05: Cierre de proyecto exige rol administrador y conserva participaciones", () => {
  const intentoOperador = ejecutarCierreProyecto({
    idProyecto: 101,
    motivoCierre: "Intento sin permiso",
    rolUsuario: "operador",
    proyectos: structuredClone(mockProyectos),
    asignaciones: structuredClone(mockAsignaciones)
  });
  assert.equal(intentoOperador.ok, false);
  assert.equal(intentoOperador.codigo, 403);

  const cierreAdmin = ejecutarCierreProyecto({
    idProyecto: 101,
    motivoCierre: "Culminación de mantenimiento programado",
    rolUsuario: "administrador",
    proyectos: structuredClone(mockProyectos),
    asignaciones: structuredClone(mockAsignaciones)
  });
  assert.equal(cierreAdmin.ok, true);
  assert.equal(cierreAdmin.participacionesConservadas, 2);
  const participaciones101 = cierreAdmin.asignaciones.filter((a) => a.idProyecto === 101);
  assert.equal(participaciones101.length, 2);
  assert.ok(participaciones101.every((a) => a.estado === "Cerrada por proyecto"));
});

test("Módulo 05: Viáticos validan topes vigentes y gastos adicionales justificados", () => {
  // Excede tope de Transporte (Bs 200) sin usar gasto adicional
  const excedeTope = validarViatico(
    {
      idProyecto: 101,
      idPersonal: 1,
      categoria: "Transporte",
      monto: 260,
      esGastoAdicional: false,
      descripcion: "Traslado interprovincial",
      fecha: "2026-10-18"
    },
    mockProyectos,
    mockAsignaciones
  );
  assert.equal(excedeTope.valido, false);
  assert.ok(excedeTope.errores.monto);

  // Gasto adicional válido con comprobante y justificación
  const conAdicionalValido = validarViatico(
    {
      idProyecto: 101,
      idPersonal: 1,
      categoria: "Transporte",
      monto: 180,
      esGastoAdicional: true,
      montoAdicional: 70,
      comprobante: "FAC-9001",
      descripcion: "Traslado de equipo pesado",
      justificacionAdicional: "Flete extraordinario autorizado por jefatura de planta.",
      fecha: "2026-10-18"
    },
    mockProyectos,
    mockAsignaciones
  );
  assert.equal(conAdicionalValido.valido, true);
});

test("Módulo 05: Baja de viáticos rechaza rol operador en backend y audita con administrador", () => {
  reiniciarMemoriaOperaciones();

  const resProhibido = crearRespuestaMock();
  handlerOperaciones(
    {
      method: "POST",
      headers: { "x-rol-usuario": "operador" },
      body: {
        tipoOperacion: "BAJA_VIATICO",
        datos: { idViatico: 501, motivoBaja: "Error de carga" }
      }
    },
    resProhibido
  );
  assert.equal(resProhibido.statusCode, 403);

  const resAutorizado = crearRespuestaMock();
  handlerOperaciones(
    {
      method: "POST",
      headers: { "x-rol-usuario": "administrador" },
      body: {
        tipoOperacion: "BAJA_VIATICO",
        datos: { idViatico: 501, motivoBaja: "Anulación autorizada por duplicidad de recibo" }
      }
    },
    resAutorizado
  );
  assert.equal(resAutorizado.statusCode, 200);
  const viatico501 = resAutorizado.body.viaticos.find((v) => v.id === 501);
  assert.equal(viatico501.estado, "Baja");
});

test("Módulo 05: Los totales coinciden con el contrato de reportes y Planta no recibe meta de pasantía", () => {
  reiniciarMemoriaOperaciones();

  const calculadoDirecto = calcularTotalesYResumenReportes({
    proyectos: mockProyectos,
    personal: mockPersonal,
    asignaciones: mockAsignaciones,
    viaticos: mockViaticos,
    filtros: { idProyecto: 101 }
  });

  const resReporte = crearRespuestaMock();
  handlerOperaciones(
    {
      method: "GET",
      url: "/api/operaciones?accion=resumen-reportes&idProyecto=101"
    },
    resReporte
  );

  assert.equal(resReporte.statusCode, 200);
  assert.equal(
    resReporte.body.resumen.resumenGlobal.totalGeneralConciliado,
    calculadoDirecto.resumenGlobal.totalGeneralConciliado
  );

  // Verificar que Planta tiene aplicaMetaPasantia === false y Pasante === true
  const personaPlanta = resReporte.body.resumen.porPersona.find((p) => p.tipo === "Planta");
  const personaPasante = resReporte.body.resumen.porPersona.find((p) => p.tipo === "Pasante");
  assert.equal(personaPlanta.aplicaMetaPasantia, false);
  assert.equal(personaPasante.aplicaMetaPasantia, true);
});
