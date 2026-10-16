import {defineConfig} from "vite";
import estado from "./api/estado.js";
import personal from "./api/personal.js";
export default defineConfig({
 plugins:[{name:"api-local",configureServer(server){server.middlewares.use((req,res,next)=>{
   const ruta=req.url.split("?")[0];
   if(ruta==="/api/estado")return estado(req,res);
   if(ruta==="/api/personal")return personal(req,res);
   if(ruta.startsWith("/api/")){res.statusCode=404;res.setHeader("Content-Type","application/json");return res.end(JSON.stringify({mensaje:"Ruta no implementada"}));}
   next();
 });}}],build:{outDir:"dist"}
});
