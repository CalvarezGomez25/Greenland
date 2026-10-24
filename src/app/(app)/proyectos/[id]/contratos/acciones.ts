"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { ES_UUID } from "@/lib/formato";
import { leerNumeroColombiano } from "@/lib/presupuesto/csv";
import { esFechaValida, leerDecimalSimple } from "@/lib/registros/leer";
import { TIPOS_CONTRATO } from "@/lib/obra/contratos";
import type { Estado } from "@/lib/presupuesto/estado";
import { avisarDecision } from "@/lib/alertas/inmediato";

function mensaje(e: { code?: string; message: string }): string {
  if (e.code === "42501" || e.code === "22023") return e.message;
  console.error("Fallo en contratos:", { codigo: e.code, mensaje: e.message });
  return `No se pudo completar la operación${e.code ? ` (código ${e.code})` : ""}.`;
}
function valoresDe(d: FormData): Record<string, string> {
  const v: Record<string, string> = {};
  for (const [k, x] of d.entries()) if (typeof x === "string" && !k.startsWith("$")) v[k] = x;
  return v;
}
const base = (id: string) => `/proyectos/${id}/contratos`;

function datosContrato(d: FormData): { datos: Record<string, string> } | { error: string } {
  const tipo = String(d.get("tipo") ?? "");
  if (!(TIPOS_CONTRATO as readonly string[]).includes(tipo)) return { error: "Elige el tipo de contrato." };
  const valor = leerNumeroColombiano(String(d.get("valor") ?? ""), 2, 13);
  if (!valor.ok) return { error: `El valor del contrato ${valor.motivo}.` };
  return { datos: { tipo, contratista: String(d.get("contratista") ?? ""), objeto: String(d.get("objeto") ?? ""), valor: valor.valor } };
}

export async function crearContrato(proyectoId: string, _p: Estado, d: FormData): Promise<Estado> {
  const { supabase, proyecto } = await cargarProyecto(proyectoId);
  const dc = datosContrato(d);
  if ("error" in dc) return { error: dc.error, valores: valoresDe(d) };
  const { data, error } = await supabase.rpc("contrato_crear", { p_proyecto: proyectoId, p_datos: dc.datos });
  if (error) return { error: mensaje(error), valores: valoresDe(d) };
  // Un contrato nuevo espera la aprobación del director general: se le avisa por correo.
  const { data: nuevo } = await supabase.from("contratos").select("estado_aprobacion").eq("id", data as string).maybeSingle();
  if (nuevo?.estado_aprobacion === "pendiente") {
    await avisarDecision(supabase, {
      proyectoId, proyecto: proyecto.nombre, audiencia: "director", titulo: "Contrato nuevo por aprobar",
      detalle: `${dc.datos.contratista}: ${dc.datos.objeto.slice(0, 300)}`, href: `${base(proyectoId)}/${data}`,
    });
  }
  revalidatePath(`/proyectos/${proyectoId}`, "layout");
  redirect(`${base(proyectoId)}/${data}?ok=guardado`);
}

export async function actualizarContrato(proyectoId: string, contratoId: string, _p: Estado, d: FormData): Promise<Estado> {
  if (!ES_UUID.test(contratoId)) return { error: "Dirección no válida." };
  const { supabase } = await cargarProyecto(proyectoId);
  const dc = datosContrato(d);
  if ("error" in dc) return { error: dc.error, valores: valoresDe(d) };
  const { error } = await supabase.rpc("contrato_actualizar", { p_contrato: contratoId, p_datos: dc.datos });
  if (error) return { error: mensaje(error), valores: valoresDe(d) };
  revalidatePath(`/proyectos/${proyectoId}`, "layout");
  redirect(`${base(proyectoId)}/${contratoId}?ok=guardado`);
}

async function terminar(proyectoId: string, contratoId: string, ok: string, error?: string, aviso?: string | null): Promise<never> {
  revalidatePath(`/proyectos/${proyectoId}`, "layout");
  const qs = error ? `error=${encodeURIComponent(error)}` : `ok=${ok}${aviso ? `&aviso=${encodeURIComponent(aviso)}` : ""}`;
  redirect(`${base(proyectoId)}/${contratoId}?${qs}`);
}

export async function autorizarAnticipo(proyectoId: string, contratoId: string, _p: Estado, d: FormData): Promise<Estado> {
  if (!ES_UUID.test(contratoId)) return { error: "Dirección no válida." };
  const { supabase } = await cargarProyecto(proyectoId);
  const pct = leerDecimalSimple(String(d.get("pct") ?? ""), 2);
  if (pct === null || pct < 0 || pct > 100) return { error: "El porcentaje debe ser un número entre 0 y 100.", valores: valoresDe(d) };
  const { data, error } = await supabase.rpc("contrato_anticipo_autorizar", { p_contrato: contratoId, p_pct: pct, p_motivo: String(d.get("motivo") ?? "") });
  if (error) return { error: mensaje(error), valores: valoresDe(d) };
  return terminar(proyectoId, contratoId, "anticipo", undefined, data as string | null);
}

