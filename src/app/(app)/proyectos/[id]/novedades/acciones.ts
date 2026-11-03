"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { ES_UUID } from "@/lib/formato";
import { esFechaValida } from "@/lib/registros/leer";

import { MAX_FOTOS_NOVEDAD } from "@/lib/obra/novedades";
function mensaje(e: { code?: string; message: string }): string {
  if (e.code === "42501" || e.code === "22023") return e.message;
  console.error("Fallo en las novedades:", { codigo: e.code, mensaje: e.message });
  return `No se pudo completar la operación${e.code ? ` (código ${e.code})` : ""}. Intenta de nuevo.`;
}
const base = (id: string) => `/proyectos/${id}/novedades`;

// Paso 1 de la subida de fotos: el servidor verifica permisos y entrega una dirección firmada por foto.
export async function prepararSubidasNovedad(proyectoId: string, cantidad: number): Promise<{ error?: string; novedadId?: string; subidas?: { ruta: string; token: string }[] }> {
  if (!ES_UUID.test(proyectoId) || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_FOTOS_NOVEDAD) return { error: `Elige entre 1 y ${MAX_FOTOS_NOVEDAD} fotos.` };
  const { supabase } = await cargarProyecto(proyectoId);
  const novedadId = randomUUID();
  const subidas: { ruta: string; token: string }[] = [];
  for (let i = 0; i < cantidad; i++) {
    const ruta = `${proyectoId}/${novedadId}/${randomUUID()}.jpg`;
    const { data, error } = await supabase.storage.from("novedades").createSignedUploadUrl(ruta);
    if (error || !data) { console.error("Fallo al preparar la subida de novedades:", error?.message); return { error: "No se pudo preparar la subida de fotos. Verifica que tengas permiso de registrar novedades." }; }
    subidas.push({ ruta, token: data.token });
  }
  return { novedadId, subidas };
}

export async function crearNovedad(proyectoId: string, datos: FormData): Promise<{ error?: string }> {
  if (!ES_UUID.test(proyectoId)) return { error: "Dirección no válida." };
  const contrato = String(datos.get("contrato_id") ?? "");
  if (!ES_UUID.test(contrato)) return { error: "Elige el contrato." };
  const fecha = String(datos.get("fecha") ?? "");
  if (!esFechaValida(fecha)) return { error: "Indica una fecha válida." };
  let fotos: unknown;
  try { fotos = JSON.parse(String(datos.get("fotos") ?? "[]")); } catch { return { error: "Las fotos no son válidas." }; }
  if (!Array.isArray(fotos) || fotos.length > MAX_FOTOS_NOVEDAD || fotos.some((f) => typeof f !== "string")) return { error: "Las fotos no son válidas." };
  const idRaw = String(datos.get("novedad_id") ?? "");
  const novedadId = ES_UUID.test(idRaw) ? idRaw : randomUUID();
  const { supabase } = await cargarProyecto(proyectoId);
  const { error } = await supabase.rpc("novedad_crear", {
    p_id: novedadId, p_proyecto: proyectoId, p_contrato: contrato,
    p_datos: { tipo: String(datos.get("tipo") ?? "otro"), fecha, descripcion: String(datos.get("descripcion") ?? "") }, p_fotos: fotos,
  });
  if (error) return { error: mensaje(error) };
  revalidatePath(base(proyectoId));
  redirect(`${base(proyectoId)}?ok=novedad`);
}

export async function revisarNovedad(proyectoId: string, novedadId: string, accion: "aplicar" | "descartar", datos: FormData): Promise<void> {
  if (!ES_UUID.test(novedadId)) redirect(base(proyectoId));
  const { supabase } = await cargarProyecto(proyectoId);
  const { error } = await supabase.rpc("novedad_revisar", { p_novedad: novedadId, p_accion: accion, p_nota: String(datos.get("nota") ?? "") });
  revalidatePath(`/proyectos/${proyectoId}`, "layout");
  redirect(`${base(proyectoId)}?${error ? `error=${encodeURIComponent(mensaje(error))}` : `ok=novedad_${accion === "aplicar" ? "aplicada" : "descartada"}`}`);
}
