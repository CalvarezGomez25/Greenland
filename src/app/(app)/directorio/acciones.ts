"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";
import { ES_UUID } from "@/lib/formato";
import { validarCorreo, validarTelefono } from "@/lib/contactos";
import { mensajeDeBase } from "@/lib/registros/errores";
import type { Estado } from "@/lib/presupuesto/estado";

const texto = (d: FormData, k: string) => String(d.get(k) ?? "").trim();
const valoresDe = (d: FormData) => Object.fromEntries([...d.entries()].filter(([k, x]) => typeof x === "string" && !k.startsWith("$"))) as Record<string, string>;

export async function guardarContacto(id: string | null, _anterior: Estado, datos: FormData): Promise<Estado> {
  if (id && !ES_UUID.test(id)) return { error: "Dirección no válida." };
  const { supabase } = await obtenerSesion();
  const nombre = texto(datos, "nombre"), rol = texto(datos, "rol"), correo = texto(datos, "correo"), telefono = texto(datos, "telefono");
  const falla = (error: string): Estado => ({ error, valores: valoresDe(datos) });
  if (!nombre) return falla("El nombre es obligatorio.");
  if (nombre.length > 200 || rol.length > 200) return falla("El nombre y el rol no pueden superar 200 caracteres.");
  const malo = validarCorreo(correo) ?? validarTelefono(telefono);
  if (malo) return falla(malo);

  const fila = { nombre, rol: rol || null, correo: correo || null, telefono: telefono || null };
  const consulta = id
    ? supabase.from("contactos").update(fila).eq("id", id).select("id")
    : supabase.from("contactos").insert(fila).select("id");
  const { data, error } = await consulta;
  if (error) {
    if (error.code === "23505") return falla("Ya existe un contacto con ese correo (o con ese nombre, si no tiene correo).");
    return falla(mensajeDeBase(error));
  }
  if (id && (!data || data.length === 0)) return falla("No se encontró el contacto o no tienes permiso.");
  revalidatePath("/directorio");
  redirect("/directorio?ok=contacto");
}

export async function borrarContacto(id: string): Promise<void> {
  if (!ES_UUID.test(id)) redirect("/directorio");
  const { supabase } = await obtenerSesion();
  // Solo el administrador borra; para los demás, la base de datos no borra nada y no devuelve filas.
  const { data, error } = await supabase.from("contactos").delete().eq("id", id).select("id");
  if (error || !data || data.length === 0) redirect("/directorio?ok=no_borrado");
  revalidatePath("/directorio");
  redirect("/directorio?ok=contacto_borrado");
}
