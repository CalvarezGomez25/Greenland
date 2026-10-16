"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";
import { ES_UUID } from "@/lib/formato";
import { esEstadoActividad } from "@/lib/actividades";

// Mueve una actividad a otro estado. Lo puede hacer quien la gestiona o la persona responsable;
// la base de datos impone la regla y, si no hay permiso, no actualiza ninguna fila.
export async function cambiarEstadoActividad(datos: FormData): Promise<void> {
  const proyectoId = String(datos.get("proyecto_id") ?? "");
  const id = String(datos.get("id") ?? "");
  const estado = String(datos.get("estado") ?? "");
  if (!ES_UUID.test(proyectoId) || !ES_UUID.test(id) || !esEstadoActividad(estado)) redirect("/");
  const volver = datos.get("desde") === "mi-trabajo" ? "/mi-trabajo" : `/proyectos/${proyectoId}/actividades`;

  const { supabase } = await obtenerSesion();
  const { data, error } = await supabase.from("actividades").update({ estado }).eq("id", id).eq("proyecto_id", proyectoId).select("id");
  if (error || !data || data.length === 0) {
    if (error) console.error("Fallo al cambiar el estado de una actividad:", { codigo: error.code, mensaje: error.message });
    redirect(`${volver}?ok=actividad_no`);
  }
  revalidatePath("/mi-trabajo");
  revalidatePath(`/proyectos/${proyectoId}/actividades`);
}
