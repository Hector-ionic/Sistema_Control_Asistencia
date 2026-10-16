const operaciones = new Set(['sesion.actual','personal.listar','personal.para-horas','personal.guardar','correcciones.enviar','correcciones.listar','correcciones.revisar','asistencia.manual']);
export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store'); res.setHeader('Content-Type','application/json; charset=utf-8');
 const enviar=(codigo,mensaje)=>{res.statusCode=codigo;res.end(JSON.stringify({mensaje}));};
 if(req.method!=='POST')return enviar(405,'Use POST.');
 try {
  let body=req.body;
  if(body==null){let texto='';for await(const chunk of req){texto+=chunk;if(Buffer.byteLength(texto)>8*1024*1024)return enviar(413,'La solicitud es demasiado grande.');}body=JSON.parse(texto);}
  if(typeof body==='string')body=JSON.parse(body);
  const {operacion,datos}=body??{};
  if(!['sesion','registro-encargado'].includes(operacion)&&!operaciones.has(operacion))return enviar(400,'Operación no disponible en esta integración.');
  const configurada=process.env.REGISTRO_DESKTOP_API_URL;
  if(!configurada)return enviar(503,'Configure REGISTRO_DESKTOP_API_URL en el backend para conectar la API C#.');
  const base=new URL(configurada);
  if(base.username||base.password||base.search||base.hash||!['https:','http:'].includes(base.protocol))return enviar(503,'Configuración de API inválida.');
  if(base.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(base.hostname))return enviar(503,'La API remota debe usar HTTPS.');
  const ruta=['sesion','registro-encargado'].includes(operacion)?operacion:`operaciones/${operacion}`;
  const headers={'Content-Type':'application/json'};
  if(req.headers.authorization)headers.Authorization=req.headers.authorization;
  const respuesta=await fetch(`${base.href.replace(/\/$/,'')}/api/${ruta}`,{method:'POST',headers,body:JSON.stringify(datos??{}),redirect:'error',signal:AbortSignal.timeout(20000)});
  res.statusCode=respuesta.status;
  const texto=await respuesta.text();
  if(!texto)return res.end(JSON.stringify({mensaje:respuesta.ok?'Completado.':'La sesión o solicitud no es válida.'}));
  try{res.end(JSON.stringify(JSON.parse(texto)));}catch{enviar(502,'La API no devolvió una respuesta JSON válida.');}
 }catch(error){enviar(error instanceof SyntaxError?400:502,error instanceof SyntaxError?'Solicitud JSON inválida.':'No se pudo conectar con la API de escritorio.');}
}
