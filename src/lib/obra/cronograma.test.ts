import { describe, expect, it } from "vitest";
import { avanceFisico, planificadoDesdeCronograma, planificadoPct, semanasHastaMes, semanasTranscurridas, sumaPesos, type Tarea } from "./cronograma";

const t = (nombre: string, ini: number, dur: number, peso: number, av: number, ver: number | null = null): Tarea =>
  ({ id: nombre, nombre, semana_inicio: ini, duracion_semanas: dur, peso_pct: peso, avance_pct: av, avance_verificado_pct: ver });

describe("caso 13.2 — avance físico", () => {
  const tareas = [t("Preliminares", 1, 2, 3, 100), t("Cimentación", 3, 4, 17, 100), t("Estructura", 7, 10, 30, 30), t("Resto", 17, 20, 50, 0)];
  it("3 + 17 + 9 = 29 %", () => {
    expect(avanceFisico(tareas).reportado).toBe(29);
    expect(sumaPesos(tareas)).toBe(100);
  });
  it("caso 13.10: Estructura verificada en 20 % → 26 %; diferencia 3 puntos; EV con verificado", () => {
    const v = avanceFisico([...tareas.slice(0, 2), t("Estructura", 7, 10, 30, 30, 20), tareas[3]]);
    expect(v.reportado).toBe(29);
    expect(v.verificado).toBe(26);
    expect(v.diferencia).toBe(3);
    expect(v.hayVerificado).toBe(true);
    expect(v.usado).toBe(26);
    expect(avanceFisico([...tareas.slice(0, 2), t("Estructura", 7, 10, 30, 30, 20), tareas[3]], false).usado).toBe(29);
    // EV sobre BAC 1.000.000.000
    expect(Math.round((1_000_000_000 * v.usado) / 100)).toBe(260_000_000);
    expect(Math.round((1_000_000_000 * v.reportado) / 100)).toBe(290_000_000);
  });
  it("pesos con decimales sumados sin errores de coma flotante", () => {
    const x = [t("a", 1, 1, 33.3333, 100), t("b", 1, 1, 33.3333, 100), t("c", 1, 1, 33.3334, 100)];
    expect(avanceFisico(x).reportado).toBe(100);
    expect(sumaPesos(x)).toBe(100);
  });
  it("sin tareas", () => {
    expect(avanceFisico([]).reportado).toBe(0);
  });
});

describe("planificado", () => {
  it("fórmula del libro: peso × mín(1, máx(0, (k − inicio) / duración))", () => {
    const x = [t("a", 1, 10, 100, 0)];
    expect(planificadoPct(x, 0)).toBe(0);
    expect(planificadoPct(x, 4)).toBe(40);
    expect(planificadoPct(x, 10)).toBe(100);
    expect(planificadoPct(x, 99)).toBe(100);
  });
  it("una tarea que empieza en la semana 5 no cuenta antes", () => {
    const x = [t("a", 1, 4, 50, 0), t("b", 5, 4, 50, 0)];
    expect(planificadoPct(x, 4)).toBe(50);
    expect(planificadoPct(x, 6)).toBe(75);
  });
  it("semanas transcurridas y por mes", () => {
    expect(semanasTranscurridas("2026-01-01", "2026-01-29")).toBe(4);
    expect(semanasTranscurridas("2026-01-10", "2026-01-01")).toBe(0);
    expect(semanasHastaMes("2026-01-01", 1)).toBeCloseTo(31 / 7, 6);
  });
  it("curva S desde el cronograma: costo total × planificado", () => {
    const f = planificadoDesdeCronograma(1_000_000_000n * 1_000_000n, [t("a", 1, 52, 100, 0)], "2026-01-01");
    expect(f(0)).toBe(0n);
    const m12 = f(12);
    expect(m12 > 900_000_000n * 1_000_000n).toBe(true); // 12 meses ≈ 52,14 semanas → 100 %
  });
});
