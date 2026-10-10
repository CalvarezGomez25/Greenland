import { describe, expect, it } from "vitest";
import { calcularKpis, limiteReporte, ultimosMeses, type DatosKpi } from "./kpis";

const vacio: DatosKpi = { hitos: [], riesgos: [], cambios: [], reuniones: [], evaluaciones: [], reportes: [] };
const o = { hoy: "2026-10-09", parametros: [] };
const k = (d: Partial<DatosKpi>, clave: string) => calcularKpis({ ...vacio, ...d }, o).find((s) => s.clave === clave)!;
const actual = (d: Partial<DatosKpi>, clave: string) => k(d, clave).actual;

describe("KPIs de gestión", () => {
  it("devuelve los seis, con metas del libro", () => {
    const s = calcularKpis(vacio, o);
    expect(s.map((x) => [x.clave, x.meta])).toEqual([["hitos", 90], ["riesgos", 100], ["cambios", 85], ["reuniones", 100], ["satisfaccion", 4], ["reportes", 100]]);
    expect(s.every((x) => x.actual === null && x.puntos.length === 6)).toBe(true);
  });
  it("hitos: terminados a tiempo / planificados del mes; los futuros no cuentan", () => {
    const hitos = [
      { proyecto_id: "a", fecha_plan: "2026-10-02", fecha_real: "2026-10-01", cancelado: false },
      { proyecto_id: "a", fecha_plan: "2026-10-05", fecha_real: "2026-10-07", cancelado: false }, // tarde
      { proyecto_id: "a", fecha_plan: "2026-10-08", fecha_real: null, cancelado: false },        // vencido
      { proyecto_id: "a", fecha_plan: "2026-10-20", fecha_real: null, cancelado: false },        // futuro: no cuenta
      { proyecto_id: "a", fecha_plan: "2026-10-03", fecha_real: null, cancelado: true },         // cancelado: no cuenta
    ];
    const s = k({ hitos }, "hitos");
    expect(s.puntos[5]).toMatchObject({ num: 1, den: 3 });
    expect(s.actual).toBe(33.3);
    expect(s.cumple).toBe(false);
  });
  it("riesgos: críticos activos con plan", () => {
    const r = (score: number, plan: string | null, estado = "activo") => ({ proyecto_id: "a", score, plan_accion: plan, estado, creado_en: "2026-01-10T00:00:00Z" });
    expect(actual({ riesgos: [r(15, "Plan"), r(16, null), r(12, null), r(20, "Plan", "cerrado")] }, "riesgos")).toBe(50);
    expect(actual({ riesgos: [r(15, "Plan"), r(20, "Otro plan")] }, "riesgos")).toBe(100);
    expect(actual({ riesgos: [r(12, null)] }, "riesgos")).toBeNull();
  });
  it("cambios controlados: acumulado hasta cada mes (P3: 'detectado sin formato')", () => {
    const c = (f: string, sin = false) => ({ proyecto_id: "a", fecha_solicitud: f, detectado_sin_formato: sin });
    const s = k({ cambios: [c("2026-05-01"), c("2026-06-01"), c("2026-09-01", true), c("2026-09-15")] }, "cambios");
    expect(s.actual).toBe(75);
    expect(s.puntos.find((p) => p.mes === "2026-07")?.valor).toBe(100);
    expect(s.tendencia).toBe("igual");
  });
  it("reuniones con acta del mes", () => {
    const m = (f: string, a: boolean) => ({ proyecto_id: "a", fecha: f, tiene_acta: a });
    expect(actual({ reuniones: [m("2026-10-01", true), m("2026-10-05", false), m("2026-09-01", true)] }, "reuniones")).toBe(50);
  });
  it("satisfacción: promedio del mes con 1 decimal; tendencia", () => {
    const e = (mes: string, p: number) => ({ proyecto_id: "a", mes, puntaje: p });
    const s = k({ evaluaciones: [e("2026-09-01", 3), e("2026-10-01", 5), e("2026-10-01", 4)] }, "satisfaccion");
    expect(s.actual).toBe(4.5);
    expect(s.tendencia).toBe("sube");
    expect(s.cumple).toBe(true);
  });
  it("reportes a tiempo: enviado hasta el domingo de la semana + gracia", () => {
    // 2026-10-05 (lunes) → semana termina el 2026-10-11; con 2 días de gracia: 2026-10-13
    expect(limiteReporte("2026-10-07", 2)).toBe("2026-10-13");
    const r = (f: string, env: string | null) => ({ proyecto_id: "a", fecha_reporte: f, enviado_en: env });
    const s = k({ reportes: [r("2026-09-02", "2026-09-04T10:00:00Z"), r("2026-09-09", "2026-09-20T10:00:00Z"), r("2026-09-16", null), r("2026-09-23", "2026-09-27T10:00:00Z")] }, "reportes");
    expect(s.puntos.find((p) => p.mes === "2026-09")).toMatchObject({ num: 2, den: 4, valor: 50 });
  });
  it("las metas son parámetros", () => {
    const s = calcularKpis({ ...vacio, reuniones: [{ proyecto_id: "a", fecha: "2026-10-01", tiene_acta: true }, { proyecto_id: "a", fecha: "2026-10-02", tiene_acta: false }] },
      { ...o, parametros: [{ ambito: "global", ambito_id: null, clave: "kpi_reuniones_con_acta", valor: "50" }] });
    const r = s.find((x) => x.clave === "reuniones")!;
    expect(r.meta).toBe(50);
    expect(r.cumple).toBe(true);
  });
  it("meses", () => {
    expect(ultimosMeses("2026-02", 3)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });
});
