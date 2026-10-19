// src/modules/operaciones/components/ViaticoForm.jsx
import React, { useState } from "react";
import { REGLAS_VIATICOS_VIGENTES } from "../mocks/datosPrueba.js";
import { validarViatico, hoyBolivia } from "../utils/reglasOperaciones.js";

export default function ViaticoForm({
  viaticoInicial = null,
  personal = [],
  reglas = REGLAS_VIATICOS_VIGENTES,
  guardando = false,
  alGuardar,
  alCancelar
}) {
  const esEdicion = Boolean(viaticoInicial?.idViatico);

  const [formData, setFormData] = useState({
    idViatico: viaticoInicial?.idViatico ?? 0,
    idPasante: viaticoInicial?.idPasante || "",
    fecha: viaticoInicial?.fecha || hoyBolivia(),
    monto: viaticoInicial?.monto ?? 12.00,
    concepto: viaticoInicial?.concepto || "",
    gastoExtra: viaticoInicial?.gastoExtra ?? 0
  });

  const [errores, setErrores] = useState({});

  const totalCalculado =
    (Number(formData.monto) || 0) + (Number(formData.gastoExtra) || 0);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
    setErrores({});
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const resultado = validarViatico(formData, reglas);
    if (!resultado.valido) {
      setErrores(resultado.errores);
      return;
    }
    alGuardar(resultado.payload);
  };

  return (
    <section className="op-form-panel" aria-labelledby="titulo-form-viatico">
      <h3 id="titulo-form-viatico" style={{ marginTop: 0, marginBottom: "10px" }}>
        {esEdicion
          ? `Editar Viático #${viaticoInicial.idViatico}`
          : "Registrar Viático"}
      </h3>

      <div className="op-alerta op-alerta-info" style={{ marginBottom: "16px" }}>
        <div>
          <strong>Reglas vigentes de montos:</strong> El viático base debe ser{" "}
          <strong>
            mayor a 0 y hasta {reglas.moneda} {reglas.montoBaseMaximo.toFixed(2)}
          </strong>
          , y el gasto adicional no puede ser negativo.
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="op-form-grid">
          <div className="op-campo">
            <label className="op-label" htmlFor="via-pasante">
              Persona beneficiaria *
            </label>
            <select
              id="via-pasante"
              name="idPasante"
              className="op-select"
              value={formData.idPasante}
              onChange={handleChange}
              aria-invalid={Boolean(errores.idPasante)}
            >
              <option value="">Seleccione persona...</option>
              {personal.map((per) => (
                <option key={per.idPasante} value={per.idPasante}>
                  [{per.codigo}] {per.nombres} {per.apellidos} ({per.tipoContrato})
                </option>
              ))}
            </select>
            {errores.idPasante && (
              <p className="op-error-campo">{errores.idPasante}</p>
            )}
          </div>

          <div className="op-campo">
            <label className="op-label" htmlFor="via-fecha">
              Fecha del viático *
            </label>
            <input
              id="via-fecha"
              name="fecha"
              type="date"
              className="op-input"
              value={formData.fecha}
              onChange={handleChange}
              aria-invalid={Boolean(errores.fecha)}
            />
            {errores.fecha && <p className="op-error-campo">{errores.fecha}</p>}
          </div>

          <div className="op-campo">
            <label className="op-label" htmlFor="via-monto">
              Monto base ({reglas.moneda}) * — Máx. {reglas.moneda}{" "}
              {reglas.montoBaseMaximo.toFixed(2)}
            </label>
            <input
              id="via-monto"
              name="monto"
              type="number"
              min="0.01"
              max={reglas.montoBaseMaximo}
              step="0.50"
              className="op-input"
              value={formData.monto}
              onChange={handleChange}
              placeholder="0.01 a 12.00"
              aria-invalid={Boolean(errores.monto)}
            />
            {errores.monto && <p className="op-error-campo">{errores.monto}</p>}
          </div>

          <div className="op-campo">
            <label className="op-label" htmlFor="via-gasto-extra">
              Gasto adicional ({reglas.moneda})
            </label>
            <input
              id="via-gasto-extra"
              name="gastoExtra"
              type="number"
              min="0"
              step="0.50"
              className="op-input"
              value={formData.gastoExtra}
              onChange={handleChange}
              placeholder="0.00"
              aria-invalid={Boolean(errores.gastoExtra)}
            />
            {errores.gastoExtra && (
              <p className="op-error-campo">{errores.gastoExtra}</p>
            )}
          </div>

          <div className="op-campo op-campo-completo">
            <label className="op-label" htmlFor="via-concepto">
              Concepto del gasto *
            </label>
            <input
              id="via-concepto"
              name="concepto"
              type="text"
              className="op-input"
              value={formData.concepto}
              onChange={handleChange}
              placeholder="Ej. Pasaje y transporte de herramientas a estación norte"
              aria-invalid={Boolean(errores.concepto)}
            />
            {errores.concepto && (
              <p className="op-error-campo">{errores.concepto}</p>
            )}
          </div>

          <div className="op-campo op-campo-completo">
            <span className="op-label">Total del viático</span>
            <div
              className="op-input"
              style={{
                display: "flex",
                alignItems: "center",
                fontWeight: "700",
                background: "#eef4ea"
              }}
            >
              {reglas.moneda} {totalCalculado.toFixed(2)} (Base: {reglas.moneda}{" "}
              {(Number(formData.monto) || 0).toFixed(2)} + Adicional:{" "}
              {reglas.moneda} {(Number(formData.gastoExtra) || 0).toFixed(2)})
            </div>
          </div>
        </div>

        <div className="op-card-acciones" style={{ marginTop: "16px" }}>
          <button
            type="submit"
            className="op-btn op-btn-primario"
            disabled={guardando}
          >
            {guardando
              ? "Guardando viático..."
              : esEdicion
              ? "Guardar cambios"
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