export async function radicarActa(proyectoId: string, contratoId: string, _p: Estado, d: FormData): Promise<Estado> {
  if (!ES_UUID.test(contratoId)) return { error: "Dirección no válida." };
  const { supabase } = await cargarProyecto(proyectoId);
  const fecha = String(d.get("fecha") ?? "");
  if (!esFechaValida(fecha)) return { error: "Indica una fecha válida.", valores: valoresDe(d) };
  const bruto = leerNumeroColombiano(String(d.get("bruto") ?? ""), 2, 13);
  if (!bruto.ok) return { error: `El valor bruto ${bruto.motivo}.`, valores: valoresDe(d) };
  const { error } = await supabase.rpc("acta_pago_crear", { p_contrato: contratoId, p_fecha: fecha, p_bruto: bruto.valor });
  if (error) return { error: mensaje(error), valores: valoresDe(d) };
  return terminar(proyectoId, contratoId, "acta");
}

export async function cambiarEstadoActa(proyectoId: string, contratoId: string, actaId: string, estado: string): Promise<void> {
  if (!ES_UUID.test(actaId)) return terminar(proyectoId, contratoId, "", "Acta no válida.");
  const { supabase } = await cargarProyecto(proyectoId);
  const { error } = await supabase.rpc("acta_pago_estado", { p_acta: actaId, p_estado: estado });
  return terminar(proyectoId, contratoId, "estado_acta", error ? mensaje(error) : undefined);
}

export async function borrarActa(proyectoId: string, contratoId: string, actaId: string): Promise<void> {
  if (!ES_UUID.test(actaId)) return terminar(proyectoId, contratoId, "", "Acta no válida.");
  const { supabase } = await cargarProyecto(proyectoId);
  const { error } = await supabase.rpc("acta_pago_borrar", { p_acta: actaId });
  return terminar(proyectoId, contratoId, "eliminado", error ? mensaje(error) : undefined);
}

export async function liberarRetencion(proyectoId: string, contratoId: string, liberar: boolean): Promise<void> {
  const { supabase } = await cargarProyecto(proyectoId);
  const { error } = await supabase.rpc("contrato_retencion_liberar", { p_contrato: contratoId, p_liberar: liberar });
  return terminar(proyectoId, contratoId, liberar ? "retencion" : "retencion_revertida", error ? mensaje(error) : undefined);
}

// El director general aprueba un contrato nuevo (hasta entonces no admite anticipo ni actas de pago).
export async function aprobarContrato(proyectoId: string, contratoId: string): Promise<void> {
  const { supabase } = await cargarProyecto(proyectoId);
  if (!ES_UUID.test(contratoId)) redirect(base(proyectoId));
  const { error } = await supabase.rpc("contrato_aprobar", { p_contrato: contratoId });
  revalidatePath("/", "layout");
  redirect(`${base(proyectoId)}/${contratoId}?${error ? `error=${encodeURIComponent(mensaje(error))}` : "ok=guardado"}`);
}


// Reparto del valor del contrato entre capítulos del presupuesto y adicionales de obra.
export async function asignarContrato(proyectoId: string, contratoId: string, _p: Estado, d: FormData): Promise<Estado> {
  if (!ES_UUID.test(contratoId)) return { error: "Dirección no válida." };
  const { supabase } = await cargarProyecto(proyectoId);
  const destino = String(d.get("destino") ?? "");
  const [tipo, destinoId] = [destino.slice(0, 2), destino.slice(2)];
  if ((tipo !== "c:" && tipo !== "a:") || !ES_UUID.test(destinoId)) return { error: "Elige el capítulo o el adicional.", valores: valoresDe(d) };
  const valor = leerNumeroColombiano(String(d.get("valor") ?? ""), 2, 13);
  if (!valor.ok) return { error: `El valor ${valor.motivo}.`, valores: valoresDe(d) };
  const { error } = await supabase.rpc("contrato_asignar", {
    p_contrato: contratoId, p_capitulo: tipo === "c:" ? destinoId : null, p_adicional: tipo === "a:" ? destinoId : null, p_valor: valor.valor,
  });
  if (error) return { error: mensaje(error), valores: valoresDe(d) };
  return terminar(proyectoId, contratoId, "asignacion");
}

export async function quitarAsignacion(proyectoId: string, contratoId: string, asignacionId: string): Promise<void> {
  if (!ES_UUID.test(asignacionId)) return terminar(proyectoId, contratoId, "", "Asignación no válida.");
  const { supabase } = await cargarProyecto(proyectoId);
  const { error } = await supabase.rpc("contrato_asignacion_borrar", { p_asignacion: asignacionId });
  return terminar(proyectoId, contratoId, "asignacion_borrada", error ? mensaje(error) : undefined);
}
