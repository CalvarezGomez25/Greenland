// Lectura de los datos del portafolio (con la sesión de quien consulta: las reglas de la base deciden qué ve).

import type { SupabaseClient } from "@supabase/supabase-js";
import { desdeJson } from "../presupuesto/dinero";
import type { FilaParametro, } from "./parametros";
import type { EntradaPortafolio, MedicionBase, ProyectoBase } from "./portafolio";

export const COLUMNAS_BASE = "id, nombre, codigo, estado, fase, portafolio_id, organizacion_id";

export type DatosCrudos = {
  proyectos: ProyectoBase[];
  parametros: FilaParametro[];
  entrada: Omit<EntradaPortafolio, "proyectos">;
  gerentes: Map<string, string>; // proyecto_id → usuario_id del gerente
};

export async function cargarDatosPortafolio(supabase: SupabaseClient): Promise<DatosCrudos & { error: boolean }> {
  const [p, m, par, g] = await Promise.all([
    supabase.from("proyectos").select(COLUMNAS_BASE).order("nombre"),
    supabase.from("mediciones_evm").select("proyecto_id, fecha_corte, bac, pv, ev, ac").order("fecha_corte", { ascending: false }).limit(2000),
    supabase.from("parametros").select("ambito, ambito_id, clave, valor"),
    supabase.from("miembros_proyecto").select("proyecto_id, usuario_id").eq("rol", "gerente"),
  ]);
  const mediciones: MedicionBase[] = ((m.data ?? []) as { proyecto_id: string; fecha_corte: string; bac: number | string; pv: number | string; ev: number | string; ac: number | string }[]).map((x) => ({
    proyecto_id: x.proyecto_id,
    fecha_corte: x.fecha_corte,
    bac: desdeJson(x.bac, 2),
    pv: desdeJson(x.pv, 2),
    ev: desdeJson(x.ev, 2),
    ac: desdeJson(x.ac, 2),
  }));
  return {
    error: Boolean(p.error),
    proyectos: (p.data ?? []) as ProyectoBase[],
    parametros: (par.data ?? []) as FilaParametro[],
    gerentes: new Map(((g.data ?? []) as { proyecto_id: string; usuario_id: string }[]).map((x) => [x.proyecto_id, x.usuario_id])),
    entrada: { mediciones, parametros: (par.data ?? []) as FilaParametro[], riesgosActivos: [], cambiosPendientes: [], ultimosReportes: [] },
  };
}
