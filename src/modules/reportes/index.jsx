import React, { useEffect, useMemo, useState } from "react";
import ModuloBase from "../../components/ModuloBase.jsx";
import {
  hoyBolivia,
  inicioMesBolivia,
  formatearMinutos,
  esPersonaPasante,
  calcularMetricasPasantia,
  normalizarFiltroReporte,
  conciliarAsistenciaYViaticos,
  paginarResultados,
  generarCsvReporte,
  obtenerContratoBackend,
  iniciarSesion,
  obtenerSesionActual,
  registrarEncargado,
  consultarReporteHistorial,
  consultarReporteSeguimiento,
  consultarReporteAsignaciones,
  consultarReporteIndividual,
  consultarReporteMarcas,
  listarPersonalCatalogo,
  listarProyectosCatalogo,
  listarViaticosPeriodo
} from "./reportesApi.js";
import "./reportes.css";

export default function Modulo({
  modulo,
  token: tokenExterno = "",
  usuario: usuarioExterno = null
}) {
  // Sesión en memoria según BACKEND-PARA-LOS-5-MODULOS.md
  const [tokenMemoria, setTokenMemoria] = useState("");
  const [usuarioMemoria, setUsuarioMemoria] = useState(null);

  const token = tokenExterno || tokenMemoria;
  const usuario = usuarioExterno || usuarioMemoria;

  // Estado de acceso
  const [modoRegistroEncargado, setModoRegistroEncargado] = useState(false);
  const [credencialesForm, setCredencialesForm] = useState({
    usuario: "",
    password: ""
  });
  const [operacionesContrato, setOperacionesContrato] = useState([]);

  // Estado de interfaz
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
  const [verAlcanceBase, setVerAlcanceBase] = useState(false);

  // Pestaña activa: 'historial' | 'seguimiento' | 'conciliacion' | 'individual' | 'asignaciones'
  const [vistaActiva, setVistaActiva] = useState("historial");

  // Filtros unificados para consulta, impresión A4 y exportación CSV/JSON
  const [filtro, setFiltro] = useState(() => ({
    inicio: inicioMesBolivia(),
    fin: hoyBolivia(),
    idProyecto: "",
    id: "",
    codigo: ""
  }));
  const [busquedaTexto, setBusquedaTexto] = useState("");

  // Paginación para reportes de varias páginas
  const [paginaActual, setPaginaActual] = useState(1);
  const [filasPorPagina, setFilasPorPagina] = useState(15);

  // Catálogos y datos del servidor C#
  const [catalogoPersonal, setCatalogoPersonal] = useState([]);
  const [catalogoProyectos, setCatalogoProyectos] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [seguimiento, setSeguimiento] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [marcasReporte, setMarcasReporte] = useState([]);
  const [viaticos, setViaticos] = useState([]);
  const [reporteIndividual, setReporteIndividual] = useState(null);

  function cerrarSesionLocal() {
    setTokenMemoria("");
    setUsuarioMemoria(null);
    setHistorial([]);
    setSeguimiento([]);
    setAsignaciones([]);
    setMarcasReporte([]);
    setViaticos([]);
    setReporteIndividual(null);
  }

  async function ejecutarTarea(accion) {
    if (ocupado) return;
    setOcupado(true);
    setError("");
    setAviso("");
    try {
      await accion();
    } catch (err) {
      setError(err.message || "No se pudo completar la consulta de reportes.");
      if (err.status === 401) {
        cerrarSesionLocal();
      }
    } finally {
      setOcupado(false);
    }
  }

  // Verificar contrato público GET /api/backend al montar
  useEffect(() => {
    let activo = true;
    obtenerContratoBackend()
      .then((contrato) => {
        if (activo && Array.isArray(contrato?.modulos?.reportes)) {
          setOperacionesContrato(contrato.modulos.reportes);
        }
      })
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, []);

  async function cargarReportes(
    tokenActivo = token,
    filtroActivo = filtro
  ) {
    if (!tokenActivo) return;
    const fNorm = normalizarFiltroReporte(filtroActivo);

    const promesas = [
      consultarReporteHistorial(fNorm, tokenActivo),
      consultarReporteSeguimiento(fNorm, tokenActivo).catch(() => []),
      consultarReporteAsignaciones(fNorm, tokenActivo).catch(() => []),
      consultarReporteMarcas(fNorm, tokenActivo).catch(() => []),
      listarViaticosPeriodo(fNorm, tokenActivo).catch(() => []),
      listarPersonalCatalogo(tokenActivo).catch(() => []),
      listarProyectosCatalogo(tokenActivo).catch(() => [])
    ];

    const [
      datosHistorial,
      datosSeguimiento,
      datosAsignaciones,
      datosMarcas,
      datosViaticos,
      listaPersonal,
      listaProyectos
    ] = await Promise.all(promesas);

    setHistorial(Array.isArray(datosHistorial) ? datosHistorial : []);
    setSeguimiento(Array.isArray(datosSeguimiento) ? datosSeguimiento : []);
    setAsignaciones(Array.isArray(datosAsignaciones) ? datosAsignaciones : []);
    setMarcasReporte(Array.isArray(datosMarcas) ? datosMarcas : []);
    setViaticos(Array.isArray(datosViaticos) ? datosViaticos : []);
    setCatalogoPersonal(Array.isArray(listaPersonal) ? listaPersonal : []);
    setCatalogoProyectos(Array.isArray(listaProyectos) ? listaProyectos : []);

    // Si hay una persona seleccionada en el filtro o estamos en vista individual, cargar su reporte individual
    const idPersona =
      fNorm.id ||
      (Array.isArray(listaPersonal) && listaPersonal[0]?.idPasante) ||
      null;
    if (idPersona) {
      const ind = await consultarReporteIndividual(idPersona, tokenActivo).catch(
        () => null
      );
      if (ind) setReporteIndividual(ind);
    }
    setPaginaActual(1);
  }

  useEffect(() => {
    if (token && usuario) {
      ejecutarTarea(() => cargarReportes(token, filtro));
    }
  }, [token, usuario]);

  async function manejarAcceso(e) {
    e.preventDefault();
    const { usuario: usr, password: pwd } = credencialesForm;
    await ejecutarTarea(async () => {
      if (modoRegistroEncargado) {
        await registrarEncargado(usr.trim(), pwd);
        setModoRegistroEncargado(false);
        setAviso("Cuenta de encargado creada. Ahora puede iniciar sesión.");
        return;
      }
      const sesion = await iniciarSesion(usr.trim(), pwd);
      const actual = await obtenerSesionActual(sesion.accessToken);
      setTokenMemoria(sesion.accessToken);
      setUsuarioMemoria(actual);
      setCredencialesForm({ usuario: "", password: "" });
      await cargarReportes(sesion.accessToken, filtro);
    });
  }

  async function aplicarFiltrosFormulario(e) {
    if (e) e.preventDefault();
    if (filtro.inicio && filtro.fin && filtro.inicio > filtro.fin) {
      setError("La fecha 'Desde' no puede ser mayor que la fecha 'Hasta'.");
      return;
    }
    await ejecutarTarea(() => cargarReportes(token, filtro));
  }

  async function verReporteIndividualPersona(criterioIdOCodigo) {
    if (!criterioIdOCodigo) return;
    await ejecutarTarea(async () => {
      const detalle = await consultarReporteIndividual(criterioIdOCodigo, token);
      setReporteIndividual(detalle);
      setVistaActiva("individual");
      setPaginaActual(1);
    });
  }

  // Normalizar texto para búsqueda local unificada (afecta pantalla, impresión y exportación)
  const textoNormalizado = useMemo(
    () =>
      busquedaTexto
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""),
    [busquedaTexto]
  );

  const coincideBusqueda = (campos = []) => {
    if (!textoNormalizado) return true;
    const unido = campos
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return unido.includes(textoNormalizado);
  };

  // Mapa rápido de información de personal (para saber tipoContrato y horasRequeridas por código o ID)
  const mapaCatalogoPersonal = useMemo(() => {
    const m = {};
    for (const p of catalogoPersonal) {
      if (p.idPasante) m[`id:${p.idPasante}`] = p;
      if (p.codigo) m[`cod:${p.codigo}`] = p;
    }
    return m;
  }, [catalogoPersonal]);

  // 1. Datos filtrados de Historial (reportes.historial)
  const historialFiltrado = useMemo(() => {
    return historial.filter((item) => {
      if (
        filtro.codigo &&
        String(item.codigo || "").toLowerCase() !==
          String(filtro.codigo).trim().toLowerCase()
      ) {
        return false;
      }
      return coincideBusqueda([
        item.codigo,
        item.nombreCompleto,
        item.fecha,
        item.proyectos,
        item.ubicaciones,
        item.observaciones
      ]);
    });
  }, [historial, filtro.codigo, textoNormalizado]);

  // 2. Datos filtrados de Seguimiento del equipo y pasantías (reportes.seguimiento)
  const seguimientoFiltrado = useMemo(() => {
    return seguimiento
      .map((item) => {
        const fichaCat =
          mapaCatalogoPersonal[`cod:${item.codigo}`] ||
          mapaCatalogoPersonal[`id:${item.idPasante ?? item.id}`] ||
          {};
        const tipoContrato =
          item.tipoContrato ||
          fichaCat.tipoContrato ||
          (Number(item.horasRequeridas) > 0 ? "Pasante" : "Personal de planta");
        const registroEnriquecido = {
          ...item,
          idPasante: item.idPasante ?? fichaCat.idPasante ?? null,
          tipoContrato,
          proyectoActual: item.proyectoActual || fichaCat.proyectoActual || "",
          nombreDepartamento:
            item.nombreDepartamento || fichaCat.nombreDepartamento || "General",
          tiempoPeriodo: formatearMinutos(item.minutosPeriodo),
          tiempoTotal: formatearMinutos(item.minutosTotales),
          // Regla estricta: Planta NO recibe metas de pasantía
          metricasPasantia: calcularMetricasPasantia(
            { ...item, tipoContrato },
            item.minutosTotales
          )
        };
        return registroEnriquecido;
      })
      .filter((item) => {
        if (
          filtro.id &&
          item.idPasante &&
          Number(item.idPasante) !== Number(filtro.id)
        ) {
          return false;
        }
        if (
          filtro.codigo &&
          String(item.codigo || "").toLowerCase() !==
            String(filtro.codigo).trim().toLowerCase()
        ) {
          return false;
        }
        return coincideBusqueda([
          item.codigo,
          item.nombres,
          item.apellidos,
          item.nombreMarca,
          item.tipoContrato,
          item.proyectoActual
        ]);
      });
  }, [seguimiento, mapaCatalogoPersonal, filtro.id, filtro.codigo, textoNormalizado]);

  // 3. Conciliación de Asistencia y Viáticos
  const conciliacion = useMemo(() => {
    const base = conciliarAsistenciaYViaticos(
      historialFiltrado,
      viaticos,
      seguimientoFiltrado
    );
    const personasFiltradas = base.porPersona.filter((p) =>
      coincideBusqueda([p.codigo, p.nombreCompleto, p.tipoContrato])
    );
    return {
      ...base,
      porPersona: personasFiltradas
    };
  }, [historialFiltrado, viaticos, seguimientoFiltrado, textoNormalizado]);

  // 4. Datos filtrados de Asignaciones y Marcas
  const asignacionesFiltradas = useMemo(() => {
    return asignaciones.filter((a) =>
      coincideBusqueda([
        a.nombrePersonal,
        a.nombreProyecto,
        a.rol,
        a.fechaInicio,
        a.fechaFin
      ])
    );
  }, [asignaciones, textoNormalizado]);

  // Lista activa según la pestaña para compartir paginación, impresión A4 y exportación CSV
  const listaActivaParaPaginar = useMemo(() => {
    if (vistaActiva === "historial") return historialFiltrado;
    if (vistaActiva === "seguimiento") return seguimientoFiltrado;
    if (vistaActiva === "conciliacion") return conciliacion.porPersona;
    if (vistaActiva === "asignaciones") return asignacionesFiltradas;
    if (vistaActiva === "individual") {
      return Array.isArray(reporteIndividual?.asistencias)
        ? reporteIndividual.asistencias
        : [];
    }
    return [];
  }, [
    vistaActiva,
    historialFiltrado,
    seguimientoFiltrado,
    conciliacion,
    asignacionesFiltradas,
    reporteIndividual
  ]);

  const paginacion = useMemo(
    () =>
      paginarResultados(listaActivaParaPaginar, paginaActual, filasPorPagina),
    [listaActivaParaPaginar, paginaActual, filasPorPagina]
  );

  // Totales de asistencia del historial filtrado
  const resumenHistorial = useMemo(() => {
    let minTotal = 0;
    for (const r of historialFiltrado) {
      minTotal += Math.max(0, Math.trunc(Number(r.minutosTrabajados) || 0));
    }
    return {
      registros: historialFiltrado.length,
      minutos: minTotal,
      formateado: formatearMinutos(minTotal)
    };
  }, [historialFiltrado]);

  // Descripción legible de los filtros activos (compartida en pantalla, impresión A4 y exportación)
  const resumenFiltrosTexto = useMemo(() => {
    const proy = filtro.idProyecto
      ? catalogoProyectos.find(
          (pr) => String(pr.idProyecto ?? pr.id) === String(filtro.idProyecto)
        )
      : null;
    const pers = filtro.id
      ? catalogoPersonal.find(
          (pe) => String(pe.idPasante) === String(filtro.id)
        )
      : null;
    return {
      periodo: `${filtro.inicio || "—"} al ${filtro.fin || "—"}`,
      proyecto: proy
        ? `${proy.codigo ? `${proy.codigo} · ` : ""}${proy.nombre}`
        : "Todos los proyectos",
      persona: pers
        ? `${pers.codigo} · ${pers.nombres} ${pers.apellidos}`
        : filtro.codigo
        ? `Código: ${filtro.codigo}`
        : "Todos los empleados"
    };
  }, [filtro, catalogoProyectos, catalogoPersonal]);

  // Exportación CSV usando exactamente los mismos filtros y datos activos
  function exportarVistaActualCsv() {
    let columnas = [];
    let filas = [];
    let nombreArchivo = `reporte-${vistaActiva}-${filtro.inicio}-a-${filtro.fin}.csv`;

    if (vistaActiva === "historial") {
      columnas = [
        { etiqueta: "Fecha", obtener: (r) => String(r.fecha || "").slice(0, 10) },
        { etiqueta: "Codigo", clave: "codigo" },
        { etiqueta: "NombreCompleto", clave: "nombreCompleto" },
        { etiqueta: "HoraEntrada", obtener: (r) => r.horaEntrada || "" },
        {
          etiqueta: "HoraInicioAlmuerzo",
          obtener: (r) => r.horaInicioAlmuerzo || ""
        },
        {
          etiqueta: "HoraFinAlmuerzo",
          obtener: (r) => r.horaFinAlmuerzo || ""
        },
        { etiqueta: "HoraSalida", obtener: (r) => r.horaSalida || "" },
        {
          etiqueta: "MinutosTrabajados",
          obtener: (r) => Number(r.minutosTrabajados) || 0
        },
        {
          etiqueta: "TiempoFormateado",
          obtener: (r) => formatearMinutos(r.minutosTrabajados).texto
        },
        { etiqueta: "Proyecto", obtener: (r) => r.proyectos || "" },
        { etiqueta: "Observaciones", obtener: (r) => r.observaciones || "" }
      ];
      filas = historialFiltrado;
    } else if (vistaActiva === "seguimiento") {
      columnas = [
        { etiqueta: "Codigo", clave: "codigo" },
        { etiqueta: "Nombres", clave: "nombres" },
        { etiqueta: "Apellidos", clave: "apellidos" },
        { etiqueta: "TipoPersonal", clave: "tipoContrato" },
        {
          etiqueta: "MarcaPasantes",
          obtener: (r) =>
            r.tipoContrato === "Pasante"
              ? r.nombreMarca || "General"
              : "No aplica"
        },
        {
          etiqueta: "DiasAsistidosPeriodo",
          obtener: (r) => Number(r.diasAsistidosPeriodo) || 0
        },
        {
          etiqueta: "MinutosPeriodo",
          obtener: (r) => Number(r.minutosPeriodo) || 0
        },
        {
          etiqueta: "TiempoPeriodo",
          obtener: (r) => r.tiempoPeriodo?.texto || "0 h 00 min"
        },
        {
          etiqueta: "MetaPasantiaHoras",
          obtener: (r) =>
            r.metricasPasantia ? r.metricasPasantia.horasRequeridas : "No aplica (Planta)"
        },
        {
          etiqueta: "HorasCumplidasPasantia",
          obtener: (r) =>
            r.metricasPasantia ? r.metricasPasantia.cumplido.texto : "No aplica"
        },
        {
          etiqueta: "HorasPendientesPasantia",
          obtener: (r) =>
            r.metricasPasantia ? r.metricasPasantia.pendiente.texto : "No aplica"
        },
        {
          etiqueta: "PorcentajeAvance",
          obtener: (r) =>
            r.metricasPasantia ? `${r.metricasPasantia.porcentaje}%` : "No aplica"
        }
      ];
      filas = seguimientoFiltrado;
    } else if (vistaActiva === "conciliacion") {
      columnas = [
        { etiqueta: "Codigo", clave: "codigo" },
        { etiqueta: "Persona", clave: "nombreCompleto" },
        { etiqueta: "TipoPersonal", clave: "tipoContrato" },
        { etiqueta: "RegistrosAsistencia", clave: "registrosAsistencia" },
        { etiqueta: "MinutosTrabajados", clave: "minutosTrabajados" },
        {
          etiqueta: "TiempoTrabajado",
          obtener: (r) => r.tiempoFormateado?.texto || "0 h 00 min"
        },
        { etiqueta: "CantidadViaticos", clave: "cantidadViaticos" },
        {
          etiqueta: "ViaticoBaseBs",
          obtener: (r) => r.montoViaticos.toFixed(2)
        },
        {
          etiqueta: "GastoExtraBs",
          obtener: (r) => r.gastoExtraViaticos.toFixed(2)
        },
        {
          etiqueta: "TotalViaticosConciliadoBs",
          obtener: (r) => r.totalViaticosBs.toFixed(2)
        },
        {
          etiqueta: "EstadoPasantia",
          obtener: (r) =>
            r.pasantia
              ? `Cumplido: ${r.pasantia.cumplido.texto} / Pendiente: ${r.pasantia.pendiente.texto}`
              : "No aplica (Personal de planta)"
        }
      ];
      filas = conciliacion.porPersona;
    } else if (vistaActiva === "individual" && reporteIndividual?.personal) {
      const p = reporteIndividual.personal;
      nombreArchivo = `reporte-individual-${p.codigo || p.idPasante}-${filtro.inicio}-a-${filtro.fin}.csv`;
      columnas = [
        { etiqueta: "Codigo", obtener: () => p.codigo || "" },
        {
          etiqueta: "Persona",
          obtener: () => `${p.nombres || ""} ${p.apellidos || ""}`.trim()
        },
        {
          etiqueta: "Fecha",
          obtener: (r) => String(r.fecha || "").slice(0, 10)
        },
        { etiqueta: "HoraEntrada", obtener: (r) => r.horaEntrada || "" },
        {
          etiqueta: "HoraInicioAlmuerzo",
          obtener: (r) => r.horaInicioAlmuerzo || ""
        },
        {
          etiqueta: "HoraFinAlmuerzo",
          obtener: (r) => r.horaFinAlmuerzo || ""
        },
        { etiqueta: "HoraSalida", obtener: (r) => r.horaSalida || "" },
        {
          etiqueta: "MinutosTrabajados",
          obtener: (r) => Number(r.minutosTrabajados) || 0
        },
        {
          etiqueta: "TiempoFormateado",
          obtener: (r) => formatearMinutos(r.minutosTrabajados).texto
        },
        { etiqueta: "Observaciones", obtener: (r) => r.observaciones || "" }
      ];
      filas = Array.isArray(reporteIndividual.asistencias)
        ? reporteIndividual.asistencias
        : [];
    } else {
      columnas = [
        { etiqueta: "Personal", clave: "nombrePersonal" },
        { etiqueta: "Proyecto", clave: "nombreProyecto" },
        { etiqueta: "Rol", clave: "rol" },
        {
          etiqueta: "FechaInicio",
          obtener: (r) => String(r.fechaInicio || "").slice(0, 10)
        },
        {
          etiqueta: "FechaFin",
          obtener: (r) => (r.fechaFin ? String(r.fechaFin).slice(0, 10) : "En curso")
        },
        {
          etiqueta: "Estado",
          obtener: (r) => (r.activo === false ? "Finalizada" : "Activa")
        }
      ];
      filas = asignacionesFiltradas;
    }

    const csv = generarCsvReporte(columnas, filas);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    URL.revokeObjectURL(url);
    setAviso(
      `Exportación CSV generada (${filas.length} registros) con los mismos filtros activos.`
    );
  }

  function exportarVistaActualJson() {
    const payloadExport = {
      generadoEnBolivia: hoyBolivia(),
      vista: vistaActiva,
      filtrosAplicados: resumenFiltrosTexto,
      totalRegistros: listaActivaParaPaginar.length,
      datos:
        vistaActiva === "individual"
          ? reporteIndividual
          : listaActivaParaPaginar
    };
    const json = JSON.stringify(payloadExport, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = `reporte-${vistaActiva}-${filtro.inicio}-a-${filtro.fin}.json`;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    URL.revokeObjectURL(url);
    setAviso("Archivo JSON exportado con los mismos filtros y datos en vista.");
  }

  // Renderizador de filas de tabla (permite mostrar la página actual en pantalla y todas las páginas al imprimir en A4)
  function renderFilasHistorial(lista) {
    return lista.map((item, idx) => (
      <tr key={`${item.codigo}-${item.fecha}-${idx}`}>
        <td>{String(item.fecha || "").slice(0, 10)}</td>
        <td>
          <strong>{item.codigo}</strong>
        </td>
        <td>
          <button
            type="button"
            className="btn-reporte"
            style={{
              minHeight: "30px",
              padding: "4px 8px",
              fontSize: "12px",
              border: "none",
              background: "transparent",
              textDecoration: "underline"
            }}
            onClick={() => verReporteIndividualPersona(item.codigo)}
            title="Ver reporte individual de esta persona"
          >
            {item.nombreCompleto}
          </button>
        </td>
        <td>{item.horaEntrada || "—"}</td>
        <td>{item.horaInicioAlmuerzo || "—"}</td>
        <td>{item.horaFinAlmuerzo || "—"}</td>
        <td>{item.horaSalida || "—"}</td>
        <td>
          <strong>{Number(item.minutosTrabajados) || 0}</strong> min (
          {formatearMinutos(item.minutosTrabajados).textoCorto})
        </td>
        <td>{item.proyectos || item.observaciones || "—"}</td>
      </tr>
    ));
  }

  function renderFilasSeguimiento(lista) {
    return lista.map((item, idx) => {
      const pasantia = item.metricasPasantia;
      return (
        <tr key={`${item.codigo || idx}`}>
          <td>
            <strong>{item.codigo}</strong>
          </td>
          <td>
            {item.nombres} {item.apellidos}
          </td>
          <td>
            <span
              className={`insignia-rep ${
                pasantia ? "" : "planta"
              }`}
            >
              {item.tipoContrato}
            </span>
          </td>
          <td>
            {pasantia ? item.nombreMarca || "General" : "No aplica"}
          </td>
          <td>{Number(item.diasAsistidosPeriodo) || 0} días</td>
          <td>
            <strong>{item.tiempoPeriodo.texto}</strong> ({Number(item.minutosPeriodo) || 0} min)
          </td>
          <td>
            {pasantia ? (
              <div>
                <div>
                  <strong>Cumplido:</strong> {pasantia.cumplido.texto} de{" "}
                  {pasantia.horasRequeridas} h ({pasantia.porcentaje}%)
                </div>
                <div>
                  <strong>Pendiente:</strong> {pasantia.pendiente.texto}
                </div>
                <div className="barra-mini-progreso no-imprimir">
                  <div
                    className="barra-mini-relleno"
                    style={{ width: `${pasantia.porcentaje}%` }}
                  />
                </div>
              </div>
            ) : (
              <span style={{ color: "#657763", fontSize: "12px" }}>
                Personal de planta · Sin meta de horas ni fin de pasantía
              </span>
            )}
          </td>
          <td className="no-imprimir">
            <button
              type="button"
              className="btn-reporte"
              style={{ minHeight: "34px", padding: "6px 10px", fontSize: "12px" }}
              onClick={() =>
                verReporteIndividualPersona(item.idPasante || item.codigo)
              }
            >
              Reporte individual
            </button>
          </td>
        </tr>
      );
    });
  }

  function renderFilasConciliacion(lista) {
    return lista.map((item) => (
      <tr key={item.clave}>
        <td>
          <strong>{item.codigo || "—"}</strong>
        </td>
        <td>{item.nombreCompleto}</td>
        <td>
          <span className={`insignia-rep ${item.pasantia ? "" : "planta"}`}>
            {item.tipoContrato}
          </span>
        </td>
        <td>{item.registrosAsistencia}</td>
        <td>
          <strong>{item.tiempoFormateado.texto}</strong> ({item.minutosTrabajados} min)
        </td>
        <td>{item.cantidadViaticos}</td>
        <td>{item.montoViaticos.toFixed(2)} Bs</td>
        <td>{item.gastoExtraViaticos.toFixed(2)} Bs</td>
        <td>
          <strong>{item.totalViaticosBs.toFixed(2)} Bs</strong>
        </td>
        <td>
          {item.pasantia ? (
            <span>
              Cumplido: {item.pasantia.cumplido.texto} · Pendiente:{" "}
              {item.pasantia.pendiente.texto}
            </span>
          ) : (
            <span style={{ color: "#657763", fontSize: "12px" }}>
              No aplica (Planta sin meta)
            </span>
          )}
        </td>
      </tr>
    ));
  }

  return (
    <div className="mod-reportes">
      {/* Encabezado exclusivo para Impresión A4 / PDF */}
      <div className="encabezado-impresion-a4">
        <h2 style={{ margin: "0 0 4px" }}>
          SII · OFICINA SANTIAGO II — REPORTE OFICIAL ({vistaActiva.toUpperCase()})
        </h2>
        <p style={{ margin: 0, fontSize: "11pt" }}>
          <strong>Período:</strong> {resumenFiltrosTexto.periodo} ·{" "}
          <strong>Personal:</strong> {resumenFiltrosTexto.persona} ·{" "}
          <strong>Proyecto:</strong> {resumenFiltrosTexto.proyecto}
          {busquedaTexto ? ` · Filtro texto: "${busquedaTexto}"` : ""}
        </p>
      </div>

      {/* Cabecera principal en pantalla */}
      <section className="detalle-modulo no-imprimir">
        <div className="mod-reportes-cabecera-top">
          <div>
            <span className="numero">MÓDULO {modulo?.numero || "04"}</span>
            <h2>{modulo?.nombre || "Historial y reportes"}</h2>
            <p>
              {modulo?.descripcion ||
                "Consultas, seguimiento, impresión A4/PDF y exportación desde los datos reales del sistema."}
            </p>
            <div className="etiquetas">
              <span>Contrato conectado: POST /api/backend</span>
              <span>Zona horaria: America/La_Paz</span>
              <span>
                {operacionesContrato.length > 0
                  ? `${operacionesContrato.length} operaciones activas en contrato`
                  : "Impresión A4 / PDF y Exportación CSV"}
              </span>
            </div>
          </div>

          <div className="mod-reportes-acciones-top">
            {usuario && (
              <>
                <button
                  type="button"
                  className="btn-reporte btn-reporte-primario"
                  onClick={() => window.print()}
                  disabled={ocupado}
                >
                  Imprimir A4 / Guardar PDF
                </button>
                <button
                  type="button"
                  className="btn-reporte btn-reporte-secundario"
                  onClick={exportarVistaActualCsv}
                  disabled={ocupado}
                >
                  Exportar CSV (Excel)
                </button>
                <button
                  type="button"
                  className="btn-reporte"
                  onClick={exportarVistaActualJson}
                  disabled={ocupado}
                >
                  Exportar JSON
                </button>
                <button
                  type="button"
                  className="btn-reporte"
                  onClick={() => ejecutarTarea(() => cargarReportes(token, filtro))}
                  disabled={ocupado}
                >
                  Actualizar
                </button>
              </>
            )}
            <button
              type="button"
              className="btn-reporte"
              onClick={() => setVerAlcanceBase((v) => !v)}
            >
              {verAlcanceBase ? "Ocultar alcance" : "Ver alcance del módulo"}
            </button>
            {usuario && !tokenExterno && (
              <button
                type="button"
                className="btn-reporte"
                onClick={cerrarSesionLocal}
              >
                Cerrar sesión ({usuario.nombreUsuario} · {usuario.rol})
              </button>
            )}
          </div>
        </div>

        {usuario && (
          <div className="mod-reportes-indicadores" aria-label="Indicadores del período">
            <div className="caja-indicador-rep destacada">
              <span className="numero">REGISTROS DE ASISTENCIA</span>
              <strong className="valor-grande">{resumenHistorial.registros}</strong>
              <span className="subtexto">
                Período: {resumenFiltrosTexto.periodo}
              </span>
            </div>
            <div className="caja-indicador-rep">
              <span className="numero">TIEMPO TRABAJADO ACUMULADO</span>
              <strong className="valor-grande">
                {resumenHistorial.formateado.texto}
              </strong>
              <span className="subtexto">
                {resumenHistorial.minutos} minutos reales (soporta &gt; 24 h)
              </span>
            </div>
            <div className="caja-indicador-rep">
              <span className="numero">VIÁTICOS CONCILIADOS</span>
              <strong className="valor-grande">
                {conciliacion.totalViaticosBs.toFixed(2)} Bs
              </strong>
              <span className="subtexto">
                {conciliacion.cantidadViaticos} registros (Base:{" "}
                {conciliacion.totalMontoBase.toFixed(2)} Bs · Extra:{" "}
                {conciliacion.totalGastoExtra.toFixed(2)} Bs)
              </span>
            </div>
            <div className="caja-indicador-rep">
              <span className="numero">EQUIPO Y PROYECTOS</span>
              <strong className="valor-grande">
                {seguimientoFiltrado.length} / {catalogoProyectos.length}
              </strong>
              <span className="subtexto">
                Personas en seguimiento · Proyectos activos
              </span>
            </div>
          </div>
        )}
      </section>

      {verAlcanceBase && modulo && <ModuloBase modulo={modulo} />}

      {aviso && (
        <div className="aviso-reportes no-imprimir" role="status">
          <span>{aviso}</span>
          <button
            type="button"
            className="btn-reporte"
            onClick={() => setAviso("")}
          >
            Cerrar
          </button>
        </div>
      )}

      {error && (
        <div className="aviso-reportes alerta no-imprimir" role="alert">
          <span>
            <strong>Atención:</strong> {error}
          </span>
          <button
            type="button"
            className="btn-reporte"
            onClick={() => setError("")}
          >
            Cerrar
          </button>
        </div>
      )}

      {!usuario ? (
        <section className="detalle-modulo no-imprimir" aria-label="Autenticación requerida">
          <span className="numero">AUTENTICACIÓN REQUERIDA (/API/BACKEND)</span>
          <h3>
            {modoRegistroEncargado
              ? "Crear cuenta de Encargado"
              : "Iniciar sesión para consultar Historial y Reportes"}
          </h3>
          <p>
            Las operaciones del Módulo 04 consultan los datos reales del servidor
            C# y PostgreSQL mediante token Bearer en memoria.
          </p>

          <form
            className="filtros-grid-reportes"
            style={{ marginTop: "16px" }}
            onSubmit={manejarAcceso}
          >
            <div className="campo-rep">
              <label htmlFor="login-usuario-rep">Usuario *</label>
              <input
                id="login-usuario-rep"
                className="input-rep"
                type="text"
                required
                maxLength={50}
                autoComplete="username"
                value={credencialesForm.usuario}
                onChange={(e) =>
                  setCredencialesForm((p) => ({ ...p, usuario: e.target.value }))
                }
              />
            </div>

            <div className="campo-rep">
              <label htmlFor="login-password-rep">Contraseña *</label>
              <input
                id="login-password-rep"
                className="input-rep"
                type="password"
                required
                minLength={modoRegistroEncargado ? 8 : 1}
                autoComplete="current-password"
                value={credencialesForm.password}
                onChange={(e) =>
                  setCredencialesForm((p) => ({
                    ...p,
                    password: e.target.value
                  }))
                }
              />
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="submit"
                className="btn-reporte btn-reporte-primario"
                disabled={ocupado}
              >
                {ocupado
                  ? "Conectando…"
                  : modoRegistroEncargado
                  ? "Registrar encargado"
                  : "Ingresar"}
              </button>
              <button
                type="button"
                className="btn-reporte"
                onClick={() => setModoRegistroEncargado((v) => !v)}
                disabled={ocupado}
              >
                {modoRegistroEncargado
                  ? "Volver al inicio de sesión"
                  : "Crear cuenta de encargado"}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <>
          {/* Panel de filtros unificados (idéntico a Historial de Asistencia de escritorio) */}
          <section
            className="detalle-modulo no-imprimir"
            aria-label="Filtros de historial y reportes"
          >
            <span className="numero">
              FILTROS UNIFICADOS (CONSULTA · IMPRESIÓN A4 · EXPORTACIÓN CSV/JSON)
            </span>
            <form
              className="filtros-grid-reportes"
              style={{ marginTop: "14px" }}
              onSubmit={aplicarFiltrosFormulario}
            >
              <div className="campo-rep">
                <label htmlFor="rep-fecha-inicio">Desde</label>
                <input
                  id="rep-fecha-inicio"
                  className="input-rep"
                  type="date"
                  required
                  value={filtro.inicio}
                  onChange={(e) =>
                    setFiltro((f) => ({ ...f, inicio: e.target.value }))
                  }
                />
              </div>

              <div className="campo-rep">
                <label htmlFor="rep-fecha-fin">Hasta</label>
                <input
                  id="rep-fecha-fin"
                  className="input-rep"
                  type="date"
                  required
                  value={filtro.fin}
                  onChange={(e) =>
                    setFiltro((f) => ({ ...f, fin: e.target.value }))
                  }
                />
              </div>

              <div className="campo-rep">
                <label htmlFor="rep-select-persona">
                  Personal (incluye inactivos)
                </label>
                <select
                  id="rep-select-persona"
                  className="select-rep"
                  value={filtro.id}
                  onChange={(e) => {
                    const nuevoId = e.target.value;
                    const personaSel = catalogoPersonal.find(
                      (p) => String(p.idPasante) === String(nuevoId)
                    );
                    setFiltro((f) => ({
                      ...f,
                      id: nuevoId,
                      codigo: personaSel ? personaSel.codigo : ""
                    }));
                  }}
                >
                  <option value="">Todos los empleados</option>
                  {catalogoPersonal.map((p) => (
                    <option key={p.idPasante} value={p.idPasante}>
                      {p.codigo} · {p.nombres} {p.apellidos}
                      {p.activo === false ? " (Inactivo)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="campo-rep">
                <label htmlFor="rep-select-proyecto">Proyecto</label>
                <select
                  id="rep-select-proyecto"
                  className="select-rep"
                  value={filtro.idProyecto}
                  onChange={(e) =>
                    setFiltro((f) => ({ ...f, idProyecto: e.target.value }))
                  }
                >
                  <option value="">Todos los proyectos</option>
                  {catalogoProyectos.map((pr) => {
                    const idPr = pr.idProyecto ?? pr.id;
                    return (
                      <option key={idPr} value={idPr}>
                        {pr.codigo ? `${pr.codigo} · ` : ""}
                        {pr.nombre}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="campo-rep">
                <label htmlFor="rep-busqueda-texto">
                  Filtrar por nombre, código o ubicación
                </label>
                <input
                  id="rep-busqueda-texto"
                  className="input-rep"
                  type="search"
                  placeholder="Ej. P00002, Bravo, Cotoca…"
                  value={busquedaTexto}
                  onChange={(e) => {
                    setBusquedaTexto(e.target.value);
                    setPaginaActual(1);
                  }}
                />
              </div>

              <div>
                <button
                  type="submit"
                  className="btn-reporte btn-reporte-primario"
                  style={{ width: "100%" }}
                  disabled={ocupado}
                >
                  {ocupado ? "Consultando…" : "Buscar"}
                </button>
              </div>
            </form>

            <div className="acciones-barra-reportes">
              <div className="grupo-exportacion">
                <button
                  type="button"
                  className="btn-reporte"
                  onClick={() => {
                    const nuevo = {
                      ...filtro,
                      inicio: inicioMesBolivia(),
                      fin: hoyBolivia()
                    };
                    setFiltro(nuevo);
                    ejecutarTarea(() => cargarReportes(token, nuevo));
                  }}
                  disabled={ocupado}
                >
                  Mes actual
                </button>
                <button
                  type="button"
                  className="btn-reporte"
                  onClick={() => {
                    const hoy = hoyBolivia();
                    const nuevo = { ...filtro, inicio: hoy, fin: hoy };
                    setFiltro(nuevo);
                    ejecutarTarea(() => cargarReportes(token, nuevo));
                  }}
                  disabled={ocupado}
                >
                  Solo hoy ({hoyBolivia()})
                </button>
                <button
                  type="button"
                  className="btn-reporte"
                  onClick={() => {
                    const anio = hoyBolivia().slice(0, 4);
                    const nuevo = {
                      inicio: `${anio}-01-01`,
                      fin: `${anio}-12-31`,
                      idProyecto: "",
                      id: "",
                      codigo: ""
                    };
                    setFiltro(nuevo);
                    setBusquedaTexto("");
                    ejecutarTarea(() => cargarReportes(token, nuevo));
                  }}
                  disabled={ocupado}
                >
                  Todo el año / Limpiar filtros
                </button>
              </div>

              <div className="grupo-exportacion">
                <label
                  htmlFor="rep-filas-pagina"
                  style={{ fontSize: "12px", fontWeight: 700, color: "#173c32" }}
                >
                  Filas por página:
                </label>
                <select
                  id="rep-filas-pagina"
                  className="select-rep"
                  style={{ width: "auto", minWidth: "90px" }}
                  value={filasPorPagina}
                  onChange={(e) => {
                    setFilasPorPagina(Number(e.target.value) || 15);
                    setPaginaActual(1);
                  }}
                >
                  <option value={5}>5 filas</option>
                  <option value={10}>10 filas</option>
                  <option value={15}>15 filas</option>
                  <option value={25}>25 filas</option>
                  <option value={50}>50 filas</option>
                  <option value={100}>100 filas</option>
                </select>
              </div>
            </div>
          </section>

          {/* Contenido principal del reporte */}
          <section className="detalle-modulo" aria-label="Resultados del reporte">
            {/* Pestañas de selección de reporte */}
            <div className="pestanas-reportes no-imprimir" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={vistaActiva === "historial"}
                className={`btn-reporte ${
                  vistaActiva === "historial" ? "btn-reporte-activo" : ""
                }`}
                onClick={() => {
                  setVistaActiva("historial");
                  setPaginaActual(1);
                }}
              >
                1. Historial de Asistencia ({historialFiltrado.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={vistaActiva === "seguimiento"}
                className={`btn-reporte ${
                  vistaActiva === "seguimiento" ? "btn-reporte-activo" : ""
                }`}
                onClick={() => {
                  setVistaActiva("seguimiento");
                  setPaginaActual(1);
                }}
              >
                2. Seguimiento y Pasantías ({seguimientoFiltrado.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={vistaActiva === "conciliacion"}
                className={`btn-reporte ${
                  vistaActiva === "conciliacion" ? "btn-reporte-activo" : ""
                }`}
                onClick={() => {
                  setVistaActiva("conciliacion");
                  setPaginaActual(1);
                }}
              >
                3. Conciliación Asistencia + Viáticos (
                {conciliacion.porPersona.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={vistaActiva === "individual"}
                className={`btn-reporte ${
                  vistaActiva === "individual" ? "btn-reporte-activo" : ""
                }`}
                onClick={() => {
                  setVistaActiva("individual");
                  setPaginaActual(1);
                }}
              >
                4. Reporte Individual
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={vistaActiva === "asignaciones"}
                className={`btn-reporte ${
                  vistaActiva === "asignaciones" ? "btn-reporte-activo" : ""
                }`}
                onClick={() => {
                  setVistaActiva("asignaciones");
                  setPaginaActual(1);
                }}
              >
                5. Asignaciones y Marcas ({asignacionesFiltradas.length})
              </button>
            </div>

            {/* VISTA 1: HISTORIAL DE ASISTENCIA */}
            {vistaActiva === "historial" && (
              <div>
                <span className="numero no-imprimir">
                  HISTORIAL DE ASISTENCIA (REPORTES.HISTORIAL)
                </span>
                <h3 style={{ marginTop: "6px", marginBottom: "12px" }}>
                  Historial por fechas, persona y proyecto
                </h3>

                {historialFiltrado.length === 0 ? (
                  <div className="caja-indicador-rep">
                    <strong>Sin registros de asistencia en el período</strong>
                    <span className="subtexto">
                      No se encontraron marcaciones entre {filtro.inicio} y{" "}
                      {filtro.fin} con los filtros seleccionados.
                    </span>
                  </div>
                ) : (
                  <>
                    {/* Tabla paginada en pantalla */}
                    <div className="tabla-contenedor-rep ocultar-en-impresion">
                      <table className="tabla-reportes">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Código</th>
                            <th>NombreCompleto</th>
                            <th>HoraEntrada</th>
                            <th>HoraInicioAlmuerzo</th>
                            <th>HoraFinAlmuerzo</th>
                            <th>HoraSalida</th>
                            <th>MinutosTrabajados</th>
                            <th>Proyecto / Observación</th>
                          </tr>
                        </thead>
                        <tbody>
                          {renderFilasHistorial(paginacion.itemsPagina)}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={7}>
                              Total del reporte filtrado ({resumenHistorial.registros}{" "}
                              registros)
                            </td>
                            <td colSpan={2}>
                              {resumenHistorial.minutos} min (
                              {resumenHistorial.formateado.texto})
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Tabla completa multi-página exclusiva para Impresión A4 / PDF */}
                    <div className="tabla-contenedor-rep solo-impresion-a4">
                      <table className="tabla-reportes">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Código</th>
                            <th>NombreCompleto</th>
                            <th>HoraEntrada</th>
                            <th>HoraInicioAlmuerzo</th>
                            <th>HoraFinAlmuerzo</th>
                            <th>HoraSalida</th>
                            <th>MinutosTrabajados</th>
                            <th>Proyecto / Observación</th>
                          </tr>
                        </thead>
                        <tbody>{renderFilasHistorial(historialFiltrado)}</tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={7}>
                              Total general ({resumenHistorial.registros} registros)
                            </td>
                            <td colSpan={2}>
                              {resumenHistorial.minutos} min (
                              {resumenHistorial.formateado.texto})
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* VISTA 2: SEGUIMIENTO DEL EQUIPO Y PASANTÍAS */}
            {vistaActiva === "seguimiento" && (
              <div>
                <span className="numero no-imprimir">
                  SEGUIMIENTO DEL EQUIPO Y HORAS DE PASANTÍA (REPORTES.SEGUIMIENTO)
                </span>
                <h3 style={{ marginTop: "6px", marginBottom: "6px" }}>
                  Seguimiento del equipo · Horas cumplidas y pendientes solo para pasantes
                </h3>
                <p className="subtexto no-imprimir" style={{ marginTop: 0, marginBottom: "14px" }}>
                  El personal de planta tiene <code>horasRequeridas: 0</code> y no
                  recibe metas ni porcentajes de pasantía.
                </p>

                {seguimientoFiltrado.length === 0 ? (
                  <div className="caja-indicador-rep">
                    <strong>Sin registros de seguimiento</strong>
                    <span className="subtexto">
                      No hay personas que coincidan con el filtro actual.
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="tabla-contenedor-rep ocultar-en-impresion">
                      <table className="tabla-reportes">
                        <thead>
                          <tr>
                            <th>Código</th>
                            <th>Nombre completo</th>
                            <th>Tipo</th>
                            <th>Marca (pasantes)</th>
                            <th>Días período</th>
                            <th>Tiempo en período</th>
                            <th>Cumplimiento y pendiente de pasantía</th>
                            <th className="no-imprimir">Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {renderFilasSeguimiento(paginacion.itemsPagina)}
                        </tbody>
                      </table>
                    </div>

                    <div className="tabla-contenedor-rep solo-impresion-a4">
                      <table className="tabla-reportes">
                        <thead>
                          <tr>
                            <th>Código</th>
                            <th>Nombre completo</th>
                            <th>Tipo</th>
                            <th>Marca (pasantes)</th>
                            <th>Días período</th>
                            <th>Tiempo en período</th>
                            <th>Cumplimiento y pendiente de pasantía</th>
                          </tr>
                        </thead>
                        <tbody>
                          {renderFilasSeguimiento(seguimientoFiltrado)}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* VISTA 3: CONCILIACIÓN DE ASISTENCIA Y VIÁTICOS */}
            {vistaActiva === "conciliacion" && (
              <div>
                <span className="numero no-imprimir">
                  CONCILIACIÓN DE ASISTENCIA Y VIÁTICOS DEL PERÍODO
                </span>
                <h3 style={{ marginTop: "6px", marginBottom: "12px" }}>
                  Totales de asistencia y viáticos conciliados por persona
                </h3>

                {conciliacion.porPersona.length === 0 ? (
                  <div className="caja-indicador-rep">
                    <strong>Sin datos para conciliar en el período</strong>
                    <span className="subtexto">
                      Ajuste el rango de fechas o los filtros de proyecto y persona.
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="tabla-contenedor-rep ocultar-en-impresion">
                      <table className="tabla-reportes">
                        <thead>
                          <tr>
                            <th>Código</th>
                            <th>Persona</th>
                            <th>Tipo</th>
                            <th>Asistencias</th>
                            <th>Tiempo trabajado</th>
                            <th>N° Viáticos</th>
                            <th>Monto base</th>
                            <th>Gasto extra</th>
                            <th>Total Viáticos</th>
                            <th>Pasantía (solo pasantes)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {renderFilasConciliacion(paginacion.itemsPagina)}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={3}>Totales conciliados del período</td>
                            <td>{conciliacion.totalRegistrosAsistencia}</td>
                            <td>
                              {conciliacion.tiempoTotalFormateado.texto} (
                              {conciliacion.totalMinutosAsistencia} min)
                            </td>
                            <td>{conciliacion.cantidadViaticos}</td>
                            <td>{conciliacion.totalMontoBase.toFixed(2)} Bs</td>
                            <td>{conciliacion.totalGastoExtra.toFixed(2)} Bs</td>
                            <td colSpan={2}>
                              {conciliacion.totalViaticosBs.toFixed(2)} Bs
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div className="tabla-contenedor-rep solo-impresion-a4">
                      <table className="tabla-reportes">
                        <thead>
                          <tr>
                            <th>Código</th>
                            <th>Persona</th>
                            <th>Tipo</th>
                            <th>Asistencias</th>
                            <th>Tiempo trabajado</th>
                            <th>N° Viáticos</th>
                            <th>Monto base</th>
                            <th>Gasto extra</th>
                            <th>Total Viáticos</th>
                            <th>Pasantía (solo pasantes)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {renderFilasConciliacion(conciliacion.porPersona)}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={3}>Totales conciliados del período</td>
                            <td>{conciliacion.totalRegistrosAsistencia}</td>
                            <td>
                              {conciliacion.tiempoTotalFormateado.texto} (
                              {conciliacion.totalMinutosAsistencia} min)
                            </td>
                            <td>{conciliacion.cantidadViaticos}</td>
                            <td>{conciliacion.totalMontoBase.toFixed(2)} Bs</td>
                            <td>{conciliacion.totalGastoExtra.toFixed(2)} Bs</td>
                            <td colSpan={2}>
                              {conciliacion.totalViaticosBs.toFixed(2)} Bs
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* VISTA 4: REPORTE INDIVIDUAL COMPLETO */}
            {vistaActiva === "individual" && (
              <div>
                <span className="numero no-imprimir">
                  REPORTE INDIVIDUAL (REPORTES.INDIVIDUAL)
                </span>
                <div
                  className="no-imprimir"
                  style={{
                    display: "flex",
                    gap: "12px",
                    alignItems: "end",
                    flexWrap: "wrap",
                    margin: "10px 0 18px"
                  }}
                >
                  <div className="campo-rep" style={{ minWidth: "260px" }}>
                    <label htmlFor="select-persona-ind">
                      Seleccionar persona para reporte individual
                    </label>
                    <select
                      id="select-persona-ind"
                      className="select-rep"
                      value={reporteIndividual?.personal?.idPasante || ""}
                      onChange={(e) =>
                        verReporteIndividualPersona(Number(e.target.value))
                      }
                    >
                      <option value="">Seleccione una persona…</option>
                      {catalogoPersonal.map((p) => (
                        <option key={p.idPasante} value={p.idPasante}>
                          {p.codigo} · {p.nombres} {p.apellidos} ({p.tipoContrato})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {!reporteIndividual?.personal ? (
                  <div className="caja-indicador-rep">
                    <strong>Seleccione una persona</strong>
                    <span className="subtexto">
                      Elija una persona del selector superior o haga clic sobre el
                      nombre en la tabla de Historial o Seguimiento.
                    </span>
                  </div>
                ) : (
                  (() => {
                    const p = reporteIndividual.personal;
                    const asistenciasInd = Array.isArray(
                      reporteIndividual.asistencias
                    )
                      ? reporteIndividual.asistencias
                      : [];
                    const proyectosInd = Array.isArray(reporteIndividual.proyectos)
                      ? reporteIndividual.proyectos
                      : [];
                    const viaticosInd = Array.isArray(reporteIndividual.viaticos)
                      ? reporteIndividual.viaticos
                      : [];
                    const minTotalesInd = asistenciasInd.reduce(
                      (acc, a) =>
                        acc + Math.max(0, Math.trunc(Number(a.minutosTrabajados) || 0)),
                      0
                    );
                    const metricasInd = calcularMetricasPasantia(p, minTotalesInd);
                    const totalViaticosInd = viaticosInd.reduce(
                      (acc, v) =>
                        acc + (Number(v.monto) || 0) + (Number(v.gastoExtra) || 0),
                      0
                    );

                    return (
                      <div>
                        <h3 style={{ marginTop: 0, marginBottom: "6px" }}>
                          {p.nombres} {p.apellidos} ({p.codigo})
                        </h3>
                        <div className="ficha-individual-grid">
                          <div className="bloque-dato-ind">
                            <small>Tipo de personal</small>
                            <strong>{p.tipoContrato}</strong>
                          </div>
                          <div className="bloque-dato-ind">
                            <small>Departamento / Marca</small>
                            <strong>
                              {p.nombreDepartamento || "General"} ·{" "}
                              {esPersonaPasante(p)
                                ? p.nombreMarca || "General"
                                : "No aplica"}
                            </strong>
                          </div>
                          <div className="bloque-dato-ind">
                            <small>Turno y Días</small>
                            <strong>
                              {p.turno || "—"} ({p.diasTrabajo || "—"})
                            </strong>
                          </div>
                          <div className="bloque-dato-ind">
                            <small>Tiempo total registrado</small>
                            <strong>
                              {formatearMinutos(minTotalesInd).texto} (
                              {asistenciasInd.length} asistencias)
                            </strong>
                          </div>
                          <div className="bloque-dato-ind">
                            <small>Meta y avance de pasantía</small>
                            {metricasInd ? (
                              <strong>
                                Cumplido: {metricasInd.cumplido.texto} / Pendiente:{" "}
                                {metricasInd.pendiente.texto} ({metricasInd.porcentaje}
                                %)
                              </strong>
                            ) : (
                              <strong>
                                No aplica (Personal de planta sin meta de horas)
                              </strong>
                            )}
                          </div>
                          <div className="bloque-dato-ind">
                            <small>Viáticos y Proyectos</small>
                            <strong>
                              {totalViaticosInd.toFixed(2)} Bs ({viaticosInd.length}{" "}
                              viáticos) · {proyectosInd.length} asignaciones
                            </strong>
                          </div>
                        </div>

                        {proyectosInd.length > 0 && (
                          <div style={{ marginBottom: "20px" }}>
                            <h4 style={{ marginBottom: "8px" }}>
                              Asignaciones a proyectos ({proyectosInd.length})
                            </h4>
                            <div className="tabla-contenedor-rep">
                              <table className="tabla-reportes">
                                <thead>
                                  <tr>
                                    <th>Proyecto</th>
                                    <th>Rol</th>
                                    <th>Inicio</th>
                                    <th>Fin</th>
                                    <th>Estado</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {proyectosInd.map((asig) => (
                                    <tr key={asig.idAsignacion}>
                                      <td>
                                        <strong>
                                          {asig.nombreProyecto ||
                                            `Proyecto #${asig.idProyecto}`}
                                        </strong>
                                      </td>
                                      <td>{asig.rol}</td>
                                      <td>
                                        {String(asig.fechaInicio || "").slice(0, 10)}
                                      </td>
                                      <td>
                                        {asig.fechaFin
                                          ? String(asig.fechaFin).slice(0, 10)
                                          : "En curso"}
                                      </td>
                                      <td>
                                        {asig.activo === false
                                          ? "Finalizada"
                                          : "Activa"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        <h4 style={{ marginBottom: "8px" }}>
                          Historial de asistencias de {p.nombres} ({asistenciasInd.length})
                        </h4>
                        {asistenciasInd.length === 0 ? (
                          <div className="caja-indicador-rep">
                            <span>Sin asistencias registradas para esta persona.</span>
                          </div>
                        ) : (
                          <div className="tabla-contenedor-rep">
                            <table className="tabla-reportes">
                              <thead>
                                <tr>
                                  <th>Fecha</th>
                                  <th>Entrada</th>
                                  <th>Inicio Almuerzo</th>
                                  <th>Fin Almuerzo</th>
                                  <th>Salida</th>
                                  <th>Tiempo trabajado</th>
                                  <th>Observaciones</th>
                                </tr>
                              </thead>
                              <tbody>
                                {paginacion.itemsPagina.map((a) => (
                                  <tr key={a.idAsistencia || a.fecha}>
                                    <td>{String(a.fecha || "").slice(0, 10)}</td>
                                    <td>{a.horaEntrada || "—"}</td>
                                    <td>{a.horaInicioAlmuerzo || "—"}</td>
                                    <td>{a.horaFinAlmuerzo || "—"}</td>
                                    <td>{a.horaSalida || "—"}</td>
                                    <td>
                                      <strong>{a.minutosTrabajados || 0}</strong> min (
                                      {formatearMinutos(a.minutosTrabajados).textoCorto}
                                      )
                                    </td>
                                    <td>{a.observaciones || "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })()
                )}
              </div>
            )}

            {/* VISTA 5: ASIGNACIONES A PROYECTOS Y MARCAS */}
            {vistaActiva === "asignaciones" && (
              <div>
                <span className="numero no-imprimir">
                  ASIGNACIONES A PROYECTOS Y DISTRIBUCIÓN POR MARCA (REPORTES.ASIGNACIONES · REPORTES.MARCAS)
                </span>
                <h3 style={{ marginTop: "6px", marginBottom: "12px" }}>
                  Participación del equipo en proyectos y marcas registradas
                </h3>

                {asignacionesFiltradas.length === 0 ? (
                  <div className="caja-indicador-rep">
                    <strong>Sin asignaciones a proyectos con este filtro</strong>
                  </div>
                ) : (
                  <div
                    className="tabla-contenedor-rep"
                    style={{ marginBottom: "24px" }}
                  >
                    <table className="tabla-reportes">
                      <thead>
                        <tr>
                          <th>Personal</th>
                          <th>Proyecto</th>
                          <th>Cargo / Rol</th>
                          <th>Fecha inicio</th>
                          <th>Fecha fin</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginacion.itemsPagina.map((a) => (
                          <tr key={a.idAsignacion}>
                            <td>
                              <strong>{a.nombrePersonal}</strong>
                            </td>
                            <td>{a.nombreProyecto}</td>
                            <td>{a.rol}</td>
                            <td>{String(a.fechaInicio || "").slice(0, 10)}</td>
                            <td>
                              {a.fechaFin
                                ? String(a.fechaFin).slice(0, 10)
                                : "En curso"}
                            </td>
                            <td>
                              <span
                                className={`insignia-rep ${
                                  a.activo === false ? "planta" : ""
                                }`}
                              >
                                {a.activo === false ? "Cerrada" : "Activa"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {marcasReporte.length > 0 && (
                  <div>
                    <h4 style={{ marginBottom: "10px" }}>
                      Reporte de personal por marca y área (reportes.marcas ·{" "}
                      {marcasReporte.length})
                    </h4>
                    <div className="tabla-contenedor-rep">
                      <table className="tabla-reportes">
                        <thead>
                          <tr>
                            <th>Código</th>
                            <th>Nombre completo</th>
                            <th>Departamento</th>
                            <th>Marca</th>
                            <th>Carrera</th>
                            <th>Días trabajo</th>
                            <th>Meta pasantía</th>
                          </tr>
                        </thead>
                        <tbody>
                          {marcasReporte.map((m, idx) => (
                            <tr key={`${m.codigo}-${idx}`}>
                              <td>
                                <strong>{m.codigo}</strong>
                              </td>
                              <td>
                                {m.nombres} {m.apellidos}
                              </td>
                              <td>{m.nombreDepartamento || "General"}</td>
                              <td>
                                {Number(m.horasRequeridas) > 0
                                  ? m.nombreMarca || "General"
                                  : "No aplica"}
                              </td>
                              <td>{m.carrera || "—"}</td>
                              <td>{m.diasTrabajo || "—"}</td>
                              <td>
                                {Number(m.horasRequeridas) > 0
                                  ? `${m.horasRequeridas} horas`
                                  : "No aplica (Planta)"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Controles de paginación para reportes de varias páginas */}
            {paginacion.totalItems > 0 && (
              <div
                className="paginacion-reportes no-imprimir"
                aria-label="Paginación de resultados"
              >
                <span>
                  Mostrando <strong>{paginacion.desdeRegistro}</strong> a{" "}
                  <strong>{paginacion.hastaRegistro}</strong> de{" "}
                  <strong>{paginacion.totalItems}</strong> registros · Página{" "}
                  <strong>{paginacion.paginaActual}</strong> de{" "}
                  <strong>{paginacion.totalPaginas}</strong>
                </span>

                <div className="paginacion-controles">
                  <button
                    type="button"
                    className="btn-reporte"
                    onClick={() => setPaginaActual(1)}
                    disabled={paginacion.paginaActual <= 1}
                  >
                    « Primera
                  </button>
                  <button
                    type="button"
                    className="btn-reporte"
                    onClick={() =>
                      setPaginaActual((p) => Math.max(1, p - 1))
                    }
                    disabled={paginacion.paginaActual <= 1}
                  >
                    ‹ Anterior
                  </button>
                  <button
                    type="button"
                    className="btn-reporte"
                    onClick={() =>
                      setPaginaActual((p) =>
                        Math.min(paginacion.totalPaginas, p + 1)
                      )
                    }
                    disabled={
                      paginacion.paginaActual >= paginacion.totalPaginas
                    }
                  >
                    Siguiente ›
                  </button>
                  <button
                    type="button"
                    className="btn-reporte"
                    onClick={() => setPaginaActual(paginacion.totalPaginas)}
                    disabled={
                      paginacion.paginaActual >= paginacion.totalPaginas
                    }
                  >
                    Última »
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
