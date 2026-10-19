import pg from 'pg';
let pool;
export function opcionesConexion(valor=process.env.DATABASE_URL){
 if(!valor)throw new Error('Falta DATABASE_URL en la configuración privada del backend.');
 let url;try{url=new URL(valor);}catch{throw new Error('DATABASE_URL debe ser una URL PostgreSQL.');}
 if(!['postgres:','postgresql:'].includes(url.protocol)||!url.hostname||url.pathname==='/')throw new Error('DATABASE_URL debe identificar una base PostgreSQL.');
 // Eliminar opciones SSL de la URL para que no sustituyan la validación TLS.
 for(const key of ['sslmode','sslcert','sslkey','sslrootcert','ssl'])url.searchParams.delete(key);
 return {connectionString:url.href,ssl:{rejectUnauthorized:true},enableChannelBinding:true,max:3,idleTimeoutMillis:20000,connectionTimeoutMillis:10000,statement_timeout:10000,application_name:'registro-personal-web'};
}
export function conexion(){if(!pool){pool=new pg.Pool(opcionesConexion());pool.on('error',()=>console.error('Se cerró una conexión inactiva de PostgreSQL.'));}return pool;}
export async function cerrarConexion(){if(pool){const anterior=pool;pool=undefined;await anterior.end();}}
export async function comprobarBase(db=conexion()){
 const cliente=await db.connect();
 try {
 const {rows}=await cliente.query(`SELECT to_regclass('registro."Personal"') IS NOT NULL AS personal,
 to_regclass('registro."Asistencias"') IS NOT NULL AS asistencias,
 to_regclass('registro."Usuarios"') IS NOT NULL AS usuarios,
 current_setting('TimeZone') AS zona_servidor`);
 const estado=rows[0];if(!estado.personal||!estado.asistencias||!estado.usuarios)throw new Error('Faltan tablas compartidas de C#.');
 const cifrada=cliente.connection?.stream?.encrypted===true;
 if(!cifrada)throw new Error('La conexión requiere TLS.');
 return {conectada:true,cifrada,esquema:'registro',zonaHorariaAplicacion:'America/La_Paz'};
 } finally {cliente.release();}
}
export async function registrosDelDia(idUsuario,db=conexion()){
 const usuario=await db.query('SELECT "Rol", "Activo" FROM registro."Usuarios" WHERE "IdUsuario"=$1',[idUsuario]);
 const u=usuario.rows[0];
 if(!u?.Activo||!['SuperAdmin','Admin'].includes(u.Rol)){const error=new Error('Sesión no autorizada.');error.status=403;throw error;}
 const {rows}=await db.query(`SELECT p."Codigo" AS codigo, p."Nombres" AS nombres, p."Apellidos" AS apellidos,
 a."Fecha"::text AS fecha, a."HoraEntrada"::text AS entrada, a."HoraSalida"::text AS salida,
 a."HoraInicioAlmuerzo"::text AS "inicioAlmuerzo", a."HoraFinAlmuerzo"::text AS "finAlmuerzo",
 a."MinutosTrabajados" AS "minutosTrabajados", a."Version" AS version
 FROM registro."Asistencias" a JOIN registro."Personal" p ON p."IdPasante"=a."IdPasante"
 WHERE a."Fecha"=(CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date
 ORDER BY p."Apellidos",p."Nombres",p."Codigo" LIMIT 1000`);
 return {registros:rows,actualizadoEn:new Date().toISOString(),zonaHoraria:'America/La_Paz',limite:1000};
}
