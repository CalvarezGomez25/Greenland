// Listas para los selectores del formulario de adicionales: elementos de la EDT y cambios del proyecto.
import type { SupabaseClient } from "@supabase/supabase-js";

export async function cargarOpcionesAdicional(supabase: SupabaseClient, proyectoId: string) {
  const [{ data: edt }, { data: cambios }] = await Promise.all([
    supabase.from("wbs_elementos").select("id, codigo, nombre").eq("proyecto_id", proyectoId).order("codigo"),
    supabase.from("cambios").select("id, codigo, descripcion_despues, estado_flujo").eq("proyecto_id", proyectoId).order("codigo"),
  ]);
  return {
    elementos: ((edt ?? []) as { id: string; codigo: string; nombre: string }[]).map((e) => ({ id: e.id, etiqueta: `${e.codigo} ${e.nombre}` })),
    cambios: ((cambios ?? []) as { id: string; codigo: string; descripcion_despues: string | null; estado_flujo: string }[]).map((c) => ({
      id: c.id, etiqueta: `${c.codigo} · ${(c.descripcion_despues ?? "").slice(0, 50)}`,
    })),
  };
}
