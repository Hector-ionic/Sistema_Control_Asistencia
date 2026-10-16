import {defineConfig,loadEnv} from "vite";
import integracion from "./api/integracion.js";
import registros from "./api/registros.js";
import backend from "./api/backend.js";
import estado from "./api/estado.js";
import personal from "./api/personal.js";
export default defineConfig(({mode})=>{
 const entorno=loadEnv(mode,process.cwd(),'REGISTRO_');
 const privado=loadEnv(mode,process.cwd(),'DATABASE_');
 if(!process.env.DATABASE_URL&&privado.DATABASE_URL)process.env.DATABASE_URL=privado.DATABASE_URL;
 if(!process.env.REGISTRO_DESKTOP_API_URL&&entorno.REGISTRO_DESKTOP_API_URL)process.env.REGISTRO_DESKTOP_API_URL=entorno.REGISTRO_DESKTOP_API_URL;
 return {
 plugins:[{name:"api-local",configureServer(server){server.middlewares.use((req,res,next)=>{
   const ruta=req.url.split("?")[0];
   if(ruta==="/api/backend")return backend(req,res);
   if(ruta==="/api/integracion")return integracion(req,res);
   if(ruta==="/api/registros")return registros(req,res);
   if(ruta==="/api/estado")return estado(req,res);
   if(ruta==="/api/personal")return personal(req,res);
   if(ruta.startsWith("/api/")){res.statusCode=404;res.setHeader("Content-Type","application/json");return res.end(JSON.stringify({mensaje:"Ruta no implementada"}));}
   next();
 });}}],build:{outDir:"dist",rollupOptions:{input:{equipo:'index.html',integracion:'integracion.html'}}}
};});
