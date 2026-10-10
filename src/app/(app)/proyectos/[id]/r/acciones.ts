"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { ES_UUID } from "@/lib/formato";
import { obtenerDefinicion } from "@/lib/registros/definiciones";
import { leerCampos } from "@/lib/registros/leer";
import type { Estado } from "@/lib/presupuesto/estado";

export function mensajeDeBase(error: { code?: string; message: string }): string {
  if (error.code === "42501") return "No tienes permiso para hacer esto.";
  if (error.code === "22023") return error.message;
  if (error.code === "23514") return "Algún valor no es válido. Revisa los datos.";
  if (error.code === "23505") return "Ya existe un registro con ese código o nombre.";
  if (error.code === "23503") return "Hay un dato relacionado que no existe o que impide la operación.";
  if (error.code === "PGRST205" || error.code === "42P01") return "Falta instalar la base de datos de este módulo. Avisa al administrador.";
  console.error("Fallo en un registro:", { codigo: error.code, mensaje: error.message });
  return `No se pudo guardar${error.code ? ` (código ${error.code})` : ""}. Intenta de nuevo.`;
}

function valoresDe(datos: FormData): Record<string, string> {
  const v: Record<string, string> = {};
  for (const [k, x] of datos.entries()) if (typeof x === "string" && !k.startsWith("$")) v[k] = x;
  return v;
}

export async function guardarRegistro(
  modulo: string,
  proyectoId: string,
  registroId: string | null,
  _anterior: Estado,
  datos: FormData,
): Promise<Estado> {
  const def = obtenerDefinicion(modulo);
  if (!def || !ES_UUID.test(proyectoId) || (registroId && !ES_UUID.test(registroId))) return { error: "Dirección no válida." };
  const { supabase, permisos } = await cargarProyecto(proyectoId);
  if (!def.escribir(permisos)) return { error: "No tienes permiso para modificar este módulo.", valores: valoresDe(datos) };

  const opciones = def.opciones ? await def.opciones(supabase, proyectoId) : {};
  const { valores, error } = leerCampos(def.campos, datos, opciones, { creando: !registroId });
  if (error) return { error, valores: valoresDe(datos) };
  if (def.validar) {
    const motivo = await def.validar(valores, { supabase, proyectoId, registroId });
    if (motivo) return { error: motivo, valores: valoresDe(datos) };
  }

  const consulta = registroId
    ? supabase.from(def.tabla).update(valores).eq("id", registroId).eq("proyecto_id", proyectoId).select("id")
    : supabase.from(def.tabla).insert({ ...valores, proyecto_id: proyectoId }).select("id");
  const { data, error: errBase } = await consulta;
  if (errBase) return { error: mensajeDeBase(errBase), valores: valoresDe(datos) };
  if (registroId && (!data || data.length === 0)) return { error: "No se encontró el registro o no tienes permiso.", valores: valoresDe(datos) };

  revalidatePath(`/proyectos/${proyectoId}`, "layout");
  redirect(`/proyectos/${proyectoId}/r/${modulo}?ok=guardado`);
}

export async function borrarRegistro(modulo: string, proyectoId: string, registroId: string): Promise<void> {
  const def = obtenerDefinicion(modulo);
  if (!def?.borrar || !ES_UUID.test(proyectoId) || !ES_UUID.test(registroId)) redirect(`/proyectos/${proyectoId}`);
  const { supabase, permisos } = await cargarProyecto(proyectoId);
  if (!def.escribir(permisos)) redirect(`/proyectos/${proyectoId}/r/${modulo}`);
  const { error } = await supabase.from(def.tabla).delete().eq("id", registroId).eq("proyecto_id", proyectoId);
  if (error) {
    console.error("Fallo al borrar un registro:", { modulo, codigo: error.code, mensaje: error.message });
    redirect(`/proyectos/${proyectoId}/r/${modulo}?ok=no_borrado`);
  }
  revalidatePath(`/proyectos/${proyectoId}`, "layout");
  redirect(`/proyectos/${proyectoId}/r/${modulo}?ok=eliminado`);
}
