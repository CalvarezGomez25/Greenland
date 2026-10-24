// Lectura de lo que el balance necesita además del presupuesto: contratos, actas, adicionales y asignaciones.
// Se hace con la sesión de quien consulta; las reglas de acceso de la base de datos deciden qué filas devuelve.

import type { SupabaseClient } from "@supabase/supabase-js";
import { estadoDeAdicional, type AdicionalDato, type AsignacionDato, type ContratoDato } from "./balance";
import { desdeJson } from "./dinero";
import { ErrorDeBase, leerTodo } from "./paginar";
import { ErrorLecturaTabla } from "./datos";

type Numero = number | string;
type Uno<T> = T | T[] | null;
const uno = <T,>(v: Uno<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
// numeric(15,2) de la base → escala 6 de los cálculos
const aMonto = (v: Numero): bigint => desdeJson(v, 2) * 10_000n;

async function leer<T>(tabla: string, pedir: Parameters<typeof leerTodo<T>>[0]): Promise<T[]> {
  try {
    return await leerTodo<T>(pedir);
  } catch (e) {
    if (e instanceof ErrorDeBase) throw new ErrorLecturaTabla(tabla, e.codigo, e.message);
    throw e;
  }
}

export type DatosBalance = { adicionales: AdicionalDato[]; contratos: ContratoDato[]; asignaciones: AsignacionDato[] };

export async function cargarDatosBalance(supabase: SupabaseClient, proyectoId: string): Promise<DatosBalance> {
  const [contratos, actas, adicionales, asignaciones] = await Promise.all([
    leer<{ id: string; contratista: string; tipo: string; valor: Numero; estado_aprobacion: string | null }>("contratos", (d, h) =>
      supabase.from("contratos").select("id, contratista, tipo, valor, estado_aprobacion").eq("proyecto_id", proyectoId).order("creado_en").range(d, h)),
    leer<{ contrato_id: string; valor_bruto: Numero }>("actas_pago", (d, h) =>
      supabase.from("actas_pago").select("contrato_id, valor_bruto").eq("proyecto_id", proyectoId).order("id").range(d, h)),
    leer<{ id: string; codigo: string; descripcion: string; origen: string; valor_directo: Numero; aplica_indirectos: boolean; cambios: Uno<{ codigo: string; estado_flujo: string }> }>("adicionales", (d, h) =>
      supabase.from("adicionales").select("id, codigo, descripcion, origen, valor_directo, aplica_indirectos, cambios(codigo, estado_flujo)").eq("proyecto_id", proyectoId).order("codigo").range(d, h)),
    leer<{ contrato_id: string; capitulo_id: string | null; adicional_id: string | null; valor: Numero }>("contrato_asignaciones", (d, h) =>
      supabase.from("contrato_asignaciones").select("contrato_id, capitulo_id, adicional_id, valor").eq("proyecto_id", proyectoId).order("id").range(d, h)),
  ]);

  const facturado = new Map<string, bigint>();
  for (const a of actas) facturado.set(a.contrato_id, (facturado.get(a.contrato_id) ?? 0n) + aMonto(a.valor_bruto));

  return {
    contratos: contratos.map((c) => ({
      id: c.id, contratista: c.contratista, tipo: c.tipo, valor: aMonto(c.valor),
      aprobado: c.estado_aprobacion === "aprobado",
      facturado: facturado.get(c.id) ?? 0n,
    })),
    adicionales: adicionales.map((a) => {
      const cambio = uno(a.cambios);
      return {
        id: a.id, codigo: a.codigo, descripcion: a.descripcion, origen: a.origen, valorDirecto: aMonto(a.valor_directo),
        aplicaIndirectos: a.aplica_indirectos, estado: estadoDeAdicional(cambio?.estado_flujo), cambioCodigo: cambio?.codigo ?? null,
      };
    }),
    asignaciones: asignaciones.map((a) => ({ contratoId: a.contrato_id, capituloId: a.capitulo_id, adicionalId: a.adicional_id, valor: aMonto(a.valor) })),
  };
}
