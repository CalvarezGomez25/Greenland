import { describe, expect, it } from "vitest";
import { construirLineaDeTiempo, agruparPorEstado, conEstado, agruparPorVencimiento, diasParaVencer, esEstadoActividad, estaVencida, hoyColombia, ordenarActividades, textoPlazo, type EstadoActividad, type PrioridadActividad } from "./actividades";

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
  it("conEstado cambia solo la actividad pedida y no toca la lista original", () => {
    const original = [{ id: "a", estado: "por_hacer" as EstadoActividad }, { id: "b", estado: "en_curso" as EstadoActividad }];
    const nueva = conEstado(original, "a", "hecha");
    expect(nueva.map((x) => x.estado)).toEqual(["hecha", "en_curso"]);
    expect(original[0].estado).toBe("por_hacer");
    expect(conEstado(original, "zzz", "hecha")).toEqual(original);
  });
  it("valida el estado y usa la fecha de Colombia", () => {
    expect(esEstadoActividad("hecha")).toBe(true);
    expect(esEstadoActividad("borrada")).toBe(false);
    // 2026-10-16 02:00 UTC es todavía el 15 en Colombia (UTC-5)
    expect(hoyColombia(new Date("2026-10-16T02:00:00Z"))).toBe("2026-10-15");
    expect(hoyColombia(new Date("2026-10-16T12:00:00Z"))).toBe("2026-10-16");
  });
});

describe("línea de tiempo", () => {
  const t = (fecha_limite: string | null, estado: EstadoActividad = "por_hacer") => ({ fecha_limite, estado });
  it("va de lo más atrasado a lo más lejano, con hoy dentro y sin las hechas ni las sin fecha", () => {
    const l = construirLineaDeTiempo([t("2026-10-10"), t("2026-10-30"), t("2026-10-20", "hecha"), t(null)], HOY);
    expect(l.hitos.map((h) => h.fecha)).toEqual(["2026-10-10", "2026-10-30"]);
    expect(l.vencidas).toBe(1);
    expect(l.proximos).toBe(1);
    expect(l.xHoy).toBeGreaterThan(l.hitos[0].x);
    expect(l.xHoy).toBeLessThan(l.hitos[1].x);
  });
  it("agrupa en un hito las actividades de la misma fecha y respeta la separación mínima", () => {
    const l = construirLineaDeTiempo([t("2026-10-17"), t("2026-10-17"), t("2026-10-18"), t("2026-12-30")], HOY, { separacion: 100 });
    expect(l.hitos[0].items).toHaveLength(2);
    for (let i = 1; i < l.hitos.length; i++) expect(l.hitos[i].x - l.hitos[i - 1].x).toBeGreaterThanOrEqual(100);
    expect(l.ancho).toBeGreaterThan(l.hitos[l.hitos.length - 1].x);
  });
  it("sin fechas queda solo «hoy»; con todo atrasado, hoy cierra el horizonte", () => {
    const vacia = construirLineaDeTiempo([t(null)], HOY);
    expect(vacia.hitos).toHaveLength(0);
    const atrasadas = construirLineaDeTiempo([t("2026-10-01"), t("2026-10-05")], HOY);
    expect(atrasadas.xHoy).toBeGreaterThan(atrasadas.hitos[1].x);
    expect(atrasadas.proximos).toBe(0);
  });
  it("una actividad que vence hoy comparte posición con hoy", () => {
    const l = construirLineaDeTiempo([t(HOY), t("2026-10-25")], HOY);
    expect(l.hitos[0].x).toBe(l.xHoy);
  });
});
