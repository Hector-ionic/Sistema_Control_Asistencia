// src/modules/operaciones/components/ViaticoForm.jsx
import React, { useState } from "react";
import { REGLAS_VIATICOS_VIGENTES } from "../mocks/datosPrueba.js";
import { validarViatico } from "../utils/reglasOperaciones.js";

export default function ViaticoForm({
  viaticoInicial = null,
  proyectos = [],
  personal = [],
  asignaciones = [],
  reglas = REGLAS_VIATICOS_VIGENTES,
  guardando = false,
  alGuardar,
  alCancelar
}) {
  const esEdicion = Boolean(viaticoInicial?.id);

  const [formData, setFormData] = useState({
    id: viaticoInicial?.id || null,
    idProyecto: viaticoInicial?.idProyecto || "",
    idPersonal: viaticoInicial?.idPersonal || "",
    categoria: viaticoInicial?.categoria || "Transporte",
    monto: viaticoInicial?.monto ?? "",
    esGastoAdicional: Boolean(viaticoInicial?.esGastoAdicional),
    montoAdicional: viaticoInicial?.montoAdicional ?? "",
    comprobante: viaticoInicial?.comprobante || "",
    descripcion: viaticoInicial?.descripcion || "",
    justificacionAdicional: viaticoInicial?.justificacionAdicional || "",
    fecha: viaticoInicial?.fecha || "2026-10-16"
  });

  const [errores, setErrores] = useState({});

  const proyectoSeleccionado = proyectos.find(
    (p) => Number(p.id) === Number(formData.idProyecto)
  );

  // Filtrar el personal asignado al proyecto seleccionado para facilitar selección válida
  const idsPersonalEnProyecto = new Set(
    asignaciones
      .filter((a) => Number(a.idProyecto) === Number(formData.idProyecto))
      .map((a) => Number(a.idPersonal))
  );

  const topeCategoriaActual = reglas.topesPorCategoria[formData.categoria] || 200;
  const totalCalculado =
    (Number(formData.monto) || 0) +
    (formData.esGastoAdicional ? Number(formData.montoAdicional) || 0 : 0);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const nuevoValor = type === "checkbox" ? checked : value;
    setFormData((prev) => ({
      ...prev,
      [name]: nuevoValor
    }));
    setErrores({});
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const resultado = validarViatico(formData, proyectos, asignaciones, reglas);
    if (!resultado.valido) {
      setErrores(resultado.errores);
      return;
    }
    alGuardar(formData);
  };

  const proyectosAbiertos = proyectos.filter(
    (p) => p.estado !== "Cerrado" || Number(p.id) === Number(formData.idProyecto)
  );

  return (
    <section className="op-form-panel" aria-labelledby="titulo-form-viatico">
      <h3 id="titulo-form-viatico" style={{ marginTop: 0, marginBottom: "10px" }}>
        {esEdicion ? `Editar Viático #${viaticoInicial.id}` : "Registrar Viático / Gasto Operativo"}
      </h3>

      <div className="op-alerta op-alerta-info" style={{ marginBottom: "16px" }}>
        <div>
          <strong>Reglas vigentes ({reglas.moneda}):</strong> Transporte máx. {reglas.moneda}{" "}
          {reglas.topesPorCategoria.Transporte} · Alimentación máx. {reglas.moneda}{" "}
          {reglas.topesPorCategoria.Alimentacion} · Hospedaje máx. {reglas.moneda}{" "}
          {reglas.topesPorCategoria.Hospedaje} · Materiales máx. {reglas.moneda}{" "}
          {reglas.topesPorCategoria.Materiales}. Tope acumulado con gasto adicional:{" "}
          <strong>
            {reglas.moneda} {reglas.topeMaximoConGastoAdicional}
          </strong>{" "}
          (requiere comprobante y justificación).
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="op-form-grid">
          <div className="op-campo">
            <label className="op-label" htmlFor="via-proyecto">
              Proyecto *
            </label>
            <select
              id="via-proyecto"
              name="idProyecto"
              className="op-select"
              value={formData.idProyecto}
              onChange={handleChange}
              aria-invalid={Boolean(errores.idProyecto)}
            >
              <option value="">Seleccione proyecto...</option>
              {proyectosAbiertos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} ({p.fechaInicio} al {p.fechaFin})
                </option>
              ))}
            </select>
            {errores.idProyecto && <p className="op-error-campo">{errores.idProyecto}</p>}
          </div>

          <div className="op-campo">
            <label className="op-label" htmlFor="via-personal">
              Personal asignado *
            </label>
            <select
              id="via-personal"
              name="idPersonal"
              className="op-select"
              value={formData.idPersonal}
              onChange={handleChange}
              aria-invalid={Boolean(errores.idPersonal)}
            >
              <option value="">Seleccione persona...</option>
              {personal.map((per) => {
                const asignado =
                  !formData.idProyecto || idsPersonalEnProyecto.has(Number(per.id));
                return (
                  <option key={per.id} value={per.id}>
                    {per.nombres} {per.apellidos} ({per.tipo})
                    {formData.idProyecto
                      ? asignado
                        ? " — Asignado al proyecto"
                        : " — Sin asignación en este proyecto"
                      : ""}
                  </option>
                );
              })}
            </select>
            {errores.idPersonal && <p className="op-error-campo">{errores.idPersonal}</p>}
          </div>

          <div className="op-campo">
            <label className="op-label" htmlFor="via-categoria">
              Categoría de viático *
            </label>
            <select
              id="via-categoria"
              name="categoria"
              className="op-select"
              value={formData.categoria}
              onChange={handleChange}
              aria-invalid={Boolean(errores.categoria)}
            >
              <option value="Transporte">
                Transporte (Tope base: {reglas.moneda} {reglas.topesPorCategoria.Transporte})
              </option>
              <option value="Alimentacion">
                Alimentación (Tope base: {reglas.moneda} {reglas.topesPorCategoria.Alimentacion})
              </option>
              <option value="Hospedaje">
                Hospedaje (Tope base: {reglas.moneda} {reglas.topesPorCategoria.Hospedaje})
              </option>
              <option value="Materiales">
                Materiales / Operación (Tope base: {reglas.moneda} {reglas.topesPorCategoria.Materiales})
              </option>
            </select>
            {errores.categoria && <p className="op-error-campo">{errores.categoria}</p>}
          </div>

          <div className="op-campo">
            <label className="op-label" htmlFor="via-fecha">
              Fecha del gasto *
            </label>
            <input
              id="via-fecha"
              name="fecha"
              type="date"
              className="op-input"
              min={proyectoSeleccionado?.fechaInicio || undefined}
              max={proyectoSeleccionado?.fechaFin || undefined}
              value={formData.fecha}
              onChange={handleChange}
              aria-invalid={Boolean(errores.fecha)}
            />
            {errores.fecha && <p className="op-error-campo">{errores.fecha}</p>}
          </div>

          <div className="op-campo">
            <label className="op-label" htmlFor="via-monto">
              Monto base ({reglas.moneda}) * — Tope: {reglas.moneda} {topeCategoriaActual}
            </label>
            <input
              id="via-monto"
              name="monto"
              type="number"
              min="0.5"
              step="0.50"
              className="op-input"
              value={formData.monto}
              onChange={handleChange}
              placeholder={`Máximo ${topeCategoriaActual}.00`}
              aria-invalid={Boolean(errores.monto)}
            />
            {errores.monto && <p className="op-error-campo">{errores.monto}</p>}
          </div>

          <div className="op-campo">
            <label className="op-label" htmlFor="via-comprobante">
              N° Recibo / Factura {formData.esGastoAdicional ? "*" : "(opcional)"}
            </label>
            <input
              id="via-comprobante"
              name="comprobante"
              type="text"
              className="op-input"
              value={formData.comprobante}
              onChange={handleChange}
              placeholder="Ej. FAC-00412 o REC-109"
              aria-invalid={Boolean(errores.comprobante)}
            />
            {errores.comprobante && <p className="op-error-campo">{errores.comprobante}</p>}
          </div>

          <div className="op-campo op-campo-completo">
            <label className="op-label" htmlFor="via-descripcion">
              Concepto / Descripción del viático *
            </label>
            <input
              id="via-descripcion"
              name="descripcion"
              type="text"
              className="op-input"
              value={formData.descripcion}
              onChange={handleChange}
              placeholder="Ej. Traslado de herramientas a estación de bombeo"
              aria-invalid={Boolean(errores.descripcion)}
            />
            {errores.descripcion && <p className="op-error-campo">{errores.descripcion}</p>}
          </div>

          <div className="op-campo op-campo-completo">
            <label className="op-checkbox-fila" htmlFor="via-adicional-check">
              <input
                id="via-adicional-check"
                name="esGastoAdicional"
                type="checkbox"
                checked={formData.esGastoAdicional}
                onChange={handleChange}
              />
              <span>
                <strong>Incluir gasto adicional / extraordinario</strong> (sujeto a justificación y comprobante obligatorio)
              </span>
            </label>
          </div>

          {formData.esGastoAdicional && (
            <>
              <div className="op-campo">
                <label className="op-label" htmlFor="via-monto-adicional">
                  Monto adicional ({reglas.moneda}) *
                </label>
                <input
                  id="via-monto-adicional"
                  name="montoAdicional"
                  type="number"
                  min="0.5"
                  step="0.50"
                  className="op-input"
                  value={formData.montoAdicional}
                  onChange={handleChange}
                  placeholder="Ej. 85.00"
                  aria-invalid={Boolean(errores.montoAdicional)}
                />
                {errores.montoAdicional && (
                  <p className="op-error-campo">{errores.montoAdicional}</p>
                )}
              </div>

              <div className="op-campo">
                <span className="op-label">Total acumulado del registro</span>
                <div
                  className="op-input"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    fontWeight: "700",
                    background: "#eef4ea"
                  }}
                >
                  {reglas.moneda} {totalCalculado.toFixed(2)} / máx. {reglas.moneda}{" "}
                  {reglas.topeMaximoConGastoAdicional.toFixed(2)}
                </div>
              </div>

              <div className="op-campo op-campo-completo">
                <label className="op-label" htmlFor="via-justificacion">
                  Justificación obligatoria del gasto adicional *
                </label>
                <textarea
                  id="via-justificacion"
                  name="justificacionAdicional"
                  className="op-textarea"
                  value={formData.justificacionAdicional}
                  onChange={handleChange}
                  placeholder="Detalle el motivo técnico u operativo del gasto extraordinario..."
                  aria-invalid={Boolean(errores.justificacionAdicional)}
                />
                {errores.justificacionAdicional && (
                  <p className="op-error-campo">{errores.justificacionAdicional}</p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="op-card-acciones" style={{ marginTop: "16px" }}>
          <button type="submit" className="op-btn op-btn-primario" disabled={guardando}>
            {guardando
              ? "Procesando viático..."
              : esEdicion
              ? "Guardar cambios de viático"
              : `Registrar viático (${reglas.moneda} ${totalCalculado.toFixed(2)})`}
          </button>
          <button
            type="button"
            className="op-btn op-btn-secundario"
            onClick={alCancelar}
            disabled={guardando}
          >
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}
