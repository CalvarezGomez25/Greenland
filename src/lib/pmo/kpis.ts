// Los seis KPIs de gestión del gerente (mensuales, con tendencia). Especificación, módulo G.
// Se calculan a partir de los registros; nada se digita salvo la satisfacción del patrocinador.
//
// Definiciones adoptadas (a validar con el uso):
//  - Cumplimiento de hitos: de los hitos con fecha plan en el mes (y ya vencida o cumplida), los que se
//    terminaron en o antes de su fecha plan.
//  - Gestión de riesgos: riesgos críticos activos con plan de acción / total de riesgos críticos activos.
//    Sin historial de cambios de estado: cada mes usa el estado actual de los riesgos creados hasta ese mes.
//  - Cambios controlados: cambios con formato / total de cambios solicitados hasta el fin de ese mes.
//  - Reuniones con acta: reuniones del mes con acta / total de reuniones del mes.
//  - Satisfacción del patrocinador: promedio de los puntajes del mes (1 a 5).
//  - Reportes a tiempo: de los reportes de semanas del mes, los enviados hasta el domingo de su semana + días de gracia.

import type { FilaParametro } from "./parametros";
import { numeroParametro } from "./parametros";

export type DatosKpi = {
  hitos: { proyecto_id: string; fecha_plan: string; fecha_real: string | null; cancelado: boolean }[];
  riesgos: { proyecto_id: string; score: number; plan_accion: string | null; estado: string; creado_en: string }[];
  cambios: { proyecto_id: string; detectado_sin_formato: boolean; fecha_solicitud: string }[];
  reuniones: { proyecto_id: string; fecha: string; tiene_acta: boolean }[];
  evaluaciones: { proyecto_id: string; mes: string; puntaje: number }[];
  reportes: { proyecto_id: string; fecha_reporte: string; enviado_en: string | null }[];
};

export type PuntoKpi = { mes: string; valor: number | null; num: number; den: number };
export type SerieKpi = {
  clave: "hitos" | "riesgos" | "cambios" | "reuniones" | "satisfaccion" | "reportes";
  nombre: string;
  unidad: "%" | "puntos";
  meta: number;
  fuente: string;
  puntos: PuntoKpi[];
  actual: number | null;
  tendencia: "sube" | "baja" | "igual" | null;
  cumple: boolean | null;
};

export const mesDe = (iso: string) => iso.slice(0, 7);

export function ultimosMeses(hasta: string, n: number): string[] {
  const [a, m] = hasta.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(a, m - 1 - (n - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

const finDeMes = (mes: string): string => {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m, 0));
  return `${a}-${String(m).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
};

// Domingo de la semana (ISO) de una fecha + días de gracia.
export function limiteReporte(fechaReporte: string, gracia: number): string {
  const [a, m, d] = fechaReporte.split("-").map(Number);
  const f = new Date(Date.UTC(a, m - 1, d));
  const dia = f.getUTCDay() || 7;
  f.setUTCDate(f.getUTCDate() + (7 - dia) + gracia);
  return f.toISOString().slice(0, 10);
}

const pct = (num: number, den: number) => (den === 0 ? null : Math.round((num * 1000) / den) / 10);

export function calcularKpis(
  d: DatosKpi,
  o: { hoy: string; meses?: number; parametros: FilaParametro[]; contexto?: { proyectoId?: string | null; portafolioId?: string | null } },
): SerieKpi[] {
  const meses = ultimosMeses(mesDe(o.hoy), o.meses ?? 6);
  const ctx = o.contexto ?? {};
  const meta = (k: string, r: number) => numeroParametro(o.parametros, k, ctx, r);
  const critico = numeroParametro(o.parametros, "riesgo_critico_min", ctx, 15);
  const gracia = Math.round(numeroParametro(o.parametros, "reporte_dias_gracia", ctx, 2));
  const corte = (mes: string) => (finDeMes(mes) < o.hoy ? finDeMes(mes) : o.hoy);

  const serie = (
    clave: SerieKpi["clave"], nombre: string, unidad: SerieKpi["unidad"], m: number, fuente: string,
    f: (mes: string) => { num: number; den: number; valor: number | null },
  ): SerieKpi => {
    const puntos = meses.map((mes) => ({ mes, ...f(mes) }));
    const conValor = puntos.filter((p) => p.valor !== null);
    const actual = conValor.length ? (conValor[conValor.length - 1].valor as number) : null;
    const previo = conValor.length > 1 ? (conValor[conValor.length - 2].valor as number) : null;
    return {
      clave, nombre, unidad, meta: m, fuente, puntos, actual,
      tendencia: actual === null || previo === null ? null : actual > previo ? "sube" : actual < previo ? "baja" : "igual",
      cumple: actual === null ? null : actual >= m,
    };
  };

  return [
    serie("hitos", "Cumplimiento de hitos", "%", meta("kpi_hitos_min", 90), "Hitos", (mes) => {
      const plan = d.hitos.filter((h) => !h.cancelado && mesDe(h.fecha_plan) === mes && h.fecha_plan <= o.hoy);
      const num = plan.filter((h) => h.fecha_real !== null && h.fecha_real <= h.fecha_plan).length;
      return { num, den: plan.length, valor: pct(num, plan.length) };
    }),
    serie("riesgos", "Gestión de riesgos", "%", meta("kpi_riesgos_con_plan", 100), "Riesgos", (mes) => {
      const c = corte(mes);
      const crit = d.riesgos.filter((r) => r.estado === "activo" && r.score >= critico && r.creado_en.slice(0, 10) <= c);
      const num = crit.filter((r) => (r.plan_accion ?? "").trim() !== "").length;
      return { num, den: crit.length, valor: pct(num, crit.length) };
    }),
    serie("cambios", "Cambios controlados", "%", meta("kpi_cambios_controlados_min", 85), "Cambios", (mes) => {
      const c = corte(mes);
      const todos = d.cambios.filter((x) => x.fecha_solicitud <= c);
      const num = todos.filter((x) => !x.detectado_sin_formato).length;
      return { num, den: todos.length, valor: pct(num, todos.length) };
    }),
    serie("reuniones", "Reuniones con acta", "%", meta("kpi_reuniones_con_acta", 100), "Reuniones", (mes) => {
      const r = d.reuniones.filter((x) => mesDe(x.fecha) === mes);
      const num = r.filter((x) => x.tiene_acta).length;
      return { num, den: r.length, valor: pct(num, r.length) };
    }),
    serie("satisfaccion", "Satisfacción del patrocinador", "puntos", meta("kpi_satisfaccion_min", 4), "Encuesta del patrocinador (captura manual)", (mes) => {
      const e = d.evaluaciones.filter((x) => mesDe(x.mes) === mes);
      const suma = e.reduce((s, x) => s + x.puntaje, 0);
      return { num: suma, den: e.length, valor: e.length ? Math.round((suma * 10) / e.length) / 10 : null };
    }),
    serie("reportes", "Reportes a tiempo", "%", meta("kpi_reportes_a_tiempo", 100), "Reportes semanales", (mes) => {
      const r = d.reportes.filter((x) => mesDe(x.fecha_reporte) === mes);
      const num = r.filter((x) => x.enviado_en !== null && x.enviado_en.slice(0, 10) <= limiteReporte(x.fecha_reporte, gracia)).length;
      return { num, den: r.length, valor: pct(num, r.length) };
    }),
  ];
}
