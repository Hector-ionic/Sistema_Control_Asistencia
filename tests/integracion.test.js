import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import handler from '../api/integracion.js';
import {registroHoras,hoyBolivia} from '../src/integracion/cliente.js';
const respuesta=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},end(v){this.body=JSON.parse(v);}});
test('Puente rechaza métodos y operaciones fuera del alcance',async()=>{
 let res=respuesta();await handler({method:'GET'},res);assert.equal(res.statusCode,405);
 res=respuesta();await handler({method:'POST',body:{operacion:'usuarios.eliminar'},headers:{}},res);assert.equal(res.statusCode,400);
});
test('Puente exige configuración sin inventar datos',async()=>{
 const anterior=process.env.REGISTRO_DESKTOP_API_URL;delete process.env.REGISTRO_DESKTOP_API_URL;
 try{const res=respuesta();await handler({method:'POST',body:{operacion:'sesion'},headers:{}},res);assert.equal(res.statusCode,503);assert.equal(res.headers['Cache-Control'],'no-store');}
 finally{if(anterior===undefined)delete process.env.REGISTRO_DESKTOP_API_URL;else process.env.REGISTRO_DESKTOP_API_URL=anterior;}
});
test('Puente transmite token, cuerpo y rechazo de permisos de C# sin alterarlos',async()=>{
 const anterior=process.env.REGISTRO_DESKTOP_API_URL;
 const servidor=createServer(async(req,res)=>{let texto='';for await(const chunk of req)texto+=chunk;assert.equal(req.url,'/api/operaciones/correcciones.revisar');assert.equal(req.headers.authorization,'Bearer token-de-prueba');assert.deepEqual(JSON.parse(texto),{id:'prueba',aprobar:true});res.writeHead(403,{'Content-Type':'application/json'});res.end(JSON.stringify({mensaje:'No autorizado'}));});
 await new Promise(resolve=>servidor.listen(0,'127.0.0.1',resolve));
 try{process.env.REGISTRO_DESKTOP_API_URL=`http://127.0.0.1:${servidor.address().port}`;const res=respuesta();await handler({method:'POST',headers:{authorization:'Bearer token-de-prueba'},body:{operacion:'correcciones.revisar',datos:{id:'prueba',aprobar:true}}},res);assert.equal(res.statusCode,403);assert.equal(res.body.mensaje,'No autorizado');}
 finally{await new Promise(resolve=>servidor.close(resolve));if(anterior===undefined)delete process.env.REGISTRO_DESKTOP_API_URL;else process.env.REGISTRO_DESKTOP_API_URL=anterior;}
});
test('Registro diario envía los campos de C# sin reemplazar asistencia',()=>{
 const r=registroHoras({codigo:'P01',fecha:'2026-10-16',entrada:'08:00',salida:'16:00',almuerzoInicio:'12:00',almuerzoFin:'13:00'});
 assert.equal(r.horaEntrada,'08:00:00');assert.equal(r.horaFinAlmuerzo,'13:00:00');assert.equal(r.reemplazarExistente,false);assert.match(hoyBolivia(),/^\d{4}-\d{2}-\d{2}$/);
});
