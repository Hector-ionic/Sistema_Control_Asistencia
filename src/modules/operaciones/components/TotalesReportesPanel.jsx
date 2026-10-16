// src/modules/operaciones/components/TotalesReportesPanel.jsx
import React, { useState } from "react";
import { calcularTotalesYResumenReportes } from "../utils/reglasOperaciones.js";

export default function TotalesReportesPanel({
  proyectos = [],
  personal = [],
  asignaciones = [],
  viaticos = [],
  auditoria = []
}) {
  const [filtros, setFiltros] = useState({
    idProyecto: "",
    idPersonal: "",
    fechaDesde: "",
    fechaHasta: ""
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
      idPersonal: "",
      fechaDesde: "",
      fechaHasta: ""
    });
  };

  const exportarCsvConciliado = () => {
    const encabezados = [
      "ID_Viatico",
      "Fecha",
      "Proyecto",
      "Persona",
      "Tipo_Personal",
      "Categoria",
      "Monto_Base_Bs",
      "Monto_Adicional_Bs",
      "Total_Bs",
      "Comprobante",
      "Estado"
    ];

    const filas = resumen.registrosConciliados.map((v) => {
      const pry = proyectos.find((p) => Number(p.id) === Number(v.idProyecto));
      const per = personal.find((p) => Number(p.id) === Number(v.idPersonal));
      const base = Number(v.monto || 0);
      const adic = v.esGastoAdicional ? Number(v.montoAdicional || 0) : 0;
      return [
        v.id,
        v.fecha,
        `"${(pry?.nombre || "").replace(/"/g, '""')}"`,
        `"${per ? `${per.nombres} ${per.apellidos}` : ""}"`,
        per?.tipo || "",
        v.categoria,
        base.toFixed(2),
        adic.toFixed(2),
        (base + adic).toFixed(2),
        `"${(v.comprobante || "").replace(/"/g, '""')}"`,
        v.estado
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
      {/* Filtros de período, proyecto y persona */}
      <section className="op-form-panel op-no-print" aria-labelledby="titulo-filtros-totales">
        <div className="op-card-header" style={{ marginBottom: "12px" }}>
          <h3 id="titulo-filtros-totales" style={{ margin: 0 }}>
            Filtros de Conciliación (Totales y Enlace con Módulo 04 Reportes)
          </h3>
          <button type="button" className="op-btn op-btn-secundario" onClick={limpiarFiltros}>
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
                <option key={p.id} value={p.id}>
                  {p.nombre} ({p.estado})
                </option>
              ))}
            </select>
          </div>

          <div className="op-campo">
            <label className="op-label" htmlFor="filtro-personal">
              Filtrar por Persona
            </label>
            <select
              id="filtro-personal"
              name="idPersonal"
              className="op-select"
              value={filtros.idPersonal}
              onChange={handleFiltroChange}
            >
              <option value="">Todo el personal</option>
              {personal.map((per) => (
                <option key={per.id} value={per.id}>
                  {per.nombres} {per.apellidos} ({per.tipo})
                </option>
              ))}
            </select>
          </div>

          <div className="op-campo">
            <label className="op-label" htmlFor="filtro-desde">
              Período desde
            </label>
            <input
              id="filtro-desde"
              name="fechaDesde"
              type="date"
              className="op-input"
              value={filtros.fechaDesde}
              onChange={handleFiltroChange}
            />
          </div>

          <div className="op-campo">
            <label className="op-label" htmlFor="filtro-hasta">
              Período hasta
            </label>
            <input
              id="filtro-hasta"
              name="fechaHasta"
              type="date"
              className="op-input"
              value={filtros.fechaHasta}
              onChange={handleFiltroChange}
            />
          </div>
        </div>

        <div className="op-card-acciones" style={{ marginTop: "14px" }}>
          <button type="button" className="op-btn op-btn-primario" onClick={exportarCsvConciliado}>
            Exportar CSV conciliado (Módulo 04)
          </button>
          <button
            type="button"
            className="op-btn op-btn-secundario"
            onClick={() => window.print()}
          >
            Vista de impresión A4
          </button>
          <button
            type="button"
            className="op-btn op-btn-secundario"
            onClick={() => setMostrarContratoJson((prev) => !prev)}
          >
            {mostrarContratoJson ? "Ocultar contrato API Reportes" : "Ver contrato JSON para Módulo 04"}
          </button>
        </div>
      </section>

      {/* Resumen de totales del período */}
      <div className="op-kpis" aria-label="Totales conciliados en el período">
        <div className="op-kpi-card">
          <span className="op-kpi-etiqueta">Total Viáticos Conciliado</span>
          <strong className="op-kpi-valor">
            {resumen.moneda} {resumen.resumenGlobal.totalGeneralConciliado.toFixed(2)}
          </strong>
          <span className="op-kpi-sub">
            {resumen.resumenGlobal.cantidadVigentes} registro(s) vigente(s)
          </span>
        </div>

        <div className="op-kpi-card">
          <span className="op-kpi-etiqueta">Monto Base Acumulado</span>
          <strong className="op-kpi-valor">
            {resumen.moneda} {resumen.resumenGlobal.totalMontoBase.toFixed(2)}
          </strong>
          <span className="op-kpi-sub">Según topes por categoría</span>
        </div>

        <div className="op-kpi-card">
          <span className="op-kpi-etiqueta">Gastos Adicionales</span>
          <strong className="op-kpi-valor">
            {resumen.moneda} {resumen.resumenGlobal.totalMontoAdicional.toFixed(2)}
          </strong>
          <span className="op-kpi-sub">Con respaldo y justificación</span>
        </div>

        <div className="op-kpi-card">
          <span className="op-kpi-etiqueta">Participaciones / Bajas</span>
          <strong className="op-kpi-valor">
            {resumen.resumenGlobal.totalAsignacionesEnPeriodo} / {resumen.resumenGlobal.cantidadBajas}
          </strong>
          <span className="op-kpi-sub">Asignaciones en rango / Viáticos de baja</span>
        </div>
      </div>

      {mostrarContratoJson && (
        <section className="op-form-panel op-no-print" aria-label="Contrato JSON para Módulo 04">
          <h4 style={{ marginTop: 0, marginBottom: "8px" }}>
            Contrato compartido `/api/operaciones?accion=resumen-reportes` (Módulo 05 → Módulo 04)
          </h4>
          <p className="op-ayuda" style={{ marginBottom: "10px" }}>
            Este objeto es consumido por el Módulo 04 (Historial y reportes) garantizando que los totales coincidan exactamente con los reportes impresos y exportados.
          </p>
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
      <h3 style={{ marginTop: "20px", marginBottom: "10px" }}>Totales por Proyecto</h3>
      <div className="op-tabla-wrapper" role="region" aria-label="Tabla de totales por proyecto" tabIndex={0}>
        <table className="op-tabla">
          <thead>
            <tr>
              <th>Proyecto</th>
              <th>Estado</th>
              <th>Período</th>
              <th>Participaciones</th>
              <th>Presupuesto ({resumen.moneda})</th>
              <th>Ejecutado ({resumen.moneda})</th>
              <th>Saldo ({resumen.moneda})</th>
            </tr>
          </thead>
          <tbody>
            {resumen.porProyecto.map((p) => (
              <tr key={p.idProyecto}>
                <td>
                  <strong>{p.nombre}</strong>
                  <div style={{ fontSize: "12px", color: "#5d705e" }}>{p.codigo}</div>
                </td>
                <td>{p.estado}</td>
                <td>{p.periodo}</td>
                <td>{p.participantesCount}</td>
                <td>{p.presupuestoViaticos.toFixed(2)}</td>
                <td>
                  <strong>{p.totalViaticos.toFixed(2)}</strong> ({p.viaticosCount} reg.)
                </td>
                <td style={{ color: p.saldoPresupuesto < 0 ? "#b42318" : "#115e3b", fontWeight: 700 }}>
                  {p.saldoPresupuesto.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totales por Persona */}
      <h3 style={{ marginTop: "24px", marginBottom: "10px" }}>
        Totales por Persona (Respetando tipo Planta / Pasante)
      </h3>
      <div className="op-tabla-wrapper" role="region" aria-label="Tabla de totales por persona" tabIndex={0}>
        <table className="op-tabla">
          <thead>
            <tr>
              <th>Persona</th>
              <th>Tipo (Módulo 02)</th>
              <th>Asignaciones</th>
              <th>Viáticos Base ({resumen.moneda})</th>
              <th>Adicionales ({resumen.moneda})</th>
              <th>Total Conciliado ({resumen.moneda})</th>
            </tr>
          </thead>
          <tbody>
            {resumen.porPersona.map((per) => (
              <tr key={per.idPersonal}>
                <td>
                  <strong>{per.nombreCompleto}</strong>
                  <div style={{ fontSize: "12px", color: "#5d705e" }}>{per.codigo}</div>
                </td>
                <td>
                  <span
                    className={`op-badge ${
                      per.tipo === "Pasante" ? "op-badge-pasante" : "op-badge-planta"
                    }`}
                  >
                    {per.tipo}
                  </span>
                </td>
                <td>{per.asignacionesCount}</td>
                <td>{per.totalBase.toFixed(2)}</td>
                <td>{per.totalAdicional.toFixed(2)}</td>
                <td>
                  <strong>{per.totalViaticosConciliado.toFixed(2)}</strong> ({per.viaticosCount} reg.)
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bitácora de Auditoría de Operaciones */}
      <h3 style={{ marginTop: "26px", marginBottom: "10px" }}>
        Auditoría de Operaciones (Zona horaria America/La_Paz)
      </h3>
      <div className="op-lista-grid">
        {auditoria.map((evento) => (
          <article key={evento.id} className="op-card">
            <div className="op-card-header">
              <span className="op-badge">{evento.accion}</span>
              <span style={{ fontSize: "12px", color: "#556857", fontFamily: "monospace" }}>
                {evento.fechaHora} ({evento.zonaHoraria})
              </span>
            </div>
            <p className="op-card-meta">
              <strong>Entidad:</strong> {evento.entidad} · <strong>Usuario:</strong> {evento.usuario} (
              {evento.rol})
            </p>
            <p className="op-card-meta">{evento.detalle}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
