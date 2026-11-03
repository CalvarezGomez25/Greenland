import { describe, expect, it } from "vitest";
import { esNitTemporal, formatearNit } from "./aliados";

describe("formatearNit", () => {
  it("agrupa los miles y deja el dígito de verificación", () => {
    expect(formatearNit("901519601-4")).toBe("901.519.601-4");
    expect(formatearNit("71935351")).toBe("71.935.351");
    expect(formatearNit("1234567")).toBe("1.234.567");
  });
  it("no toca el identificador temporal", () => {
    expect(formatearNit("PEND-JDO")).toBe("PEND-JDO");
    expect(esNitTemporal("PEND-JDO")).toBe(true);
    expect(esNitTemporal("901519601-4")).toBe(false);
  });
});
