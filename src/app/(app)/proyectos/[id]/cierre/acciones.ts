"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { esFechaValida } from "@/lib/registros/leer";
import type { Estado } from "@/lib/presupuesto/estado";

export async function cerrarProyecto(proyectoId: string, _prev: Estado, datos: FormData): Promise<Estado> {
  const { supabase, permisos } = await cargarProyecto(proyectoId);
  const valores: Record<string, string> = {};
  for (const [k, v] of datos.entries()) if (typeof v === "string" && !k.startsWith("$")) valores[k] = v;
  if (!permisos.gestionar) return { error: "No tienes permiso para cerrar este proyecto.", valores };
  const fecha = String(datos.get("fecha_entrega") ?? "");
  if (!esFechaValida(fecha)) return { error: "Indica la fecha de entrega.", valores };
  const { error } = await supabase.rpc("proyecto_cerrar", { p_proyecto: proyectoId, p_fecha: fecha, p_receptor: String(datos.get("receptor") ?? ""), p_observaciones: String(datos.get("observaciones") ?? "") });
  if (error) {
    if (error.code === "42501" || error.code === "22023") return { error: error.message, valores };
    console.error("Fallo al cerrar el proyecto:", error.code, error.message);
    return { error: `No se pudo cerrar el proyecto${error.code ? ` (código ${error.code})` : ""}.`, valores };
  }
  revalidatePath("/", "layout");
  redirect(`/proyectos/${proyectoId}/cierre?ok=cerrado`);
}

export async function reabrirProyecto(proyectoId: string): Promise<void> {
  const { supabase } = await cargarProyecto(proyectoId);
  const { error } = await supabase.rpc("proyecto_reabrir", { p_proyecto: proyectoId });
  if (error) console.error("Fallo al reabrir el proyecto:", error.code, error.message);
  revalidatePath("/", "layout");
  redirect(`/proyectos/${proyectoId}/cierre?${error ? "ok=no_reabierto" : "ok=reabierto"}`);
}
