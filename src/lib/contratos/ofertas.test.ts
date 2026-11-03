import { describe, expect, it } from "vitest";
import { calcularOfertas, semaforoProceso, type OfertaEntrada, type PesosOferta } from "./ofertas";

const PESOS: PesosOferta = { precio: 0.4, criterios: [0.15, 0.15, 0.1, 0.1, 0.1] };
const HOY = "2026-11-03";
const of = (id: string, valor: number | null, extra: Partial<OfertaEntrada> = {}): OfertaEntrada => ({
  id, ronda: 1, estado: "recibida", habilitada: "si", valor: valor === null ? null : BigInt(valor) * 100n, criterios: [null, null, null, null, null], vigenciaHasta: null, ...extra,
});

describe("calcularOfertas", () => {
  it("puntaje de precio: 100 × menor ÷ valor, a un decimal (caso del plan: 100,0; 52,9; 42,6)", () => {
    const r = calcularOfertas([of("a", 1_000_000), of("b", 1_890_000), of("c", 2_347_000)], null, PESOS, HOY, 30);
    expect([r.get("a")?.precio, r.get("b")?.precio, r.get("c")?.precio]).toEqual([100, 52.9, 42.6]);
  });
  it("las descartadas y las de valor cero no cuentan para el menor valor ni reciben precio", () => {
    const r = calcularOfertas([of("a", 500_000, { estado: "descartada" }), of("b", 1_000_000), of("c", 0), of("d", null)], null, PESOS, HOY, 30);
    expect(r.get("a")?.precio).toBeNull();
    expect(r.get("b")?.precio).toBe(100);
    expect(r.get("c")?.precio).toBeNull();
    expect(r.get("d")?.precio).toBeNull();
  });
  it("cada ronda tiene su propio menor valor", () => {
    const r = calcularOfertas([of("a", 1_000_000), of("b", 800_000, { ronda: 2 }), of("c", 1_000_000, { ronda: 2 })], null, PESOS, HOY, 30);
    expect(r.get("a")?.precio).toBe(100);
    expect(r.get("c")?.precio).toBe(80);
  });
  it("puntaje cualitativo: promedio ponderado de 1 a 5 llevado a 100; exige los cinco criterios", () => {
    const r = calcularOfertas([of("a", 1_000_000, { criterios: [5, 4, 4, 3, 5] }), of("b", 1_000_000, { criterios: [5, 5, 5, 5, null] }), of("c", 1_000_000, { criterios: [5, 5, 5, 5, 5] })], null, PESOS, HOY, 30);
    // (5×.15 + 4×.15 + 4×.10 + 3×.10 + 5×.10) / .60 / 5 × 100 = 2,55 / .6 / 5 × 100 = 85,0
    expect(r.get("a")?.cualitativo).toBe(85);
    expect(r.get("b")?.cualitativo).toBeNull();
    expect(r.get("c")?.cualitativo).toBe(100);
  });
  it("puntaje total = precio × peso + cualitativo × (1 − peso); sin habilitar no recibe total", () => {
    const r = calcularOfertas([
      of("a", 1_000_000, { criterios: [5, 4, 4, 3, 5] }), of("b", 2_000_000, { criterios: [5, 5, 5, 5, 5] }),
      of("c", 1_000_000, { criterios: [5, 5, 5, 5, 5], habilitada: "no" }), of("d", 1_000_000, { criterios: [5, 5, 5, 5, 5], habilitada: null }),
    ], null, PESOS, HOY, 30);
    expect(r.get("a")?.total).toBe(91.0); // 100×.4 + 85×.6
    expect(r.get("b")?.total).toBe(80.0); // 50×.4 + 100×.6
    expect(r.get("c")?.total).toBeNull();
    expect(r.get("d")?.total).toBe(100.0); // habilitada sin definir no bloquea el total (solo «no»)
  });
  it("orden en la ronda: primero las que tienen total y luego, por precio, las que no", () => {
    const r = calcularOfertas([
      of("a", 1_000_000, { criterios: [5, 4, 4, 3, 5] }), of("b", 2_000_000, { criterios: [5, 5, 5, 5, 5] }),
      of("c", 1_500_000), of("d", 3_000_000),
    ], null, PESOS, HOY, 30);
    expect([r.get("a")?.orden, r.get("b")?.orden]).toEqual([1, 2]);
    expect([r.get("c")?.orden, r.get("d")?.orden]).toEqual([3, 4]); // sin total: van después de las que tienen total, por precio (c 66,7; d 33,3)
  });
  it("diferencias frente al menor valor y frente al presupuesto de referencia", () => {
    const r = calcularOfertas([of("a", 1_000_000), of("b", 1_250_000)], 2_000_000n * 100n, PESOS, HOY, 30);
    expect(r.get("b")?.difMenor).toBe(0.25);
    expect(r.get("a")?.difPresupuesto).toBe(-0.5);
  });
  it("vigencia de la oferta: rojo vencida, ámbar por vencer, verde; solo recibidas o en aclaración", () => {
    const v = (f: string | null, estado: OfertaEntrada["estado"] = "recibida") => calcularOfertas([of("a", 1, { vigenciaHasta: f, estado })], null, PESOS, HOY, 30).get("a")?.vigencia;
    expect(v("2026-11-02")).toBe("rojo");
    expect(v("2026-12-03")).toBe("ambar");
    expect(v("2026-12-04")).toBe("verde");
    expect(v(null)).toBeNull();
    expect(v("2020-01-01", "descartada")).toBeNull();
  });
});

describe("semaforoProceso", () => {
  const p = (estado: Parameters<typeof semaforoProceso>[0]["estado"], cierre: string | null = null, contratoId: string | null = null) => semaforoProceso({ estado, cierre, contratoId }, HOY, 15);
  it("abierto", () => {
    expect(p("abierta", null).nivel).toBe("ambar");
    expect(p("abierta", "2026-11-02").nivel).toBe("rojo");
    expect(p("abierta", "2026-11-10").nivel).toBe("ambar"); // 7 días
    expect(p("abierta", "2026-11-11").nivel).toBe("verde"); // 8 días
    expect(p("abierta", HOY).alerta).toBe("Las propuestas cierran hoy");
  });
  it("en evaluación: ámbar pasado el 70 % y rojo pasados los días", () => {
    expect(p("en_evaluacion", "2026-10-24").nivel).toBe("verde"); // 10 días
    expect(p("en_evaluacion", "2026-10-23").nivel).toBe("ambar"); // 11 días > 10,5
    expect(p("en_evaluacion", "2026-10-19").nivel).toBe("ambar"); // 15 días justos
    expect(p("en_evaluacion", "2026-10-18").nivel).toBe("rojo"); // 16 días
  });
  it("adjudicado sin contrato = ámbar; con contrato = verde; por confirmar = ámbar; cerrados sin semáforo", () => {
    expect(p("adjudicada").nivel).toBe("ambar");
    expect(p("adjudicada", null, "c1").nivel).toBe("verde");
    expect(p("por_confirmar").nivel).toBe("ambar");
    expect(p("desierta").nivel).toBeNull();
    expect(p("cancelada").nivel).toBeNull();
    expect(p("en_preparacion").nivel).toBeNull();
  });
});
