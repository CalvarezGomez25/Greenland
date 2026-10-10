import { describe, expect, it } from "vitest";
import { listaParametro, numeroParametro, valorParametro } from "./parametros";

const filas = [
  { ambito: "global", ambito_id: null, clave: "x", valor: "1" },
  { ambito: "portafolio", ambito_id: "pf", clave: "x", valor: "2" },
  { ambito: "proyecto", ambito_id: "p1", clave: "x", valor: "3" },
  { ambito: "global", ambito_id: null, clave: "l", valor: "a, b ,c" },
];
describe("parámetros", () => {
  it("proyecto > portafolio > global", () => {
    expect(valorParametro(filas, "x", { proyectoId: "p1", portafolioId: "pf" })).toBe("3");
    expect(valorParametro(filas, "x", { proyectoId: "p2", portafolioId: "pf" })).toBe("2");
    expect(valorParametro(filas, "x", { proyectoId: "p2", portafolioId: "otro" })).toBe("1");
    expect(valorParametro(filas, "zz", {})).toBeNull();
  });
  it("número con respaldo y lista", () => {
    expect(numeroParametro(filas, "x", { proyectoId: "p1" }, 9)).toBe(3);
    expect(numeroParametro(filas, "nada", {}, 9)).toBe(9);
    expect(listaParametro(filas, "l")).toEqual(["a", "b", "c"]);
  });
});
