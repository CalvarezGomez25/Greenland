import { describe, expect, it } from "vitest";
import { enlaceTelefono, sugerenciaDeContacto, validarCorreo, validarTelefono } from "./contactos";

describe("correo", () => {
  it("acepta vacío y direcciones válidas", () => {
    expect(validarCorreo("")).toBeNull();
    expect(validarCorreo(null)).toBeNull();
    expect(validarCorreo("  ana.perez@empresa.co ")).toBeNull();
  });
  it("rechaza lo que no es un correo", () => {
    for (const x of ["ana", "ana@", "@x.co", "ana@x", "a b@x.co", "a@x .co", "<a>@x.co"]) expect(validarCorreo(x)).not.toBeNull();
    expect(validarCorreo(`${"a".repeat(200)}@x.co`)).toContain("200");
  });
});

describe("teléfono", () => {
  it("acepta formatos habituales", () => {
    for (const x of ["", "3001234567", "+57 300 123 4567", "(601) 555-0101", "601.555.0101"]) expect(validarTelefono(x)).toBeNull();
  });
  it("rechaza letras, símbolos raros y largos fuera de rango", () => {
    for (const x of ["abc", "12345", "300 123 4567 ext 9", "3001234567;", "1".repeat(41)]) expect(validarTelefono(x)).not.toBeNull();
  });
  it("arma el enlace para llamar", () => {
    expect(enlaceTelefono("+57 300 123 4567")).toBe("tel:+573001234567");
    expect(enlaceTelefono("(601) 555-0101")).toBe("tel:6015550101");
  });
});

describe("sugerencia del directorio", () => {
  it("muestra nombre, rol y correo, y rellena los campos del formulario", () => {
    const s = sugerenciaDeContacto({ id: "1", nombre: "Ana Pérez", rol: "Interventora", correo: "ana@x.co", telefono: "3001234567" });
    expect(s.etiqueta).toBe("Ana Pérez (Interventora · ana@x.co)");
    expect(s.valores).toEqual({ nombre: "Ana Pérez", rol: "Interventora", correo: "ana@x.co", telefono: "3001234567" });
  });
  it("sin rol ni correo muestra solo el nombre y deja campos vacíos", () => {
    const s = sugerenciaDeContacto({ id: "2", nombre: "Comunidad", rol: null, correo: null, telefono: null });
    expect(s.etiqueta).toBe("Comunidad");
    expect(s.valores.correo).toBe("");
  });
});
