import { describe, expect, it } from "vitest";
import { leerDatosCambio, leerImpacto } from "./cambios-form";

describe("impacto en costo", () => {
  it("formato colombiano, vacío = 0 y signo", () => {
    expect(leerImpacto("8.000.000")).toEqual({ ok: true, valor: "8000000" });
    expect(leerImpacto("1.234,50")).toEqual({ ok: true, valor: "1234.50" });
    expect(leerImpacto("")).toEqual({ ok: true, valor: "0" });
    expect(leerImpacto("-30.000.000")).toEqual({ ok: true, valor: "-30000000" });
    expect(leerImpacto("-0")).toEqual({ ok: true, valor: "0" });
  });
  it("rechaza formatos ambiguos", () => {
    expect(leerImpacto("1234.56").ok).toBe(false);
    expect(leerImpacto("abc").ok).toBe(false);
  });
});

describe("leerDatosCambio", () => {
  const f = (o: Record<string, string>, ambitos: string[] = []) => { const d = new FormData(); for (const [k, v] of Object.entries(o)) d.set(k, v); ambitos.forEach((a) => d.append("ambitos", a)); return d; };
  it("lee, filtra ámbitos no válidos y valida días", () => {
    const r = leerDatosCambio(f({ tipo: "Costo", impacto_costo: "12.000.000", impacto_dias: "-5" }, ["costo_falso", "financiero"]));
    expect("datos" in r && r.datos.ambitos).toEqual(["financiero"]);
    expect("datos" in r && r.datos.impacto_dias).toBe("-5");
    expect("error" in leerDatosCambio(f({ impacto_dias: "3,5" }))).toBe(true);
  });
});
