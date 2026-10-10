import { describe, expect, it } from "vitest";
import { estrategiaStakeholder, leerCortes } from "./planificacion";

describe("stakeholders — caso 13.6", () => {
  it("poder × interés y estrategia según la leyenda del libro", () => {
    expect(estrategiaStakeholder(5 * 5)).toBe("gestionar_de_cerca"); // Patrocinador 25
    expect(estrategiaStakeholder(4 * 4)).toBe("gestionar_de_cerca"); // Director de Obras 16
    expect(estrategiaStakeholder(3 * 5)).toBe("mantener_satisfecho"); // Contratista 15
    expect(estrategiaStakeholder(5 * 3)).toBe("mantener_satisfecho"); // Ente regulador 15
    expect(estrategiaStakeholder(2 * 4)).toBe("mantener_informado"); // Comunidad 8
    expect(estrategiaStakeholder(4)).toBe("monitorear");
  });
  it("los cortes son parámetros; un valor inválido vuelve al libro", () => {
    expect(leerCortes("20,12,6")).toEqual([20, 12, 6]);
    expect(estrategiaStakeholder(16, [20, 12, 6])).toBe("mantener_satisfecho");
    expect(leerCortes("5,10,16")).toEqual([16, 10, 5]);
    expect(leerCortes(null)).toEqual([16, 10, 5]);
    expect(leerCortes("a,b,c")).toEqual([16, 10, 5]);
  });
});
