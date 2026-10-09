import { describe, expect, it } from "vitest";
import { ErrorLecturaTabla } from "./datos";
import { describirFallo } from "./fallos";

describe("describirFallo", () => {
  it("dice qué tabla y qué código, sin el mensaje interno", () => {
    const e = new ErrorLecturaTabla("capitulos", "42501", "permission denied for table capitulos (detalle interno)");
    expect(describirFallo(e)).toBe("no se pudo leer «capitulos» (código 42501)");
    expect(describirFallo(e)).not.toContain("detalle interno");
  });
  it("sin código", () => {
    expect(describirFallo(new ErrorLecturaTabla("apu_partidas"))).toBe("no se pudo leer «apu_partidas»");
  });
  it("otros errores: solo el tipo, nunca el mensaje", () => {
    expect(describirFallo(new RangeError("secreto"))).toMatch(/fuera de rango/);
    expect(describirFallo(new TypeError("secreto"))).toBe("error de tipo TypeError");
    expect(describirFallo("texto")).toBe("error desconocido");
  });
});
