// Lecturas compartidas por las pantallas de interventoría.
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatearFecha } from "@/lib/formato";
import { listaParametro, type FilaParametro } from "@/lib/pmo/parametros";
import { ETIQUETA_TIPO_CONTRATO } from "@/lib/obra/contratos";
import type { Opcion } from "@/lib/registros/tipos";

export async function parametrosDe(supabase: SupabaseClient) {
  const { data } = await supabase.from("parametros").select("ambito, ambito_id, clave, valor");
  return (data ?? []) as FilaParametro[];
}

export async function cargarOpciones(supabase: SupabaseClient, proyectoId: string, portafolioId: string | null) {
  const [{ data: cts }, { data: acts }, { data: cams }, { data: tars }, { data: docs }, parametros] = await Promise.all([
    supabase.from("contratos").select("id, tipo, contratista").eq("proyecto_id", proyectoId).order("creado_en"),
    supabase.from("actas_pago").select("id, numero, fecha, contrato_id").eq("proyecto_id", proyectoId).order("fecha", { ascending: false }),
    supabase.from("cambios").select("id, codigo, tipo").eq("proyecto_id", proyectoId).order("codigo"),
    supabase.from("tareas").select("id, nombre").eq("proyecto_id", proyectoId).order("orden"),
    supabase.from("documentos").select("id, nombre, tipo").eq("proyecto_id", proyectoId).order("creado_en", { ascending: false }),
    parametrosDe(supabase),
  ]);
  const contratos = (cts ?? []) as { id: string; tipo: string; contratista: string }[];
  const nombreContrato = new Map(contratos.map((c) => [c.id, c.contratista]));
  const contratoOp = (c: { id: string; tipo: string; contratista: string }): Opcion => ({ valor: c.id, etiqueta: `${c.contratista} (${ETIQUETA_TIPO_CONTRATO[c.tipo] ?? c.tipo})` });
  const ctx = { proyectoId, portafolioId };
  return {
    parametros,
    contratosObra: contratos.filter((c) => c.tipo !== "interventoria").map(contratoOp),
    contratosInterventoria: contratos.filter((c) => c.tipo === "interventoria").map(contratoOp),
    todosContratos: contratos.map(contratoOp),
    actas: ((acts ?? []) as { id: string; numero: number; fecha: string; contrato_id: string }[]).map((a): Opcion => ({ valor: a.id, etiqueta: `Acta ${a.numero} · ${nombreContrato.get(a.contrato_id) ?? "—"} · ${formatearFecha(a.fecha)}` })),
    cambios: ((cams ?? []) as { id: string; codigo: string; tipo: string }[]).map((c): Opcion => ({ valor: c.id, etiqueta: `${c.codigo} · ${c.tipo}` })),
    tareas: ((tars ?? []) as { id: string; nombre: string }[]).map((t): Opcion => ({ valor: t.id, etiqueta: t.nombre })),
    documentos: ((docs ?? []) as { id: string; nombre: string; tipo: string }[]).map((d): Opcion => ({ valor: d.id, etiqueta: `${d.nombre} (${d.tipo})` })),
    planos: ((docs ?? []) as { id: string; nombre: string; tipo: string }[]).filter((d) => d.tipo === "plano").map((d): Opcion => ({ valor: d.id, etiqueta: d.nombre })),
    disciplinas: listaParametro(parametros, "catalogo_disciplinas_diseno", ctx).map((d): Opcion => ({ valor: d, etiqueta: d })),
    criterios: listaParametro(parametros, "criterios_evaluacion_proveedor", ctx),
  };
}
