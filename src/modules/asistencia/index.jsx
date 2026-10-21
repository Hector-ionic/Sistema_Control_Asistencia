import React, { useEffect, useRef, useState } from "react";
import ModuloBase from "../../components/ModuloBase.jsx";
import PanelJornada from "./PanelJornada.jsx";
import PanelIncidenciasQr from "./PanelIncidenciasQr.jsx";
import {
  hoyBolivia,
  horaActualBolivia,
  obtenerContratoBackend,
  iniciarSesion,
  obtenerSesionActual,
  registrarEncargado,
  consultarResumenAsistencia,
  leerRegistrosDiaDirecto,
  listarPersonalAsistencia,
  listarProyectosAsistencia,
  listarCorrecciones,
  verificarExisteQr,
  contarPendientesQr,
  listarSolicitudesQr
} from "./asistenciaApi.js";
import "./asistencia.css";

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

  // Estado de autenticación
  const [modoRegistroEncargado, setModoRegistroEncargado] = useState(false);
  const [credencialesForm, setCredencialesForm] = useState({
    usuario: "",
    password: ""
  });
  const [operacionesContrato, setOperacionesContrato] = useState([]);

  // Estado general de interfaz y conexión
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
  const [verAlcanceBase, setVerAlcanceBase] = useState(false);
  const [estadoConexion, setEstadoConexion] = useState("Listo");
  const [ultimaSincronizacion, setUltimaSincronizacion] = useState("");
  const [relojBolivia, setRelojBolivia] = useState(() => horaActualBolivia());

  // Pestaña principal: 'jornada' (Parte 1: Gabriel) | 'incidencias' (Parte 2: Carlos)
  const [seccionActiva, setSeccionActiva] = useState("jornada");

  // Datos sincronizados del servidor C# y PostgreSQL
  const [idProyectoFiltro, setIdProyectoFiltro] = useState("");
  const [personal, setPersonal] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [resumenDia, setResumenDia] = useState([]);
  const [registrosDirectosDia, setRegistrosDirectosDia] = useState([]);
  const [correcciones, setCorrecciones] = useState([]);
  const [qrExiste, setQrExiste] = useState(false);
  const [pendientesQr, setPendientesQr] = useState(0);
  const [solicitudesQr, setSolicitudesQr] = useState([]);

  // Evitar solicitudes periódicas simultáneas
  const lecturaEnCursoRef = useRef(false);

  function cerrarSesionLocal() {
    setTokenMemoria("");
    setUsuarioMemoria(null);
    setPersonal([]);
    setProyectos([]);
    setResumenDia([]);
    setRegistrosDirectosDia([]);
    setCorrecciones([]);
    setSolicitudesQr([]);
    setEstadoConexion("Sin sesión");
  }

  // Reloj en vivo en zona horaria America/La_Paz
  useEffect(() => {
    const timerReloj = setInterval(() => {
      setRelojBolivia(horaActualBolivia());
    }, 1000);
    return () => clearInterval(timerReloj);
  }, []);

  // Verificar contrato público GET /api/backend al montar
  useEffect(() => {
    let activo = true;
    obtenerContratoBackend()
      .then((contrato) => {
        if (activo && Array.isArray(contrato?.modulos?.asistencia)) {
          setOperacionesContrato(contrato.modulos.asistencia);
        }
      })
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, []);

  // Carga completa o periódica sincronizada con C# y PostgreSQL
  async function sincronizarDatosModulo(
    tokenActivo = token,
    usuarioActivo = usuario,
    idProy = idProyectoFiltro,
    signal
  ) {
    if (!tokenActivo || !usuarioActivo || lecturaEnCursoRef.current) return;
    lecturaEnCursoRef.current = true;
    setEstadoConexion("Sincronizando…");

    try {
      const rol = usuarioActivo.rol;
      const esAdminOSuper = rol === "Admin" || rol === "SuperAdmin";

      const promesas = [
        listarPersonalAsistencia(rol, tokenActivo, { signal }),
        consultarResumenAsistencia(idProy, tokenActivo, { signal }).catch(
          () => []
        ),
        listarCorrecciones(tokenActivo, { signal }).catch(() => []),
        esAdminOSuper
          ? leerRegistrosDiaDirecto(tokenActivo, { signal }).catch(() => null)
          : Promise.resolve(null),
        !rol || rol !== "Encargado"
          ? listarProyectosAsistencia(tokenActivo, { signal }).catch(() => [])
          : Promise.resolve([]),
        verificarExisteQr(tokenActivo, { signal }).catch(() => false),
        contarPendientesQr(tokenActivo, { signal }).catch(() => 0),
        listarSolicitudesQr({ soloPendientes: true }, tokenActivo, {
          signal
        }).catch(() => [])
      ];

      const [
        listaPers,
        listaResumen,
        listaCorr,
        datosDirectos,
        listaProy,
        existeQrResp,
        pendQrResp,
        listaSolQr
      ] = await Promise.all(promesas);

      setPersonal(Array.isArray(listaPers) ? listaPers : []);
      setResumenDia(Array.isArray(listaResumen) ? listaResumen : []);
      setCorrecciones(Array.isArray(listaCorr) ? listaCorr : []);
      if (datosDirectos && Array.isArray(datosDirectos.registros)) {
        setRegistrosDirectosDia(datosDirectos.registros);
      }
      if (Array.isArray(listaProy) && listaProy.length > 0) {
        setProyectos(listaProy);
      }
      setQrExiste(Boolean(existeQrResp?.existe ?? existeQrResp));
      setPendientesQr(
        Number(pendQrResp?.pendientes ?? pendQrResp?.cantidad ?? pendQrResp) ||
          (Array.isArray(listaSolQr) ? listaSolQr.length : 0)
      );
      setSolicitudesQr(Array.isArray(listaSolQr) ? listaSolQr : []);

      setEstadoConexion("Conectado (Sincronizado)");
      setUltimaSincronizacion(horaActualBolivia());
    } catch (err) {
      if (err?.name !== "AbortError") {
        setEstadoConexion("Error de conexión");
        if (err?.status === 401) {
          cerrarSesionLocal();
        }
      }
      throw err;
    } finally {
      lecturaEnCursoRef.current = false;
    }
  }

  // Lectura periódica cada 10 segundos sin solapar peticiones y deteniendo al salir
  useEffect(() => {
    if (!token || !usuario) return;
    let activo = true;
    let controlador = new AbortController();

    sincronizarDatosModulo(token, usuario, idProyectoFiltro, controlador.signal).catch(
      (err) => {
        if (activo && err?.name !== "AbortError") {
          setError(err.message || "Error al sincronizar asistencia.");
        }
      }
    );

    const intervalo = setInterval(() => {
      if (!activo || lecturaEnCursoRef.current) return;
      controlador = new AbortController();
      sincronizarDatosModulo(
        token,
        usuario,
        idProyectoFiltro,
        controlador.signal
      ).catch(() => {});
    }, 10000);

    return () => {
      activo = false;
      clearInterval(intervalo);
      controlador?.abort();
    };
  }, [token, usuario, idProyectoFiltro]);

  async function manejarAcceso(e) {
    e.preventDefault();
    if (ocupado) return;
    setOcupado(true);
    setError("");
    setAviso("");
    try {
      const usr = credencialesForm.usuario.trim();
      const pwd = credencialesForm.password;
      if (modoRegistroEncargado) {
        await registrarEncargado(usr, pwd);
        setModoRegistroEncargado(false);
        setAviso("Cuenta de encargado creada. Ya puede iniciar sesión.");
        return;
      }
      const sesion = await iniciarSesion(usr, pwd);
      const actual = await obtenerSesionActual(sesion.accessToken);
      setTokenMemoria(sesion.accessToken);
      setUsuarioMemoria(actual);
      setCredencialesForm({ usuario: "", password: "" });
      await sincronizarDatosModulo(
        sesion.accessToken,
        actual,
        idProyectoFiltro
      );
    } catch (err) {
      setError(err.message || "No se pudo iniciar sesión.");
    } finally {
      setOcupado(false);
    }
  }

  const correccionesPendientes = correcciones.filter(
    (c) => c.estado === "Pendiente"
  ).length;

  return (
    <div className="mod-asistencia">
      <section className="detalle-modulo">
        <div className="mod-asist-cabecera-top">
          <div>
            <span className="numero">MÓDULO {modulo?.numero || "03"}</span>
            <h2>{modulo?.nombre || "Asistencia e incidencias"}</h2>
            <p>
              {modulo?.descripcion ||
                "Jornada laboral, permisos, correcciones con motivo, QR y sincronización con escritorio."}
            </p>
            <div className="etiquetas">
              <span>Contrato conectado: POST /api/backend</span>
              <span>
                Zona horaria: America/La_Paz ({hoyBolivia()} · {relojBolivia})
              </span>
              <span>Estado: {estadoConexion}</span>
            </div>
          </div>

          <div className="mod-asist-acciones-top">
            {usuario && (
              <button
                type="button"
                className="btn-asist btn-asist-primario"
                disabled={ocupado}
                onClick={() =>
                  sincronizarDatosModulo(token, usuario, idProyectoFiltro).catch(
                    (e) => setError(e.message)
                  )
                }
              >
                Sincronizar ahora
              </button>
            )}
            <button
              type="button"
              className="btn-asist"
              onClick={() => setVerAlcanceBase((v) => !v)}
            >
              {verAlcanceBase ? "Ocultar alcance" : "Ver alcance del módulo"}
            </button>
            {usuario && !tokenExterno && (
              <button
                type="button"
                className="btn-asist"
                onClick={cerrarSesionLocal}
              >
                Cerrar sesión ({usuario.nombreUsuario} · {usuario.rol})
              </button>
            )}
          </div>
        </div>

        {usuario && (
          <div className="mod-asist-indicadores">
            <div className="caja-indicador-asist destacada">
              <span className="numero">FECHA Y HORA (BOLIVIA)</span>
              <strong className="valor-grande">{relojBolivia}</strong>
              <span className="subtexto-asist">
                Día operativo: {hoyBolivia()} · America/La_Paz
              </span>
            </div>
            <div className="caja-indicador-asist">
              <span className="numero">PERSONAL HABILITADO</span>
              <strong className="valor-grande">{personal.length}</strong>
              <span className="subtexto-asist">
                Sincronizado con sistema de escritorio
              </span>
            </div>
            <div className="caja-indicador-asist">
              <span className="numero">CORRECCIONES PENDIENTES</span>
              <strong className="valor-grande">{correccionesPendientes}</strong>
              <span className="subtexto-asist">
                De {correcciones.length} solicitudes registradas
              </span>
            </div>
            <div className="caja-indicador-asist">
              <span className="numero">SOLICITUDES QR</span>
              <strong className="valor-grande">{pendientesQr}</strong>
              <span className="subtexto-asist">
                {qrExiste ? "Credencial QR vigente" : "Sin credencial QR emitida"}
              </span>
            </div>
          </div>
        )}
      </section>

      {verAlcanceBase && modulo && <ModuloBase modulo={modulo} />}

      {aviso && (
        <div className="aviso-asistencia" role="status">
          <span>{aviso}</span>
          <button
            type="button"
            className="btn-asist"
            onClick={() => setAviso("")}
          >
            Cerrar
          </button>
        </div>
      )}

      {error && (
        <div className="aviso-asistencia alerta" role="alert">
          <span>
            <strong>Atención:</strong> {error}
          </span>
          <button
            type="button"
            className="btn-asist"
            onClick={() => setError("")}
          >
            Cerrar
          </button>
        </div>
      )}

      {!usuario ? (
        <section className="detalle-modulo" aria-label="Autenticación Módulo 03">
          <span className="numero">AUTENTICACIÓN REQUERIDA (/API/BACKEND)</span>
          <h3>
            {modoRegistroEncargado
              ? "Crear cuenta de Encargado"
              : "Iniciar sesión para Asistencia e Incidencias"}
          </h3>
          <p>
            Ingrese con su cuenta para registrar entradas, almuerzos, salidas,
            permisos, correcciones y sincronizar cada 10 segundos con escritorio.
          </p>

          <form
            className="grid-form-manual"
            onSubmit={manejarAcceso}
            style={{ marginTop: "14px" }}
          >
            <div className="campo-asist">
              <label htmlFor="asist-login-user">Usuario *</label>
              <input
                id="asist-login-user"
                className="input-asist"
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

            <div className="campo-asist">
              <label htmlFor="asist-login-pass">Contraseña *</label>
              <input
                id="asist-login-pass"
                className="input-asist"
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

            <div
              style={{
                display: "flex",
                gap: "10px",
                alignItems: "end",
                flexWrap: "wrap"
              }}
            >
              <button
                type="submit"
                className="btn-asist btn-asist-primario"
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
                className="btn-asist"
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
        <section className="detalle-modulo">
          <div className="pestanas-asistencia" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={seccionActiva === "jornada"}
              className={`btn-asist ${
                seccionActiva === "jornada" ? "btn-asist-activo" : ""
              }`}
              onClick={() => setSeccionActiva("jornada")}
            >
              1. Jornada Laboral, Marcaciones y Sincronización
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={seccionActiva === "incidencias"}
              className={`btn-asist ${
                seccionActiva === "incidencias" ? "btn-asist-activo" : ""
              }`}
              onClick={() => setSeccionActiva("incidencias")}
            >
              2. Permisos, Faltas, Correcciones y QR (
              {correccionesPendientes + pendientesQr})
            </button>
          </div>

          {seccionActiva === "jornada" ? (
            <PanelJornada
              token={token}
              usuario={usuario}
              personal={personal}
              proyectos={proyectos}
              idProyectoFiltro={idProyectoFiltro}
              onCambiarProyectoFiltro={setIdProyectoFiltro}
              resumenDia={resumenDia}
              registrosDirectosDia={registrosDirectosDia}
              estadoConexion={estadoConexion}
              ultimaSincronizacion={ultimaSincronizacion}
              onRecargarDatos={() =>
                sincronizarDatosModulo(token, usuario, idProyectoFiltro)
              }
              onNotificarAviso={setAviso}
              onNotificarError={setError}
            />
          ) : (
            <PanelIncidenciasQr
              token={token}
              usuario={usuario}
              personal={personal}
              correcciones={correcciones}
              solicitudesQr={solicitudesQr}
              qrExiste={qrExiste}
              pendientesQr={pendientesQr}
              onRecargarDatos={() =>
                sincronizarDatosModulo(token, usuario, idProyectoFiltro)
              }
              onNotificarAviso={setAviso}
              onNotificarError={setError}
            />
          )}
        </section>
      )}
    </div>
  );
}
