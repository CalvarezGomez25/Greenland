import { describe, expect, it } from "vitest";
import { validarProyecto } from "./proyecto-validar";

const datos = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const base = { nombre: "Obra", cliente: "", ubicacion: "", fecha_inicio: "2026-10-01", duracion_meses: "12" };

describe("validarProyecto", () => {
  it("acepta datos correctos", () => {
    expect("datos" in validarProyecto(datos(base))).toBe(true);
  });
  it("rechaza un día que no existe", () => {
    for (const f of ["2026-02-31", "2026-13-01", "2026-04-31"]) expect("error" in validarProyecto(datos({ ...base, fecha_inicio: f })), f).toBe(true);
  });
  it("acepta el 29 de febrero solo en año bisiesto", () => {
    expect("datos" in validarProyecto(datos({ ...base, fecha_inicio: "2028-02-29" }))).toBe(true);
    expect("error" in validarProyecto(datos({ ...base, fecha_inicio: "2027-02-29" }))).toBe(true);
  });
});
