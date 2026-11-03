"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { obtenerSesion } from "@/lib/sesion";
import { ES_UUID } from "@/lib/formato";
import { camposDeDocx } from "@/lib/documentos/combinar";

const salida = (error?: string) => ({ error });

// Paso 1: el servidor verifica permisos y entrega una dirección firmada para subir el archivo (los archivos Word pesan más que el límite de una acción).
export async function prepararSubidaPlantilla(): Promise<{ error?: string; ruta?: string; token?: string }> {
  const { supabase } = await obtenerSesion();
  const { data: permitido } = await supabase.rpc("puede_editar_contratantes");
  if (permitido !== true) return salida("Solo el administrador y el director general suben plantillas.");
  const ruta = `${randomUUID()}.docx`;
  const { data, error } = await supabase.storage.from("plantillas").createSignedUploadUrl(ruta);
  if (error || !data) { console.error("Fallo al preparar la subida de plantilla:", error?.message); return salida("No se pudo preparar la subida. Intenta de nuevo."); }
  return { ruta, token: data.token };
}

// Paso 2: con el archivo ya subido, se lee, se valida que sea un Word con campos de combinación y se registra.
export async function registrarPlantilla(ruta: string, nombre: string, ambito: string, nota: string): Promise<{ error?: string }> {
  if (!/^[0-9a-f-]{36}\.docx$/.test(ruta)) return salida("Archivo no válido.");
  const { supabase } = await obtenerSesion();
  const limpiar = async () => { await supabase.storage.from("plantillas").remove([ruta]); };
  const n = nombre.trim();
  if (n.length < 1 || n.length > 120) { await limpiar(); return salida("Escribe un nombre de hasta 120 caracteres."); }
  if (ambito !== "contrato" && ambito !== "modificacion") { await limpiar(); return salida("Elige si la plantilla es de un contrato o de una modificación."); }
  const { data: blob, error: errLectura } = await supabase.storage.from("plantillas").download(ruta);
  if (errLectura || !blob) return salida("No se encontró el archivo subido. Intenta de nuevo.");
  let campos: string[]; let noSoportados: number;
  const bytes = Buffer.from(await blob.arrayBuffer());
  try { ({ campos, noSoportados } = await camposDeDocx(bytes)); }
  catch (e) { await limpiar(); return salida(e instanceof Error ? e.message : "El archivo no es un documento de Word válido."); }
  if (campos.length === 0) { await limpiar(); return salida("El archivo no trae campos de combinación (MERGEFIELD). Inserta los campos en Word con «Insertar › Elementos rápidos › Campo › MergeField»."); }
  const { error } = await supabase.from("plantillas_documento").insert({ nombre: n, ambito, archivo: ruta, tamano: bytes.length, campos, nota: nota.trim().slice(0, 500) || null });
  if (error) { await limpiar(); console.error("Fallo al registrar la plantilla:", error.code, error.message); return salida(error.code === "42501" ? "No tienes permiso para subir plantillas." : "No se pudo registrar la plantilla."); }
  revalidatePath("/aliados/plantillas");
  return noSoportados > 0 ? salida(`Plantilla registrada, pero ${noSoportados} campo(s) usan un formato que la plataforma no combina: quedarán sin llenar.`) : {};
}

export async function cambiarEstadoPlantilla(id: string, activa: boolean): Promise<void> {
  if (!ES_UUID.test(id)) return;
  const { supabase } = await obtenerSesion();
  await supabase.from("plantillas_documento").update({ activa }).eq("id", id);
  revalidatePath("/aliados/plantillas");
}

export async function borrarPlantilla(id: string): Promise<void> {
  if (!ES_UUID.test(id)) return;
  const { supabase } = await obtenerSesion();
  const { data } = await supabase.from("plantillas_documento").select("archivo").eq("id", id).maybeSingle();
  const { error } = await supabase.from("plantillas_documento").delete().eq("id", id);
  if (!error && data?.archivo) await supabase.storage.from("plantillas").remove([data.archivo]);
  revalidatePath("/aliados/plantillas");
}
