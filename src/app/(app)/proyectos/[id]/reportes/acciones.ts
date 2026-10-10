"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { ES_UUID } from "@/lib/formato";
import { esFechaValida } from "@/lib/registros/leer";
import type { Estado } from "@/lib/presupuesto/estado";

function mensaje(error: { code?: string; message: string }): string {
  if (error.code === "42501" || error.code === "22023") return error.message;
  console.error("Fallo en reportes:", { codigo: error.code, mensaje: error.message });
  return `No se pudo completar la operación${error.code ? ` (código ${error.code})` : ""}.`;
}

function valoresDe(datos: FormData): Record<string, string> {
  const v: Record<string, string> = {};
  for (const [k, x] of datos.entries()) if (typeof x === "string" && !k.startsWith("$")) v[k] = x;
  return v;
}

export async function crearReporte(proyectoId: string, _prev: Estado, datos: FormData): Promise<Estado> {
  const { supabase, permisos } = await cargarProyecto(proyectoId);
  const valores = valoresDe(datos);
  if (!permisos.gestionar) return { error: "No tienes permiso para crear reportes.", valores };
  const fecha = String(datos.get("fecha_reporte") ?? "");
  if (!esFechaValida(fecha)) return { error: "Indica una fecha válida (cualquier día de la semana que reportas).", valores };
  const { data, error } = await supabase.rpc("reporte_crear", { p_proyecto: proyectoId, p_fecha: fecha });
  if (error) return { error: mensaje(error), valores };
  revalidatePath(`/proyectos/${proyectoId}`, "layout");
  redirect(`/proyectos/${proyectoId}/reportes/${data}`);
}

export async function guardarReporte(proyectoId: string, reporteId: string, _prev: Estado, datos: FormData): Promise<Estado> {
  if (!ES_UUID.test(reporteId)) return { error: "Dirección no válida." };
  const { supabase } = await cargarProyecto(proyectoId);
  const valores = valoresDe(datos);
  const t = (k: string) => String(datos.get(k) ?? "");
  const { error } = await supabase.rpc("reporte_guardar", {
    p_reporte: reporteId,
    p_datos: { estado_reportado: t("estado_reportado"), proxima_revision: t("proxima_revision"), logros: t("logros"), alertas: t("alertas"), decisiones_requeridas: t("decisiones_requeridas"), proximos_hitos: t("proximos_hitos") },
  });
  if (error) return { error: mensaje(error), valores };
  if (datos.get("accion") === "enviar") {
    const { error: e2 } = await supabase.rpc("reporte_enviar", { p_reporte: reporteId });
    if (e2) return { error: mensaje(e2), valores };
  }
  revalidatePath("/", "layout");
  redirect(`/proyectos/${proyectoId}/reportes/${reporteId}?ok=${datos.get("accion") === "enviar" ? "enviado" : "guardado"}`);
}

export async function guardarEvaluacion(proyectoId: string, _prev: Estado, datos: FormData): Promise<Estado> {
  const { supabase } = await cargarProyecto(proyectoId);
  const valores = valoresDe(datos);
  const mes = String(datos.get("mes") ?? "");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return { error: "Elige el mes de la evaluación.", valores };
  const puntaje = Number(datos.get("puntaje"));
  if (!Number.isInteger(puntaje)) return { error: "Elige un puntaje de 1 a 5.", valores };
  const { error } = await supabase.rpc("evaluacion_patrocinador_guardar", { p_proyecto: proyectoId, p_mes: `${mes}-01`, p_puntaje: puntaje });
  if (error) return { error: mensaje(error), valores };
  revalidatePath("/", "layout");
  redirect(`/proyectos/${proyectoId}/reportes?ok=guardado`);
}
