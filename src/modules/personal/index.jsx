import React, { useEffect, useMemo, useState } from "react";
import ModuloBase from "../../components/ModuloBase.jsx";
import {
  TIPOS_CONTRATO,
  TURNOS_CSHARP,
  DIAS_TRABAJO_CSHARP,
  HORAS_META_DEFECTO,
  hoyBolivia,
  fotoUrl,
  formatearMinutosAcumulados,
  calcularAvanceDesdeMinutos,
  crearFichaVacia,
  obtenerContratoBackend,
  iniciarSesion,
  obtenerSesionActual,
  registrarEncargado,
  listarPersonalActivo,
  listarPersonalHistorico,
  obtenerPersonal,
  verificarExistePersonal,
  guardarPersonal,
  eliminarPersonal,
  recalcularPersonal,
  listarPersonalParaHoras,
  listarFeriados,
  listarDepartamentos,
  listarMarcas,
  consultarSeguimientoReal,
  consultarIndividualReal
} from "./personalApi.js";
import "./personal.css";

export default function Modulo({
  modulo,
  token: tokenExterno = "",
  usuario: usuarioExterno = null
}) {
  // Token y sesión guardados únicamente en memoria (regla de seguridad del backend)
  const [tokenMemoria, setTokenMemoria] = useState("");
  const [usuarioMemoria, setUsuarioMemoria] = useState(null);

  const token = tokenExterno || tokenMemoria;
  const usuario = usuarioExterno || usuarioMemoria;
  const esEncargado = usuario?.rol === "Encargado";
  const esSuperAdmin = usuario?.rol === "SuperAdmin";

  // Estado de autenticación y contrato
  const [modoRegistroEncargado, setModoRegistroEncargado] = useState(false);
  const [credencialesForm, setCredencialesForm] = useState({
    usuario: "",
    password: ""
  });
  const [operacionesContrato, setOperacionesContrato] = useState([]);

  // Datos reales provenientes de /api/backend
  const [personal, setPersonal] = useState([]);
  const [seguimientoMap, setSeguimientoMap] = useState({});
  const [departamentos, setDepartamentos] = useState([]);
  const [feriados, setFeriados] = useState([]);
  const [marcas, setMarcas] = useState([]);

  // Estados de interfaz
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
  const [verAlcanceBase, setVerAlcanceBase] = useState(false);

  // Filtros de consulta
  const [modoListado, setModoListado] = useState("historico"); // 'activos' | 'historico'
  const [idProyectoFiltro, setIdProyectoFiltro] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipoContrato, setFiltroTipoContrato] = useState("todos");
  const [filtroEstadoActivo, setFiltroEstadoActivo] = useState("todos");
  const [codigoVerificar, setCodigoVerificar] = useState("");

  // Formulario de Alta / Edición con esquema exacto C#
  const [fichaEdicion, setFichaEdicion] = useState(null);
  const [fichaOriginalEdicion, setFichaOriginalEdicion] = useState(null);
  const [erroresFicha, setErroresFicha] = useState({});

  // Detalle individual real (reportes.individual) y credencial imprimible
  const [reporteIndividual, setReporteIndividual] = useState(null);
  const [credencialActiva, setCredencialActiva] = useState(null);

  function cerrarSesionLocal() {
    setTokenMemoria("");
    setUsuarioMemoria(null);
    setPersonal([]);
    setSeguimientoMap({});
    setFichaEdicion(null);
    setFichaOriginalEdicion(null);
    setReporteIndividual(null);
    setCredencialActiva(null);
  }

  async function ejecutarTarea(accion) {
    if (ocupado) return;
    setOcupado(true);
    setError("");
    setAviso("");
    try {
      await accion();
    } catch (err) {
      setError(err.message || "No se pudo completar la operación.");
      if (err.errores) {
        setErroresFicha(err.errores);
      }
      if (err.status === 401) {
        cerrarSesionLocal();
      }
    } finally {
      setOcupado(false);
    }
  }

  // Verificar el contrato público GET /api/backend al montar el módulo
  useEffect(() => {
    let activo = true;
    obtenerContratoBackend()
      .then((contrato) => {
        if (activo && Array.isArray(contrato?.modulos?.personal)) {
          setOperacionesContrato(contrato.modulos.personal);
        }
      })
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, []);

  async function cargarDatosModulo(
    tokenActivo = token,
    usuarioActivo = usuario,
    modo = modoListado,
    idProy = idProyectoFiltro
  ) {
    if (!tokenActivo || !usuarioActivo) return;

    if (usuarioActivo.rol === "Encargado") {
      const listaHoras = await listarPersonalParaHoras(tokenActivo);
      setPersonal(Array.isArray(listaHoras) ? listaHoras : []);
      return;
    }

    const promesas = [
      modo === "activos"
        ? listarPersonalActivo(tokenActivo, idProy || undefined)
        : listarPersonalHistorico(tokenActivo),
      listarDepartamentos(tokenActivo).catch(() => []),
      listarFeriados(tokenActivo).catch(() => []),
      listarMarcas(tokenActivo).catch(() => []),
      consultarSeguimientoReal(
        { idProyecto: idProy ? Number(idProy) : null },
        tokenActivo
      ).catch(() => [])
    ];

    const [
      listaPersonal,
      listaDeptos,
      listaFeriados,
      listaMarcas,
      listaSeguimiento
    ] = await Promise.all(promesas);

    setPersonal(Array.isArray(listaPersonal) ? listaPersonal : []);
    setDepartamentos(Array.isArray(listaDeptos) ? listaDeptos : []);
    setFeriados(Array.isArray(listaFeriados) ? listaFeriados : []);
    setMarcas(Array.isArray(listaMarcas) ? listaMarcas : []);

    // Mapear minutos reales trabajados por idPasante o codigo desde reportes.seguimiento
    const mapa = {};
    if (Array.isArray(listaSeguimiento)) {
      for (const item of listaSeguimiento) {
        const claveId = item.idPasante ?? item.id;
        const claveCod = item.codigo;
        const minutos =
          item.minutosTotales ??
          item.minutosTrabajados ??
          item.minutosPeriodo ??
          0;
        if (claveId !== undefined && claveId !== null) {
          mapa[`id:${claveId}`] = minutos;
        }
        if (claveCod) {
          mapa[`cod:${claveCod}`] = minutos;
        }
      }
    }
    setSeguimientoMap(mapa);
  }

  useEffect(() => {
    if (token && usuario) {
      ejecutarTarea(() =>
        cargarDatosModulo(token, usuario, modoListado, idProyectoFiltro)
      );
    }
  }, [token, usuario, modoListado]);

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
      await cargarDatosModulo(sesion.accessToken, actual, modoListado, idProyectoFiltro);
    });
  }

  function iniciarNuevaFicha() {
    setErroresFicha({});
    setFichaOriginalEdicion(null);
    setFichaEdicion(crearFichaVacia());
  }

  async function abrirEdicionCompleta(personaResumen) {
    setErroresFicha({});
    await ejecutarTarea(async () => {
      const idOCodigo = personaResumen.idPasante ?? personaResumen.codigo;
      const leida = idOCodigo
        ? await obtenerPersonal(idOCodigo, token)
        : personaResumen;
      const base = leida || personaResumen;
      setFichaOriginalEdicion(base);
      setFichaEdicion({
        ...crearFichaVacia(),
        ...base,
        horasRequeridas:
          base.tipoContrato === "Pasante"
            ? Number(base.horasRequeridas) || HORAS_META_DEFECTO
            : 0,
        fechaInicio: (base.fechaInicio || hoyBolivia()).slice(0, 10)
      });
    });
  }

  async function manejarFotoArchivo(archivo) {
    if (!archivo) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(archivo.type) ||
      archivo.size > 3 * 1024 * 1024
    ) {
      setError("Seleccione una imagen JPG, PNG o WebP de hasta 3 MB.");
      return;
    }
    try {
      const base64 = await new Promise((resolve, reject) => {
        const lector = new FileReader();
        lector.onload = () => resolve(String(lector.result).split(",")[1] || "");
        lector.onerror = reject;
        lector.readAsDataURL(archivo);
      });
      setFichaEdicion((prev) => ({ ...prev, foto: base64 }));
    } catch {
      setError("No se pudo leer el archivo de imagen.");
    }
  }

  async function guardarFichaFormulario(e) {
    e.preventDefault();
    if (!fichaEdicion) return;
    setErroresFicha({});
    await ejecutarTarea(async () => {
      const guardada = await guardarPersonal(fichaEdicion, token, {
        usuarioActual: usuario,
        fichaExistente: fichaOriginalEdicion
      });
      setFichaEdicion(null);
      setFichaOriginalEdicion(null);
      await cargarDatosModulo();
      setAviso(
        `Ficha guardada correctamente (${
          guardada?.codigo || guardada?.nombres || "Personal"
        }). La fecha de fin es calculada por el servidor C#.`
      );
    });
  }

  async function darDeBajaLogica(persona) {
    if (!persona?.idPasante) return;
    await ejecutarTarea(async () => {
      await eliminarPersonal(persona.idPasante, token);
      await cargarDatosModulo();
      setAviso(
        `Baja lógica aplicada a ${persona.nombres} ${persona.apellidos} (${persona.codigo}) conservando su historial.`
      );
    });
  }

  async function reactivarPersona(persona) {
    await ejecutarTarea(async () => {
      // Regla de BACKEND-PARA-LOS-5-MODULOS.md:
      // "La reactivación requiere una ficha completa con activo: true y permisos de personal."
      const idOCodigo = persona.idPasante ?? persona.codigo;
      const fichaCompleta = (await obtenerPersonal(idOCodigo, token)) || persona;
      await guardarPersonal(
        {
          ...fichaCompleta,
          activo: true
        },
        token,
        {
          usuarioActual: usuario,
          fichaExistente: fichaCompleta
        }
      );
      await cargarDatosModulo();
      setAviso(
        `Persona reactivada (${fichaCompleta.codigo}) conservando su ficha completa e historial.`
      );
    });
  }

  async function recalcularFinPasante(persona) {
    if (!persona?.idPasante) return;
    await ejecutarTarea(async () => {
      const resultado = await recalcularPersonal(persona.idPasante, token);
      await cargarDatosModulo();
      setAviso(
        `Fecha de finalización recalculada en C# para ${persona.nombres} ${
          persona.apellidos
        }${resultado?.fechaFin ? `: ${String(resultado.fechaFin).slice(0, 10)}` : "."}`
      );
    });
  }

  async function abrirDetalleIndividual(persona) {
    if (!persona?.idPasante) return;
    await ejecutarTarea(async () => {
      const detalle = await consultarIndividualReal(persona.idPasante, token);
      setReporteIndividual(detalle);
    });
  }

  async function comprobarCodigoExistente() {
    if (!codigoVerificar.trim()) return;
    await ejecutarTarea(async () => {
      const existe = await verificarExistePersonal(codigoVerificar.trim(), token);
      setAviso(
        existe
          ? `El código "${codigoVerificar.trim()}" SÍ existe en la base de datos.`
          : `El código "${codigoVerificar.trim()}" NO está registrado.`
      );
    });
  }

  const personalFiltrado = useMemo(() => {
    const q = busqueda
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    return personal.filter((p) => {
      if (
        filtroTipoContrato !== "todos" &&
        p.tipoContrato !== filtroTipoContrato
      ) {
        return false;
      }
      if (filtroEstadoActivo === "activos" && p.activo === false) {
        return false;
      }
      if (filtroEstadoActivo === "inactivos" && p.activo !== false) {
        return false;
      }
      if (q) {
        const texto = [
          p.codigo,
          p.nombres,
          p.apellidos,
          p.nombreCompleto,
          p.ci,
          p.nombreDepartamento,
          p.universidad,
          p.carrera
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        if (!texto.includes(q)) return false;
      }
      return true;
    });
  }, [personal, busqueda, filtroTipoContrato, filtroEstadoActivo]);

  const indicadores = useMemo(() => {
    let activos = 0;
    let inactivos = 0;
    let planta = 0;
    let pasantes = 0;
    for (const p of personal) {
      if (p.activo === false) inactivos += 1;
      else activos += 1;
      if (p.tipoContrato === "Personal de planta") planta += 1;
      else if (p.tipoContrato === "Pasante") pasantes += 1;
    }
    return { total: personal.length, activos, inactivos, planta, pasantes };
  }, [personal]);

  return (
    <div className="mod-personal">
      {/* Cabecera principal respetando el diseño .detalle-modulo */}
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
              <span>Contrato conectado: POST /api/backend</span>
              <span>Tipos C#: Pasante (600 h) y Personal de planta (0 h)</span>
              <span>
                {operacionesContrato.length > 0
                  ? `${operacionesContrato.length} operaciones activas en contrato`
                  : "Autenticación Bearer en memoria"}
              </span>
            </div>
          </div>

          <div className="mod-personal-acciones-top no-imprimir">
            {usuario && !esEncargado && (
              <button
                type="button"
                className="btn-personal btn-personal-primario"
                onClick={iniciarNuevaFicha}
                disabled={ocupado}
              >
                + Nueva persona
              </button>
            )}
            {usuario && (
              <button
                type="button"
                className="btn-personal"
                onClick={() =>
                  ejecutarTarea(() =>
                    cargarDatosModulo(token, usuario, modoListado, idProyectoFiltro)
                  )
                }
                disabled={ocupado}
              >
                Actualizar datos
              </button>
            )}
            <button
              type="button"
              className="btn-personal"
              onClick={() => setVerAlcanceBase((v) => !v)}
            >
              {verAlcanceBase ? "Ocultar alcance" : "Ver alcance del módulo"}
            </button>
            {usuario && !tokenExterno && (
              <button
                type="button"
                className="btn-personal btn-personal-baja"
                onClick={cerrarSesionLocal}
              >
                Cerrar sesión ({usuario.nombreUsuario} · {usuario.rol})
              </button>
            )}
          </div>
        </div>

        {usuario && (
          <div className="mod-personal-indicadores" aria-label="Resumen de personal">
            <div className="caja-indicador destacada">
              <span className="numero">PERSONAS ACTIVAS</span>
              <strong className="valor-grande">{indicadores.activos}</strong>
              <span className="subtexto">De {indicadores.total} cargadas</span>
            </div>
            <div className="caja-indicador">
              <span className="numero">PERSONAL DE PLANTA</span>
              <strong className="valor-grande">{indicadores.planta}</strong>
              <span className="subtexto">horasRequeridas: 0 (sin meta)</span>
            </div>
            <div className="caja-indicador">
              <span className="numero">PASANTES</span>
              <strong className="valor-grande">{indicadores.pasantes}</strong>
              <span className="subtexto">Meta por defecto: 600 horas</span>
            </div>
            <div className="caja-indicador">
              <span className="numero">FERIADOS / ÁREAS</span>
              <strong className="valor-grande">
                {feriados.length} / {departamentos.length}
              </strong>
              <span className="subtexto">
                {marcas.length} marcas · {indicadores.inactivos} bajas en histórico
              </span>
            </div>
          </div>
        )}

        <p className="ruta" style={{ marginTop: "20px", marginBottom: 0 }}>
          Código del módulo: src/modules/personal/ · Endpoint oficial: /api/backend
        </p>
      </section>

      {verAlcanceBase && modulo && <ModuloBase modulo={modulo} />}

      {aviso && (
        <div className="aviso-personal no-imprimir" role="status">
          <span>{aviso}</span>
          <button
            type="button"
            className="btn-personal"
            onClick={() => setAviso("")}
          >
            Cerrar
          </button>
        </div>
      )}

      {error && (
        <div className="aviso-personal aviso-alerta no-imprimir" role="alert">
          <span>
            <strong>Atención:</strong> {error}
          </span>
          <button
            type="button"
            className="btn-personal"
            onClick={() => setError("")}
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Si no hay sesión autenticada en memoria, solicitar ingreso contra /api/backend */}
      {!usuario ? (
        <section className="detalle-modulo" aria-label="Autenticación requerida">
          <span className="numero">AUTENTICACIÓN REQUERIDA (/API/BACKEND)</span>
          <h3>
            {modoRegistroEncargado
              ? "Crear cuenta de Encargado"
              : "Iniciar sesión para gestionar personal"}
          </h3>
          <p>
            Las operaciones del Módulo 02 se validan con token Bearer en memoria
            contra el servidor de reglas C# y la base compartida PostgreSQL.
          </p>

          <form className="form-grid-personal" onSubmit={manejarAcceso}>
            <div className="campo-grupo">
              <label htmlFor="login-usuario-personal">Usuario *</label>
              <input
                id="login-usuario-personal"
                className="input-personal"
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

            <div className="campo-grupo">
              <label htmlFor="login-password-personal">Contraseña *</label>
              <input
                id="login-password-personal"
                className="input-personal"
                type="password"
                required
                minLength={modoRegistroEncargado ? 8 : 1}
                autoComplete={
                  modoRegistroEncargado ? "new-password" : "current-password"
                }
                value={credencialesForm.password}
                onChange={(e) =>
                  setCredencialesForm((p) => ({ ...p, password: e.target.value }))
                }
              />
            </div>

            <div className="acciones-formulario">
              <button
                type="submit"
                className="btn-personal btn-personal-primario"
                disabled={ocupado}
              >
                {ocupado
                  ? "Conectando con /api/backend…"
                  : modoRegistroEncargado
                  ? "Registrar encargado"
                  : "Ingresar"}
              </button>
              <button
                type="button"
                className="btn-personal"
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
          {/* Formulario de Alta / Edición para Admin y SuperAdmin */}
          {!esEncargado && fichaEdicion && (
            <section
              className="detalle-modulo no-imprimir"
              aria-label={
                fichaEdicion.idPasante
                  ? "Editar ficha de personal"
                  : "Alta de personal"
              }
            >
              <span className="numero">
                {fichaEdicion.idPasante
                  ? `EDICIÓN DE FICHA · ${fichaEdicion.codigo || `ID ${fichaEdicion.idPasante}`}`
                  : "ALTA DE PERSONAL (PERSONAL.GUARDAR)"}
              </span>
              <h3 style={{ marginTop: "10px", marginBottom: "8px", fontSize: "24px" }}>
                {fichaEdicion.idPasante
                  ? `Editar a ${fichaEdicion.nombres} ${fichaEdicion.apellidos}`
                  : "Registrar nueva persona"}
              </h3>
              <p style={{ marginTop: 0 }}>
                Alta mínima: nombres, apellidos y tipo de contrato. El código y la
                fecha de fin son calculados por C#.
              </p>

              <form
                className="form-grid-personal"
                onSubmit={guardarFichaFormulario}
                noValidate
              >
                <div className="campo-grupo">
                  <label htmlFor="ficha-nombres">Nombres *</label>
                  <input
                    id="ficha-nombres"
                    className="input-personal"
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    value={fichaEdicion.nombres}
                    onChange={(e) =>
                      setFichaEdicion((p) => ({ ...p, nombres: e.target.value }))
                    }
                  />
                  {erroresFicha.nombres && (
                    <span className="error-campo">{erroresFicha.nombres}</span>
                  )}
                </div>

                <div className="campo-grupo">
                  <label htmlFor="ficha-apellidos">Apellidos *</label>
                  <input
                    id="ficha-apellidos"
                    className="input-personal"
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    value={fichaEdicion.apellidos}
                    onChange={(e) =>
                      setFichaEdicion((p) => ({ ...p, apellidos: e.target.value }))
                    }
                  />
                  {erroresFicha.apellidos && (
                    <span className="error-campo">{erroresFicha.apellidos}</span>
                  )}
                </div>

                <div className="campo-grupo">
                  <label htmlFor="ficha-tipo-contrato">Tipo de personal *</label>
                  <select
                    id="ficha-tipo-contrato"
                    className="select-personal"
                    value={fichaEdicion.tipoContrato}
                    onChange={(e) => {
                      const nuevoTipo = e.target.value;
                      setFichaEdicion((p) => ({
                        ...p,
                        tipoContrato: nuevoTipo,
                        horasRequeridas:
                          nuevoTipo === "Pasante"
                            ? Number(p.horasRequeridas) > 0
                              ? p.horasRequeridas
                              : HORAS_META_DEFECTO
                            : 0
                      }));
                    }}
                  >
                    {TIPOS_CONTRATO.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {tipo}
                      </option>
                    ))}
                  </select>
                  {erroresFicha.tipoContrato && (
                    <span className="error-campo">{erroresFicha.tipoContrato}</span>
                  )}
                </div>

                <div className="campo-grupo">
                  <label htmlFor="ficha-fecha-inicio">Fecha de ingreso *</label>
                  <input
                    id="ficha-fecha-inicio"
                    className="input-personal"
                    type="date"
                    required
                    disabled={Boolean(fichaEdicion.idPasante) && !esSuperAdmin}
                    value={fichaEdicion.fechaInicio?.slice(0, 10) || ""}
                    onChange={(e) =>
                      setFichaEdicion((p) => ({
                        ...p,
                        fechaInicio: e.target.value
                      }))
                    }
                  />
                  <span className="ayuda-campo">
                    {Boolean(fichaEdicion.idPasante) && !esSuperAdmin
                      ? "Cambiar la fecha de inicio de una persona existente requiere SuperAdmin."
                      : "Formato YYYY-MM-DD (America/La_Paz)."}
                  </span>
                  {erroresFicha.fechaInicio && (
                    <span className="error-campo">{erroresFicha.fechaInicio}</span>
                  )}
                </div>

                <div className="campo-grupo">
                  <label htmlFor="ficha-turno">Turno soportado por C# *</label>
                  <select
                    id="ficha-turno"
                    className="select-personal"
                    value={fichaEdicion.turno || "Tiempo Completo"}
                    onChange={(e) =>
                      setFichaEdicion((p) => ({ ...p, turno: e.target.value }))
                    }
                  >
                    {TURNOS_CSHARP.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  {erroresFicha.turno && (
                    <span className="error-campo">{erroresFicha.turno}</span>
                  )}
                </div>

                <div className="campo-grupo">
                  <label htmlFor="ficha-dias-trabajo">Días de trabajo *</label>
                  <select
                    id="ficha-dias-trabajo"
                    className="select-personal"
                    value={fichaEdicion.diasTrabajo || "Lunes a Viernes"}
                    onChange={(e) =>
                      setFichaEdicion((p) => ({
                        ...p,
                        diasTrabajo: e.target.value
                      }))
                    }
                  >
                    {DIAS_TRABAJO_CSHARP.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  {erroresFicha.diasTrabajo && (
                    <span className="error-campo">{erroresFicha.diasTrabajo}</span>
                  )}
                </div>

                {/* Diferenciación obligatoria: Planta guarda 0 horas; Pasante tiene 600 por defecto */}
                {fichaEdicion.tipoContrato === "Personal de planta" ? (
                  <div className="aceptacion col-completa" style={{ marginTop: "4px" }}>
                    <strong>Personal de planta (horasRequeridas: 0)</strong>
                    <p>
                      El personal de planta no muestra ni guarda meta de horas ni
                      fecha de finalización de pasantía.
                    </p>
                  </div>
                ) : (
                  <div className="bloque-pasantia-nativo">
                    <span className="numero">PARÁMETROS DE PASANTÍA (C#)</span>
                    <h4>Meta de horas requeridas (600 horas por defecto)</h4>
                    <div className="form-grid-personal" style={{ marginTop: 0 }}>
                      <div className="campo-grupo">
                        <label htmlFor="ficha-horas-requeridas">
                          Horas requeridas (1 a 20000) *
                        </label>
                        <input
                          id="ficha-horas-requeridas"
                          className="input-personal"
                          type="number"
                          required
                          min={1}
                          max={20000}
                          value={fichaEdicion.horasRequeridas}
                          onChange={(e) =>
                            setFichaEdicion((p) => ({
                              ...p,
                              horasRequeridas: e.target.value
                            }))
                          }
                        />
                        <span className="ayuda-campo">
                          Valor por defecto: 600 horas (admite 360, 400, 600 u otra
                          meta de 1 a 20000).
                        </span>
                        {erroresFicha.horasRequeridas && (
                          <span className="error-campo">
                            {erroresFicha.horasRequeridas}
                          </span>
                        )}
                      </div>

                      <div className="campo-grupo">
                        <label>Fecha estimada de fin (calculada por C#)</label>
                        <div className="bloque-planta-nativo">
                          {fichaEdicion.fechaFin
                            ? String(fichaEdicion.fechaFin).slice(0, 10)
                            : "Se calculará automáticamente al guardar en C# considerando turno, días de trabajo, feriados e incidencias."}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Datos opcionales de la tabla Personal en PostgreSQL / C# */}
                <details className="detalles-opcionales-personal">
                  <summary>
                    Departamento, identificación, universidad, contacto y foto
                    (opcionales)
                  </summary>
                  <div className="form-grid-personal">
                    <div className="campo-grupo">
                      <label htmlFor="ficha-departamento">
                        Departamento / Área
                      </label>
                      <select
                        id="ficha-departamento"
                        className="select-personal"
                        value={fichaEdicion.idDepartamento ?? ""}
                        onChange={(e) => {
                          const val = e.target.value
                            ? Number(e.target.value)
                            : null;
                          const depto = departamentos.find(
                            (d) => d.idDepartamento === val || d.id === val
                          );
                          setFichaEdicion((p) => ({
                            ...p,
                            idDepartamento: val,
                            nombreDepartamento:
                              depto?.nombre || p.nombreDepartamento || ""
                          }));
                        }}
                      >
                        <option value="">Sin departamento específico</option>
                        {departamentos.map((d) => {
                          const idDep = d.idDepartamento ?? d.id;
                          return (
                            <option key={idDep} value={idDep}>
                              {d.nombre}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="campo-grupo">
                      <label htmlFor="ficha-ci">Cédula de Identidad (CI)</label>
                      <input
                        id="ficha-ci"
                        className="input-personal"
                        type="text"
                        maxLength={20}
                        value={fichaEdicion.ci ?? ""}
                        onChange={(e) =>
                          setFichaEdicion((p) => ({ ...p, ci: e.target.value }))
                        }
                      />
                    </div>

                    <div className="campo-grupo">
                      <label htmlFor="ficha-universidad">
                        Instituto / Universidad
                      </label>
                      <input
                        id="ficha-universidad"
                        className="input-personal"
                        type="text"
                        maxLength={100}
                        value={fichaEdicion.universidad ?? ""}
                        onChange={(e) =>
                          setFichaEdicion((p) => ({
                            ...p,
                            universidad: e.target.value
                          }))
                        }
                      />
                    </div>

                    <div className="campo-grupo">
                      <label htmlFor="ficha-carrera">Carrera</label>
                      <input
                        id="ficha-carrera"
                        className="input-personal"
                        type="text"
                        maxLength={100}
                        value={fichaEdicion.carrera ?? ""}
                        onChange={(e) =>
                          setFichaEdicion((p) => ({
                            ...p,
                            carrera: e.target.value
                          }))
                        }
                      />
                    </div>

                    <div className="campo-grupo">
                      <label htmlFor="ficha-telefono">Teléfono</label>
                      <input
                        id="ficha-telefono"
                        className="input-personal"
                        type="text"
                        maxLength={20}
                        value={fichaEdicion.telefono ?? ""}
                        onChange={(e) =>
                          setFichaEdicion((p) => ({
                            ...p,
                            telefono: e.target.value
                          }))
                        }
                      />
                    </div>

                    <div className="campo-grupo">
                      <label htmlFor="ficha-email">Correo electrónico</label>
                      <input
                        id="ficha-email"
                        className="input-personal"
                        type="email"
                        maxLength={100}
                        value={fichaEdicion.email ?? ""}
                        onChange={(e) =>
                          setFichaEdicion((p) => ({ ...p, email: e.target.value }))
                        }
                      />
                    </div>

                    <div className="campo-grupo col-completa">
                      <label htmlFor="ficha-direccion">Dirección</label>
                      <input
                        id="ficha-direccion"
                        className="input-personal"
                        type="text"
                        maxLength={200}
                        value={fichaEdicion.direccion ?? ""}
                        onChange={(e) =>
                          setFichaEdicion((p) => ({
                            ...p,
                            direccion: e.target.value
                          }))
                        }
                      />
                    </div>

                    <div className="campo-grupo col-completa">
                      <label htmlFor="ficha-foto">
                        Fotografía (JPG, PNG o WebP hasta 3 MB)
                      </label>
                      <input
                        id="ficha-foto"
                        className="input-personal"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => manejarFotoArchivo(e.target.files?.[0])}
                      />
                      {fichaEdicion.foto && (
                        <img
                          className="foto-miniatura-personal"
                          alt="Vista previa de fotografía"
                          src={fotoUrl(fichaEdicion.foto)}
                        />
                      )}
                    </div>
                  </div>
                </details>

                <div className="acciones-formulario">
                  <button
                    type="submit"
                    className="btn-personal btn-personal-primario"
                    disabled={ocupado}
                  >
                    {ocupado ? "Guardando en C#…" : "Guardar ficha"}
                  </button>
                  <button
                    type="button"
                    className="btn-personal"
                    onClick={() => {
                      setFichaEdicion(null);
                      setFichaOriginalEdicion(null);
                      setErroresFicha({});
                    }}
                    disabled={ocupado}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* Vista de credencial imprimible */}
          {credencialActiva && (
            <section
              className="detalle-modulo"
              aria-label="Credencial de identificación"
            >
              <span className="numero no-imprimir">CREDENCIAL DE PERSONAL</span>
              <div className="credencial-tarjeta">
                <strong>SII · OFICINA SANTIAGO II</strong>
                {credencialActiva.foto ? (
                  <img
                    className="foto-miniatura-personal"
                    alt="Foto de identificación"
                    src={fotoUrl(credencialActiva.foto)}
                  />
                ) : (
                  <span className="ayuda-campo">Sin fotografía registrada</span>
                )}
                <h3 style={{ margin: "6px 0" }}>
                  {credencialActiva.nombres} {credencialActiva.apellidos}
                </h3>
                <p style={{ margin: 0 }}>
                  {credencialActiva.tipoContrato} · Código:{" "}
                  <strong>{credencialActiva.codigo}</strong>
                </p>
                {credencialActiva.ci && (
                  <p style={{ margin: 0 }}>CI: {credencialActiva.ci}</p>
                )}
                {credencialActiva.nombreDepartamento && (
                  <p style={{ margin: 0 }}>
                    Área: {credencialActiva.nombreDepartamento}
                  </p>
                )}
                {credencialActiva.universidad && (
                  <p style={{ margin: 0 }}>{credencialActiva.universidad}</p>
                )}
                {credencialActiva.carrera && (
                  <p style={{ margin: 0 }}>{credencialActiva.carrera}</p>
                )}
                {credencialActiva.fechaInicio && (
                  <p style={{ margin: 0 }}>
                    Ingreso: {String(credencialActiva.fechaInicio).slice(0, 10)}
                  </p>
                )}
                {credencialActiva.tipoContrato === "Pasante" && (
                  <p style={{ margin: 0 }}>
                    Meta requerida: {credencialActiva.horasRequeridas} horas
                  </p>
                )}
              </div>
              <div className="acciones-formulario no-imprimir">
                <button
                  type="button"
                  className="btn-personal btn-personal-primario"
                  onClick={() => window.print()}
                >
                  Imprimir credencial / Guardar PDF
                </button>
                <button
                  type="button"
                  className="btn-personal"
                  onClick={() => setCredencialActiva(null)}
                >
                  Cerrar credencial
                </button>
              </div>
            </section>
          )}

          {/* Detalle individual real desde reportes.individual */}
          {reporteIndividual && (
            <section
              className="detalle-modulo no-imprimir"
              aria-label="Detalle e historial individual"
            >
              <span className="numero">
                HISTORIAL Y SEGUIMIENTO REAL (REPORTES.INDIVIDUAL)
              </span>
              <h3>
                {reporteIndividual.personal?.nombres}{" "}
                {reporteIndividual.personal?.apellidos} (
                {reporteIndividual.personal?.codigo})
              </h3>
              <div className="etiquetas">
                <span>
                  Asistencias registradas:{" "}
                  {Array.isArray(reporteIndividual.asistencias)
                    ? reporteIndividual.asistencias.length
                    : 0}
                </span>
                <span>
                  Asignaciones a proyectos:{" "}
                  {Array.isArray(reporteIndividual.proyectos)
                    ? reporteIndividual.proyectos.length
                    : 0}
                </span>
                <span>
                  Viáticos registrados:{" "}
                  {Array.isArray(reporteIndividual.viaticos)
                    ? reporteIndividual.viaticos.length
                    : 0}
                </span>
              </div>
              <div className="acciones-formulario">
                <button
                  type="button"
                  className="btn-personal"
                  onClick={() => setReporteIndividual(null)}
                >
                  Cerrar detalle individual
                </button>
              </div>
            </section>
          )}

          {/* Barra de búsqueda, modo de consulta y comprobación de código */}
          <section
            className="detalle-modulo no-imprimir"
            aria-label="Búsqueda y filtros"
          >
            <div className="filtros-grid-personal">
              <div className="campo-grupo">
                <label htmlFor="filtro-busqueda-personal">
                  Buscar por nombres, apellidos, código o CI
                </label>
                <input
                  id="filtro-busqueda-personal"
                  className="input-personal"
                  type="search"
                  placeholder="Escriba para filtrar…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>

              {!esEncargado && (
                <>
                  <div className="campo-grupo">
                    <label htmlFor="filtro-tipo-contrato">Tipo de contrato</label>
                    <select
                      id="filtro-tipo-contrato"
                      className="select-personal"
                      value={filtroTipoContrato}
                      onChange={(e) => setFiltroTipoContrato(e.target.value)}
                    >
                      <option value="todos">Todos</option>
                      <option value="Pasante">Solo Pasante</option>
                      <option value="Personal de planta">
                        Solo Personal de planta
                      </option>
                    </select>
                  </div>

                  <div className="campo-grupo">
                    <label htmlFor="filtro-origen-lista">
                      Consulta en servidor
                    </label>
                    <select
                      id="filtro-origen-lista"
                      className="select-personal"
                      value={modoListado}
                      onChange={(e) => setModoListado(e.target.value)}
                    >
                      <option value="historico">
                        personal.historico (Activas e inactivas)
                      </option>
                      <option value="activos">
                        personal.listar (Solo activas)
                      </option>
                    </select>
                  </div>

                  <div className="campo-grupo">
                    <label htmlFor="filtro-estado-activo">Estado en vista</label>
                    <select
                      id="filtro-estado-activo"
                      className="select-personal"
                      value={filtroEstadoActivo}
                      onChange={(e) => setFiltroEstadoActivo(e.target.value)}
                    >
                      <option value="todos">Activas e inactivas</option>
                      <option value="activos">Solo activas</option>
                      <option value="inactivos">Solo inactivas (baja)</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            {!esEncargado && (
              <div
                className="form-grid-personal"
                style={{ marginTop: "16px", alignItems: "end" }}
              >
                <div className="campo-grupo">
                  <label htmlFor="input-verificar-codigo">
                    Verificar existencia de código (personal.existe)
                  </label>
                  <input
                    id="input-verificar-codigo"
                    className="input-personal"
                    type="text"
                    placeholder="Ej. P0001"
                    value={codigoVerificar}
                    onChange={(e) => setCodigoVerificar(e.target.value)}
                  />
                </div>
                <div>
                  <button
                    type="button"
                    className="btn-personal"
                    onClick={comprobarCodigoExistente}
                    disabled={ocupado || !codigoVerificar.trim()}
                  >
                    Comprobar código
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Listado de tarjetas de personal */}
          <section aria-label="Listado de personal">
            {ocupado && personal.length === 0 ? (
              <div className="detalle-modulo">
                <p>Consultando datos en /api/backend…</p>
              </div>
            ) : personalFiltrado.length === 0 ? (
              <div className="detalle-modulo">
                <span className="numero">SIN REGISTROS EN VISTA</span>
                <h3>No hay personas que coincidan con los filtros actuales</h3>
                <p>
                  Puede cambiar los filtros o registrar una nueva persona mediante{" "}
                  <code>personal.guardar</code>.
                </p>
              </div>
            ) : (
              <div className="grid-fichas-personal">
                {personalFiltrado.map((persona) => {
                  const clave =
                    persona.idPasante ??
                    persona.codigo ??
                    `${persona.nombres}-${persona.apellidos}`;
                  const inactiva = persona.activo === false;
                  const esPasante = persona.tipoContrato === "Pasante";
                  const minutosReales =
                    seguimientoMap[`id:${persona.idPasante}`] ??
                    seguimientoMap[`cod:${persona.codigo}`] ??
                    persona.minutosTrabajados ??
                    persona.minutosTotales ??
                    0;
                  const avance = calcularAvanceDesdeMinutos(
                    persona,
                    minutosReales
                  );

                  return (
                    <article
                      key={clave}
                      className={`tarjeta-persona ${inactiva ? "en-baja" : ""}`}
                    >
                      <div className="tarjeta-persona-cabecera">
                        <span className="numero">
                          {persona.codigo || `ID ${persona.idPasante}`} ·{" "}
                          {persona.tipoContrato || "Personal"}
                        </span>
                        <span
                          className={`pildora-estado ${inactiva ? "baja" : ""}`}
                        >
                          {inactiva ? "Inactiva (Baja)" : "Activa"}
                        </span>
                      </div>

                      <div className="tarjeta-persona-identidad">
                        {persona.foto && (
                          <img
                            className="foto-miniatura-personal"
                            alt={`Foto de ${persona.nombres}`}
                            src={fotoUrl(persona.foto)}
                          />
                        )}
                        <div>
                          <h3>
                            {persona.nombreCompleto ||
                              `${persona.nombres || ""} ${
                                persona.apellidos || ""
                              }`.trim()}
                          </h3>
                          <p className="submeta">
                            {persona.turno || "Sin turno especificado"}
                            {persona.diasTrabajo ? ` · ${persona.diasTrabajo}` : ""}
                            {persona.fechaInicio
                              ? ` · Ingreso: ${String(persona.fechaInicio).slice(
                                  0,
                                  10
                                )}`
                              : ""}
                          </p>
                          {(persona.nombreDepartamento ||
                            persona.ci ||
                            persona.universidad) && (
                            <div
                              className="etiquetas"
                              style={{ marginTop: "8px" }}
                            >
                              {persona.nombreDepartamento && (
                                <span>{persona.nombreDepartamento}</span>
                              )}
                              {persona.ci && <span>CI: {persona.ci}</span>}
                              {persona.universidad && (
                                <span>{persona.universidad}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Regla estricta: Pasante muestra meta y avance desde asistencias reales; Planta muestra 0 horas */}
                      {esPasante && avance ? (
                        <div className="bloque-progreso-nativo">
                          <div className="fila-progreso">
                            <span>
                              Cumplido (asistencias reales):{" "}
                              {avance.cumplido.texto} de {avance.horasRequeridas} h
                            </span>
                            <span>{avance.porcentaje}%</span>
                          </div>
                          <div
                            className="barra-nativa-fondo"
                            role="progressbar"
                            aria-valuenow={avance.porcentaje}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          >
                            <div
                              className="barra-nativa-relleno"
                              style={{ width: `${avance.porcentaje}%` }}
                            />
                          </div>
                          <div className="datos-pasantia-grid">
                            <span>
                              <strong>Pendiente:</strong> {avance.pendiente.texto}
                            </span>
                            <span>
                              <strong>Fin estimado (C#):</strong>{" "}
                              {persona.fechaFin
                                ? String(persona.fechaFin).slice(0, 10)
                                : "Por calcular"}
                            </span>
                          </div>
                        </div>
                      ) : !esEncargado ? (
                        <div className="bloque-planta-nativo">
                          <strong>Personal de planta:</strong> horasRequeridas:{" "}
                          {persona.horasRequeridas ?? 0} · Sin meta de horas ni fin
                          de pasantía.
                        </div>
                      ) : null}

                      {!esEncargado && (
                        <div className="acciones-tarjeta no-imprimir">
                          <button
                            type="button"
                            className="btn-personal"
                            onClick={() => abrirEdicionCompleta(persona)}
                            disabled={ocupado}
                          >
                            Editar ficha
                          </button>

                          {esPasante && persona.idPasante && (
                            <button
                              type="button"
                              className="btn-personal btn-personal-secundario"
                              onClick={() => recalcularFinPasante(persona)}
                              disabled={ocupado}
                            >
                              Recalcular fin
                            </button>
                          )}

                          {!inactiva && persona.idPasante ? (
                            <button
                              type="button"
                              className="btn-personal btn-personal-baja"
                              onClick={() => darDeBajaLogica(persona)}
                              disabled={ocupado}
                            >
                              Dar de baja
                            </button>
                          ) : (
                            inactiva && (
                              <button
                                type="button"
                                className="btn-personal btn-personal-secundario"
                                onClick={() => reactivarPersona(persona)}
                                disabled={ocupado}
                              >
                                Reactivar
                              </button>
                            )
                          )}

                          {persona.idPasante && (
                            <button
                              type="button"
                              className="btn-personal"
                              onClick={() => abrirDetalleIndividual(persona)}
                              disabled={ocupado}
                            >
                              Historial real
                            </button>
                          )}

                          <button
                            type="button"
                            className="btn-personal"
                            onClick={() => setCredencialActiva(persona)}
                          >
                            Credencial
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
