// src/modules/operaciones/components/AsignacionForm.jsx
import React, { useState } from "react";
import { mockPersonal, mockProyectos } from "../mocks/datosPrueba.js";
import { validarAsignacion } from "../utils/reglasOperaciones.js";

export default function AsignacionForm({
  asignacionInicial = null,
  idProyectoPreseleccionado = "",
  proyectos = mockProyectos,
  personal = mockPersonal,
  asignacionesExistentes = [],
  guardando = false,
  alGuardar,
  alCancelar
}) {
  const esEdicion = Boolean(asignacionInicial?.id);
  const proyectoDefault = proyectos.find(
    (p) => Number(p.id) === Number(asignacionInicial?.idProyecto || idProyectoPreseleccionado)
  );

  const [formData, setFormData] = useState({
    id: asignacionInicial?.id || null,
    idProyecto: asignacionInicial?.idProyecto || idProyectoPreseleccionado || "",
    idPersonal: asignacionInicial?.idPersonal || "",
    funcion: asignacionInicial?.funcion || "",
    fechaInicio: asignacionInicial?.fechaInicio || proyectoDefault?.fechaInicio || "",
    fechaFin: asignacionInicial?.fechaFin || proyectoDefault?.fechaFin || ""
  });

  const [errores, setErrores] = useState({});

  const proyectoSeleccionado = proyectos.find(
    (p) => Number(p.id) === Number(formData.idProyecto)
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const siguiente = { ...prev, [name]: value };
      // Si cambia el proyecto y no hay fechas aún, autocompletar con el rango del proyecto
      if (name === "idProyecto" && value) {
        const pry = proyectos.find((p) => Number(p.id) === Number(value));
        if (pry) {
          siguiente.fechaInicio = pry.fechaInicio;
          siguiente.fechaFin = pry.fechaFin;
        }
      }
      return siguiente;
    });
    setErrores({});
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const resultado = validarAsignacion(
      formData,
      proyectos,
      asignacionesExistentes,
      formData.id
    );

    if (!resultado.valido) {
      setErrores(resultado.errores);
      return;
    }

    alGuardar(formData);
  };

  const proyectosDisponibles = proyectos.filter(
    (p) => p.estado === "Activo" || Number(p.id) === Number(formData.idProyecto)
  );

  return (
    <section className="op-form-panel" aria-labelledby="titulo-form-asignacion">
      <h3 id="titulo-form-asignacion" style={{ marginTop: 0, marginBottom: "14px" }}>
        {esEdicion ? "Editar Asignación de Equipo" : "Nueva Asignación de Personal"}
      </h3>

      {proyectoSeleccionado && (
        <div className="op-alerta op-alerta-info" style={{ marginBottom: "16px" }}>
          <div>
            <strong>Vigencia del proyecto «{proyectoSeleccionado.nombre}»:</strong>{" "}
            del <strong>{proyectoSeleccionado.fechaInicio}</strong> al{" "}
            <strong>{proyectoSeleccionado.fechaFin}</strong>. Las fechas de asignación deben estar dentro de este período.
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="op-form-grid">
          <div className="op-campo">
            <label className="op-label" htmlFor="asig-proyecto">
              Proyecto activo *
            </label>
            <select
              id="asig-proyecto"
              name="idProyecto"
              className="op-select"
              value={formData.idProyecto}
              onChange={handleChange}
              aria-invalid={Boolean(errores.idProyecto)}
            >
              <option value="">Seleccione un proyecto...</option>
              {proyectosDisponibles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.codigo ? `${p.codigo} · ` : ""}{p.nombre} ({p.fechaInicio} a {p.fechaFin})
                </option>
              ))}
            </select>
            {errores.idProyecto && <p className="op-error-campo">{errores.idProyecto}</p>}
          </div>

          <div className="op-campo">
            <label className="op-label" htmlFor="asig-personal">
              Personal (Planta / Pasante) *
            </label>
            <select
              id="asig-personal"
              name="idPersonal"
              className="op-select"
              value={formData.idPersonal}
              onChange={handleChange}
              aria-invalid={Boolean(errores.idPersonal || errores.duplicado)}
            >
              <option value="">Seleccione personal...</option>
              {personal.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombres} {p.apellidos} ({p.tipo})
                </option>
              ))}
            </select>
            {errores.idPersonal && <p className="op-error-campo">{errores.idPersonal}</p>}
          </div>

          <div className="op-campo op-campo-completo">
            <label className="op-label" htmlFor="asig-funcion">
              Función / Rol en el proyecto *
            </label>
            <input
              id="asig-funcion"
              type="text"
              name="funcion"
              className="op-input"
              value={formData.funcion}
              onChange={handleChange}
              placeholder="Ej. Técnico en redes, Supervisor de mantenimiento..."
              aria-invalid={Boolean(errores.funcion)}
            />
            {errores.funcion && <p className="op-error-campo">{errores.funcion}</p>}
          </div>

          <div className="op-campo">
            <label className="op-label" htmlFor="asig-fecha-inicio">
              Fecha de inicio de participación *
            </label>
            <input
              id="asig-fecha-inicio"
              type="date"
              name="fechaInicio"
              className="op-input"
              min={proyectoSeleccionado?.fechaInicio || undefined}
              max={proyectoSeleccionado?.fechaFin || undefined}
              value={formData.fechaInicio}
              onChange={handleChange}
              aria-invalid={Boolean(errores.fechaInicio || errores.periodo)}
            />
            {errores.fechaInicio && <p className="op-error-campo">{errores.fechaInicio}</p>}
          </div>

          <div className="op-campo">
            <label className="op-label" htmlFor="asig-fecha-fin">
              Fecha de fin de participación *
            </label>
            <input
              id="asig-fecha-fin"
              type="date"
              name="fechaFin"
              className="op-input"
              min={proyectoSeleccionado?.fechaInicio || undefined}
              max={proyectoSeleccionado?.fechaFin || undefined}
              value={formData.fechaFin}
              onChange={handleChange}
              aria-invalid={Boolean(errores.fechaFin || errores.periodo)}
            />
            {errores.fechaFin && <p className="op-error-campo">{errores.fechaFin}</p>}
          </div>
        </div>

        {errores.periodo && (
          <div className="op-alerta op-alerta-error" style={{ marginTop: "14px", marginBottom: 0 }}>
            <span>{errores.periodo}</span>
          </div>
        )}

        {errores.duplicado && (
          <div className="op-alerta op-alerta-error" style={{ marginTop: "14px", marginBottom: 0 }}>
            <span>{errores.duplicado}</span>
          </div>
        )}

        <div className="op-card-acciones" style={{ marginTop: "16px" }}>
          <button type="submit" className="op-btn op-btn-primario" disabled={guardando}>
            {guardando ? "Guardando asignación..." : esEdicion ? "Actualizar Asignación" : "Guardar Asignación"}
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