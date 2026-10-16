import { describe, expect, it } from "vitest";
import { guiaDeRuta } from "./guia-de-ruta";
import { GUIAS } from "./guias";

const ID = "8e6e8184-2e51-41ee-a903-2396c5a42212";
describe("guía según la pantalla", () => {
  it("módulos con ruta propia", () => {
    expect(guiaDeRuta(`/proyectos/${ID}/cambios/abc`)).toBe("cambios");
    expect(guiaDeRuta(`/proyectos/${ID}/presupuesto/partidas/nueva`)).toBe("presupuesto");
    expect(guiaDeRuta(`/proyectos/${ID}/interventoria/hallazgos`)).toBe("interventoria");
  });
  it("registros /r/…", () => {
    expect(guiaDeRuta(`/proyectos/${ID}/r/stakeholders`)).toBe("interesados");
    expect(guiaDeRuta(`/proyectos/${ID}/r/wbs/nuevo`)).toBe("edt");
    expect(guiaDeRuta(`/proyectos/${ID}/r/tareas/nuevo`)).toBe("cronograma");
    expect(guiaDeRuta(`/proyectos/${ID}/r/desconocido`)).toBeNull();
  });
  it("la ficha del proyecto no tiene guía", () => {
    expect(guiaDeRuta(`/proyectos/${ID}`)).toBeNull();
    expect(guiaDeRuta("/")).toBeNull();
  });
  it("toda guía a la que se enlaza existe", () => {
    const claves = new Set(GUIAS.map((g) => g.clave));
    for (const r of ["acta", "evm", "cambios", "reportes", "cronograma", "contratos", "bitacora", "documentos", "cierre", "presupuesto", "interventoria", "r/stakeholders", "r/wbs", "r/riesgos", "r/hitos", "r/reuniones", "r/lecciones", "r/tareas"]) {
      const g = guiaDeRuta(`/proyectos/${ID}/${r}`);
      expect(g, r).not.toBeNull();
      expect(claves.has(g!), r).toBe(true);
    }
  });
});
