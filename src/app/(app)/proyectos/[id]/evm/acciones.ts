"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { ES_UUID } from "@/lib/formato";
import { leerNumeroColombiano } from "@/lib/presupuesto/csv";
import { esFechaValida } from "@/lib/registros/leer";
import type { Estado } from "@/lib/presupuesto/estado";
import { refrescarMedicion } from "@/lib/obra/refrescar";
import { hoyColombia } from "@/lib/pmo/cargar";

export async function guardarMedicion(proyectoId: string, _prev: Estado, datos: FormData): Promise<Estado> {
  const { supabase, permisos } = await cargarProyecto(proyectoId);
  const valores: Record<string, string> = {};
  for (const [k, v] of datos.entries()) if (typeof v === "string" && !k.startsWith("$")) valores[k] = v;
  if (!permisos.reportar) return { error: "No tienes permiso para registrar mediciones.", valores };

  const fecha = String(datos.get("fecha_corte") ?? "");
  if (!esFechaValida(fecha)) return { error: "Indica una fecha de corte válida.", valores };
  const num: Record<string, string> = {};
  for (const [k, t] of [["bac", "El BAC"], ["pv", "El PV"], ["ev", "El EV"], ["ac", "El AC"]] as const) {
    const r = leerNumeroColombiano(String(datos.get(k) ?? ""), 2, 13);
    if (!r.ok) return { error: `${t} ${r.motivo}.`, valores };
    num[k] = r.valor;
  }
  const { error } = await supabase.rpc("medicion_guardar", { p_proyecto: proyectoId, p_fecha: fecha, p_bac: num.bac, p_pv: num.pv, p_ev: num.ev, p_ac: num.ac });
  if (error) {
    if (error.code === "42501" || error.code === "22023") return { error: error.message, valores };
    console.error("Fallo al guardar la medición:", error.code, error.message);
    return { error: `No se pudo guardar la medición${error.code ? ` (código ${error.code})` : ""}.`, valores };
  }
  revalidatePath("/", "layout");
  redirect(`/proyectos/${proyectoId}/evm?ok=guardado`);
}

export async function borrarMedicion(proyectoId: string, id: string): Promise<void> {
  if (!ES_UUID.test(id)) return;
  const { supabase } = await cargarProyecto(proyectoId);
  const { error } = await supabase.rpc("medicion_borrar", { p_id: id });
  if (error) console.error("Fallo al borrar la medición:", error.code, error.message);
  revalidatePath("/", "layout");
  redirect(`/proyectos/${proyectoId}/evm?ok=${error ? "no_borrado" : "eliminado"}`);
}

// Calcula el valor ganado de hoy desde la línea base, el cronograma y el gasto (todo en la base de datos).
export async function calcularAhora(proyectoId: string): Promise<void> {
  const { supabase, permisos } = await cargarProyecto(proyectoId);
  if (!permisos.reportar) redirect(`/proyectos/${proyectoId}/evm`);
  await refrescarMedicion(supabase, proyectoId);
  // Se comprueba que realmente exista la medición calculada de hoy (si no hay línea base o cronograma, no se crea).
  const hoy = await supabase.from("mediciones_evm").select("id", { count: "exact", head: true }).eq("proyecto_id", proyectoId).eq("origen", "calculado").eq("fecha_corte", hoyColombia());
  revalidatePath("/", "layout");
  redirect(`/proyectos/${proyectoId}/evm?ok=${(hoy.count ?? 0) >= 1 ? "calculada" : "calculada_no"}`);
}
