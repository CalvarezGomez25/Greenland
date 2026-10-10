import { describe, expect, it } from "vitest";
import { calcularEvm, razon, sumarEvm } from "./evm";

const M = (millones: number) => BigInt(Math.round(millones * 1_000_000)) * 100n; // millones de COP → centavos

describe("EVM — caso 13.3", () => {
  const r = calcularEvm({ bac: M(1000), pv: M(400), ev: M(360), ac: M(400) });
  it("SPI, CPI, SV y CV", () => {
    expect(r.spi).toBe(0.9);
    expect(r.cpi).toBe(0.9);
    expect(r.sv).toBe(-M(40));
    expect(r.cv).toBe(-M(40));
  });
  it("EAC, ETC y VAC (1.111.111.111 / 711.111.111 / −111.111.111 pesos)", () => {
    expect(r.eac! / 100n).toBe(1_111_111_111n);
    expect(r.etc! / 100n).toBe(711_111_111n);
    expect(r.vac! / 100n).toBe(-111_111_111n);
  });
  it("TCPI 1,0667 y avances 36 %, 40 %, 40 %", () => {
    expect(r.tcpi).toBeCloseTo(1.0667, 4);
    expect(r.avanceFisico).toBe(36);
    expect(r.avancePlan).toBe(40);
    expect(r.avanceFinanciero).toBe(40);
  });
});

describe("EVM — caso 13.4 (portafolio)", () => {
  const A = { bac: M(1000), pv: M(400), ev: M(360), ac: M(400) };
  const B = { bac: M(600), pv: M(300), ev: M(285), ac: M(290) };
  const C = { bac: M(800), pv: M(200), ev: M(150), ac: M(210) };
  it("índices por proyecto", () => {
    expect(calcularEvm(B).spi).toBe(0.95);
    expect(calcularEvm(B).cpi).toBeCloseTo(0.9828, 4);
    expect(calcularEvm(C).spi).toBe(0.75);
    expect(calcularEvm(C).cpi).toBeCloseTo(0.7143, 4);
  });
  it("el portafolio suma primero: SPI = CPI = 0,8833 (no el promedio 0,8667)", () => {
    const t = sumarEvm([A, B, C]);
    expect(t.bac).toBe(M(2400));
    expect(t.pv).toBe(M(900));
    const r = calcularEvm(t);
    expect(r.spi).toBeCloseTo(0.8833, 4);
    expect(r.cpi).toBeCloseTo(0.8833, 4);
    const promedio = (0.9 + 0.95 + 0.75) / 3;
    expect(promedio).toBeCloseTo(0.8667, 4);
    expect(r.spi).not.toBeCloseTo(promedio, 3);
  });
});

describe("EVM — bordes", () => {
  it("sin datos no hay índices ni división por cero", () => {
    const r = calcularEvm({ bac: 0n, pv: 0n, ev: 0n, ac: 0n });
    expect(r.spi).toBeNull();
    expect(r.cpi).toBeNull();
    expect(r.eac).toBeNull();
    expect(r.tcpi).toBeNull();
    expect(r.avanceFisico).toBeNull();
  });
  it("gasto sin avance: CPI 0 y EAC indefinido", () => {
    const r = calcularEvm({ bac: M(100), pv: M(10), ev: 0n, ac: M(5) });
    expect(r.cpi).toBe(0);
    expect(r.eac).toBeNull();
  });
  it("TCPI no definido cuando BAC ≤ AC", () => {
    expect(calcularEvm({ bac: M(100), pv: M(100), ev: M(90), ac: M(100) }).tcpi).toBeNull();
  });
  it("razon", () => {
    expect(razon(1n, 3n)).toBe(0.3333);
    expect(razon(1n, 0n)).toBeNull();
  });
});
