"use server";

import { redirect } from "next/navigation";
import { exigirAdministrador } from "@/lib/sesion";
import { validarFicha, validarProyecto } from "@/lib/proyecto-validar";

export type EstadoProyecto = { error?: string };

export async function crearProyecto(
  _anterior: EstadoProyecto,
  datos: FormData,
): Promise<EstadoProyecto> {
  // Solo el administrador; además la base de datos lo vuelve a verificar.
  const { supabase } = await exigirAdministrador();

  const v = validarProyecto(datos);
  if ("error" in v) return { error: v.error };

  const f = validarFicha(datos);
  if ("error" in f) return { error: f.error };

  const { data, error } = await supabase
    .from("proyectos")
    .insert({
      ...v.datos,
      tipo: f.ficha.tipo,
      fase: f.ficha.fase,
      estado: f.ficha.estado,
      usa_obra: f.ficha.usa_obra,
      codigo: f.ficha.codigo,
      organizacion_id: f.ficha.organizacion_id,
      portafolio_id: f.ficha.portafolio_id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      error:
        error?.code === "42501"
          ? "No tienes permiso para crear proyectos."
          : error?.code === "23505"
            ? "Ya existe un proyecto con ese código."
            : "No se pudo crear el proyecto. Intenta de nuevo.",
    };
  }

  redirect(`/proyectos/${data.id}`);
}
