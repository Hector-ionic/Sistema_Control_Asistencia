import React, { useEffect, useMemo, useRef, useState } from "react";
import { modulos } from "../shared/modulos.js";
import Acceso from "./modules/acceso/index.jsx";
import Personal from "./modules/personal/index.jsx";
import Asistencia from "./modules/asistencia/index.jsx";
import Reportes from "./modules/reportes/index.jsx";
import Operaciones from "./modules/operaciones/index.jsx";
import { establecerSesionAccesoMemoria } from "./modules/acceso/services/accesoService.js";
import { establecerTokenMemoria } from "./modules/operaciones/services/operacionesService.js";
import "./dashboard.css";

const pantallas = {
  acceso: Acceso,
  personal: Personal,
  asistencia: Asistencia,
  reportes: Reportes,
  operaciones: Operaciones
};

// Función para obtener fecha actual en formato Bolivia YYYY-MM-DD
function obtenerHoyBolivia() {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/La_Paz",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// Función para formatear hora actual en formato Bolivia HH:mm:ss
function obtenerHoraActualBolivia() {
  try {
    return new Intl.DateTimeFormat("es-BO", {
      timeZone: "America/La_Paz",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(new Date());
  } catch {
    return new Date().toTimeString().slice(0, 8);
  }
}

export default function App() {
  // Sesión en memoria compartida para los 5 módulos
  const [token, setToken] = useState(() => {
    return sessionStorage.getItem("sii_token") || "";
  });
  const [usuario, setUsuario] = useState(() => {
    try {
      const u = sessionStorage.getItem("sii_usuario");
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  });

  // Vista activa: 'general' (Dashboard Principal) o el id de un módulo ('acceso', 'personal', 'asistencia', 'reportes', 'operaciones')
  const [vistaActiva, setVistaActiva] = useState("general");

  // Formulario de login
  const [loginForm, setLoginForm] = useState({ usuario: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [loginCargando, setLoginCargando] = useState(false);

  // Preferencia visual global (Modo Claro / Oscuro en toda la web)
  const [temaOscuro, setTemaOscuro] = useState(() => {
    try {
      return localStorage.getItem("aquapark_theme") === "dark";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof document !== "undefined") {
      if (temaOscuro) {
        document.body.setAttribute("data-theme", "dark");
        document.body.classList.add("sii-tema-oscuro");
      } else {
        document.body.removeAttribute("data-theme");
        document.body.classList.remove("sii-tema-oscuro");
      }
    }
    try {
      localStorage.setItem("aquapark_theme", temaOscuro ? "dark" : "light");
    } catch {}
  }, [temaOscuro]);

  const alternarTemaVisual = () => {
    setTemaOscuro((prev) => !prev);
  };

  // Reloj en tiempo real
  const [reloj, setReloj] = useState(() => obtenerHoraActualBolivia());
  useEffect(() => {
    const t = setInterval(() => setReloj(obtenerHoraActualBolivia()), 1000);
    return () => clearInterval(t);
  }, []);

  // Datos para la Vista General (Asistencia de hoy)
  const [personalLista, setPersonalLista] = useState([]);
  const [resumenHoy, setResumenHoy] = useState([]);
  const [proyectosLista, setProyectosLista] = useState([]);
  const [filtroProyecto, setFiltroProyecto] = useState("TODOS");
  const [busquedaPersonal, setBusquedaPersonal] = useState("");
  const [codigoSeleccionado, setCodigoSeleccionado] = useState("");
  const [sincronizando, setSincronizando] = useState(false);
  const sincronizandoRef = useRef(false);

  // Guardar en sessionStorage para no perder la sesión al recargar la página
  function guardarSesion(nuevoToken, nuevoUsuario) {
    setToken(nuevoToken);
    setUsuario(nuevoUsuario);
    if (nuevoToken && nuevoUsuario) {
      sessionStorage.setItem("sii_token", nuevoToken);
      sessionStorage.setItem("sii_usuario", JSON.stringify(nuevoUsuario));
    } else {
      sessionStorage.removeItem("sii_token");
      sessionStorage.removeItem("sii_usuario");
    }
  }

  function cerrarSesion() {
    guardarSesion("", null);
    setVistaActiva("general");
  }

  // Inicio de sesión global
  async function manejarIniciarSesion(e) {
    if (e) e.preventDefault();
    const u = loginForm.usuario.trim();
    const p = loginForm.password;
    if (!u || !p) {
      setLoginError("Ingrese usuario y contraseña.");
      return;
    }
    setLoginCargando(true);
    setLoginError("");

    try {
      // 1. Obtener token con la operación 'sesion'
      const respSesion = await fetch("/api/backend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operacion: "sesion",
          datos: { usuario: u, password: p }
        })
      });
      const dataSesion = await respSesion.json();
      if (!respSesion.ok || !dataSesion?.accessToken) {
        throw new Error(dataSesion?.mensaje || "Credenciales incorrectas.");
      }

      // 2. Obtener datos del usuario con 'sesion.actual'
      const respActual = await fetch("/api/backend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${dataSesion.accessToken}`
        },
        body: JSON.stringify({ operacion: "sesion.actual", datos: {} })
      });
      const dataActual = await respActual.json();

      const usuarioObj = {
        idUsuario: dataActual?.idUsuario || 1,
        nombreUsuario: dataActual?.nombreUsuario || u,
        rol: dataActual?.rol || "SuperAdmin"
      };

      guardarSesion(dataSesion.accessToken, usuarioObj);
      setLoginForm({ usuario: "", password: "" });
    } catch (err) {
      setLoginError(err.message || "No se pudo iniciar sesión.");
    } finally {
      setLoginCargando(false);
    }
  }

  // Consulta de datos de la Vista General (sincronizada con PostgreSQL)
  async function sincronizarVistaGeneral(tokenActivo = token) {
    if (!tokenActivo || sincronizandoRef.current) return;
    sincronizandoRef.current = true;
    setSincronizando(true);

    try {
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenActivo}`
      };

      const [resPers, resAsist, resProy] = await Promise.all([
        fetch("/api/backend", {
          method: "POST",
          headers,
          body: JSON.stringify({ operacion: "personal.listar", datos: {} })
        }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch("/api/backend", {
          method: "POST",
          headers,
          body: JSON.stringify({ operacion: "asistencia.resumen", datos: {} })
        }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch("/api/backend", {
          method: "POST",
          headers,
          body: JSON.stringify({ operacion: "proyectos.listar", datos: {} })
        }).then((r) => (r.ok ? r.json() : [])).catch(() => [])
      ]);

      const listaP = Array.isArray(resPers) ? resPers : [];
      setPersonalLista(listaP);
      setResumenHoy(Array.isArray(resAsist) ? resAsist : []);
      setProyectosLista(Array.isArray(resProy) ? resProy : []);

      setCodigoSeleccionado((prev) => {
        if (prev && listaP.some((p) => p.codigo === prev)) {
          return prev;
        }
        return "";
      });
    } catch {
      // Ignorar fallos de red puntuales
    } finally {
      sincronizandoRef.current = false;
      setSincronizando(false);
    }
  }

  // Carga inicial y actualización periódica cada 12 segundos para la vista general
  useEffect(() => {
    if (!token || !usuario) return;
    sincronizarVistaGeneral(token);
    const intervalo = setInterval(() => {
      sincronizarVistaGeneral(token);
    }, 12000);
    return () => clearInterval(intervalo);
  }, [token, usuario]);

  // Mapa de asistencia de hoy por código
  const mapaAsistenciaHoy = useMemo(() => {
    const map = new Map();
    for (const a of resumenHoy) {
      if (a?.codigo) map.set(a.codigo, a);
    }
    return map;
  }, [resumenHoy]);

  // Cálculo de contadores KPI de hoy
  const kpisHoy = useMemo(() => {
    let completaron = 0;
    let enCurso = 0;
    let sinRegistro = 0;

    for (const p of personalLista) {
      const asist = mapaAsistenciaHoy.get(p.codigo);
      const tieneEntrada = Boolean(asist?.horaEntrada || asist?.entrada);
      const tieneSalida = Boolean(asist?.horaSalida || asist?.salida);

      if (tieneSalida) {
        completaron++;
      } else if (tieneEntrada) {
        enCurso++;
      } else {
        sinRegistro++;
      }
    }

    return {
      completaron,
      enCurso,
      sinRegistro,
      total: personalLista.length
    };
  }, [personalLista, mapaAsistenciaHoy]);

  // Lista de personal filtrada para la tabla
  const personalFiltrado = useMemo(() => {
    const q = busquedaPersonal.trim().toLowerCase();
    return personalLista.filter((p) => {
      if (filtroProyecto !== "TODOS") {
        if (String(p.idProyecto || "") !== String(filtroProyecto)) {
          return false;
        }
      }
      if (!q) return true;
      const cod = String(p.codigo || "").toLowerCase();
      const nom = `${p.nombres || ""} ${p.apellidos || ""} ${p.nombreCompleto || ""}`.toLowerCase();
      return cod.includes(q) || nom.includes(q);
    });
  }, [personalLista, filtroProyecto, busquedaPersonal]);

  // Persona seleccionada para la ficha izquierda
  const personaSeleccionada = useMemo(() => {
    if (!codigoSeleccionado) return null;
    return personalLista.find((p) => p.codigo === codigoSeleccionado) || null;
  }, [personalLista, codigoSeleccionado]);

  const asistenciaSeleccionada = useMemo(() => {
    if (!personaSeleccionada) return null;
    return mapaAsistenciaHoy.get(personaSeleccionada.codigo) || null;
  }, [personaSeleccionada, mapaAsistenciaHoy]);

  // Determinar saludo según la hora de Bolivia
  const saludoHora = useMemo(() => {
    const horaNum = parseInt(reloj.slice(0, 2), 10) || 12;
    if (horaNum < 12) return "Buenos días";
    if (horaNum < 19) return "Buenas tardes";
    return "Buenas noches";
  }, [reloj]);

  // Si no hay sesión iniciada, mostrar la pantalla de login unificada
  if (!token || !usuario) {
    return (
      <div className="dash-login-wrap">
        <div className="dash-login-card">
          <div className="dash-login-brand">
            <div className="logo-circle">AP</div>
            <h2>Constructora Aqua Park</h2>
            <p>Sistema de Control y Asistencia · Oficina Santiago II</p>
          </div>

          {loginError && <div className="dash-login-error">{loginError}</div>}

          <form className="dash-login-form" onSubmit={manejarIniciarSesion}>
            <div className="dash-login-field">
              <label htmlFor="login-usr">Usuario</label>
              <input
                id="login-usr"
                type="text"
                autoComplete="username"
                placeholder="Ej. carlos.apaza"
                value={loginForm.usuario}
                onChange={(e) =>
                  setLoginForm((p) => ({ ...p, usuario: e.target.value }))
                }
                required
              />
            </div>

            <div className="dash-login-field">
              <label htmlFor="login-pwd">Contraseña</label>
              <input
                id="login-pwd"
                type="password"
                autoComplete="current-password"
                placeholder="Ingrese su contraseña"
                value={loginForm.password}
                onChange={(e) =>
                  setLoginForm((p) => ({ ...p, password: e.target.value }))
                }
                required
              />
            </div>

            <button
              type="submit"
              className="dash-btn-login"
              disabled={loginCargando}
            >
              {loginCargando ? "Iniciando sesión…" : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Componente del módulo seleccionado (si no estamos en 'general')
  const moduloInfo = modulos.find((m) => m.id === vistaActiva);
  const ComponenteModulo = pantallas[vistaActiva];

  return (
    <div className="dash-layout">
      {/* 1. BARRA LATERAL (SIDEBAR) */}
      <aside className="dash-sidebar">
        <div className="dash-brand">
          <div className="dash-brand-icon">AP</div>
          <div className="dash-brand-info">
            <h2>Aqua Park</h2>
            <span>Oficina Santiago II</span>
          </div>
        </div>

        <nav className="dash-nav">
          <span className="dash-nav-section-title">Principal</span>

          <button
            type="button"
            className={`dash-nav-btn ${vistaActiva === "general" ? "activo" : ""}`}
            onClick={() => setVistaActiva("general")}
          >
            <span>Asistencia de hoy</span>
            <span className="badge">{kpisHoy.total}</span>
          </button>

          <span className="dash-nav-section-title" style={{ marginTop: "12px" }}>
            Módulos del Sistema
          </span>

          <button
            type="button"
            className={`dash-nav-btn ${vistaActiva === "personal" ? "activo" : ""}`}
            onClick={() => setVistaActiva("personal")}
          >
            <span>Personal</span>
          </button>

          <button
            type="button"
            className={`dash-nav-btn ${vistaActiva === "asistencia" ? "activo" : ""}`}
            onClick={() => setVistaActiva("asistencia")}
          >
            <span>Asistencia</span>
          </button>

          <button
            type="button"
            className={`dash-nav-btn ${vistaActiva === "reportes" ? "activo" : ""}`}
            onClick={() => setVistaActiva("reportes")}
          >
            <span>Reportes</span>
          </button>

          <button
            type="button"
            className={`dash-nav-btn ${vistaActiva === "operaciones" ? "activo" : ""}`}
            onClick={() => setVistaActiva("operaciones")}
          >
            <span>Proyectos y Viáticos</span>
          </button>

          <button
            type="button"
            className={`dash-nav-btn ${vistaActiva === "acceso" ? "activo" : ""}`}
            onClick={() => setVistaActiva("acceso")}
          >
            <span>Acceso y Configuración</span>
          </button>
        </nav>

        {/* Selector de Preferencia Visual accesible para todos en el menú lateral */}
        <div className="dash-sidebar-theme">
          <span className="dash-sidebar-theme-label">Preferencia visual</span>
          <button
            type="button"
            className="dash-theme-btn"
            onClick={alternarTemaVisual}
            title={temaOscuro ? "Cambiar a Tema Claro" : "Cambiar a Tema Oscuro"}
          >
            <span className="dash-theme-tag">{temaOscuro ? "Oscuro" : "Claro"}</span>
            <span className={`dash-theme-switch ${temaOscuro ? "activo" : ""}`}>
              <span className="dash-theme-switch-thumb" />
            </span>
          </button>
        </div>

        <div className="dash-sidebar-footer">
          <div className="dash-user-info">
            <span className="dash-user-name">{usuario.nombreUsuario}</span>
            <span className="dash-user-role">{usuario.rol}</span>
          </div>
          <button
            type="button"
            className="dash-btn-logout"
            onClick={cerrarSesion}
            title="Cerrar sesión"
          >
            Salir
          </button>
        </div>
      </aside>

      {/* 2. ÁREA DE CONTENIDO */}
      <div className="dash-content-area">
        {/* Cabecera Superior */}
        <header className="dash-topbar">
          <div className="dash-greeting">
            <h1>
              {saludoHora}, {usuario.nombreUsuario}
              <span style={{ fontSize: "14px", fontWeight: "normal" }}>
                ({usuario.rol})
              </span>
            </h1>
            <span>
              {obtenerHoyBolivia()} · Plataforma Centralizada de Control de Asistencia
            </span>
          </div>

          <div className="dash-topbar-meta">
            <div className="dash-status-pill">
              <span className="dash-status-dot" />
              <span>Conectado al servidor</span>
            </div>
            <div className="dash-clock">{reloj}</div>
          </div>
        </header>

        {/* 3. VISTA GENERAL O MÓDULO ACTIVO */}
        <main className="dash-main-body">
          {vistaActiva === "general" ? (
            <div className="dash-vista-general">
              {/* Tarjetas KPI Superiores */}
              <div className="dash-kpis">
                <div className="dash-kpi-card kpi-completaron">
                  <span className="dash-kpi-label">Completaron jornada</span>
                  <strong className="dash-kpi-value" style={{ color: "#16a34a" }}>
                    {kpisHoy.completaron}
                  </strong>
                  <span className="dash-kpi-sub">Con salida registrada hoy</span>
                </div>

                <div className="dash-kpi-card kpi-en-curso">
                  <span className="dash-kpi-label">En curso</span>
                  <strong className="dash-kpi-value" style={{ color: "#d97706" }}>
                    {kpisHoy.enCurso}
                  </strong>
                  <span className="dash-kpi-sub">En jornada activa o almuerzo</span>
                </div>

                <div className="dash-kpi-card kpi-sin-registro">
                  <span className="dash-kpi-label">Sin registro</span>
                  <strong className="dash-kpi-value" style={{ color: "#dc2626" }}>
                    {kpisHoy.sinRegistro}
                  </strong>
                  <span className="dash-kpi-sub">Pendientes de entrada hoy</span>
                </div>

                <div className="dash-kpi-card kpi-total">
                  <span className="dash-kpi-label">Total personal activo</span>
                  <strong className="dash-kpi-value" style={{ color: "#0284c7" }}>
                    {kpisHoy.total}
                  </strong>
                  <span className="dash-kpi-sub">En la sede Santiago II</span>
                </div>
              </div>

              {/* Grilla Principal: Ficha Izquierda + Tabla Derecha */}
              <div className="dash-grid-hoy">
                {/* Panel Izquierdo: Ficha Rápida del Trabajador */}
                <div className="dash-panel-izq">
                  <h3>Ficha del Trabajador</h3>

                  <div>
                    <label
                      htmlFor="select-persona-dash"
                      style={{
                        fontSize: "11px",
                        fontWeight: "700",
                        color: "#64748b",
                        display: "block",
                        marginBottom: "4px"
                      }}
                    >
                      Seleccionar personal
                    </label>
                    <select
                      id="select-persona-dash"
                      className="dash-select-filtro"
                      style={{ width: "100%" }}
                      value={codigoSeleccionado}
                      onChange={(e) => setCodigoSeleccionado(e.target.value)}
                    >
                      <option value="">Seleccionar personal</option>
                      {personalLista.map((p) => (
                        <option key={p.codigo} value={p.codigo}>
                          {p.codigo} — {p.nombres} {p.apellidos}
                        </option>
                      ))}
                    </select>
                  </div>

                  {personaSeleccionada ? (
                    <div className="dash-ficha-persona">
                      <div className="dash-ficha-codigo">
                        {personaSeleccionada.codigo}
                      </div>
                      <div className="dash-ficha-nombre">
                        {personaSeleccionada.nombres}{" "}
                        {personaSeleccionada.apellidos}
                      </div>
                      <div className="dash-ficha-detalle">
                        Tipo: <strong>{personaSeleccionada.tipoContrato || "Pasante"}</strong> ·{" "}
                        Turno: {personaSeleccionada.turno || "Tiempo Completo"}
                      </div>
                      <div className="dash-ficha-detalle">
                        Área: {personaSeleccionada.departamento || "General"}
                      </div>

                      <div className="dash-ficha-estado">
                        <span
                          className={`dash-badge-estado ${
                            asistenciaSeleccionada?.horaSalida
                              ? "completado"
                              : asistenciaSeleccionada?.horaEntrada
                              ? "en-curso"
                              : "sin-registro"
                          }`}
                        >
                          {asistenciaSeleccionada?.horaSalida
                            ? "Jornada completada ✓"
                            : asistenciaSeleccionada?.horaEntrada
                            ? "En jornada activa"
                            : "Sin registro hoy"}
                        </span>
                      </div>

                      <div className="dash-ficha-horarios">
                        <div className="dash-horario-box">
                          <small>Entrada hoy</small>
                          <strong>
                            {asistenciaSeleccionada?.horaEntrada
                              ? String(asistenciaSeleccionada.horaEntrada).slice(0, 8)
                              : "—"}
                          </strong>
                        </div>
                        <div className="dash-horario-box">
                          <small>Salida hoy</small>
                          <strong>
                            {asistenciaSeleccionada?.horaSalida
                              ? String(asistenciaSeleccionada.horaSalida).slice(0, 8)
                              : "—"}
                          </strong>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="dash-btn-accion-tabla"
                        style={{ marginTop: "8px", padding: "9px" }}
                        onClick={() => setVistaActiva("asistencia")}
                      >
                        Gestionar marcación en Asistencia →
                      </button>
                    </div>
                  ) : (
                    <div className="dash-ficha-vacia" style={{ textAlign: "center", padding: "40px 16px", color: "var(--dash-text-muted)" }}>
                      <p style={{ margin: "0 0 6px 0", fontWeight: "700", fontSize: "14px", color: "var(--dash-text-main)" }}>Seleccionar personal</p>
                      <span style={{ fontSize: "12px" }}>Seleccione a una persona en el menú desplegable o en la lista de hoy para ver su ficha y estado.</span>
                    </div>
                  )}
                </div>

                {/* Panel Derecho: Lista Personal de Hoy */}
                <div className="dash-panel-der">
                  <div className="dash-der-cabecera">
                    <h3>Personal de hoy</h3>

                    <div className="dash-der-filtros">
                      <select
                        className="dash-select-filtro"
                        value={filtroProyecto}
                        onChange={(e) => setFiltroProyecto(e.target.value)}
                      >
                        <option value="TODOS">TODOS - Todos los proyectos</option>
                        {proyectosLista.map((pry) => (
                          <option key={pry.idProyecto} value={pry.idProyecto}>
                            {pry.codigo} · {pry.nombre}
                          </option>
                        ))}
                      </select>

                      <input
                        type="search"
                        className="dash-input-filtro"
                        placeholder="Buscar por nombre o código…"
                        value={busquedaPersonal}
                        onChange={(e) => setBusquedaPersonal(e.target.value)}
                      />

                      <button
                        type="button"
                        className="dash-btn-accion-tabla"
                        disabled={sincronizando}
                        onClick={() => sincronizarVistaGeneral(token)}
                      >
                        {sincronizando ? "Sincronizando…" : "Actualizar"}
                      </button>
                    </div>
                  </div>

                  <div className="dash-tabla-contenedor">
                    <table className="dash-tabla">
                      <thead>
                        <tr>
                          <th>Personal</th>
                          <th>Entrada</th>
                          <th>Salida</th>
                          <th>Estado</th>
                          <th>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {personalFiltrado.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ textAlign: "center", padding: "24px" }}>
                              No se encontraron registros de personal.
                            </td>
                          </tr>
                        ) : (
                          personalFiltrado.map((p) => {
                            const asist = mapaAsistenciaHoy.get(p.codigo);
                            const tieneEntrada = Boolean(asist?.horaEntrada);
                            const tieneSalida = Boolean(asist?.horaSalida);
                            const esSeleccionado = p.codigo === codigoSeleccionado;

                            let estadoTexto = "Sin Registro";
                            let estadoClase = "sin-registro";

                            if (tieneSalida) {
                              estadoTexto = "Completado";
                              estadoClase = "completado";
                            } else if (tieneEntrada) {
                              estadoTexto = "En curso";
                              estadoClase = "en-curso";
                            }

                            return (
                              <tr
                                key={p.codigo}
                                className={esSeleccionado ? "fila-activa" : ""}
                                onClick={() => setCodigoSeleccionado(p.codigo)}
                                style={{ cursor: "pointer" }}
                              >
                                <td>
                                  <strong>{p.codigo}</strong> · {p.nombres}{" "}
                                  {p.apellidos}
                                </td>
                                <td>
                                  {asist?.horaEntrada
                                    ? String(asist.horaEntrada).slice(0, 8)
                                    : "—"}
                                </td>
                                <td>
                                  {asist?.horaSalida
                                    ? String(asist.horaSalida).slice(0, 8)
                                    : "—"}
                                </td>
                                <td>
                                  <span
                                    className={`dash-badge-estado ${estadoClase}`}
                                  >
                                    {estadoTexto}
                                  </span>
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="dash-btn-accion-tabla"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCodigoSeleccionado(p.codigo);
                                      setVistaActiva("asistencia");
                                    }}
                                  >
                                    Ver en Asistencia
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              {/* Botón para volver al Dashboard General */}
              <div style={{ marginBottom: "16px" }}>
                <button
                  type="button"
                  className="dash-btn-accion-tabla"
                  style={{
                    padding: "8px 14px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                  onClick={() => setVistaActiva("general")}
                >
                  ← Volver a Asistencia de hoy (Dashboard General)
                </button>
              </div>

              {/* Render del módulo correspondiente heredando token y usuario */}
              {ComponenteModulo && (
                <ComponenteModulo
                  modulo={moduloInfo}
                  token={token}
                  usuario={usuario}
                />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
