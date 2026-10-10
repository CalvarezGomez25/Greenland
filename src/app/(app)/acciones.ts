"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export async function salir() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/ingreso");
}

// Cambiar de usuario: se cierra la sesión actual y se vuelve a la pantalla de ingreso para entrar con otra cuenta
// (la persona debe conocer el correo y la contraseña de la otra cuenta).
export async function cambiarUsuario() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/ingreso?cambio=1");
}
