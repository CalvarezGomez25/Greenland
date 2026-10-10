import { describe, expect, it } from "vitest";
import { calcularPermisos } from "./permisos";

describe("permisos", () => {
  it("administrador y gerente gestionan; director, analista y finanzas solo ven", () => {
    expect(calcularPermisos("administrador", null).gestionar).toBe(true);
    expect(calcularPermisos(null, "gerente").gestionar).toBe(true);
    for (const r of ["director_general", "analista_pmo", "finanzas"] as const) {
      const p = calcularPermisos(r, null);
      expect(p.gestionar).toBe(false);
      expect(p.verTodo).toBe(true);
    }
  });
  it("interventoría tiene acceso reducido y no gestiona", () => {
    const p = calcularPermisos(null, "interventoria");
    expect(p.interventor).toBe(true);
    expect(p.gestionar).toBe(false);
    expect(p.verTodo).toBe(false);
  });
  it("el analista puede reportar; el supervisor no", () => {
    expect(calcularPermisos("analista_pmo", null).reportar).toBe(true);
    expect(calcularPermisos(null, "supervisor").reportar).toBe(false);
  });
  it("auditoría: administrador, director y gerente", () => {
    expect(calcularPermisos("director_general", null).verAuditoria).toBe(true);
    expect(calcularPermisos(null, "gerente").verAuditoria).toBe(true);
    expect(calcularPermisos("analista_pmo", null).verAuditoria).toBe(false);
  });
});
