"use server";

import { revalidatePath } from "next/cache";
import { exigirAdministrador } from "@/lib/sesion";
import { ES_UUID } from "@/lib/formato";
import type { Estado } from "@/lib/presupuesto/estado";

function mensaje(e: { code?: string; message: string }) {
  if (e.code === "42501" || e.code === "22023") return e.message;
  console.error("Fallo con parámetros:", e.code, e.message);
  return "No se pudo guardar el parámetro. Intenta de nuevo.";
}

export async function guardarParametro(_prev: Estado, datos: FormData): Promise<Estado> {
  const { supabase } = await exigirAdministrador();
  const ambito = String(datos.get("ambito") ?? "global");
  const destino = String(datos.get("destino") ?? "");
  const clave = String(datos.get("clave") ?? "");
  const valor = String(datos.get("valor") ?? "");
  if (ambito !== "global" && !ES_UUID.test(destino)) return { error: "Elige el portafolio o el proyecto al que aplica el ajuste.", valores: { clave, valor } };
  const { error } = await supabase.rpc("parametro_guardar", {
    p_ambito: ambito,
    p_ambito_id: ambito === "global" ? null : destino,
    p_clave: clave,
    p_valor: valor,
  });
  if (error) return { error: mensaje(error), valores: { clave, valor, ambito, destino } };
  revalidatePath("/parametros");
  return { valores: { guardado: clave } };
}

export async function quitarAjuste(id: string): Promise<void> {
  const { supabase } = await exigirAdministrador();
  if (!ES_UUID.test(id)) return;
  await supabase.rpc("parametro_quitar_ajuste", { p_id: id });
  revalidatePath("/parametros");
}
