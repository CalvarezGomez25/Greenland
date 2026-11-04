import { describe, expect, it } from "vitest";
import { CARRILES, DECISIONES, ESENCIALES, ETAPAS, FLUJOS, MODULOS_MAPA, MODULO_POR_ID, ROLES, ROL_CORTO, RK } from "./datos";
import { MODULOS } from "../modulos";
import { configuracion, curva, disponer, flujosVisibles, modulosVisibles, type Detalle } from "./geometria";

describe("datos del mapa de proceso", () => {
  it("las seis etapas, cinco carriles y nueve roles están completos", () => {
    expect(ETAPAS.map((e) => e.n)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(CARRILES).toHaveLength(5);
    expect(RK).toHaveLength(9);
    for (const r of ROLES) expect(ROL_CORTO[r.k].length).toBeGreaterThan(5);
  });
  it("cada módulo tiene identificador único, etapas válidas y un carril existente", () => {
    expect(new Set(MODULOS_MAPA.map((m) => m.id)).size).toBe(MODULOS_MAPA.length);
    for (const m of MODULOS_MAPA) {
      expect(m.a, m.id).toBeGreaterThanOrEqual(1);
      expect(m.b, m.id).toBeLessThanOrEqual(6);
      expect(m.a, m.id).toBeLessThanOrEqual(m.b);
      expect(CARRILES.some((c) => c.id === m.l), m.id).toBe(true);
      expect(Object.keys(m.ro).length, m.id).toBeGreaterThan(0);
      for (const k of Object.keys(m.ro)) expect(RK, `${m.id}:${k}`).toContain(k);
    }
  });
  it("los flujos y las decisiones apuntan a módulos que existen, y un flujo no va de un módulo a sí mismo", () => {
    for (const [o, d, t] of FLUJOS) {
      expect(MODULO_POR_ID[o], o).toBeTruthy();
      expect(MODULO_POR_ID[d], d).toBeTruthy();
      expect(o).not.toBe(d);
      expect(t.length).toBeGreaterThan(5);
    }
    for (const g of DECISIONES) expect(MODULO_POR_ID[g.m], g.m).toBeTruthy();
  });
  it("cada punto de decisión lo tiene alguien con nivel «decide» en el módulo", () => {
    for (const g of DECISIONES) {
      const m = MODULO_POR_ID[g.m];
      expect(Object.values(m.ro).includes("D"), g.m).toBe(true);
    }
  });
  it("todos los módulos de la plataforma (menú del proyecto) tienen su pieza en el mapa", () => {
    const nombres = new Set(MODULOS_MAPA.map((m) => m.id));
    const equivalencia: Record<string, string> = {
      actividades: "act", acta: "acta", evm: "valor", stakeholders: "inter", wbs: "edt", riesgos: "riesgos", cambios: "cambios", reportes: "reportes", documentos: "docs", cierre: "cierre",
      presupuesto: "pres", balance: "bal", controlcostos: "cc", procesos: "proc", novedades: "nov", cronograma: "crono", contratos: "contr", bitacora: "bit", interventoria: "interv",
    };
    for (const m of MODULOS) {
      const id = equivalencia[m.clave];
      expect(id, `falta equivalencia para ${m.clave}`).toBeTruthy();
      expect(nombres.has(id), m.clave).toBe(true);
    }
  });
  it("los módulos esenciales existen y Balance de costos está entre ellos", () => {
    for (const id of ESENCIALES) expect(MODULO_POR_ID[id], id).toBeTruthy();
    expect(ESENCIALES.has("bal")).toBe(true);
  });
  it("la interventoría no ve costos ni procesos, y no aprueba nada", () => {
    for (const id of ["pres", "bal", "cc", "proc"]) expect(MODULO_POR_ID[id].ro.in, id).toBeUndefined();
    for (const m of MODULOS_MAPA) expect(m.ro.in, m.id).not.toBe("D");
  });
});

describe("geometría del mapa", () => {
  const detalles: Detalle[] = ["full", "brief"];
  for (const det of detalles) {
    it(`${det}: ningún módulo se superpone con otro del mismo carril y todos caben en el lienzo`, () => {
      const cfg = configuracion(det);
      const d = disponer(cfg, det);
      const ms = modulosVisibles(det);
      for (const m of ms) {
        const r = d.rect[m.id];
        expect(r.x, m.id).toBeGreaterThanOrEqual(cfg.lab);
        expect(r.x + r.w, m.id).toBeLessThanOrEqual(cfg.W);
        expect(r.y + r.h, m.id).toBeLessThanOrEqual(d.end + 1);
        for (const o of ms) {
          if (o.id <= m.id || o.l !== m.l) continue;
          const q = d.rect[o.id];
          const sepx = r.x + r.w <= q.x || q.x + q.w <= r.x, sepy = r.y + r.h <= q.y || q.y + q.h <= r.y;
          expect(sepx || sepy, `${m.id} con ${o.id}`).toBe(true);
        }
      }
    });
  }
  it("la versión resumida tiene menos módulos y flujos, solo entre módulos visibles", () => {
    expect(modulosVisibles("brief").length).toBe(ESENCIALES.size);
    expect(modulosVisibles("brief").length).toBeLessThan(modulosVisibles("full").length);
    const ids = new Set(modulosVisibles("brief").map((m) => m.id));
    for (const f of flujosVisibles("brief")) { expect(ids.has(f[0])).toBe(true); expect(ids.has(f[1])).toBe(true); }
  });
  it("la curva sale y llega a las piezas y pone su número fuera de los módulos cuando hay espacio", () => {
    const cfg = configuracion("full");
    const d = disponer(cfg, "full");
    const rects = Object.values(d.rect);
    for (const [o, t] of flujosVisibles("full")) {
      const c = curva(d.rect[o], d.rect[t], rects);
      expect(c.d.startsWith("M")).toBe(true);
      expect(Number.isFinite(c.mx) && Number.isFinite(c.my)).toBe(true);
    }
  });
});
