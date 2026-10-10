import { describe, expect, it } from "vitest";
import { diasDesde, nivelCambio, quienAprueba, siguienteEstado } from "./cambios";

const cop = (n: number) => BigInt(n) * 100n; // pesos → centavos
const contrato = cop(480_000_000);
const e = (impacto: number, extra = {}) => ({ impactoCosto: cop(impacto), base: contrato, dias: 0, ligadoAContrato: true, ...extra });

describe("caso 13.8 — cambios sobre un contrato de 480.000.000", () => {
  it("8.000.000 → 1,67 % Menor, sin firma", () => {
    const r = nivelCambio(e(8_000_000));
    expect(r.nivel).toBe("menor");
    expect(r.variacionPct).toBeCloseTo(1.6667, 4);
    expect(r.requiereFirma).toBe(false);
  });
  it("12.000.000 → 2,50 % Moderado, sin firma", () => {
    const r = nivelCambio(e(12_000_000));
    expect(r.nivel).toBe("moderado");
    expect(r.variacionPct).toBe(2.5);
    expect(r.requiereFirma).toBe(false);
  });
  it("30.000.000 → 6,25 % Crítico, con firma del patrocinador", () => {
    const r = nivelCambio(e(30_000_000));
    expect(r.nivel).toBe("critico");
    expect(r.variacionPct).toBe(6.25);
    expect(r.requiereFirma).toBe(true);
  });
  it("fronteras exactas: 2 % es Menor y 5 % es Moderado (sin firma)", () => {
    expect(nivelCambio(e(9_600_000)).nivel).toBe("menor");
    expect(nivelCambio(e(9_600_001)).nivel).toBe("moderado");
    expect(nivelCambio(e(24_000_000)).nivel).toBe("moderado");
    expect(nivelCambio(e(24_000_000)).requiereFirma).toBe(false);
    expect(nivelCambio(e(24_000_001)).nivel).toBe("critico");
    expect(nivelCambio(e(24_000_001)).requiereFirma).toBe(true);
  });
  it("un ahorro se mide en valor absoluto", () => {
    expect(nivelCambio(e(-30_000_000)).nivel).toBe("critico");
  });
  it("cambio de plazo ligado a un contrato es Crítico aunque no cueste; sin contrato no", () => {
    expect(nivelCambio(e(0, { dias: 15 })).nivel).toBe("critico");
    expect(nivelCambio(e(0, { dias: 15, ligadoAContrato: false })).nivel).toBe("menor");
  });
  it("sin base no se puede calcular; los cortes son parámetros", () => {
    expect(nivelCambio({ impactoCosto: cop(1000), base: null, dias: 0, ligadoAContrato: false }).nivel).toBeNull();
    expect(nivelCambio(e(8_000_000), { menorMax: 1, moderadoMax: 3, firmaPct: 3 }).nivel).toBe("moderado");
  });
});

describe("aprobación por nivel (decisión del usuario)", () => {
  const pars = [
    { ambito: "global", ambito_id: null, clave: "cambio_aprobador_menor", valor: "gerente" },
    { ambito: "global", ambito_id: null, clave: "cambio_aprobador_moderado", valor: "director_general" },
    { ambito: "global", ambito_id: null, clave: "cambio_aprobador_critico", valor: "director_general" },
  ];
  it("menor: gerente; moderado y crítico: director general", () => {
    expect(quienAprueba("menor", pars)).toBe("gerente");
    expect(quienAprueba("moderado", pars)).toBe("director_general");
    expect(quienAprueba("critico", pars)).toBe("director_general");
  });
  it("la regla es configurable", () => {
    expect(quienAprueba("menor", [{ ambito: "global", ambito_id: null, clave: "cambio_aprobador_menor", valor: "director_general" }])).toBe("director_general");
  });
});

describe("flujo", () => {
  it("las 8 fases en orden", () => {
    expect(siguienteEstado("identificado")).toBe("radicado");
    expect(siguienteEstado("analisis_impacto")).toBe("aprobacion");
    expect(siguienteEstado("aprobacion")).toBeNull();
    expect(siguienteEstado("rechazado")).toBe("cerrado");
    expect(siguienteEstado("cerrado")).toBeNull();
  });
  it("antigüedad en días", () => {
    expect(diasDesde("2026-10-01T00:00:00Z", new Date("2026-10-09T12:00:00Z"))).toBe(8);
    expect(diasDesde(null)).toBeNull();
  });
});
