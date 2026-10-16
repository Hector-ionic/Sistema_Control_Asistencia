import {readFileSync,writeFileSync} from 'node:fs';
const ruta=process.argv[2];
try{
 if(!ruta)throw new Error();
 const texto=readFileSync(ruta,'utf8');
 const cadena=texto.match(/^\s*ConnectionString\s*=\s*(.+)$/mi)?.[1]?.trim();
 if(!cadena)throw new Error();
 let url;
 if(/^postgres(?:ql)?:\/\//.test(cadena))url=new URL(cadena);
 else{
  const partes={};
  for(const m of cadena.matchAll(/(?:^|;)\s*([^=;]+)\s*=\s*("(?:[^"]|"")*"|'(?:[^']|'')*'|[^;]*)/g)){
   let valor=m[2].trim();if((valor.startsWith('"')&&valor.endsWith('"'))||(valor.startsWith("'")&&valor.endsWith("'")))valor=valor.slice(1,-1).replace(/""/g,'"').replace(/''/g,"'");
   partes[m[1].trim().toLowerCase()]=valor;
  }
  const host=partes.host??partes.server,usuario=partes.username??partes['user id']??partes.user,clave=partes.password,base=partes.database;
  if(!host||!usuario||!clave||!base)throw new Error();
  url=new URL(`postgresql://${encodeURIComponent(usuario)}:${encodeURIComponent(clave)}@${host}:${partes.port??5432}/${encodeURIComponent(base)}`);
 }
 let existente='';try{existente=readFileSync('.env.local','utf8');}catch{}
 if(/^\s*DATABASE_URL\s*=/m.test(existente)){console.log('DATABASE_URL ya está configurada; no se reemplazó.');}
 else{writeFileSync('.env.local',existente.trimEnd()+`\nDATABASE_URL=${url.href}\n`,{mode:0o600});console.log('Conexión privada configurada en .env.local. No se mostraron credenciales.');}
}catch{console.error('No se pudo importar la conexión. Indique el config.ini de C#; no se mostraron sus datos.');process.exitCode=1;}
