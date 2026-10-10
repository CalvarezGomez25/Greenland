import { describe, expect, it } from "vitest";
import { calcularActa, resumenContrato, type ContratoBase } from "./contratos";

const cop = (n: number) => BigInt(n) * 100n; // pesos → centavos
const contrato: ContratoBase = { valor: cop(480_000_000), anticipoPct: 20, anticipoValor: cop(96_000_000), retencionPct: 10 };

describe("caso 13.1 — contrato de 480.000.000, anticipo 20 %, retención 10 %", () => {
  const a1 = calcularActa(contrato, [], cop(120_000_000));
  const a2 = calcularActa(contrato, [a1], cop(150_000_000));
  it("acta 1: amortización 24 M, retención 12 M, neto 84 M", () => {
    expect(a1).toEqual({ valorBruto: cop(120_000_000), amortizacion: cop(24_000_000), retencion: cop(12_000_000), neto: cop(84_000_000) });
  });
  it("acta 2: amortización 30 M, retención 15 M, neto 105 M", () => {
    expect(a2).toEqual({ valorBruto: cop(150_000_000), amortizacion: cop(30_000_000), retencion: cop(15_000_000), neto: cop(105_000_000) });
  });
  it("totales 270 M / 54 M / 27 M / 189 M; anticipo pendiente 42 M; desembolsado 285 M", () => {
    const r = resumenContrato(contrato, [a1, a2], false);
    expect(r.facturado).toBe(cop(270_000_000));
    expect(r.amortizado).toBe(cop(54_000_000));
    expect(r.retenido).toBe(cop(27_000_000));
    expect(r.neto).toBe(cop(189_000_000));
    expect(r.anticipoPendiente).toBe(cop(42_000_000));
    expect(r.desembolsado).toBe(cop(285_000_000));
    expect(r.saldoPorEjecutar).toBe(cop(210_000_000));
    expect(r.ejecutadoPct).toBe(56.25);
    expect(r.completo).toBe(false);
  });
  it("la retención liberada se suma a lo desembolsado", () => {
    const r = resumenContrato(contrato, [a1, a2], true);
    expect(r.desembolsado).toBe(cop(285_000_000 + 27_000_000));
  });
});

describe("reglas del anticipo", () => {
  it("nunca se amortiza más que el anticipo pendiente", () => {
    const c: ContratoBase = { valor: cop(1_000_000_000), anticipoPct: 20, anticipoValor: cop(200_000_000), retencionPct: 10 };
    const a1 = calcularActa(c, [], cop(900_000_000));
    expect(a1.amortizacion).toBe(cop(180_000_000));
    const a2 = calcularActa(c, [a1], cop(100_000_000));
    expect(a2.amortizacion).toBe(cop(20_000_000));
    const a3 = calcularActa(c, [a1, a2], cop(1_000));
    expect(a3.amortizacion).toBe(0n);
    expect(resumenContrato(c, [a1, a2], false).completo).toBe(true);
  });
  it("sin anticipo: no se amortiza; el neto es bruto − retención", () => {
    const c: ContratoBase = { valor: cop(100), anticipoPct: 0, anticipoValor: 0n, retencionPct: 10 };
    expect(calcularActa(c, [], cop(100))).toEqual({ valorBruto: cop(100), amortizacion: 0n, retencion: cop(10), neto: cop(90) });
  });
  it("redondeo al centavo", () => {
    const c: ContratoBase = { valor: cop(1000), anticipoPct: 0, anticipoValor: 0n, retencionPct: 8 };
    const a = calcularActa(c, [], 1_234_56n); // 1.234,56
    expect(a.retencion).toBe(9_876n); // 98,7648 → 98,76
    expect(a.neto).toBe(a.valorBruto - a.retencion);
  });
});
