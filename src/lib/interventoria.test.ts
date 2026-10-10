import { describe, expect, it } from "vitest";
import { actaConConceptoFavorable, conceptoPermitido } from "./interventoria";

describe("caso 13.9 — sub-roles", () => {
  it("el técnico no conceptúa sobre el anticipo; el financiero no sobre diseños", () => {
    expect(conceptoPermitido("tecnico", "anticipo")).toBe(false);
    expect(conceptoPermitido("financiero", "diseno")).toBe(false);
    expect(conceptoPermitido("financiero", "anticipo")).toBe(true);
    expect(conceptoPermitido("tecnico", "diseno")).toBe(true);
    expect(conceptoPermitido("tecnico", "avance")).toBe(true);
  });
  it("el director conceptúa todo; el administrativo, solo lo suyo", () => {
    for (const t of ["acta_pago", "avance", "cambio", "anticipo", "diseno", "estudios_previos_pliegos", "otro"]) expect(conceptoPermitido("director", t)).toBe(true);
    expect(conceptoPermitido("administrativo", "acta_pago")).toBe(false);
    expect(conceptoPermitido("administrativo", "otro")).toBe(true);
    expect(conceptoPermitido("inventado", "otro")).toBe(false);
  });
});

describe("caso 13.9 — acta de pago y conceptos", () => {
  const asignados = ["tecnico", "financiero"];
  it("un No aprobado impide el pago", () => {
    expect(actaConConceptoFavorable([{ subrol: "financiero", resultado: "no_aprobado" }], asignados)).toBe(false);
  });
  it("hacen falta los dos favorables (técnico y financiero)", () => {
    expect(actaConConceptoFavorable([{ subrol: "tecnico", resultado: "aprobado" }], asignados)).toBe(false);
    expect(actaConConceptoFavorable([{ subrol: "tecnico", resultado: "aprobado" }, { subrol: "financiero", resultado: "aprobado_con_observaciones" }], asignados)).toBe(true);
  });
  it("sin técnico ni financiero asignados, decide el director", () => {
    expect(actaConConceptoFavorable([], ["administrativo"])).toBe(false);
    expect(actaConConceptoFavorable([{ subrol: "director", resultado: "aprobado" }], ["administrativo"])).toBe(true);
  });
});
