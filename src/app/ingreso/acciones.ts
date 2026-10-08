"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export type EstadoIngreso = { error?: string };

export async function ingresar(
  _anterior: EstadoIngreso,
  datos: FormData,
): Promise<EstadoIngreso> {
  const correo = String(datos.get("correo") ?? "").trim();
  const clave = String(datos.get("clave") ?? "");
  if (!correo || !clave) return { error: "Escribe tu correo y tu contraseña." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({
    email: correo,
    password: clave,
  });

  if (error) {
    // Mensaje único para no revelar si el correo existe o no.
    if (error.name === "AuthRetryableFetchError") {
      return { error: "No fue posible conectar con el servidor. Intenta de nuevo." };
    }
    return { error: "Correo o contraseña incorrectos." };
  }

  redirect("/");
}
