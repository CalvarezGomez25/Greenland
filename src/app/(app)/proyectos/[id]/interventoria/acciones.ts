"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { ES_UUID, formatearFecha } from "@/lib/formato";
import { desdeJson } from "@/lib/presupuesto/dinero";
import { avanceFisico, type Tarea } from "@/lib/obra/cronograma";
import { centavos } from "@/lib/pmo/formato";
import { ALCANCES, ENTIDAD_DE_CONCEPTO, SUBROLES, TIPOS_CONCEPTO, TIPOS_INFORME } from "@/lib/interventoria";
import { esFechaValida } from "@/lib/registros/leer";
import type { Estado } from "@/lib/presupuesto/estado";

const base = (id: string, sub = "") => `/proyectos/${id}/interventoria${sub}`;

function mensaje(e: { code?: string; message: string }): string {
  if (e.code === "42501" || e.code === "22023") return e.message;
  console.error("Fallo en interventoría:", { codigo: e.code, mensaje: e.message });
  return `No se pudo completar la operación${e.code ? ` (código ${e.code})` : ""}.`;
}
function valoresDe(d: FormData): Record<string, string> {
  const v: Record<string, string> = {};
  for (const [k, x] of d.entries()) if (typeof x === "string" && !k.startsWith("$")) v[k] = x;
  return v;
}
const t = (d: FormData, k: string) => String(d.get(k) ?? "").trim();
const uuidONulo = (v: string) => (ES_UUID.test(v) ? v : null);

async function ok(proyectoId: string, sub: string, clave = "guardado"): Promise<never> {
  revalidatePath(`/proyectos/${proyectoId}`, "layout");
  redirect(`${base(proyectoId, sub)}?ok=${clave}`);
}
async function aviso(proyectoId: string, sub: string, error: { code?: string; message: string }): Promise<never> {
  redirect(`${base(proyectoId, sub)}?error=${encodeURIComponent(mensaje(error))}`);
}

// ---- Asignaciones -------------------------------------------------------------------------------
export async function guardarAlcance(proyectoId: string, _p: Estado, d: FormData): Promise<Estado> {
  const { supabase } = await cargarProyecto(proyectoId);
  const alcances = d.getAll("alcances").map(String).filter((a) => ALCANCES.some(([k]) => k === a));
  const ini = t(d, "fecha_inicio"), fin = t(d, "fecha_fin");
  if ((ini && !esFechaValida(ini)) || (fin && !esFechaValida(fin))) return { error: "Revisa las fechas de vigencia.", valores: valoresDe(d) };
  const { error } = await supabase.rpc("interventoria_alcance_guardar", {
    p_id: null, p_proyecto: proyectoId, p_contrato_interventoria: uuidONulo(t(d, "contrato_interventoria_id")), p_contrato_vigilado: uuidONulo(t(d, "contrato_vigilado_id")),
    p_alcances: alcances, p_inicio: ini || null, p_fin: fin || null,
  });
  if (error) return { error: mensaje(error), valores: valoresDe(d) };
  return ok(proyectoId, "/asignaciones");
}

export async function asignarUsuario(proyectoId: string, alcanceId: string, _p: Estado, d: FormData): Promise<Estado> {
  if (!ES_UUID.test(alcanceId)) return { error: "Asignación no válida." };
  const { supabase } = await cargarProyecto(proyectoId);
  const usuario = t(d, "usuario_id"), subrol = t(d, "subrol");
  if (!ES_UUID.test(usuario)) return { error: "Elige a la persona.", valores: valoresDe(d) };
  if (!SUBROLES.some(([k]) => k === subrol)) return { error: "Elige el sub-rol.", valores: valoresDe(d) };
  const { error } = await supabase.rpc("interventoria_usuario_asignar", { p_alcance: alcanceId, p_usuario: usuario, p_subrol: subrol });
  if (error) return { error: mensaje(error), valores: valoresDe(d) };
  return ok(proyectoId, "/asignaciones");
}

export async function quitarAsignacion(proyectoId: string, alcanceId: string, usuarioId: string | null): Promise<void> {
  if (!ES_UUID.test(alcanceId) || (usuarioId && !ES_UUID.test(usuarioId))) return redirect(base(proyectoId, "/asignaciones"));
  const { supabase } = await cargarProyecto(proyectoId);
  const { error } = await supabase.rpc("interventoria_asignacion_quitar", { p_alcance: alcanceId, p_usuario: usuarioId });
  if (error) return aviso(proyectoId, "/asignaciones", error);
  return ok(proyectoId, "/asignaciones", "eliminado");
}

