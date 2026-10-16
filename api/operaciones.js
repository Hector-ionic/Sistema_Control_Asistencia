import {
  mockPersonal,
  mockProyectos,
  mockAsignaciones,
  mockViaticos,
  mockAuditoria,
  REGLAS_VIATICOS_VIGENTES
} from "../src/modules/operaciones/mocks/datosPrueba.js";
import {
  validarProyecto,
  ejecutarCierreProyecto,
  validarAsignacion,
  validarViatico,
  ejecutarBajaViatico,
  calcularTotalesYResumenReportes,
  obtenerFechaHoraLaPaz
} from "../src/modules/operaciones/utils/reglasOperaciones.js";

// Estado en memoria del endpoint para pruebas de integración y despliegue serverless
let estadoMemoria = crearEstadoInicial();

function crearEstadoInicial() {
  return {
    personal: structuredClone(mockPersonal),
    proyectos: structuredClone(mockProyectos),
    asignaciones: structuredClone(mockAsignaciones),
    viaticos: structuredClone(mockViaticos),
    auditoria: structuredClone(mockAuditoria)
  };
}

export function reiniciarMemoriaOperaciones() {
  estadoMemoria = crearEstadoInicial();
}

function registrarEventoAuditoria({ usuario = "operador.sii", rol = "operador", accion, entidad, detalle }) {
  const nuevoEvento = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    fechaHora: obtenerFechaHoraLaPaz(),
    zonaHoraria: "America/La_Paz",
    usuario,
    rol,
    accion,
    entidad,
    detalle
  };
  estadoMemoria.auditoria = [nuevoEvento, ...estadoMemoria.auditoria];
  return nuevoEvento;
}

function responderJson(res, codigo, cuerpo) {
  res.statusCode = codigo;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify(cuerpo));
}

