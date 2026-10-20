// src/modules/acceso/components/UsuarioForm.jsx
import React, { useEffect, useState } from "react";
import { ROLES_VALIDOS } from "../mocks/datosPruebaAcceso.js";
import {
  validarUsuarioGuardar,
  permisosPorDefectoSegunRol
} from "../utils/reglasAcceso.js";

const ESTADO_INICIAL_USUARIO = {
  idUsuario: 0,
  nombreUsuario: "",
  rol: "Encargado",
  activo: true,
  password: "",
  permisoPersonal: false,
  permisoAsistencia: true,
  permisoViaticos: false,
  permisoReportes: false,
  permisoConfiguracion: false,
  permisoProyectos: false
};

export default function UsuarioForm({
  usuarioInicial = null,
  usuariosExistentes = [],
  rolSesionActual = "SuperAdmin",
  onGuardar,
  onCancelar,
  guardando = false
}) {
  const [form, setForm] = useState(ESTADO_INICIAL_USUARIO);
  const [errores, setErrores] = useState({});

  const esEdicion = Boolean(usuarioInicial && Number(usuarioInicial.idUsuario) > 0);
  const esSuperAdmin = rolSesionActual === "SuperAdmin";

  useEffect(() => {
    if (usuarioInicial && Number(usuarioInicial.idUsuario) > 0) {
      const basePermisos = permisosPorDefectoSegunRol(usuarioInicial.rol || "Encargado");
      setForm({
        idUsuario: Number(usuarioInicial.idUsuario),
        nombreUsuario: usuarioInicial.nombreUsuario || "",
        rol: usuarioInicial.rol || "Encargado",
        activo: usuarioInicial.activo !== false,
        password: "",
        permisoPersonal:
          usuarioInicial.permisoPersonal !== undefined
            ? Boolean(usuarioInicial.permisoPersonal)
            : basePermisos.permisoPersonal,
        permisoAsistencia:
          usuarioInicial.permisoAsistencia !== undefined
            ? Boolean(usuarioInicial.permisoAsistencia)
            : basePermisos.permisoAsistencia,
        permisoViaticos:
          usuarioInicial.permisoViaticos !== undefined
            ? Boolean(usuarioInicial.permisoViaticos)
            : basePermisos.permisoViaticos,
        permisoReportes:
          usuarioInicial.permisoReportes !== undefined
            ? Boolean(usuarioInicial.permisoReportes)
            : basePermisos.permisoReportes,
        permisoConfiguracion:
          usuarioInicial.permisoConfiguracion !== undefined
            ? Boolean(usuarioInicial.permisoConfiguracion)
            : basePermisos.permisoConfiguracion,
        permisoProyectos:
          usuarioInicial.permisoProyectos !== undefined
            ? Boolean(usuarioInicial.permisoProyectos)
            : basePermisos.permisoProyectos
      });
    } else {
      setForm(ESTADO_INICIAL_USUARIO);
    }
    setErrores({});
  }, [usuarioInicial]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const nuevoValor = type === "checkbox" ? checked : value;

    setForm((prev) => {
      if (name === "rol") {
        const nuevosPermisos = permisosPorDefectoSegunRol(nuevoValor);
        return {
          ...prev,
          rol: nuevoValor,
          ...nuevosPermisos
        };
      }
      return {
        ...prev,
        [name]: nuevoValor
      };
    });

    if (errores[name] || errores.permisos) {
      setErrores((prev) => ({ ...prev, [name]: undefined, permisos: undefined }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const resultado = validarUsuarioGuardar(
      {
        usuario: {
          idUsuario: form.idUsuario,
          nombreUsuario: form.nombreUsuario,
          rol: form.rol,
          activo: form.activo,
          permisoPersonal: form.permisoPersonal,
          permisoAsistencia: form.permisoAsistencia,
          permisoViaticos: form.permisoViaticos,
          permisoReportes: form.permisoReportes,
          permisoConfiguracion: form.permisoConfiguracion,
          permisoProyectos: form.permisoProyectos
        },
        password: form.password
      },
      usuariosExistentes,
      rolSesionActual
    );

    if (!resultado.valido) {
      setErrores(resultado.errores);
      return;
    }

    onGuardar(resultado.datosNormalizados);
  };

  const rolesDisponibles = esSuperAdmin ? ROLES_VALIDOS : ["Encargado"];

  return (
    <form
      className="acc-form-panel"
      onSubmit={handleSubmit}
      noValidate
      aria-label={esEdicion ? "Editar cuenta de usuario" : "Registrar nueva cuenta de usuario"}
    >
      <div className="acc-panel-header">
        <div>
          <h3 style={{ margin: 0 }}>
            {esEdicion
              ? `Editar cuenta #${form.idUsuario} (${form.nombreUsuario})`
              : "Registrar nueva cuenta de usuario"}
          </h3>
          <p className="acc-ayuda" style={{ marginTop: "4px" }}>
            {esEdicion
              ? "Deje la contraseña en blanco para conservar la clave actual de la cuenta."
              : "Solo el propietario/SuperAdmin puede designar cuentas de Administrador."}
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
          <label className="acc-label" htmlFor="acc-nombreUsuario">
            Nombre de usuario *
          </label>
          <input
            id="acc-nombreUsuario"
            name="nombreUsuario"
            type="text"
            className="acc-input"
            placeholder="Ej. carlos.apaza"
            value={form.nombreUsuario}
            onChange={handleChange}
            maxLength={50}
            aria-invalid={Boolean(errores.nombreUsuario)}
            required
          />
          {errores.nombreUsuario && (
            <span className="acc-error-campo" role="alert">
              {errores.nombreUsuario}
            </span>
          )}
        </div>

        <div className="acc-campo">
          <label className="acc-label" htmlFor="acc-rol">
            Rol del usuario *
          </label>
          <select
            id="acc-rol"
            name="rol"
            className="acc-select"
            value={form.rol}
            onChange={handleChange}
            disabled={!esSuperAdmin}
            aria-invalid={Boolean(errores.rol)}
          >
            {rolesDisponibles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <span className="acc-ayuda">
            {esSuperAdmin
              ? "SuperAdmin, Admin o Encargado."
              : "Como Admin, las cuentas creadas tienen rol Encargado."}
          </span>
          {errores.rol && (
            <span className="acc-error-campo" role="alert">
              {errores.rol}
            </span>
          )}
        </div>

        <div className="acc-campo">
          <label className="acc-label" htmlFor="acc-password">
            {esEdicion ? "Nueva contraseña (opcional)" : "Contraseña inicial *"}
          </label>
          <input
            id="acc-password"
            name="password"
            type="password"
            className="acc-input"
            placeholder={
              esEdicion
                ? "Dejar vacío para conservar la clave actual"
                : "Mínimo 8 caracteres"
            }
            value={form.password}
            onChange={handleChange}
            aria-invalid={Boolean(errores.password)}
          />
          {errores.password && (
            <span className="acc-error-campo" role="alert">
              {errores.password}
            </span>
          )}
        </div>

        <div className="acc-campo">
          <span className="acc-label">Estado de la cuenta</span>
          <label className="acc-check-fila" htmlFor="acc-activo">
            <input
              id="acc-activo"
              name="activo"
              type="checkbox"
              checked={form.activo}
              onChange={handleChange}
            />
            <span>
              {form.activo
                ? "Cuenta activa (puede iniciar sesión)"
                : "Cuenta inactiva (acceso bloqueado)"}
            </span>
          </label>
          {errores.activo && (
            <span className="acc-error-campo" role="alert">
              {errores.activo}
            </span>
          )}
        </div>

        <div className="acc-campo acc-campo-completo">
          <span className="acc-label">Permisos habilitados por módulo</span>
          <div className="acc-permisos-grid">
            {[
              ["permisoPersonal", "Personal y Pasantías"],
              ["permisoAsistencia", "Asistencia Diaria"],
              ["permisoProyectos", "Proyectos y Asignaciones"],
              ["permisoViaticos", "Viáticos"],
              ["permisoReportes", "Historial y Reportes"],
              ["permisoConfiguracion", "Configuración del Sistema"]
            ].map(([campo, etiqueta]) => (
              <label key={campo} className="acc-check-fila" htmlFor={`acc-${campo}`}>
                <input
                  id={`acc-${campo}`}
                  name={campo}
                  type="checkbox"
                  checked={form.rol === "SuperAdmin" ? true : Boolean(form[campo])}
                  disabled={form.rol === "SuperAdmin"}
                  onChange={handleChange}
                />
                <span>{etiqueta}</span>
              </label>
            ))}
          </div>
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
            ? "Guardar cambios de cuenta"
            : "Crear cuenta de usuario"}
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
