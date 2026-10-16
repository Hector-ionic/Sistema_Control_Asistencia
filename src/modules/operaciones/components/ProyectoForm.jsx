// src/modules/operaciones/components/ProyectoForm.jsx
import React, { useState } from "react";
import { validarProyecto } from "../utils/reglasOperaciones.js";

export default function ProyectoForm({
  proyectoInicial = null,
  proyectosExistentes = [],
  guardando = false,
  alGuardar,
  alCancelar
}) {
  const esEdicion = Boolean(proyectoInicial?.id);

  const [formData, setFormData] = useState({
    id: proyectoInicial?.id || null,
    codigo: proyectoInicial?.codigo || "",
    nombre: proyectoInicial?.nombre || "",
    descripcion: proyectoInicial?.descripcion || "",
    ubicacion: proyectoInicial?.ubicacion || "",
    estado: proyectoInicial?.estado || "Activo",
    fechaInicio: proyectoInicial?.fechaInicio || "2026-10-16",
    fechaFin: proyectoInicial?.fechaFin || "2026-11-30",
    presupuestoViaticos: proyectoInicial?.presupuestoViaticos ?? 2000
  });

  const [errores, setErrores] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errores[name]) {
      setErrores((prev) => {
        const copia = { ...prev };
        delete copia[name];
        return copia;
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const resultado = validarProyecto(formData, proyectosExistentes, formData.id);
    if (!resultado.valido) {
      setErrores(resultado.errores);
      return;
    }
    alGuardar(formData);
  };

  return (
    <section className="op-form-panel" aria-labelledby="titulo-form-proyecto">
      <h3 id="titulo-form-proyecto" style={{ marginTop: 0, marginBottom: "14px" }}>
        {esEdicion ? `Editar proyecto: ${proyectoInicial.nombre}` : "Nuevo proyecto operativo"}
      </h3>

      <form onSubmit={handleSubmit} noValidate>
        <div className="op-form-grid">
          <div className="op-campo">
            <label className="op-label" htmlFor="pry-nombre">
              Nombre del proyecto *
            </label>
            <input
              id="pry-nombre"
              name="nombre"
              type="text"
              className="op-input"
              value={formData.nombre}
              onChange={handleChange}
              placeholder="Ej. Mantenimiento Red Hidráulica"
              aria-invalid={Boolean(errores.nombre)}
            />
            {errores.nombre && <p className="op-error-campo">{errores.nombre}</p>}
          </div>

          <div className="op-campo">
            <label className="op-label" htmlFor="pry-ubicacion">
              Ubicación / Área *
            </label>
            <input
              id="pry-ubicacion"
              name="ubicacion"
              type="text"
              className="op-input"
              value={formData.ubicacion}
              onChange={handleChange}
              placeholder="Ej. Planta Central - Sector Sur"
              aria-invalid={Boolean(errores.ubicacion)}
            />
            {errores.ubicacion && <p className="op-error-campo">{errores.ubicacion}</p>}
          </div>

          <div className="op-campo">
            <label className="op-label" htmlFor="pry-fecha-inicio">
              Fecha de inicio *
            </label>
            <input
              id="pry-fecha-inicio"
              name="fechaInicio"
              type="date"
              className="op-input"
              value={formData.fechaInicio}
              onChange={handleChange}
              aria-invalid={Boolean(errores.fechaInicio)}
            />
            {errores.fechaInicio && <p className="op-error-campo">{errores.fechaInicio}</p>}
          </div>

          <div className="op-campo">
            <label className="op-label" htmlFor="pry-fecha-fin">
              Fecha de finalización *
            </label>
            <input
              id="pry-fecha-fin"
              name="fechaFin"
              type="date"
              className="op-input"
              value={formData.fechaFin}
              onChange={handleChange}
              aria-invalid={Boolean(errores.fechaFin)}
            />
            {errores.fechaFin && <p className="op-error-campo">{errores.fechaFin}</p>}
          </div>

          <div className="op-campo">
            <label className="op-label" htmlFor="pry-estado">
              Estado operativo
            </label>
            <select
              id="pry-estado"
              name="estado"
              className="op-select"
              value={formData.estado}
              onChange={handleChange}
              aria-invalid={Boolean(errores.estado)}
            >
              <option value="Activo">Activo (permite asignaciones y viáticos)</option>
              <option value="Pausado">Pausado (sin nuevas asignaciones)</option>
            </select>
            {errores.estado && <p className="op-error-campo">{errores.estado}</p>}
          </div>

          <div className="op-campo">
            <label className="op-label" htmlFor="pry-presupuesto">
              Presupuesto para viáticos (Bs) *
            </label>
            <input
              id="pry-presupuesto"
              name="presupuestoViaticos"
              type="number"
              min="0"
              step="0.50"
              className="op-input"
              value={formData.presupuestoViaticos}
              onChange={handleChange}
              aria-invalid={Boolean(errores.presupuestoViaticos)}
            />
            {errores.presupuestoViaticos && (
              <p className="op-error-campo">{errores.presupuestoViaticos}</p>
            )}
          </div>

          <div className="op-campo op-campo-completo">
            <label className="op-label" htmlFor="pry-descripcion">
              Descripción y alcance *
            </label>
            <textarea
              id="pry-descripcion"
              name="descripcion"
              className="op-textarea"
              value={formData.descripcion}
              onChange={handleChange}
              placeholder="Describa las tareas operativas del proyecto..."
              aria-invalid={Boolean(errores.descripcion)}
            />
            {errores.descripcion && <p className="op-error-campo">{errores.descripcion}</p>}
          </div>
        </div>

        <div className="op-card-acciones" style={{ marginTop: "16px" }}>
          <button type="submit" className="op-btn op-btn-primario" disabled={guardando}>
            {guardando ? "Guardando proyecto..." : esEdicion ? "Guardar cambios" : "Registrar proyecto"}
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
