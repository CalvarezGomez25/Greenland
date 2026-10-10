import { describe, expect, it } from "vitest";
import { nombreSeguro, tamanoLegible } from "./documentos";

describe("documentos", () => {
  it("nombre de archivo seguro", () => {
    expect(nombreSeguro("Plano estructural – Torre 1 (v2).pdf")).toBe("Plano-estructural-Torre-1-v2.pdf");
    expect(nombreSeguro("../../etc/passwd")).toBe("etc-passwd");
    expect(nombreSeguro("áéíóú ñ.png")).toBe("aeiou-n.png");
    expect(nombreSeguro("???")).toBe("archivo");
    expect(nombreSeguro(`${"a".repeat(300)}.pdf`).length).toBeLessThanOrEqual(120);
    expect(nombreSeguro(`${"a".repeat(300)}.pdf`).endsWith(".pdf")).toBe(true);
  });
  it("tamaño legible", () => {
    expect(tamanoLegible(500)).toBe("500 B");
    expect(tamanoLegible(2048)).toBe("2 KB");
    expect(tamanoLegible(5 * 1024 * 1024)).toBe("5 MB");
  });
});
