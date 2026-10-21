// src/modules/operaciones/components/TotalesReportesPanel.jsx
import React, { useState } from "react";
import { calcularTotalesYResumenReportes } from "../utils/reglasOperaciones.js";

export default function TotalesReportesPanel({
  proyectos = [],
  personal = [],
  asignaciones = [],
  viaticos = [],
  auditoria = [],
  rolActual = "SuperAdmin"
}) {
  const [filtros, setFiltros] = useState({
    idProyecto: "",
    idPasante: "",
    inicio: "",
    fin: ""
  });

  const [mostrarContratoJson, setMostrarContratoJson] = useState(false);

  const resumen = calcularTotalesYResumenReportes({
    proyectos,
    personal,
    asignaciones,
    viaticos,
    filtros
  });

  const handleFiltroChange = (e) => {
    const { name, value } = e.target;
    setFiltros((prev) => ({ ...prev, [name]: value }));
  };

  const limpiarFiltros = () => {
    setFiltros({
      idProyecto: "",
      idPasante: "",
      inicio: "",
      fin: ""
    });
  };

  const exportarCsvConciliado = () => {
    const encabezados = [
      "idViatico",
      "fecha",
      "idPasante",
      "codigo",
      "persona",
      "tipoContrato",
      "concepto",
      "monto_Bs",
      "gastoExtra_Bs",
      "total_Bs"
    ];

    const filas = resumen.registrosConciliados.map((v) => {
      const per = personal.find(
        (p) => Number(p.idPasante) === Number(v.idPasante)
      );
      const base = Number(v.monto || 0);
      const extra = Number(v.gastoExtra || 0);
      return [
        v.idViatico,
        v.fecha,
        v.idPasante,
        per?.codigo || "",
        `"${per ? `${per.nombres} ${per.apellidos}` : ""}"`,
        `"${per?.tipoContrato || ""}"`,
        `"${(v.concepto || "").replace(/"/g, '""')}"`,
        base.toFixed(2),
        extra.toFixed(2),
        (base + extra).toFixed(2)
      ].join(",");
    });

    const contenido = "\uFEFF" + [encabezados.join(","), ...filas].join("\n");
    const blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = `conciliacion-operaciones-mod05-${resumen.generadoEn.slice(0, 10)}.csv`;
    enlace.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Filtros de Totales y Reportes */}
      <section
        className="op-form-panel op-no-print"
        aria-labelledby="titulo-filtros-totales"
      >
        <div className="op-card-header" style={{ marginBottom: "12px" }}>
          <h3 id="titulo-filtros-totales" style={{ margin: 0 }}>
            Filtros por Proyecto, Persona y Período
          </h3>
          <button
            type="button"
            className="op-btn op-btn-secundario"
            onClick={limpiarFiltros}
          >
            Limpiar filtros
          </button>
        </div>

        <div className="op-form-grid">
          <div className="op-campo">
            <label className="op-label" htmlFor="filtro-proyecto">
              Filtrar por Proyecto
            </label>
            <select
              id="filtro-proyecto"
              name="idProyecto"
              className="op-select"
              value={filtros.idProyecto}
              onChange={handleFiltroChange}
            >
              <option value="">Todos los proyectos</option>
              {proyectos.map((p) => (
                <option key={p.idProyecto} value={p.idProyecto}>
                  {p.codigo} · {p.nombre} ({p.estado})
                </option>
              ))}
            </select>
          </div>

          <div className="op-campo">
            <label className="op-label" htmlFor="filtro-pasante">
              Filtrar por Persona
            </label>
            <select
              id="filtro-pasante"
              name="idPasante"
              className="op-select"
              value={filtros.idPasante}
              onChange={handleFiltroChange}
            >
              <option value="">Todo el personal</option>
              {personal.map((per) => (
                <option key={per.idPasante} value={per.idPasante}>
                  [{per.codigo}] {per.nombres} {per.apellidos} ({per.tipoContrato})
                </option>
              ))}
            </select>
          </div>

          <div className="op-campo">
            <label className="op-label" htmlFor="filtro-inicio">
              Período desde
            </label>
            <input
              id="filtro-inicio"
              name="inicio"
              type="date"
              className="op-input"
              value={filtros.inicio}
              onChange={handleFiltroChange}
            />
          </div>

          <div className="op-campo">
            <label className="op-label" htmlFor="filtro-fin">
              Período hasta
            </label>
            <input
              id="filtro-fin"
              name="fin"
              type="date"
              className="op-input"
              value={filtros.fin}
              onChange={handleFiltroChange}
            />
          </div>
        </div>

        <div className="op-card-acciones" style={{ marginTop: "14px" }}>
          <button
            type="button"
            className="op-btn op-btn-primario"
            onClick={exportarCsvConciliado}
          >
            Exportar CSV conciliado
          </button>
          <button
            type="button"
            className="op-btn op-btn-secundario"
            onClick={() => window.print()}
          >
            Impresión A4 / PDF
          </button>
          <button
            type="button"
            className="op-btn op-btn-secundario"
            onClick={() => setMostrarContratoJson((prev) => !prev)}
          >
            {mostrarContratoJson
              ? "Ocultar datos de enlace con Reportes"
              : "Ver enlace de datos para Reportes"}
          </button>
        </div>
      </section>

      {/* Resumen de totales del período */}
      <div className="op-kpis" aria-label="Totales conciliados en el período">
        <div className="op-kpi-card">
          <span className="op-kpi-etiqueta">Total Viáticos Conciliado</span>
          <strong className="op-kpi-valor">
            {resumen.moneda}{" "}
            {resumen.resumenGlobal.totalGeneralConciliado.toFixed(2)}
          </strong>
          <span className="op-kpi-sub">
            {resumen.resumenGlobal.cantidadViaticos} registro(s) en el período
          </span>
        </div>

        <div className="op-kpi-card">
          <span className="op-kpi-etiqueta">Viático Base</span>
          <strong className="op-kpi-valor">
            {resumen.moneda} {resumen.resumenGlobal.totalMontoBase.toFixed(2)}
          </strong>
          <span className="op-kpi-sub">Tope base vigente: hasta 12.00 Bs</span>
        </div>

        <div className="op-kpi-card">
          <span className="op-kpi-etiqueta">Gastos Adicionales</span>
          <strong className="op-kpi-valor">
            {resumen.moneda} {resumen.resumenGlobal.totalGastoExtra.toFixed(2)}
          </strong>
          <span className="op-kpi-sub">Gastos extraordinarios registrados</span>
        </div>

        <div className="op-kpi-card">
          <span className="op-kpi-etiqueta">Participaciones en Rango</span>
          <strong className="op-kpi-valor">
            {resumen.resumenGlobal.totalAsignacionesEnPeriodo}
          </strong>
          <span className="op-kpi-sub">Asignaciones en el período</span>
        </div>
      </div>

      {mostrarContratoJson && (
        <section
          className="op-form-panel op-no-print"
          aria-label="Contrato JSON para Módulo 04"
        >
          <h4 style={{ marginTop: 0, marginBottom: "8px" }}>
            Datos conciliados para el Módulo 04 (Historial y reportes)
          </h4>
          <pre
            style={{
              background: "#173c32",
              color: "#e8efdf",
              padding: "14px",
              borderRadius: "8px",
              fontSize: "12px",
              overflowX: "auto",
              maxHeight: "260px",
              margin: 0
            }}
          >
            {JSON.stringify(resumen, null, 2)}
          </pre>
        </section>
      )}

      {/* Totales por Proyecto */}
      <h3 style={{ marginTop: "20px", marginBottom: "10px" }}>
        Totales por Proyecto
      </h3>
      <div
        className="op-tabla-wrapper"
        role="region"
        aria-label="Tabla de totales por proyecto"
        tabIndex={0}
      >
        <table className="op-tabla">
          <thead>
            <tr>
              <th>Proyecto</th>
              <th>Cliente</th>
              <th>Estado</th>
              <th>Período</th>
              <th>Participaciones</th>
              <th>Base ({resumen.moneda})</th>
              <th>Adicional ({resumen.moneda})</th>
              <th>Total ({resumen.moneda})</th>
            </tr>
          </thead>
          <tbody>
            {resumen.porProyecto.map((p) => (
              <tr key={p.idProyecto}>
                <td>
                  <strong>{p.nombre}</strong>
                  <div style={{ fontSize: "12px", color: "#5d705e" }}>
                    {p.codigo}
                  </div>
                </td>
                <td>{p.cliente || "—"}</td>
                <td>{p.estado}</td>
                <td>{p.periodo}</td>
                <td>
                  {p.participantesCount} ({p.activosCount} act.)
                </td>
                <td>{p.totalBase.toFixed(2)}</td>
                <td>{p.totalGastoExtra.toFixed(2)}</td>
                <td>
                  <strong>{p.totalViaticos.toFixed(2)}</strong> ({p.viaticosCount}{" "}
                  reg.)
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totales por Persona */}
      <h3 style={{ marginTop: "24px", marginBottom: "10px" }}>
        Totales por Persona
      </h3>
      <div
        className="op-tabla-wrapper"
        role="region"
        aria-label="Tabla de totales por persona"
        tabIndex={0}
      >
        <table className="op-tabla">
          <thead>
            <tr>
              <th>Persona</th>
              <th>Tipo de Personal</th>
              <th>Meta Horas</th>
              <th>Asignaciones</th>
              <th>Base ({resumen.moneda})</th>
              <th>Adicional ({resumen.moneda})</th>
              <th>Total Conciliado ({resumen.moneda})</th>
            </tr>
          </thead>
          <tbody>
            {resumen.porPersona.map((per) => (
              <tr key={per.idPasante}>
                <td>
                  <strong>{per.nombreCompleto}</strong>
                  <div style={{ fontSize: "12px", color: "#5d705e" }}>
                    Código: {per.codigo}
                  </div>
                </td>
                <td>
                  <span
                    className={`op-badge ${
                      per.tipoContrato === "Pasante"
                        ? "op-badge-pasante"
                        : "op-badge-planta"
                    }`}
                  >
                    {per.tipoContrato}
                  </span>
                </td>
                <td>
                  {per.aplicaMetaPasantia
                    ? `${per.horasRequeridas} h`
                    : "Sin meta"}
                </td>
                <td>{per.asignacionesCount}</td>
                <td>{per.totalBase.toFixed(2)}</td>
                <td>{per.totalGastoExtra.toFixed(2)}</td>
                <td>
                  <strong>{per.totalViaticosConciliado.toFixed(2)}</strong> (
                  {per.viaticosCount} reg.)
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bitácora de Auditoría */}
      <h3 style={{ marginTop: "26px", marginBottom: "10px" }}>
        Auditoría de Operaciones
      </h3>
      {rolActual !== "SuperAdmin" ? (
        <div className="op-alerta op-alerta-info">
          <span>
            La consulta del historial completo de auditoría está reservada para el rol{" "}
            <strong>SuperAdmin</strong> (rol actual: <strong>{rolActual}</strong>).
          </span>
        </div>
      ) : (
        <div className="op-lista-grid">
          {auditoria.map((evento) => (
            <article key={evento.idAuditoria || evento.id} className="op-card">
              <div className="op-card-header">
                <span className="op-badge">{evento.operacion || evento.accion}</span>
                <span
                  style={{
                    fontSize: "12px",
                    color: "#556857",
                    fontFamily: "monospace"
                  }}
                >
                  {evento.fechaHora} ({evento.zonaHoraria || "America/La_Paz"})
                </span>
              </div>
              <p className="op-card-meta">
                <strong>Entidad:</strong> {evento.entidad} ·{" "}
                <strong>Usuario:</strong> {evento.usuario} ({evento.rol})
              </p>
              <p className="op-card-meta">{evento.detalle}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
