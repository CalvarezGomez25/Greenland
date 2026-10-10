import { describe, expect, it } from "vitest";
import { GLOSARIO, temaDe } from "./glosario";

describe("glosario de ayuda", () => {
  it("cada entrada tiene título y texto cortos", () => {
    for (const [clave, e] of Object.entries(GLOSARIO)) {
      expect(e.titulo.length, clave).toBeGreaterThan(3);
      expect(e.texto.length, clave).toBeGreaterThan(15);
      expect(e.texto.length, `${clave} debe ser corto`).toBeLessThan(330);
    }
  });
  it("los rótulos de las tarjetas apuntan a una entrada existente", () => {
    for (const r of ["Cronograma (SPI)", "Presupuesto (BAC)", "Desempeño requerido (TCPI)", "Avance reportado", "Retención acumulada", "BAC", "SPI"]) {
      expect(temaDe(r), r).toBeDefined();
      expect(GLOSARIO[temaDe(r)!]).toBeDefined();
    }
    expect(temaDe("Texto sin ayuda")).toBeUndefined();
  });
  it("los ejemplos de valor ganado coinciden con el caso 13.3 (SPI y CPI de 0,90)", () => {
    expect(GLOSARIO.medicion.ejemplo).toContain("0,90");
    expect(GLOSARIO.spi.ejemplo).toContain("0,90");
  });
});
