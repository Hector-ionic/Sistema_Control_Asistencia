// PARTE 2 (CARLOS): Permisos, faltas con motivo, envío y revisión de correcciones con UUID idempotente,
// e integración QR con emisión y revisión de solicitudes QR del encargado.
// Conectado exclusivamente a POST /api/backend mediante ./asistenciaApi.js.

import React, { useEffect, useMemo, useState } from "react";
import {
  TIPOS_INCIDENCIA,
  hoyBolivia,
  normalizarHoraCSharp,
  formatearHoraVista,
  formatearMinutosJornada,
  generarUuidOperacion,
  evaluarEstadoJornada,
  consultarEstadoAsistencia,
  consultarHistorialAsistencia,
  registrarMarcacionAsistencia,
  listarCorrecciones,
  enviarSolicitudCorreccionIdempotente,
  revisarSolicitudCorreccion,
  verificarExisteQr,
  emitirCredencialQr,
  contarPendientesQr,
  listarSolicitudesQr,
  revisarSolicitudQr
} from "./asistenciaApi.js";

const MOTIVOS_RAPIDOS_INCIDENCIA = Object.freeze([
  {
    tipo: "Permiso",
    texto: "Permiso médico con respaldo presentado en administración"
  },
  {
    tipo: "Permiso",
    texto: "Permiso académico por evaluación universitaria programada"
  },
  {
    tipo: "Permiso",
    texto: "Comisión externa autorizada por supervisión de proyecto"
  },
  {
    tipo: "Falta",
    texto: "Inasistencia sin aviso previo en la jornada operativa"
  }
]);

/**
 * Calcula los minutos netos entre dos horas HH:mm(:ss), descontando el almuerzo si aplica.
 */
function calcularMinutosPropuestos(
  horaEntrada,
  horaSalida,
  horaInicioAlmuerzo,
  horaFinAlmuerzo
) {
  const aMinutos = (h) => {
    const norm = normalizarHoraCSharp(h);
    if (!norm) return null;
    const partes = norm.split(":").map(Number);
    if (partes.length < 2 || Number.isNaN(partes[0]) || Number.isNaN(partes[1])) {
      return null;
    }
    return partes[0] * 60 + partes[1];
  };

  const ent = aMinutos(horaEntrada);
  const sal = aMinutos(horaSalida);
  const almI = aMinutos(horaInicioAlmuerzo);
  const almF = aMinutos(horaFinAlmuerzo);

  if (ent === null || sal === null) {
    return { valido: false, error: "Indique la hora de entrada y de salida.", minutos: 0 };
  }
  if (sal <= ent) {
    return {
      valido: false,
      error: "La hora de salida propuesta debe ser posterior a la hora de entrada.",
      minutos: 0
    };
  }

  let descuentoAlmuerzo = 0;
  if (almI !== null || almF !== null) {
    if (almI === null || almF === null) {
      return {
        valido: false,
        error: "Si incluye horario de almuerzo, debe completar tanto el inicio como el fin.",
        minutos: 0
      };
    }
    if (almF <= almI) {
      return {
        valido: false,
        error: "El fin de almuerzo debe ser posterior al inicio de almuerzo.",
        minutos: 0
      };
    }
    if (almI < ent || almF > sal) {
      return {
        valido: false,
        error: "El rango de almuerzo debe estar dentro del horario de entrada y salida.",
        minutos: 0
      };
    }
    descuentoAlmuerzo = almF - almI;
  }

  const total = Math.max(0, sal - ent - descuentoAlmuerzo);
  return { valido: true, error: "", minutos: total };
}

