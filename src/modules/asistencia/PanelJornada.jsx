// PARTE 1 (GABRIEL): Jornada laboral, marcaciones en vivo, validación de secuencia,
// reintentos idempotentes con UUID, registro manual y sincronización con escritorio.
// NOTA PARA CARLOS: No editar este archivo; trabajar en PanelIncidenciasQr.jsx y asistencia.css.

import React, { useEffect, useMemo, useState } from "react";
import {
  ACCIONES_JORNADA,
  hoyBolivia,
  formatearHoraVista,
  formatearMinutosJornada,
  generarUuidOperacion,
  evaluarEstadoJornada,
  validarSecuenciaJornada,
  consultarEstadoAsistencia,
  registrarMarcacionAsistencia,
  registrarMarcacionRapidaIdempotente,
  registrarAsistenciaManual
} from "./asistenciaApi.js";

export default function PanelJornada({
  token,
  usuario,
  personal = [],
  proyectos = [],
  idProyectoFiltro = "",
  onCambiarProyectoFiltro,
  resumenDia = [],
  registrosDirectosDia = [],
  estadoConexion,
  ultimaSincronizacion,
  onRecargarDatos,
  onNotificarAviso,
  onNotificarError
}) {
  const esEncargado = usuario?.rol === "Encargado";

  // Estado de marcación en vivo / rápida
  const [codigoSeleccionado, setCodigoSeleccionado] = useState("");
  const [estadoPersona, setEstadoPersona] = useState(null);
  const [cargandoEstado, setCargandoEstado] = useState(false);
  const [observacionJornada, setObservacionJornada] = useState("");
  const [jornadaExtendida, setJornadaExtendida] = useState(false);
  const [modoRapidoIdempotente, setModoRapidoIdempotente] = useState(true);
  const [uuidPendiente, setUuidPendiente] = useState(null);
  const [accionPendiente, setAccionPendiente] = useState("");
  const [enviandoMarcacion, setEnviandoMarcacion] = useState(false);

  // Sub-vista dentro de Jornada: 'marcacion' | 'manual'
  const [subVistaJornada, setSubVistaJornada] = useState("marcacion");

  // Formulario de Registro Manual (igual a la ventana de escritorio)
  const [formManual, setFormManual] = useState(() => ({
    codigo: "",
    fecha: hoyBolivia(),
    horaEntrada: "08:00",
    horaSalida: "17:00",
    horaInicioAlmuerzo: "",
    horaFinAlmuerzo: "",
    observaciones: "",
    jornadaExtendida: false,
    reemplazarExistente: false
  }));
  const [guardandoManual, setGuardandoManual] = useState(false);
  const [busquedaTabla, setBusquedaTabla] = useState("");

  // Seleccionar primera persona por defecto cuando se carga el catálogo
  useEffect(() => {
    if (!codigoSeleccionado && personal.length > 0) {
      const primero = personal[0]?.codigo || "";
      setCodigoSeleccionado(primero);
      setFormManual((f) => ({ ...f, codigo: f.codigo || primero }));
    }
  }, [personal, codigoSeleccionado]);

  // Consultar estado de jornada de la persona seleccionada (asistencia.estado)
  async function cargarEstadoPersonaActual(codigo = codigoSeleccionado) {
    if (!token || !codigo) {
      setEstadoPersona(null);
      return;
    }
    setCargandoEstado(true);
    try {
      const est = await consultarEstadoAsistencia(codigo, token);
      setEstadoPersona(est);
    } catch {
      // Si asistencia.estado no devuelve registro previo, buscar en resumenDia o registrosDirectosDia
      const enResumen =
        resumenDia.find((r) => r.codigo === codigo) ||
        registrosDirectosDia.find((r) => r.codigo === codigo) ||
        null;
      setEstadoPersona(enResumen);
    } finally {
      setCargandoEstado(false);
    }
  }

  useEffect(() => {
    if (codigoSeleccionado && token) {
      cargarEstadoPersonaActual(codigoSeleccionado);
    }
  }, [codigoSeleccionado, token, ultimaSincronizacion]);

  // Combinar datos de estadoPersona con los registros del día para tener siempre la vista más fresca
  const registroHoyPersona = useMemo(() => {
    const deDirecto = registrosDirectosDia.find(
      (r) => r.codigo === codigoSeleccionado
    );
    const deResumen = resumenDia.find((r) => r.codigo === codigoSeleccionado);
    return {
      ...(deResumen || {}),
      ...(deDirecto || {}),
      ...(estadoPersona || {})
    };
  }, [codigoSeleccionado, estadoPersona, resumenDia, registrosDirectosDia]);

  const evaluacionSecuencia = useMemo(
    () => evaluarEstadoJornada(registroHoyPersona),
    [registroHoyPersona]
  );

  // Ejecutar marcación de Entrada, Inicio Almuerzo, Fin Almuerzo o Salida
  async function ejecutarMarcacion(accionId) {
    if (!codigoSeleccionado) {
      onNotificarError?.("Seleccione una persona antes de registrar la marcación.");
      return;
    }

    const validacion = validarSecuenciaJornada(registroHoyPersona, accionId);
    if (!validacion.valido) {
      onNotificarError?.(validacion.mensaje);
      return;
    }

    setEnviandoMarcacion(true);
    onNotificarError?.("");
    onNotificarAviso?.("");

    // Si es la misma acción que falló por red antes, reutilizar el mismo UUID idempotente
    const uuidActual =
      uuidPendiente && accionPendiente === accionId
        ? uuidPendiente
        : generarUuidOperacion();
    setUuidPendiente(uuidActual);
    setAccionPendiente(accionId);

    try {
      if (
        modoRapidoIdempotente &&
        !observacionJornada.trim() &&
        !jornadaExtendida
      ) {
        const { resultado, intentos } = await registrarMarcacionRapidaIdempotente(
          {
            idOperacion: uuidActual,
            codigo: codigoSeleccionado,
            accion: accionId,
            origen: "codigo"
          },
          token
        );
        const msgServidor =
          typeof resultado === "string"
            ? resultado
            : resultado?.mensaje ||
              `Marcación "${accionId}" registrada para ${codigoSeleccionado}.`;
        onNotificarAviso?.(
          intentos > 1
            ? `${msgServidor} (Confirmada tras ${intentos} intentos idempotentes con UUID ${uuidActual.slice(
                0,
                8
              )})`
            : msgServidor
        );
      } else {
        const resultado = await registrarMarcacionAsistencia(
          {
            codigo: codigoSeleccionado,
            accion: accionId,
            observaciones: observacionJornada.trim() || null,
            jornadaExtendida
          },
          token
        );
        const msgServidor =
          typeof resultado === "string"
            ? resultado
            : resultado?.mensaje ||
              `Marcación "${accionId}" registrada correctamente.`;
        onNotificarAviso?.(msgServidor);
      }

      // Éxito: limpiar UUID pendiente y recargar datos
      setUuidPendiente(null);
      setAccionPendiente("");
      setObservacionJornada("");
      await cargarEstadoPersonaActual(codigoSeleccionado);
      await onRecargarDatos?.();
    } catch (err) {
      onNotificarError?.(
        err.message ||
          "Error al registrar la marcación. Si fue un corte de red, puede reintentar sin duplicar el registro."
      );
    } finally {
      setEnviandoMarcacion(false);
    }
  }

  // Guardar Registro Manual de Asistencia (asistencia.manual)
  async function manejarGuardarManual(e) {
    e.preventDefault();
    if (!formManual.codigo) {
      onNotificarError?.("Seleccione una persona para el registro manual.");
      return;
    }
    if (
      (formManual.horaInicioAlmuerzo && !formManual.horaFinAlmuerzo) ||
      (!formManual.horaInicioAlmuerzo && formManual.horaFinAlmuerzo)
    ) {
      onNotificarError?.(
        "Si indica horario de almuerzo, debe completar tanto Inicio como Fin de almuerzo."
      );
      return;
    }

    setGuardandoManual(true);
    onNotificarError?.("");
    onNotificarAviso?.("");
    try {
      const respuesta = await registrarAsistenciaManual(
        formManual,
        usuario?.rol,
        token
      );
      const msg =
        typeof respuesta === "string"
          ? respuesta
          : respuesta?.mensaje || "Asistencia manual guardada correctamente.";
      onNotificarAviso?.(msg);
      await cargarEstadoPersonaActual(formManual.codigo);
      await onRecargarDatos?.();
    } catch (err) {
      onNotificarError?.(
        err.message || "No se pudo guardar el registro manual de asistencia."
      );
    } finally {
      setGuardandoManual(false);
    }
  }

  // Construir filas unificadas de la tabla de hoy (une resumenDia de C# y registrosDirectosDia de PostgreSQL)
  const filasHoyUnificadas = useMemo(() => {
    const mapa = new Map();

    for (const p of personal) {
      if (!p.codigo) continue;
      mapa.set(p.codigo, {
        codigo: p.codigo,
        nombreCompleto:
          p.nombreCompleto || `${p.nombres || ""} ${p.apellidos || ""}`.trim(),
        entrada: null,
        inicioAlmuerzo: null,
        finAlmuerzo: null,
        salida: null,
        minutosTrabajados: 0,
        estado: "Sin Registro"
      });
    }

    for (const r of resumenDia) {
      const cod = r.codigo;
      if (!cod) continue;
      const prev = mapa.get(cod) || { codigo: cod };
      mapa.set(cod, {
        ...prev,
        nombreCompleto:
          r.nombreCompleto ||
          `${r.nombres || ""} ${r.apellidos || ""}`.trim() ||
          prev.nombreCompleto ||
          cod,
        entrada: r.horaEntrada ?? r.entrada ?? prev.entrada,
        inicioAlmuerzo:
          r.horaInicioAlmuerzo ?? r.inicioAlmuerzo ?? prev.inicioAlmuerzo,
        finAlmuerzo: r.horaFinAlmuerzo ?? r.finAlmuerzo ?? prev.finAlmuerzo,
        salida: r.horaSalida ?? r.salida ?? prev.salida,
        minutosTrabajados:
          r.minutosTrabajados ?? prev.minutosTrabajados ?? 0,
        estado: r.estadoTexto || r.estado || prev.estado
      });
    }

    for (const d of registrosDirectosDia) {
      const cod = d.codigo;
      if (!cod) continue;
      const prev = mapa.get(cod) || { codigo: cod };
      mapa.set(cod, {
        ...prev,
        nombreCompleto:
          `${d.nombres || ""} ${d.apellidos || ""}`.trim() ||
          prev.nombreCompleto ||
          cod,
        entrada: d.entrada ?? prev.entrada,
        inicioAlmuerzo: d.inicioAlmuerzo ?? prev.inicioAlmuerzo,
        finAlmuerzo: d.finAlmuerzo ?? prev.finAlmuerzo,
        salida: d.salida ?? prev.salida,
        minutosTrabajados:
          d.minutosTrabajados ?? prev.minutosTrabajados ?? 0
      });
    }

    const q = busquedaTabla.trim().toLowerCase();
    return Array.from(mapa.values())
      .map((item) => {
        const evalItem = evaluarEstadoJornada(item);
        return {
          ...item,
          etapaCalculada: evalItem.etapa,
          tiempoFormateado: formatearMinutosJornada(item.minutosTrabajados)
        };
      })
      .filter((item) => {
        if (!q) return true;
        return `${item.codigo} ${item.nombreCompleto} ${item.etapaCalculada}`
          .toLowerCase()
          .includes(q);
      });
  }, [personal, resumenDia, registrosDirectosDia, busquedaTabla]);

  // Contadores de resumen del día (como en la pantalla principal de escritorio)
  const contadoresHoy = useMemo(() => {
    let enJornada = 0;
    let enAlmuerzo = 0;
    let finalizados = 0;
    let sinRegistro = 0;
    for (const f of filasHoyUnificadas) {
      if (f.salida) finalizados++;
      else if (f.inicioAlmuerzo && !f.finAlmuerzo) enAlmuerzo++;
      else if (f.entrada) enJornada++;
      else sinRegistro++;
    }
    return { enJornada, enAlmuerzo, finalizados, sinRegistro };
  }, [filasHoyUnificadas]);

  return (
    <div className="panel-jornada-gabriel">
      {/* Selector de sub-vista de Parte 1 */}
      <div className="subpestanas-asistencia">
        <button
          type="button"
          className={`btn-asist ${
            subVistaJornada === "marcacion" ? "btn-asist-activo" : ""
          }`}
          onClick={() => setSubVistaJornada("marcacion")}
        >
          Marcación de Jornada en Vivo (Entrada / Almuerzo / Salida)
        </button>
        <button
          type="button"
          className={`btn-asist ${
            subVistaJornada === "manual" ? "btn-asist-activo" : ""
          }`}
          onClick={() => setSubVistaJornada("manual")}
        >
          + Registro Manual de Asistencia ({esEncargado ? "Solo hoy" : "Planilla"})
        </button>
      </div>

      {subVistaJornada === "marcacion" ? (
        <div className="grid-jornada-vivo">
          {/* Tarjeta izquierda: Control de marcación y secuencia */}
          <div className="tarjeta-asist">
            <span className="numero">
              CONTROL DE MARCACIÓN Y SECUENCIA (AMERICA/LA_PAZ)
            </span>
            <h3 style={{ marginTop: "6px", marginBottom: "10px" }}>
              Registrar Entrada, Almuerzo y Salida
            </h3>

            <div className="campo-asist">
              <label htmlFor="asist-select-persona">
                Persona (o escriba / seleccione código)
              </label>
              <select
                id="asist-select-persona"
                className="select-asist"
                value={codigoSeleccionado}
                onChange={(e) => {
                  setCodigoSeleccionado(e.target.value);
                  setUuidPendiente(null);
                }}
              >
                <option value="">Seleccione una persona…</option>
                {personal.map((p) => (
                  <option key={p.codigo} value={p.codigo}>
                    {p.codigo} ·{" "}
                    {p.nombreCompleto || `${p.nombres || ""} ${p.apellidos || ""}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="opciones-marcacion-fila">
              <label className="check-asist">
                <input
                  type="checkbox"
                  checked={jornadaExtendida}
                  onChange={(e) => setJornadaExtendida(e.target.checked)}
                />
                <span>Jornada extendida (Medio tiempo con almuerzo)</span>
              </label>

              <label className="check-asist">
                <input
                  type="checkbox"
                  checked={modoRapidoIdempotente}
                  onChange={(e) => setModoRapidoIdempotente(e.target.checked)}
                />
                <span>
                  Marcación rápida idempotente (<code>asistencia.rapida</code> con
                  UUID)
                </span>
              </label>
            </div>

            <div className="campo-asist" style={{ marginTop: "10px" }}>
              <label htmlFor="asist-obs-vivo">
                Observación de marcación (opcional)
              </label>
              <input
                id="asist-obs-vivo"
                className="input-asist"
                type="text"
                maxLength={300}
                placeholder="Ej. Ingreso en obra Cotoca, turno normal…"
                value={observacionJornada}
                onChange={(e) => setObservacionJornada(e.target.value)}
              />
            </div>

            {/* Botones de las 4 acciones en orden secuencial */}
            <div className="botones-secuencia-grid" style={{ marginTop: "14px" }}>
              {ACCIONES_JORNADA.map((acc) => {
                const permitida =
                  evaluacionSecuencia.accionesPermitidas[acc.id] ?? true;
                const esSugerida =
                  evaluacionSecuencia.siguienteAccionSugerida === acc.id;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    disabled={enviandoMarcacion || !codigoSeleccionado || !permitida}
                    className={`btn-asist ${
                      esSugerida && permitida ? "btn-asist-primario" : ""
                    }`}
                    onClick={() => ejecutarMarcacion(acc.id)}
                    title={
                      permitida
                        ? `Registrar ${acc.etiqueta}`
                        : "Acción bloqueada por secuencia o ya registrada hoy"
                    }
                  >
                    {enviandoMarcacion && accionPendiente === acc.id
                      ? "Registrando…"
                      : acc.etiqueta}
                  </button>
                );
              })}
            </div>

            {uuidPendiente && (
              <div className="caja-reintento-uuid" style={{ marginTop: "12px" }}>
                <small>
                  <strong>Reintento idempotente listo:</strong> si hubo un corte de
                  red, al volver a pulsar <code>{accionPendiente}</code> se
                  reutilizará el UUID <code>{uuidPendiente}</code> para evitar
                  duplicados.
                </small>
              </div>
            )}
          </div>

          {/* Tarjeta derecha: Estado de jornada y tiempo trabajado de la persona */}
          <div className="tarjeta-asist">
            <span className="numero">
              ESTADO DE JORNADA Y TIEMPO TRABAJADO (ASISTENCIA.ESTADO)
            </span>
            <h3 style={{ marginTop: "6px", marginBottom: "10px" }}>
              {codigoSeleccionado
                ? `Ficha del día: ${codigoSeleccionado}`
                : "Seleccione una persona"}
            </h3>

            {!codigoSeleccionado ? (
              <p>Seleccione una persona para ver su estado de jornada.</p>
            ) : (
              <div className="resumen-estado-persona">
                <div className="dato-estado-item">
                  <small>Estado actual</small>
                  <strong>{evaluacionSecuencia.etapa}</strong>
                </div>
                <div className="dato-estado-item">
                  <small>Tiempo trabajado hoy</small>
                  <strong>
                    {
                      formatearMinutosJornada(
                        registroHoyPersona?.minutosTrabajados
                      ).texto
                    }{" "}
                    ({Number(registroHoyPersona?.minutosTrabajados) || 0} min)
                  </strong>
                </div>
                <div className="dato-estado-item">
                  <small>Hora de Entrada</small>
                  <strong>
                    {formatearHoraVista(
                      registroHoyPersona?.horaEntrada ||
                        registroHoyPersona?.entrada
                    )}
                  </strong>
                </div>
                <div className="dato-estado-item">
                  <small>Inicio / Fin Almuerzo</small>
                  <strong>
                    {formatearHoraVista(
                      registroHoyPersona?.horaInicioAlmuerzo ||
                        registroHoyPersona?.inicioAlmuerzo
                    )}{" "}
                    /{" "}
                    {formatearHoraVista(
                      registroHoyPersona?.horaFinAlmuerzo ||
                        registroHoyPersona?.finAlmuerzo
                    )}
                  </strong>
                </div>
                <div className="dato-estado-item">
                  <small>Hora de Salida</small>
                  <strong>
                    {formatearHoraVista(
                      registroHoyPersona?.horaSalida ||
                        registroHoyPersona?.salida
                    )}
                  </strong>
                </div>
                <div className="dato-estado-item">
                  <small>Siguiente paso válido</small>
                  <strong>
                    {evaluacionSecuencia.siguienteAccionSugerida
                      ? evaluacionSecuencia.siguienteAccionSugerida.toUpperCase()
                      : "Jornada completa"}
                  </strong>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Formulario de Registro Manual de Asistencia (asistencia.manual) */
        <div className="tarjeta-asist">
          <span className="numero">
            REGISTRO MANUAL DE ASISTENCIA (ASISTENCIA.MANUAL)
          </span>
          <h3 style={{ marginTop: "6px", marginBottom: "6px" }}>
            Cargar horario manual del día
          </h3>
          <p className="subtexto-asist" style={{ marginTop: 0 }}>
            {esEncargado
              ? "Como Encargado, solo puede registrar asistencias de la fecha actual en Bolivia sin reemplazar registros previos."
              : "Permite registrar horas de entrada, almuerzo y salida para cualquier fecha y opcionalmente reemplazar un registro existente."}
          </p>

          <form className="grid-form-manual" onSubmit={manejarGuardarManual}>
            <div className="campo-asist">
              <label htmlFor="man-persona">Personal *</label>
              <select
                id="man-persona"
                className="select-asist"
                required
                value={formManual.codigo}
                onChange={(e) =>
                  setFormManual((f) => ({ ...f, codigo: e.target.value }))
                }
              >
                <option value="">Seleccione una persona…</option>
                {personal.map((p) => (
                  <option key={p.codigo} value={p.codigo}>
                    {p.codigo} ·{" "}
                    {p.nombreCompleto || `${p.nombres || ""} ${p.apellidos || ""}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="campo-asist">
              <label htmlFor="man-fecha">Fecha *</label>
              <input
                id="man-fecha"
                className="input-asist"
                type="date"
                required
                max={hoyBolivia()}
                disabled={esEncargado}
                value={esEncargado ? hoyBolivia() : formManual.fecha}
                onChange={(e) =>
                  setFormManual((f) => ({ ...f, fecha: e.target.value }))
                }
              />
            </div>

            <div className="campo-asist">
              <label htmlFor="man-entrada">Hora Entrada (HH:MM) *</label>
              <input
                id="man-entrada"
                className="input-asist"
                type="time"
                required
                value={formManual.horaEntrada}
                onChange={(e) =>
                  setFormManual((f) => ({ ...f, horaEntrada: e.target.value }))
                }
              />
            </div>

            <div className="campo-asist">
              <label htmlFor="man-salida">Hora Salida (HH:MM) *</label>
              <input
                id="man-salida"
                className="input-asist"
                type="time"
                required
                value={formManual.horaSalida}
                onChange={(e) =>
                  setFormManual((f) => ({ ...f, horaSalida: e.target.value }))
                }
              />
            </div>

            <div className="campo-asist">
              <label htmlFor="man-alm-ini">Inicio Almuerzo (Opcional)</label>
              <input
                id="man-alm-ini"
                className="input-asist"
                type="time"
                value={formManual.horaInicioAlmuerzo}
                onChange={(e) =>
                  setFormManual((f) => ({
                    ...f,
                    horaInicioAlmuerzo: e.target.value
                  }))
                }
              />
            </div>

            <div className="campo-asist">
              <label htmlFor="man-alm-fin">Fin Almuerzo (Opcional)</label>
              <input
                id="man-alm-fin"
                className="input-asist"
                type="time"
                value={formManual.horaFinAlmuerzo}
                onChange={(e) =>
                  setFormManual((f) => ({
                    ...f,
                    horaFinAlmuerzo: e.target.value
                  }))
                }
              />
            </div>

            <div className="campo-asist" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="man-obs">
                Referencia de planilla / observaciones
              </label>
              <input
                id="man-obs"
                className="input-asist"
                type="text"
                maxLength={300}
                placeholder="Opcional: referencia de planilla u observación…"
                value={formManual.observaciones}
                onChange={(e) =>
                  setFormManual((f) => ({ ...f, observaciones: e.target.value }))
                }
              />
            </div>

            <div
              className="opciones-marcacion-fila"
              style={{ gridColumn: "1 / -1" }}
            >
              <label className="check-asist">
                <input
                  type="checkbox"
                  checked={formManual.jornadaExtendida}
                  onChange={(e) =>
                    setFormManual((f) => ({
                      ...f,
                      jornadaExtendida: e.target.checked
                    }))
                  }
                />
                <span>Jornada Extendida (Medio tiempo con almuerzo)</span>
              </label>

              {!esEncargado && (
                <label className="check-asist">
                  <input
                    type="checkbox"
                    checked={formManual.reemplazarExistente}
                    onChange={(e) =>
                      setFormManual((f) => ({
                        ...f,
                        reemplazarExistente: e.target.checked
                      }))
                    }
                  />
                  <span>Reemplazar registro existente (revisado en historial)</span>
                </label>
              )}
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <button
                type="submit"
                className="btn-asist btn-asist-primario"
                disabled={guardandoManual}
              >
                {guardandoManual ? "Guardando…" : "Guardar registro manual"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabla inferior: Asistencia de hoy sincronizada con escritorio (asistencia.resumen + web.registros-dia) */}
      <div className="tarjeta-asist" style={{ marginTop: "18px" }}>
        <div className="cabecera-tabla-hoy">
          <div>
            <span className="numero">
              SINCRONIZACIÓN EN VIVO CON ESCRITORIO ({hoyBolivia()})
            </span>
            <h3 style={{ margin: "4px 0" }}>
              Asistencia de hoy ({filasHoyUnificadas.length} personas)
            </h3>
            <small className="subtexto-asist">
              Estado de conexión: <strong>{estadoConexion}</strong>
              {ultimaSincronizacion
                ? ` · Última lectura: ${ultimaSincronizacion}`
                : ""}
            </small>
          </div>

          <div className="contadores-hoy-barra">
            <span className="pastilla-estado activa">
              En jornada: {contadoresHoy.enJornada}
            </span>
            <span className="pastilla-estado almuerzo">
              Almuerzo: {contadoresHoy.enAlmuerzo}
            </span>
            <span className="pastilla-estado finalizada">
              Salidas: {contadoresHoy.finalizados}
            </span>
            <span className="pastilla-estado sin-registro">
              Sin registro: {contadoresHoy.sinRegistro}
            </span>
          </div>
        </div>

        <div className="filtros-tabla-hoy">
          <div className="campo-asist">
            <label htmlFor="asist-filtro-proy">Ver equipo de proyecto</label>
            <select
              id="asist-filtro-proy"
              className="select-asist"
              value={idProyectoFiltro}
              onChange={(e) => onCambiarProyectoFiltro?.(e.target.value)}
            >
              <option value="">Todos los proyectos</option>
              {proyectos.map((pr) => {
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

          <div className="campo-asist">
            <label htmlFor="asist-buscar-hoy">Buscar persona en la tabla</label>
            <input
              id="asist-buscar-hoy"
              className="input-asist"
              type="search"
              placeholder="Filtrar por código, nombre o estado…"
              value={busquedaTabla}
              onChange={(e) => setBusquedaTabla(e.target.value)}
            />
          </div>
        </div>

        <div className="tabla-contenedor-asist">
          <table className="tabla-asistencia">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre completo</th>
                <th>Entrada</th>
                <th>Inicio Almuerzo</th>
                <th>Fin Almuerzo</th>
                <th>Salida</th>
                <th>Tiempo trabajado</th>
                <th>Estado</th>
                <th>Acción rápida</th>
              </tr>
            </thead>
            <tbody>
              {filasHoyUnificadas.length === 0 ? (
                <tr>
                  <td colSpan={9}>No hay personal para mostrar con este filtro.</td>
                </tr>
              ) : (
                filasHoyUnificadas.map((f) => (
                  <tr
                    key={f.codigo}
                    className={
                      f.codigo === codigoSeleccionado ? "fila-seleccionada" : ""
                    }
                  >
                    <td>
                      <strong>{f.codigo}</strong>
                    </td>
                    <td>{f.nombreCompleto}</td>
                    <td>{formatearHoraVista(f.entrada)}</td>
                    <td>{formatearHoraVista(f.inicioAlmuerzo)}</td>
                    <td>{formatearHoraVista(f.finAlmuerzo)}</td>
                    <td>{formatearHoraVista(f.salida)}</td>
                    <td>
                      <strong>{f.tiempoFormateado.textoCorto}</strong> (
                      {f.minutosTrabajados} min)
                    </td>
                    <td>
                      <span
                        className={`pastilla-estado ${
                          f.salida
                            ? "finalizada"
                            : f.entrada
                            ? "activa"
                            : "sin-registro"
                        }`}
                      >
                        {f.etapaCalculada}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-asist"
                        style={{ minHeight: "32px", padding: "4px 10px" }}
                        onClick={() => {
                          setCodigoSeleccionado(f.codigo);
                          setSubVistaJornada("marcacion");
                        }}
                      >
                        Seleccionar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
