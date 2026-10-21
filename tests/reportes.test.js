import test from "node:test";
import assert from "node:assert/strict";
import {
  RUTA_BACKEND,
  formatearMinutos,
  formatearHoraLimpia,
  esPersonaPasante,
  calcularMetricasPasantia,
  normalizarFiltroReporte,
  conciliarAsistenciaYViaticos,
  paginarResultados,
  escaparCeldaCsv,
  generarCsvReporte,
  generarExcelTablaReporte,
  consultarReporteHistorial,
  consultarReporteSeguimiento,
  consultarReporteAsignaciones,
  consultarReporteIndividual,
  consultarReporteMarcas,
  listarViaticosPeriodo
} from "../src/modules/reportes/reportesApi.js";

test("Módulo 04: formatearMinutos calcula horas y minutos mayores a 24 h sin usar Date", () => {
  const corto = formatearMinutos(525);
  assert.equal(corto.horas, 8);
  assert.equal(corto.minutos, 45);
  assert.equal(corto.texto, "8 h 45 min");

  const masDe24h = formatearMinutos(8560);
  assert.equal(masDe24h.horas, 142);
  assert.equal(masDe24h.minutos, 40);
  assert.equal(masDe24h.texto, "142 h 40 min");

  const meta600h = formatearMinutos(36000);
  assert.equal(meta600h.horas, 600);
  assert.equal(meta600h.minutos, 0);
  assert.equal(meta600h.texto, "600 h 00 min");
});

test("Módulo 04: el personal de planta no recibe metas de pasantía y los pasantes calculan cumplidas y pendientes", () => {
  const planta = {
    codigo: "P00008",
    nombres: "Planta",
    apellidos: "Demo",
    tipoContrato: "Personal de planta",
    horasRequeridas: 0,
    minutosTotales: 9600
  };
  assert.equal(esPersonaPasante(planta), false);
  assert.equal(calcularMetricasPasantia(planta), null);

  const plantaPorHorasCero = {
    codigo: "P00010",
    nombres: "Planta",
    apellidos: "SinMeta",
    horasRequeridas: 0,
    minutosTotales: 4800
  };
  assert.equal(esPersonaPasante(plantaPorHorasCero), false);
  assert.equal(calcularMetricasPasantia(plantaPorHorasCero), null);

  const pasante = {
    codigo: "P00001",
    nombres: "Roberto Carlos",
    apellidos: "Gómez Bolaños",
    tipoContrato: "Pasante",
    horasRequeridas: 600,
    minutosTotales: 8560
  };
  assert.equal(esPersonaPasante(pasante), true);
  const metricas = calcularMetricasPasantia(pasante);
  assert.ok(metricas);
  assert.equal(metricas.horasRequeridas, 600);
  assert.equal(metricas.minutosMeta, 36000);
  assert.equal(metricas.minutosCumplidos, 8560);
  assert.equal(metricas.minutosPendientes, 27440);
  assert.equal(metricas.cumplido.texto, "142 h 40 min");
  assert.equal(metricas.pendiente.texto, "457 h 20 min");
  assert.equal(metricas.porcentaje, 24);
});

