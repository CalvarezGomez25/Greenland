import { describe, expect, it } from "vitest";
import { componerAviso, componerResumen, repartirDecisiones, type Persona } from "./resumen";
import type { Decision } from "../pmo/portafolio";

const d = (tipo: string, proyectoId: string, audiencia: Decision["audiencia"], detalle = "detalle"): Decision => ({ tipo, proyectoId, proyecto: `Obra ${proyectoId}`, detalle, href: `/proyectos/${proyectoId}/x`, audiencia });
const dir: Persona = { id: "d", nombre: "Diana", correo: "d@x.co" };
const g1: Persona = { id: "g1", nombre: "Gus", correo: "g1@x.co" };
const g2: Persona = { id: "g2", nombre: "Gina", correo: "g2@x.co" };
const gerentes = new Map([["P1", [g1]], ["P2", [g2]]]);

describe("repartirDecisiones", () => {
  const ds = [d("Contrato por aprobar", "P1", "director"), d("Hitos vencidos", "P1", "gerente"), d("Hitos vencidos", "P2", "gerente"), d("Riesgo crítico", "P2", "ambos")];
  const r = repartirDecisiones(ds, [dir], gerentes);
  const de = (id: string) => r.find((x) => x.persona.id === id)?.decisiones.map((x) => `${x.tipo}@${x.proyectoId}`).sort();
  it("el director recibe lo suyo y lo de ambos, de todos los proyectos", () => {
    expect(de("d")).toEqual(["Contrato por aprobar@P1", "Riesgo crítico@P2"]);
  });
  it("cada gerente recibe solo lo de sus proyectos", () => {
    expect(de("g1")).toEqual(["Hitos vencidos@P1"]);
    expect(de("g2")).toEqual(["Hitos vencidos@P2", "Riesgo crítico@P2"]);
  });
  it("quien no tiene nada pendiente no recibe correo", () => {
    expect(repartirDecisiones([], [dir], gerentes)).toEqual([]);
  });
  it("sin correo registrado no se envía", () => {
    expect(repartirDecisiones([d("X", "P1", "director")], [{ ...dir, correo: "" }], gerentes)).toEqual([]);
  });
  it("si una persona es director y gerente, no repite decisiones", () => {
    const yo: Persona = { id: "y", nombre: "Yo", correo: "y@x.co" };
    const rr = repartirDecisiones([d("Riesgo crítico", "P1", "ambos")], [yo], new Map([["P1", [yo]]]));
    expect(rr).toHaveLength(1);
    expect(rr[0].decisiones).toHaveLength(1);
  });
});

describe("correos", () => {
  it("el resumen cuenta las decisiones, agrupa por proyecto, trae enlaces y escapa HTML", () => {
    const c = componerResumen({ persona: { ...dir, nombre: "Diana <b>" }, decisiones: [d("Cambio por aprobar", "P1", "director", "CC-1 <script>"), d("Contrato por aprobar", "P1", "director")] }, "https://app.test", "2026-10-10");
    expect(c.asunto).toContain("2 decisiones pendientes");
    expect(c.texto).toContain("https://app.test/proyectos/P1/x");
    expect(c.html).not.toContain("<script>");
    expect(c.html).toContain("&lt;script&gt;");
    expect(c.html).toContain("Diana &lt;b&gt;");
  });
  it("singular cuando es una sola", () => {
    expect(componerResumen({ persona: dir, decisiones: [d("X", "P1", "director")] }, "https://a", "2026-10-10").asunto).toContain("1 decisión pendiente");
  });
  it("el aviso trae título, proyecto y enlace", () => {
    const c = componerAviso({ titulo: "Cambio CC-1 por aprobar", detalle: "Nivel Moderado", proyecto: "Obra 1", href: "/proyectos/P1/cambios/c1" }, "https://app.test");
    expect(c.asunto).toContain("Cambio CC-1 por aprobar — Obra 1");
    expect(c.texto).toContain("https://app.test/proyectos/P1/cambios/c1");
  });
});
