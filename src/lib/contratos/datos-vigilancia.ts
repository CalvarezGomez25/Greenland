// Lectura de lo que el semáforo de un contrato necesita además de sus propias columnas: pólizas, modificaciones y la
// vigencia de los documentos de su contratista. Se hace con la sesión de quien consulta (las reglas de acceso de la base
// deciden qué ve).

import type { SupabaseClient } from "@supabase/supabase-js";
import { desdeJson } from "../presupuesto/dinero";
import { documentosDelTercero, minimoPoliza, type Compromiso, type DocumentosTercero, type PolizaEntrada } from "./vigilancia";

export type ContratoBase = { id: string; tercero_id: string | null; valor: number | string; anticipo_valor: number | string };
export type ExtrasContrato = { polizas: PolizaEntrada[]; documentos: DocumentosTercero | null; enTramite: number; compromisos: Compromiso[] };

export async function cargarExtrasVigilancia(supabase: SupabaseClient, proyectoId: string, contratos: ContratoBase[], hoy: string, alertaDias: number): Promise<Map<string, ExtrasContrato>> {
  const terceros = [...new Set(contratos.map((c) => c.tercero_id).filter((t): t is string => !!t))];
  const [{ data: ps }, { data: ms }, { data: am }, { data: dv }, { data: cs }] = await Promise.all([
    supabase.from("contrato_polizas").select("contrato_id, amparo, estado, fecha_vencimiento, valor_asegurado").eq("proyecto_id", proyectoId).limit(5000),
    supabase.from("contrato_modificaciones").select("contrato_id, estado").eq("proyecto_id", proyectoId).eq("estado", "en_tramite").limit(5000),
    supabase.from("poliza_amparos").select("nombre, porcentaje, base"),
    terceros.length ? supabase.rpc("terceros_documentos_vigencia", { p_terceros: terceros }) : Promise.resolve({ data: [] }),
    supabase.from("contrato_comunicaciones").select("contrato_id, asunto, fecha_compromiso").eq("proyecto_id", proyectoId).eq("requiere_accion", true).eq("estado", "abierto").not("fecha_compromiso", "is", null).limit(5000),
  ]);
  const amparos = new Map(((am ?? []) as { nombre: string; porcentaje: number | string; base: string }[]).map((a) => [a.nombre, a]));
  const docsPorTercero = new Map<string, { tipo: string; vencimiento: string }[]>();
  for (const d of (dv ?? []) as { tercero_id: string; tipo: string; fecha_vencimiento: string }[]) {
    const l = docsPorTercero.get(d.tercero_id) ?? [];
    l.push({ tipo: d.tipo, vencimiento: String(d.fecha_vencimiento).slice(0, 10) });
    docsPorTercero.set(d.tercero_id, l);
  }
  const out = new Map<string, ExtrasContrato>();
  for (const c of contratos) {
    const valor = desdeJson(c.valor, 2), anticipo = desdeJson(c.anticipo_valor, 2);
    const polizas = ((ps ?? []) as { contrato_id: string; amparo: string; estado: "activa" | "cumplida"; fecha_vencimiento: string | null; valor_asegurado: number | string | null }[])
      .filter((p) => p.contrato_id === c.id)
      .map((p): PolizaEntrada => {
        const a = amparos.get(p.amparo);
        const base = a?.base === "valor_anticipo" ? anticipo : valor;
        return {
          amparo: p.amparo, estado: p.estado, vencimiento: p.fecha_vencimiento ? String(p.fecha_vencimiento).slice(0, 10) : null,
          valorAsegurado: p.valor_asegurado === null ? null : desdeJson(p.valor_asegurado, 2),
          minimo: a && base > 0n ? minimoPoliza(Number(a.porcentaje), base) : null,
        };
      });
    out.set(c.id, {
      polizas,
      documentos: c.tercero_id ? documentosDelTercero(docsPorTercero.get(c.tercero_id) ?? [], hoy, alertaDias) : null,
      enTramite: ((ms ?? []) as { contrato_id: string }[]).filter((m) => m.contrato_id === c.id).length,
      compromisos: ((cs ?? []) as { contrato_id: string; asunto: string; fecha_compromiso: string }[]).filter((k) => k.contrato_id === c.id).map((k) => ({ asunto: k.asunto, fecha: String(k.fecha_compromiso).slice(0, 10) })),
    });
  }
  return out;
}
