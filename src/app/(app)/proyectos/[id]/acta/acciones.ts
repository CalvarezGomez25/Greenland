"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { leerNumeroColombiano } from "@/lib/presupuesto/csv";
import type { Estado } from "@/lib/presupuesto/estado";

const TEXTOS = ["proposito", "objetivo_smart", "beneficios", "alcance_incluido", "alcance_excluido", "supuestos", "restricciones", "fuente_financiamiento", "contratistas_externos"];

export async function guardarActa(proyectoId: string, _prev: Estado, datos: FormData): Promise<Estado> {
  const { supabase, permisos } = await cargarProyecto(proyectoId);
  const valores: Record<string, string> = {};
  for (const [k, v] of datos.entries()) if (typeof v === "string" && !k.startsWith("$")) valores[k] = v;
  if (!permisos.gestionar) return { error: "No tienes permiso para editar el acta.", valores };

  const datosRpc: Record<string, string | null> = {};
  for (const c of TEXTOS) datosRpc[c] = String(datos.get(c) ?? "");
  const pres = String(datos.get("presupuesto_estimado") ?? "").trim();
  if (pres) {
    const n = leerNumeroColombiano(pres, 2, 13);
    if (!n.ok) return { error: `El presupuesto estimado ${n.motivo}.`, valores };
    datosRpc.presupuesto_estimado = n.valor;
  } else datosRpc.presupuesto_estimado = null;
  const eq = String(datos.get("equipo_n") ?? "").trim();
  if (eq && !/^\d{1,4}$/.test(eq)) return { error: "El tamaño del equipo debe ser un número entero.", valores };
  datosRpc.equipo_n = eq || null;

  const { error } = await supabase.rpc("acta_guardar", { p_proyecto: proyectoId, p_datos: datosRpc });
  if (error) {
    if (error.code === "42501" || error.code === "22023") return { error: error.message, valores };
    console.error("Fallo al guardar el acta:", error.code, error.message);
    return { error: `No se pudo guardar el acta${error.code ? ` (código ${error.code})` : ""}.`, valores };
  }
  revalidatePath(`/proyectos/${proyectoId}`, "layout");
  redirect(`/proyectos/${proyectoId}/acta?ok=guardado`);
}

export async function firmarActa(proyectoId: string, como: "gerente" | "patrocinador"): Promise<void> {
  const { supabase } = await cargarProyecto(proyectoId);
  const { error } = await supabase.rpc("acta_firmar", { p_proyecto: proyectoId, p_como: como });
  if (error) console.error("Fallo al firmar el acta:", error.code, error.message);
  revalidatePath(`/proyectos/${proyectoId}`, "layout");
  redirect(`/proyectos/${proyectoId}/acta?ok=${error ? "firma_no" : "firma"}`);
}
