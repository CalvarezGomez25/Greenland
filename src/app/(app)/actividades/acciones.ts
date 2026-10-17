"use server";

import { revalidatePath } from "next/cache";
import { obtenerSesion } from "@/lib/sesion";
import { ES_UUID } from "@/lib/formato";
import { esEstadoActividad } from "@/lib/actividades";

export type ResultadoMover = { ok: true } | { ok: false; error: string };

// Mueve una actividad a otro estado (al arrastrarla en el tablero o con «Mover a»). Lo puede hacer quien la gestiona
// o la persona responsable; la base de datos impone la regla y, si no hay permiso, no actualiza ninguna fila.
export async function moverActividad(proyectoId: string, id: string, estado: string): Promise<ResultadoMover> {
  if (!ES_UUID.test(proyectoId) || !ES_UUID.test(id) || !esEstadoActividad(estado)) return { ok: false, error: "Dirección no válida." };
  const { supabase } = await obtenerSesion();
  const { data, error } = await supabase.from("actividades").update({ estado }).eq("id", id).eq("proyecto_id", proyectoId).select("id");
  if (error || !data || data.length === 0) {
    if (error) console.error("Fallo al cambiar el estado de una actividad:", { codigo: error.code, mensaje: error.message });
    return { ok: false, error: "No se pudo mover la actividad: ya no existe o no tienes permiso para moverla." };
  }
  revalidatePath("/mi-trabajo");
  revalidatePath(`/proyectos/${proyectoId}/actividades`);
  return { ok: true };
}
