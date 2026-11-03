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
  const tercero = String(d.get("tercero_id") ?? "").trim();
  if (tercero && !ES_UUID.test(tercero)) return { error: "Elige un tercero de la lista." };
  return { datos: { tipo, contratista: String(d.get("contratista") ?? ""), tercero_id: tercero, objeto: String(d.get("objeto") ?? ""), valor: valor.valor } };
}

export async function crearContrato(proyectoId: string, _p: Estado, d: FormData): Promise<Estado> {
  const { supabase, proyecto } = await cargarProyecto(proyectoId);
  const dc = datosContrato(d);
  if ("error" in dc) return { error: dc.error, valores: valoresDe(d) };
  const { data, error } = await supabase.rpc("contrato_crear", { p_proyecto: proyectoId, p_datos: dc.datos });
  if (error) return { error: mensaje(error), valores: valoresDe(d) };
  // Si nace de un proceso adjudicado, se vincula (si no coincide el adjudicatario, el contrato queda creado y se avisa).
  const procesoId = String(d.get("proceso_id") ?? "");
  if (procesoId && ES_UUID.test(procesoId)) {
    const { error: errVinculo } = await supabase.rpc("proceso_contrato_vincular", { p_proceso: procesoId, p_contrato: data as string });
    if (errVinculo) console.error("No se pudo vincular el contrato al proceso:", errVinculo.code, errVinculo.message);
  }
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


// Datos contractuales: consecutivo, orden de servicio, fechas, plazo y autorización de asamblea.
export async function guardarDatosContractuales(proyectoId: string, contratoId: string, _p: Estado, d: FormData): Promise<Estado> {
  if (!ES_UUID.test(contratoId)) return { error: "Dirección no válida." };
  const { supabase } = await cargarProyecto(proyectoId);
  const datos: Record<string, string> = {};
  for (const k of ["consecutivo", "orden_servicio_sap", "fecha_firma", "fecha_acta_inicio", "plazo_valor", "plazo_unidad", "autorizacion_asamblea"]) datos[k] = String(d.get(k) ?? "").trim();
  for (const k of ["fecha_firma", "fecha_acta_inicio"]) if (datos[k] && !esFechaValida(datos[k])) return { error: "Indica una fecha válida.", valores: valoresDe(d) };
  if (datos.plazo_valor && !/^\d{1,4}$/.test(datos.plazo_valor)) return { error: "El plazo debe ser un número entero de 1 a 3650.", valores: valoresDe(d) };
  const { error } = await supabase.rpc("contrato_datos_guardar", { p_contrato: contratoId, p_datos: datos });
  if (error) return { error: mensaje(error), valores: valoresDe(d) };
  return terminar(proyectoId, contratoId, "datos_contrato");
}

// Avanzar de etapa (de una en una).
export async function avanzarEtapa(proyectoId: string, contratoId: string, etapa: number): Promise<void> {
  if (!ES_UUID.test(contratoId)) return terminar(proyectoId, contratoId, "", "Contrato no válido.");
  const { supabase } = await cargarProyecto(proyectoId);
  const { error } = await supabase.rpc("contrato_etapa_cambiar", { p_contrato: contratoId, p_etapa: etapa, p_motivo: null });
  return terminar(proyectoId, contratoId, "etapa", error ? mensaje(error) : undefined);
}

// Devolver a una etapa anterior: exige motivo y queda en el historial.
export async function devolverEtapa(proyectoId: string, contratoId: string, _p: Estado, d: FormData): Promise<Estado> {
  if (!ES_UUID.test(contratoId)) return { error: "Dirección no válida." };
  const etapa = Number(d.get("etapa"));
  if (!Number.isInteger(etapa) || etapa < 1 || etapa > 9) return { error: "Elige la etapa a la que vuelve.", valores: valoresDe(d) };
  const { supabase } = await cargarProyecto(proyectoId);
  const { error } = await supabase.rpc("contrato_etapa_cambiar", { p_contrato: contratoId, p_etapa: etapa, p_motivo: String(d.get("motivo") ?? "") });
  if (error) return { error: mensaje(error), valores: valoresDe(d) };
  return terminar(proyectoId, contratoId, "etapa");
}

// Contratante del proyecto (se elige en la pantalla de contratos).
export async function asignarContratante(proyectoId: string, _p: Estado, d: FormData): Promise<Estado> {
  const { supabase } = await cargarProyecto(proyectoId);
  const c = String(d.get("contratante_id") ?? "").trim();
  if (c && !ES_UUID.test(c)) return { error: "Elige un contratante de la lista." };
  const { error } = await supabase.rpc("proyecto_contratante_asignar", { p_proyecto: proyectoId, p_contratante: c || null });
  if (error) return { error: mensaje(error) };
  revalidatePath(`/proyectos/${proyectoId}`, "layout");
  redirect(`${base(proyectoId)}?ok=contratante_proyecto`);
}


// ---- Pólizas -----------------------------------------------------------------------------------------------
export async function guardarPoliza(proyectoId: string, contratoId: string, _p: Estado, d: FormData): Promise<Estado> {
  if (!ES_UUID.test(contratoId)) return { error: "Dirección no válida." };
  const { supabase } = await cargarProyecto(proyectoId);
  const datos: Record<string, string> = {};
  for (const k of ["amparo", "aseguradora", "numero", "fecha_expedicion", "fecha_vencimiento", "estado", "enlace"]) datos[k] = String(d.get(k) ?? "").trim();
  for (const k of ["fecha_expedicion", "fecha_vencimiento"]) if (datos[k] && !esFechaValida(datos[k])) return { error: "Indica una fecha válida.", valores: valoresDe(d) };
  const valor = String(d.get("valor_asegurado") ?? "").trim();
  if (valor) {
    const v = leerNumeroColombiano(valor, 2, 13);
    if (!v.ok) return { error: `El valor asegurado ${v.motivo}.`, valores: valoresDe(d) };
    datos.valor_asegurado = v.valor;
  }
  const { error } = await supabase.rpc("poliza_guardar", { p_contrato: contratoId, p_datos: datos });
  if (error) return { error: mensaje(error), valores: valoresDe(d) };
  return terminar(proyectoId, contratoId, "poliza");
}

export async function borrarPoliza(proyectoId: string, contratoId: string, polizaId: string): Promise<void> {
  if (!ES_UUID.test(polizaId)) return terminar(proyectoId, contratoId, "", "Póliza no válida.");
  const { supabase } = await cargarProyecto(proyectoId);
  const { error } = await supabase.rpc("poliza_borrar", { p_poliza: polizaId });
  return terminar(proyectoId, contratoId, "poliza_borrada", error ? mensaje(error) : undefined);
}

// ---- Modificaciones ----------------------------------------------------------------------------------------
export async function guardarModificacion(proyectoId: string, contratoId: string, modificacionId: string | null, _p: Estado, d: FormData): Promise<Estado> {
  if (!ES_UUID.test(contratoId) || (modificacionId && !ES_UUID.test(modificacionId))) return { error: "Dirección no válida." };
  const { supabase } = await cargarProyecto(proyectoId);
  const datos: Record<string, string> = {};
  for (const k of ["tipo", "descripcion", "justificacion", "estado", "fecha_firma", "nueva_fecha_fin", "cambio_id"]) datos[k] = String(d.get(k) ?? "").trim();
  for (const k of ["fecha_firma", "nueva_fecha_fin"]) if (datos[k] && !esFechaValida(datos[k])) return { error: "Indica una fecha válida.", valores: valoresDe(d) };
  if (datos.cambio_id && !ES_UUID.test(datos.cambio_id)) return { error: "Elige un cambio de la lista.", valores: valoresDe(d) };
  const valor = String(d.get("valor") ?? "").trim();
  if (valor) {
    const v = leerNumeroColombiano(valor, 2, 13);
    if (!v.ok) return { error: `El valor ${v.motivo}.`, valores: valoresDe(d) };
    datos.valor = v.valor;
  }
  const { error } = await supabase.rpc("modificacion_guardar", { p_contrato: contratoId, p_id: modificacionId, p_datos: datos });
  if (error) return { error: mensaje(error), valores: valoresDe(d) };
  return terminar(proyectoId, contratoId, "modificacion");
}

export async function borrarModificacion(proyectoId: string, contratoId: string, modificacionId: string): Promise<void> {
  if (!ES_UUID.test(modificacionId)) return terminar(proyectoId, contratoId, "", "Modificación no válida.");
  const { supabase } = await cargarProyecto(proyectoId);
  const { error } = await supabase.rpc("modificacion_borrar", { p_modificacion: modificacionId });
  return terminar(proyectoId, contratoId, "modificacion_borrada", error ? mensaje(error) : undefined);
}


// ---- Comunicaciones y compromisos ---------------------------------------------------------------------------
export async function guardarComunicacion(proyectoId: string, contratoId: string, comunicacionId: string | null, _p: Estado, d: FormData): Promise<Estado> {
  if (!ES_UUID.test(contratoId) || (comunicacionId && !ES_UUID.test(comunicacionId))) return { error: "Dirección no válida." };
  const { supabase } = await cargarProyecto(proyectoId);
  const datos: Record<string, string> = {};
  for (const k of ["fecha", "canal", "asunto", "resumen", "enlace", "responsable", "fecha_compromiso", "estado"]) datos[k] = String(d.get(k) ?? "").trim();
  for (const k of ["fecha", "fecha_compromiso"]) if (datos[k] && !esFechaValida(datos[k])) return { error: "Indica una fecha válida.", valores: valoresDe(d) };
  datos.requiere_accion = d.get("requiere_accion") === "on" ? "si" : "no";
  const { error } = await supabase.rpc("comunicacion_guardar", { p_contrato: contratoId, p_id: comunicacionId, p_datos: datos });
  if (error) return { error: mensaje(error), valores: valoresDe(d) };
  return terminar(proyectoId, contratoId, "comunicacion");
}

export async function borrarComunicacion(proyectoId: string, contratoId: string, comunicacionId: string): Promise<void> {
  if (!ES_UUID.test(comunicacionId)) return terminar(proyectoId, contratoId, "", "Comunicación no válida.");
  const { supabase } = await cargarProyecto(proyectoId);
  const { error } = await supabase.rpc("comunicacion_borrar", { p_comunicacion: comunicacionId });
  return terminar(proyectoId, contratoId, "comunicacion_borrada", error ? mensaje(error) : undefined);
}

export async function cerrarCompromiso(proyectoId: string, contratoId: string, c: { id: string; fecha: string; canal: string; asunto: string; resumen: string; enlace: string; responsable: string; fecha_compromiso: string }): Promise<void> {
  if (!ES_UUID.test(c.id) || !ES_UUID.test(contratoId)) return terminar(proyectoId, contratoId, "", "Comunicación no válida.");
  const { supabase } = await cargarProyecto(proyectoId);
  const { error } = await supabase.rpc("comunicacion_guardar", { p_contrato: contratoId, p_id: c.id, p_datos: { ...c, id: undefined, requiere_accion: "si", estado: "cerrado" } });
  return terminar(proyectoId, contratoId, "comunicacion", error ? mensaje(error) : undefined);
}
