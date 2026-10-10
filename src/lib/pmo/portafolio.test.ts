import { describe, expect, it } from "vitest";
import { armarPortafolio, requiereDecision, type ProyectoBase } from "./portafolio";
import { semanaIso } from "./formato";

const M = (millones: number) => BigInt(Math.round(millones * 1_000_000)) * 100n;
const proy = (id: string, nombre: string, estado = "activo"): ProyectoBase => ({ id, nombre, codigo: null, estado, fase: "ejecucion", portafolio_id: null, organizacion_id: null });
const med = (id: string, bac: number, pv: number, ev: number, ac: number, fecha = "2026-03-31") => ({ proyecto_id: id, fecha_corte: fecha, bac: M(bac), pv: M(pv), ev: M(ev), ac: M(ac) });
const base = { parametros: [], riesgosActivos: [], cambiosPendientes: [], ultimosReportes: [] };

describe("dashboard — caso 13.4", () => {
  const r = armarPortafolio({
    ...base,
    proyectos: [proy("a", "A"), proy("b", "B"), proy("c", "C")],
    mediciones: [med("a", 1000, 400, 360, 400), med("b", 600, 300, 285, 290), med("c", 800, 200, 150, 210)],
  });
  it("estados: A Amarillo, B Verde, C Rojo; orden: rojos primero", () => {
    expect(r.filas.map((f) => [f.proyecto.nombre, f.semaforo.general])).toEqual([["C", "rojo"], ["A", "amarillo"], ["B", "verde"]]);
  });
  it("resumen: 3 activos, BAC 2.400, SPI y CPI 0,8833", () => {
    expect(r.resumen.activos).toBe(3);
    expect([r.resumen.verdes, r.resumen.amarillos, r.resumen.rojos]).toEqual([1, 1, 1]);
    expect(r.resumen.bac).toBe(M(2400));
    expect(r.resumen.ac).toBe(M(900));
    expect(r.resumen.spi).toBeCloseTo(0.8833, 4);
    expect(r.resumen.cpi).toBeCloseTo(0.8833, 4);
  });
});

describe("dashboard — reglas", () => {
  it("usa la medición más reciente de cada proyecto", () => {
    const r = armarPortafolio({ ...base, proyectos: [proy("a", "A")], mediciones: [med("a", 1000, 400, 100, 400, "2026-01-31"), med("a", 1000, 400, 360, 400, "2026-03-31")] });
    expect(r.filas[0].evm?.spi).toBe(0.9);
    expect(r.resumen.corte).toBe("2026-03-31");
  });
  it("proyecto sin mediciones queda 'sin datos'; los cerrados no cuentan en el resumen", () => {
    const r = armarPortafolio({ ...base, proyectos: [proy("a", "A"), proy("b", "B", "cerrado")], mediciones: [med("b", 100, 50, 50, 50)] });
    expect(r.resumen.activos).toBe(1);
    expect(r.resumen.sinDatos).toBe(1);
    expect(r.resumen.bac).toBe(0n);
    expect(r.resumen.spi).toBeNull();
  });
  it("riesgo crítico fuerza Rojo; cambio crítico pendiente también (caso 13.7)", () => {
    const r = armarPortafolio({
      ...base, proyectos: [proy("a", "A"), proy("b", "B")],
      mediciones: [med("a", 100, 50, 49, 50), med("b", 100, 50, 49, 50)],
      riesgosActivos: [{ proyecto_id: "a", nivel: "critico" }],
      cambiosPendientes: [{ proyecto_id: "b", nivel: "critico" }],
    });
    expect(r.filas.every((f) => f.semaforo.general === "rojo")).toBe(true);
  });
  it("los umbrales del proyecto prevalecen", () => {
    const r = armarPortafolio({
      ...base, proyectos: [proy("a", "A")], mediciones: [med("a", 1000, 400, 360, 400)],
      parametros: [{ ambito: "proyecto", ambito_id: "a", clave: "spi_verde_min", valor: "0.9" }, { ambito: "proyecto", ambito_id: "a", clave: "cpi_verde_min", valor: "0.9" }],
    });
    expect(r.filas[0].semaforo.general).toBe("verde");
  });
  it("requiere decisión: TCPI alto", () => {
    const r = armarPortafolio({ ...base, proyectos: [proy("a", "A")], mediciones: [med("a", 1000, 700, 300, 800)] });
    expect(requiereDecision(r.filas, [])[0].tipo).toBe("TCPI alto");
  });
});

describe("hallazgos escalados en 'requiere decisión'", () => {
  it("aparecen con su gravedad y NO cambian el semáforo (S13)", () => {
    const r = armarPortafolio({ ...base, proyectos: [proy("a", "A")], mediciones: [med("a", 1000, 400, 400, 400)], hallazgosEscalados: [{ proyecto_id: "a", severidad: "incumplimiento_grave" }, { proyecto_id: "a", severidad: "observacion" }] });
    const d = requiereDecision(r.filas, []);
    expect(d.find((x) => x.tipo === "Hallazgo escalado")?.detalle).toBe("2 sin respuesta a tiempo, 1 incumplimiento(s) grave(s)");
    expect(r.filas[0].semaforo.general).toBe("verde");
  });
});

describe("semana ISO", () => {
  it("casos conocidos", () => {
    expect(semanaIso("2026-01-01")).toEqual({ anio: 2026, semana: 1 });
    expect(semanaIso("2026-12-31")).toEqual({ anio: 2026, semana: 53 });
    expect(semanaIso("2027-01-01")).toEqual({ anio: 2026, semana: 53 });
    expect(semanaIso("2026-10-09")).toEqual({ anio: 2026, semana: 41 });
  });
});
