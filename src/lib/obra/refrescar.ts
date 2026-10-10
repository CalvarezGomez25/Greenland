// Mantiene al día la medición de valor ganado "calculada" de hoy cuando cambia algo que la afecta
// (avance de tareas, gasto, cronograma). Si faltan la línea base o el cronograma, no hace nada.
import type { SupabaseClient } from "@supabase/supabase-js";
import { hoyColombia } from "../pmo/cargar";

export async function refrescarMedicion(supabase: SupabaseClient, proyectoId: string): Promise<void> {
  const { error } = await supabase.rpc("medicion_calcular", { p_proyecto: proyectoId, p_fecha: hoyColombia() });
  if (error) console.error("No se pudo refrescar el valor ganado calculado:", error.code, error.message);
}
