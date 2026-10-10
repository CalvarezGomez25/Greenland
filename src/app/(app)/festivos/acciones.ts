"use server";

import { revalidatePath } from "next/cache";
import { exigirAdministrador } from "@/lib/sesion";
import { esFechaValida } from "@/lib/registros/leer";
import type { Estado } from "@/lib/presupuesto/estado";

export async function agregarFestivo(_p: Estado, d: FormData): Promise<Estado> {
  const { supabase } = await exigirAdministrador();
  const fecha = String(d.get("fecha") ?? ""), nombre = String(d.get("nombre") ?? "").trim();
  if (!esFechaValida(fecha)) return { error: "Indica una fecha válida.", valores: { nombre } };
  const { error } = await supabase.rpc("festivo_guardar", { p_fecha: fecha, p_nombre: nombre, p_quitar: false });
  if (error) return { error: error.code === "22023" || error.code === "42501" ? error.message : "No se pudo guardar el festivo.", valores: { fecha, nombre } };
  revalidatePath("/festivos");
  return { valores: { listo: crypto.randomUUID() } };
}

export async function quitarFestivo(fecha: string): Promise<void> {
  const { supabase } = await exigirAdministrador();
  if (!esFechaValida(fecha)) return;
  await supabase.rpc("festivo_guardar", { p_fecha: fecha, p_nombre: null, p_quitar: true });
  revalidatePath("/festivos");
}
