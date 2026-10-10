"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { ES_UUID } from "@/lib/formato";
import { refrescarMedicion } from "@/lib/obra/refrescar";
import { MAX_FOTOS } from "@/lib/obra/bitacora";
import { esFechaValida } from "@/lib/registros/leer";

function mensaje(e: { code?: string; message: string }): string {
  if (e.code === "42501" || e.code === "22023") return e.message;
  console.error("Fallo en la bitácora:", { codigo: e.code, mensaje: e.message });
  return `No se pudo guardar${e.code ? ` (código ${e.code})` : ""}. Intenta de nuevo.`;
}

// Paso 1 de la subida de fotos: el servidor verifica permisos y entrega una dirección firmada por foto.
export async function prepararSubidas(proyectoId: string, cantidad: number): Promise<{ error?: string; bitacoraId?: string; subidas?: { ruta: string; token: string }[] }> {
  if (!ES_UUID.test(proyectoId) || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_FOTOS) return { error: `Elige entre 1 y ${MAX_FOTOS} fotos.` };
  const { supabase } = await cargarProyecto(proyectoId);
  const bitacoraId = randomUUID();
  const subidas: { ruta: string; token: string }[] = [];
  for (let i = 0; i < cantidad; i++) {
    const ruta = `${proyectoId}/${bitacoraId}/${randomUUID()}.jpg`;
    const { data, error } = await supabase.storage.from("bitacora").createSignedUploadUrl(ruta);
    if (error || !data) {
      console.error("Fallo al preparar la subida:", error?.message);
      return { error: "No se pudo preparar la subida de fotos. Verifica que tengas permiso de registrar la bitácora." };
    }
    subidas.push({ ruta, token: data.token });
  }
  return { bitacoraId, subidas };
}

const num = (d: FormData, k: string) => String(d.get(k) ?? "").trim().replace(",", ".");

export async function guardarBitacora(proyectoId: string, datos: FormData): Promise<{ error?: string }> {
  if (!ES_UUID.test(proyectoId)) return { error: "Dirección no válida." };
  const { supabase, permisos } = await cargarProyecto(proyectoId);
  const bitacoraId = String(datos.get("bitacora_id") ?? "") || randomUUID();
  if (!ES_UUID.test(bitacoraId)) return { error: "Identificador de entrada no válido." };
  const fecha = String(datos.get("fecha") ?? "");
  if (!esFechaValida(fecha)) return { error: "Indica la fecha de la bitácora." };

  let actividades: unknown, fotos: unknown;
  try {
    actividades = JSON.parse(String(datos.get("actividades") ?? "[]"));
    fotos = JSON.parse(String(datos.get("fotos") ?? "[]"));
  } catch {
    return { error: "Los datos de las actividades no son válidos." };
  }
  if (!Array.isArray(actividades) || !Array.isArray(fotos) || fotos.length > MAX_FOTOS || fotos.some((f) => typeof f !== "string")) return { error: "Los datos de las actividades o las fotos no son válidos." };
  if (actividades.some((a) => typeof a !== "object" || a === null)) return { error: "Los datos de las actividades no son válidos." };

  const txt = (k: string) => String(datos.get(k) ?? "").trim();
  // Números de la bitácora: enteros o decimales con punto/coma; si no, se avisa qué campo está mal.
  for (const [campo, nombre] of [["personal_propio", "Personal propio"], ["personal_subcontratistas", "Personal de subcontratistas"], ["horas_perdidas_clima", "Horas perdidas por clima"], ["retraso_horas", "Horas del retraso"]] as const) {
    const v = txt(campo).replace(",", ".");
    if (v !== "" && !/^\d+(\.\d+)?$/.test(v)) return { error: `${nombre} debe ser un número (por ejemplo 8 o 2,5).` };
  }
  const datosRpc = {
    fecha, clima: txt("clima"), horas_perdidas_clima: num(datos, "horas_perdidas_clima") || "0",
    personal_propio: num(datos, "personal_propio"), personal_subcontratistas: num(datos, "personal_subcontratistas") || "0",
    retraso_causa: txt("retraso_causa"), retraso_horas: num(datos, "retraso_horas"), retraso_descripcion: txt("retraso_descripcion"),
    incidente_tipo: txt("incidente_tipo"), incidente_persona: txt("incidente_persona"), incidente_descripcion: txt("incidente_descripcion"),
    materiales: txt("materiales"), equipos: txt("equipos"), visitas: txt("visitas"), instrucciones: txt("instrucciones"), observaciones: txt("observaciones"),
  };
  const { error } = await supabase.rpc("bitacora_crear", { p_id: bitacoraId, p_proyecto: proyectoId, p_datos: datosRpc, p_actividades: actividades, p_fotos: fotos });
  if (error) return { error: mensaje(error) };
  if (!permisos.interventor) await refrescarMedicion(supabase, proyectoId);
  revalidatePath(`/proyectos/${proyectoId}`, "layout");
  redirect(`/proyectos/${proyectoId}/bitacora/${bitacoraId}?ok=guardado`);
}

export async function comentarBitacora(proyectoId: string, bitacoraId: string, tipo: "visto_bueno" | "comentario", datos: FormData): Promise<void> {
  if (!ES_UUID.test(bitacoraId)) redirect(`/proyectos/${proyectoId}/bitacora`);
  const { supabase } = await cargarProyecto(proyectoId);
  const { error } = await supabase.rpc("bitacora_comentar", { p_bitacora: bitacoraId, p_tipo: tipo, p_texto: String(datos.get("texto") ?? "") });
  revalidatePath(`/proyectos/${proyectoId}`, "layout");
  const base = `/proyectos/${proyectoId}/bitacora/${bitacoraId}`;
  redirect(error ? `${base}?error=${encodeURIComponent(mensaje(error))}` : `${base}?ok=guardado`);
}
