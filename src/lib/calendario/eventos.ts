// Fechas de trabajo de una persona para su calendario: actividades suyas y, de los proyectos que puede ver, cierres de
// propuestas, vencimientos de pólizas y de documentos del contratista, compromisos y fines de contrato. Se lee con la
// sesión de quien consulta: las reglas de acceso de la base deciden qué ve, así que la interventoría no recibe procesos.

import type { SupabaseClient } from "@supabase/supabase-js";
import { fechaValida, type EventoCal } from "./ics";

export type TipoEvento = "actividad" | "proceso" | "poliza" | "documento" | "compromiso" | "contrato";
export type EventoPlataforma = EventoCal & { tipo: TipoEvento; proyecto: string | null };

export const ETIQUETA_TIPO_EVENTO: Record<TipoEvento, string> = {
  actividad: "Actividad", proceso: "Cierre de propuestas", poliza: "Vence una póliza", documento: "Vence un documento", compromiso: "Compromiso", contrato: "Fin de contrato",
};

type Uno<T> = T | T[] | null;
const uno = <T,>(v: Uno<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
type Proy = { codigo: string | null; nombre: string };
const rotulo = (p: Uno<Proy>): string | null => { const x = uno(p); return x ? (x.codigo ? x.codigo : x.nombre) : null; };
const con = (p: string | null, t: string) => (p ? `[${p}] ${t}` : t);
const dia = (f: unknown) => String(f ?? "").slice(0, 10);

export function sumarDias(f: string, n: number): string {
  const d = new Date(`${f}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function cargarEventos(supabase: SupabaseClient, perfilId: string, hoy: string, base = ""): Promise<EventoPlataforma[]> {
  const desde = sumarDias(hoy, -30), hasta = sumarDias(hoy, 365);
  const enVentana = (f: string) => fechaValida(f) && f >= desde && f <= hasta;
  const pr = "proyectos(codigo, nombre)";
  const [act, proc, pol, com, con_] = await Promise.all([
    supabase.from("actividades").select(`id, titulo, fecha_limite, proyecto_id, ${pr}`).eq("responsable_id", perfilId).neq("estado", "hecha").not("fecha_limite", "is", null).gte("fecha_limite", desde).lte("fecha_limite", hasta).limit(1000),
    supabase.from("procesos").select(`id, codigo, objeto, cierre_propuestas, proyecto_id, ${pr}`).in("estado", ["en_preparacion", "abierta", "en_evaluacion"]).not("cierre_propuestas", "is", null).gte("cierre_propuestas", desde).lte("cierre_propuestas", hasta).limit(1000),
    supabase.from("contrato_polizas").select(`id, contrato_id, proyecto_id, amparo, fecha_vencimiento, ${pr}`).eq("estado", "activa").not("fecha_vencimiento", "is", null).gte("fecha_vencimiento", desde).lte("fecha_vencimiento", hasta).limit(1000),
    supabase.from("contrato_comunicaciones").select(`id, contrato_id, proyecto_id, asunto, fecha_compromiso, ${pr}`).eq("requiere_accion", true).eq("estado", "abierto").not("fecha_compromiso", "is", null).gte("fecha_compromiso", desde).lte("fecha_compromiso", hasta).limit(1000),
    supabase.from("contratos").select(`id, proyecto_id, contratista, tercero_id, fecha_fin_vigente, ${pr}`).lt("etapa", 9).limit(1000),
  ]);
  const contratos = (con_.data ?? []) as unknown as { id: string; proyecto_id: string; contratista: string; tercero_id: string | null; fecha_fin_vigente: string | null; proyectos: Uno<Proy> }[];
  const nombreContrato = (id: string) => contratos.find((c) => c.id === id)?.contratista ?? "contrato";
  const out: EventoPlataforma[] = [];
  const url = (ruta: string) => (base ? `${base}${ruta}` : undefined);

  for (const a of (act.data ?? []) as unknown as { id: string; titulo: string; fecha_limite: string; proyecto_id: string; proyectos: Uno<Proy> }[]) {
    const p = rotulo(a.proyectos);
    out.push({ tipo: "actividad", uid: `actividad-${a.id}`, titulo: con(p, a.titulo), fecha: dia(a.fecha_limite), categoria: "Actividad", proyecto: p, descripcion: "Fecha límite de una actividad que tienes asignada.", url: url(`/proyectos/${a.proyecto_id}/actividades`) });
  }
  for (const x of (proc.data ?? []) as unknown as { id: string; codigo: string; objeto: string; cierre_propuestas: string; proyecto_id: string; proyectos: Uno<Proy> }[]) {
    const p = rotulo(x.proyectos);
    out.push({ tipo: "proceso", uid: `proceso-${x.id}`, titulo: con(p, `Cierre de propuestas ${x.codigo}`), fecha: dia(x.cierre_propuestas), categoria: "Contratación", proyecto: p, descripcion: x.objeto, url: url(`/proyectos/${x.proyecto_id}/procesos/${x.id}`) });
  }
  for (const x of (pol.data ?? []) as unknown as { id: string; contrato_id: string; proyecto_id: string; amparo: string; fecha_vencimiento: string; proyectos: Uno<Proy> }[]) {
    const p = rotulo(x.proyectos), c = nombreContrato(x.contrato_id);
    out.push({ tipo: "poliza", uid: `poliza-${x.id}`, titulo: con(p, `Vence póliza «${x.amparo}» de ${c}`), fecha: dia(x.fecha_vencimiento), categoria: "Contratos", proyecto: p, descripcion: "Renovar o confirmar la póliza con el contratista antes de esta fecha.", url: url(`/proyectos/${x.proyecto_id}/contratos/${x.contrato_id}`) });
  }
  for (const x of (com.data ?? []) as unknown as { id: string; contrato_id: string; proyecto_id: string; asunto: string; fecha_compromiso: string; proyectos: Uno<Proy> }[]) {
    const p = rotulo(x.proyectos), c = nombreContrato(x.contrato_id);
    out.push({ tipo: "compromiso", uid: `compromiso-${x.id}`, titulo: con(p, `Compromiso: ${x.asunto}`), fecha: dia(x.fecha_compromiso), categoria: "Contratos", proyecto: p, descripcion: `Contratista: ${c}.`, url: url(`/proyectos/${x.proyecto_id}/contratos/${x.contrato_id}`) });
  }
  for (const c of contratos) {
    const f = dia(c.fecha_fin_vigente);
    if (!f || !enVentana(f)) continue;
    const p = rotulo(c.proyectos);
    out.push({ tipo: "contrato", uid: `contrato-fin-${c.id}`, titulo: con(p, `Fin del contrato de ${c.contratista}`), fecha: f, categoria: "Contratos", proyecto: p, descripcion: "Fecha fin vigente del contrato, con las prórrogas y suspensiones firmadas.", url: url(`/proyectos/${c.proyecto_id}/contratos/${c.id}`) });
  }
  // Vigencia de los documentos del contratista (RUT, cámara de comercio, seguridad social…): la calcula la base.
  const terceros = [...new Set(contratos.map((c) => c.tercero_id).filter((t): t is string => !!t))];
  if (terceros.length) {
    const { data: dv } = await supabase.rpc("terceros_documentos_vigencia", { p_terceros: terceros });
    for (const d of (dv ?? []) as { tercero_id: string; tipo: string; fecha_vencimiento: string }[]) {
      const f = dia(d.fecha_vencimiento);
      if (!enVentana(f)) continue;
      const cs = contratos.filter((c) => c.tercero_id === d.tercero_id);
      const nombre = cs[0]?.contratista ?? "contratista";
      out.push({ tipo: "documento", uid: `documento-${d.tercero_id}-${d.tipo}`, titulo: `Vence ${d.tipo} de ${nombre}`, fecha: f, categoria: "Contratos", proyecto: null, descripcion: "Pedir al contratista el documento actualizado.", url: url("/aliados") });
    }
  }
  return out.filter((e) => fechaValida(e.fecha)).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.titulo.localeCompare(b.titulo, "es"));
}
