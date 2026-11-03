"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";
import { ES_UUID } from "@/lib/formato";
import { validarCorreo, validarTelefono } from "@/lib/contactos";
import { TIPOS_TERCERO } from "@/lib/aliados";
import { mensajeDeBase } from "@/lib/registros/errores";
import type { Estado } from "@/lib/presupuesto/estado";

const texto = (d: FormData, k: string) => String(d.get(k) ?? "").trim();
const valoresDe = (d: FormData) => Object.fromEntries([...d.entries()].filter(([k, x]) => typeof x === "string" && !k.startsWith("$"))) as Record<string, string>;
const o = (v: string) => (v === "" ? null : v);

export async function guardarTercero(id: string | null, _anterior: Estado, d: FormData): Promise<Estado> {
  if (id && !ES_UUID.test(id)) return { error: "Dirección no válida." };
  const falla = (error: string): Estado => ({ error, valores: valoresDe(d) });
  const nit = texto(d, "nit"), razon = texto(d, "razon_social");
  if (!nit) return falla("Escribe el NIT o la cédula; si aún no tienes el RUT, usa un identificador temporal PEND-NOMBRE.");
  if (!razon) return falla("La razón social o el nombre es obligatorio.");
  const tipo = texto(d, "tipo_tercero"), persona = texto(d, "tipo_persona"), estado = texto(d, "estado") || "activo";
  if (!(TIPOS_TERCERO as readonly string[]).includes(tipo)) return falla("Elige el tipo de tercero.");
  if (persona !== "juridica" && persona !== "natural") return falla("Elige si es persona jurídica o natural.");
  if (estado !== "activo" && estado !== "inactivo") return falla("Estado no válido.");
  const malo = validarCorreo(texto(d, "correo_notificacion")) ?? validarTelefono(texto(d, "telefono"));
  if (malo) return falla(malo);

  const { supabase } = await obtenerSesion();
  const fila = {
    nit, razon_social: razon, tipo_tercero: tipo, tipo_persona: persona, estado,
    especialidad: o(texto(d, "especialidad")), municipio: o(texto(d, "municipio")), direccion: o(texto(d, "direccion")),
    correo_notificacion: o(texto(d, "correo_notificacion")), telefono: o(texto(d, "telefono")),
    representante_legal: o(texto(d, "representante_legal")), fuente: o(texto(d, "fuente")), observaciones: o(texto(d, "observaciones")),
  };
  const consulta = id ? supabase.from("terceros").update(fila).eq("id", id).select("id") : supabase.from("terceros").insert(fila).select("id");
  const { data, error } = await consulta;
  if (error) {
    if (error.code === "23505") return falla("Ya existe un tercero con ese NIT o cédula. Búscalo en la lista en lugar de crearlo otra vez.");
    return falla(mensajeDeBase(error));
  }
  if (id && (!data || data.length === 0)) return falla("No se encontró el tercero o no tienes permiso para editarlo.");
  revalidatePath("/aliados");
  redirect("/aliados?ok=tercero");
}

export async function guardarContratante(id: string | null, _anterior: Estado, d: FormData): Promise<Estado> {
  if (id && !ES_UUID.test(id)) return { error: "Dirección no válida." };
  const falla = (error: string): Estado => ({ error, valores: valoresDe(d) });
  const razon = texto(d, "razon_social");
  if (!razon) return falla("La razón social es obligatoria.");
  const estado = texto(d, "estado") || "activo";
  if (estado !== "activo" && estado !== "inactivo") return falla("Estado no válido.");
  const malo = validarCorreo(texto(d, "correo_notificacion")) ?? validarCorreo(texto(d, "correo_facturacion"));
  if (malo) return falla(malo);
  const topeTxt = texto(d, "tope_smmlv");
  const tope = topeTxt === "" ? null : Number(topeTxt);
  if (tope !== null && (!Number.isInteger(tope) || tope <= 0 || tope > 100000)) return falla("El tope debe ser un número entero de SMMLV, o dejarse vacío para usar el general.");

  const { supabase } = await obtenerSesion();
  const fila = {
    razon_social: razon, nit: o(texto(d, "nit")), representante_legal: o(texto(d, "representante_legal")), municipio: o(texto(d, "municipio")),
    correo_notificacion: o(texto(d, "correo_notificacion")), correo_facturacion: o(texto(d, "correo_facturacion")),
    tope_smmlv: tope, estado, observaciones: o(texto(d, "observaciones")),
  };
  const consulta = id ? supabase.from("contratantes").update(fila).eq("id", id).select("id") : supabase.from("contratantes").insert(fila).select("id");
  const { data, error } = await consulta;
  if (error) {
    if (error.code === "23505") return falla("Ya existe un contratante con esa razón social o ese NIT.");
    return falla(mensajeDeBase(error));
  }
  if (id && (!data || data.length === 0)) return falla("No se encontró el contratante o no tienes permiso para editarlo.");
  revalidatePath("/aliados/contratantes");
  redirect("/aliados/contratantes?ok=contratante");
}


export async function guardarDocumento(terceroId: string, _anterior: Estado, d: FormData): Promise<Estado> {
  if (!ES_UUID.test(terceroId)) return { error: "Dirección no válida." };
  const falla = (error: string): Estado => ({ error, valores: valoresDe(d) });
  const tipo = texto(d, "tipo"), fecha = texto(d, "fecha_expedicion"), enlace = texto(d, "enlace");
  if (!tipo) return falla("Elige el tipo de documento.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(`${fecha}T00:00:00Z`))) return falla("Indica una fecha de expedición válida.");
  if (enlace && !/^https?:\/\/\S+$/.test(enlace)) return falla("El enlace al soporte debe empezar por http:// o https://.");
  const { supabase } = await obtenerSesion();
  const { error } = await supabase.from("tercero_documentos").insert({ tercero_id: terceroId, tipo, fecha_expedicion: fecha, enlace: o(enlace), observaciones: o(texto(d, "observaciones")) });
  if (error) {
    if (error.code === "42501") return falla("No tienes permiso para registrar documentos de este tercero.");
    return falla(mensajeDeBase(error));
  }
  revalidatePath(`/aliados/${terceroId}`);
  redirect(`/aliados/${terceroId}?ok=documento`);
}

export async function borrarDocumento(terceroId: string, documentoId: string): Promise<void> {
  if (!ES_UUID.test(terceroId) || !ES_UUID.test(documentoId)) redirect("/aliados");
  const { supabase } = await obtenerSesion();
  const { data, error } = await supabase.from("tercero_documentos").delete().eq("id", documentoId).eq("tercero_id", terceroId).select("id");
  revalidatePath(`/aliados/${terceroId}`);
  redirect(`/aliados/${terceroId}?ok=${error || !data || data.length === 0 ? "no_borrado" : "documento_borrado"}`);
}