test("Módulo 04: concilia totales de asistencia y viáticos respetando pasantes vs planta", () => {
  const seguimiento = [
    {
      idPasante: 1,
      codigo: "P00001",
      nombres: "Roberto",
      apellidos: "Gómez",
      horasRequeridas: 600
    },
    {
      idPasante: 2,
      codigo: "P00008",
      nombres: "Ana",
      apellidos: "Planta",
      horasRequeridas: 0
    }
  ];

  const historial = [
    {
      idPasante: 1,
      codigo: "P00001",
      nombreCompleto: "Roberto Gómez",
      minutosTrabajados: 480
    },
    {
      idPasante: 1,
      codigo: "P00001",
      nombreCompleto: "Roberto Gómez",
      minutosTrabajados: 510
    },
    {
      idPasante: 2,
      codigo: "P00008",
      nombreCompleto: "Ana Planta",
      minutosTrabajados: 600
    }
  ];

  const viaticos = [
    { idViatico: 10, idPasante: 1, monto: 25.5, gastoExtra: 4.5 },
    { idViatico: 11, idPasante: 1, monto: 20, gastoExtra: 0 },
    { idViatico: 12, idPasante: 2, monto: 30, gastoExtra: 10 }
  ];

  const conciliacion = conciliarAsistenciaYViaticos(
    historial,
    viaticos,
    seguimiento
  );

  assert.equal(conciliacion.totalRegistrosAsistencia, 3);
  assert.equal(conciliacion.totalMinutosAsistencia, 1590);
  assert.equal(conciliacion.tiempoTotalFormateado.texto, "26 h 30 min");
  assert.equal(conciliacion.cantidadViaticos, 3);
  assert.equal(conciliacion.totalMontoBase, 75.5);
  assert.equal(conciliacion.totalGastoExtra, 14.5);
  assert.equal(conciliacion.totalViaticosBs, 90);

  const personaPasante = conciliacion.porPersona.find(
    (p) => p.codigo === "P00001"
  );
  const personaPlanta = conciliacion.porPersona.find(
    (p) => p.codigo === "P00008"
  );

  assert.equal(personaPasante.minutosTrabajados, 990);
  assert.equal(personaPasante.totalViaticosBs, 50);
  assert.ok(personaPasante.pasantia);
  assert.equal(personaPasante.pasantia.minutosPendientes, 36000 - 990);

  assert.equal(personaPlanta.minutosTrabajados, 600);
  assert.equal(personaPlanta.totalViaticosBs, 40);
  assert.equal(personaPlanta.pasantia, null);
});

test("Módulo 04: paginarResultados soporta reportes con varias páginas y estados vacíos", () => {
  const registros = Array.from({ length: 42 }, (_, i) => ({
    id: i + 1,
    codigo: `P${String(i + 1).padStart(5, "0")}`
  }));

  const pag1 = paginarResultados(registros, 1, 15);
  assert.equal(pag1.totalItems, 42);
  assert.equal(pag1.totalPaginas, 3);
  assert.equal(pag1.paginaActual, 1);
  assert.equal(pag1.desdeRegistro, 1);
  assert.equal(pag1.hastaRegistro, 15);
  assert.equal(pag1.itemsPagina.length, 15);
  assert.equal(pag1.itemsPagina[0].id, 1);

  const pag2 = paginarResultados(registros, 2, 15);
  assert.equal(pag2.paginaActual, 2);
  assert.equal(pag2.desdeRegistro, 16);
  assert.equal(pag2.hastaRegistro, 30);
  assert.equal(pag2.itemsPagina.length, 15);
  assert.equal(pag2.itemsPagina[0].id, 16);

  const pag3 = paginarResultados(registros, 3, 15);
  assert.equal(pag3.paginaActual, 3);
  assert.equal(pag3.desdeRegistro, 31);
  assert.equal(pag3.hastaRegistro, 42);
  assert.equal(pag3.itemsPagina.length, 12);
  assert.equal(pag3.itemsPagina[11].id, 42);

  // Si se solicita una página mayor al total, ajusta a la última página válida
  const fueraRango = paginarResultados(registros, 99, 15);
  assert.equal(fueraRango.paginaActual, 3);

  // Estado vacío
  const vacio = paginarResultados([], 1, 15);
  assert.equal(vacio.totalItems, 0);
  assert.equal(vacio.totalPaginas, 1);
  assert.equal(vacio.desdeRegistro, 0);
  assert.equal(vacio.hastaRegistro, 0);
  assert.equal(vacio.itemsPagina.length, 0);
});

