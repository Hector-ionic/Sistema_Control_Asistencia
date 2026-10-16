// Todas las consultas pasan por el backend de este mismo proyecto.
export async function consultarEstado() {
 const respuesta = await fetch("/api/estado", {cache:"no-store",signal:AbortSignal.timeout(10000)});
 if(!respuesta.ok) throw new Error("No se pudo conectar con el backend.");
 return respuesta.json();
}
