import { describe, expect, it } from "vitest";
import { leerCampos, leerDecimalSimple, esFechaValida } from "./leer";
import type { CampoDef } from "./tipos";

const f = (o: Record<string, string>) => { const d = new FormData(); for (const [k, v] of Object.entries(o)) d.set(k, v); return d; };
const campos: CampoDef[] = [
  { nombre: "n", etiqueta: "Nombre", tipo: "texto", obligatorio: true, max: 5 },
  { nombre: "p", etiqueta: "Prob", tipo: "entero", min: 1, max: 5, obligatorio: true },
  { nombre: "x", etiqueta: "Peso", tipo: "decimal", min: 0, max: 100, decimales: 2 },
  { nombre: "d", etiqueta: "Fecha", tipo: "fecha" },
  { nombre: "s", etiqueta: "Sel", tipo: "seleccion", opciones: [{ valor: "a", etiqueta: "A" }] },
  { nombre: "c", etiqueta: "Casilla", tipo: "casilla" },
];

describe("leerCampos", () => {
  it("lee valores válidos", () => {
    const r = leerCampos(campos, f({ n: " Ab ", p: "3", x: "12,5", d: "2026-02-28", s: "a", c: "on" }));
    expect(r.error).toBeUndefined();
    expect(r.valores).toEqual({ n: "Ab", p: 3, x: 12.5, d: "2026-02-28", s: "a", c: true });
  });
  it("vacío opcional → null; casilla ausente → false", () => {
    const r = leerCampos(campos, f({ n: "a", p: "1" }));
    expect(r.valores).toMatchObject({ x: null, d: null, s: null, c: false });
  });
  it("rechaza obligatorios vacíos, rangos, largo, fecha y opción inválidos", () => {
    expect(leerCampos(campos, f({ p: "1" })).error).toMatch(/Nombre es obligatorio/);
    expect(leerCampos(campos, f({ n: "a", p: "6" })).error).toMatch(/mayor que 5/);
    expect(leerCampos(campos, f({ n: "a", p: "0" })).error).toMatch(/menor que 1/);
    expect(leerCampos(campos, f({ n: "a", p: "1.5" })).error).toMatch(/entero/);
    expect(leerCampos(campos, f({ n: "abcdef", p: "1" })).error).toMatch(/5 caracteres/);
    expect(leerCampos(campos, f({ n: "a", p: "1", d: "2026-02-30" })).error).toMatch(/fecha válida/);
    expect(leerCampos(campos, f({ n: "a", p: "1", s: "z" })).error).toMatch(/opción/);
    expect(leerCampos(campos, f({ n: "a", p: "1", x: "101" })).error).toMatch(/mayor que 100/);
  });
  it("campos soloAlCrear se ignoran al editar", () => {
    const c: CampoDef[] = [{ nombre: "k", etiqueta: "K", tipo: "texto", obligatorio: true, soloAlCrear: true }];
    expect(leerCampos(c, f({}), {}, { creando: false }).error).toBeUndefined();
    expect(leerCampos(c, f({}), {}).error).toMatch(/obligatorio/);
  });
  it("decimal simple y fechas", () => {
    expect(leerDecimalSimple("1,25", 2)).toBe(1.25);
    expect(leerDecimalSimple("1.234", 2)).toBeNull();
    expect(esFechaValida("2024-02-29")).toBe(true);
    expect(esFechaValida("2026-13-01")).toBe(false);
  });
});
