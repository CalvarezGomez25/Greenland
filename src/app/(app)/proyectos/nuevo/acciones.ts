"use server";

import { redirect } from "next/navigation";
import { exigirAdministrador } from "@/lib/sesion";
import { validarProyecto } from "@/lib/proyecto-validar";

export type EstadoProyecto = { error?: string };

export async function crearProyecto(
  _anterior: EstadoProyecto,
  datos: FormData,
): Promise<EstadoProyecto> {
  // Solo el administrador; además la base de datos lo vuelve a verificar.
  const { supabase } = await exigirAdministrador();

  const v = validarProyecto(datos);
  if ("error" in v) return { error: v.error };

  const { data, error } = await supabase
    .from("proyectos")
    .insert(v.datos)
    .select("id")
    .single();

  if (error || !data) {
    return {
      error:
        error?.code === "42501"
          ? "No tienes permiso para crear proyectos."
          : "No se pudo crear el proyecto. Intenta de nuevo.",
    };
  }

  redirect(`/proyectos/${data.id}`);
}
