import {contratoBackend,operacionesBackend} from './contrato-modulos.js';
import {registrosDelDia} from './database.js';

class ErrorHttp extends Error {constructor(status,mensaje){super(mensaje);this.status=status;}}
export async function leerJson(req){
 const limite=4*1024*1024;
 if(req.body!==undefined){
  const valor=typeof req.body==='string'?req.body:JSON.stringify(req.body);
  if(Buffer.byteLength(valor)>limite)throw new ErrorHttp(413,'La solicitud supera 4 MB.');
  return JSON.parse(valor);
 }
 let longitud=0;const partes=[];
 for await(const parte of req){longitud+=Buffer.byteLength(parte);if(longitud>limite)throw new ErrorHttp(413,'La solicitud supera 4 MB.');partes.push(Buffer.from(parte));}
 return JSON.parse(Buffer.concat(partes).toString('utf8')||'{}');
}
export function direccionApi(configurada){
 if(!configurada)throw new ErrorHttp(503,'Falta configurar la API de reglas del sistema.');
 let url;try{url=new URL(configurada);}catch{throw new ErrorHttp(503,'Configuración de API inválida.');}
 if(url.username||url.password||url.search||url.hash||!['https:','http:'].includes(url.protocol)||
  (url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw new ErrorHttp(503,'La API remota requiere HTTPS y una dirección sin credenciales.');
 return url.href.replace(/\/$/,'');
}
export function crearBackend({fetchApi=fetch,leerRegistros=registrosDelDia,configuracion=()=>process.env.REGISTRO_DESKTOP_API_URL}={}){
 return async function handler(req,res){
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const responder=(status,datos)=>{res.statusCode=status;res.end(JSON.stringify(datos));};
  if(req.method==='GET')return responder(200,contratoBackend);
  if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return responder(405,{mensaje:'Use GET para el contrato o POST para operaciones.'});}
  try{
   const body=await leerJson(req);
   if(!body||typeof body!=='object'||Array.isArray(body))throw new ErrorHttp(400,'El cuerpo debe ser un objeto JSON.');
   const {operacion,datos={}}=body;
   const publica=['sesion','registro-encargado'].includes(operacion);
   if(!publica&&!operacionesBackend.has(operacion))throw new ErrorHttp(400,'Operación no disponible. Consulte GET /api/backend.');
   if(!datos||typeof datos!=='object'||Array.isArray(datos))throw new ErrorHttp(400,'datos debe ser un objeto JSON.');
   const autorizacion=req.headers?.authorization;
   if(!publica&&(typeof autorizacion!=='string'||!/^Bearer \S+$/i.test(autorizacion)))throw new ErrorHttp(401,'Inicie sesión para consultar o modificar datos.');
   const base=direccionApi(configuracion());
   const directa=operacion==='web.registros-dia';
   const ruta=publica?operacion:`operaciones/${directa?'sesion.actual':operacion}`;
   // No se admiten x-rol-usuario, x-usuario ni identidades suministradas por el navegador.
   const headers={'Content-Type':'application/json',...(publica?{}:{Authorization:autorizacion})};
   const upstream=await fetchApi(`${base}/api/${ruta}`,{method:'POST',headers,body:JSON.stringify(directa?{}:datos),redirect:'error',signal:AbortSignal.timeout(20000)});
   const texto=await upstream.text();
   let resultado;try{resultado=texto?JSON.parse(texto):null;}catch{throw new ErrorHttp(502,'La API de reglas devolvió una respuesta inválida.');}
   if(!upstream.ok){const codigo=[400,401,403,404,409,413,422,429,503].includes(upstream.status)?upstream.status:502;
    return responder(codigo,{mensaje:resultado?.mensaje??'La API rechazó la solicitud.',...(resultado?.errores?{errores:resultado.errores}:{})});}
   if(directa){if(!Number.isSafeInteger(resultado?.idUsuario)||resultado.idUsuario<=0)throw new ErrorHttp(401,'Sesión inválida.');resultado=await leerRegistros(resultado.idUsuario);}
   if(operacion==='sesion')resultado={tokenType:resultado.tokenType,accessToken:resultado.accessToken,expiresIn:resultado.expiresIn};
   return responder(upstream.status,resultado);
  }catch(error){
   const codigo=error instanceof SyntaxError?400:error.name==='TimeoutError'?504:[400,401,403,413,503].includes(error.status)?error.status:503;
   return responder(codigo,{mensaje:error instanceof SyntaxError?'JSON inválido.':error instanceof ErrorHttp?error.message:codigo===403?'No tiene permiso para consultar estos datos.':codigo===504?'La API no respondió a tiempo.':'No se pudo completar la operación. Revise la conexión del backend.'});
  }
 };
}
