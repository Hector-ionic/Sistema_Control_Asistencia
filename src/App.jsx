import React, {useEffect,useState} from "react";
import {modulos} from "../shared/modulos.js";
import {consultarEstado} from "./services/api.js";
import Acceso from "./modules/acceso/index.jsx";
import Personal from "./modules/personal/index.jsx";
import Asistencia from "./modules/asistencia/index.jsx";
import Reportes from "./modules/reportes/index.jsx";
import Operaciones from "./modules/operaciones/index.jsx";
const pantallas={acceso:Acceso,personal:Personal,asistencia:Asistencia,reportes:Reportes,operaciones:Operaciones};
export default function App(){
 const [seleccion,setSeleccion]=useState(null),[estado,setEstado]=useState("Conectando con backend…");
 useEffect(()=>{let activo=true;consultarEstado().then(()=>{if(activo)setEstado("Frontend + backend conectados");}).catch(()=>{if(activo)setEstado("Backend no disponible en esta vista");});return()=>{activo=false;};},[]);
 const modulo=modulos.find(m=>m.id===seleccion), Pantalla=pantallas[seleccion];
 return <main><header><div className="marca">SII <span>OFICINA SANTIAGO II</span></div><span className="estado">{estado}</span></header><section className="introduccion"><span className="numero">BASE PARA TRABAJO EN EQUIPO</span><h1>Cinco módulos.<br/>Un solo proyecto.</h1><p>React y JavaScript en el frontend. API Node.js en el backend. Cada módulo tiene su espacio y sus tareas, listas para desarrollar juntos.</p><div className="etiquetas"><span>JavaScript + JSX</span><span>Sin TypeScript</span><span>Un repositorio · Vercel</span></div></section>{modulo?<><button className="volver" onClick={()=>setSeleccion(null)}>← Ver los cinco módulos</button><Pantalla modulo={modulo}/></>:<section className="modulos" aria-label="Módulos de trabajo">{modulos.map(m=><button className="tarjeta" key={m.id} onClick={()=>setSeleccion(m.id)}><span className="numero">MÓDULO {m.numero}</span><h2>{m.nombre}</h2><p>{m.descripcion}</p><span className="tareas">{m.tareas.length} áreas de trabajo · Por desarrollar</span><strong>Ver alcance y tareas →</strong></button>)}</section>}<footer>Esta entrega es una base de desarrollo. La integración con escritorio, la autenticación y los reportes reales están pendientes.</footer></main>;
}
