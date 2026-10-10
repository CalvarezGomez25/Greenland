// Lectura de los datos del portafolio (con la sesión de quien consulta: las reglas de la base deciden qué ve).

import type { SupabaseClient } from "@supabase/supabase-js";
import { desdeJson } from "../presupuesto/dinero";
import type { FilaParametro, } from "./parametros";
import type { CambioPendiente, EntradaPortafolio, HitoVencido, ItemNivel, MedicionBase, ProyectoBase, ReporteBase } from "./portafolio";
import { semanaIso } from "./formato";
import type { DatosKpi } from "./kpis";
import { numeroParametro } from "./parametros";
import { CORTES_RIESGO } from "./planificacion";
import { nivelDeRiesgo, type NivelCambio, type NivelRiesgo } from "./semaforo";

// Fecha de hoy en Colombia (AAAA-MM-DD), sin importar dónde corra el servidor.
export const hoyColombia = (): string => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

export const COLUMNAS_BASE = "id, nombre, codigo, estado, fase, portafolio_id, organizacion_id";

export type DatosCrudos = {
  proyectos: ProyectoBase[];
  parametros: FilaParametro[];
  entrada: Omit<EntradaPortafolio, "proyectos">;
  gerentes: Map<string, string>; // proyecto_id → usuario_id del gerente
};

export async function cargarDatosPortafolio(supabase: SupabaseClient): Promise<DatosCrudos & { error: boolean }> {
  const hoy = hoyColombia();
  const [p, m, par, g, rs, cs, rp, hv] = await Promise.all([
    supabase.from("proyectos").select(COLUMNAS_BASE).order("nombre"),
    supabase.from("mediciones_evm").select("proyecto_id, fecha_corte, bac, pv, ev, ac").order("fecha_corte", { ascending: false }).limit(2000),
    supabase.from("parametros").select("ambito, ambito_id, clave, valor"),
    supabase.from("miembros_proyecto").select("proyecto_id, usuario_id").eq("rol", "gerente"),
    supabase.from("riesgos").select("proyecto_id, score").eq("estado", "activo").limit(5000),
    supabase.from("cambios").select("proyecto_id, nivel, estado_flujo, codigo, en_aprobacion_desde").not("estado_flujo", "in", "(cerrado,rechazado)").limit(5000),
    supabase.from("reportes_semanales").select("proyecto_id, anio, semana, estado_reportado, alertas, decisiones_requeridas").not("enviado_en", "is", null).order("anio", { ascending: false }).order("semana", { ascending: false }).limit(3000),
    supabase.from("hitos").select("proyecto_id, nombre, fecha_plan").is("fecha_real", null).eq("cancelado", false).lt("fecha_plan", hoy).order("fecha_plan").limit(2000),
  ]);
  const reportes = (rp.data ?? []) as ReporteBase[];
  const sem = semanaIso(hoy);
  const cambiosPendientes: CambioPendiente[] = ((cs.data ?? []) as { proyecto_id: string; nivel: NivelCambio | null; estado_flujo: string; codigo: string; en_aprobacion_desde: string | null }[]).map((c) => ({
    proyecto_id: c.proyecto_id, nivel: c.nivel ?? "menor", estado: c.estado_flujo, codigo: c.codigo, desde: c.en_aprobacion_desde,
  }));
  const proyectos = (p.data ?? []) as ProyectoBase[];
  const parametros = (par.data ?? []) as FilaParametro[];
  // Nivel de cada riesgo activo con los cortes del proyecto (parámetros).
  const riesgosActivos: ItemNivel<NivelRiesgo>[] = ((rs.data ?? []) as { proyecto_id: string; score: number }[]).map((r) => {
    const pr = proyectos.find((x) => x.id === r.proyecto_id);
    const ctx = { proyectoId: r.proyecto_id, portafolioId: pr?.portafolio_id ?? null };
    return {
      proyecto_id: r.proyecto_id,
      nivel: nivelDeRiesgo(r.score, {
        critico: numeroParametro(parametros, "riesgo_critico_min", ctx, CORTES_RIESGO.critico),
        alto: numeroParametro(parametros, "riesgo_alto_min", ctx, CORTES_RIESGO.alto),
        medio: numeroParametro(parametros, "riesgo_medio_min", ctx, CORTES_RIESGO.medio),
      }),
    };
  });
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
    proyectos,
    parametros,
    gerentes: new Map(((g.data ?? []) as { proyecto_id: string; usuario_id: string }[]).map((x) => [x.proyecto_id, x.usuario_id])),
    entrada: { mediciones, parametros, riesgosActivos, cambiosPendientes, ultimosReportes: reportes, hitosVencidos: (hv.data ?? []) as HitoVencido[],
      proyectosConReporteSemana: rp.error ? null : reportes.filter((r) => r.anio === sem.anio && r.semana === sem.semana).map((r) => r.proyecto_id) },
  };
}

// Datos para los KPIs de gestión. `proyectos` limita a ciertos proyectos (vacío = todos los visibles).
export async function cargarDatosKpi(supabase: SupabaseClient, proyectos?: string[]): Promise<DatosKpi> {
  const lee = async <T,>(tabla: string, columnas: string): Promise<T[]> => {
    let q = supabase.from(tabla).select(columnas);
    if (proyectos?.length) q = q.in("proyecto_id", proyectos);
    const { data } = await q.limit(10000);
    return (data ?? []) as T[];
  };
  const [hitos, riesgos, cambios, reuniones, evaluaciones, reportes] = await Promise.all([
    lee<DatosKpi["hitos"][number]>("hitos", "proyecto_id, fecha_plan, fecha_real, cancelado"),
    lee<DatosKpi["riesgos"][number]>("riesgos", "proyecto_id, score, plan_accion, estado, creado_en"),
    lee<DatosKpi["cambios"][number]>("cambios", "proyecto_id, detectado_sin_formato, fecha_solicitud"),
    lee<DatosKpi["reuniones"][number]>("reuniones", "proyecto_id, fecha, tiene_acta"),
    lee<DatosKpi["evaluaciones"][number]>("evaluaciones_patrocinador", "proyecto_id, mes, puntaje"),
    lee<DatosKpi["reportes"][number]>("reportes_semanales", "proyecto_id, fecha_reporte, enviado_en"),
  ]);
  return { hitos, riesgos, cambios, reuniones, evaluaciones, reportes };
}
