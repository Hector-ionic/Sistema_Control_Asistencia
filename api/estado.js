import {modulos} from "../shared/modulos.js";
export default function handler(req,res){
 res.setHeader("Cache-Control","no-store");
 if(req.method!=="GET"){res.setHeader("Allow","GET");res.statusCode=405;return res.end(JSON.stringify({mensaje:"Método no permitido"}));}
 res.setHeader("Content-Type","application/json; charset=utf-8");
 res.statusCode=200;res.end(JSON.stringify({estado:"base",frontend:"React JavaScript",backend:"Node.js",modulos:modulos.map(m=>m.id),escritorio:"pendiente"}));
}
