import React from "react";
export default function ModuloBase({modulo}) {
 return <section className="detalle-modulo"><span className="numero">MÓDULO {modulo.numero}</span><h2>{modulo.nombre}</h2><p>{modulo.descripcion}</p><h3>Trabajo por desarrollar</h3><ul>{modulo.tareas.map(t=><li key={t}>{t}</li>)}</ul><div className="aceptacion"><strong>Criterio de aceptación</strong><p>{modulo.aceptacion}</p></div><p className="ruta">Código del módulo: src/modules/{modulo.id}/</p></section>;
}
