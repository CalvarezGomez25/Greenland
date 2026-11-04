import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cargarEventos, sumarDias } from "./eventos";

// Cliente falso: cada consulta devuelve las filas de su tabla, sin importar los filtros (los filtros los aplica la base).
function falso(tablas: Record<string, unknown[]>, vigencia: unknown[] = []) {
  const consulta = (t: string) => {
    const q: Record<string, unknown> = {};
    const h = { get: (_: unknown, k: string) => (k === "then" ? (res: (v: unknown) => void) => res({ data: tablas[t] ?? [], error: null }) : () => proxy) };
    const proxy: unknown = new Proxy(q, h);
    return proxy;
  };
  return { from: consulta, rpc: async () => ({ data: vigencia, error: null }) } as unknown as SupabaseClient;
}
const pr = { codigo: "GL-002", nombre: "Bodega norte" };
const hoy = "2026-11-04";

describe("eventos del calendario", () => {
  it("suma días a una fecha", () => {
    expect(sumarDias("2026-11-30", 1)).toBe("2026-12-01");
    expect(sumarDias("2026-11-04", -30)).toBe("2026-10-05");
  });
  it("reúne los seis tipos, con rótulo de proyecto, orden por fecha y enlace al registro", async () => {
    const db = falso({
      actividades: [{ id: "a1", titulo: "Entregar informe", fecha_limite: "2026-11-10", proyecto_id: "p1", proyectos: pr }],
      procesos: [{ id: "x1", codigo: "PR-01", objeto: "Redes", cierre_propuestas: "2026-11-09", proyecto_id: "p1", proyectos: pr }],
      contrato_polizas: [{ id: "z1", contrato_id: "c1", proyecto_id: "p1", amparo: "Cumplimiento", fecha_vencimiento: "2026-11-20", proyectos: pr }],
      contrato_comunicaciones: [{ id: "m1", contrato_id: "c1", proyecto_id: "p1", asunto: "Entregar planos", fecha_compromiso: "2026-11-05", proyectos: pr }],
      contratos: [{ id: "c1", proyecto_id: "p1", contratista: "ACME S.A.S.", tercero_id: "t1", fecha_fin_vigente: "2026-12-15", proyectos: pr }],
    }, [{ tercero_id: "t1", tipo: "RUT", fecha_vencimiento: "2027-01-10" }]);
    const ev = await cargarEventos(db, "u1", hoy, "https://app.test");
    expect(ev.map((e) => e.tipo)).toEqual(["compromiso", "proceso", "actividad", "poliza", "contrato", "documento"]);
    expect(ev[0].titulo).toBe("[GL-002] Compromiso: Entregar planos");
    expect(ev.find((e) => e.tipo === "poliza")?.titulo).toBe("[GL-002] Vence póliza «Cumplimiento» de ACME S.A.S.");
    expect(ev.find((e) => e.tipo === "proceso")?.url).toBe("https://app.test/proyectos/p1/procesos/x1");
    expect(ev.find((e) => e.tipo === "documento")?.titulo).toBe("Vence RUT de ACME S.A.S.");
    expect(new Set(ev.map((e) => e.uid)).size).toBe(ev.length);
  });
  it("descarta fines de contrato y documentos fuera de la ventana (30 días atrás, 365 adelante)", async () => {
    const db = falso({
      contratos: [
        { id: "c1", proyecto_id: "p1", contratista: "A", tercero_id: "t1", fecha_fin_vigente: "2026-01-01", proyectos: pr },
        { id: "c2", proyecto_id: "p1", contratista: "B", tercero_id: null, fecha_fin_vigente: "2028-01-01", proyectos: pr },
        { id: "c3", proyecto_id: "p1", contratista: "C", tercero_id: null, fecha_fin_vigente: null, proyectos: pr },
      ],
    }, [{ tercero_id: "t1", tipo: "RUT", fecha_vencimiento: "2020-01-01" }]);
    expect(await cargarEventos(db, "u1", hoy)).toEqual([]);
  });
  it("sin base devuelve una lista vacía y no falla", async () => {
    expect(await cargarEventos(falso({}), "u1", hoy)).toEqual([]);
  });
});