export default function handler(req, res) {
  const metodo = req.method || "GET";
  const rolHeader = String(req.headers?.["x-rol-usuario"] || req.body?.rolUsuario || "administrador").toLowerCase();
  const usuarioHeader = String(req.headers?.["x-usuario"] || req.body?.usuario || (rolHeader === "administrador" ? "admin.sii" : "operador.sii"));

  if (metodo === "GET") {
    const urlObj = new URL(req.url || "/api/operaciones", "http://localhost");
    const accion = urlObj.searchParams.get("accion");

    if (accion === "resumen-reportes") {
      const filtros = {
        idProyecto: urlObj.searchParams.get("idProyecto") || "",
        idPersonal: urlObj.searchParams.get("idPersonal") || "",
        fechaDesde: urlObj.searchParams.get("fechaDesde") || "",
        fechaHasta: urlObj.searchParams.get("fechaHasta") || ""
      };
      const resumen = calcularTotalesYResumenReportes({
        proyectos: estadoMemoria.proyectos,
        personal: estadoMemoria.personal,
        asignaciones: estadoMemoria.asignaciones,
        viaticos: estadoMemoria.viaticos,
        filtros
      });
      return responderJson(res, 200, { ok: true, modulo: "operaciones", resumen });
    }

    const totales = calcularTotalesYResumenReportes({
      proyectos: estadoMemoria.proyectos,
      personal: estadoMemoria.personal,
      asignaciones: estadoMemoria.asignaciones,
      viaticos: estadoMemoria.viaticos
    });

    return responderJson(res, 200, {
      ok: true,
      modulo: "operaciones",
      reglasViaticos: REGLAS_VIATICOS_VIGENTES,
      personal: estadoMemoria.personal,
      proyectos: estadoMemoria.proyectos,
      asignaciones: estadoMemoria.asignaciones,
      viaticos: estadoMemoria.viaticos,
      auditoria: estadoMemoria.auditoria,
      totales
    });
  }

  if (metodo === "POST") {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { tipoOperacion, datos } = body;

    if (tipoOperacion === "GUARDAR_PROYECTO") {
      const idEdicion = datos?.id ? Number(datos.id) : null;
      const validacion = validarProyecto(datos, estadoMemoria.proyectos, idEdicion);
      if (!validacion.valido) {
        return responderJson(res, 400, {
          ok: false,
          mensaje: "Datos del proyecto inválidos.",
          errores: validacion.errores
        });
      }

      if (idEdicion) {
        estadoMemoria.proyectos = estadoMemoria.proyectos.map((p) =>
          Number(p.id) === idEdicion
            ? {
                ...p,
                nombre: datos.nombre.trim(),
                descripcion: datos.descripcion.trim(),
                ubicacion: datos.ubicacion.trim(),
                fechaInicio: datos.fechaInicio,
                fechaFin: datos.fechaFin,
                estado: datos.estado || p.estado,
                presupuestoViaticos: Number(datos.presupuestoViaticos || 0)
              }
            : p
        );
        registrarEventoAuditoria({
          usuario: usuarioHeader,
          rol: rolHeader,
          accion: "EDICION_PROYECTO",
          entidad: `Proyecto #${idEdicion}`,
          detalle: `Actualización de proyecto '${datos.nombre.trim()}' (${datos.fechaInicio} al ${datos.fechaFin}).`
        });
        return responderJson(res, 200, { ok: true, proyectos: estadoMemoria.proyectos, auditoria: estadoMemoria.auditoria });
      }

      const nuevoId = estadoMemoria.proyectos.reduce((max, p) => Math.max(max, Number(p.id)), 100) + 1;
      const correlativo = String(estadoMemoria.proyectos.length + 1).padStart(2, "0");
      const nuevoProyecto = {
        id: nuevoId,
        codigo: datos.codigo || `PRY-2026-${correlativo}`,
        nombre: datos.nombre.trim(),
        descripcion: datos.descripcion.trim(),
        ubicacion: datos.ubicacion.trim(),
        estado: datos.estado || "Activo",
        fechaInicio: datos.fechaInicio,
        fechaFin: datos.fechaFin,
        presupuestoViaticos: Number(datos.presupuestoViaticos || 0)
      };
      estadoMemoria.proyectos = [nuevoProyecto, ...estadoMemoria.proyectos];
      registrarEventoAuditoria({
        usuario: usuarioHeader,
        rol: rolHeader,
        accion: "ALTA_PROYECTO",
        entidad: `Proyecto #${nuevoId}`,
        detalle: `Alta de proyecto '${nuevoProyecto.nombre}' (${nuevoProyecto.fechaInicio} al ${nuevoProyecto.fechaFin}).`
      });
      return responderJson(res, 201, {
        ok: true,
        proyecto: nuevoProyecto,
        proyectos: estadoMemoria.proyectos,
        auditoria: estadoMemoria.auditoria
      });
    }

    if (tipoOperacion === "CERRAR_PROYECTO") {
      const resultado = ejecutarCierreProyecto({
        idProyecto: datos?.idProyecto,
        motivoCierre: datos?.motivoCierre,
        rolUsuario: rolHeader,
        proyectos: estadoMemoria.proyectos,
        asignaciones: estadoMemoria.asignaciones
      });

      if (!resultado.ok) {
        return responderJson(res, resultado.codigo, { ok: false, mensaje: resultado.mensaje });
      }

      estadoMemoria.proyectos = resultado.proyectos;
      estadoMemoria.asignaciones = resultado.asignaciones;
      registrarEventoAuditoria({
        usuario: usuarioHeader,
        rol: rolHeader,
        accion: "CIERRE_PROYECTO",
        entidad: `Proyecto #${datos.idProyecto}`,
        detalle: `${resultado.resumen} Motivo: ${datos.motivoCierre.trim()}`
      });

      return responderJson(res, 200, {
        ok: true,
        mensaje: resultado.resumen,
        proyectos: estadoMemoria.proyectos,
        asignaciones: estadoMemoria.asignaciones,
        auditoria: estadoMemoria.auditoria
      });
    }

    if (tipoOperacion === "GUARDAR_ASIGNACION") {
      const idEdicion = datos?.id ? Number(datos.id) : null;
      const validacion = validarAsignacion(
        datos,
        estadoMemoria.proyectos,
        estadoMemoria.asignaciones,
        idEdicion
      );

      if (!validacion.valido) {
        return responderJson(res, 400, {
          ok: false,
          mensaje: Object.values(validacion.errores)[0] || "Asignación inválida.",
          errores: validacion.errores
        });
      }

      if (idEdicion) {
        estadoMemoria.asignaciones = estadoMemoria.asignaciones.map((a) =>
          Number(a.id) === idEdicion
            ? {
                ...a,
                idProyecto: Number(datos.idProyecto),
                idPersonal: Number(datos.idPersonal),
                funcion: datos.funcion.trim(),
                fechaInicio: datos.fechaInicio,
                fechaFin: datos.fechaFin,
                estado: datos.estado || a.estado
              }
            : a
        );
        registrarEventoAuditoria({
          usuario: usuarioHeader,
          rol: rolHeader,
          accion: "EDICION_ASIGNACION",
          entidad: `Asignación #${idEdicion}`,
          detalle: `Actualización de asignación en Proyecto #${datos.idProyecto} (${datos.funcion.trim()}).`
        });
        return responderJson(res, 200, {
          ok: true,
          asignaciones: estadoMemoria.asignaciones,
          auditoria: estadoMemoria.auditoria
        });
      }

      const nuevoId = estadoMemoria.asignaciones.reduce((max, a) => Math.max(max, Number(a.id)), 300) + 1;
      const nuevaAsignacion = {
        id: nuevoId,
        idProyecto: Number(datos.idProyecto),
        idPersonal: Number(datos.idPersonal),
        funcion: datos.funcion.trim(),
        fechaInicio: datos.fechaInicio,
        fechaFin: datos.fechaFin,
        estado: "Activa"
      };
      estadoMemoria.asignaciones = [nuevaAsignacion, ...estadoMemoria.asignaciones];
      registrarEventoAuditoria({
        usuario: usuarioHeader,
        rol: rolHeader,
        accion: "ALTA_ASIGNACION",
        entidad: `Asignación #${nuevoId}`,
        detalle: `Persona #${nuevaAsignacion.idPersonal} asignada a Proyecto #${nuevaAsignacion.idProyecto} (${nuevaAsignacion.fechaInicio} al ${nuevaAsignacion.fechaFin}).`
      });

      return responderJson(res, 201, {
        ok: true,
        asignacion: nuevaAsignacion,
        asignaciones: estadoMemoria.asignaciones,
        auditoria: estadoMemoria.auditoria
      });
    }

    if (tipoOperacion === "GUARDAR_VIATICO") {
      const idEdicion = datos?.id ? Number(datos.id) : null;
      const validacion = validarViatico(
        datos,
        estadoMemoria.proyectos,
        estadoMemoria.asignaciones,
        REGLAS_VIATICOS_VIGENTES
      );

      if (!validacion.valido) {
        return responderJson(res, 400, {
          ok: false,
          mensaje: Object.values(validacion.errores)[0] || "Viático inválido.",
          errores: validacion.errores
        });
      }

      if (idEdicion) {
        estadoMemoria.viaticos = estadoMemoria.viaticos.map((v) =>
          Number(v.id) === idEdicion
            ? {
                ...v,
                idProyecto: Number(datos.idProyecto),
                idPersonal: Number(datos.idPersonal),
                categoria: datos.categoria,
                monto: Number(datos.monto),
                esGastoAdicional: Boolean(datos.esGastoAdicional),
                montoAdicional: datos.esGastoAdicional ? Number(datos.montoAdicional || 0) : 0,
                comprobante: String(datos.comprobante || "").trim(),
                descripcion: datos.descripcion.trim(),
                justificacionAdicional: datos.esGastoAdicional ? String(datos.justificacionAdicional || "").trim() : "",
                fecha: datos.fecha
              }
            : v
        );
        registrarEventoAuditoria({
          usuario: usuarioHeader,
          rol: rolHeader,
          accion: "EDICION_VIATICO",
          entidad: `Viático #${idEdicion}`,
          detalle: `Actualización de viático (${datos.categoria}) en Proyecto #${datos.idProyecto}.`
        });
        return responderJson(res, 200, {
          ok: true,
          viaticos: estadoMemoria.viaticos,
          auditoria: estadoMemoria.auditoria
        });
      }

      const nuevoId = estadoMemoria.viaticos.reduce((max, v) => Math.max(max, Number(v.id)), 500) + 1;
      const nuevoViatico = {
        id: nuevoId,
        idProyecto: Number(datos.idProyecto),
        idPersonal: Number(datos.idPersonal),
        categoria: datos.categoria,
        monto: Number(datos.monto),
        esGastoAdicional: Boolean(datos.esGastoAdicional),
        montoAdicional: datos.esGastoAdicional ? Number(datos.montoAdicional || 0) : 0,
        comprobante: String(datos.comprobante || "").trim(),
        descripcion: datos.descripcion.trim(),
        justificacionAdicional: datos.esGastoAdicional ? String(datos.justificacionAdicional || "").trim() : "",
        fecha: datos.fecha,
        estado: "Vigente",
        autorizadoPor: rolHeader === "administrador" ? "Administrador" : "Operador"
      };
      estadoMemoria.viaticos = [nuevoViatico, ...estadoMemoria.viaticos];
      registrarEventoAuditoria({
        usuario: usuarioHeader,
        rol: rolHeader,
        accion: "ALTA_VIATICO",
        entidad: `Viático #${nuevoId}`,
        detalle: `Alta de viático (${nuevoViatico.categoria}) por Bs ${nuevoViatico.monto.toFixed(2)} en Proyecto #${nuevoViatico.idProyecto}.`
      });

      return responderJson(res, 201, {
        ok: true,
        viatico: nuevoViatico,
        viaticos: estadoMemoria.viaticos,
        auditoria: estadoMemoria.auditoria
      });
    }

    if (tipoOperacion === "BAJA_VIATICO") {
      const resultado = ejecutarBajaViatico({
        idViatico: datos?.idViatico,
        motivoBaja: datos?.motivoBaja,
        rolUsuario: rolHeader,
        viaticos: estadoMemoria.viaticos
      });

      if (!resultado.ok) {
        return responderJson(res, resultado.codigo, { ok: false, mensaje: resultado.mensaje });
      }

      estadoMemoria.viaticos = resultado.viaticos;
      registrarEventoAuditoria({
        usuario: usuarioHeader,
        rol: rolHeader,
        accion: "BAJA_VIATICO",
        entidad: `Viático #${datos.idViatico}`,
        detalle: `${resultado.resumen} Motivo: ${datos.motivoBaja.trim()}`
      });

      return responderJson(res, 200, {
        ok: true,
        mensaje: resultado.resumen,
        viaticos: estadoMemoria.viaticos,
        auditoria: estadoMemoria.auditoria
      });
    }

    return responderJson(res, 400, { ok: false, mensaje: "Tipo de operación no reconocido." });
  }

  res.setHeader("Allow", "GET, POST");
  return responderJson(res, 405, { ok: false, mensaje: "Método no permitido" });
}
