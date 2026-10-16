import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {crearBackend,direccionApi} from '../server/backend-modulos.js';
import {modulosBackend,operacionesBackend} from '../server/contrato-modulos.js';
const res=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},end(texto){this.body=JSON.parse(texto);}});
const req=(operacion,datos={},token='Bearer prueba')=>({method:'POST',headers:token?{authorization:token}:{},body:{operacion,datos}});
test('Contrato público describe exactamente los cinco módulos sin consultar datos',async()=>{
 const handler=crearBackend({fetchApi:()=>{throw new Error('No debe consultar servicios');}}),r=res();
 await handler({method:'GET'},r);assert.equal(r.statusCode,200);assert.deepEqual(Object.keys(r.body.modulos),['acceso','personal','asistencia','reportes','operaciones']);assert.equal(r.headers['Cache-Control'],'no-store');
});
for(const operacion of operacionesBackend){
 test(`${operacion}: exige sesión y conserva la operación de destino`,async()=>{
  let llamadas=0;
  const handler=crearBackend({configuracion:()=> 'https://api.example',leerRegistros:async id=>({id,registros:[]}),fetchApi:async(url,opciones)=>{
   llamadas++;assert.equal(url,`https://api.example/api/operaciones/${operacion==='web.registros-dia'?'sesion.actual':operacion}`);
   assert.equal(opciones.headers.Authorization,'Bearer prueba');assert.equal(opciones.redirect,'error');assert.equal(opciones.headers['x-rol-usuario'],undefined);
   return new Response(JSON.stringify(operacion==='web.registros-dia'?{idUsuario:1}:{valor:'confirmado'}),{status:200});
  }});
  const sin=res();await handler(req(operacion,{},null),sin);assert.equal(sin.statusCode,401);assert.equal(llamadas,0);
  const con=res();await handler({...req(operacion),headers:{authorization:'Bearer prueba','x-rol-usuario':'SuperAdmin'}},con);assert.equal(con.statusCode,200);assert.equal(llamadas,1);
 });
}
test('El rechazo de permisos, conflictos y validaciones de negocio se conserva',async()=>{
 for(const status of [400,401,403,409,422,429]){
  const handler=crearBackend({configuracion:()=> 'https://api.example',fetchApi:async()=>new Response(JSON.stringify({mensaje:'Rechazado por servidor'}),{status})}),r=res();
  await handler(req('usuarios.guardar',{usuario:{rol:'SuperAdmin'}}),r);assert.equal(r.statusCode,status);assert.equal(r.body.mensaje,'Rechazado por servidor');
 }
});
test('Sesión pública devuelve token sin guardar ni exponer token de renovación',async()=>{
 const handler=crearBackend({configuracion:()=> 'https://api.example',fetchApi:async(url,opciones)=>{assert.equal(url,'https://api.example/api/sesion');assert.equal(opciones.headers.Authorization,undefined);return new Response(JSON.stringify({accessToken:'prueba',tokenType:'Bearer',expiresIn:28800,refreshToken:'no-exponer'}));}}),r=res();
 await handler(req('sesion',{usuario:'prueba',password:'clave-de-prueba'},null),r);assert.equal(r.statusCode,200);assert.equal(r.body.accessToken,'prueba');assert.equal(r.body.refreshToken,undefined);
});
test('Rechaza URL insegura, operaciones inventadas y JSON inválido o excesivo',async()=>{
 assert.throws(()=>direccionApi('http://api.example'));assert.throws(()=>direccionApi('https://usuario:clave@api.example'));
 const handler=crearBackend({fetchApi:()=>{throw new Error('No debe llamar servicios');}});
 for(const [body,status] of [[{operacion:'sql.ejecutar'},400],['{',400],[{operacion:'sesion',datos:{texto:'x'.repeat(4*1024*1024)}},413]]){const r=res();await handler({method:'POST',headers:{},body},r);assert.equal(r.statusCode,status);}
});
test('POST HTTP real interpreta el cuerpo de Node sin req.body y permite registrar encargado',async()=>{
 const handler=crearBackend({configuracion:()=> 'https://api.example',fetchApi:async(url,opciones)=>{assert.ok(url.endsWith('/api/registro-encargado'));assert.equal(JSON.parse(opciones.body).usuario,'prueba');return new Response(JSON.stringify({rol:'Encargado'}));}});
 const server=createServer(handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const respuesta=await fetch(`http://127.0.0.1:${server.address().port}/api/backend`,{method:'POST',body:JSON.stringify({operacion:'registro-encargado',datos:{usuario:'prueba',password:'clave-de-prueba'}})});assert.equal(respuesta.status,200);assert.equal((await respuesta.json()).rol,'Encargado');}
 finally{await new Promise(resolve=>server.close(resolve));}
});
test('Un fallo de red no revela secretos ni se reintenta una escritura',async()=>{
 let llamadas=0;const handler=crearBackend({configuracion:()=> 'https://api.example',fetchApi:async()=>{llamadas++;throw new Error('DATABASE_URL=secreto');}}),r=res();
 await handler(req('personal.guardar'),r);assert.equal(llamadas,1);assert.equal(r.statusCode,503);assert.ok(!JSON.stringify(r.body).includes('secreto'));
});
