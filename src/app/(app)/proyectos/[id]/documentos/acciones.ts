"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { ES_UUID } from "@/lib/formato";
import { MAX_BYTES_DOCUMENTO, nombreSeguro, TIPOS_DOCUMENTO } from "@/lib/documentos";

function mensaje(e: { code?: string; message: string }): string {
  if (e.code === "42501" || e.code === "22023") return e.message;
  console.error("Fallo en documentos:", { codigo: e.code, mensaje: e.message });
  return `No se pudo guardar${e.code ? ` (código ${e.code})` : ""}. Intenta de nuevo.`;
}

// Paso 1: el servidor verifica permisos y entrega una dirección firmada para subir el archivo directo al almacenamiento.
export async function prepararSubidaDocumento(proyectoId: string, nombreArchivo: string, tamano: number, documentoId?: string): Promise<{ error?: string; documentoId?: string; ruta?: string; token?: string }> {
  if (!ES_UUID.test(proyectoId) || (documentoId && !ES_UUID.test(documentoId))) return { error: "Dirección no válida." };
  if (!Number.isFinite(tamano) || tamano <= 0) return { error: "El archivo está vacío." };
  if (tamano > MAX_BYTES_DOCUMENTO) return { error: "El archivo supera los 50 MB permitidos." };
  const { supabase } = await cargarProyecto(proyectoId);
  const id = documentoId ?? randomUUID();
  const ruta = `${proyectoId}/${id}/${randomUUID()}-${nombreSeguro(nombreArchivo)}`;
  const { data, error } = await supabase.storage.from("documentos").createSignedUploadUrl(ruta);
  if (error || !data) {
    console.error("Fallo al preparar la subida del documento:", error?.message);
    return { error: "No se pudo preparar la subida. Verifica que tengas permiso de subir documentos a este proyecto." };
  }
  return { documentoId: id, ruta, token: data.token };
}

// Paso 2: con el archivo ya subido, se registra el documento (o la nueva versión).
export async function registrarDocumento(proyectoId: string, datos: FormData): Promise<{ error?: string }> {
  const { supabase } = await cargarProyecto(proyectoId);
  const t = (k: string) => String(datos.get(k) ?? "").trim();
  const documentoId = t("documento_id");
  const nuevaVersion = t("nueva_version") === "1";
  if (!ES_UUID.test(documentoId)) return { error: "Documento no válido." };
  const tamano = Number(t("tamano"));
  if (!Number.isFinite(tamano) || tamano <= 0 || tamano > MAX_BYTES_DOCUMENTO) return { error: "Tamaño de archivo no válido (máximo 50 MB)." };

  if (nuevaVersion) {
    const { error } = await supabase.rpc("documento_nueva_version", { p_documento: documentoId, p_ruta: t("ruta"), p_nombre_archivo: t("nombre_archivo"), p_tamano: tamano, p_mime: t("mime") || null, p_nota: t("nota") || null });
    if (error) return { error: mensaje(error) };
  } else {
    const tipo = t("tipo");
    if (!TIPOS_DOCUMENTO.some(([k]) => k === tipo)) return { error: "Elige el tipo de documento." };
    const entidadTipo = t("entidad_tipo"), entidadId = t("entidad_id");
    if ((entidadTipo === "") !== (entidadId === "") || (entidadId && !ES_UUID.test(entidadId))) return { error: "La vinculación no es válida." };
    const { error } = await supabase.rpc("documento_crear", {
      p_id: documentoId, p_proyecto: proyectoId, p_tipo: tipo, p_nombre: t("nombre"), p_entidad_tipo: entidadTipo || null, p_entidad_id: entidadId || null,
      p_ruta: t("ruta"), p_nombre_archivo: t("nombre_archivo"), p_tamano: tamano, p_mime: t("mime") || null, p_nota: t("nota") || null,
    });
    if (error) return { error: mensaje(error) };
  }
  revalidatePath(`/proyectos/${proyectoId}`, "layout");
  redirect(`/proyectos/${proyectoId}/documentos/${documentoId}?ok=guardado`);
}

export async function cambiarVisibilidad(proyectoId: string, documentoId: string, visible: boolean): Promise<void> {
  if (!ES_UUID.test(documentoId)) redirect(`/proyectos/${proyectoId}/documentos`);
  const { supabase } = await cargarProyecto(proyectoId);
  const { error } = await supabase.rpc("documento_visibilidad", { p_documento: documentoId, p_visible: visible });
  revalidatePath(`/proyectos/${proyectoId}`, "layout");
  redirect(`/proyectos/${proyectoId}/documentos/${documentoId}?${error ? `error=${encodeURIComponent(mensaje(error))}` : "ok=guardado"}`);
}
