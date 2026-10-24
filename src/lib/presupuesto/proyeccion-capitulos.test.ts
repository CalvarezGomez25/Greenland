import { describe, expect, it } from "vitest";
import type { FilaBalance } from "./balance";
import { proyectarCapitulos } from "./proyeccion-capitulos";

const M = 1_000_000n; // 1 peso en escala 6
const cap = (id: string, presupuesto: bigint, facturado: bigint, contratado = 0n): FilaBalance => ({
  tipo: "capitulo", id, codigo: id, nombre: `Cap ${id}`, presupuestoDirecto: presupuesto, presupuesto, contratado, porAprobar: 0n,
  facturado, saldo: presupuesto - contratado, pctContratado: null, sobrecontratado: false,
});
const tarea = (capituloId: string | null, peso: number, avance: number) => ({ capituloId, peso: BigInt(Math.round(peso * 10_000)), avance: BigInt(Math.round(avance * 100)) });

describe("proyectarCapitulos", () => {
  it("avance ponderado, valor ganado y EAC del capítulo", () => {
    // 2 tareas: 60 % de peso al 50 % y 40 % de peso al 25 % → avance 40 %
    const [r] = proyectarCapitulos([cap("1", 1000n * M, 500n * M)], [tarea("1", 60, 50), tarea("1", 40, 25)]);
    expect(r.avance).toBe(40);
    expect(r.ev).toBe(400n * M);
    expect(r.proyectado).toBe(1250n * M); // 1000 × 500 / 400
    expect(r.porInvertir).toBe(750n * M);
    expect(r.cpi).toBe(0.8);
    expect(r.sobrePresupuesto).toBe(250n * M);
  });
  it("compara lo proyectado con lo contratado solo si hay contrato asignado", () => {
    const [a, b] = proyectarCapitulos(
      [cap("1", 1000n * M, 500n * M, 1100n * M), cap("2", 1000n * M, 500n * M)],
      [tarea("1", 100, 40), tarea("2", 100, 40)],
    );
    expect(a.sobreContrato).toBe(150n * M); // 1250 − 1100
    expect(b.sobreContrato).toBeNull();
  });
  it("sin tareas, sin avance o sin facturado no hay proyección", () => {
    const [sinTareas, sinAvance, sinFacturado] = proyectarCapitulos(
      [cap("1", 1000n * M, 100n * M), cap("2", 1000n * M, 100n * M), cap("3", 1000n * M, 0n)],
      [tarea("2", 100, 0), tarea("3", 100, 50), tarea(null, 100, 90)],
    );
    expect(sinTareas.avance).toBeNull();
    expect(sinTareas.proyectado).toBeNull();
    expect(sinAvance.avance).toBe(0);
    expect(sinAvance.proyectado).toBeNull();
    expect(sinFacturado.proyectado).toBeNull();
    expect(sinFacturado.ev).toBe(500n * M);
  });
});
