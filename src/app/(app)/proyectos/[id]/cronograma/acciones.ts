"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { ES_UUID } from "@/lib/formato";
import { refrescarMedicion } from "@/lib/obra/refrescar";
import { leerDecimalSimple } from "@/lib/registros/leer";

async function terminar(proyectoId: string, ok: string, error?: string): Promise<never> {
  revalidatePath(`/proyectos/${proyectoId}`, "layout");
  redirect(`/proyectos/${proyectoId}/cronograma?${error ? `error=${encodeURIComponent(error)}` : `ok=${ok}`}`);
}

function mensaje(e: { code?: string; message: string }) {
  if (e.code === "42501" || e.code === "22023") return e.message;
  console.error("Fallo en el cronograma:", e.code, e.message);
  return `No se pudo completar la operación${e.code ? ` (código ${e.code})` : ""}.`;
}

export async function guardarAvance(proyectoId: string, tareaId: string, datos: FormData): Promise<void> {
  if (!ES_UUID.test(tareaId)) return terminar(proyectoId, "avance", "Tarea no válida.");
  const { supabase } = await cargarProyecto(proyectoId);
  const n = leerDecimalSimple(String(datos.get("avance") ?? ""), 2);
  if (n === null || n < 0 || n > 100) return terminar(proyectoId, "avance", "El avance debe ser un número entre 0 y 100.");
  const { error } = await supabase.rpc("tarea_avance_guardar", { p_tarea: tareaId, p_avance: n });
  if (error) return terminar(proyectoId, "avance", mensaje(error));
  await refrescarMedicion(supabase, proyectoId);
  return terminar(proyectoId, "avance");
}

export async function verificarAvance(proyectoId: string, tareaId: string, datos: FormData): Promise<void> {
  if (!ES_UUID.test(tareaId)) return terminar(proyectoId, "avance", "Tarea no válida.");
  const { supabase } = await cargarProyecto(proyectoId);
  const n = leerDecimalSimple(String(datos.get("verificado") ?? ""), 2);
  if (n === null || n < 0 || n > 100) return terminar(proyectoId, "avance", "El avance verificado debe ser un número entre 0 y 100.");
  const { error } = await supabase.rpc("tarea_verificar", { p_tarea: tareaId, p_pct: n, p_nota: String(datos.get("nota") ?? "") });
  if (error) return terminar(proyectoId, "avance", mensaje(error));
  await refrescarMedicion(supabase, proyectoId);
  return terminar(proyectoId, "avance");
}

// Arrastrar o redimensionar una barra del Gantt (solo gerente o administrador; la base de datos lo verifica).
export async function moverTarea(proyectoId: string, tareaId: string, inicio: number, duracion: number): Promise<{ error?: string }> {
  if (!ES_UUID.test(tareaId) || !Number.isInteger(inicio) || !Number.isInteger(duracion) || inicio < 1 || duracion < 1 || inicio > 1000 || duracion > 1000) {
    return { error: "Valores no válidos." };
  }
  const { supabase, permisos } = await cargarProyecto(proyectoId);
  if (!permisos.gestionar) return { error: "No tienes permiso para mover tareas." };
  const { data, error } = await supabase.from("tareas").update({ semana_inicio: inicio, duracion_semanas: duracion }).eq("id", tareaId).eq("proyecto_id", proyectoId).select("id");
  if (error) return { error: mensaje(error) };
  if (!data || data.length === 0) return { error: "No se encontró la tarea." };
  await refrescarMedicion(supabase, proyectoId);
  revalidatePath(`/proyectos/${proyectoId}`, "layout");
  return {};
}