export default function PanelIncidenciasQr({
  token,
  usuario,
  personal = [],
  correcciones = [],
  solicitudesQr = [],
  qrExiste = false,
  pendientesQr = 0,
  onRecargarDatos,
  onNotificarAviso,
  onNotificarError
}) {
  const esEncargado = usuario?.rol === "Encargado";
  const hoy = hoyBolivia();

  // Sub-pestaña de Parte 2: 'incidencias' | 'correcciones' | 'qr'
  const [subPestana, setSubPestana] = useState("incidencias");
  const [ocupadoLocal, setOcupadoLocal] = useState(false);

  // Mapa rápido de personal por código para enriquecer tarjetas y tablas
  const mapaPersonalPorCodigo = useMemo(() => {
    const mapa = new Map();
    for (const p of personal) {
      if (p?.codigo) {
        mapa.set(p.codigo, p);
      }
    }
    return mapa;
  }, [personal]);

  // ============================================================================
  // 1. PERMISOS Y FALTAS ADMINISTRATIVAS (asistencia.registrar + asistencia.historial)
  // ============================================================================
  const [formIncidencia, setFormIncidencia] = useState(() => ({
    codigo: "",
    accion: "Permiso",
    fecha: hoy,
    observaciones: "",
    jornadaExtendida: false
  }));
  const [estadoPersonaIncidencia, setEstadoPersonaIncidencia] = useState(null);
  const [cargandoEstadoInc, setCargandoEstadoInc] = useState(false);

  // Historial de incidencias del período (asistencia.historial)
  const [filtroHistorialInc, setFiltroHistorialInc] = useState(() => ({
    inicio: `${hoy.slice(0, 8)}01`,
    fin: hoy,
    codigo: "",
    tipo: "TODOS"
  }));
  const [historialIncidencias, setHistorialIncidencias] = useState([]);
  const [cargandoHistorialInc, setCargandoHistorialInc] = useState(false);

  // Preseleccionar la primera persona cuando cargue el catálogo
  useEffect(() => {
    if (personal.length > 0) {
      const primerCodigo = personal[0]?.codigo || "";
      setFormIncidencia((f) => (f.codigo ? f : { ...f, codigo: primerCodigo }));
      setFormCorreccion((f) => (f.codigo ? f : { ...f, codigo: primerCodigo }));
    }
  }, [personal]);

  // Si es Encargado, restringir siempre la fecha de incidencia a hoy (según contrato C#)
  useEffect(() => {
    if (esEncargado && formIncidencia.fecha !== hoy) {
      setFormIncidencia((f) => ({ ...f, fecha: hoy }));
    }
  }, [esEncargado, hoy, formIncidencia.fecha]);

  // Consultar el estado actual del día de la persona seleccionada en Permisos/Faltas
  useEffect(() => {
    if (!token || !formIncidencia.codigo) {
      setEstadoPersonaIncidencia(null);
      return;
    }
    let activo = true;
    setCargandoEstadoInc(true);
    consultarEstadoAsistencia(formIncidencia.codigo, token)
      .then((est) => {
        if (activo) setEstadoPersonaIncidencia(est);
      })
      .catch(() => {
        if (activo) setEstadoPersonaIncidencia(null);
      })
      .finally(() => {
        if (activo) setCargandoEstadoInc(false);
      });
    return () => {
      activo = false;
    };
  }, [token, formIncidencia.codigo]);

  async function cargarHistorialIncidencias() {
    if (!token) return;
    setCargandoHistorialInc(true);
    try {
      const lista = await consultarHistorialAsistencia(
        {
          inicio: filtroHistorialInc.inicio || hoy,
          fin: filtroHistorialInc.fin || hoy,
          codigo: filtroHistorialInc.codigo || null
        },
        token
      );
      setHistorialIncidencias(Array.isArray(lista) ? lista : []);
    } catch {
      setHistorialIncidencias([]);
    } finally {
      setCargandoHistorialInc(false);
    }
  }

  useEffect(() => {
    if (token && subPestana === "incidencias") {
      cargarHistorialIncidencias();
    }
  }, [token, subPestana]);

  const registrosIncidenciasFiltrados = useMemo(() => {
    return historialIncidencias.filter((item) => {
      const obs = String(item.observaciones || item.estado || "").toLowerCase();
      const esPermiso =
        obs.includes("permiso") ||
        String(item.accion || "").toLowerCase() === "permiso";
      const esFalta =
        obs.includes("falta") ||
        String(item.accion || "").toLowerCase() === "falta";
      const tieneObservacion = Boolean(
        item.observaciones && String(item.observaciones).trim() !== ""
      );

      if (filtroHistorialInc.tipo === "Permiso") return esPermiso;
      if (filtroHistorialInc.tipo === "Falta") return esFalta;
      if (filtroHistorialInc.tipo === "INCIDENCIAS") {
        return esPermiso || esFalta || tieneObservacion;
      }
      return true;
    });
  }, [historialIncidencias, filtroHistorialInc.tipo]);

  // ============================================================================
  // 2. CORRECCIONES CON MOTIVO Y UUID IDEMPOTENTE (correcciones.enviar/listar/revisar)
  // ============================================================================
  const [uuidCorreccionPendiente, setUuidCorreccionPendiente] = useState(null);
  const [errorEnvioCorreccion, setErrorEnvioCorreccion] = useState("");
  const [formCorreccion, setFormCorreccion] = useState(() => ({
    codigo: "",
    fecha: hoy,
    horaEntrada: "08:00",
    horaSalida: "17:00",
    horaInicioAlmuerzo: "",
    horaFinAlmuerzo: "",
    observaciones: "",
    jornadaExtendida: false,
    motivo: ""
  }));
  const [filtroEstadoCorr, setFiltroEstadoCorr] = useState("TODAS");
  const [busquedaCorr, setBusquedaCorr] = useState("");
  const [motivosRevisionCorr, setMotivosRevisionCorr] = useState({});
  const [errorRevisionCorrId, setErrorRevisionCorrId] = useState(null);

  const calculoHorarioPropuesto = useMemo(
    () =>
      calcularMinutosPropuestos(
        formCorreccion.horaEntrada,
        formCorreccion.horaSalida,
        formCorreccion.horaInicioAlmuerzo,
        formCorreccion.horaFinAlmuerzo
      ),
    [
      formCorreccion.horaEntrada,
      formCorreccion.horaSalida,
      formCorreccion.horaInicioAlmuerzo,
      formCorreccion.horaFinAlmuerzo
    ]
  );

  const resumenMinutosPropuestos = useMemo(
    () => formatearMinutosJornada(calculoHorarioPropuesto.minutos),
    [calculoHorarioPropuesto.minutos]
  );

  const correccionesFiltradas = useMemo(() => {
    const q = busquedaCorr.trim().toLowerCase();
    return correcciones.filter((c) => {
      if (filtroEstadoCorr !== "TODAS" && c.estado !== filtroEstadoCorr) {
        return false;
      }
      if (!q) return true;
      const ficha = mapaPersonalPorCodigo.get(c.codigo);
      const nombre = ficha
        ? `${ficha.nombres || ""} ${ficha.apellidos || ""} ${ficha.nombreCompleto || ""}`.toLowerCase()
        : "";
      return (
        String(c.codigo || "").toLowerCase().includes(q) ||
        String(c.motivo || "").toLowerCase().includes(q) ||
        String(c.solicitante || "").toLowerCase().includes(q) ||
        nombre.includes(q)
      );
    });
  }, [correcciones, filtroEstadoCorr, busquedaCorr, mapaPersonalPorCodigo]);

  const contadoresCorrecciones = useMemo(() => {
    let pendientes = 0;
    let aprobadas = 0;
    let rechazadas = 0;
    for (const c of correcciones) {
      if (c.estado === "Aprobada") aprobadas++;
      else if (c.estado === "Rechazada") rechazadas++;
      else pendientes++;
    }
    return {
      total: correcciones.length,
      pendientes,
      aprobadas,
      rechazadas
    };
  }, [correcciones]);

  // ============================================================================
  // 3. INTEGRACIÓN QR Y REVISIÓN DE SOLICITUDES (qr.existe, qr.emitir, qr.pendientes, qr.solicitudes, qr.revisar)
  // ============================================================================
  const [credencialEmitida, setCredencialEmitida] = useState(null);
  const [basePortalQr, setBasePortalQr] = useState(() => {
    try {
      const guardada = localStorage.getItem("portal_qr_base_url");
      if (guardada && guardada.trim()) return guardada.trim();
      const host = typeof window !== "undefined" ? window.location?.hostname : "";
      if (host && host !== "localhost" && host !== "127.0.0.1") {
        return `http://${host}:5087`;
      }
    } catch {
      // Fallback
    }
    return "http://192.168.0.4:5087";
  });
  const [mensajeErrorQrPorId, setMensajeErrorQrPorId] = useState({});
  const [estadoQrServidor, setEstadoQrServidor] = useState({
    existe: qrExiste,
    pendientes: pendientesQr,
    verificadoEn: ""
  });
  const [soloPendientesQr, setSoloPendientesQr] = useState(true);
  const [listaSolicitudesQrLocal, setListaSolicitudesQrLocal] = useState(null);
  const [cargandoQr, setCargandoQr] = useState(false);
  const [busquedaQr, setBusquedaQr] = useState("");
  const [motivosRevisionQr, setMotivosRevisionQr] = useState({});
  const [errorRevisionQrId, setErrorRevisionQrId] = useState(null);

  useEffect(() => {
    setEstadoQrServidor((prev) => ({
      ...prev,
      existe: qrExiste,
      pendientes: pendientesQr
    }));
  }, [qrExiste, pendientesQr]);

  const solicitudesQrMostradas = useMemo(() => {
    const base =
      listaSolicitudesQrLocal !== null ? listaSolicitudesQrLocal : solicitudesQr;
    const q = busquedaQr.trim().toLowerCase();
    if (!q) return base;
    return base.filter((sq) => {
      const codigo = String(sq.codigo || "").toLowerCase();
      const nombre = String(
        sq.nombrePersonal || sq.nombreCompleto || sq.nombres || ""
      ).toLowerCase();
      const accion = String(sq.accion || "").toLowerCase();
      return codigo.includes(q) || nombre.includes(q) || accion.includes(q);
    });
  }, [listaSolicitudesQrLocal, solicitudesQr, busquedaQr]);

  // ============================================================================
  // MANEJADORES DE ACCIONES
  // ============================================================================

  // 1. Registrar Permiso o Falta con motivo (asistencia.registrar)
  async function manejarRegistrarIncidencia(e) {
    e.preventDefault();
    if (!formIncidencia.codigo) {
      onNotificarError?.("Seleccione una persona para registrar el permiso o falta.");
      return;
    }
    const motivoLimpio = formIncidencia.observaciones.trim();
    if (!motivoLimpio || motivoLimpio.length < 5) {
      onNotificarError?.(
        "Ingrese el motivo o justificación del permiso o falta (mínimo 5 caracteres)."
      );
      return;
    }

    const fechaEfectiva = esEncargado ? hoy : formIncidencia.fecha || hoy;

    setOcupadoLocal(true);
    onNotificarError?.("");
    onNotificarAviso?.("");
    try {
      const resp = await registrarMarcacionAsistencia(
        {
          codigo: formIncidencia.codigo,
          accion: formIncidencia.accion,
          fecha: fechaEfectiva,
          observaciones: motivoLimpio,
          jornadaExtendida: Boolean(formIncidencia.jornadaExtendida)
        },
        token
      );
      onNotificarAviso?.(
        typeof resp === "string"
          ? resp
          : resp?.mensaje ||
              `${formIncidencia.accion} registrado correctamente para ${formIncidencia.codigo} (${fechaEfectiva}).`
      );
      setFormIncidencia((f) => ({
        ...f,
        observaciones: "",
        jornadaExtendida: false
      }));
      await Promise.all([
        onRecargarDatos?.(),
        cargarHistorialIncidencias(),
        consultarEstadoAsistencia(formIncidencia.codigo, token)
          .then(setEstadoPersonaIncidencia)
          .catch(() => {})
      ]);
    } catch (err) {
      onNotificarError?.(err.message || "No se pudo registrar la incidencia.");
    } finally {
      setOcupadoLocal(false);
    }
  }

  // Cargar las horas actuales de la persona seleccionada en el formulario de corrección
  async function manejarAutocompletarDesdeEstado() {
    if (!formCorreccion.codigo || !token) return;
    setOcupadoLocal(true);
    onNotificarError?.("");
    try {
      const est = await consultarEstadoAsistencia(formCorreccion.codigo, token);
      const aHoraInput = (h, porDefecto) => {
        const norm = normalizarHoraCSharp(h);
        return norm ? norm.slice(0, 5) : porDefecto;
      };
      setFormCorreccion((f) => ({
        ...f,
        horaEntrada: aHoraInput(est?.horaEntrada || est?.entrada, f.horaEntrada),
        horaSalida: aHoraInput(est?.horaSalida || est?.salida, f.horaSalida),
        horaInicioAlmuerzo: aHoraInput(
          est?.horaInicioAlmuerzo || est?.inicioAlmuerzo,
          ""
        ),
        horaFinAlmuerzo: aHoraInput(
          est?.horaFinAlmuerzo || est?.finAlmuerzo,
          ""
        )
      }));
      onNotificarAviso?.(
        `Horario actual de ${formCorreccion.codigo} cargado en el formulario de corrección.`
      );
    } catch {
      onNotificarError?.(
        "No se encontraron marcaciones previas hoy para autocompletar; puede ingresar las horas manualmente."
      );
    } finally {
      setOcupadoLocal(false);
    }
  }

  // 2. Enviar solicitud de corrección con motivo y UUID idempotente (correcciones.enviar)
  async function manejarEnviarCorreccion(e) {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }
    if (!formCorreccion.codigo) {
      onNotificarError?.("Seleccione una persona para solicitar la corrección.");
      return;
    }
    if (!calculoHorarioPropuesto.valido) {
      onNotificarError?.(calculoHorarioPropuesto.error);
      return;
    }
    const motivoLimpio = formCorreccion.motivo.trim();
    if (!motivoLimpio || motivoLimpio.length < 5) {
      onNotificarError?.(
        "El motivo de la corrección es obligatorio (mínimo 5 caracteres)."
      );
      return;
    }

    setOcupadoLocal(true);
    setErrorEnvioCorreccion("");
    onNotificarError?.("");
    onNotificarAviso?.("");

    // Reutilizar el mismo UUID si se está reintentando la misma solicitud
    const idOperacionUuid = uuidCorreccionPendiente || generarUuidOperacion();
    setUuidCorreccionPendiente(idOperacionUuid);

    try {
      await enviarSolicitudCorreccionIdempotente(
        {
          id: idOperacionUuid,
          registro: {
            codigo: formCorreccion.codigo,
            fecha: formCorreccion.fecha,
            horaEntrada: formCorreccion.horaEntrada,
            horaSalida: formCorreccion.horaSalida,
            horaInicioAlmuerzo: formCorreccion.horaInicioAlmuerzo || null,
            horaFinAlmuerzo: formCorreccion.horaFinAlmuerzo || null,
            observaciones: formCorreccion.observaciones || motivoLimpio,
            jornadaExtendida: Boolean(formCorreccion.jornadaExtendida),
            reemplazarExistente: true
          },
          motivo: motivoLimpio
        },
        usuario?.rol,
        token
      );
      setUuidCorreccionPendiente(null);
      setErrorEnvioCorreccion("");
      setFormCorreccion((f) => ({
        ...f,
        motivo: "",
        observaciones: ""
      }));
      onNotificarAviso?.(
        `Solicitud de corrección enviada (UUID ${idOperacionUuid.slice(
          0,
          8
        )}…). Las horas no se alteran hasta que Admin o SuperAdmin apruebe.`
      );
      await onRecargarDatos?.();
    } catch (err) {
      const msg = err.message || "No se pudo enviar la solicitud de corrección.";
      setErrorEnvioCorreccion(msg);
      onNotificarError?.(msg);
    } finally {
      setOcupadoLocal(false);
    }
  }

  // Refrescar bandeja de correcciones directamente (correcciones.listar)
  async function manejarRefrescarCorrecciones() {
    setOcupadoLocal(true);
    onNotificarError?.("");
    try {
      await listarCorrecciones(token);
      await onRecargarDatos?.();
      onNotificarAviso?.("Bandeja de correcciones sincronizada con el servidor.");
    } catch (err) {
      onNotificarError?.(
        err.message || "No se pudo actualizar la bandeja de correcciones."
      );
    } finally {
      setOcupadoLocal(false);
    }
  }

  // Aprobar o rechazar solicitud de corrección (correcciones.revisar)
  async function manejarRevisarCorreccion(idSolicitud, aprobar) {
    const comentario = (motivosRevisionCorr[idSolicitud] || "").trim();
    if (!aprobar && !comentario) {
      setErrorRevisionCorrId(idSolicitud);
      onNotificarError?.(
        "Para rechazar una solicitud de corrección es obligatorio indicar el motivo."
      );
      return;
    }

    setErrorRevisionCorrId(null);
    setOcupadoLocal(true);
    onNotificarError?.("");
    onNotificarAviso?.("");
    try {
      await revisarSolicitudCorreccion(
        { id: idSolicitud, aprobar, motivo: comentario },
        token
      );
      setMotivosRevisionCorr((prev) => {
        const copia = { ...prev };
        delete copia[idSolicitud];
        return copia;
      });
      onNotificarAviso?.(
        aprobar
          ? "Corrección aprobada y aplicada en el registro de asistencia."
          : "Solicitud de corrección rechazada con motivo registrado."
      );
      await onRecargarDatos?.();
    } catch (err) {
      onNotificarError?.(err.message || "No se pudo revisar la corrección.");
    } finally {
      setOcupadoLocal(false);
    }
  }

  // Verificar estado QR en vivo (qr.existe + qr.pendientes + qr.solicitudes)
  async function manejarConsultarEstadoQr(forzarSoloPendientes = soloPendientesQr) {
    if (!token) return;
    setCargandoQr(true);
    onNotificarError?.("");
    try {
      const [existeResp, pendResp, listaResp] = await Promise.all([
        verificarExisteQr(token).catch(() => qrExiste),
        contarPendientesQr(token).catch(() => pendientesQr),
        listarSolicitudesQr({ soloPendientes: forzarSoloPendientes }, token).catch(
          () => []
        )
      ]);
      const existeBool = Boolean(existeResp?.existe ?? existeResp);
      const pendNum =
        Number(pendResp?.pendientes ?? pendResp?.cantidad ?? pendResp) || 0;
      setEstadoQrServidor({
        existe: existeBool,
        pendientes: pendNum,
        verificadoEn: new Date().toLocaleTimeString("es-BO", { hour12: false })
      });
      setListaSolicitudesQrLocal(Array.isArray(listaResp) ? listaResp : []);
    } catch (err) {
      onNotificarError?.(err.message || "No se pudo consultar el estado QR.");
    } finally {
      setCargandoQr(false);
    }
  }

  // Emitir credencial QR oficial de oficina (qr.emitir)
  async function manejarEmitirQr() {
    setOcupadoLocal(true);
    onNotificarError?.("");
    onNotificarAviso?.("");
    try {
      const emitida = await emitirCredencialQr(token);
      setCredencialEmitida(emitida);
      onNotificarAviso?.(
        "Credencial QR oficial emitida y actualizada en el servidor C#."
      );
      await Promise.all([
        onRecargarDatos?.(),
        manejarConsultarEstadoQr(soloPendientesQr)
      ]);
    } catch (err) {
      onNotificarError?.(err.message || "No se pudo emitir la credencial QR.");
    } finally {
      setOcupadoLocal(false);
    }
  }

  // Aprobar o rechazar solicitud QR (qr.revisar)
  async function manejarRevisarQr(idQr, aprobar) {
    const comentario = (motivosRevisionQr[idQr] || "").trim();
    if (!aprobar && !comentario) {
      setErrorRevisionQrId(idQr);
      onNotificarError?.(
        "Para rechazar una solicitud QR es obligatorio indicar el motivo."
      );
      return;
    }

    setErrorRevisionQrId(null);
    setMensajeErrorQrPorId((prev) => {
      const copia = { ...prev };
      delete copia[idQr];
      return copia;
    });
    setOcupadoLocal(true);
    onNotificarError?.("");
    onNotificarAviso?.("");
    try {
      await revisarSolicitudQr({ id: idQr, aprobar, motivo: comentario }, token);
      setMotivosRevisionQr((prev) => {
        const copia = { ...prev };
        delete copia[idQr];
        return copia;
      });
      onNotificarAviso?.(
        aprobar
          ? "Solicitud QR aprobada y aplicada en la asistencia."
          : "Solicitud QR rechazada con motivo registrado."
      );
      await Promise.all([
        onRecargarDatos?.(),
        manejarConsultarEstadoQr(soloPendientesQr)
      ]);
    } catch (err) {
      const msgError = err.message || "No se pudo revisar la solicitud QR.";
      setMensajeErrorQrPorId((prev) => ({ ...prev, [idQr]: msgError }));
      onNotificarError?.(msgError);
    } finally {
      setOcupadoLocal(false);
    }
  }

  const personaSeleccionadaInc = mapaPersonalPorCodigo.get(formIncidencia.codigo);
  const evaluacionEstadoInc = useMemo(
    () => evaluarEstadoJornada(estadoPersonaIncidencia || {}),
    [estadoPersonaIncidencia]
  );

  return (
    <div className="panel-incidencias-carlos">
      {/* Navegación interna de la Parte 2 */}
      <div className="subpestanas-asistencia" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={subPestana === "incidencias"}
          className={`btn-asist ${
            subPestana === "incidencias" ? "btn-asist-activo" : ""
          }`}
          onClick={() => setSubPestana("incidencias")}
        >
          1. Permisos y Faltas con Motivo
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subPestana === "correcciones"}
          className={`btn-asist ${
            subPestana === "correcciones" ? "btn-asist-activo" : ""
          }`}
          onClick={() => setSubPestana("correcciones")}
        >
          2. Correcciones de Horas ({contadoresCorrecciones.pendientes} pendientes /{" "}
          {contadoresCorrecciones.total})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subPestana === "qr"}
          className={`btn-asist ${subPestana === "qr" ? "btn-asist-activo" : ""}`}
          onClick={() => {
            setSubPestana("qr");
            manejarConsultarEstadoQr(soloPendientesQr);
          }}
        >
          3. Integración QR y Revisión ({estadoQrServidor.pendientes} pendientes)
        </button>
      </div>

      {/* =====================================================================
          SUB-PESTAÑA 1: PERMISOS Y FALTAS ADMINISTRATIVAS CON MOTIVO
         ===================================================================== */}
      {subPestana === "incidencias" && (
        <div className="grid-jornada-vivo">
          {/* Columna izquierda: Formulario de registro de Permiso / Falta */}
          <div className="tarjeta-asist">
            <span className="numero">
              AUSENCIAS Y PERMISOS ADMINISTRATIVOS (ASISTENCIA.REGISTRAR)
            </span>
            <h3 style={{ marginTop: "6px", marginBottom: "6px" }}>
              Registrar Permiso o Falta con motivo
            </h3>
            <p className="subtexto-asist" style={{ marginBottom: "12px" }}>
              Registra una ausencia justificada (<strong>Permiso</strong>) o
              injustificada (<strong>Falta</strong>) validando el período activo y
              los permisos de la persona en el servidor C#.
            </p>

            {/* Ficha rápida de estado del trabajador seleccionado */}
            {personaSeleccionadaInc && (
              <div className="ficha-resumen-incidencia">
                <div>
                  <strong>
                    {personaSeleccionadaInc.codigo} ·{" "}
                    {personaSeleccionadaInc.nombreCompleto ||
                      `${personaSeleccionadaInc.nombres || ""} ${
                        personaSeleccionadaInc.apellidos || ""
                      }`}
                  </strong>
                  <span className="subtexto-asist" style={{ display: "block" }}>
                    Contrato: {personaSeleccionadaInc.tipoContrato || "Pasante"} ·
                    Turno: {personaSeleccionadaInc.turno || "Tiempo Completo"}
                  </span>
                </div>
                <span
                  className={`pastilla-estado ${
                    evaluacionEstadoInc.tieneSalida
                      ? "finalizada"
                      : evaluacionEstadoInc.tieneEntrada
                      ? ""
                      : "almuerzo"
                  }`}
                >
                  {cargandoEstadoInc
                    ? "Consultando hoy…"
                    : evaluacionEstadoInc.etapa}
                </span>
              </div>
            )}

            <form
              className="grid-form-manual"
              onSubmit={manejarRegistrarIncidencia}
            >
              <div className="campo-asist">
                <label htmlFor="inc-persona">Personal</label>
                <select
                  id="inc-persona"
                  className="select-asist"
                  required
                  value={formIncidencia.codigo}
                  onChange={(e) =>
                    setFormIncidencia((f) => ({ ...f, codigo: e.target.value }))
                  }
                >
                  <option value="">Seleccione una persona…</option>
                  {personal.map((p) => (
                    <option key={p.codigo} value={p.codigo}>
                      {p.codigo} ·{" "}
                      {p.nombreCompleto ||
                        `${p.nombres || ""} ${p.apellidos || ""}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="campo-asist">
                <label htmlFor="inc-tipo">Tipo de incidencia</label>
                <select
                  id="inc-tipo"
                  className="select-asist"
                  value={formIncidencia.accion}
                  onChange={(e) =>
                    setFormIncidencia((f) => ({ ...f, accion: e.target.value }))
                  }
                >
                  {TIPOS_INCIDENCIA.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.etiqueta} ({t.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="campo-asist">
                <label htmlFor="inc-fecha">
                  Fecha de la incidencia{" "}
                  {esEncargado ? "(Encargado: solo hoy)" : ""}
                </label>
                <input
                  id="inc-fecha"
                  className="input-asist"
                  type="date"
                  required
                  disabled={esEncargado}
                  value={esEncargado ? hoy : formIncidencia.fecha}
                  onChange={(e) =>
                    setFormIncidencia((f) => ({ ...f, fecha: e.target.value }))
                  }
                />
              </div>

              <div className="campo-asist" style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="inc-motivo">
                  Motivo / Justificación detallada
                </label>
                <input
                  id="inc-motivo"
                  className="input-asist"
                  type="text"
                  required
                  minLength={5}
                  maxLength={300}
                  placeholder="Explique el motivo del permiso o falta administrativa…"
                  value={formIncidencia.observaciones}
                  onChange={(e) =>
                    setFormIncidencia((f) => ({
                      ...f,
                      observaciones: e.target.value
                    }))
                  }
                />
                <div className="chips-motivos-rapidos">
                  <span className="subtexto-asist">Motivos rápidos:</span>
                  {MOTIVOS_RAPIDOS_INCIDENCIA.map((item) => (
                    <button
                      key={item.texto}
                      type="button"
                      className="chip-motivo-btn"
                      onClick={() =>
                        setFormIncidencia((f) => ({
                          ...f,
                          accion: item.tipo,
                          observaciones: item.texto
                        }))
                      }
                    >
                      {item.tipo}: {item.texto.slice(0, 32)}…
                    </button>
                  ))}
                </div>
              </div>

              <div
                style={{
                  gridColumn: "1 / -1",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                  flexWrap: "wrap"
                }}
              >
                <label className="check-asist">
                  <input
                    type="checkbox"
                    checked={Boolean(formIncidencia.jornadaExtendida)}
                    onChange={(e) =>
                      setFormIncidencia((f) => ({
                        ...f,
                        jornadaExtendida: e.target.checked
                      }))
                    }
                  />
                  <span>Incluir marca de jornada extendida / especial</span>
                </label>

                <button
                  type="submit"
                  className="btn-asist btn-asist-primario"
                  disabled={ocupadoLocal}
                >
                  {ocupadoLocal
                    ? "Registrando en servidor…"
                    : `Guardar ${formIncidencia.accion}`}
                </button>
              </div>
            </form>
          </div>

          {/* Columna derecha: Consulta de Historial de Incidencias (asistencia.historial) */}
          <div className="tarjeta-asist">
            <div className="cabecera-tabla-hoy">
              <div>
                <span className="numero">
                  HISTORIAL DE INCIDENCIAS Y OBSERVACIONES (ASISTENCIA.HISTORIAL)
                </span>
                <h3 style={{ marginTop: "6px", marginBottom: "0" }}>
                  Registros del período ({registrosIncidenciasFiltrados.length})
                </h3>
              </div>
              <button
                type="button"
                className="btn-asist"
                disabled={cargandoHistorialInc}
                onClick={cargarHistorialIncidencias}
              >
                {cargandoHistorialInc ? "Consultando…" : "Consultar período"}
              </button>
            </div>

            <div className="grid-form-manual" style={{ marginBottom: "12px" }}>
              <div className="campo-asist">
                <label htmlFor="hist-inc-inicio">Desde</label>
                <input
                  id="hist-inc-inicio"
                  type="date"
                  className="input-asist"
                  value={filtroHistorialInc.inicio}
                  onChange={(e) =>
                    setFiltroHistorialInc((f) => ({
                      ...f,
                      inicio: e.target.value
                    }))
                  }
                />
              </div>

              <div className="campo-asist">
                <label htmlFor="hist-inc-fin">Hasta</label>
                <input
                  id="hist-inc-fin"
                  type="date"
                  className="input-asist"
                  value={filtroHistorialInc.fin}
                  onChange={(e) =>
                    setFiltroHistorialInc((f) => ({
                      ...f,
                      fin: e.target.value
                    }))
                  }
                />
              </div>

              <div className="campo-asist">
                <label htmlFor="hist-inc-tipo">Filtro de vista</label>
                <select
                  id="hist-inc-tipo"
                  className="select-asist"
                  value={filtroHistorialInc.tipo}
                  onChange={(e) =>
                    setFiltroHistorialInc((f) => ({
                      ...f,
                      tipo: e.target.value
                    }))
                  }
                >
                  <option value="TODOS">Todos los registros del rango</option>
                  <option value="INCIDENCIAS">
                    Solo Permisos, Faltas y Observaciones
                  </option>
                  <option value="Permiso">Solo Permisos</option>
                  <option value="Falta">Solo Faltas</option>
                </select>
              </div>
            </div>

            {registrosIncidenciasFiltrados.length === 0 ? (
              <p className="subtexto-asist">
                No se encontraron registros para los filtros seleccionados.
              </p>
            ) : (
              <div className="lista-tarjetas-revision lista-scroll-incidencias">
                {registrosIncidenciasFiltrados.slice(0, 25).map((item, idx) => {
                  const obsTexto = String(item.observaciones || "").trim();
                  const esPermiso = obsTexto.toLowerCase().includes("permiso");
                  const esFalta = obsTexto.toLowerCase().includes("falta");
                  return (
                    <article
                      key={
                        item.idAsistencia ||
                        `${item.codigo}-${item.fecha}-${idx}`
                      }
                      className="item-revision-asist"
                    >
                      <div className="item-revision-top">
                        <strong>
                          {item.codigo} ·{" "}
                          {item.nombreCompleto ||
                            `${item.nombres || ""} ${item.apellidos || ""}`}
                        </strong>
                        <span
                          className={`pastilla-estado ${
                            esFalta
                              ? "sin-registro"
                              : esPermiso
                              ? "almuerzo"
                              : "finalizada"
                          }`}
                        >
                          {String(item.fecha || "").slice(0, 10)}
                        </span>
                      </div>
                      <p style={{ margin: "4px 0", fontSize: "13px" }}>
                        Entrada:{" "}
                        <strong>
                          {formatearHoraVista(item.horaEntrada || item.entrada)}
                        </strong>{" "}
                        · Salida:{" "}
                        <strong>
                          {formatearHoraVista(item.horaSalida || item.salida)}
                        </strong>
                      </p>
                      <small className="subtexto-asist">
                        Observación / Motivo:{" "}
                        <strong>
                          {obsTexto || "Jornada regular sin observaciones"}
                        </strong>
                      </small>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-PESTAÑA 2: SOLICITUDES Y REVISIÓN DE CORRECCIONES DE HORAS
         ===================================================================== */}
      {subPestana === "correcciones" && (
        <div className="grid-jornada-vivo">
          {/* Columna izquierda: Enviar solicitud de corrección con UUID idempotente */}
          <div className="tarjeta-asist">
            <div className="cabecera-tabla-hoy">
              <div>
                <span className="numero">
                  SOLICITAR CORRECCIÓN DE HORAS (CORRECCIONES.ENVIAR)
                </span>
                <h3 style={{ marginTop: "6px", marginBottom: "0" }}>
                  Nueva solicitud con UUID idempotente
                </h3>
              </div>
              <button
                type="button"
                className="btn-asist"
                disabled={ocupadoLocal || !formCorreccion.codigo}
                onClick={manejarAutocompletarDesdeEstado}
              >
                Cargar horario de hoy
              </button>
            </div>

            <p className="subtexto-asist" style={{ marginBottom: "10px" }}>
              Las correcciones enviadas quedan en estado{" "}
              <strong>Pendiente</strong> y no modifican las horas acumuladas
              hasta que un <strong>Admin</strong> o <strong>SuperAdmin</strong>{" "}
              las apruebe en el servidor.
            </p>

            {/* Indicador de validación de horario propuesto y cálculo de minutos */}
            <div
              className={`ficha-resumen-incidencia ${
                !calculoHorarioPropuesto.valido ? "alerta-horario" : ""
              }`}
            >
              <div>
                <strong>
                  Tiempo neto propuesto:{" "}
                  {calculoHorarioPropuesto.valido
                    ? `${resumenMinutosPropuestos.texto} (${calculoHorarioPropuesto.minutos} min)`
                    : "Horario incompleto o inválido"}
                </strong>
                <span className="subtexto-asist" style={{ display: "block" }}>
                  {calculoHorarioPropuesto.valido
                    ? `Entrada ${normalizarHoraCSharp(
                        formCorreccion.horaEntrada
                      )} → Salida ${normalizarHoraCSharp(
                        formCorreccion.horaSalida
                      )}`
                    : calculoHorarioPropuesto.error}
                </span>
              </div>
              <span className="pastilla-estado">
                {uuidCorreccionPendiente
                  ? `UUID activo: ${uuidCorreccionPendiente.slice(0, 8)}…`
                  : "UUID listo al enviar"}
              </span>
            </div>

            {/* Si hubo un error de envío, permitir reintentar conservando el mismo UUID */}
            {uuidCorreccionPendiente && errorEnvioCorreccion && (
              <div className="caja-reintento-uuid" style={{ marginBottom: "12px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "10px",
                    flexWrap: "wrap"
                  }}
                >
                  <div>
                    <strong>Reintento seguro habilitado (mismo UUID):</strong>
                    <div style={{ fontSize: "12px" }}>
                      ID de solicitud conservado:{" "}
                      <code>{uuidCorreccionPendiente}</code>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-asist btn-asist-primario"
                    disabled={ocupadoLocal}
                    onClick={() => manejarEnviarCorreccion()}
                  >
                    Reintentar con el mismo UUID
                  </button>
                </div>
              </div>
            )}

            <form
              className="grid-form-manual"
              onSubmit={manejarEnviarCorreccion}
            >
              <div className="campo-asist">
                <label htmlFor="corr-persona">Personal</label>
                <select
                  id="corr-persona"
                  className="select-asist"
                  required
                  value={formCorreccion.codigo}
                  onChange={(e) => {
                    setFormCorreccion((f) => ({ ...f, codigo: e.target.value }));
                    setUuidCorreccionPendiente(null);
                    setErrorEnvioCorreccion("");
                  }}
                >
                  <option value="">Seleccione una persona…</option>
                  {personal.map((p) => (
                    <option key={p.codigo} value={p.codigo}>
                      {p.codigo} ·{" "}
                      {p.nombreCompleto ||
                        `${p.nombres || ""} ${p.apellidos || ""}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="campo-asist">
                <label htmlFor="corr-fecha">Fecha a corregir</label>
                <input
                  id="corr-fecha"
                  className="input-asist"
                  type="date"
                  required
                  max={hoy}
                  value={formCorreccion.fecha}
                  onChange={(e) => {
                    setFormCorreccion((f) => ({ ...f, fecha: e.target.value }));
                    setUuidCorreccionPendiente(null);
                    setErrorEnvioCorreccion("");
                  }}
                />
              </div>

              <div className="campo-asist">
                <label htmlFor="corr-ent">Entrada propuesta</label>
                <input
                  id="corr-ent"
                  className="input-asist"
                  type="time"
                  required
                  value={formCorreccion.horaEntrada}
                  onChange={(e) =>
                    setFormCorreccion((f) => ({
                      ...f,
                      horaEntrada: e.target.value
                    }))
                  }
                />
              </div>

              <div className="campo-asist">
                <label htmlFor="corr-sal">Salida propuesta</label>
                <input
                  id="corr-sal"
                  className="input-asist"
                  type="time"
                  required
                  value={formCorreccion.horaSalida}
                  onChange={(e) =>
                    setFormCorreccion((f) => ({
                      ...f,
                      horaSalida: e.target.value
                    }))
                  }
                />
              </div>

              <div className="campo-asist">
                <label htmlFor="corr-alm-i">Inicio Almuerzo (Opcional)</label>
                <input
                  id="corr-alm-i"
                  className="input-asist"
                  type="time"
                  value={formCorreccion.horaInicioAlmuerzo}
                  onChange={(e) =>
                    setFormCorreccion((f) => ({
                      ...f,
                      horaInicioAlmuerzo: e.target.value
                    }))
                  }
                />
              </div>

              <div className="campo-asist">
                <label htmlFor="corr-alm-f">Fin Almuerzo (Opcional)</label>
                <input
                  id="corr-alm-f"
                  className="input-asist"
                  type="time"
                  value={formCorreccion.horaFinAlmuerzo}
                  onChange={(e) =>
                    setFormCorreccion((f) => ({
                      ...f,
                      horaFinAlmuerzo: e.target.value
                    }))
                  }
                />
              </div>

              <div className="campo-asist" style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="corr-motivo">
                  Motivo de la corrección (mínimo 5 caracteres)
                </label>
                <input
                  id="corr-motivo"
                  className="input-asist"
                  type="text"
                  required
                  minLength={5}
                  maxLength={1000}
                  placeholder="Explique por qué se solicita corregir este horario (ej. olvido de marcación en salida)…"
                  value={formCorreccion.motivo}
                  onChange={(e) =>
                    setFormCorreccion((f) => ({ ...f, motivo: e.target.value }))
                  }
                />
              </div>

              <div
                style={{
                  gridColumn: "1 / -1",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                  flexWrap: "wrap"
                }}
              >
                <label className="check-asist">
                  <input
                    type="checkbox"
                    checked={Boolean(formCorreccion.jornadaExtendida)}
                    onChange={(e) =>
                      setFormCorreccion((f) => ({
                        ...f,
                        jornadaExtendida: e.target.checked
                      }))
                    }
                  />
                  <span>Jornada extendida autorizada</span>
                </label>

                <button
                  type="submit"
                  className="btn-asist btn-asist-primario"
                  disabled={ocupadoLocal || !calculoHorarioPropuesto.valido}
                >
                  {ocupadoLocal ? "Enviando…" : "Enviar solicitud de corrección"}
                </button>
              </div>
            </form>
          </div>

          {/* Columna derecha: Bandeja de Correcciones (correcciones.listar / correcciones.revisar) */}
          <div className="tarjeta-asist">
            <div className="cabecera-tabla-hoy">
              <div>
                <span className="numero">
                  BANDEJA DE CORRECCIONES (CORRECCIONES.LISTAR · CORRECCIONES.REVISAR)
                </span>
                <h3 style={{ marginTop: "6px", marginBottom: "0" }}>
                  {esEncargado
                    ? "Mis solicitudes de corrección"
                    : "Revisión de correcciones de horario"}
                </h3>
              </div>
              <button
                type="button"
                className="btn-asist"
                disabled={ocupadoLocal}
                onClick={manejarRefrescarCorrecciones}
              >
                Actualizar bandeja
              </button>
            </div>

            {/* Filtros por estado y búsqueda */}
            <div className="contadores-hoy-barra" style={{ marginBottom: "10px" }}>
              {[
                { id: "TODAS", etiqueta: `Todas (${contadoresCorrecciones.total})` },
                {
                  id: "Pendiente",
                  etiqueta: `Pendientes (${contadoresCorrecciones.pendientes})`
                },
                {
                  id: "Aprobada",
                  etiqueta: `Aprobadas (${contadoresCorrecciones.aprobadas})`
                },
                {
                  id: "Rechazada",
                  etiqueta: `Rechazadas (${contadoresCorrecciones.rechazadas})`
                }
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`chip-motivo-btn ${
                    filtroEstadoCorr === f.id ? "activo" : ""
                  }`}
                  onClick={() => setFiltroEstadoCorr(f.id)}
                >
                  {f.etiqueta}
                </button>
              ))}
            </div>

            <div className="campo-asist" style={{ marginBottom: "12px" }}>
              <input
                type="search"
                className="input-asist"
                placeholder="Buscar por código, nombre, solicitante o motivo…"
                value={busquedaCorr}
                onChange={(e) => setBusquedaCorr(e.target.value)}
              />
            </div>

            {correccionesFiltradas.length === 0 ? (
              <p className="subtexto-asist">
                No hay solicitudes de corrección que coincidan con el filtro actual.
              </p>
            ) : (
              <div className="lista-tarjetas-revision lista-scroll-incidencias">
                {correccionesFiltradas.map((c) => {
                  let reg = {};
                  try {
                    reg = c.registroJson
                      ? JSON.parse(c.registroJson)
                      : c.registro || {};
                  } catch {
                    reg = {};
                  }
                  const ficha = mapaPersonalPorCodigo.get(c.codigo);
                  const nombrePersona = ficha
                    ? ficha.nombreCompleto ||
                      `${ficha.nombres || ""} ${ficha.apellidos || ""}`.trim()
                    : "";
                  const faltaMotivoRechazo = errorRevisionCorrId === c.id;

                  return (
                    <article key={c.id} className="item-revision-asist">
                      <div className="item-revision-top">
                        <strong>
                          {c.codigo}
                          {nombrePersona ? ` · ${nombrePersona}` : ""} ·{" "}
                          {String(c.fecha || reg.fecha || "").slice(0, 10)}
                        </strong>
                        <span
                          className={`pastilla-estado ${
                            c.estado === "Aprobada"
                              ? "finalizada"
                              : c.estado === "Rechazada"
                              ? "sin-registro"
                              : "almuerzo"
                          }`}
                        >
                          {c.estado || "Pendiente"}
                        </span>
                      </div>

                      <div className="detalle-horario-propuesto">
                        <span>
                          Entrada:{" "}
                          <strong>{formatearHoraVista(reg.horaEntrada)}</strong>
                        </span>
                        <span>
                          Almuerzo:{" "}
                          <strong>
                            {reg.horaInicioAlmuerzo
                              ? `${formatearHoraVista(
                                  reg.horaInicioAlmuerzo
                                )} - ${formatearHoraVista(reg.horaFinAlmuerzo)}`
                              : "Sin registro"}
                          </strong>
                        </span>
                        <span>
                          Salida:{" "}
                          <strong>{formatearHoraVista(reg.horaSalida)}</strong>
                        </span>
                      </div>

                      <p style={{ margin: "4px 0", fontSize: "13px" }}>
                        <strong>Motivo:</strong> {c.motivo}
                      </p>

                      <small className="subtexto-asist">
                        Solicitó: <strong>{c.solicitante || "Encargado"}</strong>
                        {c.revisor
                          ? ` · Revisó ${c.revisor}${
                              c.respuesta ? ` (${c.respuesta})` : ""
                            }`
                          : ""}
                      </small>

                      {!esEncargado && c.estado === "Pendiente" && (
                        <div className="acciones-revision-inline">
                          <input
                            className={`input-asist ${
                              faltaMotivoRechazo ? "input-error-borde" : ""
                            }`}
                            type="text"
                            placeholder="Comentario o motivo (obligatorio para rechazar)…"
                            value={motivosRevisionCorr[c.id] || ""}
                            onChange={(e) => {
                              if (faltaMotivoRechazo) setErrorRevisionCorrId(null);
                              setMotivosRevisionCorr((m) => ({
                                ...m,
                                [c.id]: e.target.value
                              }));
                            }}
                          />
                          <button
                            type="button"
                            className="btn-asist btn-asist-primario"
                            disabled={ocupadoLocal}
                            onClick={() => manejarRevisarCorreccion(c.id, true)}
                          >
                            Aprobar
                          </button>
                          <button
                            type="button"
                            className="btn-asist btn-asist-peligro"
                            disabled={ocupadoLocal}
                            onClick={() => manejarRevisarCorreccion(c.id, false)}
                          >
                            Rechazar
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-PESTAÑA 3: INTEGRACIÓN QR Y REVISIÓN DE SOLICITUDES DEL ENCARGADO
         ===================================================================== */}
      {subPestana === "qr" && (
        <div className="grid-jornada-vivo">
          {/* Columna izquierda: Estado y Emisión de Credencial QR Oficial */}
          <div className="tarjeta-asist">
            <span className="numero">
              CREDENCIAL QR OFICIAL (QR.EXISTE · QR.EMITIR · QR.PENDIENTES)
            </span>
            <h3 style={{ marginTop: "6px", marginBottom: "8px" }}>
              Administración de Credencial QR de Oficina
            </h3>
            <p className="subtexto-asist" style={{ marginBottom: "14px" }}>
              El escaneo firmado se recibe desde el portal QR del servidor C# y
              genera solicitudes que el administrador o encargado autorizado
              verifica antes de consolidar la asistencia.
            </p>

            <div className="resumen-estado-persona" style={{ marginBottom: "14px" }}>
              <div className="dato-estado-item">
                <small>Credencial QR en Servidor</small>
                <strong>
                  {estadoQrServidor.existe ? "Vigente y activa" : "No emitida aún"}
                </strong>
              </div>
              <div className="dato-estado-item">
                <small>Solicitudes QR Pendientes</small>
                <strong>{estadoQrServidor.pendientes} por revisar</strong>
              </div>
            </div>

            <div className="acciones-revision-inline" style={{ marginBottom: "12px" }}>
              <button
                type="button"
                className="btn-asist"
                disabled={cargandoQr || ocupadoLocal}
                onClick={() => manejarConsultarEstadoQr(soloPendientesQr)}
              >
                {cargandoQr ? "Verificando…" : "Verificar estado QR"}
              </button>

              {!esEncargado && (
                <button
                  type="button"
                  className="btn-asist btn-asist-primario"
                  disabled={ocupadoLocal}
                  onClick={manejarEmitirQr}
                >
                  {ocupadoLocal
                    ? "Emitiendo…"
                    : estadoQrServidor.existe
                    ? "Renovar / Emitir Credencial QR"
                    : "Emitir Credencial QR"}
                </button>
              )}
            </div>

            {estadoQrServidor.verificadoEn && (
              <small className="subtexto-asist" style={{ display: "block" }}>
                Última verificación directa con C#: {estadoQrServidor.verificadoEn}
              </small>
            )}

            {credencialEmitida && (() => {
              const tokenQr =
                typeof credencialEmitida === "string"
                  ? credencialEmitida
                  : credencialEmitida?.token || "";
              const lugarQr = credencialEmitida?.lugar || "Oficina";
              const baseLimpia = String(basePortalQr || "http://localhost:5088")
                .trim()
                .replace(/\/$/, "");
              const urlMarcacionQr = tokenQr
                ? `${baseLimpia}/marcar/${tokenQr}`
                : "";
              const urlImagenQr = urlMarcacionQr
                ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(
                    urlMarcacionQr
                  )}`
                : "";

              return (
                <div className="caja-reintento-uuid" style={{ marginTop: "14px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "8px"
                    }}
                  >
                    <strong>
                      Cartel QR Oficial emitido ({lugarQr})
                    </strong>
                    <span className="pastilla-estado activa">Listo para escanear</span>
                  </div>

                  <div className="campo-asist" style={{ marginTop: "10px" }}>
                    <label htmlFor="qr-base-url">
                      Dirección del portal QR (Local o IP Wi-Fi del servidor C#)
                    </label>
                    <input
                      id="qr-base-url"
                      className="input-asist"
                      type="text"
                      value={basePortalQr}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBasePortalQr(val);
                        try {
                          if (val && val.trim()) {
                            localStorage.setItem("portal_qr_base_url", val.trim());
                          }
                        } catch {
                          // Fallback
                        }
                      }}
                      placeholder="Ej. http://localhost:5088 o http://192.168.44.1:5087"
                    />
                  </div>

                  {urlImagenQr && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "10px",
                        background: "#ffffff",
                        border: "1px solid #c5d4c0",
                        borderRadius: "12px",
                        padding: "16px",
                        marginTop: "12px",
                        textAlign: "center"
                      }}
                    >
                      <strong style={{ fontSize: "15px", color: "#173c32" }}>
                        OFICINA SANTIAGO II · MARCACIÓN POR QR
                      </strong>
                      <img
                        src={urlImagenQr}
                        alt="Código QR de marcación de oficina"
                        width={220}
                        height={220}
                        style={{
                          borderRadius: "8px",
                          border: "1px solid #e2ebe0"
                        }}
                      />
                      <small
                        style={{
                          wordBreak: "break-all",
                          color: "#35523d",
                          fontSize: "12px"
                        }}
                      >
                        Enlace directo:{" "}
                        <a
                          href={urlMarcacionQr}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontWeight: 700, color: "#173c32" }}
                        >
                          {urlMarcacionQr}
                        </a>
                      </small>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          flexWrap: "wrap",
                          justifyContent: "center"
                        }}
                      >
                        <a
                          href={urlMarcacionQr}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-asist btn-asist-primario"
                          style={{ textDecoration: "none" }}
                        >
                          Abrir formulario de marcación QR
                        </a>
                        <button
                          type="button"
                          className="btn-asist"
                          onClick={() => window.print()}
                        >
                          Imprimir / Guardar Cartel QR
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Columna derecha: Bandeja de Solicitudes QR (qr.solicitudes · qr.revisar) */}
          <div className="tarjeta-asist">
            <div className="cabecera-tabla-hoy">
              <div>
                <span className="numero">
                  REVISIÓN DE SOLICITUDES QR (QR.SOLICITUDES · QR.REVISAR)
                </span>
                <h3 style={{ marginTop: "6px", marginBottom: "0" }}>
                  Solicitudes QR ({solicitudesQrMostradas.length})
                </h3>
              </div>

              <div className="contadores-hoy-barra">
                <button
                  type="button"
                  className={`chip-motivo-btn ${soloPendientesQr ? "activo" : ""}`}
                  onClick={() => {
                    setSoloPendientesQr(true);
                    manejarConsultarEstadoQr(true);
                  }}
                >
                  Solo pendientes
                </button>
                <button
                  type="button"
                  className={`chip-motivo-btn ${!soloPendientesQr ? "activo" : ""}`}
                  onClick={() => {
                    setSoloPendientesQr(false);
                    manejarConsultarEstadoQr(false);
                  }}
                >
                  Historial QR
                </button>
              </div>
            </div>

            <div className="campo-asist" style={{ marginBottom: "12px" }}>
              <input
                type="search"
                className="input-asist"
                placeholder="Filtrar solicitudes QR por código, persona o acción…"
                value={busquedaQr}
                onChange={(e) => setBusquedaQr(e.target.value)}
              />
            </div>

            {solicitudesQrMostradas.length === 0 ? (
              <p className="subtexto-asist">
                No hay solicitudes QR{" "}
                {soloPendientesQr ? "pendientes" : "registradas"} en este momento.
              </p>
            ) : (
              <div className="lista-tarjetas-revision lista-scroll-incidencias">
                {solicitudesQrMostradas.map((sq) => {
                  const idSq = sq.id || sq.idSolicitud;
                  const ficha = mapaPersonalPorCodigo.get(sq.codigo);
                  const nombrePersona =
                    sq.nombrePersonal ||
                    sq.nombreCompleto ||
                    (ficha
                      ? ficha.nombreCompleto ||
                        `${ficha.nombres || ""} ${ficha.apellidos || ""}`.trim()
                      : "");
                  const estadoSq = sq.estado || "Pendiente";
                  const faltaMotivoQr = errorRevisionQrId === idSq;
                  const errorEspecificoQr = mensajeErrorQrPorId[idSq];

                  return (
                    <article key={idSq} className="item-revision-asist">
                      <div className="item-revision-top">
                        <strong>
                          {sq.codigo || "QR"}
                          {nombrePersona ? ` · ${nombrePersona}` : ""} ·{" "}
                          {sq.accion || "Marcación"}
                        </strong>
                        <span
                          className={`pastilla-estado ${
                            estadoSq === "Aprobada"
                              ? "finalizada"
                              : estadoSq === "Rechazada"
                              ? "sin-registro"
                              : "almuerzo"
                          }`}
                        >
                          {estadoSq}
                        </span>
                      </div>

                      <small className="subtexto-asist" style={{ display: "block" }}>
                        {sq.fechaEscaneo
                          ? `Escaneo: ${String(sq.fechaEscaneo)
                              .replace("T", " ")
                              .slice(0, 19)} · `
                          : ""}
                        Solicitud:{" "}
                        {String(
                          sq.fechaSolicitud || sq.creada || sq.fecha || "—"
                        )
                          .replace("T", " ")
                          .slice(0, 19)}
                        {sq.revisor ? ` · Revisó: ${sq.revisor}` : ""}
                        {sq.motivo || sq.respuesta
                          ? ` · Nota: ${sq.motivo || sq.respuesta}`
                          : ""}
                      </small>

                      {errorEspecificoQr && (
                        <div
                          className="aviso-asistencia alerta"
                          style={{
                            marginTop: "8px",
                            padding: "8px 10px",
                            fontSize: "12px"
                          }}
                        >
                          <span>
                            <strong>Rechazado por reglas C#:</strong>{" "}
                            {errorEspecificoQr} (Si la hora de escaneo ya quedó
                            atrás respecto a otra marcación de hoy, rechace esta
                            solicitud con un motivo).
                          </span>
                        </div>
                      )}

                      {!esEncargado && estadoSq === "Pendiente" && (
                        <div className="acciones-revision-inline">
                          <input
                            className={`input-asist ${
                              faltaMotivoQr ? "input-error-borde" : ""
                            }`}
                            type="text"
                            placeholder="Observación o motivo (obligatorio para rechazar)…"
                            value={motivosRevisionQr[idSq] || ""}
                            onChange={(e) => {
                              if (faltaMotivoQr) setErrorRevisionQrId(null);
                              setMotivosRevisionQr((m) => ({
                                ...m,
                                [idSq]: e.target.value
                              }));
                            }}
                          />
                          <button
                            type="button"
                            className="btn-asist btn-asist-primario"
                            disabled={ocupadoLocal}
                            onClick={() => manejarRevisarQr(idSq, true)}
                          >
                            Aprobar QR
                          </button>
                          <button
                            type="button"
                            className="btn-asist btn-asist-peligro"
                            disabled={ocupadoLocal}
                            onClick={() => manejarRevisarQr(idSq, false)}
                          >
                            Rechazar
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