test("Módulo 04: generarCsvReporte y generarExcelTablaReporte exportan columnas separadas para Excel con BOM UTF-8", () => {
  assert.equal(formatearHoraLimpia("10:40:49.4735890"), "10:40:49");
  assert.equal(formatearHoraLimpia("08:00:00"), "08:00:00");
  assert.equal(escaparCeldaCsv('Proyecto "A", Fase 1'), '"Proyecto ""A"", Fase 1"');
  const columnas = [
    { etiqueta: "Código", clave: "codigo" },
    { etiqueta: "Nombre", clave: "nombre" },
    { etiqueta: "Meta", obtener: (f) => (f.horasRequeridas > 0 ? `${f.horasRequeridas} h` : "No aplica (Planta)") }
  ];
  const filas = [
    { codigo: "P00001", nombre: "Roberto, Gómez", horasRequeridas: 600 },
    { codigo: "P00008", nombre: "Ana Planta", horasRequeridas: 0 }
  ];
  const csv = generarCsvReporte(columnas, filas);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes("Código;Nombre;Meta\r\n"));
  assert.ok(csv.includes('P00001;"Roberto, Gómez";600 h'));
  assert.ok(csv.includes("P00008;Ana Planta;No aplica (Planta)"));

  const xls = generarExcelTablaReporte({
    titulo: "Reporte Prueba",
    filtros: { periodo: "2026-10-01 al 2026-10-20" },
    columnas,
    filas
  });
  assert.ok(xls.startsWith("\uFEFF<html"));
  assert.ok(xls.includes("Reporte Prueba"));
  assert.ok(xls.includes("P00001"));
  assert.ok(xls.includes("No aplica (Planta)"));
});

test("Módulo 04: operaciones de reportes envían los mismos filtros normalizados a POST /api/backend", async () => {
  const llamadas = [];
  const fetchMock = async (url, opciones) => {
    llamadas.push({
      url,
      headers: opciones.headers,
      body: JSON.parse(opciones.body)
    });
    return new Response(JSON.stringify([{ ok: true }]), { status: 200 });
  };

  const filtroEntrada = {
    inicio: "2026-10-01",
    fin: "2026-10-20",
    idProyecto: "2",
    id: "28",
    codigo: " P00009 "
  };
  const filtroNormalizado = normalizarFiltroReporte(filtroEntrada);
  assert.deepEqual(filtroNormalizado, {
    inicio: "2026-10-01",
    fin: "2026-10-20",
    idProyecto: 2,
    id: 28,
    codigo: "P00009"
  });

  await consultarReporteHistorial(filtroEntrada, "token-demo", { fetchImpl: fetchMock });
  await consultarReporteSeguimiento(filtroEntrada, "token-demo", { fetchImpl: fetchMock });
  await consultarReporteAsignaciones(filtroEntrada, "token-demo", { fetchImpl: fetchMock });
  await consultarReporteMarcas(filtroEntrada, "token-demo", { fetchImpl: fetchMock });
  await consultarReporteIndividual("P00009", "token-demo", { fetchImpl: fetchMock });
  await listarViaticosPeriodo(filtroEntrada, "token-demo", { fetchImpl: fetchMock });

  assert.equal(llamadas.length, 6);
  for (const llamada of llamadas) {
    assert.equal(llamada.url, RUTA_BACKEND);
    assert.equal(llamada.headers.Authorization, "Bearer token-demo");
  }
  assert.equal(llamadas[0].body.operacion, "reportes.historial");
  assert.deepEqual(llamadas[0].body.datos, filtroNormalizado);

  assert.equal(llamadas[1].body.operacion, "reportes.seguimiento");
  assert.deepEqual(llamadas[1].body.datos, filtroNormalizado);

  assert.equal(llamadas[2].body.operacion, "reportes.asignaciones");
  assert.deepEqual(llamadas[2].body.datos, { idProyecto: 2, id: 28 });

  assert.equal(llamadas[3].body.operacion, "reportes.marcas");
  assert.deepEqual(llamadas[3].body.datos, { idProyecto: 2 });

  assert.equal(llamadas[4].body.operacion, "reportes.individual");
  assert.deepEqual(llamadas[4].body.datos, { codigo: "P00009" });

  assert.equal(llamadas[5].body.operacion, "viaticos.listar");
  assert.deepEqual(llamadas[5].body.datos, {
    inicio: "2026-10-01",
    fin: "2026-10-20",
    id: 28
  });
});
