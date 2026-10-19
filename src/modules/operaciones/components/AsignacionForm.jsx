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
  const esEdicion = Boolean(asignacionInicial?.idAsignacion);
  const proyectoDefault = proyectos.find(
    (p) =>
      Number(p.idProyecto) ===
      Number(asignacionInicial?.idProyecto || idProyectoPreseleccionado)
  );

  const [formData, setFormData] = useState({
    idAsignacion: asignacionInicial?.idAsignacion ?? 0,
    idProyecto: asignacionInicial?.idProyecto || idProyectoPreseleccionado || "",
    idPasante: asignacionInicial?.idPasante || "",
    rol: asignacionInicial?.rol || "",
    fechaInicio:
      asignacionInicial?.fechaInicio || proyectoDefault?.fechaInicio || "",
    fechaFin: asignacionInicial?.fechaFin || proyectoDefault?.fechaFin || "",
    activo: asignacionInicial?.activo !== undefined ? asignacionInicial.activo : true,
    version: asignacionInicial?.version ?? 0
  });

  const [errores, setErrores] = useState({});

  const proyectoSeleccionado = proyectos.find(
    (p) => Number(p.idProyecto) === Number(formData.idProyecto)
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const siguiente = { ...prev, [name]: value };
      if (name === "idProyecto" && value) {
        const pry = proyectos.find((p) => Number(p.idProyecto) === Number(value));
        if (pry) {
          siguiente.fechaInicio = pry.fechaInicio;
          siguiente.fechaFin = pry.fechaFin || "";
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
      formData.idAsignacion
    );

    if (!resultado.valido) {
      setErrores(resultado.errores);
      return;
    }

    alGuardar(resultado.payload);
  };

  const proyectosDisponibles = proyectos.filter(
    (p) =>
      p.estado !== "Finalizado" ||
      Number(p.idProyecto) === Number(formData.idProyecto)
  );

  return (
    <section className="op-form-panel" aria-labelledby="titulo-form-asignacion">
      <div className="op-card-header" style={{ marginBottom: "12px" }}>
        <h3 id="titulo-form-asignacion" style={{ margin: 0 }}>
          {esEdicion
            ? `Editar Asignación #${asignacionInicial.idAsignacion}`
            : "Nueva Asignación de Personal"}
        </h3>
        {esEdicion && (
          <span className="op-badge">Versión {formData.version}</span>
        )}
      </div>

      {proyectoSeleccionado && (
        <div className="op-alerta op-alerta-info" style={{ marginBottom: "16px" }}>
          <div>
            <strong>Vigencia del proyecto «{proyectoSeleccionado.nombre}»:</strong>{" "}
            del <strong>{proyectoSeleccionado.fechaInicio}</strong> al{" "}
            <strong>{proyectoSeleccionado.fechaFin || "Abierto"}</strong>. Las fechas de asignación deben estar dentro de este período.
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="op-form-grid">
          <div className="op-campo">
            <label className="op-label" htmlFor="asig-proyecto">
              Proyecto *
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
                <option key={p.idProyecto} value={p.idProyecto}>
                  {p.codigo} · {p.nombre} ({p.estado})
                </option>
              ))}
            </select>
            {errores.idProyecto && (
              <p className="op-error-campo">{errores.idProyecto}</p>
            )}
          </div>

          <div className="op-campo">
            <label className="op-label" htmlFor="asig-pasante">
              Personal *
            </label>
            <select
              id="asig-pasante"
              name="idPasante"
              className="op-select"
              value={formData.idPasante}
              onChange={handleChange}
              aria-invalid={Boolean(errores.idPasante || errores.duplicado)}
            >
              <option value="">Seleccione personal...</option>
              {personal.map((p) => (
                <option key={p.idPasante} value={p.idPasante}>
                  [{p.codigo}] {p.nombres} {p.apellidos} ({p.tipoContrato})
                </option>
              ))}
            </select>
            {errores.idPasante && (
              <p className="op-error-campo">{errores.idPasante}</p>
            )}
          </div>

          <div className="op-campo op-campo-completo">
            <label className="op-label" htmlFor="asig-rol">
              Rol / Función en el proyecto *
            </label>
            <input
              id="asig-rol"
              type="text"
              name="rol"
              className="op-input"
              value={formData.rol}
              onChange={handleChange}
              placeholder="Ej. Técnico en redes, Supervisor de mantenimiento..."
              aria-invalid={Boolean(errores.rol)}
            />
            {errores.rol && <p className="op-error-campo">{errores.rol}</p>}
          </div>

          <div className="op-campo">
            <label className="op-label" htmlFor="asig-fecha-inicio">
              Fecha de inicio *
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
            {errores.fechaInicio && (
              <p className="op-error-campo">{errores.fechaInicio}</p>
            )}
          </div>

          <div className="op-campo">
            <label className="op-label" htmlFor="asig-fecha-fin">
              Fecha de finalización (opcional)
            </label>
            <input
              id="asig-fecha-fin"
              type="date"
              name="fechaFin"
              className="op-input"
              min={proyectoSeleccionado?.fechaInicio || undefined}
              max={proyectoSeleccionado?.fechaFin || undefined}
              value={formData.fechaFin || ""}
              onChange={handleChange}
              aria-invalid={Boolean(errores.fechaFin || errores.periodo)}
            />
            {errores.fechaFin && (
              <p className="op-error-campo">{errores.fechaFin}</p>
            )}
          </div>
        </div>

        {errores.periodo && (
          <div
            className="op-alerta op-alerta-error"
            style={{ marginTop: "14px", marginBottom: 0 }}
          >
            <span>{errores.periodo}</span>
          </div>
        )}

        {errores.duplicado && (
          <div
            className="op-alerta op-alerta-error"
            style={{ marginTop: "14px", marginBottom: 0 }}
          >
            <span>{errores.duplicado}</span>
          </div>
        )}

        <div className="op-card-acciones" style={{ marginTop: "16px" }}>
          <button
            type="submit"
            className="op-btn op-btn-primario"
            disabled={guardando}
          >
            {guardando
              ? "Guardando asignación..."
              : esEdicion
              ? "Actualizar Asignación"
              : "Guardar Asignación"}
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