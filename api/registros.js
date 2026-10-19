import {registrosDelDia} from '../server/database.js';
export default async function handler(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
 const responder=(codigo,datos)=>{res.statusCode=codigo;res.end(JSON.stringify(datos));};
 if(req.method!=='GET')return responder(405,{mensaje:'Use GET.'});
 const token=req.headers.authorization;
 if(typeof token!=='string'||!/^Bearer \S+$/.test(token))return responder(401,{mensaje:'Inicie sesión.'});
 try{
  if(!process.env.REGISTRO_DESKTOP_API_URL||!process.env.DATABASE_URL)return responder(503,{mensaje:'La conexión del backend aún no está configurada.'});
  const base=new URL(process.env.REGISTRO_DESKTOP_API_URL);
  if(base.username||base.password||base.search||base.hash||!['http:','https:'].includes(base.protocol)||
   (base.protocol==='http:'&&!['127.0.0.1','localhost','[::1]'].includes(base.hostname)))throw new Error('Configuración inválida.');
  // Reutilizar la sesión existente; no interferir con el módulo de acceso del equipo.
  const sesion=await fetch(`${base.href.replace(/\/$/,'')}/api/operaciones/sesion.actual`,{method:'POST',headers:{Authorization:token,'Content-Type':'application/json'},body:'{}',redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!sesion.ok)return responder([401,403].includes(sesion.status)?sesion.status:502,{mensaje:'No se pudo validar la sesión.'});
  const usuario=await sesion.json();
  if(!Number.isSafeInteger(usuario.idUsuario)||usuario.idUsuario<=0)return responder(401,{mensaje:'Sesión inválida.'});
  return responder(200,await registrosDelDia(usuario.idUsuario));
 }catch(error){return responder(error.status===403?403:503,{mensaje:error.status===403?'Sesión no autorizada.':'No se pudieron consultar los registros. Compruebe la conexión del servidor.'});}
}
