import { describe, expect, it } from "vitest";
import { correosValidos, enlaceCorreo, invitacionProceso, MAX_CUERPO, recordatorioCompromiso, recordatorioPoliza } from "./borradores";

describe("borradores de correo", () => {
  it("filtra correos inválidos y repetidos", () => {
    expect(correosValidos([" a@b.co ", "a@b.co", "sin-arroba", "x@y", null, undefined, "c@d.com"])).toEqual(["a@b.co", "c@d.com"]);
  });
  it("arma el enlace mailto con asunto y cuerpo codificados", () => {
    const u = enlaceCorreo({ para: ["a@b.co"], asunto: "Hola ñ & más", cuerpo: "Línea 1\nLínea 2" })!;
    expect(u.startsWith("mailto:a%40b.co?")).toBe(true);
    expect(u).toContain("subject=Hola%20%C3%B1%20%26%20m%C3%A1s");
    expect(u).toContain("body=L%C3%ADnea%201%0D%0AL%C3%ADnea%202");
  });
  it("sin destinatarios válidos no hay enlace", () => {
    expect(enlaceCorreo({ para: ["mal"], cco: [], asunto: "a", cuerpo: "b" })).toBeNull();
  });
  it("los oferentes van en copia oculta, nunca en «para»", () => {
    const u = enlaceCorreo({ cco: ["uno@x.co", "dos@y.co"], asunto: "a", cuerpo: "b" })!;
    expect(u.startsWith("mailto:?bcc=uno%40x.co,dos%40y.co&")).toBe(true);
  });
  it("recorta un cuerpo demasiado largo", () => {
    const u = enlaceCorreo({ para: ["a@b.co"], asunto: "a", cuerpo: "x".repeat(MAX_CUERPO + 500) })!;
    const cuerpo = decodeURIComponent(u.split("body=")[1]);
    expect(cuerpo.length).toBe(MAX_CUERPO);
    expect(cuerpo.endsWith("…")).toBe(true);
  });
  it("la invitación incluye objeto y cierre, y no el presupuesto de referencia", () => {
    const b = invitacionProceso({ codigo: "PR-01", objeto: "Redes eléctricas", cierre: "2026-11-08", proyecto: "GL-002", enlaceCarpeta: "https://ej.test/c" });
    expect(b.cuerpo).toContain("Cierre de propuestas: 08/11/2026");
    expect(b.cuerpo).toContain("https://ej.test/c");
    expect(b.cuerpo.toLowerCase()).not.toContain("presupuesto");
    expect(b.asunto).toContain("PR-01");
  });
  it("los recordatorios dicen si la póliza ya venció o vence", () => {
    expect(recordatorioPoliza({ amparo: "Cumplimiento", vence: "2026-12-01", contratista: "ACME", proyecto: "GL-002", vencida: false }).cuerpo).toContain("vence el 01/12/2026");
    expect(recordatorioPoliza({ amparo: "Cumplimiento", vence: "2026-10-01", contratista: "ACME", proyecto: "GL-002", vencida: true }).asunto).toContain("vencida");
    expect(recordatorioCompromiso({ asunto: "Entregar planos", fecha: "2026-11-20", contratista: "ACME", proyecto: "GL-002" }).cuerpo).toContain("20/11/2026");
  });
});
