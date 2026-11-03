"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { ES_UUID } from "@/lib/formato";
import { leerNumeroColombiano } from "@/lib/presupuesto/csv";
import { esFechaValida, leerDecimalSimple } from "@/lib/registros/leer";
import type { Estado } from "@/lib/presupuesto/estado";

function mensaje(e: { code?: string; message: string }): string {
  if (e.code === "42501" || e.code === "22023") return e.message;
  console.error("Fallo en procesos:", { codigo: e.code, mensaje: e.message });
  return `No se pudo completar la operación${e.code ? ` (código ${e.code})` : ""}.`;
}
const valoresDe = (d: FormData) => Object.fromEntries([...d.entries()].filter(([k, x]) => typeof x === "string" && !k.startsWith("$"))) as Record<string, string>;
const base = (id: string) => `/proyectos/${id}/procesos`;
const texto = (d: FormData, k: string) => String(d.get(k) ?? "").trim();

export async function guardarProceso(proyectoId: string, procesoId: string | null, _p: Estado, d: FormData): Promise<Estado> {
  if (procesoId && !ES_UUID.test(procesoId)) return { error: "Dirección no válida." };
  const { supabase } = await cargarProyecto(proyectoId);
  const datos: Record<string, string> = {};
  for (const k of ["objeto", "tipo_servicio", "modalidad", "gestor", "fecha_invitacion", "cierre_propuestas", "estado", "enlace", "observaciones"]) datos[k] = texto(d, k);
  for (const k of ["fecha_invitacion", "cierre_propuestas"]) if (datos[k] && !esFechaValida(datos[k])) return { error: "Indica una fecha válida.", valores: valoresDe(d) };
  const ppto = texto(d, "presupuesto_referencia");
  if (ppto) {
    const v = leerNumeroColombiano(ppto, 2, 13);
    if (!v.ok) return { error: `El presupuesto de referencia ${v.motivo}.`, valores: valoresDe(d) };
    datos.presupuesto_referencia = v.valor;
  }
  const { data, error } = await supabase.rpc("proceso_guardar", { p_proyecto: proyectoId, p_id: procesoId, p_datos: datos });
  if (error) return { error: mensaje(error), valores: valoresDe(d) };
  revalidatePath(base(proyectoId));
  redirect(`${base(proyectoId)}/${procesoId ?? data}?ok=proceso`);
}

export async function borrarProceso(proyectoId: string, procesoId: string): Promise<void> {
  if (!ES_UUID.test(procesoId)) redirect(base(proyectoId));
  const { supabase } = await cargarProyecto(proyectoId);
  const { error } = await supabase.rpc("proceso_borrar", { p_proceso: procesoId });
  revalidatePath(base(proyectoId));
  redirect(error ? `${base(proyectoId)}/${procesoId}?error=${encodeURIComponent(mensaje(error))}` : `${base(proyectoId)}?ok=proceso_borrado`);
}

export async function guardarOferta(proyectoId: string, procesoId: string, ofertaId: string | null, _p: Estado, d: FormData): Promise<Estado> {
  if (!ES_UUID.test(procesoId) || (ofertaId && !ES_UUID.test(ofertaId))) return { error: "Dirección no válida." };
  const { supabase } = await cargarProyecto(proyectoId);
  const datos: Record<string, string> = {};
  for (const k of ["tercero_id", "ronda", "estado", "habilitada", "fecha_recepcion", "vigencia_hasta", "plazo_dias", "enlace", "observaciones", "crit_experiencia", "crit_capacidad", "crit_programacion", "crit_comercial", "crit_sst"]) datos[k] = texto(d, k);
  for (const k of ["fecha_recepcion", "vigencia_hasta"]) if (datos[k] && !esFechaValida(datos[k])) return { error: "Indica una fecha válida.", valores: valoresDe(d) };
  if (datos.tercero_id && !ES_UUID.test(datos.tercero_id)) return { error: "Elige un oferente de la lista.", valores: valoresDe(d) };
  if (datos.plazo_dias && !/^\d{1,4}$/.test(datos.plazo_dias)) return { error: "El plazo debe ser un número entero de días.", valores: valoresDe(d) };
  const valor = texto(d, "valor_total");
  if (valor) {
    const v = leerNumeroColombiano(valor, 2, 13);
    if (!v.ok) return { error: `El valor total ${v.motivo}.`, valores: valoresDe(d) };
    datos.valor_total = v.valor;
  }
  for (const k of ["aiu_pct", "anticipo_pct"]) {
    const t = texto(d, k);
    if (!t) continue;
    const n = leerDecimalSimple(t, 2);
    if (n === null || n < 0 || n > 100) return { error: "Los porcentajes van de 0 a 100, con coma decimal si la necesitas.", valores: valoresDe(d) };
    datos[k] = String(n);
  }
  datos.incluye_polizas = d.get("incluye_polizas") === "on" ? "si" : "no";
  datos.apu_discriminado = d.get("apu_discriminado") === "on" ? "si" : "no";
  const { error } = await supabase.rpc("oferta_guardar", { p_proceso: procesoId, p_id: ofertaId, p_datos: datos });
  if (error) return { error: mensaje(error), valores: valoresDe(d) };
  revalidatePath(`${base(proyectoId)}/${procesoId}`);
  redirect(`${base(proyectoId)}/${procesoId}?ok=oferta`);
}

export async function borrarOferta(proyectoId: string, procesoId: string, ofertaId: string): Promise<void> {
  if (!ES_UUID.test(ofertaId)) redirect(`${base(proyectoId)}/${procesoId}`);
  const { supabase } = await cargarProyecto(proyectoId);
  const { error } = await supabase.rpc("oferta_borrar", { p_oferta: ofertaId });
  revalidatePath(`${base(proyectoId)}/${procesoId}`);
  redirect(`${base(proyectoId)}/${procesoId}?${error ? `error=${encodeURIComponent(mensaje(error))}` : "ok=oferta_borrada"}`);
}

export async function adjudicarOferta(proyectoId: string, procesoId: string, ofertaId: string): Promise<void> {
  if (!ES_UUID.test(procesoId) || !ES_UUID.test(ofertaId)) redirect(base(proyectoId));
  const { supabase } = await cargarProyecto(proyectoId);
  const { error } = await supabase.rpc("proceso_adjudicar", { p_proceso: procesoId, p_oferta: ofertaId });
  revalidatePath(`${base(proyectoId)}/${procesoId}`);
  redirect(`${base(proyectoId)}/${procesoId}?${error ? `error=${encodeURIComponent(mensaje(error))}` : "ok=adjudicado"}`);
}
