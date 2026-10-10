// Lecturas compartidas por las pantallas de cambios.
import type { SupabaseClient } from "@supabase/supabase-js";
import { listaParametro, type FilaParametro } from "@/lib/pmo/parametros";

export async function cargarOpcionesCambio(supabase: SupabaseClient, proyectoId: string, portafolioId: string | null) {
  const [{ data: pars }, { data: ries }] = await Promise.all([
    supabase.from("parametros").select("ambito, ambito_id, clave, valor"),
    supabase.from("riesgos").select("id, codigo, descripcion, estado").eq("proyecto_id", proyectoId).order("codigo"),
  ]);
  const parametros = (pars ?? []) as FilaParametro[];
  const tipos = listaParametro(parametros, "tipos_cambio", { proyectoId, portafolioId });
  const riesgos = ((ries ?? []) as { id: string; codigo: string; descripcion: string; estado: string }[]).map((r) => ({
    id: r.id,
    etiqueta: `${r.codigo} · ${r.descripcion.slice(0, 60)}${r.estado === "materializado" ? " (materializado)" : ""}`,
  }));
  return { parametros, tipos, riesgos };
}