// ---- Conceptos -------------------------------------------------------------------------------------
export async function emitirConcepto(proyectoId: string, _p: Estado, d: FormData): Promise<Estado> {
  const { supabase } = await cargarProyecto(proyectoId);
  const tipo = t(d, "tipo"), resultado = t(d, "resultado");
  const [entTipo, entId] = t(d, "registro").split("|");
  if (!TIPOS_CONCEPTO.some(([k]) => k === tipo)) return { error: "Elige el tipo de concepto.", valores: valoresDe(d) };
  if (!entTipo || !ES_UUID.test(entId ?? "")) return { error: "Elige el registro al que se refiere.", valores: valoresDe(d) };
  if (ENTIDAD_DE_CONCEPTO[tipo] !== entTipo && tipo !== "otro") return { error: "El registro elegido no corresponde al tipo de concepto.", valores: valoresDe(d) };
  const { error } = await supabase.rpc("concepto_emitir", { p_proyecto: proyectoId, p_tipo: tipo, p_entidad_tipo: entTipo, p_entidad_id: entId, p_resultado: resultado, p_texto: t(d, "texto") });
  if (error) return { error: mensaje(error), valores: valoresDe(d) };
  return ok(proyectoId, "/conceptos");
}

// ---- Hallazgos ------------------------------------------------------------------------------------------
export async function crearHallazgo(proyectoId: string, _p: Estado, d: FormData): Promise<Estado> {
  const { supabase } = await cargarProyecto(proyectoId);
  const ev = uuidONulo(t(d, "evidencia"));
  const { error } = await supabase.rpc("hallazgo_crear", { p_proyecto: proyectoId, p_contrato: uuidONulo(t(d, "contrato_id")), p_severidad: t(d, "severidad"), p_descripcion: t(d, "descripcion"), p_evidencia: ev ? [ev] : [] });
  if (error) return { error: mensaje(error), valores: valoresDe(d) };
  return ok(proyectoId, "/hallazgos");
}
export async function responderHallazgo(proyectoId: string, hallazgoId: string, d: FormData): Promise<void> {
  if (!ES_UUID.test(hallazgoId)) return redirect(base(proyectoId, "/hallazgos"));
  const { supabase } = await cargarProyecto(proyectoId);
  const { error } = await supabase.rpc("hallazgo_responder", { p_hallazgo: hallazgoId, p_respuesta: t(d, "respuesta") });
  if (error) return aviso(proyectoId, "/hallazgos", error);
  return ok(proyectoId, "/hallazgos");
}
export async function cerrarHallazgo(proyectoId: string, hallazgoId: string): Promise<void> {
  if (!ES_UUID.test(hallazgoId)) return redirect(base(proyectoId, "/hallazgos"));
  const { supabase } = await cargarProyecto(proyectoId);
  const { error } = await supabase.rpc("hallazgo_cerrar", { p_hallazgo: hallazgoId });
  if (error) return aviso(proyectoId, "/hallazgos", error);
  return ok(proyectoId, "/hallazgos");
}
export async function reabrirHallazgo(proyectoId: string, hallazgoId: string): Promise<void> {
  if (!ES_UUID.test(hallazgoId)) return redirect(base(proyectoId, "/hallazgos"));
  const { supabase } = await cargarProyecto(proyectoId);
  const { error } = await supabase.rpc("hallazgo_reabrir", { p_hallazgo: hallazgoId });
  if (error) return aviso(proyectoId, "/hallazgos", error);
  return ok(proyectoId, "/hallazgos");
}

