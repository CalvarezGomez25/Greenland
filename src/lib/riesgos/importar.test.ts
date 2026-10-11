import { describe, expect, it } from "vitest";
import { interpretarRiesgos, nivelDeScore } from "./importar";

const ENC = ["ID", "Frente", "Categoría", "Riesgo", "Causa / disparador", "Consecuencia", "Probabilidad", "Impacto", "Nivel", "Puntaje", "Mitigación / acción", "Momento de control", "Responsable (rol propuesto)", "Responsable (nombre)", "Fecha objetivo", "Estado", "Base / referencia"];
const fila = (o: Record<string, string | number | Date | null> = {}) => {
  const base: Record<string, string | number | Date | null> = { ID: "T-01", Frente: "F1", Categoría: "Técnico", Riesgo: "Algo falla", "Causa / disparador": "c", Consecuencia: "k", Probabilidad: "Alta", Impacto: "Alta", Nivel: "Crítico", Puntaje: 4, "Mitigación / acción": "plan", "Momento de control": "Precontractual", "Responsable (rol propuesto)": "Gerencia", "Responsable (nombre)": null, "Fecha objetivo": null, Estado: "Abierto", "Base / referencia": "ref", ...o };
  return ENC.map((e) => base[e]);
};

describe("interpretarRiesgos", () => {
  it("lee un riesgo y convierte Baja/Media/Alta a 1/2/4", () => {
    const r = interpretarRiesgos([ENC, fila({ Probabilidad: "Media", Impacto: "Alta", Nivel: "Alto" })]);
    expect(r.errores).toEqual([]);
    expect(r.riesgos[0]).toMatchObject({ codigo: "T-01", probabilidad: 2, impacto: 4, estado: "activo", responsable: "Gerencia", frente: "F1", momento_control: "Precontractual" });
    expect(r.avisos.some((a) => a.includes("rol propuesto"))).toBe(true);
  });

  it("reproduce la matriz 3×3 del Excel con los cortes de la plataforma", () => {
    const esperado: Record<string, string> = { "Alta,Alta": "Crítico", "Alta,Media": "Alto", "Media,Alta": "Alto", "Media,Media": "Medio", "Baja,Alta": "Medio", "Alta,Baja": "Medio", "Baja,Media": "Bajo", "Media,Baja": "Bajo", "Baja,Baja": "Bajo" };
    const filas = Object.keys(esperado).map((k, i) => { const [p, im] = k.split(","); return fila({ ID: `X-${i}`, Probabilidad: p, Impacto: im, Nivel: esperado[k] }); });
    const r = interpretarRiesgos([ENC, ...filas]);
    expect(r.errores).toEqual([]);
    expect(r.avisos.some((a) => a.includes("nivel distinto"))).toBe(false);
    r.riesgos.forEach((x, i) => expect(nivelDeScore(x.probabilidad * x.impacto)).toBe(Object.values(esperado)[i]));
  });

  it("avisa si el nivel del archivo difiere del calculado", () => {
    const r = interpretarRiesgos([ENC, fila({ Nivel: "Bajo" })]);
    expect(r.avisos.some((a) => a.includes("nivel distinto"))).toBe(true);
  });

  it("acepta números 1 a 5, nombre del responsable y fechas", () => {
    const r = interpretarRiesgos([ENC, fila({ Probabilidad: 3, Impacto: 5, "Responsable (nombre)": "Ana", "Fecha objetivo": new Date("2026-11-30T00:00:00Z") }), fila({ ID: "T-02", "Fecha objetivo": "05/12/2026" })]);
    expect(r.errores).toEqual([]);
    expect(r.riesgos[0]).toMatchObject({ probabilidad: 3, impacto: 5, responsable: "Ana", fecha_objetivo: "2026-11-30" });
    expect(r.riesgos[1].fecha_objetivo).toBe("2026-12-05");
  });

  it("reporta errores por fila y no mezcla filas buenas con malas", () => {
    const r = interpretarRiesgos([ENC, fila({ ID: "A", Probabilidad: "Altísima" }), fila({ ID: "A" }), fila({ ID: "B", Estado: "Raro" }), fila({ ID: "C", "Fecha objetivo": "31/02/2026" }), fila({ ID: "", Riesgo: "x" })]);
    expect(r.errores.map((e) => e.fila)).toEqual([2, 3, 4, 5, 6]);
    expect(r.errores[0].mensaje).toMatch(/probabilidad/);
    expect(r.errores[2].mensaje).toMatch(/estado/);
    expect(r.errores[3].mensaje).toMatch(/no existe/);
  });

  it("detecta IDs repetidos y columnas obligatorias que faltan", () => {
    expect(interpretarRiesgos([ENC, fila(), fila()]).errores[0].mensaje).toMatch(/repetido/);
    const sinRiesgo = interpretarRiesgos([ENC.filter((e) => e !== "Riesgo"), ["T-01"]]);
    expect(sinRiesgo.errores[0].mensaje).toMatch(/Faltan columnas.*Riesgo/);
  });

  it("ignora filas vacías y la hoja vacía da error", () => {
    expect(interpretarRiesgos([ENC, fila(), ENC.map(() => null)]).filasLeidas).toBe(1);
    expect(interpretarRiesgos([]).errores).toHaveLength(1);
  });
});
