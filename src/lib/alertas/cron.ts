// Pasos comunes de las tareas programadas (cron de Vercel): comprobar la clave, el proveedor de correo y entrar con el
// usuario de lectura (rol Analista PMO). Nunca se usa la clave secreta de Supabase: solo se ve lo que ese rol puede ver.
import { connection } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { datosConexion } from "@/lib/supabase/env";
import { proveedorConfigurado, type Proveedor } from "./correo";

export const json = (cuerpo: object, status = 200) => Response.json(cuerpo, { status, headers: { "Cache-Control": "no-store" } });

export type TareaLista = { supabase: SupabaseClient; proveedor: Proveedor; usuarioAlertas: string };

export async function iniciarTarea(req: Request): Promise<{ respuesta: Response } | TareaLista> {
  await connection();
  const secreto = (process.env.CRON_SECRET ?? "").trim();
  if (!secreto) return { respuesta: json({ error: "CRON_SECRET no está configurado." }, 503) };
  if (req.headers.get("authorization") !== `Bearer ${secreto}`) return { respuesta: json({ error: "No autorizado." }, 401) };

  const proveedor = proveedorConfigurado();
  if (!proveedor) return { respuesta: json({ omitido: "No hay proveedor de correo configurado." }) };
  const usuarioAlertas = (process.env.ALERTAS_USUARIO ?? "").trim();
  const clave = (process.env.ALERTAS_CLAVE ?? "").trim();
  if (!usuarioAlertas || !clave) return { respuesta: json({ omitido: "Faltan ALERTAS_USUARIO y ALERTAS_CLAVE (usuario de lectura con rol Analista PMO)." }) };

  const { url, clave: anon } = datosConexion();
  const supabase = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await supabase.auth.signInWithPassword({ email: usuarioAlertas, password: clave });
  if (error) {
    console.error("Tarea programada: no se pudo iniciar sesión con el usuario de alertas:", error.message);
    return { respuesta: json({ error: "No se pudo iniciar sesión con el usuario de alertas." }, 502) };
  }
  return { supabase, proveedor, usuarioAlertas };
}