// ---- Revisión de diseños ---------------------------------------------------------------------------------
export async function revisarDiseno(proyectoId: string, _p: Estado, d: FormData): Promise<Estado> {
  const { supabase } = await cargarProyecto(proyectoId);
  const doc = t(d, "documento_id");
  if (!ES_UUID.test(doc)) return { error: "Elige el plano.", valores: valoresDe(d) };
  const { error } = await supabase.rpc("revision_diseno_crear", { p_proyecto: proyectoId, p_documento: doc, p_disciplina: t(d, "disciplina"), p_estado: t(d, "estado"), p_observaciones: t(d, "observaciones") });
  if (error) return { error: mensaje(error), valores: valoresDe(d) };
  return ok(proyectoId, "/disenos");
}
export async function marcarDisenoListo(proyectoId: string, listo: boolean): Promise<void> {
  const { supabase } = await cargarProyecto(proyectoId);
  const { error } = await supabase.rpc("diseno_marcar_listo", { p_proyecto: proyectoId, p_listo: listo });
  if (error) return aviso(proyectoId, "/disenos", error);
  return ok(proyectoId, "/disenos");
}

// ---- Evaluaciones de proveedores y asesorías ---------------------------------------------------------------
export async function evaluarProveedor(proyectoId: string, _p: Estado, d: FormData): Promise<Estado> {
  const { supabase, proyecto } = await cargarProyecto(proyectoId);
  const { data: pars } = await supabase.from("parametros").select("ambito, ambito_id, clave, valor");
  const { listaParametro } = await import("@/lib/pmo/parametros");
  const criterios = listaParametro((pars ?? []) as never, "criterios_evaluacion_proveedor", { proyectoId, portafolioId: proyecto.portafolio_id });
  const puntajes: Record<string, number> = {};
  for (let i = 0; i < criterios.length; i++) {
    const n = Number(t(d, `criterio_${i}`));
    if (!Number.isInteger(n) || n < 1 || n > 5) return { error: `Califica “${criterios[i]}” con un número de 1 a 5.`, valores: valoresDe(d) };
    puntajes[criterios[i]] = n;
  }
  const { error } = await supabase.rpc("evaluacion_proveedor_crear", { p_proyecto: proyectoId, p_contrato: uuidONulo(t(d, "contrato_id")), p_proveedor: t(d, "proveedor"), p_puntajes: puntajes, p_recomendacion: t(d, "recomendacion"), p_comentario: t(d, "comentario") });
  if (error) return { error: mensaje(error), valores: valoresDe(d) };
  return ok(proyectoId, "/evaluaciones");
}
export async function crearAsesoria(proyectoId: string, _p: Estado, d: FormData): Promise<Estado> {
  const { supabase } = await cargarProyecto(proyectoId);
  const { error } = await supabase.rpc("asesoria_crear", { p_proyecto: proyectoId, p_tema: t(d, "tema"), p_tipo: t(d, "tipo"), p_fuentes: t(d, "fuentes"), p_conclusiones: t(d, "conclusiones"), p_recomendacion: t(d, "recomendacion") });
  if (error) return { error: mensaje(error), valores: valoresDe(d) };
  return ok(proyectoId, "/asesorias");
}

