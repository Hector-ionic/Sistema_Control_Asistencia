import {comprobarBase,cerrarConexion} from './database.js';
try{console.log(JSON.stringify(await comprobarBase()));}
catch{console.error('No se pudo verificar PostgreSQL. Revise DATABASE_URL, TLS y el esquema registro. No se mostraron credenciales.');process.exitCode=1;}
finally{await cerrarConexion();}
