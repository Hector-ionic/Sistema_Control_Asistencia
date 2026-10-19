import test from 'node:test';
import assert from 'node:assert/strict';
import {opcionesConexion,registrosDelDia} from '../server/database.js';
import handler from '../api/registros.js';
test('PostgreSQL fuerza verificación TLS incluso con sslmode en la URL',()=>{
 const opciones=opcionesConexion('postgresql://usuario:clave@db.example/base?sslmode=disable');
 assert.equal(opciones.ssl.rejectUnauthorized,true);assert.equal(new URL(opciones.connectionString).searchParams.has('sslmode'),false);assert.equal(opciones.max,3);
 assert.throws(()=>opcionesConexion('https://example.com/base'));
});
test('Registros consulta usuario mediante parámetro y niega acceso al encargado',async()=>{
 let consultas=0;
 await assert.rejects(()=>registrosDelDia(5,{query:async(sql,parametros)=>{consultas++;assert.deepEqual(parametros,[5]);assert.ok(sql.includes('$1'));return {rows:[{Rol:'Encargado',Activo:true}]};}}),{status:403});
 assert.equal(consultas,1);
});
test('Lectura de registros usa el día de Bolivia y no expone datos de credenciales',async()=>{
 let consultas=0;
 const resultado=await registrosDelDia(1,{query:async(sql)=>{consultas++;if(consultas===1)return {rows:[{Rol:'SuperAdmin',Activo:true}]};assert.ok(sql.includes("AT TIME ZONE 'America/La_Paz'"));assert.ok(!sql.includes('PasswordHash'));assert.ok(!/SELECT\s+\*/i.test(sql));return {rows:[{codigo:'P0001',minutosTrabajados:480}]};}});
 assert.equal(resultado.registros[0].minutosTrabajados,480);assert.equal(resultado.zonaHoraria,'America/La_Paz');
});
test('API de registros no consulta la base sin sesión',async()=>{
 const res={setHeader(){},end(texto){this.body=JSON.parse(texto);}};
 await handler({method:'GET',headers:{}},res);assert.equal(res.statusCode,401);
 await handler({method:'POST',headers:{}},res);assert.equal(res.statusCode,405);
});
