import React, { useEffect, useMemo, useState } from "react";
import ModuloBase from "../../components/ModuloBase.jsx";
import {
  obtenerPersonal,
  registrarNuevaPersona,
  editarFichaPersona,
  cambiarEstadoFichaPersona,
  actualizarProgresoPasantia
} from "./personalApi.js";
import "./personal.css";

const TURNOS_OPCIONES = [
  {
    id: "manana",
    nombre: "Turno mañana (08:00 a 12:30 · 4.5 h/día)",
    horario: "08:00 - 12:30",
    horasPorDia: 4.5
  },
  {
    id: "tarde",
    nombre: "Turno tarde (14:00 a 18:30 · 4.5 h/día)",
    horario: "14:00 - 18:30",
    horasPorDia: 4.5
  },
  {
    id: "completo",
    nombre: "Jornada completa (08:00 a 12:30 y 14:00 a 17:30 · 8 h/día)",
    horario: "08:00 - 12:30 / 14:00 - 17:30",
    horasPorDia: 8
  },
  {
    id: "pasantia_6h",
    nombre: "Turno pasantía continua (08:00 a 14:00 · 6 h/día)",
    horario: "08:00 - 14:00",
    horasPorDia: 6
  }
];

function obtenerNombreTurno(turnoId) {
  const encontrado = TURNOS_OPCIONES.find((t) => t.id === turnoId);
  return encontrado ? encontrado.nombre : "Jornada completa (8 h/día)";
}

