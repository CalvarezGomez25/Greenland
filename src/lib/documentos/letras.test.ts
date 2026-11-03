import { describe, expect, it } from "vitest";
import { cantidadConLetras, fechaEnLetras, numeroALetras, pesosEnLetras } from "./letras";

describe("numeroALetras", () => {
  it("números pequeños y compuestos", () => {
    const c: [number, string][] = [[0, "cero"], [1, "uno"], [15, "quince"], [16, "dieciséis"], [21, "veintiuno"], [30, "treinta"], [31, "treinta y uno"], [99, "noventa y nueve"], [100, "cien"], [101, "ciento uno"], [250, "doscientos cincuenta"], [999, "novecientos noventa y nueve"]];
    for (const [n, t] of c) expect(numeroALetras(BigInt(n))).toBe(t);
  });
  it("miles y millones", () => {
    const c: [number, string][] = [[1000, "mil"], [1001, "mil uno"], [2000, "dos mil"], [21000, "veintiún mil"], [100000, "cien mil"], [1_000_000, "un millón"], [1_000_001, "un millón uno"], [2_500_000, "dos millones quinientos mil"], [21_000_000, "veintiún millones"], [1_000_000_000, "mil millones"], [1_906_548_000, "mil novecientos seis millones quinientos cuarenta y ocho mil"], [12_000_000_000, "doce mil millones"], [1_000_000_000_000, "un billón"]];
    for (const [n, t] of c) expect(numeroALetras(BigInt(n))).toBe(t);
  });
  it("con sustantivo, «uno» y «veintiuno» se apocopan al final", () => {
    expect(numeroALetras(1n, true)).toBe("un");
    expect(numeroALetras(21n, true)).toBe("veintiún");
    expect(numeroALetras(31n, true)).toBe("treinta y un");
    expect(numeroALetras(1_000_001n, true)).toBe("un millón un");
  });
  it("rechaza lo demasiado grande", () => {
    expect(() => numeroALetras(10n ** 18n)).toThrow();
  });
});

describe("pesosEnLetras y fechas", () => {
  it("pesos", () => {
    expect(pesosEnLetras(1_906_548_000n)).toBe("Mil novecientos seis millones quinientos cuarenta y ocho mil pesos colombianos");
    expect(pesosEnLetras(2_000_000n)).toBe("Dos millones de pesos colombianos");
    expect(pesosEnLetras(1_500n)).toBe("Mil quinientos pesos colombianos");
    expect(pesosEnLetras(21n)).toBe("Veintiún pesos colombianos");
  });
  it("fecha en letras", () => {
    expect(fechaEnLetras("2026-11-03")).toBe("3 de noviembre de 2026");
    expect(fechaEnLetras("2026-01-15T00:00:00Z")).toBe("15 de enero de 2026");
    expect(fechaEnLetras(null)).toBeNull();
    expect(fechaEnLetras("2026-13-01")).toBeNull();
  });
  it("cantidad con letras", () => {
    expect(cantidadConLetras(8, "meses")).toBe("ocho (8) meses");
    expect(cantidadConLetras(30, "días calendario")).toBe("treinta (30) días calendario");
    expect(cantidadConLetras(1, "mes")).toBe("un (1) mes");
  });
});
