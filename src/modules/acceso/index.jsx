// src/modules/acceso/index.jsx
import React, { useEffect, useState } from "react";
import "./styles/acceso.css";
import { DESCRIPCION_ROLES, ROLES_VALIDOS } from "./mocks/datosPruebaAcceso.js";
import { validarRegistroEncargado } from "./utils/reglasAcceso.js";
import {
  ejecutarOperacionModulo01,
  cargarColeccionesModulo01,
  obtenerTokenAccesoMemoria,
  obtenerSesionAccesoMemoria,
  obtenerExpiracionSesionMemoria,
  establecerSesionAccesoMemoria,
  cerrarSesionAccesoMemoria,
  forzarVencimientoSesionMemoria,
  reiniciarMemoriaSimuladaAcceso
} from "./services/accesoService.js";
import UsuarioForm from "./components/UsuarioForm.jsx";
import ConfiguracionForm from "./components/ConfiguracionForm.jsx";
import DepartamentoForm from "./components/DepartamentoForm.jsx";

export default function Acceso({ modulo }) {
  const [pestanaActiva, setPestanaActiva] = useState("cuentas");

  // Modo de conexión (/api/backend real vs simulador de contrato en memoria)
  const [usarContratoMemoria, setUsarContratoMemoria] = useState(false);
  const [modoRed, setModoRed] = useState("normal");
  const [estadoBackend, setEstadoBackend] = useState(
    "Verificando conexión con el backend..."
  );

  // Sesión exclusivamente en memoria (sin localStorage ni x-rol-usuario)
  const [tokenSesion, setTokenSesion] = useState(() => obtenerTokenAccesoMemoria());
  const [usuarioActual, setUsuarioActual] = useState(() => obtenerSesionAccesoMemoria());
  const [expiracionMs, setExpiracionMs] = useState(() => obtenerExpiracionSesionMemoria());

  // Modo del panel de acceso inicial: login ('ingreso') o autorregistro ('registro-encargado')
  const [modoFormularioAcceso, setModoFormularioAcceso] = useState("ingreso");
  const [credencialesLogin, setCredencialesLogin] = useState({
    usuario: "",
    password: ""
  });
  const [formRegistroEncargado, setFormRegistroEncargado] = useState({
    usuario: "",
    password: "",
    confirmarPassword: ""
  });
  const [erroresRegistro, setErroresRegistro] = useState({});

  const [cargando, setCargando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [aviso, setAviso] = useState(null);

  // Colecciones del Módulo 01
  const [usuarios, setUsuarios] = useState([]);
  const [configuracion, setConfiguracion] = useState(null);
  const temaOscuroActivo = Boolean(configuracion?.temaOscuro);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.classList.toggle("sii-tema-oscuro", temaOscuroActivo);
    }
    return () => {
      if (typeof document !== "undefined") {
        document.body.classList.remove("sii-tema-oscuro");
      }
    };
  }, [temaOscuroActivo]);
  const [departamentos, setDepartamentos] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [auditoria, setAuditoria] = useState([]);

  // Filtros de búsqueda
  const [busquedaUsuario, setBusquedaUsuario] = useState("");
  const [filtroRolUsuario, setFiltroRolUsuario] = useState("TODOS");
  const [filtroEstadoUsuario, setFiltroEstadoUsuario] = useState("TODOS");
  const [busquedaAuditoria, setBusquedaAuditoria] = useState("");

  // Formularios y confirmaciones en línea
  const [formUsuarioAbierto, setFormUsuarioAbierto] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [usuarioPorEliminar, setUsuarioPorEliminar] = useState(null);

  const [formDepartamentoAbierto, setFormDepartamentoAbierto] = useState(false);
  const [departamentoEditando, setDepartamentoEditando] = useState(null);
  const [departamentoPorEliminar, setDepartamentoPorEliminar] = useState(null);

  // Comprobar disponibilidad de GET /api/backend al montar
  useEffect(() => {
    let activo = true;
    async function verificarContratoBackend() {
      let usarMem = true;
      try {
        const res = await fetch("/api/backend", {
          method: "GET",
          cache: "no-store"
        });
        if (!activo) return;
        if (res.ok) {
          usarMem = false;
          setUsarContratoMemoria(false);
          setEstadoBackend("Conectado al servidor");
        } else {
          setUsarContratoMemoria(true);
          setEstadoBackend("Modo de prueba en memoria activo");
        }
      } catch {
        if (!activo) return;
        setUsarContratoMemoria(true);
        setEstadoBackend("Modo de prueba en memoria activo");
      }

      const tokenExistente = obtenerTokenAccesoMemoria();
      if (activo && tokenExistente) {
        setTokenSesion(tokenExistente);
        setUsuarioActual(obtenerSesionAccesoMemoria());
        setExpiracionMs(obtenerExpiracionSesionMemoria());
        await recargarColecciones(usarMem, "normal");
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
      const datos = await cargarColeccionesModulo01({
        usarContratoMemoria: forzarMemoria,
        modoRed: red
      });
      setUsuarios(datos.usuarios);
      setConfiguracion(datos.configuracion);
      setDepartamentos(datos.departamentos);
      setMarcas(datos.marcas);
      setAuditoria(datos.auditoria);
    } catch (error) {
      await manejarErrorOperacion(error);
    } finally {
      setCargando(false);
    }
  };

  const manejarErrorOperacion = async (error) => {
    if (error.status === 401) {
      cerrarSesionAccesoMemoria();
      setTokenSesion("");
      setUsuarioActual(null);
      setExpiracionMs(0);
      setAviso({
        tipo: "error",
        texto:
          error.message ||
          "Sesión requerida o vencida. Vuelva a iniciar sesión para continuar."
      });
      return;
    }
    setAviso({
      tipo: "error",
      texto: error.message || "No se pudo completar la operación."
    });
  };

  // --- 1. Inicio de sesión (`sesion` + `sesion.actual`) ---
  const handleIniciarSesion = async (e) => {
    e.preventDefault();
    setProcesando(true);
    setAviso(null);
    try {
      const respSesion = await ejecutarOperacionModulo01(
        "sesion",
        {
          usuario: credencialesLogin.usuario,
          password: credencialesLogin.password
        },
        { usarContratoMemoria, modoRed }
      );

      const nuevoToken = respSesion.accessToken;
      const segundosVigencia = Number(respSesion.expiresIn || 28800);
      establecerSesionAccesoMemoria(nuevoToken, null, segundosVigencia);
      setTokenSesion(nuevoToken);

      const perfil = await ejecutarOperacionModulo01(
        "sesion.actual",
        {},
        { usarContratoMemoria, modoRed }
      );
      establecerSesionAccesoMemoria(nuevoToken, perfil, segundosVigencia);
      setUsuarioActual(perfil);
      setExpiracionMs(obtenerExpiracionSesionMemoria());

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

  // --- 2. Autorregistro público de Encargado (`registro-encargado`) ---
  const handleRegistrarEncargado = async (e) => {
    e.preventDefault();
    setErroresRegistro({});
    setAviso(null);

    const validacion = validarRegistroEncargado(formRegistroEncargado, usuarios);
    if (!validacion.valido) {
      setErroresRegistro(validacion.errores);
      return;
    }

    setProcesando(true);
    try {
      await ejecutarOperacionModulo01(
        "registro-encargado",
        validacion.datosNormalizados,
        { usarContratoMemoria, modoRed }
      );
      setCredencialesLogin({
        usuario: validacion.datosNormalizados.usuario,
        password: validacion.datosNormalizados.password
      });
      setFormRegistroEncargado({
        usuario: "",
        password: "",
        confirmarPassword: ""
      });
      setModoFormularioAcceso("ingreso");
      setAviso({
        tipo: "exito",
        texto: `Cuenta de encargado '${validacion.datosNormalizados.usuario}' registrada correctamente. Ya puede iniciar sesión.`
      });
    } catch (error) {
      setAviso({
        tipo: "error",
        texto: error.message || "No se pudo registrar la cuenta de encargado."
      });
    } finally {
      setProcesando(false);
    }
  };

  // --- 3. Cierre y vencimiento de sesión ---
  const handleCerrarSesion = () => {
    cerrarSesionAccesoMemoria();
    setTokenSesion("");
    setUsuarioActual(null);
    setExpiracionMs(0);
    setUsuarios([]);
    setDepartamentos([]);
    setMarcas([]);
    setAuditoria([]);
    setAviso({
      tipo: "info",
      texto: "Sesión cerrada correctamente."
    });
  };

  const handleSimularVencimientoSesion = async () => {
    forzarVencimientoSesionMemoria();
    try {
      await ejecutarOperacionModulo01(
        "sesion.actual",
        {},
        { usarContratoMemoria, modoRed }
      );
    } catch (error) {
      await manejarErrorOperacion(error);
    }
  };

  // --- 4. Administración de cuentas (`usuarios.guardar` / `usuarios.eliminar`) ---
  const handleGuardarUsuario = async (payloadGuardar) => {
    setProcesando(true);
    setAviso(null);
    try {
      const guardado = await ejecutarOperacionModulo01(
        "usuarios.guardar",
        payloadGuardar,
        { usarContratoMemoria, modoRed }
      );
      await recargarColecciones();
      setFormUsuarioAbierto(false);
      setUsuarioEditando(null);
      setAviso({
        tipo: "exito",
        texto:
          payloadGuardar.usuario.idUsuario > 0
            ? `Cuenta '${guardado.nombreUsuario}' actualizada correctamente.`
            : `Cuenta '${guardado.nombreUsuario}' (${guardado.rol}) creada correctamente.`
      });
    } catch (error) {
      await manejarErrorOperacion(error);
    } finally {
      setProcesando(false);
    }
  };

  const handleAlternarActivacionUsuario = async (cuenta) => {
    setProcesando(true);
    setAviso(null);
    try {
      const nuevoEstado = !cuenta.activo;
      await ejecutarOperacionModulo01(
        "usuarios.guardar",
        {
          usuario: {
            ...cuenta,
            activo: nuevoEstado
          },
          password: ""
        },
        { usarContratoMemoria, modoRed }
      );
      await recargarColecciones();
      setAviso({
        tipo: "exito",
        texto: `Cuenta '${cuenta.nombreUsuario}' ${
          nuevoEstado ? "activada" : "desactivada"
        } correctamente.`
      });
    } catch (error) {
      await manejarErrorOperacion(error);
    } finally {
      setProcesando(false);
    }
  };

  const handleConfirmarEliminarUsuario = async () => {
    if (!usuarioPorEliminar) return;
    setProcesando(true);
    setAviso(null);
    try {
      await ejecutarOperacionModulo01(
        "usuarios.eliminar",
        { id: usuarioPorEliminar.idUsuario },
        { usarContratoMemoria, modoRed }
      );
      const nombreEliminado = usuarioPorEliminar.nombreUsuario;
      setUsuarioPorEliminar(null);
      await recargarColecciones();
      setAviso({
        tipo: "exito",
        texto: `Cuenta '${nombreEliminado}' eliminada del sistema.`
      });
    } catch (error) {
      await manejarErrorOperacion(error);
    } finally {
      setProcesando(false);
    }
  };

  // --- 5. Configuración global (`configuracion.guardar`) ---
  const handleGuardarConfiguracion = async (payloadConfig) => {
    setProcesando(true);
    setAviso(null);
    try {
      const guardada = await ejecutarOperacionModulo01(
        "configuracion.guardar",
        payloadConfig,
        { usarContratoMemoria, modoRed }
      );
      setConfiguracion(guardada);
      await recargarColecciones();
      setAviso({
        tipo: "exito",
        texto: `Configuración institucional actualizada (${guardada.horaEntradaEsperada} a ${guardada.horaSalidaEsperada}, tolerancia ${guardada.toleranciaMinutos} min).`
      });
    } catch (error) {
      await manejarErrorOperacion(error);
    } finally {
      setProcesando(false);
    }
  };

  // --- 6. Áreas y Departamentos (`departamentos.guardar` / `departamentos.eliminar`) ---
  const handleGuardarDepartamento = async (payloadDep) => {
    setProcesando(true);
    setAviso(null);
    try {
      const guardado = await ejecutarOperacionModulo01(
        "departamentos.guardar",
        payloadDep,
        { usarContratoMemoria, modoRed }
      );
      await recargarColecciones();
      setFormDepartamentoAbierto(false);
      setDepartamentoEditando(null);
      setAviso({
        tipo: "exito",
        texto:
          payloadDep.idDepartamento > 0
            ? `Área '${guardado.nombre}' actualizada correctamente.`
            : `Área '${guardado.nombre}' registrada correctamente.`
      });
    } catch (error) {
      await manejarErrorOperacion(error);
    } finally {
      setProcesando(false);
    }
  };

  const handleConfirmarEliminarDepartamento = async () => {
    if (!departamentoPorEliminar) return;
    setProcesando(true);
    setAviso(null);
    try {
      await ejecutarOperacionModulo01(
        "departamentos.eliminar",
        { id: departamentoPorEliminar.idDepartamento },
        { usarContratoMemoria, modoRed }
      );
      const nombreArea = departamentoPorEliminar.nombre;
      setDepartamentoPorEliminar(null);
      await recargarColecciones();
      setAviso({
        tipo: "exito",
        texto: `Área '${nombreArea}' eliminada correctamente.`
      });
    } catch (error) {
      setDepartamentoPorEliminar(null);
      await manejarErrorOperacion(error);
    } finally {
      setProcesando(false);
    }
  };

  const rolActual = usuarioActual?.rol || "Encargado";
  const esSuperAdmin = rolActual === "SuperAdmin";
  const esAdminOSuper = rolActual === "SuperAdmin" || rolActual === "Admin";

  const usuariosFiltrados = usuarios.filter((u) => {
    const coincideTexto = String(u.nombreUsuario || "")
      .toLowerCase()
      .includes(busquedaUsuario.trim().toLowerCase());
    const coincideRol =
      filtroRolUsuario === "TODOS" || u.rol === filtroRolUsuario;
    const coincideEstado =
      filtroEstadoUsuario === "TODOS" ||
      (filtroEstadoUsuario === "ACTIVOS" ? u.activo : !u.activo);
    return coincideTexto && coincideRol && coincideEstado;
  });

  const auditoriaFiltrada = auditoria.filter((ev) => {
    if (!busquedaAuditoria.trim()) return true;
    const q = busquedaAuditoria.trim().toLowerCase();
    return (
      String(ev.usuario || "").toLowerCase().includes(q) ||
      String(ev.accion || "").toLowerCase().includes(q) ||
      String(ev.detalle || "").toLowerCase().includes(q)
    );
  });

  const totalCuentasActivas = usuarios.filter((u) => u.activo).length;
  const totalSuperAdmins = usuarios.filter((u) => u.rol === "SuperAdmin" && u.activo).length;

  const badgeRol = (rol) => {
    if (rol === "SuperAdmin") return "acc-badge acc-badge-superadmin";
    if (rol === "Admin") return "acc-badge acc-badge-admin";
    return "acc-badge acc-badge-encargado";
  };

  return (
    <div className={`acc-contenedor ${temaOscuroActivo ? "acc-tema-oscuro" : ""}`}>
      {/* Encabezado del Módulo 01 */}
      <div className="acc-encabezado">
        <div className="acc-titulo-fila">
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>
              Módulo {modulo?.numero || "01"}
            </p>
            <h2 style={{ margin: "4px 0 0 0" }}>
              {modulo?.titulo || "Acceso y administración"}
            </h2>
          </div>

          <div className="acc-badges-estado">
            <span className="acc-badge acc-badge-activo">{estadoBackend}</span>
            {usuarioActual ? (
              <span className={badgeRol(usuarioActual.rol)}>
                Sesión: {usuarioActual.nombreUsuario} ({usuarioActual.rol})
              </span>
            ) : (
              <span className="acc-badge acc-badge-neutral">
                Sin sesión iniciada
              </span>
            )}
          </div>
        </div>
        <p style={{ margin: 0, color: "#495a50" }}>
          {modulo?.descripcion ||
            "Cuentas, sesiones, permisos, áreas, marcas, horarios predeterminados y auditoría del sistema."}
        </p>
      </div>

      {/* Barra de configuración de conexión y sesión */}
      <div
        className="acc-barra-contexto acc-no-print"
        aria-label="Configuración de conexión y sesión"
      >
        <div className="acc-contexto-item">
          <label htmlFor="acc-modo-contrato">Modo de conexión</label>
          <select
            id="acc-modo-contrato"
            className="acc-select"
            value={usarContratoMemoria ? "memoria" : "backend"}
            onChange={(e) => {
              const usarMem = e.target.value === "memoria";
              setUsarContratoMemoria(usarMem);
              setEstadoBackend(
                usarMem
                  ? "Modo de prueba en memoria activo"
                  : "Conectado al servidor"
              );
            }}
          >
            <option value="backend">
              Servidor real (/api/backend · API C# + Base de datos)
            </option>
            <option value="memoria">
              Modo de prueba en memoria
            </option>
          </select>
        </div>

        <div className="acc-contexto-item">
          <label htmlFor="acc-selector-red">Estado de red (Prueba móvil)</label>
          <select
            id="acc-selector-red"
            className="acc-select"
            value={modoRed}
            onChange={(e) => setModoRed(e.target.value)}
          >
            <option value="normal">Conexión normal</option>
            <option value="lenta">Conexión lenta (verificar carga)</option>
            <option value="error">Simular fallo de red</option>
          </select>
        </div>

        <div className="acc-contexto-item">
          <label>Control de sesión</label>
          {tokenSesion ? (
            <div className="acc-acciones-fila">
              <button
                type="button"
                className="acc-btn acc-btn-secundario"
                onClick={handleSimularVencimientoSesion}
                title="Simula que el token venció para comprobar que el sistema vuelve al ingreso"
              >
                Simular sesión vencida
              </button>
              <button
                type="button"
                className="acc-btn acc-btn-peligro"
                onClick={handleCerrarSesion}
              >
                Cerrar sesión
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="acc-btn acc-btn-secundario"
              onClick={() => {
                reiniciarMemoriaSimuladaAcceso();
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

      {/* Mensajes de estado y alertas */}
      {cargando && (
        <div className="acc-alerta acc-alerta-info" role="status">
          <span>Cargando cuentas, configuración, áreas y auditoría...</span>
        </div>
      )}

      {aviso && (
        <div
          className={`acc-alerta ${
            aviso.tipo === "error"
              ? "acc-alerta-error"
              : aviso.tipo === "exito"
              ? "acc-alerta-exito"
              : "acc-alerta-info"
          }`}
          role="alert"
        >
          <span>{aviso.texto}</span>
          <button
            type="button"
            className="acc-btn acc-btn-secundario"
            onClick={() => setAviso(null)}
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Si no hay sesión activa, mostrar inicio de sesión o autorregistro de encargado */}
      {!tokenSesion ? (
        <section
          className="acc-form-panel"
          aria-labelledby="titulo-acceso-m01"
        >
          <div className="acc-panel-header">
            <div>
              <h3 id="titulo-acceso-m01" style={{ margin: 0 }}>
                {modoFormularioAcceso === "ingreso"
                  ? "Iniciar sesión en el sistema"
                  : "Crear cuenta de operador / encargado"}
              </h3>
              <p className="acc-ayuda" style={{ marginTop: "4px" }}>
                {modoFormularioAcceso === "ingreso" ? (
                  <>
                    Ingrese sus credenciales para acceder a la administración. (En modo de prueba puede ingresar con <strong>superadmin</strong>, <strong>admin</strong> o <strong>encargado</strong>).
                  </>
                ) : (
                  "El autorregistro público crea una cuenta con rol Encargado. Los administradores son designados por el SuperAdmin."
                )}
              </p>
            </div>

            <button
              type="button"
              className="acc-btn acc-btn-secundario"
              onClick={() => {
                setAviso(null);
                setErroresRegistro({});
                setModoFormularioAcceso((prev) =>
                  prev === "ingreso" ? "registro-encargado" : "ingreso"
                );
              }}
            >
              {modoFormularioAcceso === "ingreso"
                ? "Crear cuenta de encargado"
                : "Volver al inicio de sesión"}
            </button>
          </div>

          {modoFormularioAcceso === "ingreso" ? (
            <form onSubmit={handleIniciarSesion}>
              <div className="acc-form-grid">
                <div className="acc-campo">
                  <label className="acc-label" htmlFor="m01-login-usuario">
                    Usuario *
                  </label>
                  <input
                    id="m01-login-usuario"
                    type="text"
                    className="acc-input"
                    value={credencialesLogin.usuario}
                    onChange={(e) =>
                      setCredencialesLogin((prev) => ({
                        ...prev,
                        usuario: e.target.value
                      }))
                    }
                    autoComplete="username"
                    maxLength={50}
                    required
                  />
                </div>

                <div className="acc-campo">
                  <label className="acc-label" htmlFor="m01-login-password">
                    Contraseña *
                  </label>
                  <input
                    id="m01-login-password"
                    type="password"
                    className="acc-input"
                    value={credencialesLogin.password}
                    onChange={(e) =>
                      setCredencialesLogin((prev) => ({
                        ...prev,
                        password: e.target.value
                      }))
                    }
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>

              <div className="acc-acciones-fila" style={{ marginTop: "16px" }}>
                <button
                  type="submit"
                  className="acc-btn acc-btn-primario"
                  disabled={procesando}
                >
                  {procesando ? "Verificando acceso..." : "Ingresar al sistema"}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegistrarEncargado} noValidate>
              <div className="acc-form-grid">
                <div className="acc-campo">
                  <label className="acc-label" htmlFor="m01-reg-usuario">
                    Nuevo usuario (Encargado) *
                  </label>
                  <input
                    id="m01-reg-usuario"
                    type="text"
                    className="acc-input"
                    placeholder="Ej. encargado.turno1"
                    value={formRegistroEncargado.usuario}
                    onChange={(e) =>
                      setFormRegistroEncargado((prev) => ({
                        ...prev,
                        usuario: e.target.value
                      }))
                    }
                    maxLength={50}
                    aria-invalid={Boolean(erroresRegistro.usuario)}
                    required
                  />
                  {erroresRegistro.usuario && (
                    <span className="acc-error-campo" role="alert">
                      {erroresRegistro.usuario}
                    </span>
                  )}
                </div>

                <div className="acc-campo">
                  <label className="acc-label" htmlFor="m01-reg-password">
                    Contraseña (mínimo 8 caracteres) *
                  </label>
                  <input
                    id="m01-reg-password"
                    type="password"
                    className="acc-input"
                    value={formRegistroEncargado.password}
                    onChange={(e) =>
                      setFormRegistroEncargado((prev) => ({
                        ...prev,
                        password: e.target.value
                      }))
                    }
                    aria-invalid={Boolean(erroresRegistro.password)}
                    required
                  />
                  {erroresRegistro.password && (
                    <span className="acc-error-campo" role="alert">
                      {erroresRegistro.password}
                    </span>
                  )}
                </div>

                <div className="acc-campo">
                  <label className="acc-label" htmlFor="m01-reg-confirmar">
                    Confirmar contraseña *
                  </label>
                  <input
                    id="m01-reg-confirmar"
                    type="password"
                    className="acc-input"
                    value={formRegistroEncargado.confirmarPassword}
                    onChange={(e) =>
                      setFormRegistroEncargado((prev) => ({
                        ...prev,
                        confirmarPassword: e.target.value
                      }))
                    }
                    aria-invalid={Boolean(erroresRegistro.confirmarPassword)}
                    required
                  />
                  {erroresRegistro.confirmarPassword && (
                    <span className="acc-error-campo" role="alert">
                      {erroresRegistro.confirmarPassword}
                    </span>
                  )}
                </div>
              </div>

              <div className="acc-acciones-fila" style={{ marginTop: "16px" }}>
                <button
                  type="submit"
                  className="acc-btn acc-btn-primario"
                  disabled={procesando}
                >
                  {procesando
                    ? "Creando cuenta..."
                    : "Registrar cuenta de encargado"}
                </button>
              </div>
            </form>
          )}
        </section>
      ) : (
        <>
          {/* KPIs del Módulo 01 */}
          <div className="acc-kpis">
            <div className="acc-kpi-card">
              <span className="acc-kpi-etiqueta">Sesión y Rol Activo</span>
              <strong className="acc-kpi-valor">{usuarioActual?.rol}</strong>
              <span className="acc-kpi-sub">
                Usuario: {usuarioActual?.nombreUsuario}
                {expiracionMs > 0 &&
                  ` · Vigente hasta ${new Date(expiracionMs).toLocaleTimeString(
                    "es-BO",
                    { hour: "2-digit", minute: "2-digit" }
                  )}`}
              </span>
            </div>

            <div className="acc-kpi-card">
              <span className="acc-kpi-etiqueta">Cuentas Activas</span>
              <strong className="acc-kpi-valor">
                {esAdminOSuper ? `${totalCuentasActivas} / ${usuarios.length}` : "Protegido"}
              </strong>
              <span className="acc-kpi-sub">
                {esAdminOSuper
                  ? `${totalSuperAdmins} SuperAdmin activos`
                  : "Visible para Admin y SuperAdmin"}
              </span>
            </div>

            <div className="acc-kpi-card">
              <span className="acc-kpi-etiqueta">Horario Predeterminado</span>
              <strong className="acc-kpi-valor">
                {String(configuracion?.horaEntradaEsperada || "08:00:00").slice(0, 5)} -{" "}
                {String(configuracion?.horaSalidaEsperada || "18:30:00").slice(0, 5)}
              </strong>
              <span className="acc-kpi-sub">
                Tolerancia: {configuracion?.toleranciaMinutos ?? 20} min ·{" "}
                {configuracion?.nombreInstitucion || "Oficina Santiago II"}
              </span>
            </div>

            <div className="acc-kpi-card">
              <span className="acc-kpi-etiqueta">Áreas y Marcas</span>
              <strong className="acc-kpi-valor">
                {departamentos.length} áreas · {marcas.length} marcas
              </strong>
              <span className="acc-kpi-sub">
                Eventos auditados: {esSuperAdmin ? auditoria.length : "Solo SuperAdmin"}
              </span>
            </div>
          </div>

          {/* Pestañas del Módulo 01 */}
          <div
            className="acc-tabs acc-no-print"
            role="tablist"
            aria-label="Secciones de Acceso y Administración"
          >
            <button
              type="button"
              role="tab"
              className="acc-tab-btn"
              aria-selected={pestanaActiva === "cuentas"}
              onClick={() => setPestanaActiva("cuentas")}
            >
              <span>1. Cuentas y Activación</span>
              <span className="acc-tab-contador">{usuarios.length}</span>
            </button>

            <button
              type="button"
              role="tab"
              className="acc-tab-btn"
              aria-selected={pestanaActiva === "roles"}
              onClick={() => setPestanaActiva("roles")}
            >
              <span>2. Roles y Permisos</span>
              <span className="acc-tab-contador">{ROLES_VALIDOS.length}</span>
            </button>

            <button
              type="button"
              role="tab"
              className="acc-tab-btn"
              aria-selected={pestanaActiva === "configuracion"}
              onClick={() => setPestanaActiva("configuracion")}
            >
              <span>3. Áreas, Marcas y Horarios</span>
              <span className="acc-tab-contador">{departamentos.length}</span>
            </button>

            <button
              type="button"
              role="tab"
              className="acc-tab-btn"
              aria-selected={pestanaActiva === "auditoria"}
              onClick={() => setPestanaActiva("auditoria")}
            >
              <span>4. Auditoría de Cambios</span>
              <span className="acc-tab-contador">{auditoria.length}</span>
            </button>
          </div>

          {/* PESTAÑA 1: CUENTAS Y ACTIVACIÓN */}
          {pestanaActiva === "cuentas" && (
            <section className="acc-seccion" aria-label="Administración de cuentas y activación">
              <div className="acc-seccion-cabecera">
                <div>
                  <h3 style={{ margin: 0 }}>
                    Administración de Cuentas y Activación
                  </h3>
                  <p className="acc-ayuda" style={{ margin: "4px 0 0 0" }}>
                    Gestione los usuarios del sistema, su estado activo/inactivo, rol y permisos por módulo.
                  </p>
                </div>

                <div className="acc-acciones-fila acc-no-print">
                  <button
                    type="button"
                    className="acc-btn acc-btn-secundario"
                    onClick={() => recargarColecciones()}
                    disabled={cargando || procesando}
                  >
                    Actualizar
                  </button>
                  {esAdminOSuper && (
                    <button
                      type="button"
                      className="acc-btn acc-btn-primario"
                      onClick={() => {
                        setUsuarioEditando(null);
                        setFormUsuarioAbierto(true);
                      }}
                    >
                      + Nueva cuenta de usuario
                    </button>
                  )}
                </div>
              </div>

              {formUsuarioAbierto && (
                <UsuarioForm
                  usuarioInicial={usuarioEditando}
                  usuariosExistentes={usuarios}
                  rolSesionActual={rolActual}
                  onGuardar={handleGuardarUsuario}
                  onCancelar={() => {
                    setFormUsuarioAbierto(false);
                    setUsuarioEditando(null);
                  }}
                  guardando={procesando}
                />
              )}

              {usuarioPorEliminar && (
                <div className="acc-alerta acc-alerta-error" role="alert">
                  <div>
                    <strong>
                      ¿Confirmar eliminación de la cuenta '{usuarioPorEliminar.nombreUsuario}'?
                    </strong>
                    <div style={{ fontSize: "0.86rem", marginTop: "4px" }}>
                      Esta acción solo está permitida para SuperAdmin y quedará registrada en la auditoría.
                    </div>
                  </div>
                  <div className="acc-acciones-fila">
                    <button
                      type="button"
                      className="acc-btn acc-btn-peligro"
                      onClick={handleConfirmarEliminarUsuario}
                      disabled={procesando}
                    >
                      Confirmar eliminación
                    </button>
                    <button
                      type="button"
                      className="acc-btn acc-btn-secundario"
                      onClick={() => setUsuarioPorEliminar(null)}
                      disabled={procesando}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {!esAdminOSuper ? (
                <div className="acc-vacio">
                  <p style={{ margin: "0 0 10px 0", fontWeight: 700 }}>
                    Su sesión actual tiene rol Encargado ({usuarioActual?.nombreUsuario}).
                  </p>
                  <p style={{ margin: "0 0 14px 0" }}>
                    La administración de cuentas está reservada para Administradores y SuperAdmin. Si intenta ejecutar una acción administrativa, el backend la rechazará con código 403.
                  </p>
                  <button
                    type="button"
                    className="acc-btn acc-btn-secundario"
                    onClick={async () => {
                      try {
                        await ejecutarOperacionModulo01(
                          "usuarios.listar",
                          {},
                          { usarContratoMemoria, modoRed }
                        );
                      } catch (err) {
                        await manejarErrorOperacion(err);
                      }
                    }}
                  >
                    Probar rechazo de acción prohibida en backend (403)
                  </button>
                </div>
              ) : (
                <>
                  <div className="acc-filtros-barra acc-no-print">
                    <div className="acc-campo">
                      <label className="acc-label" htmlFor="filtro-buscar-usuario">
                        Buscar por nombre de usuario
                      </label>
                      <input
                        id="filtro-buscar-usuario"
                        type="search"
                        className="acc-input"
                        placeholder="Ej. carlos.apaza, hector.manuel..."
                        value={busquedaUsuario}
                        onChange={(e) => setBusquedaUsuario(e.target.value)}
                      />
                    </div>

                    <div className="acc-campo">
                      <label className="acc-label" htmlFor="filtro-rol-usuario">
                        Filtrar por rol
                      </label>
                      <select
                        id="filtro-rol-usuario"
                        className="acc-select"
                        value={filtroRolUsuario}
                        onChange={(e) => setFiltroRolUsuario(e.target.value)}
                      >
                        <option value="TODOS">Todos los roles</option>
                        {ROLES_VALIDOS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="acc-campo">
                      <label className="acc-label" htmlFor="filtro-estado-usuario">
                        Estado de cuenta
                      </label>
                      <select
                        id="filtro-estado-usuario"
                        className="acc-select"
                        value={filtroEstadoUsuario}
                        onChange={(e) => setFiltroEstadoUsuario(e.target.value)}
                      >
                        <option value="TODOS">Activas e inactivas</option>
                        <option value="ACTIVOS">Solo activas</option>
                        <option value="INACTIVOS">Solo inactivas</option>
                      </select>
                    </div>
                  </div>

                  {usuariosFiltrados.length === 0 ? (
                    <div className="acc-vacio">
                      No se encontraron cuentas con los filtros seleccionados.
                    </div>
                  ) : (
                    <div className="acc-grid-tarjetas">
                      {usuariosFiltrados.map((u) => {
                        const esMiCuenta =
                          Number(u.idUsuario) === Number(usuarioActual?.idUsuario);
                        const puedeEditarCuenta =
                          esSuperAdmin || u.rol === "Encargado";

                        return (
                          <article key={u.idUsuario} className="acc-card">
                            <div className="acc-card-top">
                              <div>
                                <span className="acc-badge acc-badge-neutral">
                                  ID #{u.idUsuario}
                                </span>
                                <h4 className="acc-card-titulo" style={{ marginTop: "6px" }}>
                                  {u.nombreUsuario}
                                  {esMiCuenta ? " (Tú)" : ""}
                                </h4>
                              </div>
                              <div className="acc-badges-estado">
                                <span className={badgeRol(u.rol)}>{u.rol}</span>
                                <span
                                  className={`acc-badge ${
                                    u.activo ? "acc-badge-activo" : "acc-badge-inactivo"
                                  }`}
                                >
                                  {u.activo ? "Activo" : "Inactivo"}
                                </span>
                              </div>
                            </div>

                            <div>
                              <span
                                className="acc-ayuda"
                                style={{ display: "block", marginBottom: "6px", fontWeight: 700 }}
                              >
                                Permisos de acceso habilitados:
                              </span>
                              <div className="acc-chips-permisos">
                                {(u.rol === "SuperAdmin" || u.permisoPersonal) && (
                                  <span className="acc-badge acc-badge-neutral">Personal</span>
                                )}
                                {(u.rol === "SuperAdmin" || u.permisoAsistencia) && (
                                  <span className="acc-badge acc-badge-neutral">Asistencia</span>
                                )}
                                {(u.rol === "SuperAdmin" || u.permisoProyectos) && (
                                  <span className="acc-badge acc-badge-neutral">Proyectos</span>
                                )}
                                {(u.rol === "SuperAdmin" || u.permisoViaticos) && (
                                  <span className="acc-badge acc-badge-neutral">Viáticos</span>
                                )}
                                {(u.rol === "SuperAdmin" || u.permisoReportes) && (
                                  <span className="acc-badge acc-badge-neutral">Reportes</span>
                                )}
                                {(u.rol === "SuperAdmin" || u.permisoConfiguracion) && (
                                  <span className="acc-badge acc-badge-neutral">Configuración</span>
                                )}
                              </div>
                            </div>

                            <div className="acc-acciones-fila acc-no-print" style={{ marginTop: "auto" }}>
                              {puedeEditarCuenta && (
                                <button
                                  type="button"
                                  className="acc-btn acc-btn-secundario"
                                  onClick={() => {
                                    setUsuarioEditando(u);
                                    setFormUsuarioAbierto(true);
                                  }}
                                  disabled={procesando}
                                >
                                  Editar cuenta
                                </button>
                              )}

                              {puedeEditarCuenta && !esMiCuenta && (
                                <button
                                  type="button"
                                  className="acc-btn acc-btn-secundario"
                                  onClick={() => handleAlternarActivacionUsuario(u)}
                                  disabled={procesando}
                                >
                                  {u.activo ? "Desactivar" : "Activar"}
                                </button>
                              )}

                              {esSuperAdmin && !esMiCuenta && (
                                <button
                                  type="button"
                                  className="acc-btn acc-btn-peligro"
                                  onClick={() => setUsuarioPorEliminar(u)}
                                  disabled={procesando}
                                >
                                  Eliminar
                                </button>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {/* PESTAÑA 2: ROLES Y PERMISOS */}
          {pestanaActiva === "roles" && (
            <section className="acc-seccion" aria-label="Roles y permisos de administrador y operador">
              <div className="acc-seccion-cabecera">
                <div>
                  <h3 style={{ margin: 0 }}>
                    Roles y Permisos de Administrador y Operador
                  </h3>
                  <p className="acc-ayuda" style={{ margin: "4px 0 0 0" }}>
                    La autoridad es la sesión validada en el servidor. No se confía en cabeceras ni roles enviados por el navegador.
                  </p>
                </div>
              </div>

              <div className="acc-grid-tarjetas">
                {DESCRIPCION_ROLES.map((item) => {
                  const esRolActual = item.rol === rolActual;
                  return (
                    <article key={item.rol} className="acc-card">
                      <div className="acc-card-top">
                        <div>
                          <span className={badgeRol(item.rol)}>{item.rol}</span>
                          <h4 className="acc-card-titulo" style={{ marginTop: "6px" }}>
                            {item.titulo}
                          </h4>
                        </div>
                        {esRolActual && (
                          <span className="acc-badge acc-badge-activo">
                            Tu rol actual
                          </span>
                        )}
                      </div>

                      <p style={{ margin: 0, fontSize: "0.9rem", color: "#394d42" }}>
                        {item.resumen}
                      </p>

                      <div>
                        <span
                          className="acc-ayuda"
                          style={{ display: "block", marginBottom: "6px", fontWeight: 700 }}
                        >
                          Operaciones autorizadas en backend:
                        </span>
                        <div className="acc-chips-permisos">
                          {item.operacionesPermitidas.map((op) => (
                            <span key={op} className="acc-badge acc-badge-neutral">
                              {op}
                            </span>
                          ))}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="acc-form-panel">
                <h4 style={{ margin: "0 0 6px 0" }}>
                  Verificación de seguridad en Backend (Rechazo de acciones prohibidas y sesión vencida)
                </h4>
                <p className="acc-ayuda" style={{ margin: "0 0 12px 0" }}>
                  Compruebe en vivo los criterios funcionales del Módulo 01: las acciones no autorizadas para el rol actual se rechazan en el backend (403) y una sesión vencida redirige automáticamente al inicio de sesión (401).
                </p>
                <div className="acc-acciones-fila">
                  {!esSuperAdmin && (
                    <button
                      type="button"
                      className="acc-btn acc-btn-secundario"
                      disabled={procesando}
                      onClick={async () => {
                        setProcesando(true);
                        try {
                          await ejecutarOperacionModulo01(
                            "configuracion.guardar",
                            configuracion || {},
                            { usarContratoMemoria, modoRed }
                          );
                        } catch (error) {
                          await manejarErrorOperacion(error);
                        } finally {
                          setProcesando(false);
                        }
                      }}
                    >
                      Probar guardar configuración sin ser SuperAdmin (Rechazo 403)
                    </button>
                  )}
                  <button
                    type="button"
                    className="acc-btn acc-btn-secundario"
                    onClick={handleSimularVencimientoSesion}
                    disabled={procesando}
                  >
                    Simular sesión vencida y volver al acceso (401)
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* PESTAÑA 3: ÁREAS, MARCAS Y HORARIOS PREDETERMINADOS */}
          {pestanaActiva === "configuracion" && (
            <section
              className="acc-seccion"
              aria-label="Configuración de área, marca y horarios predeterminados"
            >
              <ConfiguracionForm
                configuracionActual={configuracion}
                rolSesionActual={rolActual}
                onGuardar={handleGuardarConfiguracion}
                onCambioTemaOscuro={(activo) =>
                  setConfiguracion((prev) => (prev ? { ...prev, temaOscuro: activo } : { id: 1, temaOscuro: activo }))
                }
                guardando={procesando}
              />

              {/* Áreas / Departamentos */}
              <div className="acc-seccion-cabecera" style={{ marginTop: "8px" }}>
                <div>
                  <h3 style={{ margin: 0 }}>Áreas y Departamentos</h3>
                  <p className="acc-ayuda" style={{ margin: "4px 0 0 0" }}>
                    Catálogo de áreas operativas y administrativas. El servidor impide eliminar áreas que tengan personal asignado.
                  </p>
                </div>

                {esAdminOSuper && (
                  <button
                    type="button"
                    className="acc-btn acc-btn-primario acc-no-print"
                    onClick={() => {
                      setDepartamentoEditando(null);
                      setFormDepartamentoAbierto(true);
                    }}
                  >
                    + Nueva área / departamento
                  </button>
                )}
              </div>

              {formDepartamentoAbierto && (
                <DepartamentoForm
                  departamentoInicial={departamentoEditando}
                  departamentosExistentes={departamentos}
                  rolSesionActual={rolActual}
                  onGuardar={handleGuardarDepartamento}
                  onCancelar={() => {
                    setFormDepartamentoAbierto(false);
                    setDepartamentoEditando(null);
                  }}
                  guardando={procesando}
                />
              )}

              {departamentoPorEliminar && (
                <div className="acc-alerta acc-alerta-error" role="alert">
                  <div>
                    <strong>
                      ¿Eliminar el área '{departamentoPorEliminar.nombre}'?
                    </strong>
                    <div style={{ fontSize: "0.86rem", marginTop: "4px" }}>
                      Si el área está referenciada por registros de personal, el backend rechazará la eliminación para proteger la integridad de los datos.
                    </div>
                  </div>
                  <div className="acc-acciones-fila">
                    <button
                      type="button"
                      className="acc-btn acc-btn-peligro"
                      onClick={handleConfirmarEliminarDepartamento}
                      disabled={procesando}
                    >
                      Confirmar eliminación
                    </button>
                    <button
                      type="button"
                      className="acc-btn acc-btn-secundario"
                      onClick={() => setDepartamentoPorEliminar(null)}
                      disabled={procesando}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              <div className="acc-grid-tarjetas">
                {departamentos.map((dep) => (
                  <article key={dep.idDepartamento} className="acc-card">
                    <div className="acc-card-top">
                      <div>
                        <span className="acc-badge acc-badge-neutral">
                          Área #{dep.idDepartamento}
                        </span>
                        <h4 className="acc-card-titulo" style={{ marginTop: "6px" }}>
                          {dep.nombre}
                        </h4>
                      </div>
                    </div>

                    <p style={{ margin: 0, fontSize: "0.9rem", color: "#495a50" }}>
                      {dep.descripcion || "Sin descripción adicional."}
                    </p>

                    {esAdminOSuper && (
                      <div className="acc-acciones-fila acc-no-print" style={{ marginTop: "auto" }}>
                        <button
                          type="button"
                          className="acc-btn acc-btn-secundario"
                          onClick={() => {
                            setDepartamentoEditando(dep);
                            setFormDepartamentoAbierto(true);
                          }}
                          disabled={procesando}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="acc-btn acc-btn-peligro"
                          onClick={() => setDepartamentoPorEliminar(dep)}
                          disabled={procesando}
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>

              {/* Catálogo de Marcas */}
              <div className="acc-form-panel" style={{ marginTop: "6px" }}>
                <div className="acc-panel-header" style={{ marginBottom: "10px" }}>
                  <div>
                    <h3 style={{ margin: 0 }}>Marcas Institucionales Registradas</h3>
                    <p className="acc-ayuda" style={{ margin: "4px 0 0 0" }}>
                      Catálogo oficial sincronizado desde el sistema de escritorio para la asignación de personal.
                    </p>
                  </div>
                  <span className="acc-badge acc-badge-activo">
                    {marcas.length} marcas activas
                  </span>
                </div>
                <div className="acc-chips-permisos">
                  {marcas.map((m) => (
                    <span key={m.idMarca} className="acc-badge acc-badge-neutral">
                      #{m.idMarca} · {m.nombreMarca || m.nombre}
                    </span>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* PESTAÑA 4: AUDITORÍA DE CAMBIOS Y ACCIONES ADMINISTRATIVAS */}
          {pestanaActiva === "auditoria" && (
            <section
              className="acc-seccion"
              aria-label="Auditoría de cambios y acciones administrativas"
            >
              <div className="acc-seccion-cabecera">
                <div>
                  <h3 style={{ margin: 0 }}>
                    Auditoría de Cambios y Acciones Administrativas
                  </h3>
                  <p className="acc-ayuda" style={{ margin: "4px 0 0 0" }}>
                    Registro cronológico de inicios de sesión, altas/bajas de usuarios, cambios de horario y áreas (hasta 1000 eventos).
                  </p>
                </div>

                <div className="acc-acciones-fila acc-no-print">
                  <button
                    type="button"
                    className="acc-btn acc-btn-secundario"
                    onClick={() => window.print()}
                  >
                    Imprimir auditoría A4
                  </button>
                </div>
              </div>

              {!esSuperAdmin ? (
                <div className="acc-vacio">
                  <p style={{ margin: "0 0 10px 0", fontWeight: 700 }}>
                    Consulta exclusiva para SuperAdmin.
                  </p>
                  <p style={{ margin: "0 0 14px 0" }}>
                    Según el contrato del sistema, solo el rol SuperAdmin está autorizado para consultar la bitácora completa de auditoría.
                  </p>
                  <button
                    type="button"
                    className="acc-btn acc-btn-secundario"
                    onClick={async () => {
                      try {
                        await ejecutarOperacionModulo01(
                          "auditoria.listar",
                          {},
                          { usarContratoMemoria, modoRed }
                        );
                      } catch (err) {
                        await manejarErrorOperacion(err);
                      }
                    }}
                  >
                    Comprobar restricción en backend (403)
                  </button>
                </div>
              ) : (
                <>
                  <div className="acc-filtros-barra acc-no-print">
                    <div className="acc-campo acc-campo-completo">
                      <label className="acc-label" htmlFor="filtro-auditoria">
                        Buscar por usuario, acción o detalle
                      </label>
                      <input
                        id="filtro-auditoria"
                        type="search"
                        className="acc-input"
                        placeholder="Buscar por nombre de usuario, acción o detalle..."
                        value={busquedaAuditoria}
                        onChange={(e) => setBusquedaAuditoria(e.target.value)}
                      />
                    </div>
                  </div>

                  {auditoriaFiltrada.length === 0 ? (
                    <div className="acc-vacio">
                      No hay eventos de auditoría que coincidan con la búsqueda.
                    </div>
                  ) : (
                    <div className="acc-tabla-contenedor">
                      <table className="acc-tabla">
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>Fecha y hora</th>
                            <th>Usuario</th>
                            <th>Acción</th>
                            <th>Detalle registrado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditoriaFiltrada.map((ev) => (
                            <tr key={ev.idLog || `${ev.fecha}-${ev.accion}`}>
                              <td>
                                <strong>#{ev.idLog}</strong>
                              </td>
                              <td>
                                {ev.fecha
                                  ? String(ev.fecha).replace("T", " ").slice(0, 19)
                                  : "-"}
                              </td>
                              <td>
                                <span className="acc-badge acc-badge-neutral">
                                  {ev.usuario}
                                </span>
                              </td>
                              <td>
                                <strong>{ev.accion}</strong>
                              </td>
                              <td>{ev.detalle}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
