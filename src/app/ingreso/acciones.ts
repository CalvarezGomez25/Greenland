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

  if (error) return { error: mensajeDeError(error) };

  redirect("/");
}

// Traduce el error de Supabase a un mensaje útil sin revelar si un correo existe:
// "correo no confirmado" solo lo informa Supabase después de validar la contraseña.
function mensajeDeError(error: {
  name: string;
  code?: string;
  status?: number;
  message: string;
}): string {
  if (error.name === "AuthRetryableFetchError") {
    return "No fue posible conectar con el servidor. Intenta de nuevo.";
  }
  if (error.code === "invalid_credentials" || error.message === "Invalid login credentials") {
    return "Correo o contraseña incorrectos.";
  }
  if (error.code === "email_not_confirmed") {
    return "Tu correo aún no está confirmado. Pide al administrador que confirme tu usuario.";
  }
  if (error.code === "over_request_rate_limit") {
    return "Demasiados intentos. Espera unos minutos e intenta de nuevo.";
  }
  if (error.code === "user_banned") {
    return "Tu usuario está desactivado. Contacta al administrador.";
  }

  // Cualquier otra cosa es un problema de configuración o del servidor (clave
  // inválida, proveedor de correo desactivado, caída...). Se deja constancia en
  // los registros de Vercel, sin datos personales ni contraseñas.
  console.error("Fallo de ingreso:", {
    nombre: error.name,
    codigo: error.code,
    estado: error.status,
    mensaje: error.message,
  });
  return "No se pudo iniciar sesión por un problema del servidor o de configuración. Avisa al administrador.";
}
