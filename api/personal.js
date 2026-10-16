export default function handler(req,res){
 // Pendiente del módulo 2: autenticar, autorizar y conectar con el sistema de escritorio.
 // No devolver datos reales hasta implementar esas comprobaciones.
 res.setHeader("Content-Type","application/json; charset=utf-8");
 res.setHeader("Cache-Control","no-store");
 res.statusCode=501;
 res.end(JSON.stringify({mensaje:"Integración de personal pendiente del módulo 2."}));
}
