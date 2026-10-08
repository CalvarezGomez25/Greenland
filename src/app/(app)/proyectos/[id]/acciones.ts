"use server";

import { revalidatePath } from "next/cache";
import { exigirAdministrador } from "@/lib/sesion";
import { ES_UUID } from "@/lib/formato";
import { ROLES_PROYECTO, type RolProyecto } from "@/lib/tipos";

export type EstadoMiembro = { error?: string; ok?: string };

function rolValido(valor: FormDataEntryValue | null): RolProyecto | null {
  const r = String(valor ?? "");
  return (ROLES_PROYECTO as string[]).includes(r) ? (r as RolProyecto) : null;
}

// Las tres acciones: solo el administrador (y la base de datos lo reverifica).

export async function asignarMiembro(
  proyectoId: string,
  _anterior: EstadoMiembro,
  datos: FormData,
): Promise<EstadoMiembro> {
  const { supabase } = await exigirAdministrador();
  const usuarioId = String(datos.get("usuario_id") ?? "");
  const rol = rolValido(datos.get("rol"));

  if (!ES_UUID.test(proyectoId) || !ES_UUID.test(usuarioId)) {
    return { error: "Elige una persona de la lista." };
  }
  if (!rol) return { error: "Elige un rol." };

  const { error } = await supabase
    .from("miembros_proyecto")
    .insert({ proyecto_id: proyectoId, usuario_id: usuarioId, rol });

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Esa persona ya está asignada a este proyecto."
          : "No se pudo asignar a la persona. Intenta de nuevo.",
    };
  }

  revalidatePath(`/proyectos/${proyectoId}`);
  return { ok: "Persona asignada." };
}

export async function cambiarRol(proyectoId: string, usuarioId: string, datos: FormData) {
  const { supabase } = await exigirAdministrador();
  const rol = rolValido(datos.get("rol"));
  if (!ES_UUID.test(proyectoId) || !ES_UUID.test(usuarioId) || !rol) {
    throw new Error("Datos no válidos");
  }

  const { error } = await supabase
    .from("miembros_proyecto")
    .update({ rol })
    .eq("proyecto_id", proyectoId)
    .eq("usuario_id", usuarioId);
  if (error) throw new Error("No se pudo cambiar el rol");

  revalidatePath(`/proyectos/${proyectoId}`);
}

export async function quitarMiembro(proyectoId: string, usuarioId: string) {
  const { supabase } = await exigirAdministrador();
  if (!ES_UUID.test(proyectoId) || !ES_UUID.test(usuarioId)) {
    throw new Error("Datos no válidos");
  }

  const { error } = await supabase
    .from("miembros_proyecto")
    .delete()
    .eq("proyecto_id", proyectoId)
    .eq("usuario_id", usuarioId);
  if (error) throw new Error("No se pudo quitar a la persona");

  revalidatePath(`/proyectos/${proyectoId}`);
}
