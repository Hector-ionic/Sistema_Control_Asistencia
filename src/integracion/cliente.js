export async function consultar(operacion,datos={},token='',signal){
 const res=await fetch('/api/integracion',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({operacion,datos}),signal:signal??AbortSignal.timeout(25000)});
 const data=await res.json();
 if(!res.ok){const error=new Error(data.mensaje??'No se pudo completar la operación.');error.status=res.status;throw error;}
 return data;
}
export function hoyBolivia(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/La_Paz',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function fotoUrl(base64){const tipo=base64.startsWith('/9j/')?'image/jpeg':base64.startsWith('UklG')?'image/webp':'image/png';return `data:${tipo};base64,${base64}`;}
export function registroHoras(form){return {codigo:form.codigo,fecha:form.fecha,horaEntrada:form.entrada+':00',horaSalida:form.salida+':00',horaInicioAlmuerzo:form.almuerzoInicio?form.almuerzoInicio+':00':null,horaFinAlmuerzo:form.almuerzoFin?form.almuerzoFin+':00':null,observaciones:null,jornadaExtendida:false,reemplazarExistente:false};}
