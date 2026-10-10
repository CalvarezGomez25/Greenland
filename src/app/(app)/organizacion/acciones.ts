"use server";

import { revalidatePath } from "next/cache";
import { exigirAdministrador } from "@/lib/sesion";
import { ES_UUID } from "@/lib/formato";
import type { Estado } from "@/lib/presupuesto/estado";

export async function crearOrganizacion(_p: Estado, datos: FormData): Promise<Estado> {
  const { supabase } = await exigirAdministrador();
  const nombre = String(datos.get("nombre") ?? "").trim();
  const tipo = String(datos.get("tipo") ?? "empresa");
  if (!nombre || nombre.length > 120) return { error: "El nombre es obligatorio (máximo 120 caracteres).", valores: { nombre } };
  const { error } = await supabase.from("organizaciones").insert({ nombre, tipo });
  if (error) return { error: error.code === "23514" ? "Tipo no válido." : "No se pudo crear la organización.", valores: { nombre } };
  revalidatePath("/organizacion");
  return { valores: { listo: crypto.randomUUID() } };
}

export async function crearPortafolio(_p: Estado, datos: FormData): Promise<Estado> {
  const { supabase } = await exigirAdministrador();
  const nombre = String(datos.get("nombre") ?? "").trim();
  const org = String(datos.get("organizacion") ?? "");
  if (!nombre || nombre.length > 120) return { error: "El nombre es obligatorio (máximo 120 caracteres).", valores: { nombre } };
  if (!ES_UUID.test(org)) return { error: "Elige la organización.", valores: { nombre } };
  const { error } = await supabase.from("portafolios").insert({ nombre, organizacion_id: org });
  if (error) return { error: "No se pudo crear el portafolio.", valores: { nombre } };
  revalidatePath("/organizacion");
  return { valores: { listo: crypto.randomUUID() } };
}
