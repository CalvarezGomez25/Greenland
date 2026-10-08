import { describe, expect, it } from "vitest";
import {
  aEscalado,
  aTextoPunto,
  desdeJson,
  dividirRedondeado,
  formatearDecimal,
  formatearPesos,
  porcentajeDe,
} from "./dinero";

const pesos = (n: number | string) => BigInt(n) * 1_000_000n; // monto en escala 6

describe("aEscalado y desdeJson", () => {
  it("convierte texto con punto decimal sin errores de redondeo", () => {
    expect(aEscalado("1234.56", 2)).toBe(123456n);
    expect(aEscalado("0.1", 4) + aEscalado("0.2", 4)).toBe(aEscalado("0.3", 4)); // en decimales de JS sería 0.30000000000000004
    expect(aEscalado("5", 2)).toBe(500n);
    expect(aEscalado("-5.5", 2)).toBe(-550n);
  });

  it("ignora ceros finales y rechaza decimales de más", () => {
    expect(aEscalado("100.0000", 2)).toBe(10000n);
    expect(() => aEscalado("1.234", 2)).toThrow(RangeError);
  });

  it("rechaza texto que no es un número", () => {
    expect(() => aEscalado("abc", 2)).toThrow(RangeError);
    expect(() => aEscalado("1,5", 2)).toThrow(RangeError);
    expect(() => aEscalado("", 2)).toThrow(RangeError);
  });

  it("lee valores de la base de datos como número o como texto", () => {
    expect(desdeJson(1234.5, 2)).toBe(123450n);
    expect(desdeJson("1234.50", 2)).toBe(123450n);
    expect(desdeJson(0.0001, 4)).toBe(1n);
    expect(() => desdeJson(1e21, 2)).toThrow(RangeError);
    expect(() => desdeJson(Number.NaN, 2)).toThrow(RangeError);
  });

  it("falla en voz alta si un número trae más cifras de las que JavaScript conserva", () => {
    expect(desdeJson(123456789012.34, 2)).toBe(12345678901234n); // 14 cifras: seguro
    expect(desdeJson(123456789012345, 0)).toBe(123456789012345n); // 15 cifras: seguro
    expect(() => desdeJson(1234567890123456, 0)).toThrow(/precisión/); // 16 cifras
    expect(desdeJson("1234567890123456.78", 2)).toBe(123456789012345678n); // como texto sí es exacto
  });
});

describe("dividirRedondeado", () => {
  it("redondea la mitad hacia arriba y es simétrico en negativos", () => {
    expect(dividirRedondeado(5n, 2n)).toBe(3n);
    expect(dividirRedondeado(4n, 2n)).toBe(2n);
    expect(dividirRedondeado(1n, 3n)).toBe(0n);
    expect(dividirRedondeado(2n, 3n)).toBe(1n);
    expect(dividirRedondeado(-5n, 2n)).toBe(-3n);
  });

  it("no divide por cero", () => {
    expect(() => dividirRedondeado(1n, 0n)).toThrow(RangeError);
  });
});

describe("formatearPesos", () => {
  it("usa punto de miles y redondea a pesos", () => {
    expect(formatearPesos(pesos(1231970000))).toBe("1.231.970.000");
    expect(formatearPesos(0n)).toBe("0");
    expect(formatearPesos(pesos(999))).toBe("999");
    expect(formatearPesos(pesos(1000))).toBe("1.000");
  });

  it("redondea la mitad de un peso hacia arriba", () => {
    expect(formatearPesos(500_000n)).toBe("1");
    expect(formatearPesos(499_999n)).toBe("0");
  });

  it("maneja negativos", () => {
    expect(formatearPesos(-1_500_000n)).toBe("-2");
    expect(formatearPesos(-100n)).toBe("0"); // sin "-0"
  });
});

describe("formatearDecimal y aTextoPunto", () => {
  it("formatea al estilo colombiano", () => {
    expect(formatearDecimal(12345600n, 4)).toBe("1.234,56");
    expect(formatearDecimal(12000000n, 4)).toBe("1.200");
    expect(formatearDecimal(12000000n, 4, 2)).toBe("1.200,00");
    expect(formatearDecimal(5n, 4)).toBe("0,0005");
    expect(formatearDecimal(-250n, 2)).toBe("-2,5");
  });

  it("entrega texto con punto decimal para la base de datos", () => {
    expect(aTextoPunto(12345600n, 4)).toBe("1234.56");
    expect(aTextoPunto(12000000n, 4)).toBe("1200");
    expect(aTextoPunto(1n, 4)).toBe("0.0001");
  });

  it("ida y vuelta sin pérdida", () => {
    for (const t of ["0", "1", "1234.56", "0.0001", "99999999999999.9999"]) {
      expect(aTextoPunto(aEscalado(t, 4), 4)).toBe(t);
    }
  });
});

describe("porcentajeDe", () => {
  it("calcula con 2 decimales", () => {
    expect(porcentajeDe(1n, 3n)).toBe(33.33);
    expect(porcentajeDe(2n, 3n)).toBe(66.67);
    expect(porcentajeDe(5n, 5n)).toBe(100);
    expect(porcentajeDe(-1n, 4n)).toBe(-25);
  });

  it("devuelve null si el total no es positivo", () => {
    expect(porcentajeDe(1n, 0n)).toBeNull();
    expect(porcentajeDe(1n, -3n)).toBeNull();
  });
});