function fechaHoyISO() {
  const hoy = new Date();
  const yyyy = hoy.getFullYear();
  const mm = String(hoy.getMonth() + 1).padStart(2, "0");
  const dd = String(hoy.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function precalcularFinPasantia({
  fechaInicio,
  horasMeta = 600,
  horasCumplidas = 0,
  horasPorDia = 4.5,
  diasFeriados = 0,
  diasIncidencias = 0
}) {
  const baseStr =
    typeof fechaInicio === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fechaInicio)
      ? fechaInicio
      : fechaHoyISO();
  const [anio, mes, dia] = baseStr.split("-").map(Number);
  const cursor = new Date(Date.UTC(anio, mes - 1, dia));

  const meta = Math.max(1, Number(horasMeta) || 600);
  const cumplidas = Math.max(0, Number(horasCumplidas) || 0);
  const hDia = Math.max(0.5, Number(horasPorDia) || 4.5);
  const feriados = Math.max(0, Math.trunc(Number(diasFeriados) || 0));
  const incidencias = Math.max(0, Math.trunc(Number(diasIncidencias) || 0));

  const diasRequeridos = Math.ceil(meta / hDia);
  const totalDiasASumar = Math.max(0, diasRequeridos - 1 + feriados + incidencias);

  while (cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  let restantes = totalDiasASumar;
  while (restantes > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const d = cursor.getUTCDay();
    if (d !== 0 && d !== 6) restantes -= 1;
  }

  const yyyy = cursor.getUTCFullYear();
  const mm = String(cursor.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(cursor.getUTCDate()).padStart(2, "0");

  const horasPendientes = Math.max(0, Math.round((meta - cumplidas) * 10) / 10);
  const porcentaje = Math.min(100, Math.round((cumplidas / meta) * 1000) / 10);

  return {
    horasPendientes,
    porcentaje,
    jornadasRestantes: Math.ceil(horasPendientes / hDia),
    fechaFinEstimada: `${yyyy}-${mm}-${dd}`
  };
}

function crearEstadoFormularioInicial() {
  return {
    id: null,
    nombres: "",
    apellidos: "",
    tipo: "pasante",
    turno: "manana",
    horasMeta: 600,
    horasCumplidas: 0,
    horasPorDia: 4.5,
    fechaInicio: fechaHoyISO(),
    diasFeriados: 0,
    diasIncidencias: 0,
    detalleIncidencias: ""
  };
}

export default function Modulo({ modulo }) {
  const [personas, setPersonas] = useState([]);
  const [resumen, setResumen] = useState({
    total: 0,
    activos: 0,
    bajas: 0,
    planta: 0,
    pasantes: 0
  });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState("");
  const [mensajeError, setMensajeError] = useState("");

  // Filtros de búsqueda
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");

  // Estado del formulario (Alta / Edición)
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [form, setForm] = useState(crearEstadoFormularioInicial);
  const [erroresForm, setErroresForm] = useState({});

  // Acciones en tarjetas (historial, baja, progreso de pasante)
  const [historialAbiertoId, setHistorialAbiertoId] = useState(null);
  const [bajaActivaId, setBajaActivaId] = useState(null);
  const [motivoBajaInput, setMotivoBajaInput] = useState("");
  const [errorMotivoBaja, setErrorMotivoBaja] = useState("");

  const [progresoActivoId, setProgresoActivoId] = useState(null);
  const [formProgreso, setFormProgreso] = useState({
    horasSumar: 4.5,
    diasFeriados: 0,
    diasIncidencias: 0,
    motivo: ""
  });

  // Mostrar/ocultar alcance técnico base (ModuloBase)
  const [verAlcanceBase, setVerAlcanceBase] = useState(false);

  async function cargarDatos(filtrosActuales = {}) {
    setCargando(true);
    setMensajeError("");
    try {
      const respuesta = await obtenerPersonal({
        q: filtrosActuales.q !== undefined ? filtrosActuales.q : busqueda,
        tipo: filtrosActuales.tipo !== undefined ? filtrosActuales.tipo : filtroTipo,
        estado:
          filtrosActuales.estado !== undefined ? filtrosActuales.estado : filtroEstado
      });
      setPersonas(respuesta.items || []);
      if (respuesta.resumen) {
        setResumen(respuesta.resumen);
      }
    } catch (err) {
      setMensajeError(
        err.message || "Error al conectar con /api/personal. Verifique el servidor."
      );
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarDatos({ q: busqueda, tipo: filtroTipo, estado: filtroEstado });
  }, [busqueda, filtroTipo, filtroEstado]);

  const vistaPreviaPasantia = useMemo(() => {
    if (form.tipo !== "pasante") return null;
    return precalcularFinPasantia({
      fechaInicio: form.fechaInicio,
      horasMeta: form.horasMeta,
      horasCumplidas: form.horasCumplidas,
      horasPorDia: form.horasPorDia,
      diasFeriados: form.diasFeriados,
      diasIncidencias: form.diasIncidencias
    });
  }, [
    form.tipo,
    form.fechaInicio,
    form.horasMeta,
    form.horasCumplidas,
    form.horasPorDia,
    form.diasFeriados,
    form.diasIncidencias
  ]);

  function abrirAltaNueva() {
    setForm(crearEstadoFormularioInicial());
    setErroresForm({});
    setMensajeExito("");
    setMensajeError("");
    setMostrarFormulario(true);
  }

  function abrirEdicion(persona) {
    setErroresForm({});
    setMensajeExito("");
    setMensajeError("");
    setForm({
      id: persona.id,
      nombres: persona.nombres || "",
      apellidos: persona.apellidos || "",
      tipo: persona.tipo || "planta",
      turno:
        persona.turno ||
        (persona.tipo === "pasante" ? "manana" : "completo"),
      horasMeta: persona.pasantia?.horasMeta ?? 600,
      horasCumplidas: persona.pasantia?.horasCumplidas ?? 0,
      horasPorDia: persona.pasantia?.horasPorDia ?? 4.5,
      fechaInicio: persona.pasantia?.fechaInicio || persona.fechaAlta || fechaHoyISO(),
      diasFeriados: persona.pasantia?.diasFeriados ?? 0,
      diasIncidencias: persona.pasantia?.diasIncidencias ?? 0,
      detalleIncidencias: persona.pasantia?.detalleIncidencias ?? ""
    });
    setMostrarFormulario(true);
  }

  function manejarCambioTipo(nuevoTipo) {
    const turnoSugerido = nuevoTipo === "pasante" ? "manana" : "completo";
    const infoTurno = TURNOS_OPCIONES.find((t) => t.id === turnoSugerido);
    setForm((prev) => ({
      ...prev,
      tipo: nuevoTipo,
      turno: turnoSugerido,
      horasMeta: nuevoTipo === "pasante" ? 600 : 0,
      horasPorDia: infoTurno ? infoTurno.horasPorDia : 4.5
    }));
  }

  function manejarCambioTurno(nuevoTurno) {
    const infoTurno = TURNOS_OPCIONES.find((t) => t.id === nuevoTurno);
    setForm((prev) => ({
      ...prev,
      turno: nuevoTurno,
      horasPorDia: infoTurno ? infoTurno.horasPorDia : prev.horasPorDia
    }));
  }

  function validarFormularioLocal() {
    const nuevosErrores = {};
    if (!form.nombres.trim() || form.nombres.trim().length < 2) {
      nuevosErrores.nombres = "Ingrese los nombres (mínimo 2 caracteres).";
    }
    if (!form.apellidos.trim() || form.apellidos.trim().length < 2) {
      nuevosErrores.apellidos = "Ingrese los apellidos (mínimo 2 caracteres).";
    }
    if (form.tipo !== "planta" && form.tipo !== "pasante") {
      nuevosErrores.tipo = "Seleccione Personal de planta o Pasante.";
    }
    if (form.tipo === "pasante") {
      if (Number(form.horasCumplidas) < 0) {
        nuevosErrores.horasCumplidas = "Las horas cumplidas no pueden ser negativas.";
      }
      if (Number(form.horasPorDia) < 0.5 || Number(form.horasPorDia) > 12) {
        nuevosErrores.horasPorDia = "Ingrese entre 0.5 y 12 horas por jornada.";
      }
    }
    setErroresForm(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function guardarPersona(e) {
    e.preventDefault();
    setMensajeExito("");
    setMensajeError("");

    if (!validarFormularioLocal()) return;

    setGuardando(true);
    try {
      const payload = {
        nombres: form.nombres.trim(),
        apellidos: form.apellidos.trim(),
        tipo: form.tipo,
        turno: form.turno
      };

      if (form.tipo === "pasante") {
        payload.horasMeta = Number(form.horasMeta) || 600;
        payload.horasCumplidas = Number(form.horasCumplidas) || 0;
        payload.horasPorDia = Number(form.horasPorDia) || 4.5;
        payload.fechaInicio = form.fechaInicio;
        payload.diasFeriados = Number(form.diasFeriados) || 0;
        payload.diasIncidencias = Number(form.diasIncidencias) || 0;
        payload.detalleIncidencias = form.detalleIncidencias.trim();
      }

      if (form.id) {
        const res = await editarFichaPersona(form.id, payload);
        setMensajeExito(
          `Ficha actualizada: ${res.persona.nombreCompleto} (${res.persona.codigo}).`
        );
      } else {
        const res = await registrarNuevaPersona(payload);
        setMensajeExito(
          `Alta registrada con código automático ${res.persona.codigo}: ${res.persona.nombreCompleto}.`
        );
      }

      setMostrarFormulario(false);
      setForm(crearEstadoFormularioInicial());
      await cargarDatos();
    } catch (err) {
      if (err.errores) {
        setErroresForm(err.errores);
      }
      setMensajeError(err.message || "No se pudo guardar el registro.");
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarBajaPersona(persona) {
    if (!motivoBajaInput.trim()) {
      setErrorMotivoBaja("Debe indicar el motivo de la baja para el historial.");
      return;
    }
    setGuardando(true);
    setErrorMotivoBaja("");
    try {
      await cambiarEstadoFichaPersona(persona.id, {
        estado: "baja",
        motivo: motivoBajaInput.trim()
      });
      setBajaActivaId(null);
      setMotivoBajaInput("");
      setMensajeExito(
        `Baja registrada para ${persona.nombreCompleto} (${persona.codigo}) conservando su historial.`
      );
      await cargarDatos();
    } catch (err) {
      setMensajeError(err.message || "No se pudo procesar la baja.");
    } finally {
      setGuardando(false);
    }
  }

  async function reactivarPersona(persona) {
    setGuardando(true);
    setMensajeError("");
    try {
      await cambiarEstadoFichaPersona(persona.id, {
        estado: "activo",
        motivo: "Reactivación desde ficha de personal"
      });
      setMensajeExito(
        `Se recuperó y reactivó la ficha de ${persona.nombreCompleto} (${persona.codigo}).`
      );
      await cargarDatos();
    } catch (err) {
      setMensajeError(err.message || "No se pudo reactivar el registro.");
    } finally {
      setGuardando(false);
    }
  }

  function abrirCajaProgreso(persona) {
    setProgresoActivoId(persona.id);
    setFormProgreso({
      horasSumar: persona.pasantia?.horasPorDia || 4.5,
      diasFeriados: persona.pasantia?.diasFeriados || 0,
      diasIncidencias: persona.pasantia?.diasIncidencias || 0,
      motivo: ""
    });
  }

  async function guardarProgresoPasante(persona) {
    setGuardando(true);
    setMensajeError("");
    try {
      await actualizarProgresoPasantia(persona.id, {
        horasSumar: Number(formProgreso.horasSumar) || 0,
        diasFeriados: Number(formProgreso.diasFeriados) || 0,
        diasIncidencias: Number(formProgreso.diasIncidencias) || 0,
        motivo:
          formProgreso.motivo.trim() || "Registro de avance / ajuste de pasantía"
      });
      setProgresoActivoId(null);
      setMensajeExito(
        `Progreso de pasantía actualizado para ${persona.nombreCompleto}.`
      );
      await cargarDatos();
    } catch (err) {
      setMensajeError(err.message || "No se pudo actualizar el progreso.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mod-personal">
      {/* Cabecera principal usando exactamente la clase nativa .detalle-modulo de src/styles.css */}
      <section className="detalle-modulo">
        <div className="mod-personal-cabecera-top">
          <div>
            <span className="numero">MÓDULO {modulo?.numero || "02"}</span>
            <h2>{modulo?.nombre || "Personal y pasantías"}</h2>
            <p>
              {modulo?.descripcion ||
                "Registro sencillo, ficha de personal y seguimiento exclusivo de pasantes."}
            </p>
            <div className="etiquetas">
              <span>Alta mínima: nombres, apellidos y tipo</span>
              <span>Planta: sin meta de horas</span>
              <span>Pasantes: 600 h por defecto</span>
              <span>Turno mañana: 08:00 a 12:30 (4.5 h)</span>
            </div>
          </div>

          <div className="mod-personal-acciones-top">
            <button
              type="button"
              className="btn-personal btn-personal-primario"
              onClick={abrirAltaNueva}
            >
              + Registrar persona
            </button>
            <button
              type="button"
              className="btn-personal"
              onClick={() => setVerAlcanceBase((v) => !v)}
            >
              {verAlcanceBase ? "Ocultar alcance base" : "Ver alcance y criterios"}
            </button>
          </div>
        </div>

        <div className="mod-personal-indicadores" aria-label="Indicadores del módulo">
          <div className="caja-indicador destacada">
            <span className="numero">PERSONAL ACTIVO</span>
            <strong className="valor-grande">{resumen.activos}</strong>
            <span className="subtexto">De {resumen.total} fichas registradas</span>
          </div>
          <div className="caja-indicador">
            <span className="numero">PERSONAL DE PLANTA</span>
            <strong className="valor-grande">{resumen.planta}</strong>
            <span className="subtexto">Sin meta de horas ni fin de pasantía</span>
          </div>
          <div className="caja-indicador">
            <span className="numero">PASANTES</span>
            <strong className="valor-grande">{resumen.pasantes}</strong>
            <span className="subtexto">Meta reglamentaria: 600 horas</span>
          </div>
          <div className="caja-indicador">
            <span className="numero">BAJAS CONSERVADAS</span>
            <strong className="valor-grande">{resumen.bajas}</strong>
            <span className="subtexto">Con historial auditable y recuperación</span>
          </div>
        </div>

        <p className="ruta" style={{ marginTop: "20px", marginBottom: 0 }}>
          Código del módulo: src/modules/personal/ · API conectada: /api/personal
        </p>
      </section>

      {verAlcanceBase && modulo && <ModuloBase modulo={modulo} />}

      {mensajeExito && (
        <div className="aviso-personal" role="status">
          <span>
            <strong>Confirmación:</strong> {mensajeExito}
          </span>
          <button
            type="button"
            className="btn-personal"
            onClick={() => setMensajeExito("")}
          >
            Cerrar
          </button>
        </div>
      )}

      {mensajeError && (
        <div className="aviso-personal aviso-alerta" role="alert">
          <span>
            <strong>Atención:</strong> {mensajeError}
          </span>
          <button
            type="button"
            className="btn-personal"
            onClick={() => setMensajeError("")}
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Formulario de Alta / Edición dentro de contenedor .detalle-modulo */}
      {mostrarFormulario && (
        <section
          className="detalle-modulo"
          aria-label={form.id ? "Editar ficha de personal" : "Alta de personal"}
        >
          <span className="numero">
            {form.id ? "EDICIÓN DE FICHA" : "ALTA MÍNIMA DE PERSONAL"}
          </span>
          <h3 style={{ marginTop: "10px", marginBottom: "8px", fontSize: "24px" }}>
            {form.id
              ? "Editar datos de personal"
              : "Registrar persona (Nombres, Apellidos y Tipo)"}
          </h3>
          <p style={{ marginTop: 0 }}>
            {form.id
              ? "Los cambios respetan el historial previo y los datos sincronizados del escritorio."
              : "El código identificador (PER-XXX) se genera automáticamente."}
          </p>

          <form className="form-grid-personal" onSubmit={guardarPersona} noValidate>
            <div className="campo-grupo">
              <label htmlFor="campo-nombres">Nombres *</label>
              <input
                id="campo-nombres"
                className="input-personal"
                type="text"
                placeholder="Ej. María Elena"
                value={form.nombres}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, nombres: e.target.value }))
                }
                required
              />
              {erroresForm.nombres && (
                <span className="error-campo">{erroresForm.nombres}</span>
              )}
            </div>

            <div className="campo-grupo">
              <label htmlFor="campo-apellidos">Apellidos *</label>
              <input
                id="campo-apellidos"
                className="input-personal"
                type="text"
                placeholder="Ej. Gutiérrez Flores"
                value={form.apellidos}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, apellidos: e.target.value }))
                }
                required
              />
              {erroresForm.apellidos && (
                <span className="error-campo">{erroresForm.apellidos}</span>
              )}
            </div>

            <div className="campo-grupo">
              <label htmlFor="campo-tipo">Tipo de personal *</label>
              <select
                id="campo-tipo"
                className="select-personal"
                value={form.tipo}
                onChange={(e) => manejarCambioTipo(e.target.value)}
              >
                <option value="pasante">Pasante (meta 600 horas por defecto)</option>
                <option value="planta">
                  Personal de planta (sin meta ni fin de pasantía)
                </option>
              </select>
              {erroresForm.tipo && (
                <span className="error-campo">{erroresForm.tipo}</span>
              )}
            </div>

            <div className="campo-grupo">
              <label htmlFor="campo-turno">Turno / Horario asignado</label>
              <select
                id="campo-turno"
                className="select-personal"
                value={form.turno}
                onChange={(e) => manejarCambioTurno(e.target.value)}
              >
                {TURNOS_OPCIONES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>

            {form.tipo === "planta" ? (
              <div className="aceptacion col-completa" style={{ marginTop: "4px" }}>
                <strong>Personal de planta</strong>
                <p>
                  De acuerdo con las reglas del sistema, el personal de planta no
                  muestra ni guarda meta de horas ni fecha de finalización de
                  pasantía.
                </p>
              </div>
            ) : (
              <div className="bloque-pasantia-nativo">
                <span className="numero">SEGUIMIENTO EXCLUSIVO DE PASANTES</span>
                <h4>Configuración de pasantía (600 horas por defecto)</h4>

                <div className="form-grid-personal" style={{ marginTop: 0 }}>
                  <div className="campo-grupo">
                    <label htmlFor="campo-horas-meta">Meta de horas</label>
                    <input
                      id="campo-horas-meta"
                      className="input-personal"
                      type="number"
                      min="1"
                      value={form.horasMeta}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, horasMeta: e.target.value }))
                      }
                    />
                    <span className="ayuda-campo">
                      Por defecto: 600 horas para pasantes.
                    </span>
                  </div>

                  <div className="campo-grupo">
                    <label htmlFor="campo-horas-cumplidas">
                      Horas cumplidas actuales
                    </label>
                    <input
                      id="campo-horas-cumplidas"
                      className="input-personal"
                      type="number"
                      min="0"
                      step="0.5"
                      value={form.horasCumplidas}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          horasCumplidas: e.target.value
                        }))
                      }
                    />
                    {erroresForm.horasCumplidas && (
                      <span className="error-campo">
                        {erroresForm.horasCumplidas}
                      </span>
                    )}
                  </div>

                  <div className="campo-grupo">
                    <label htmlFor="campo-fecha-inicio">Fecha de inicio</label>
                    <input
                      id="campo-fecha-inicio"
                      className="input-personal"
                      type="date"
                      value={form.fechaInicio}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          fechaInicio: e.target.value
                        }))
                      }
                    />
                  </div>

                  <div className="campo-grupo">
                    <label htmlFor="campo-horas-dia">
                      Horas por jornada diaria (ej. 4.5 h en turno 08:00 a 12:30)
                    </label>
                    <input
                      id="campo-horas-dia"
                      className="input-personal"
                      type="number"
                      min="0.5"
                      max="12"
                      step="0.5"
                      value={form.horasPorDia}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          horasPorDia: e.target.value
                        }))
                      }
                    />
                    {erroresForm.horasPorDia && (
                      <span className="error-campo">{erroresForm.horasPorDia}</span>
                    )}
                  </div>

                  <div className="campo-grupo">
                    <label htmlFor="campo-feriados">
                      Días feriados en el período
                    </label>
                    <input
                      id="campo-feriados"
                      className="input-personal"
                      type="number"
                      min="0"
                      value={form.diasFeriados}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          diasFeriados: e.target.value
                        }))
                      }
                    />
                  </div>

                  <div className="campo-grupo">
                    <label htmlFor="campo-incidencias">
                      Días de incidencias / permisos
                    </label>
                    <input
                      id="campo-incidencias"
                      className="input-personal"
                      type="number"
                      min="0"
                      value={form.diasIncidencias}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          diasIncidencias: e.target.value
                        }))
                      }
                    />
                  </div>

                  <div className="campo-grupo col-completa">
                    <label htmlFor="campo-detalle-incidencias">
                      Observación de feriados / incidencias (opcional)
                    </label>
                    <input
                      id="campo-detalle-incidencias"
                      className="input-personal"
                      type="text"
                      placeholder="Ej. Permiso académico justificado"
                      value={form.detalleIncidencias}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          detalleIncidencias: e.target.value
                        }))
                      }
                    />
                  </div>
                </div>

                {vistaPreviaPasantia && (
                  <div className="aceptacion" style={{ marginTop: "4px" }}>
                    <strong>Cálculo estimado de fin de pasantía</strong>
                    <p>
                      Horas pendientes:{" "}
                      <strong>{vistaPreviaPasantia.horasPendientes} h</strong> (
                      {vistaPreviaPasantia.porcentaje}% completado ·{" "}
                      {vistaPreviaPasantia.jornadasRestantes} jornadas restantes) ·
                      Fecha estimada de conclusión (según turno, feriados e
                      incidencias):{" "}
                      <strong>{vistaPreviaPasantia.fechaFinEstimada}</strong>
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="acciones-formulario">
              <button
                type="submit"
                className="btn-personal btn-personal-primario"
                disabled={guardando}
              >
                {guardando
                  ? "Guardando..."
                  : form.id
                  ? "Guardar cambios"
                  : "Confirmar alta de persona"}
              </button>
              <button
                type="button"
                className="btn-personal"
                onClick={() => setMostrarFormulario(false)}
                disabled={guardando}
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Búsqueda y filtros dentro de contenedor .detalle-modulo */}
      <section className="detalle-modulo" aria-label="Búsqueda y filtros">
        <div className="filtros-grid-personal">
          <div className="campo-grupo">
            <label htmlFor="filtro-busqueda">
              Buscar persona (por nombres, apellidos o código PER-XXX)
            </label>
            <input
              id="filtro-busqueda"
              className="input-personal"
              type="search"
              placeholder="Escriba para buscar..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <div className="campo-grupo">
            <label htmlFor="filtro-tipo">Tipo de personal</label>
            <select
              id="filtro-tipo"
              className="select-personal"
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
            >
              <option value="todos">Todos (Planta y Pasantes)</option>
              <option value="planta">Solo Planta</option>
              <option value="pasante">Solo Pasantes</option>
            </select>
          </div>

          <div className="campo-grupo">
            <label htmlFor="filtro-estado">Estado</label>
            <select
              id="filtro-estado"
              className="select-personal"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
            >
              <option value="todos">Activos y de baja</option>
              <option value="activo">Solo activos</option>
              <option value="baja">Solo dados de baja</option>
            </select>
          </div>

          <button
            type="button"
            className="btn-personal"
            onClick={() => {
              setBusqueda("");
              setFiltroTipo("todos");
              setFiltroEstado("todos");
            }}
          >
            Limpiar filtros
          </button>
        </div>
      </section>

      {/* Cuadrícula de fichas siguiendo el diseño de .modulos y .tarjeta */}
      <section aria-label="Fichas de personal">
        {cargando ? (
          <div className="detalle-modulo">
            <p>Cargando registros de personal...</p>
          </div>
        ) : personas.length === 0 ? (
          <div className="detalle-modulo">
            <span className="numero">SIN RESULTADOS</span>
            <h3>No se encontraron personas con los filtros seleccionados</h3>
            <p>Limpie la búsqueda o registre una nueva persona.</p>
          </div>
        ) : (
          <div className="grid-fichas-personal">
            {personas.map((persona) => {
              const esPasante = persona.tipo === "pasante" && persona.pasantia;
              const esBaja = persona.estado === "baja";
              const historialAbierto = historialAbiertoId === persona.id;
              const bajaAbierta = bajaActivaId === persona.id;
              const progresoAbierto = progresoActivoId === persona.id;

              return (
                <article
                  key={persona.id}
                  className={`tarjeta-persona ${esBaja ? "en-baja" : ""}`}
                >
                  <div className="tarjeta-persona-cabecera">
                    <span className="numero">
                      {persona.codigo} ·{" "}
                      {persona.tipo === "pasante" ? "PASANTE" : "PERSONAL DE PLANTA"}
                    </span>
                    <span className={`pildora-estado ${esBaja ? "baja" : ""}`}>
                      {esBaja ? "De baja" : "Activo"}
                    </span>
                  </div>

                  <div>
                    <h3>{persona.nombreCompleto}</h3>
                    <p className="submeta">
                      {obtenerNombreTurno(persona.turno)} · Alta: {persona.fechaAlta}
                    </p>
                    {persona.datosEscritorio?.escritorioId && (
                      <div className="etiquetas" style={{ marginTop: "10px" }}>
                        <span>
                          Escritorio: {persona.datosEscritorio.escritorioId}
                        </span>
                        <span>
                          Sincronizado: {persona.datosEscritorio.sincronizadoEn}
                        </span>
                      </div>
                    )}
                  </div>

                  {esBaja && persona.motivoBaja && (
                    <div className="bloque-planta-nativo">
                      <strong>Motivo de baja conservado:</strong>{" "}
                      {persona.motivoBaja}
                    </div>
                  )}

                  {/* Diferenciación estricta Planta vs Pasante */}
                  {esPasante ? (
                    <div className="bloque-progreso-nativo">
                      <div className="fila-progreso">
                        <span>
                          Avance de pasantía: {persona.pasantia.horasCumplidas} /{" "}
                          {persona.pasantia.horasMeta} h
                        </span>
                        <span>{persona.pasantia.porcentajeProgreso}%</span>
                      </div>
                      <div
                        className="barra-nativa-fondo"
                        role="progressbar"
                        aria-valuenow={persona.pasantia.porcentajeProgreso}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div
                          className="barra-nativa-relleno"
                          style={{
                            width: `${persona.pasantia.porcentajeProgreso}%`
                          }}
                        />
                      </div>
                      <div className="datos-pasantia-grid">
                        <span>
                          <strong>Pendientes:</strong>{" "}
                          {persona.pasantia.horasPendientes} h (
                          {persona.pasantia.jornadasRestantes} jornadas)
                        </span>
                        <span>
                          <strong>Fin estimado:</strong>{" "}
                          {persona.pasantia.fechaFinEstimada}
                        </span>
                        <span>
                          <strong>Horario:</strong>{" "}
                          {persona.pasantia.horario || "08:00 - 12:30"} (
                          {persona.pasantia.horasPorDia} h/día)
                        </span>
                        <span>
                          <strong>Feriados / Incid.:</strong>{" "}
                          {persona.pasantia.diasFeriados} fer. ·{" "}
                          {persona.pasantia.diasIncidencias} inc.
                        </span>
                      </div>
                      {persona.pasantia.detalleIncidencias && (
                        <span style={{ fontSize: "12px", color: "#526c5c" }}>
                          Nota: {persona.pasantia.detalleIncidencias}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="bloque-planta-nativo">
                      <strong>Personal de planta:</strong> Sin meta de horas ni
                      fecha de finalización de pasantía.
                    </div>
                  )}

                  {/* Acción inline: sumar progreso / incidencias */}
                  {progresoAbierto && esPasante && (
                    <div className="caja-inline-nativa">
                      <span className="numero">REGISTRAR AVANCE O INCIDENCIAS</span>
                      <div className="form-grid-personal" style={{ marginTop: 0 }}>
                        <div className="campo-grupo">
                          <label htmlFor={`prog-horas-${persona.id}`}>
                            Horas a sumar (+h)
                          </label>
                          <input
                            id={`prog-horas-${persona.id}`}
                            className="input-personal"
                            type="number"
                            step="0.5"
                            value={formProgreso.horasSumar}
                            onChange={(e) =>
                              setFormProgreso((p) => ({
                                ...p,
                                horasSumar: e.target.value
                              }))
                            }
                          />
                        </div>
                        <div className="campo-grupo">
                          <label htmlFor={`prog-fer-${persona.id}`}>
                            Días feriados
                          </label>
                          <input
                            id={`prog-fer-${persona.id}`}
                            className="input-personal"
                            type="number"
                            min="0"
                            value={formProgreso.diasFeriados}
                            onChange={(e) =>
                              setFormProgreso((p) => ({
                                ...p,
                                diasFeriados: e.target.value
                              }))
                            }
                          />
                        </div>
                        <div className="campo-grupo">
                          <label htmlFor={`prog-inc-${persona.id}`}>
                            Días de incidencias
                          </label>
                          <input
                            id={`prog-inc-${persona.id}`}
                            className="input-personal"
                            type="number"
                            min="0"
                            value={formProgreso.diasIncidencias}
                            onChange={(e) =>
                              setFormProgreso((p) => ({
                                ...p,
                                diasIncidencias: e.target.value
                              }))
                            }
                          />
                        </div>
                        <div className="campo-grupo">
                          <label htmlFor={`prog-motivo-${persona.id}`}>
                            Observación
                          </label>
                          <input
                            id={`prog-motivo-${persona.id}`}
                            className="input-personal"
                            type="text"
                            placeholder="Ej. Jornada 08:00 a 12:30 cumplida"
                            value={formProgreso.motivo}
                            onChange={(e) =>
                              setFormProgreso((p) => ({
                                ...p,
                                motivo: e.target.value
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div
                        className="acciones-tarjeta"
                        style={{ borderTop: "none", paddingTop: 0 }}
                      >
                        <button
                          type="button"
                          className="btn-personal btn-personal-primario"
                          onClick={() => guardarProgresoPasante(persona)}
                          disabled={guardando}
                        >
                          Guardar avance
                        </button>
                        <button
                          type="button"
                          className="btn-personal"
                          onClick={() => setProgresoActivoId(null)}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Acción inline: baja conservando historial */}
                  {bajaAbierta && !esBaja && (
                    <div className="caja-inline-nativa">
                      <label htmlFor={`motivo-baja-${persona.id}`}>
                        <strong>
                          Motivo de baja (se conserva historial y datos):
                        </strong>
                      </label>
                      <input
                        id={`motivo-baja-${persona.id}`}
                        className="input-personal"
                        type="text"
                        placeholder="Ej. Conclusión de pasantía / Fin de contrato"
                        value={motivoBajaInput}
                        onChange={(e) => setMotivoBajaInput(e.target.value)}
                      />
                      {errorMotivoBaja && (
                        <span className="error-campo">{errorMotivoBaja}</span>
                      )}
                      <div
                        className="acciones-tarjeta"
                        style={{ borderTop: "none", paddingTop: 0 }}
                      >
                        <button
                          type="button"
                          className="btn-personal btn-personal-primario"
                          onClick={() => confirmarBajaPersona(persona)}
                          disabled={guardando}
                        >
                          Confirmar baja
                        </button>
                        <button
                          type="button"
                          className="btn-personal"
                          onClick={() => {
                            setBajaActivaId(null);
                            setMotivoBajaInput("");
                            setErrorMotivoBaja("");
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Visor de historial conservado */}
                  {historialAbierto && (
                    <div className="caja-inline-nativa">
                      <span className="numero">
                        HISTORIAL CONSERVADO ({persona.historial?.length || 0})
                      </span>
                      <ul className="lista-historial-nativa">
                        {(persona.historial || []).map((ev) => (
                          <li key={ev.id}>
                            <strong>{ev.fecha}</strong> · {ev.accion}: {ev.detalle}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="acciones-tarjeta">
                    <button
                      type="button"
                      className="btn-personal"
                      onClick={() => abrirEdicion(persona)}
                    >
                      Editar ficha
                    </button>

                    {esPasante && !esBaja && (
                      <button
                        type="button"
                        className="btn-personal btn-personal-secundario"
                        onClick={() =>
                          progresoAbierto
                            ? setProgresoActivoId(null)
                            : abrirCajaProgreso(persona)
                        }
                      >
                        + Horas / Incidencias
                      </button>
                    )}

                    {!esBaja ? (
                      <button
                        type="button"
                        className="btn-personal btn-personal-baja"
                        onClick={() => {
                          setBajaActivaId(bajaAbierta ? null : persona.id);
                          setMotivoBajaInput("");
                          setErrorMotivoBaja("");
                        }}
                      >
                        Dar de baja
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-personal btn-personal-secundario"
                        onClick={() => reactivarPersona(persona)}
                        disabled={guardando}
                      >
                        Recuperar persona
                      </button>
                    )}

                    <button
                      type="button"
                      className="btn-personal"
                      onClick={() =>
                        setHistorialAbiertoId(historialAbierto ? null : persona.id)
                      }
                    >
                      {historialAbierto
                        ? "Ocultar historial"
                        : `Historial (${persona.historial?.length || 0})`}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
