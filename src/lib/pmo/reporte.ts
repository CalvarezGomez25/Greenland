// Indicadores que se prellenan en un reporte semanal en borrador (al enviarlo se fijan en la base de datos).
import type { SupabaseClient } from "@supabase/supabase-js";
import { desdeJson } from "../presupuesto/dinero";
import { calcularEvm } from "./evm";

export type FotoReporte = {
  fecha_corte?: string; bac?: number | string; pv?: number | string; ev?: number | string; ac?: number | string;
  spi?: number | null; cpi?: number | null; avance_fisico?: number | null; avance_presupuestal?: number | null; hitos_cumplidos_semana?: number;
};

// Lunes y domingo (AAAA-MM-DD) de la semana ISO de una fecha.
export function semanaDe(fecha: string): { lunes: string; domingo: string } {
  const [a, m, d] = fecha.split("-").map(Number);
  const f = new Date(Date.UTC(a, m - 1, d));
  f.setUTCDate(f.getUTCDate() - ((f.getUTCDay() + 6) % 7));
  const lunes = f.toISOString().slice(0, 10);
  f.setUTCDate(f.getUTCDate() + 6);
  return { lunes, domingo: f.toISOString().slice(0, 10) };
}

export async function indicadoresBorrador(supabase: SupabaseClient, proyectoId: string, fechaReporte: string): Promise<FotoReporte> {
  const { lunes, domingo } = semanaDe(fechaReporte);
  const [{ data: m }, { count }] = await Promise.all([
    supabase.from("mediciones_evm").select("fecha_corte, bac, pv, ev, ac").eq("proyecto_id", proyectoId).lte("fecha_corte", fechaReporte).order("fecha_corte", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("hitos").select("id", { count: "exact", head: true }).eq("proyecto_id", proyectoId).eq("cancelado", false).gte("fecha_real", lunes).lte("fecha_real", domingo),
  ]);
  let foto: FotoReporte = { hitos_cumplidos_semana: count ?? 0 };
  if (m) {
    const e = calcularEvm({ bac: desdeJson(m.bac, 2), pv: desdeJson(m.pv, 2), ev: desdeJson(m.ev, 2), ac: desdeJson(m.ac, 2) });
    foto = { ...foto, fecha_corte: m.fecha_corte, ac: m.ac, spi: e.spi, cpi: e.cpi, avance_fisico: e.avanceFisico, avance_presupuestal: e.avanceFinanciero };
  }
  return foto;
}
