import { describe, expect, it } from "vitest";
import { construirCortes } from "./cortes";

const m = (fecha: string, bac: number, ev: number, ac: number) => ({ fecha, bac: BigInt(bac), pv: BigInt(ev), ev: BigInt(ev), ac: BigInt(ac), origen: "calculado" });

describe("construirCortes", () => {
  it("ordena por fecha y calcula invertido, proyectado (EAC) y por invertir", () => {
    const c = construirCortes([m("2026-09-01", 1000, 500, 600), m("2026-08-01", 1000, 250, 250)]);
    expect(c.map((x) => x.fecha)).toEqual(["2026-08-01", "2026-09-01"]);
    expect(c[0].proyectado).toBe(1000n); // CPI 1,0
    expect(c[0].porInvertir).toBe(750n);
    expect(c[1].proyectado).toBe(1200n); // 1000 × 600 / 500
    expect(c[1].porInvertir).toBe(600n);
    expect(c[1].pctInvertido).toBe(50);
  });
  it("compara con el corte anterior y con la línea base", () => {
    const c = construirCortes([m("2026-08-01", 1000, 250, 250), m("2026-09-01", 1000, 500, 600)]);
    expect(c[0].variacionProyectado).toBeNull();
    expect(c[1].invertidoEnPeriodo).toBe(350n);
    expect(c[1].variacionProyectado).toBe(200n);
    expect(c[1].variacionBase).toBe(200n);
    expect(c[1].cambioBac).toBe(0n);
  });
  it("registra el cambio de la línea base entre cortes", () => {
    const c = construirCortes([m("2026-08-01", 1000, 250, 250), m("2026-09-01", 1100, 500, 500)]);
    expect(c[1].cambioBac).toBe(100n);
    expect(c[1].variacionBase).toBe(0n);
  });
  it("sin avance o sin gasto no hay proyección", () => {
    const c = construirCortes([m("2026-08-01", 1000, 0, 100), m("2026-09-01", 1000, 300, 0)]);
    expect(c[0].proyectado).toBeNull();
    expect(c[0].porInvertir).toBeNull();
    expect(c[0].variacionBase).toBeNull();
    expect(c[1].proyectado).toBeNull();
    expect(c[1].variacionProyectado).toBeNull();
  });
  it("sin mediciones devuelve lista vacía", () => {
    expect(construirCortes([])).toEqual([]);
  });
});
