// PARTE 2 (CARLOS): Permisos, faltas, envío y revisión de correcciones con motivo,
// e integración QR con revisión del encargado.
// NOTA PARA CARLOS: Puedes editar y ampliar libremente este archivo (PanelIncidenciasQr.jsx)
// y asistencia.css usando las funciones ya conectadas en ./asistenciaApi.js.

import React, { useState } from "react";
import {
  TIPOS_INCIDENCIA,
  hoyBolivia,
  formatearHoraVista,
  generarUuidOperacion,
  registrarMarcacionAsistencia,
  enviarSolicitudCorreccionIdempotente,
  revisarSolicitudCorreccion,
  emitirCredencialQr,
  revisarSolicitudQr
} from "./asistenciaApi.js";

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

  // Sub-pestaña de Parte 2: 'incidencias' | 'correcciones' | 'qr'
  const [subPestana, setSubPestana] = useState("incidencias");
  const [ocupadoLocal, setOcupadoLocal] = useState(false);

  // 1. Estado para Permisos y Faltas administrativas (asistencia.registrar con accion 'Permiso' | 'Falta')
  const [formIncidencia, setFormIncidencia] = useState(() => ({
    codigo: "",
    accion: "Permiso",
    fecha: hoyBolivia(),
    observaciones: ""
  }));

  // 2. Estado para Solicitudes de Corrección de horas (correcciones.enviar con UUID idempotente)
  const [uuidCorreccionPendiente, setUuidCorreccionPendiente] = useState(null);
  const [formCorreccion, setFormCorreccion] = useState(() => ({
    codigo: "",
    fecha: hoyBolivia(),
    horaEntrada: "08:00",
    horaSalida: "17:00",
    horaInicioAlmuerzo: "",
    horaFinAlmuerzo: "",
    motivo: ""
  }));
  const [motivosRevisionCorr, setMotivosRevisionCorr] = useState({});

  // 3. Estado para Integración QR y revisión de solicitudes QR (qr.emitir, qr.solicitudes, qr.revisar)
  const [credencialEmitida, setCredencialEmitida] = useState(null);
  const [motivosRevisionQr, setMotivosRevisionQr] = useState({});

  // Registrar Permiso o Falta con motivo
  async function manejarRegistrarIncidencia(e) {
    e.preventDefault();
    if (!formIncidencia.codigo) {
      onNotificarError?.("Seleccione una persona para registrar el permiso o falta.");
      return;
    }
    if (!formIncidencia.observaciones.trim() || formIncidencia.observaciones.trim().length < 4) {
      onNotificarError?.("Ingrese el motivo u observación del permiso o falta.");
      return;
    }

    setOcupadoLocal(true);
    onNotificarError?.("");
    onNotificarAviso?.("");
    try {
      const resp = await registrarMarcacionAsistencia(
        {
          codigo: formIncidencia.codigo,
          accion: formIncidencia.accion,
          fecha: formIncidencia.fecha,
          observaciones: formIncidencia.observaciones.trim()
        },
        token
      );
      onNotificarAviso?.(
        typeof resp === "string"
          ? resp
          : resp?.mensaje || `${formIncidencia.accion} registrado correctamente.`
      );
      setFormIncidencia((f) => ({ ...f, observaciones: "" }));
      await onRecargarDatos?.();
    } catch (err) {
      onNotificarError?.(err.message || "No se pudo registrar la incidencia.");
    } finally {
      setOcupadoLocal(false);
    }
  }

  // Enviar solicitud de corrección con motivo y UUID idempotente
  async function manejarEnviarCorreccion(e) {
    e.preventDefault();
    if (!formCorreccion.codigo) {
      onNotificarError?.("Seleccione una persona para solicitar la corrección.");
      return;
    }
    if (!formCorreccion.motivo.trim() || formCorreccion.motivo.trim().length < 5) {
      onNotificarError?.(
        "El motivo de la corrección es obligatorio (mínimo 5 caracteres)."
      );
      return;
    }

    setOcupadoLocal(true);
    onNotificarError?.("");
    onNotificarAviso?.("");
    const idActual = uuidCorreccionPendiente || generarUuidOperacion();
    setUuidCorreccionPendiente(idActual);

    try {
      await enviarSolicitudCorreccionIdempotente(
        {
          id: idActual,
          registro: formCorreccion,
          motivo: formCorreccion.motivo.trim()
        },
        usuario?.rol,
        token
      );
      setUuidCorreccionPendiente(null);
      setFormCorreccion((f) => ({ ...f, motivo: "" }));
      onNotificarAviso?.(
        "Solicitud de corrección enviada. Las horas no se alteran hasta que Admin/SuperAdmin apruebe."
      );
      await onRecargarDatos?.();
    } catch (err) {
      onNotificarError?.(
        err.message || "No se pudo enviar la solicitud de corrección."
      );
    } finally {
      setOcupadoLocal(false);
    }
  }

  // Aprobar o rechazar solicitud de corrección (Admin / SuperAdmin)
  async function manejarRevisarCorreccion(idSolicitud, aprobar) {
    const comentario = (motivosRevisionCorr[idSolicitud] || "").trim();
    if (!aprobar && !comentario) {
      onNotificarError?.(
        "Para rechazar una solicitud de corrección es obligatorio indicar el motivo."
      );
      return;
    }

    setOcupadoLocal(true);
    onNotificarError?.("");
    onNotificarAviso?.("");
    try {
      await revisarSolicitudCorreccion(
        { id: idSolicitud, aprobar, motivo: comentario },
        token
      );
      onNotificarAviso?.(
        aprobar
          ? "Corrección aprobada y aplicada en la asistencia."
          : "Solicitud de corrección rechazada con motivo."
      );
      await onRecargarDatos?.();
    } catch (err) {
      onNotificarError?.(err.message || "No se pudo revisar la corrección.");
    } finally {
      setOcupadoLocal(false);
    }
  }

  // Emitir credencial QR oficial de oficina
  async function manejarEmitirQr() {
    setOcupadoLocal(true);
    onNotificarError?.("");
    onNotificarAviso?.("");
    try {
      const emitida = await emitirCredencialQr(token);
      setCredencialEmitida(emitida);
      onNotificarAviso?.("Credencial QR emitida/actualizada desde el servidor C#.");
      await onRecargarDatos?.();
    } catch (err) {
      onNotificarError?.(err.message || "No se pudo emitir la credencial QR.");
    } finally {
      setOcupadoLocal(false);
    }
  }

  // Aprobar o rechazar solicitud QR
  async function manejarRevisarQr(idQr, aprobar) {
    const comentario = (motivosRevisionQr[idQr] || "").trim();
    if (!aprobar && !comentario) {
      onNotificarError?.("Indique el motivo para rechazar la solicitud QR.");
      return;
    }

    setOcupadoLocal(true);
    onNotificarError?.("");
    onNotificarAviso?.("");
    try {
      await revisarSolicitudQr({ id: idQr, aprobar, motivo: comentario }, token);
      onNotificarAviso?.(
        aprobar ? "Solicitud QR aprobada." : "Solicitud QR rechazada."
      );
      await onRecargarDatos?.();
    } catch (err) {
      onNotificarError?.(err.message || "No se pudo revisar la solicitud QR.");
    } finally {
      setOcupadoLocal(false);
    }
  }

  return (
    <div className="panel-incidencias-carlos">
      <div className="subpestanas-asistencia">
        <button
          type="button"
          className={`btn-asist ${
            subPestana === "incidencias" ? "btn-asist-activo" : ""
          }`}
          onClick={() => setSubPestana("incidencias")}
        >
          Permisos y Faltas con Motivo
        </button>
        <button
          type="button"
          className={`btn-asist ${
            subPestana === "correcciones" ? "btn-asist-activo" : ""
          }`}
          onClick={() => setSubPestana("correcciones")}
        >
          Correcciones de Horas ({correcciones.length})
        </button>
        <button
          type="button"
          className={`btn-asist ${subPestana === "qr" ? "btn-asist-activo" : ""}`}
          onClick={() => setSubPestana("qr")}
        >
          Integración QR y Revisión ({pendientesQr} pendientes)
        </button>
      </div>

      {/* 1. PERMISOS Y FALTAS */}
      {subPestana === "incidencias" && (
        <div className="tarjeta-asist">
          <span className="numero">
            PERMISOS Y FALTAS ADMINISTRATIVAS (ASISTENCIA.REGISTRAR)
          </span>
          <h3 style={{ marginTop: "6px", marginBottom: "8px" }}>
            Registrar Permiso o Falta con motivo
          </h3>
          <form
            className="grid-form-manual"
            onSubmit={manejarRegistrarIncidencia}
          >
            <div className="campo-asist">
              <label htmlFor="inc-persona">Personal *</label>
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
                    {p.nombreCompleto || `${p.nombres || ""} ${p.apellidos || ""}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="campo-asist">
              <label htmlFor="inc-tipo">Tipo de incidencia *</label>
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
              <label htmlFor="inc-fecha">Fecha *</label>
              <input
                id="inc-fecha"
                className="input-asist"
                type="date"
                required
                value={formIncidencia.fecha}
                onChange={(e) =>
                  setFormIncidencia((f) => ({ ...f, fecha: e.target.value }))
                }
              />
            </div>

            <div className="campo-asist" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="inc-motivo">Motivo / Justificación *</label>
              <input
                id="inc-motivo"
                className="input-asist"
                type="text"
                required
                minLength={4}
                maxLength={300}
                placeholder="Explique el motivo del permiso o falta…"
                value={formIncidencia.observaciones}
                onChange={(e) =>
                  setFormIncidencia((f) => ({
                    ...f,
                    observaciones: e.target.value
                  }))
                }
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <button
                type="submit"
                className="btn-asist btn-asist-primario"
                disabled={ocupadoLocal}
              >
                {ocupadoLocal
                  ? "Registrando…"
                  : `Guardar ${formIncidencia.accion}`}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. CORRECCIONES CON MOTIVO */}
      {subPestana === "correcciones" && (
        <div className="grid-jornada-vivo">
          <div className="tarjeta-asist">
            <span className="numero">
              SOLICITAR CORRECCIÓN DE HORAS (CORRECCIONES.ENVIAR)
            </span>
            <h3 style={{ marginTop: "6px", marginBottom: "8px" }}>
              Nueva solicitud con UUID idempotente
            </h3>
            <form
              className="grid-form-manual"
              onSubmit={manejarEnviarCorreccion}
            >
              <div className="campo-asist">
                <label htmlFor="corr-persona">Personal *</label>
                <select
                  id="corr-persona"
                  className="select-asist"
                  required
                  value={formCorreccion.codigo}
                  onChange={(e) => {
                    setFormCorreccion((f) => ({ ...f, codigo: e.target.value }));
                    setUuidCorreccionPendiente(null);
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
                <label htmlFor="corr-fecha">Fecha a corregir *</label>
                <input
                  id="corr-fecha"
                  className="input-asist"
                  type="date"
                  required
                  max={hoyBolivia()}
                  value={formCorreccion.fecha}
                  onChange={(e) => {
                    setFormCorreccion((f) => ({ ...f, fecha: e.target.value }));
                    setUuidCorreccionPendiente(null);
                  }}
                />
              </div>

              <div className="campo-asist">
                <label htmlFor="corr-ent">Entrada propuesta *</label>
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
                <label htmlFor="corr-sal">Salida propuesta *</label>
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
                  Motivo de la corrección (mín. 5 caracteres) *
                </label>
                <input
                  id="corr-motivo"
                  className="input-asist"
                  type="text"
                  required
                  minLength={5}
                  maxLength={1000}
                  placeholder="Explique por qué se solicita corregir este horario…"
                  value={formCorreccion.motivo}
                  onChange={(e) =>
                    setFormCorreccion((f) => ({ ...f, motivo: e.target.value }))
                  }
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <button
                  type="submit"
                  className="btn-asist btn-asist-primario"
                  disabled={ocupadoLocal}
                >
                  {ocupadoLocal ? "Enviando…" : "Enviar solicitud de corrección"}
                </button>
              </div>
            </form>
          </div>

          <div className="tarjeta-asist">
            <span className="numero">
              BANDEJA DE CORRECCIONES (CORRECCIONES.LISTAR · CORRECCIONES.REVISAR)
            </span>
            <h3 style={{ marginTop: "6px", marginBottom: "8px" }}>
              {esEncargado
                ? "Mis solicitudes enviadas"
                : "Revisión de correcciones pendientes"}
            </h3>

            {correcciones.length === 0 ? (
              <p className="subtexto-asist">
                No hay solicitudes de corrección registradas.
              </p>
            ) : (
              <div className="lista-tarjetas-revision">
                {correcciones.map((c) => {
                  let reg = {};
                  try {
                    reg = c.registroJson ? JSON.parse(c.registroJson) : c.registro || {};
                  } catch {
                    reg = {};
                  }
                  return (
                    <article key={c.id} className="item-revision-asist">
                      <div className="item-revision-top">
                        <strong>
                          {c.codigo} · {String(c.fecha || "").slice(0, 10)}
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
                          {c.estado}
                        </span>
                      </div>
                      <p style={{ margin: "4px 0", fontSize: "13px" }}>
                        Entrada: <strong>{formatearHoraVista(reg.horaEntrada)}</strong>{" "}
                        · Salida: <strong>{formatearHoraVista(reg.horaSalida)}</strong>
                      </p>
                      <p style={{ margin: "4px 0", fontSize: "13px" }}>
                        Motivo: {c.motivo}
                      </p>
                      <small className="subtexto-asist">
                        Solicitó: {c.solicitante || "Encargado"}
                        {c.revisor
                          ? ` · Revisó ${c.revisor}${
                              c.respuesta ? `: ${c.respuesta}` : ""
                            }`
                          : ""}
                      </small>

                      {!esEncargado && c.estado === "Pendiente" && (
                        <div className="acciones-revision-inline">
                          <input
                            className="input-asist"
                            type="text"
                            placeholder="Comentario / motivo de rechazo…"
                            value={motivosRevisionCorr[c.id] || ""}
                            onChange={(e) =>
                              setMotivosRevisionCorr((m) => ({
                                ...m,
                                [c.id]: e.target.value
                              }))
                            }
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
                            className="btn-asist"
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

      {/* 3. INTEGRACIÓN QR CON REVISIÓN */}
      {subPestana === "qr" && (
        <div className="grid-jornada-vivo">
          <div className="tarjeta-asist">
            <span className="numero">
              CREDENCIAL QR OFICIAL (QR.EXISTE · QR.EMITIR · QR.PENDIENTES)
            </span>
            <h3 style={{ marginTop: "6px", marginBottom: "8px" }}>
              Estado de QR de Oficina
            </h3>
            <p className="subtexto-asist">
              Credencial QR activa:{" "}
              <strong>{qrExiste ? "Sí (Vigente)" : "No emitida aún"}</strong> ·
              Solicitudes pendientes de revisión:{" "}
              <strong>{pendientesQr}</strong>
            </p>

            {!esEncargado && (
              <button
                type="button"
                className="btn-asist btn-asist-primario"
                disabled={ocupadoLocal}
                onClick={manejarEmitirQr}
              >
                {ocupadoLocal
                  ? "Emitiendo…"
                  : qrExiste
                  ? "Renovar / Emitir Credencial QR"
                  : "Emitir Credencial QR"}
              </button>
            )}

            {credencialEmitida && (
              <div className="caja-reintento-uuid" style={{ marginTop: "12px" }}>
                <strong>Credencial QR emitida:</strong>
                <pre
                  style={{
                    margin: "6px 0 0",
                    fontSize: "12px",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all"
                  }}
                >
                  {JSON.stringify(credencialEmitida, null, 2)}
                </pre>
              </div>
            )}
          </div>

          <div className="tarjeta-asist">
            <span className="numero">
              SOLICITUDES QR DEL ENCARGADO / OFICINA (QR.SOLICITUDES · QR.REVISAR)
            </span>
            <h3 style={{ marginTop: "6px", marginBottom: "8px" }}>
              Solicitudes QR ({solicitudesQr.length})
            </h3>

            {solicitudesQr.length === 0 ? (
              <p className="subtexto-asist">
                No hay solicitudes QR pendientes en este momento.
              </p>
            ) : (
              <div className="lista-tarjetas-revision">
                {solicitudesQr.map((sq) => {
                  const idSq = sq.id || sq.idSolicitud;
                  return (
                    <article key={idSq} className="item-revision-asist">
                      <div className="item-revision-top">
                        <strong>
                          {sq.codigo || sq.nombreCompleto || "Solicitud QR"} ·{" "}
                          {sq.accion || "Marcación"}
                        </strong>
                        <span className="pastilla-estado almuerzo">
                          {sq.estado || "Pendiente"}
                        </span>
                      </div>
                      <small className="subtexto-asist">
                        Fecha/Hora:{" "}
                        {String(sq.fechaSolicitud || sq.creada || "").slice(0, 19)}
                      </small>

                      {!esEncargado &&
                        (!sq.estado || sq.estado === "Pendiente") && (
                          <div className="acciones-revision-inline">
                            <input
                              className="input-asist"
                              type="text"
                              placeholder="Observación / motivo…"
                              value={motivosRevisionQr[idSq] || ""}
                              onChange={(e) =>
                                setMotivosRevisionQr((m) => ({
                                  ...m,
                                  [idSq]: e.target.value
                                }))
                              }
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
                              className="btn-asist"
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
