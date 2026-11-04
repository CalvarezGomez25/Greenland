import { describe, expect, it } from "vitest";
import { construirICS, diaSiguiente, enlaceGoogle, enlaceOutlook, escaparTexto, fechaValida, plegar } from "./ics";

const ahora = new Date("2026-11-04T15:30:45.123Z");
const ev = { uid: "act-123", titulo: "Entregar informe; versión final, con firma", fecha: "2026-11-30", descripcion: "Línea 1\nLínea 2", categoria: "Actividad", url: "https://ejemplo.test/p/1" };

describe("calendario .ics", () => {
  it("valida fechas reales y calcula el día siguiente (también fin de mes y de año)", () => {
    expect(fechaValida("2026-02-29")).toBe(false);
    expect(fechaValida("2028-02-29")).toBe(true);
    expect(fechaValida("2026-13-01")).toBe(false);
    expect(fechaValida("hoy")).toBe(false);
    expect(diaSiguiente("2026-11-30")).toBe("2026-12-01");
    expect(diaSiguiente("2026-12-31")).toBe("2027-01-01");
  });
  it("escapa la barra, el punto y coma, la coma y los saltos de línea", () => {
    expect(escaparTexto("a;b,c\\d\ne")).toBe("a\;b\\,c\\\\d\\ne");
  });
  it("pliega líneas largas a 75 bytes sin partir caracteres de varios bytes", () => {
    const larga = "SUMMARY:" + "ñ".repeat(80);
    const plegada = plegar(larga);
    const lineas = plegada.split("\r\n");
    expect(lineas.length).toBeGreaterThan(1);
    for (const l of lineas) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(lineas.slice(1).every((l) => l.startsWith(" "))).toBe(true);
    expect(lineas.map((l, i) => (i ? l.slice(1) : l)).join("")).toBe(larga);
  });
  it("arma un calendario válido con eventos de día completo", () => {
    const ics = construirICS([ev], ahora);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("UID:act-123@pmo360");
    expect(ics).toContain("DTSTAMP:20261104T153045Z");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261130");
    expect(ics).toContain("DTEND;VALUE=DATE:20261201");
    expect(ics).toContain("SUMMARY:Entregar informe\; versión final\\, con firma");
    expect(ics).toContain("DESCRIPTION:Línea 1\\nLínea 2");
    expect(ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    expect(ics.includes("\n") && !ics.replace(/\r\n/g, "").includes("\n")).toBe(true);
  });
  it("omite los eventos con fecha inválida y limpia el identificador", () => {
    const ics = construirICS([{ ...ev, fecha: "2026-02-30" }, { ...ev, uid: "a b/c", fecha: "2026-03-01" }], ahora);
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(1);
    expect(ics).toContain("UID:a-b-c@pmo360");
  });
  it("genera enlaces de Google y Outlook con la fecha de todo el día", () => {
    const g = enlaceGoogle(ev), o = enlaceOutlook(ev);
    expect(g.startsWith("https://calendar.google.com/calendar/render?action=TEMPLATE")).toBe(true);
    expect(g).toContain("dates=20261130%2F20261201");
    expect(o).toContain("startdt=2026-11-30");
    expect(o).toContain("enddt=2026-12-01");
    expect(o).toContain("allday=true");
    expect(g).toContain(encodeURIComponent("Entregar informe; versión final, con firma"));
  });
});
