// src/modules/operaciones/components/ProyectoForm.jsx
import React, { useState } from "react";
import { ESTADOS_PROYECTO } from "../mocks/datosPrueba.js";
import { validarProyecto, hoyBolivia } from "../utils/reglasOperaciones.js";

export default function ProyectoForm({
  proyectoInicial = null,
  proyectosExistentes = [],
  guardando = false,
  alGuardar,
  alCancelar
}) {
  const esEdicion = Boolean(proyectoInicial?.idProyecto);

  const [formData, setFormData] = useState({
    idProyecto: proyectoInicial?.idProyecto ?? 0,
    codigo:
      proyectoInicial?.codigo ||
      `PRY-2026-0${proyectosExistentes.length + 1}`,
    nombre: proyectoInicial?.nombre || "",
    cliente: proyectoInicial?.cliente || "",
    ubicacion: proyectoInicial?.ubicacion || "",
    descripcion: proyectoInicial?.descripcion || "",
    estado: proyectoInicial?.estado || "Planificado",
    fechaInicio: proyectoInicial?.fechaInicio || hoyBolivia(),
    fechaFin: proyectoInicial?.fechaFin || "",
    version: proyectoInicial?.version ?? 0
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
    const resultado = validarProyecto(
      formData,
      proyectosExistentes,
      formData.idProyecto
    );
    if (!resultado.valido) {
      setErrores(resultado.errores);
      return;
    }
    alGuardar(resultado.payload);
  };

  return (
    <section className="op-form-panel" aria-labelledby="titulo-form-proyecto">
      <div className="op-card-header" style={{ marginBottom: "12px" }}>
        <h3 id="titulo-form-proyecto" style={{ margin: 0 }}>
          {esEdicion
            ? `Editar proyecto: ${proyectoInicial.nombre}`
            : "Nuevo proyecto operativo"}
        </h3>
        {esEdicion && (
          <span className="op-badge">Versión {formData.version}</span>
        )}
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="op-form-grid">
          <div className="op-campo">
            <label className="op-label" htmlFor="pry-codigo">
              Código del proyecto *
            </label>
            <input
              id="pry-codigo"
              name="codigo"
              type="text"
              className="op-input"
              value={formData.codigo}
              onChange={handleChange}
              placeholder="Ej. PRY-2026-04"
              aria-invalid={Boolean(errores.codigo)}
            />
            {errores.codigo && <p className="op-error-campo">{errores.codigo}</p>}
          </div>

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
            <label className="op-label" htmlFor="pry-cliente">
              Cliente / Unidad solicitante
            </label>
            <input
              id="pry-cliente"
              name="cliente"
              type="text"
              className="op-input"
              value={formData.cliente}
              onChange={handleChange}
              placeholder="Ej. SII Oficina Santiago II"
            />
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
              Fecha de finalización (opcional)
            </label>
            <input
              id="pry-fecha-fin"
              name="fechaFin"
              type="date"
              className="op-input"
              value={formData.fechaFin || ""}
              onChange={handleChange}
              aria-invalid={Boolean(errores.fechaFin)}
            />
            {errores.fechaFin && <p className="op-error-campo">{errores.fechaFin}</p>}
          </div>

          <div className="op-campo op-campo-completo">
            <label className="op-label" htmlFor="pry-estado">
              Estado del proyecto *
            </label>
            <select
              id="pry-estado"
              name="estado"
              className="op-select"
              value={formData.estado}
              onChange={handleChange}
              aria-invalid={Boolean(errores.estado)}
            >
              {ESTADOS_PROYECTO.map((est) => (
                <option key={est} value={est}>
                  {est}
                </option>
              ))}
            </select>
            {errores.estado && <p className="op-error-campo">{errores.estado}</p>}
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
            {guardando
              ? "Guardando proyecto..."
              : esEdicion
              ? "Guardar cambios"
              : "Registrar proyecto"}
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
