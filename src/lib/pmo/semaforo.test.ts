import { describe, expect, it } from "vitest";
import { calcularSemaforo, colorIndice, nivelDeRiesgo, nivelMaximo } from "./semaforo";

describe("semáforo", () => {
  it("índices: 0,95 es Verde; 0,85 a <0,95 Amarillo; <0,85 Rojo", () => {
    expect(colorIndice(0.95, 0.95, 0.85)).toBe("verde");
    expect(colorIndice(0.9, 0.95, 0.85)).toBe("amarillo");
    expect(colorIndice(0.85, 0.95, 0.85)).toBe("amarillo");
    expect(colorIndice(0.8499, 0.95, 0.85)).toBe("rojo");
    expect(colorIndice(null, 0.95, 0.85)).toBeNull();
  });
  it("caso 13.3: SPI y CPI 0,90 con riesgos bajos y sin cambios → Amarillo", () => {
    expect(calcularSemaforo({ spi: 0.9, cpi: 0.9, riesgoMaximo: "bajo", cambiosPendientes: [] }).general).toBe("amarillo");
  });
  it("caso 13.4: A Amarillo, B Verde, C Rojo", () => {
    const g = (spi: number, cpi: number) => calcularSemaforo({ spi, cpi, riesgoMaximo: "bajo", cambiosPendientes: [] }).general;
    expect(g(0.9, 0.9)).toBe("amarillo");
    expect(g(0.95, 0.9828)).toBe("verde");
    expect(g(0.75, 0.7143)).toBe("rojo");
  });
  it("caso 13.7: riesgo Crítico → Rojo aunque SPI/CPI estén bien; Alto sin Crítico → Amarillo", () => {
    expect(calcularSemaforo({ spi: 0.98, cpi: 0.97, riesgoMaximo: "critico", cambiosPendientes: [] }).general).toBe("rojo");
    expect(calcularSemaforo({ spi: 0.98, cpi: 0.97, riesgoMaximo: "alto", cambiosPendientes: [] }).general).toBe("amarillo");
  });
  it("cambios: crítico pendiente → Rojo; menor o moderado → Amarillo", () => {
    const base = { spi: 1, cpi: 1, riesgoMaximo: "bajo" as const };
    expect(calcularSemaforo({ ...base, cambiosPendientes: ["critico"] }).general).toBe("rojo");
    expect(calcularSemaforo({ ...base, cambiosPendientes: ["menor"] }).general).toBe("amarillo");
    expect(calcularSemaforo({ ...base, cambiosPendientes: ["moderado", "menor"] }).general).toBe("amarillo");
  });
  it("sin datos no hay estado; los umbrales son parámetros", () => {
    expect(calcularSemaforo({ spi: null, cpi: null, riesgoMaximo: null, cambiosPendientes: [] }).general).toBeNull();
    expect(calcularSemaforo({ spi: 0.9, cpi: 1, riesgoMaximo: null, cambiosPendientes: [] }, { spiVerde: 0.9, cpiVerde: 0.9, spiAmarillo: 0.8, cpiAmarillo: 0.8 }).general).toBe("verde");
  });
  it("niveles de riesgo (caso 13.5) y máximo", () => {
    expect(nivelDeRiesgo(15)).toBe("critico");
    expect(nivelDeRiesgo(16)).toBe("critico");
    expect(nivelDeRiesgo(12)).toBe("alto");
    expect(nivelDeRiesgo(6)).toBe("medio");
    expect(nivelDeRiesgo(3)).toBe("bajo");
    expect(nivelMaximo(["bajo", "alto", "medio"])).toBe("alto");
    expect(nivelMaximo([])).toBeNull();
  });
});
