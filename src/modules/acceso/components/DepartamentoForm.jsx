// src/modules/acceso/components/DepartamentoForm.jsx
import React, { useEffect, useState } from "react";
import { validarDepartamentoGuardar } from "../utils/reglasAcceso.js";

export default function DepartamentoForm({
  departamentoInicial = null,
  departamentosExistentes = [],
  rolSesionActual = "SuperAdmin",
  onGuardar,
  onCancelar,
  guardando = false
}) {
  const [form, setForm] = useState({
    idDepartamento: 0,
    nombre: "",
    descripcion: ""
  });
  const [errores, setErrores] = useState({});

  const esEdicion = Boolean(
    departamentoInicial && Number(departamentoInicial.idDepartamento) > 0
  );

  useEffect(() => {
    if (departamentoInicial && Number(departamentoInicial.idDepartamento) > 0) {
      setForm({
        idDepartamento: Number(departamentoInicial.idDepartamento),
        nombre: departamentoInicial.nombre || "",
        descripcion: departamentoInicial.descripcion || ""
      });
    } else {
      setForm({
        idDepartamento: 0,
        nombre: "",
        descripcion: ""
      });
    }
    setErrores({});
  }, [departamentoInicial]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value
    }));
    if (errores[name] || errores.permisos) {
      setErrores((prev) => ({ ...prev, [name]: undefined, permisos: undefined }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const resultado = validarDepartamentoGuardar(
      form,
      departamentosExistentes,
      rolSesionActual
    );

    if (!resultado.valido) {
      setErrores(resultado.errores);
      return;
    }

    onGuardar(resultado.datosNormalizados);
  };

  return (
    <form
      className="acc-form-panel"
      onSubmit={handleSubmit}
      noValidate
      aria-label={esEdicion ? "Editar área o departamento" : "Registrar nueva área o departamento"}
    >
      <div className="acc-panel-header">
        <div>
          <h3 style={{ margin: 0 }}>
            {esEdicion
              ? `Editar área #${form.idDepartamento} (${form.nombre})`
              : "Registrar nueva área / departamento"}
          </h3>
          <p className="acc-ayuda" style={{ marginTop: "4px" }}>
            Las áreas registradas aquí están disponibles al asignar personal. Las áreas con personal asociado no pueden eliminarse.
          </p>
        </div>
      </div>

      {errores.permisos && (
        <div className="acc-alerta acc-alerta-error" role="alert">
          <span>{errores.permisos}</span>
        </div>
      )}

      <div className="acc-form-grid">
        <div className="acc-campo">
          <label className="acc-label" htmlFor="dep-nombre">
            Nombre del área / departamento
          </label>
          <input
            id="dep-nombre"
            name="nombre"
            type="text"
            className="acc-input"
            placeholder="Ej. Ingeniería Civil y Obra"
            value={form.nombre}
            onChange={handleChange}
            maxLength={100}
            aria-invalid={Boolean(errores.nombre)}
            required
          />
          {errores.nombre && (
            <span className="acc-error-campo" role="alert">
              {errores.nombre}
            </span>
          )}
        </div>

        <div className="acc-campo">
          <label className="acc-label" htmlFor="dep-descripcion">
            Descripción
          </label>
          <input
            id="dep-descripcion"
            name="descripcion"
            type="text"
            className="acc-input"
            placeholder="Ej. Frentes de construcción y supervisión técnica"
            value={form.descripcion}
            onChange={handleChange}
            maxLength={250}
            aria-invalid={Boolean(errores.descripcion)}
          />
          {errores.descripcion && (
            <span className="acc-error-campo" role="alert">
              {errores.descripcion}
            </span>
          )}
        </div>
      </div>

      <div className="acc-acciones-fila" style={{ marginTop: "18px" }}>
        <button
          type="submit"
          className="acc-btn acc-btn-primario"
          disabled={guardando}
        >
          {guardando
            ? "Guardando..."
            : esEdicion
            ? "Guardar cambios del área"
            : "Registrar área"}
        </button>
        <button
          type="button"
          className="acc-btn acc-btn-secundario"
          onClick={onCancelar}
          disabled={guardando}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
