// src/modules/operaciones/index.jsx
import React, { useEffect, useState } from "react";
import "./styles/operaciones.css";
import { REGLAS_VIATICOS_VIGENTES } from "./mocks/datosPrueba.js";
import { importeTotalViatico } from "./utils/reglasOperaciones.js";
import {
  cargarDatosOperaciones,
  procesarOperacionModulo05,
  restaurarDatosPruebaOperaciones
} from "./services/operacionesService.js";
import ProyectoForm from "./components/ProyectoForm.jsx";
import AsignacionForm from "./components/AsignacionForm.jsx";
import ViaticoForm from "./components/ViaticoForm.jsx";
import TotalesReportesPanel from "./components/TotalesReportesPanel.jsx";

export default function Operaciones({ modulo }) {
  const [pestanaActiva, setPestanaActiva] = useState("proyectos");
  const [rolUsuario, setRolUsuario] = useState("administrador");
  const [modoRed, setModoRed] = useState("normal");

  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [estadoConexion, setEstadoConexion] = useState("Verificando conexión...");
  const [estadoModulo02, setEstadoModulo02] = useState("Consultando /api/personal...");

  const [personal, setPersonal] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [viaticos, setViaticos] = useState([]);
  const [auditoria, setAuditoria] = useState([]);

  // Notificación accesible en pantalla (reemplaza alert())
  const [aviso, setAviso] = useState(null);

  // Estados de formularios y diálogos en línea
  const [formProyectoAbierto, setFormProyectoAbierto] = useState(false);
  const [proyectoEditando, setProyectoEditando] = useState(null);
  const [proyectoPorCerrar, setProyectoPorCerrar] = useState(null);
  const [motivoCierreProyecto, setMotivoCierreProyecto] = useState("");
  const [errorCierreProyecto, setErrorCierreProyecto] = useState("");

  const [formAsignacionAbierto, setFormAsignacionAbierto] = useState(false);
  const [asignacionEditando, setAsignacionEditando] = useState(null);
  const [proyectoPreseleccionado, setProyectoPreseleccionado] = useState("");

  const [formViaticoAbierto, setFormViaticoAbierto] = useState(false);
  const [viaticoEditando, setViaticoEditando] = useState(null);
  const [viaticoPorDarDeBaja, setViaticoPorDarDeBaja] = useState(null);
  const [motivoBajaViatico, setMotivoBajaViatico] = useState("");
  const [errorBajaViatico, setErrorBajaViatico] = useState("");

  const sincronizarDatos = async (modo = modoRed) => {
    setCargando(true);
    setAviso(null);
    try {
      const respuesta = await cargarDatosOperaciones({ modoRed: modo });
      setPersonal(respuesta.personal);
      setProyectos(respuesta.proyectos);
      setAsignaciones(respuesta.asignaciones);
      setViaticos(respuesta.viaticos);
      setAuditoria(respuesta.auditoria);
      setEstadoConexion(respuesta.estadoConexion);
      setEstadoModulo02(respuesta.estadoModulo02);
    } catch (err) {
      setAviso({
        tipo: "error",
        texto: err.message || "Error al conectar con el servicio de operaciones."
      });
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    sincronizarDatos("normal");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aplicarResultado = (resultado) => {
    if (resultado?.estado) {
      setPersonal(resultado.estado.personal);
      setProyectos(resultado.estado.proyectos);
      setAsignaciones(resultado.estado.asignaciones);
      setViaticos(resultado.estado.viaticos);
      setAuditoria(resultado.estado.auditoria);
    }
  };

  // --- Acciones de Proyectos ---
  const handleGuardarProyecto = async (datosProyecto) => {
    setProcesando(true);
    setAviso(null);
    try {
      const res = await procesarOperacionModulo05({
        tipoOperacion: "GUARDAR_PROYECTO",
        datos: datosProyecto,
        rolUsuario,
        usuario: rolUsuario === "administrador" ? "admin.sii" : "operador.sii",
        modoRed
      });
      if (!res.ok) {
        setAviso({ tipo: "error", texto: res.mensaje });
        return;
      }
      aplicarResultado(res);
      setFormProyectoAbierto(false);
      setProyectoEditando(null);
      setAviso({ tipo: "exito", texto: res.mensaje });
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message });
    } finally {
      setProcesando(false);
    }
  };

  const handleConfirmarCierreProyecto = async (e) => {
    e.preventDefault();
    setErrorCierreProyecto("");
    setProcesando(true);
    try {
      const res = await procesarOperacionModulo05({
        tipoOperacion: "CERRAR_PROYECTO",
        datos: {
          idProyecto: proyectoPorCerrar.id,
          motivoCierre: motivoCierreProyecto
        },
        rolUsuario,
        usuario: rolUsuario === "administrador" ? "admin.sii" : "operador.sii",
        modoRed
      });
      if (!res.ok) {
        setErrorCierreProyecto(res.mensaje);
        return;
      }
      aplicarResultado(res);
      setProyectoPorCerrar(null);
      setMotivoCierreProyecto("");
      setAviso({ tipo: "exito", texto: res.mensaje });
    } catch (err) {
      setErrorCierreProyecto(err.message);
    } finally {
      setProcesando(false);
    }
  };

  // --- Acciones de Asignaciones ---
  const handleGuardarAsignacion = async (datosFormulario) => {
    setProcesando(true);
    setAviso(null);
    try {
      const res = await procesarOperacionModulo05({
        tipoOperacion: "GUARDAR_ASIGNACION",
        datos: datosFormulario,
        rolUsuario,
        usuario: rolUsuario === "administrador" ? "admin.sii" : "operador.sii",
        modoRed
      });
      if (!res.ok) {
        setAviso({ tipo: "error", texto: res.mensaje });
        return;
      }
      aplicarResultado(res);
      setFormAsignacionAbierto(false);
      setAsignacionEditando(null);
      setProyectoPreseleccionado("");
      setAviso({ tipo: "exito", texto: res.mensaje });
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message });
    } finally {
      setProcesando(false);
    }
  };

  const handleFinalizarAsignacion = async (idAsignacion) => {
    setProcesando(true);
    setAviso(null);
    try {
      const res = await procesarOperacionModulo05({
        tipoOperacion: "FINALIZAR_ASIGNACION",
        datos: { idAsignacion },
        rolUsuario,
        usuario: rolUsuario === "administrador" ? "admin.sii" : "operador.sii",
        modoRed
      });
      if (!res.ok) {
        setAviso({ tipo: "error", texto: res.mensaje });
        return;
      }
      aplicarResultado(res);
      setAviso({ tipo: "exito", texto: res.mensaje });
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message });
    } finally {
      setProcesando(false);
    }
  };

  // --- Acciones de Viáticos ---
  const handleGuardarViatico = async (datosViatico) => {
    setProcesando(true);
    setAviso(null);
    try {
      const res = await procesarOperacionModulo05({
        tipoOperacion: "GUARDAR_VIATICO",
        datos: datosViatico,
        rolUsuario,
        usuario: rolUsuario === "administrador" ? "admin.sii" : "operador.sii",
        modoRed
      });
      if (!res.ok) {
        setAviso({ tipo: "error", texto: res.mensaje });
        return;
      }
      aplicarResultado(res);
      setFormViaticoAbierto(false);
      setViaticoEditando(null);
      setAviso({ tipo: "exito", texto: res.mensaje });
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message });
    } finally {
      setProcesando(false);
    }
  };

  const handleConfirmarBajaViatico = async (e) => {
    e.preventDefault();
    setErrorBajaViatico("");
    setProcesando(true);
    try {
      const res = await procesarOperacionModulo05({
        tipoOperacion: "BAJA_VIATICO",
        datos: {
          idViatico: viaticoPorDarDeBaja.id,
          motivoBaja: motivoBajaViatico
        },
        rolUsuario,
        usuario: rolUsuario === "administrador" ? "admin.sii" : "operador.sii",
        modoRed
      });
      if (!res.ok) {
        setErrorBajaViatico(res.mensaje);
        return;
      }
      aplicarResultado(res);
      setViaticoPorDarDeBaja(null);
      setMotivoBajaViatico("");
      setAviso({ tipo: "exito", texto: res.mensaje });
    } catch (err) {
      setErrorBajaViatico(err.message);
    } finally {
      setProcesando(false);
    }
  };

  const handleRestaurarDemo = () => {
    const base = restaurarDatosPruebaOperaciones();
    setPersonal(base.personal);
    setProyectos(base.proyectos);
    setAsignaciones(base.asignaciones);
    setViaticos(base.viaticos);
    setAuditoria(base.auditoria);
    setAviso({
      tipo: "info",
      texto: "Se restauraron los datos iniciales de prueba del Módulo 05."
    });
  };

  const abrirNuevaAsignacionParaProyecto = (idProyecto) => {
    setProyectoPreseleccionado(idProyecto);
    setAsignacionEditando(null);
    setFormAsignacionAbierto(true);
    setPestanaActiva("asignaciones");
  };

  // KPIs rápidos
  const proyectosActivosCount = proyectos.filter((p) => p.estado === "Activo").length;
  const asignacionesActivasCount = asignaciones.filter((a) => a.estado === "Activa").length;
  const viaticosVigentes = viaticos.filter((v) => v.estado !== "Baja");
  const totalViaticosVigentes = viaticosVigentes.reduce(
    (acc, v) => acc + importeTotalViatico(v),
    0
  );

  return (
    <section className="detalle-modulo op-contenedor" aria-label="Módulo 05 Proyectos y viáticos">
      {/* Encabezado institucional coherente con ModuloBase */}
      <div className="op-cabecera">
        <div className="op-cabecera-top">
          <span className="numero">MÓDULO {modulo?.numero || "05"}</span>
          <div className="op-badges">
            <span className="op-badge">{estadoConexion}</span>
            <span className="op-badge">{estadoModulo02}</span>
          </div>
        </div>
        <h2 style={{ margin: "4px 0" }}>{modulo?.nombre || "Proyectos y viáticos"}</h2>
        <p style={{ margin: 0 }}>
          {modulo?.descripcion ||
            "Proyectos, asignaciones del equipo, gastos y control de operaciones."}
        </p>
      </div>

      {/* Barra de contexto y pruebas obligatorias (Permisos Módulo 01 + Simulación de Red) */}
      <div className="op-barra-contexto op-no-print" aria-label="Controles de sesión y red para pruebas">
        <div className="op-contexto-item">
          <label htmlFor="op-selector-rol">
            Rol activo (Integración Módulo 01 Acceso)
          </label>
          <select
            id="op-selector-rol"
            className="op-select"
            value={rolUsuario}
            onChange={(e) => setRolUsuario(e.target.value)}
          >
            <option value="administrador">Administrador (Autoriza cierres y bajas)</option>
            <option value="operador">Operador (Registra altas/ediciones; bajas restringidas)</option>
          </select>
        </div>

        <div className="op-contexto-item">
          <label htmlFor="op-selector-red">
            Prueba de red (Requisito móvil del informe)
          </label>
          <select
            id="op-selector-red"
            className="op-select"
            value={modoRed}
            onChange={(e) => {
              const nuevoModo = e.target.value;
              setModoRed(nuevoModo);
              sincronizarDatos(nuevoModo);
            }}
          >
            <option value="normal">Conexión normal</option>
            <option value="lenta">Conexión 3G lenta (prueba de estado de carga)</option>
            <option value="error">Simular fallo de red (prueba de error y reintento)</option>
          </select>
        </div>

        <div className="op-contexto-item" style={{ justifyContent: "flex-end" }}>
          <label>Datos de demostración</label>
          <button
            type="button"
            className="op-btn op-btn-secundario"
            onClick={handleRestaurarDemo}
          >
            Restaurar datos iniciales
          </button>
        </div>
      </div>

      {/* Notificaciones y estados de carga/error */}
      {cargando && (
        <div className="op-alerta op-alerta-info" role="status">
          <span>Cargando proyectos, participaciones y viáticos del Módulo 05...</span>
        </div>
      )}

      {aviso && (
        <div
          className={`op-alerta ${
            aviso.tipo === "error"
              ? "op-alerta-error"
              : aviso.tipo === "exito"
              ? "op-alerta-exito"
              : "op-alerta-info"
          }`}
          role="alert"
        >
          <span>{aviso.texto}</span>
          <div style={{ display: "flex", gap: "8px" }}>
            {modoRed === "error" && (
              <button
                type="button"
                className="op-btn op-btn-secundario"
                onClick={() => {
                  setModoRed("normal");
                  sincronizarDatos("normal");
                }}
              >
                Reintentar conexión
              </button>
            )}
            <button
              type="button"
              className="op-btn op-btn-secundario"
              onClick={() => setAviso(null)}
              aria-label="Cerrar mensaje"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Indicadores clave */}
      <div className="op-kpis">
        <div className="op-kpi-card">
          <span className="op-kpi-etiqueta">Proyectos Activos</span>
          <strong className="op-kpi-valor">
            {proyectosActivosCount} / {proyectos.length}
          </strong>
          <span className="op-kpi-sub">Con control de fechas y cierre</span>
        </div>
        <div className="op-kpi-card">
          <span className="op-kpi-etiqueta">Asignaciones Activas</span>
          <strong className="op-kpi-valor">{asignacionesActivasCount}</strong>
          <span className="op-kpi-sub">{asignaciones.length} participaciones totales</span>
        </div>
        <div className="op-kpi-card">
          <span className="op-kpi-etiqueta">Viáticos Conciliados</span>
          <strong className="op-kpi-valor">
            {REGLAS_VIATICOS_VIGENTES.moneda} {totalViaticosVigentes.toFixed(2)}
          </strong>
          <span className="op-kpi-sub">{viaticosVigentes.length} registro(s) vigente(s)</span>
        </div>
        <div className="op-kpi-card">
          <span className="op-kpi-etiqueta">Eventos Auditados</span>
          <strong className="op-kpi-valor">{auditoria.length}</strong>
          <span className="op-kpi-sub">Zona America/La_Paz</span>
        </div>
      </div>

      {/* Navegación por pestañas táctiles (>= 44x44px) */}
      <div className="op-tabs" role="tablist" aria-label="Secciones de Proyectos y Viáticos">
        <button
          type="button"
          role="tab"
          className="op-tab-btn"
          aria-selected={pestanaActiva === "proyectos"}
          onClick={() => setPestanaActiva("proyectos")}
        >
          1. Proyectos ({proyectos.length})
        </button>
        <button
          type="button"
          role="tab"
          className="op-tab-btn"
          aria-selected={pestanaActiva === "asignaciones"}
          onClick={() => setPestanaActiva("asignaciones")}
        >
          2. Asignaciones ({asignaciones.length})
        </button>
        <button
          type="button"
          role="tab"
          className="op-tab-btn"
          aria-selected={pestanaActiva === "viaticos"}
          onClick={() => setPestanaActiva("viaticos")}
        >
          3. Viáticos ({viaticos.length})
        </button>
        <button
          type="button"
          role="tab"
          className="op-tab-btn"
          aria-selected={pestanaActiva === "totales"}
          onClick={() => setPestanaActiva("totales")}
        >
          4. Totales, Reportes y Auditoría
        </button>
      </div>

      {/* PESTAÑA 1: PROYECTOS */}
      {pestanaActiva === "proyectos" && (
        <div>
          <div className="op-acciones-barra">
            <h3 style={{ margin: 0 }}>Gestión de Proyectos Operativos</h3>
            {!formProyectoAbierto && (
              <button
                type="button"
                className="op-btn op-btn-primario"
                onClick={() => {
                  setProyectoEditando(null);
                  setFormProyectoAbierto(true);
                }}
              >
                + Nuevo Proyecto
              </button>
            )}
          </div>

          {formProyectoAbierto && (
            <ProyectoForm
              proyectoInicial={proyectoEditando}
              proyectosExistentes={proyectos}
              guardando={procesando}
              alGuardar={handleGuardarProyecto}
              alCancelar={() => {
                setFormProyectoAbierto(false);
                setProyectoEditando(null);
              }}
            />
          )}

          {/* Panel de confirmación de cierre de proyecto conservando participaciones */}
          {proyectoPorCerrar && (
            <section className="op-form-panel" aria-labelledby="titulo-cierre-pry">
              <h3 id="titulo-cierre-pry" style={{ marginTop: 0 }}>
                Cerrar proyecto: {proyectoPorCerrar.nombre}
              </h3>
              <p className="op-ayuda" style={{ marginBottom: "12px" }}>
                Al cerrar el proyecto se conservarán todas las participaciones e historial de viáticos para reportes, y se bloqueará la creación de nuevas asignaciones o gastos.
              </p>
              <form onSubmit={handleConfirmarCierreProyecto}>
                <div className="op-campo">
                  <label className="op-label" htmlFor="motivo-cierre-input">
                    Motivo del cierre administrativo *
                  </label>
                  <textarea
                    id="motivo-cierre-input"
                    className="op-textarea"
                    value={motivoCierreProyecto}
                    onChange={(e) => setMotivoCierreProyecto(e.target.value)}
                    placeholder="Indique el acta o conclusión operativa del proyecto..."
                    aria-invalid={Boolean(errorCierreProyecto)}
                  />
                  {errorCierreProyecto && (
                    <p className="op-error-campo">{errorCierreProyecto}</p>
                  )}
                </div>
                <div className="op-card-acciones" style={{ marginTop: "12px" }}>
                  <button
                    type="submit"
                    className="op-btn op-btn-peligro"
                    disabled={procesando}
                  >
                    Confirmar cierre conservando participaciones
                  </button>
                  <button
                    type="button"
                    className="op-btn op-btn-secundario"
                    onClick={() => {
                      setProyectoPorCerrar(null);
                      setMotivoCierreProyecto("");
                      setErrorCierreProyecto("");
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </section>
          )}

          <div className="op-lista-grid">
            {proyectos.map((proyecto) => {
              const participacionesProyecto = asignaciones.filter(
                (a) => Number(a.idProyecto) === Number(proyecto.id)
              );
              const viaticosProyecto = viaticos.filter(
                (v) => Number(v.idProyecto) === Number(proyecto.id) && v.estado !== "Baja"
              );
              const gastado = viaticosProyecto.reduce(
                (acc, item) => acc + importeTotalViatico(item),
                0
              );

              return (
                <article key={proyecto.id} className="op-card">
                  <div className="op-card-header">
                    <div>
                      <span style={{ fontSize: "12px", color: "#5d705e", fontWeight: 700 }}>
                        {proyecto.codigo || `PRY-${proyecto.id}`}
                      </span>
                      <h4 className="op-card-titulo">{proyecto.nombre}</h4>
                    </div>
                    <span
                      className={`op-badge ${
                        proyecto.estado === "Activo"
                          ? "op-badge-activo"
                          : proyecto.estado === "Pausado"
                          ? "op-badge-pausado"
                          : "op-badge-cerrado"
                      }`}
                    >
                      {proyecto.estado}
                    </span>
                  </div>

                  <p className="op-card-meta">{proyecto.descripcion}</p>
                  <p className="op-card-meta">
                    <strong>Ubicación:</strong> {proyecto.ubicacion || "Oficina Santiago II"}
                  </p>
                  <p className="op-card-meta">
                    <strong>Período oficial:</strong> {proyecto.fechaInicio} al {proyecto.fechaFin}
                  </p>
                  <p className="op-card-meta">
                    <strong>Participaciones:</strong> {participacionesProyecto.length} ·{" "}
                    <strong>Viáticos ejecutados:</strong> Bs {gastado.toFixed(2)} / Bs{" "}
                    {Number(proyecto.presupuestoViaticos || 0).toFixed(2)}
                  </p>
                  {proyecto.estado === "Cerrado" && proyecto.motivoCierre && (
                    <p className="op-card-meta" style={{ color: "#4e5d50" }}>
                      <strong>Acta de cierre ({proyecto.fechaCierre}):</strong>{" "}
                      {proyecto.motivoCierre}
                    </p>
                  )}

                  <div className="op-card-acciones">
                    {proyecto.estado === "Activo" && (
                      <button
                        type="button"
                        className="op-btn op-btn-primario"
                        onClick={() => abrirNuevaAsignacionParaProyecto(proyecto.id)}
                      >
                        Asignar Personal
                      </button>
                    )}
                    {proyecto.estado !== "Cerrado" && (
                      <>
                        <button
                          type="button"
                          className="op-btn op-btn-secundario"
                          onClick={() => {
                            setProyectoEditando(proyecto);
                            setFormProyectoAbierto(true);
                          }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="op-btn op-btn-peligro"
                          onClick={() => {
                            setProyectoPorCerrar(proyecto);
                            setMotivoCierreProyecto("");
                            setErrorCierreProyecto("");
                          }}
                        >
                          Cerrar Proyecto
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* PESTAÑA 2: ASIGNACIONES */}
      {pestanaActiva === "asignaciones" && (
        <div>
          <div className="op-acciones-barra">
            <h3 style={{ margin: 0 }}>
              Asignaciones del Equipo (Con prevención de duplicados activos)
            </h3>
            {!formAsignacionAbierto && (
              <button
                type="button"
                className="op-btn op-btn-primario"
                onClick={() => {
                  setAsignacionEditando(null);
                  setProyectoPreseleccionado("");
                  setFormAsignacionAbierto(true);
                }}
              >
                + Nueva Asignación
              </button>
            )}
          </div>

          {formAsignacionAbierto && (
            <AsignacionForm
              asignacionInicial={asignacionEditando}
              idProyectoPreseleccionado={proyectoPreseleccionado}
              proyectos={proyectos}
              personal={personal}
              asignacionesExistentes={asignaciones}
              guardando={procesando}
              alGuardar={handleGuardarAsignacion}
              alCancelar={() => {
                setFormAsignacionAbierto(false);
                setAsignacionEditando(null);
                setProyectoPreseleccionado("");
              }}
            />
          )}

          <div className="op-lista-grid">
            {asignaciones.map((asig) => {
              const pry = proyectos.find((p) => Number(p.id) === Number(asig.idProyecto));
              const per = personal.find((p) => Number(p.id) === Number(asig.idPersonal));

              return (
                <article key={asig.id} className="op-card">
                  <div className="op-card-header">
                    <div>
                      <span style={{ fontSize: "12px", color: "#5d705e", fontWeight: 700 }}>
                        Asignación #{asig.id}
                      </span>
                      <h4 className="op-card-titulo">
                        {per ? `${per.nombres} ${per.apellidos}` : `Persona #${asig.idPersonal}`}
                      </h4>
                    </div>
                    <div className="op-badges">
                      {per && (
                        <span
                          className={`op-badge ${
                            per.tipo === "Pasante" ? "op-badge-pasante" : "op-badge-planta"
                          }`}
                        >
                          {per.tipo}
                        </span>
                      )}
                      <span
                        className={`op-badge ${
                          asig.estado === "Activa" ? "op-badge-activo" : "op-badge-cerrado"
                        }`}
                      >
                        {asig.estado}
                      </span>
                    </div>
                  </div>

                  <p className="op-card-meta">
                    <strong>Proyecto:</strong> {pry ? pry.nombre : `Proyecto #${asig.idProyecto}`}{" "}
                    {pry ? `(${pry.fechaInicio} al ${pry.fechaFin})` : ""}
                  </p>
                  <p className="op-card-meta">
                    <strong>Función desempeñada:</strong> {asig.funcion}
                  </p>
                  <p className="op-card-meta">
                    <strong>Período asignado:</strong> {asig.fechaInicio} al {asig.fechaFin}
                  </p>

                  {asig.estado === "Activa" && pry?.estado !== "Cerrado" && (
                    <div className="op-card-acciones">
                      <button
                        type="button"
                        className="op-btn op-btn-secundario"
                        onClick={() => {
                          setAsignacionEditando(asig);
                          setFormAsignacionAbierto(true);
                        }}
                      >
                        Editar período / función
                      </button>
                      <button
                        type="button"
                        className="op-btn op-btn-peligro"
                        onClick={() => handleFinalizarAsignacion(asig.id)}
                      >
                        Finalizar participación
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* PESTAÑA 3: VIÁTICOS */}
      {pestanaActiva === "viaticos" && (
        <div>
          <div className="op-acciones-barra">
            <h3 style={{ margin: 0 }}>
              Control de Viáticos y Gastos Adicionales
            </h3>
            {!formViaticoAbierto && (
              <button
                type="button"
                className="op-btn op-btn-primario"
                onClick={() => {
                  setViaticoEditando(null);
                  setFormViaticoAbierto(true);
                }}
              >
                + Registrar Viático
              </button>
            )}
          </div>

          {formViaticoAbierto && (
            <ViaticoForm
              viaticoInicial={viaticoEditando}
              proyectos={proyectos}
              personal={personal}
              asignaciones={asignaciones}
              reglas={REGLAS_VIATICOS_VIGENTES}
              guardando={procesando}
              alGuardar={handleGuardarViatico}
              alCancelar={() => {
                setFormViaticoAbierto(false);
                setViaticoEditando(null);
              }}
            />
          )}

          {/* Panel de confirmación para baja autorizada de viático */}
          {viaticoPorDarDeBaja && (
            <section className="op-form-panel" aria-labelledby="titulo-baja-viatico">
              <h3 id="titulo-baja-viatico" style={{ marginTop: 0 }}>
                Baja autorizada del Viático #{viaticoPorDarDeBaja.id}
              </h3>
              <p className="op-ayuda" style={{ marginBottom: "12px" }}>
                Rol actual: <strong>{rolUsuario.toUpperCase()}</strong>. Solo el rol Administrador puede autorizar la baja de un viático registrado, conservando trazabilidad en auditoría.
              </p>
              <form onSubmit={handleConfirmarBajaViatico}>
                <div className="op-campo">
                  <label className="op-label" htmlFor="motivo-baja-viatico-input">
                    Motivo de la baja autorizada *
                  </label>
                  <textarea
                    id="motivo-baja-viatico-input"
                    className="op-textarea"
                    value={motivoBajaViatico}
                    onChange={(e) => setMotivoBajaViatico(e.target.value)}
                    placeholder="Ej. Comprobante anulado o duplicado en rendición..."
                    aria-invalid={Boolean(errorBajaViatico)}
                  />
                  {errorBajaViatico && (
                    <p className="op-error-campo">{errorBajaViatico}</p>
                  )}
                </div>
                <div className="op-card-acciones" style={{ marginTop: "12px" }}>
                  <button
                    type="submit"
                    className="op-btn op-btn-peligro"
                    disabled={procesando}
                  >
                    Confirmar baja de viático
                  </button>
                  <button
                    type="button"
                    className="op-btn op-btn-secundario"
                    onClick={() => {
                      setViaticoPorDarDeBaja(null);
                      setMotivoBajaViatico("");
                      setErrorBajaViatico("");
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </section>
          )}

          <div className="op-lista-grid">
            {viaticos.map((v) => {
              const pry = proyectos.find((p) => Number(p.id) === Number(v.idProyecto));
              const per = personal.find((p) => Number(p.id) === Number(v.idPersonal));
              const total = importeTotalViatico(v);

              return (
                <article key={v.id} className="op-card">
                  <div className="op-card-header">
                    <div>
                      <span style={{ fontSize: "12px", color: "#5d705e", fontWeight: 700 }}>
                        Viático #{v.id} · {v.fecha}
                      </span>
                      <h4 className="op-card-titulo">
                        {v.categoria} — Bs {total.toFixed(2)}
                      </h4>
                    </div>
                    <span
                      className={`op-badge ${
                        v.estado === "Vigente" ? "op-badge-activo" : "op-badge-baja"
                      }`}
                    >
                      {v.estado}
                    </span>
                  </div>

                  <p className="op-card-meta">
                    <strong>Proyecto:</strong> {pry ? pry.nombre : `Proyecto #${v.idProyecto}`}
                  </p>
                  <p className="op-card-meta">
                    <strong>Beneficiario:</strong>{" "}
                    {per ? `${per.nombres} ${per.apellidos} (${per.tipo})` : `Persona #${v.idPersonal}`}
                  </p>
                  <p className="op-card-meta">
                    <strong>Desglose:</strong> Base Bs {Number(v.monto).toFixed(2)}
                    {v.esGastoAdicional
                      ? ` + Adicional Bs ${Number(v.montoAdicional || 0).toFixed(2)}`
                      : " (sin gasto adicional)"}
                  </p>
                  <p className="op-card-meta">
                    <strong>Concepto:</strong> {v.descripcion}{" "}
                    {v.comprobante ? `· Comprobante: ${v.comprobante}` : ""}
                  </p>
                  {v.esGastoAdicional && v.justificacionAdicional && (
                    <p className="op-card-meta">
                      <strong>Justificación adicional:</strong> {v.justificacionAdicional}
                    </p>
                  )}
                  {v.estado === "Baja" && v.motivoBaja && (
                    <p className="op-card-meta" style={{ color: "#9e1c1c" }}>
                      <strong>Baja auditada ({v.fechaBaja}):</strong> {v.motivoBaja}
                    </p>
                  )}

                  {v.estado === "Vigente" && pry?.estado !== "Cerrado" && (
                    <div className="op-card-acciones">
                      <button
                        type="button"
                        className="op-btn op-btn-secundario"
                        onClick={() => {
                          setViaticoEditando(v);
                          setFormViaticoAbierto(true);
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="op-btn op-btn-peligro"
                        onClick={() => {
                          setViaticoPorDarDeBaja(v);
                          setMotivoBajaViatico("");
                          setErrorBajaViatico("");
                        }}
                      >
                        Dar de baja
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* PESTAÑA 4: TOTALES, ENLACE CON REPORTES Y AUDITORÍA */}
      {pestanaActiva === "totales" && (
        <TotalesReportesPanel
          proyectos={proyectos}
          personal={personal}
          asignaciones={asignaciones}
          viaticos={viaticos}
          auditoria={auditoria}
        />
      )}

      {/* Criterio de aceptación oficial visible al pie del módulo */}
      <div className="aceptacion" style={{ marginTop: "28px" }}>
        <strong>Criterio de aceptación (Módulo 05)</strong>
        <p>
          {modulo?.aceptacion ||
            "Las asignaciones respetan las fechas del proyecto, los viáticos cumplen sus reglas y los totales coinciden con los reportes."}
        </p>
      </div>
      <p className="ruta">
        Código del módulo: src/modules/{modulo?.id || "operaciones"}/ · API: api/operaciones.js
      </p>
    </section>
  );
}