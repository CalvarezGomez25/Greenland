import { describe, expect, it } from "vitest";
import { agruparPorEstado, agruparPorVencimiento, diasParaVencer, esEstadoActividad, estaVencida, hoyColombia, ordenarActividades, textoPlazo, type EstadoActividad, type PrioridadActividad } from "./actividades";

const HOY = "2026-10-16";
const a = (titulo: string, estado: EstadoActividad, fecha_limite: string | null, prioridad: PrioridadActividad = "media") => ({ titulo, estado, fecha_limite, prioridad });

describe("actividades", () => {
  it("cuenta los días entre fechas, también al cruzar mes y año", () => {
    expect(diasParaVencer("2026-10-16", HOY)).toBe(0);
    expect(diasParaVencer("2026-10-17", HOY)).toBe(1);
    expect(diasParaVencer("2026-10-15", HOY)).toBe(-1);
    expect(diasParaVencer("2027-01-01", "2026-12-31")).toBe(1);
    expect(diasParaVencer("2026-03-01", "2026-02-28")).toBe(1);
  });
  it("vencida: no hecha y con fecha límite pasada; vence hoy todavía no", () => {
    expect(estaVencida(a("x", "en_curso", "2026-10-15"), HOY)).toBe(true);
    expect(estaVencida(a("x", "por_hacer", HOY), HOY)).toBe(false);
    expect(estaVencida(a("x", "hecha", "2026-01-01"), HOY)).toBe(false);
    expect(estaVencida(a("x", "bloqueada", null), HOY)).toBe(false);
  });
  it("ordena por fecha, sin fecha al final, y por prioridad a igual fecha", () => {
    const l = ordenarActividades([a("D", "por_hacer", null), a("C", "por_hacer", "2026-10-20", "baja"), a("B", "por_hacer", "2026-10-20", "alta"), a("A", "por_hacer", "2026-10-18")]);
    expect(l.map((x) => x.titulo)).toEqual(["A", "B", "C", "D"]);
  });
  it("agrupa el tablero por estado", () => {
    const g = agruparPorEstado([a("1", "hecha", null), a("2", "en_curso", null), a("3", "en_curso", "2026-10-01"), a("4", "por_hacer", null)]);
    expect(g.por_hacer).toHaveLength(1);
    expect(g.en_curso.map((x) => x.titulo)).toEqual(["3", "2"]);
    expect(g.bloqueada).toHaveLength(0);
    expect(g.hecha).toHaveLength(1);
  });
  it("«Mi trabajo» separa vencidas, próximos 7 días, más adelante y sin fecha, sin las hechas", () => {
    const g = agruparPorVencimiento([
      a("vencida", "en_curso", "2026-10-10"), a("hoy", "por_hacer", HOY), a("en 7", "por_hacer", "2026-10-23"),
      a("en 8", "por_hacer", "2026-10-24"), a("sin", "bloqueada", null), a("hecha", "hecha", "2026-10-01"),
    ], HOY);
    expect(g.vencidas.map((x) => x.titulo)).toEqual(["vencida"]);
    expect(g.esta_semana.map((x) => x.titulo)).toEqual(["hoy", "en 7"]);
    expect(g.mas_adelante.map((x) => x.titulo)).toEqual(["en 8"]);
    expect(g.sin_fecha.map((x) => x.titulo)).toEqual(["sin"]);
  });
  it("textos del plazo", () => {
    expect(textoPlazo("2026-10-13", HOY)).toBe("Vencida hace 3 días");
    expect(textoPlazo("2026-10-15", HOY)).toBe("Vencida hace 1 día");
    expect(textoPlazo(HOY, HOY)).toBe("Vence hoy");
    expect(textoPlazo("2026-10-17", HOY)).toBe("Vence mañana");
    expect(textoPlazo("2026-10-21", HOY)).toBe("Vence en 5 días");
  });
  it("valida el estado y usa la fecha de Colombia", () => {
    expect(esEstadoActividad("hecha")).toBe(true);
    expect(esEstadoActividad("borrada")).toBe(false);
    // 2026-10-16 02:00 UTC es todavía el 15 en Colombia (UTC-5)
    expect(hoyColombia(new Date("2026-10-16T02:00:00Z"))).toBe("2026-10-15");
    expect(hoyColombia(new Date("2026-10-16T12:00:00Z"))).toBe("2026-10-16");
  });
});