// ---- Informes ----------------------------------------------------------------------------------------------------
// Las secciones automáticas se arman con los datos del sistema que la interventoría ve (sección 5.N, formato propuesto).
export async function crearInforme(proyectoId: string, _p: Estado, d: FormData): Promise<Estado> {
  const { supabase } = await cargarProyecto(proyectoId);
  const alcanceId = t(d, "alcance_id"), tipo = t(d, "tipo"), desde = t(d, "desde"), hasta = t(d, "hasta");
  if (!ES_UUID.test(alcanceId)) return { error: "Elige la asignación.", valores: valoresDe(d) };
  if (!TIPOS_INFORME.some(([k]) => k === tipo)) return { error: "Elige el tipo de informe.", valores: valoresDe(d) };
  if (!esFechaValida(desde) || !esFechaValida(hasta) || hasta < desde) return { error: "Indica el periodo (desde y hasta) con fechas válidas.", valores: valoresDe(d) };
  const actaId = uuidONulo(t(d, "acta_id"));

  const { data: a } = await supabase.from("interventoria_alcances").select("id, contrato_vigilado_id, alcances").eq("id", alcanceId).eq("proyecto_id", proyectoId).maybeSingle();
  if (!a) return { error: "No se encontró la asignación.", valores: valoresDe(d) };
  const contratoId = a.contrato_vigilado_id as string | null;
  const hastaTs = `${hasta}T23:59:59.999-05:00`; // hora de Colombia (UTC-5, sin horario de verano)
  const [{ data: ct }, { data: ac }, { data: tareas }, { data: hall }, { data: conc }] = await Promise.all([
    contratoId ? supabase.from("contratos").select("contratista, objeto, valor").eq("id", contratoId).maybeSingle() : Promise.resolve({ data: null }),
    actaId ? supabase.from("actas_pago").select("numero, fecha, valor_bruto, amortizacion, retencion, neto, estado").eq("id", actaId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("tareas").select("id, nombre, semana_inicio, duracion_semanas, peso_pct, avance_pct, avance_verificado_pct").eq("proyecto_id", proyectoId),
    supabase.from("hallazgos").select("severidad, estado, plazo_respuesta").eq("proyecto_id", proyectoId),
    supabase.from("conceptos_interventoria").select("tipo, resultado, subrol, fecha").eq("proyecto_id", proyectoId).gte("fecha", `${desde}T00:00:00-05:00`).lte("fecha", hastaTs),
  ]);
  const av = avanceFisico((tareas ?? []) as Tarea[], true);
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const hs = (hall ?? []) as { severidad: string; estado: string; plazo_respuesta: string }[];
  const cs = (conc ?? []) as { tipo: string; resultado: string }[];
  const contenido = {
    datos: { contrato: ct ? { contratista: ct.contratista, objeto: ct.objeto, valor: centavos(desdeJson(ct.valor, 2)) } : null, periodo: `${formatearFecha(desde)} a ${formatearFecha(hasta)}`, acta: ac ? `Acta ${ac.numero} del ${formatearFecha(ac.fecha)}` : null },
    avance: { reportado: av.reportado, verificado: av.verificado, diferencia: av.diferencia, hayVerificado: av.hayVerificado },
    financiero: ac ? { bruto: centavos(desdeJson(ac.valor_bruto, 2)), amortizacion: centavos(desdeJson(ac.amortizacion, 2)), retencion: centavos(desdeJson(ac.retencion, 2)), neto: centavos(desdeJson(ac.neto, 2)), estado: ac.estado } : null,
    hallazgos: { abiertos: hs.filter((h) => ["abierto", "respondido", "escalado"].includes(h.estado)).length, cerrados: hs.filter((h) => h.estado === "cerrado").length, vencidos: hs.filter((h) => h.estado === "escalado" || (h.estado === "abierto" && h.plazo_respuesta < hoy)).length },
    conceptos: { total: cs.length, aprobados: cs.filter((c) => c.resultado === "aprobado").length, conObservaciones: cs.filter((c) => c.resultado === "aprobado_con_observaciones").length, noAprobados: cs.filter((c) => c.resultado === "no_aprobado").length },
  };
  const { data, error } = await supabase.rpc("informe_crear", { p_proyecto: proyectoId, p_alcance: alcanceId, p_tipo: tipo, p_periodo: `${desde} a ${hasta}`, p_acta: actaId, p_contenido: contenido });
  if (error) return { error: mensaje(error), valores: valoresDe(d) };
  revalidatePath(`/proyectos/${proyectoId}`, "layout");
  redirect(`${base(proyectoId, "/informes")}/${data}?ok=guardado`);
}
export async function guardarInforme(proyectoId: string, informeId: string, _p: Estado, d: FormData): Promise<Estado> {
  if (!ES_UUID.test(informeId)) return { error: "Informe no válido." };
  const { supabase } = await cargarProyecto(proyectoId);
  const { error } = await supabase.rpc("informe_guardar", { p_informe: informeId, p_recomendacion: t(d, "recomendacion"), p_motivo: t(d, "motivo") });
  if (error) return { error: mensaje(error), valores: valoresDe(d) };
  revalidatePath(`/proyectos/${proyectoId}`, "layout");
  redirect(`${base(proyectoId, "/informes")}/${informeId}?ok=guardado`);
}
export async function firmarInforme(proyectoId: string, informeId: string): Promise<void> {
  if (!ES_UUID.test(informeId)) return redirect(base(proyectoId, "/informes"));
  const { supabase } = await cargarProyecto(proyectoId);
  const { error } = await supabase.rpc("informe_firmar", { p_informe: informeId });
  revalidatePath(`/proyectos/${proyectoId}`, "layout");
  redirect(`${base(proyectoId, "/informes")}/${informeId}?${error ? `error=${encodeURIComponent(mensaje(error))}` : "ok=firma"}`);
}
