// Lectura de los datos del portafolio (con la sesión de quien consulta: las reglas de la base deciden qué ve).

import type { SupabaseClient } from "@supabase/supabase-js";
import { desdeJson } from "../presupuesto/dinero";
import { leerTodo } from "../presupuesto/paginar";
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

// Lee todas las filas por páginas (Supabase entrega como máximo 1.000 por consulta) sin lanzar errores:
// devuelve el error para que quien llama decida. Cada consulta debe traer un orden estable que desempate con "id".
type Consulta = { range(desde: number, hasta: number): PromiseLike<{ data: unknown[] | null; error: { message: string; code?: string } | null }> };
async function paginar<T>(armar: () => Consulta): Promise<{ data: T[] | null; error: Error | null }> {
  try {
    return { data: await leerTodo<T>((d, h) => armar().range(d, h) as never), error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e : new Error("Error de lectura") };
  }
}

export async function cargarDatosPortafolio(supabase: SupabaseClient): Promise<DatosCrudos & { error: boolean }> {
  const hoy = hoyColombia();
  await supabase.rpc("hallazgos_escalar_todos"); // los plazos vencidos pasan a Escalado antes de mostrar
  const [p, m, par, g, rs, cs, rp, hv, hz] = await Promise.all([
    supabase.from("proyectos").select(COLUMNAS_BASE).order("nombre"),
    paginar<Record<string, unknown>>(() => supabase.from("mediciones_evm").select("id, proyecto_id, fecha_corte, bac, pv, ev, ac").order("fecha_corte", { ascending: false }).order("id")),
    supabase.from("parametros").select("ambito, ambito_id, clave, valor"),
    supabase.from("miembros_proyecto").select("proyecto_id, usuario_id").eq("rol", "gerente"),
    paginar<Record<string, unknown>>(() => supabase.from("riesgos").select("id, proyecto_id, score").eq("estado", "activo").order("id")),
    paginar<Record<string, unknown>>(() => supabase.from("cambios").select("id, proyecto_id, nivel, estado_flujo, codigo, en_aprobacion_desde").not("estado_flujo", "in", "(cerrado,rechazado)").order("id")),
    paginar<Record<string, unknown>>(() => supabase.from("reportes_semanales").select("id, proyecto_id, anio, semana, estado_reportado, alertas, decisiones_requeridas").not("enviado_en", "is", null).order("anio", { ascending: false }).order("semana", { ascending: false }).order("id")),
    paginar<Record<string, unknown>>(() => supabase.from("hitos").select("id, proyecto_id, nombre, fecha_plan").is("fecha_real", null).eq("cancelado", false).lt("fecha_plan", hoy).order("fecha_plan").order("id")),
    paginar<Record<string, unknown>>(() => supabase.from("hallazgos").select("id, proyecto_id, severidad").eq("estado", "escalado").order("id")),
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
    entrada: { mediciones, parametros, riesgosActivos, cambiosPendientes, ultimosReportes: reportes, hitosVencidos: (hv.data ?? []) as HitoVencido[], hallazgosEscalados: (hz.data ?? []) as { proyecto_id: string; severidad: string }[],
      proyectosConReporteSemana: rp.error ? null : reportes.filter((r) => r.anio === sem.anio && r.semana === sem.semana).map((r) => r.proyecto_id) },
  };
}

// Datos para los KPIs de gestión. `proyectos` limita a ciertos proyectos (vacío = todos los visibles).
export async function cargarDatosKpi(supabase: SupabaseClient, proyectos?: string[]): Promise<DatosKpi> {
  const lee = async <T,>(tabla: string, columnas: string): Promise<T[]> => {
    const { data } = await paginar<T>(() => {
      let q = supabase.from(tabla).select(columnas);
      if (proyectos?.length) q = q.in("proyecto_id", proyectos);
      // orden estable para paginar: todas tienen proyecto_id; "id" desempata (evaluaciones usa su clave: proyecto_id + mes)
      return (tabla === "evaluaciones_patrocinador" ? q.order("proyecto_id").order("mes") : q.order("proyecto_id").order("id")) as unknown as Consulta;
    });
    return data ?? [];
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
