"use server";

import { revalidatePath } from "next/cache";
import { exigirAdministrador } from "@/lib/sesion";
import { ES_UUID } from "@/lib/formato";
import { ROLES_GLOBALES } from "@/lib/tipos";

export async function asignarRolGlobal(usuarioId: string, datos: FormData): Promise<void> {
  const { supabase } = await exigirAdministrador();
  const rol = String(datos.get("rol") ?? "");
  if (!ES_UUID.test(usuarioId)) return;
  if (rol !== "" && !(ROLES_GLOBALES as string[]).includes(rol)) return;
  const { error } = await supabase.rpc("perfil_asignar_rol_global", { p_usuario: usuarioId, p_rol: rol === "" ? null : rol });
  if (error) console.error("Fallo al asignar rol global:", error.code, error.message);
  revalidatePath("/usuarios");
}
