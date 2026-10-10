// Todo lo que muestra el dashboard del portafolio (pantalla y exportaciones usan esta misma función,
// para que lo exportado coincida con lo que se ve).

import type { SupabaseClient } from "@supabase/supabase-js";
import { cargarDatosKpi, cargarDatosPortafolio, hoyColombia } from "./cargar";
import { calcularKpis, type SerieKpi } from "./kpis";
import { armarPortafolio, requiereDecision, type Decision, type FilaPortafolio, type ResumenPortafolio } from "./portafolio";

export type FiltrosDashboard = { estado?: string; fase?: string; portafolio?: string; gerente?: string };

export type Dashboard = {
  filas: FilaPortafolio[];
  resumen: ResumenPortafolio;
  decisiones: Decision[];
  kpis: SerieKpi[];
  portafolios: { id: string; nombre: string }[];
  gerentes: { id: string; nombre: string }[];
  nCerrados: number;
  hoy: string;
};

export async function cargarDashboard(supabase: SupabaseClient, f: FiltrosDashboard): Promise<Dashboard | null> {
  const datos = await cargarDatosPortafolio(supabase);
  if (datos.error) return null;
  const [{ data: portafolios }, { data: perfiles }] = await Promise.all([
    supabase.from("portafolios").select("id, nombre").order("nombre"),
    supabase.from("perfiles").select("id, nombre").order("nombre"),
  ]);
  const nombrePerfil = new Map(((perfiles ?? []) as { id: string; nombre: string }[]).map((p) => [p.id, p.nombre]));
  const gerentes = [...new Set(datos.gerentes.values())].map((id) => ({ id, nombre: nombrePerfil.get(id) ?? "—" }));

  const visibles = datos.proyectos.filter(
    (p) =>
      (!f.estado ? p.estado === "activo" || p.estado === "en_pausa" : f.estado === "todos" || p.estado === f.estado) &&
      (!f.fase || p.fase === f.fase) &&
      (!f.portafolio || p.portafolio_id === f.portafolio) &&
      (!f.gerente || datos.gerentes.get(p.id) === f.gerente),
  );
  const { filas, resumen } = armarPortafolio({ ...datos.entrada, proyectos: visibles });
  const hoy = hoyColombia();
  return {
    filas,
    resumen,
    decisiones: requiereDecision(filas, datos.parametros),
    kpis: calcularKpis(await cargarDatosKpi(supabase, visibles.map((p) => p.id)), { hoy, parametros: datos.parametros }),
    portafolios: (portafolios ?? []) as { id: string; nombre: string }[],
    gerentes,
    nCerrados: datos.proyectos.filter((p) => p.estado === "cerrado").length,
    hoy,
  };
}
