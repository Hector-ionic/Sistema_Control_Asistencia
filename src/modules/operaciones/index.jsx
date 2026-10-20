// src/modules/operaciones/index.jsx
import React, { useEffect, useState } from "react";
import "./styles/operaciones.css";
import { REGLAS_VIATICOS_VIGENTES } from "./mocks/datosPrueba.js";
import {
  importeTotalViatico,
  prepararCierreProyecto,
  prepararFinalizacionAsignacion
} from "./utils/reglasOperaciones.js";
import {
  ejecutarOperacionModulo05,
  cargarColeccionesModulo05,
  obtenerTokenMemoria,
  obtenerSesionMemoria,
  establecerTokenMemoria,
  cerrarSesionMemoria,
  reiniciarMemoriaSimulada
} from "./services/operacionesService.js";
import ProyectoForm from "./components/ProyectoForm.jsx";
import AsignacionForm from "./components/AsignacionForm.jsx";
import ViaticoForm from "./components/ViaticoForm.jsx";
import TotalesReportesPanel from "./components/TotalesReportesPanel.jsx";

export default function Operaciones({ modulo }) {
  const [pestanaActiva, setPestanaActiva] = useState("proyectos");

  // Estado de conexión y modo de contrato (/api/backend real vs simulador de contrato en memoria)
  const [usarContratoMemoria, setUsarContratoMemoria] = useState(false);
  const [modoRed, setModoRed] = useState("normal");
  const [estadoBackend, setEstadoBackend] = useState(
    "Verificando conexión con el backend..."
  );

  // Sesión exclusivamente en memoria (sin localStorage ni x-rol-usuario)
  const [tokenSesion, setTokenSesion] = useState(() => obtenerTokenMemoria());
  const [usuarioActual, setUsuarioActual] = useState(() => obtenerSesionMemoria());
  const [credencialesLogin, setCredencialesLogin] = useState({
    usuario: "",
    password: ""
  });

  const [cargando, setCargando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [aviso, setAviso] = useState(null);

  // Colecciones recibidas de las operaciones del backend
  const [personal, setPersonal] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [viaticos, setViaticos] = useState([]);
  const [auditoria, setAuditoria] = useState([]);

  // Formularios y confirmaciones en línea
  const [formProyectoAbierto, setFormProyectoAbierto] = useState(false);
  const [proyectoEditando, setProyectoEditando] = useState(null);
  const [proyectoPorFinalizar, setProyectoPorFinalizar] = useState(null);

  const [formAsignacionAbierto, setFormAsignacionAbierto] = useState(false);
  const [asignacionEditando, setAsignacionEditando] = useState(null);
  const [proyectoPreseleccionado, setProyectoPreseleccionado] = useState("");

  const [formViaticoAbierto, setFormViaticoAbierto] = useState(false);
  const [viaticoEditando, setViaticoEditando] = useState(null);
  const [viaticoPorEliminar, setViaticoPorEliminar] = useState(null);

  // Comprobar disponibilidad de GET /api/backend al iniciar
  useEffect(() => {
    let activo = true;
    async function verificarContratoBackend() {
      try {
        const res = await fetch("/api/backend", {
          method: "GET",
          cache: "no-store"
        });
        if (!activo) return;
        if (res.ok) {
          setUsarContratoMemoria(false);
          setEstadoBackend("Conectado al servidor (/api/backend)");
        } else {
          setUsarContratoMemoria(true);
          setEstadoBackend("Modo de prueba en memoria activo");
        }
      } catch {
        if (!activo) return;
        setUsarContratoMemoria(true);
        setEstadoBackend("Modo de prueba en memoria activo");
      }
    }
    verificarContratoBackend();
    return () => {
      activo = false;
    };
  }, []);

  const recargarColecciones = async (
    forzarMemoria = usarContratoMemoria,
    red = modoRed
  ) => {
    setCargando(true);
    try {
      const datos = await cargarColeccionesModulo05({
        usarContratoMemoria: forzarMemoria,
        modoRed: red
      });
      setProyectos(datos.proyectos);
      setAsignaciones(datos.asignaciones);
      setViaticos(datos.viaticos);
      setPersonal(datos.personal);
      setAuditoria(datos.auditoria);
    } catch (error) {
      if (error.status === 401) {
        setTokenSesion("");
        setUsuarioActual(null);
        setAviso({
          tipo: "error",
          texto: "La sesión ha vencido o no es válida. Inicie sesión nuevamente."
        });
      } else {
        setAviso({
          tipo: "error",
          texto: error.message || "No se pudo consultar el backend."
        });
      }
    } finally {
      setCargando(false);
    }
  };

  // --- Inicio y cierre de sesión en memoria ---
  const handleIniciarSesion = async (e) => {
    e.preventDefault();
    setProcesando(true);
    setAviso(null);
    try {
      const respSesion = await ejecutarOperacionModulo05(
        "sesion",
        {
          usuario: credencialesLogin.usuario,
          password: credencialesLogin.password
        },
        { usarContratoMemoria, modoRed }
      );

      const nuevoToken = respSesion.accessToken;
      establecerTokenMemoria(nuevoToken, null);
      setTokenSesion(nuevoToken);

      const perfil = await ejecutarOperacionModulo05(
        "sesion.actual",
        {},
        { usarContratoMemoria, modoRed }
      );
      establecerTokenMemoria(nuevoToken, perfil);
      setUsuarioActual(perfil);

      await recargarColecciones(usarContratoMemoria, modoRed);
      setAviso({
        tipo: "exito",
        texto: `Sesión iniciada como '${perfil.nombreUsuario}' (${perfil.rol}).`
      });
    } catch (error) {
      if (error.status === 503 && !usarContratoMemoria) {
        setAviso({
          tipo: "error",
          texto: `${error.message} (Puede cambiar a 'Modo de prueba en memoria' arriba para probar sin la API de escritorio encendida).`
        });
      } else {
        setAviso({
          tipo: "error",
          texto: error.message || "Error al iniciar sesión."
        });
      }
    } finally {
      setProcesando(false);
    }
  };

  const handleCerrarSesion = () => {
    cerrarSesionMemoria();
    setTokenSesion("");
    setUsuarioActual(null);
    setCredencialesLogin({ usuario: "", password: "" });
    setProyectos([]);
    setAsignaciones([]);
    setViaticos([]);
    setPersonal([]);
    setAuditoria([]);
    setAviso({
      tipo: "info",
      texto: "Sesión cerrada correctamente."
    });
  };

  const manejarErrorOperacion = async (error) => {
    if (error.status === 401) {
      cerrarSesionMemoria();
      setTokenSesion("");
      setUsuarioActual(null);
      setAviso({
        tipo: "error",
        texto: "Sesión requerida o vencida. Vuelva a iniciar sesión."
      });
      return;
    }
    if (error.status === 409) {
      await recargarColecciones();
      setAviso({
        tipo: "error",
        texto:
          error.message ||
          "Conflicto de versión: se recargaron los datos actuales desde el servidor. Revise antes de guardar."
      });
      return;
    }
    setAviso({
      tipo: "error",
      texto: error.message || "No se pudo completar la operación."
    });
  };

  // --- 1. Operaciones de Proyectos ---
  const handleGuardarProyecto = async (payloadProyecto) => {
    setProcesando(true);
    setAviso(null);
    try {
      await ejecutarOperacionModulo05("proyectos.guardar", payloadProyecto, {
        usarContratoMemoria,
        modoRed
      });
      await recargarColecciones();
      setFormProyectoAbierto(false);
      setProyectoEditando(null);
      setAviso({
        tipo: "exito",
        texto:
          payloadProyecto.idProyecto > 0
            ? "Proyecto actualizado correctamente."
            : "Proyecto registrado correctamente."
      });
    } catch (error) {
      await manejarErrorOperacion(error);
    } finally {
      setProcesando(false);
    }
  };

  const handleConfirmarFinalizarProyecto = async () => {
    if (!proyectoPorFinalizar) return;
    setProcesando(true);
    setAviso(null);
    try {
      const listaFresca = await ejecutarOperacionModulo05(
        "proyectos.listar",
        {},
        { usarContratoMemoria, modoRed }
      );
      const proyectoLeido = listaFresca.find(
        (p) => Number(p.idProyecto) === Number(proyectoPorFinalizar.idProyecto)
      );
      const payloadCierre = prepararCierreProyecto(
        proyectoLeido || proyectoPorFinalizar
      );

      await ejecutarOperacionModulo05("proyectos.guardar", payloadCierre, {
        usarContratoMemoria,
        modoRed
      });
      await recargarColecciones();
      setProyectoPorFinalizar(null);
      setAviso({
        tipo: "exito",
        texto: `Proyecto '${payloadCierre.nombre}' finalizado conservando todas sus participaciones históricas.`
      });
    } catch (error) {
      await manejarErrorOperacion(error);
    } finally {
      setProcesando(false);
    }
  };

  // --- 2. Operaciones de Asignaciones ---
  const handleGuardarAsignacion = async (payloadAsignacion) => {
    setProcesando(true);
    setAviso(null);
    try {
      await ejecutarOperacionModulo05(
        "asignaciones.guardar",
        payloadAsignacion,
        { usarContratoMemoria, modoRed }
      );
      await recargarColecciones();
      setFormAsignacionAbierto(false);
      setAsignacionEditando(null);
      setProyectoPreseleccionado("");
      setAviso({
        tipo: "exito",
        texto:
          payloadAsignacion.idAsignacion > 0
            ? "Asignación actualizada correctamente."
            : "Asignación registrada correctamente."
      });
    } catch (error) {
      await manejarErrorOperacion(error);
    } finally {
      setProcesando(false);
    }
  };

  const handleFinalizarAsignacion = async (asignacionActual) => {
    setProcesando(true);
    setAviso(null);
    try {
      const listaFresca = await ejecutarOperacionModulo05(
        "asignaciones.listar",
        { idProyecto: asignacionActual.idProyecto },
        { usarContratoMemoria, modoRed }
      );
      const asignacionLeida = listaFresca.find(
        (a) => Number(a.idAsignacion) === Number(asignacionActual.idAsignacion)
      );
      const payloadFinalizar = prepararFinalizacionAsignacion(
        asignacionLeida || asignacionActual
      );

      await ejecutarOperacionModulo05(
        "asignaciones.guardar",
        payloadFinalizar,
        { usarContratoMemoria, modoRed }
      );
      await recargarColecciones();
      setAviso({
        tipo: "exito",
        texto: `Participación #${payloadFinalizar.idAsignacion} finalizada y conservada en el historial.`
      });
    } catch (error) {
      await manejarErrorOperacion(error);
    } finally {
      setProcesando(false);
    }
  };

  // --- 3. Operaciones de Viáticos ---
  const handleGuardarViatico = async (payloadViatico) => {
    setProcesando(true);
    setAviso(null);
    try {
      await ejecutarOperacionModulo05("viaticos.guardar", payloadViatico, {
        usarContratoMemoria,
        modoRed
      });
      await recargarColecciones();
      setFormViaticoAbierto(false);
      setViaticoEditando(null);
      setAviso({
        tipo: "exito",
        texto:
          payloadViatico.idViatico > 0
            ? "Viático actualizado correctamente."
            : "Viático registrado correctamente."
      });
    } catch (error) {
      await manejarErrorOperacion(error);
    } finally {
      setProcesando(false);
    }
  };

  const handleConfirmarEliminarViatico = async () => {
    if (!viaticoPorEliminar) return;
    setProcesando(true);
    setAviso(null);
    try {
      await ejecutarOperacionModulo05(
        "viaticos.eliminar",
        { id: viaticoPorEliminar.idViatico },
        { usarContratoMemoria, modoRed }
      );
      await recargarColecciones();
      setViaticoPorEliminar(null);
      setAviso({
        tipo: "exito",
        texto: `Viático #${viaticoPorEliminar.idViatico} eliminado del registro.`
      });
    } catch (error) {
      await manejarErrorOperacion(error);
    } finally {
      setProcesando(false);
    }
  };

  const abrirNuevaAsignacionParaProyecto = (idProyecto) => {
    setProyectoPreseleccionado(idProyecto);
    setAsignacionEditando(null);
    setFormAsignacionAbierto(true);
    setPestanaActiva("asignaciones");
  };

  // KPIs
  const proyectosEnCursoCount = proyectos.filter(
    (p) => p.estado === "En curso" || p.estado === "Planificado"
  ).length;
  const asignacionesActivasCount = asignaciones.filter((a) => a.activo).length;
  const totalViaticos = viaticos.reduce(
    (acc, v) => acc + importeTotalViatico(v),
    0
  );

  return (
    <section
      className="detalle-modulo op-contenedor"
      aria-label="Módulo 05 Proyectos y viáticos"
    >
      {/* Cabecera */}
      <div className="op-cabecera">
        <div className="op-cabecera-top">
          <span className="numero">MÓDULO {modulo?.numero || "05"}</span>
          <div className="op-badges">
            <span className="op-badge">{estadoBackend}</span>
            <span className="op-badge">
              {tokenSesion
                ? `Sesión activa: ${usuarioActual?.nombreUsuario || "usuario"} (${
                    usuarioActual?.rol || "Autenticado"
                  })`
                : "Sin sesión iniciada"}
            </span>
          </div>
        </div>
        <h2 style={{ margin: "4px 0" }}>
          {modulo?.nombre || "Proyectos y viáticos"}
        </h2>
        <p style={{ margin: 0 }}>
          {modulo?.descripcion ||
            "Proyectos, asignaciones del equipo, gastos y control de operaciones."}
        </p>
      </div>

      {/* Barra de configuración de conexión y red */}
      <div
        className="op-barra-contexto op-no-print"
        aria-label="Configuración de conexión y sesión"
      >
        <div className="op-contexto-item">
          <label htmlFor="op-modo-contrato">Modo de conexión</label>
          <select
            id="op-modo-contrato"
            className="op-select"
            value={usarContratoMemoria ? "memoria" : "backend"}
            onChange={(e) => {
              const usarMem = e.target.value === "memoria";
              setUsarContratoMemoria(usarMem);
              setEstadoBackend(
                usarMem
                  ? "Modo de prueba en memoria activo"
                  : "Conectado al servidor (/api/backend)"
              );
            }}
          >
            <option value="backend">
              Servidor real (/api/backend · API C# + Base de datos)
            </option>
            <option value="memoria">
              Modo de prueba en memoria (sin servidor de escritorio)
            </option>
          </select>
        </div>

        <div className="op-contexto-item">
          <label htmlFor="op-selector-red">Estado de red (Prueba móvil)</label>
          <select
            id="op-selector-red"
            className="op-select"
            value={modoRed}
            onChange={(e) => setModoRed(e.target.value)}
          >
            <option value="normal">Conexión normal</option>
            <option value="lenta">Conexión lenta (verificar carga)</option>
            <option value="error">Simular fallo de red</option>
          </select>
        </div>

        <div className="op-contexto-item" style={{ justifyContent: "flex-end" }}>
          <label>Sesión de usuario</label>
          {tokenSesion ? (
            <button
              type="button"
              className="op-btn op-btn-peligro"
              onClick={handleCerrarSesion}
            >
              Cerrar sesión
            </button>
          ) : (
            <button
              type="button"
              className="op-btn op-btn-secundario"
              onClick={() => {
                reiniciarMemoriaSimulada();
                setAviso({
                  tipo: "info",
                  texto: "Datos de prueba reiniciados. Inicie sesión para continuar."
                });
              }}
            >
              Restaurar datos iniciales
            </button>
          )}
        </div>
      </div>

      {/* Mensajes de estado, error o confirmación */}
      {cargando && (
        <div className="op-alerta op-alerta-info" role="status">
          <span>Cargando proyectos, asignaciones y viáticos...</span>
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
          <button
            type="button"
            className="op-btn op-btn-secundario"
            onClick={() => setAviso(null)}
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Si no hay sesión activa, mostrar inicio de sesión */}
      {!tokenSesion ? (
        <section
          className="op-form-panel"
          aria-labelledby="titulo-login-backend"
        >
          <h3 id="titulo-login-backend" style={{ marginTop: 0 }}>
            Iniciar sesión para acceder a Proyectos y Viáticos
          </h3>
          <p className="op-ayuda" style={{ marginBottom: "14px" }}>
            Ingrese su usuario y contraseña para consultar y registrar operaciones.
          </p>

          <form onSubmit={handleIniciarSesion}>
            <div className="op-form-grid">
              <div className="op-campo">
                <label className="op-label" htmlFor="login-usuario">
                  Usuario *
                </label>
                <input
                  id="login-usuario"
                  type="text"
                  className="op-input"
                  value={credencialesLogin.usuario}
                  onChange={(e) =>
                    setCredencialesLogin((prev) => ({
                      ...prev,
                      usuario: e.target.value
                    }))
                  }
                  required
                />
              </div>

              <div className="op-campo">
                <label className="op-label" htmlFor="login-password">
                  Contraseña *
                </label>
                <input
                  id="login-password"
                  type="password"
                  className="op-input"
                  value={credencialesLogin.password}
                  onChange={(e) =>
                    setCredencialesLogin((prev) => ({
                      ...prev,
                      password: e.target.value
                    }))
                  }
                  required
                />
              </div>
            </div>

            <div className="op-card-acciones" style={{ marginTop: "16px" }}>
              <button
                type="submit"
                className="op-btn op-btn-primario"
                disabled={procesando}
              >
                {procesando ? "Iniciando sesión..." : "Ingresar al Módulo 05"}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <>
          {/* KPIs */}
          <div className="op-kpis">
            <div className="op-kpi-card">
              <span className="op-kpi-etiqueta">Proyectos Activos</span>
              <strong className="op-kpi-valor">
                {proyectosEnCursoCount} / {proyectos.length}
              </strong>
              <span className="op-kpi-sub">
                Planificados y en curso
              </span>
            </div>
            <div className="op-kpi-card">
              <span className="op-kpi-etiqueta">Asignaciones Activas</span>
              <strong className="op-kpi-valor">{asignacionesActivasCount}</strong>
              <span className="op-kpi-sub">
                {asignaciones.length} participaciones registradas
              </span>
            </div>
            <div className="op-kpi-card">
              <span className="op-kpi-etiqueta">Total Viáticos</span>
              <strong className="op-kpi-valor">
                {REGLAS_VIATICOS_VIGENTES.moneda} {totalViaticos.toFixed(2)}
              </strong>
              <span className="op-kpi-sub">
                {viaticos.length} registros (Base máx. 12 Bs + adicionales)
              </span>
            </div>
            <div className="op-kpi-card">
              <span className="op-kpi-etiqueta">Rol de Usuario</span>
              <strong className="op-kpi-valor">
                {usuarioActual?.rol || "Admin"}
              </strong>
              <span className="op-kpi-sub">Sesión verificada</span>
            </div>
          </div>

          {/* Pestañas */}
          <div
            className="op-tabs"
            role="tablist"
            aria-label="Secciones de Proyectos y Viáticos"
          >
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
                <h3 style={{ margin: 0 }}>Proyectos</h3>
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

              {/* Confirmación de cierre de proyecto */}
              {proyectoPorFinalizar && (
                <section
                  className="op-form-panel"
                  aria-labelledby="titulo-cierre-pry"
                >
                  <h3 id="titulo-cierre-pry" style={{ marginTop: 0 }}>
                    Cerrar proyecto: {proyectoPorFinalizar.nombre}
                  </h3>
                  <p className="op-ayuda" style={{ marginBottom: "14px" }}>
                    Al cerrar el proyecto su estado pasará a <strong>Finalizado</strong> y se conservarán todas las participaciones registradas en el historial para consulta y reportes.
                  </p>
                  <div className="op-card-acciones">
                    <button
                      type="button"
                      className="op-btn op-btn-peligro"
                      disabled={procesando}
                      onClick={handleConfirmarFinalizarProyecto}
                    >
                      {procesando
                        ? "Cerrando proyecto..."
                        : "Confirmar cierre del proyecto"}
                    </button>
                    <button
                      type="button"
                      className="op-btn op-btn-secundario"
                      onClick={() => setProyectoPorFinalizar(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                </section>
              )}

              <div className="op-lista-grid">
                {proyectos.map((proyecto) => {
                  const participacionesProyecto = asignaciones.filter(
                    (a) => Number(a.idProyecto) === Number(proyecto.idProyecto)
                  );
                  const activasProyecto = participacionesProyecto.filter(
                    (a) => a.activo
                  );

                  return (
                    <article key={proyecto.idProyecto} className="op-card">
                      <div className="op-card-header">
                        <div>
                          <span
                            style={{
                              fontSize: "12px",
                              color: "#5d705e",
                              fontWeight: 700
                            }}
                          >
                            {proyecto.codigo} · Versión {proyecto.version}
                          </span>
                          <h4 className="op-card-titulo">{proyecto.nombre}</h4>
                        </div>
                        <span
                          className={`op-badge ${
                            proyecto.estado === "En curso" ||
                            proyecto.estado === "Planificado"
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
                        <strong>Cliente:</strong> {proyecto.cliente || "—"} ·{" "}
                        <strong>Ubicación:</strong> {proyecto.ubicacion}
                      </p>
                      <p className="op-card-meta">
                        <strong>Período:</strong> {proyecto.fechaInicio} al{" "}
                        {proyecto.fechaFin || "Abierto"}
                      </p>
                      <p className="op-card-meta">
                        <strong>Participaciones:</strong>{" "}
                        {participacionesProyecto.length} registradas (
                        {activasProyecto.length} activas)
                      </p>

                      {/* Vista previa del equipo asignado a este proyecto */}
                      <div
                        style={{
                          background: "#f6f9f3",
                          border: "1px solid #dce4d6",
                          borderRadius: "8px",
                          padding: "10px 12px",
                          marginTop: "4px"
                        }}
                      >
                        <div
                          style={{
                            fontSize: "12px",
                            fontWeight: 700,
                            color: "#27483b",
                            marginBottom: "6px"
                          }}
                        >
                          Equipo asignado al proyecto:
                        </div>
                        {participacionesProyecto.length === 0 ? (
                          <p
                            className="op-ayuda"
                            style={{ margin: 0, fontStyle: "italic" }}
                          >
                            Sin personal asignado todavía. Use «Asignar Personal» para vincular integrantes.
                          </p>
                        ) : (
                          <ul
                            style={{
                              listStyle: "none",
                              padding: 0,
                              margin: 0,
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px"
                            }}
                          >
                            {participacionesProyecto.map((part) => {
                              const personaAsig = personal.find(
                                (per) =>
                                  Number(per.idPasante) ===
                                  Number(part.idPasante)
                              );
                              return (
                                <li
                                  key={part.idAsignacion}
                                  style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: "6px",
                                    paddingBottom: "6px",
                                    borderBottom: "1px dashed #d5dfcf",
                                    fontSize: "13px"
                                  }}
                                >
                                  <div>
                                    <strong>
                                      {personaAsig
                                        ? `${personaAsig.nombres} ${personaAsig.apellidos}`
                                        : `Persona #${part.idPasante}`}
                                    </strong>{" "}
                                    <span style={{ color: "#4b5e4d" }}>
                                      — {part.rol}
                                    </span>
                                    <div
                                      style={{
                                        fontSize: "11px",
                                        color: "#647766"
                                      }}
                                    >
                                      {personaAsig
                                        ? `${personaAsig.tipoContrato} · `
                                        : ""}
                                      {part.fechaInicio} al{" "}
                                      {part.fechaFin || "Abierto"}
                                    </div>
                                  </div>
                                  <span
                                    className={`op-badge ${
                                      part.activo
                                        ? "op-badge-activo"
                                        : "op-badge-cerrado"
                                    }`}
                                    style={{ fontSize: "11px", padding: "3px 8px" }}
                                  >
                                    {part.activo ? "Activa" : "Histórica"}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>

                      <div className="op-card-acciones">
                        {proyecto.estado !== "Finalizado" && (
                          <>
                            <button
                              type="button"
                              className="op-btn op-btn-primario"
                              onClick={() =>
                                abrirNuevaAsignacionParaProyecto(
                                  proyecto.idProyecto
                                )
                              }
                            >
                              Asignar Personal
                            </button>
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
                              onClick={() => setProyectoPorFinalizar(proyecto)}
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
                <h3 style={{ margin: 0 }}>Asignaciones del Equipo</h3>
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
                  const pry = proyectos.find(
                    (p) => Number(p.idProyecto) === Number(asig.idProyecto)
                  );
                  const per = personal.find(
                    (p) => Number(p.idPasante) === Number(asig.idPasante)
                  );

                  return (
                    <article key={asig.idAsignacion} className="op-card">
                      <div className="op-card-header">
                        <div>
                          <span
                            style={{
                              fontSize: "12px",
                              color: "#5d705e",
                              fontWeight: 700
                            }}
                          >
                            Asignación #{asig.idAsignacion} · Versión {asig.version}
                          </span>
                          <h4 className="op-card-titulo">
                            {per
                              ? `${per.nombres} ${per.apellidos}`
                              : `Persona #${asig.idPasante}`}
                          </h4>
                        </div>
                        <div className="op-badges">
                          {per && (
                            <span
                              className={`op-badge ${
                                per.tipoContrato === "Pasante"
                                  ? "op-badge-pasante"
                                  : "op-badge-planta"
                              }`}
                            >
                              {per.tipoContrato}
                            </span>
                          )}
                          <span
                            className={`op-badge ${
                              asig.activo ? "op-badge-activo" : "op-badge-cerrado"
                            }`}
                          >
                            {asig.activo ? "Activa" : "Finalizada"}
                          </span>
                        </div>
                      </div>

                      <p className="op-card-meta">
                        <strong>Proyecto:</strong>{" "}
                        {pry
                          ? `${pry.codigo} · ${pry.nombre}`
                          : `#${asig.idProyecto}`}
                      </p>
                      <p className="op-card-meta">
                        <strong>Función / Rol:</strong> {asig.rol}
                      </p>
                      <p className="op-card-meta">
                        <strong>Período:</strong> {asig.fechaInicio} al{" "}
                        {asig.fechaFin || "Abierto"}
                      </p>

                      {asig.activo && pry?.estado !== "Finalizado" && (
                        <div className="op-card-acciones">
                          <button
                            type="button"
                            className="op-btn op-btn-secundario"
                            onClick={() => {
                              setAsignacionEditando(asig);
                              setFormAsignacionAbierto(true);
                            }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="op-btn op-btn-peligro"
                            disabled={procesando}
                            onClick={() => handleFinalizarAsignacion(asig)}
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
                <h3 style={{ margin: 0 }}>Viáticos y Gastos Adicionales</h3>
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
                  personal={personal}
                  reglas={REGLAS_VIATICOS_VIGENTES}
                  guardando={procesando}
                  alGuardar={handleGuardarViatico}
                  alCancelar={() => {
                    setFormViaticoAbierto(false);
                    setViaticoEditando(null);
                  }}
                />
              )}

              {viaticoPorEliminar && (
                <section
                  className="op-form-panel"
                  aria-labelledby="titulo-eliminar-viatico"
                >
                  <h3 id="titulo-eliminar-viatico" style={{ marginTop: 0 }}>
                    Eliminar Viático #{viaticoPorEliminar.idViatico}
                  </h3>
                  <p className="op-ayuda" style={{ marginBottom: "14px" }}>
                    Esta acción eliminará el registro de viático en el servidor (requiere rol Administrador).
                  </p>
                  <div className="op-card-acciones">
                    <button
                      type="button"
                      className="op-btn op-btn-peligro"
                      disabled={procesando}
                      onClick={handleConfirmarEliminarViatico}
                    >
                      {procesando
                        ? "Eliminando..."
                        : "Confirmar eliminación"}
                    </button>
                    <button
                      type="button"
                      className="op-btn op-btn-secundario"
                      onClick={() => setViaticoPorEliminar(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                </section>
              )}

              <div className="op-lista-grid">
                {viaticos.map((v) => {
                  const per = personal.find(
                    (p) => Number(p.idPasante) === Number(v.idPasante)
                  );
                  const total = importeTotalViatico(v);

                  return (
                    <article key={v.idViatico} className="op-card">
                      <div className="op-card-header">
                        <div>
                          <span
                            style={{
                              fontSize: "12px",
                              color: "#5d705e",
                              fontWeight: 700
                            }}
                          >
                            Viático #{v.idViatico} · {v.fecha}
                          </span>
                          <h4 className="op-card-titulo">
                            Bs {total.toFixed(2)} — {v.concepto}
                          </h4>
                        </div>
                        <span className="op-badge op-badge-activo">
                          Base Bs {Number(v.monto).toFixed(2)}
                        </span>
                      </div>

                      <p className="op-card-meta">
                        <strong>Beneficiario:</strong>{" "}
                        {per
                          ? `[${per.codigo}] ${per.nombres} ${per.apellidos} (${per.tipoContrato})`
                          : `Persona #${v.idPasante}`}
                      </p>
                      <p className="op-card-meta">
                        <strong>Desglose:</strong> Monto base: Bs{" "}
                        {Number(v.monto).toFixed(2)} (máx. 12.00 Bs) · Gasto adicional: Bs{" "}
                        {Number(v.gastoExtra || 0).toFixed(2)}
                      </p>

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
                          onClick={() => setViaticoPorEliminar(v)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {/* PESTAÑA 4: TOTALES, REPORTES Y AUDITORÍA */}
          {pestanaActiva === "totales" && (
            <TotalesReportesPanel
              proyectos={proyectos}
              personal={personal}
              asignaciones={asignaciones}
              viaticos={viaticos}
              auditoria={auditoria}
              rolActual={usuarioActual?.rol || "SuperAdmin"}
            />
          )}
        </>
      )}

      {/* Criterio de aceptación oficial */}
      <div className="aceptacion" style={{ marginTop: "28px" }}>
        <strong>Criterio de aceptación (Módulo 05)</strong>
        <p>
          {modulo?.aceptacion ||
            "Las asignaciones respetan las fechas del proyecto, los viáticos cumplen sus reglas y los totales coinciden con los reportes."}
        </p>
      </div>
      <p className="ruta">
        Código del módulo: src/modules/{modulo?.id || "operaciones"}/
      </p>
    </section>
  );
}