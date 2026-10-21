// src/modules/acceso/components/ConfiguracionForm.jsx
import React, { useEffect, useState } from "react";
import { validarConfiguracionGuardar } from "../utils/reglasAcceso.js";

export default function ConfiguracionForm({
  configuracionActual,
  rolSesionActual = "SuperAdmin",
  onGuardar,
  onCambioTemaOscuro,
  guardando = false
}) {
  const [form, setForm] = useState({
    id: 1,
    nombreInstitucion: "Oficina Santiago II",
    horaEntradaEsperada: "08:00:00",
    horaSalidaEsperada: "18:30:00",
    toleranciaMinutos: 20,
    temaOscuro: false
  });
  const [errores, setErrores] = useState({});

  const esSuperAdmin = rolSesionActual === "SuperAdmin";

  useEffect(() => {
    if (configuracionActual) {
      setForm({
        id: Number(configuracionActual.id || 1),
        nombreInstitucion:
          configuracionActual.nombreInstitucion || "Oficina Santiago II",
        horaEntradaEsperada: String(
          configuracionActual.horaEntradaEsperada || "08:00:00"
        ).slice(0, 8),
        horaSalidaEsperada: String(
          configuracionActual.horaSalidaEsperada || "18:30:00"
        ).slice(0, 8),
        toleranciaMinutos:
          configuracionActual.toleranciaMinutos !== undefined
            ? Number(configuracionActual.toleranciaMinutos)
            : 20,
        temaOscuro: Boolean(configuracionActual.temaOscuro)
      });
      setErrores({});
    }
  }, [configuracionActual]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
    if (name === "temaOscuro" && typeof onCambioTemaOscuro === "function") {
      onCambioTemaOscuro(checked);
    }
    if (errores[name] || errores.permisos) {
      setErrores((prev) => ({ ...prev, [name]: undefined, permisos: undefined }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const resultado = validarConfiguracionGuardar(
      configuracionActual,
      {
        ...form,
        toleranciaMinutos: Number(form.toleranciaMinutos)
      },
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
      aria-label="Configuración general y horarios predeterminados"
    >
      <div className="acc-panel-header">
        <div>
          <h3 style={{ margin: 0 }}>
            Horarios predeterminados e institución
          </h3>
          <p className="acc-ayuda" style={{ marginTop: "4px" }}>
            {esSuperAdmin
              ? "Configure la sede institucional, las horas esperadas de entrada/salida y la tolerancia diaria en minutos."
              : "Vista de consulta: solo el rol SuperAdmin puede modificar la configuración global."}
          </p>
        </div>
        <span className="acc-badge acc-badge-neutral">
          ID Config #{form.id}
        </span>
      </div>

      {errores.permisos && (
        <div className="acc-alerta acc-alerta-error" role="alert">
          <span>{errores.permisos}</span>
        </div>
      )}

      <div className="acc-form-grid">
        <div className="acc-campo acc-campo-completo">
          <label className="acc-label" htmlFor="cfg-nombreInstitucion">
            Nombre de la institución / sede *
          </label>
          <input
            id="cfg-nombreInstitucion"
            name="nombreInstitucion"
            type="text"
            className="acc-input"
            value={form.nombreInstitucion}
            onChange={handleChange}
            disabled={!esSuperAdmin}
            maxLength={120}
            aria-invalid={Boolean(errores.nombreInstitucion)}
            required
          />
          {errores.nombreInstitucion && (
            <span className="acc-error-campo" role="alert">
              {errores.nombreInstitucion}
            </span>
          )}
        </div>

        <div className="acc-campo">
          <label className="acc-label" htmlFor="cfg-horaEntradaEsperada">
            Hora de entrada esperada *
          </label>
          <input
            id="cfg-horaEntradaEsperada"
            name="horaEntradaEsperada"
            type="time"
            step="1"
            className="acc-input"
            value={form.horaEntradaEsperada}
            onChange={handleChange}
            disabled={!esSuperAdmin}
            aria-invalid={Boolean(errores.horaEntradaEsperada)}
            required
          />
          <span className="acc-ayuda">Formato HH:mm:ss (ej. 08:00:00)</span>
          {errores.horaEntradaEsperada && (
            <span className="acc-error-campo" role="alert">
              {errores.horaEntradaEsperada}
            </span>
          )}
        </div>

        <div className="acc-campo">
          <label className="acc-label" htmlFor="cfg-horaSalidaEsperada">
            Hora de salida esperada *
          </label>
          <input
            id="cfg-horaSalidaEsperada"
            name="horaSalidaEsperada"
            type="time"
            step="1"
            className="acc-input"
            value={form.horaSalidaEsperada}
            onChange={handleChange}
            disabled={!esSuperAdmin}
            aria-invalid={Boolean(errores.horaSalidaEsperada)}
            required
          />
          <span className="acc-ayuda">Formato HH:mm:ss (ej. 18:30:00)</span>
          {errores.horaSalidaEsperada && (
            <span className="acc-error-campo" role="alert">
              {errores.horaSalidaEsperada}
            </span>
          )}
        </div>

        <div className="acc-campo">
          <label className="acc-label" htmlFor="cfg-toleranciaMinutos">
            Tolerancia de ingreso (minutos) *
          </label>
          <input
            id="cfg-toleranciaMinutos"
            name="toleranciaMinutos"
            type="number"
            min="0"
            max="180"
            className="acc-input"
            value={form.toleranciaMinutos}
            onChange={handleChange}
            disabled={!esSuperAdmin}
            aria-invalid={Boolean(errores.toleranciaMinutos)}
            required
          />
          <span className="acc-ayuda">Entre 0 y 180 minutos.</span>
          {errores.toleranciaMinutos && (
            <span className="acc-error-campo" role="alert">
              {errores.toleranciaMinutos}
            </span>
          )}
        </div>

        <div className="acc-campo">
          <span className="acc-label">Preferencia visual</span>
          <label className="acc-check-fila" htmlFor="cfg-temaOscuro">
            <input
              id="cfg-temaOscuro"
              name="temaOscuro"
              type="checkbox"
              checked={form.temaOscuro}
              onChange={handleChange}
              disabled={!esSuperAdmin}
            />
            <span>Habilitar tema oscuro predeterminado</span>
          </label>
        </div>
      </div>

      {esSuperAdmin && (
        <div className="acc-acciones-fila" style={{ marginTop: "18px" }}>
          <button
            type="submit"
            className="acc-btn acc-btn-primario"
            disabled={guardando}
          >
            {guardando
              ? "Guardando configuración..."
              : "Guardar configuración del sistema"}
          </button>
        </div>
      )}
    </form>
  );
}
