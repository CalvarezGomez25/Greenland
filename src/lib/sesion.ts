import { cache } from "react";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { Perfil } from "@/lib/tipos";

// Devuelve el usuario con sesión y su perfil. Si no hay sesión, manda a /ingreso.
// "cache" evita repetir la consulta dentro de una misma visita.
export const obtenerSesion = cache(async () => {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingreso");

  const { data } = await supabase
    .from("perfiles")
    .select("id, nombre, correo, rol_global")
    .eq("id", user.id)
    .maybeSingle();

  return { supabase, perfil: (data as Perfil | null) ?? null };
});

// Para pantallas y acciones que solo puede usar el administrador.
export async function exigirAdministrador() {
  const sesion = await obtenerSesion();
  if (sesion.perfil?.rol_global !== "administrador") redirect("/");
  return sesion;
}
