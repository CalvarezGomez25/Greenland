"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { ES_UUID } from "@/lib/formato";
import { leerDatosCambio } from "@/lib/pmo/cambios-form";
import type { Estado } from "@/lib/presupuesto/estado";

function valoresDe(datos: FormData): Record<string, string> {
  const v: Record<string, string> = {};
  for (const [k, x] of datos.entries()) if (typeof x === "string" && !k.startsWith("$")) v[k] = k === "ambitos" ? (v[k] ? `${v[k]},${x}` : x) : x;
  return v;
}

function mensaje(error: { code?: string; message: string }): string {
  if (error.code === "42501" || error.code === "22023") return error.message;
  if (error.code === "28000") return "Debes iniciar sesión de nuevo.";
  console.error("Fallo en el control de cambios:", { codigo: error.code, mensaje: error.message });
  return `No se pudo completar la operación${error.code ? ` (código ${error.code})` : ""}.`;
}

export async function crearCambio(proyectoId: string, _prev: Estado, datos: FormData): Promise<Estado> {
  const { supabase, permisos } = await cargarProyecto(proyectoId);
  const valores = valoresDe(datos);
  if (!permisos.gestionar) return { error: "No tienes permiso para registrar cambios.", valores };
  const l = leerDatosCambio(datos);
  if ("error" in l) return { error: l.error, valores };
  const { data, error } = await supabase.rpc("cambio_crear", { p_proyecto: proyectoId, p_datos: l.datos });
  if (error) return { error: mensaje(error), valores };
  revalidatePath(`/proyectos/${proyectoId}`, "layout");
  redirect(`/proyectos/${proyectoId}/cambios/${data}?ok=guardado`);
}

export async function actualizarCambio(proyectoId: string, cambioId: string, _prev: Estado, datos: FormData): Promise<Estado> {
  if (!ES_UUID.test(cambioId)) return { error: "Dirección no válida." };
  const { supabase } = await cargarProyecto(proyectoId);
  const valores = valoresDe(datos);
  const l = leerDatosCambio(datos);
  if ("error" in l) return { error: l.error, valores };
  const { error } = await supabase.rpc("cambio_actualizar", { p_cambio: cambioId, p_datos: l.datos });
  if (error) return { error: mensaje(error), valores };
  revalidatePath(`/proyectos/${proyectoId}`, "layout");
  redirect(`/proyectos/${proyectoId}/cambios/${cambioId}?ok=guardado`);
}

// Acciones de flujo: reciben una nota opcional y redirigen al detalle con el resultado.
async function flujo(proyectoId: string, cambioId: string, llamada: (s: Awaited<ReturnType<typeof cargarProyecto>>["supabase"]) => PromiseLike<{ error: { code?: string; message: string } | null }>) {
  if (!ES_UUID.test(cambioId)) redirect(`/proyectos/${proyectoId}/cambios`);
  const { supabase } = await cargarProyecto(proyectoId);
  const { error } = await llamada(supabase);
  revalidatePath(`/proyectos/${proyectoId}`, "layout");
  const base = `/proyectos/${proyectoId}/cambios/${cambioId}`;
  redirect(error ? `${base}?error=${encodeURIComponent(mensaje(error))}` : `${base}?ok=guardado`);
}

const nota = (d: FormData) => String(d.get("nota") ?? "").trim() || null;

export async function avanzarCambio(proyectoId: string, cambioId: string, datos: FormData): Promise<void> {
  await flujo(proyectoId, cambioId, (s) => s.rpc("cambio_avanzar", { p_cambio: cambioId, p_nota: nota(datos) }));
}
export async function devolverCambio(proyectoId: string, cambioId: string, datos: FormData): Promise<void> {
  await flujo(proyectoId, cambioId, (s) => s.rpc("cambio_devolver", { p_cambio: cambioId, p_nota: nota(datos) }));
}
export async function firmarCambio(proyectoId: string, cambioId: string): Promise<void> {
  await flujo(proyectoId, cambioId, (s) => s.rpc("cambio_firmar_patrocinador", { p_cambio: cambioId }));
}
export async function decidirCambio(proyectoId: string, cambioId: string, decision: "aprobar" | "rechazar", datos: FormData): Promise<void> {
  await flujo(proyectoId, cambioId, (s) => s.rpc("cambio_decidir", { p_cambio: cambioId, p_decision: decision, p_nota: nota(datos) }));
}
