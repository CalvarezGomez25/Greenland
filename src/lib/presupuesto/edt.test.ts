import { describe, expect, it } from "vitest";
import { costoPorElemento, nivelesDeEdt, nivelPorDefecto, opcionesDeNivel, type ElementoEdt } from "./edt";

const e = (id: string, padre_id: string | null, codigo: string): ElementoEdt => ({ id, padre_id, codigo, nombre: id });
const edt = [e("raiz", null, "1.0"), e("g", "raiz", "1.1"), e("c", "raiz", "1.3"), e("est", "c", "1.3.1"), e("cim", "est", "1.3.1.1")];

describe("EDT y presupuesto", () => {
  it("niveles: raíz 0, hijos 1, nietos 2…", () => {
    const n = nivelesDeEdt(edt);
    expect([n.get("raiz"), n.get("g"), n.get("est"), n.get("cim")]).toEqual([0, 1, 2, 3]);
  });
  it("opciones de nivel con la cantidad de elementos y el primero como propuesta", () => {
    const o = opcionesDeNivel(edt);
    expect(o.map((x) => [x.nivel, x.cantidad])).toEqual([[0, 1], [1, 2], [2, 1], [3, 1]]);
    expect(nivelPorDefecto(o)).toBe(1);
    expect(nivelPorDefecto(opcionesDeNivel([e("solo", null, "1")]))).toBe(0);
    expect(nivelPorDefecto([])).toBe(1);
  });
  it("el costo se suma hacia arriba y es null donde no hay capítulos", () => {
    const costos = costoPorElemento(edt, [{ wbsId: "g", subtotal: 100n }, { wbsId: "est", subtotal: 250n }, { wbsId: null, subtotal: 999n }]);
    expect(costos.get("g")).toBe(100n);
    expect(costos.get("est")).toBe(250n);
    expect(costos.get("c")).toBe(250n);
    expect(costos.get("raiz")).toBe(350n);
    expect(costos.get("cim")).toBeNull();
  });
  it("un capítulo en un elemento y otro en su descendiente se suman", () => {
    const costos = costoPorElemento(edt, [{ wbsId: "c", subtotal: 10n }, { wbsId: "est", subtotal: 5n }]);
    expect(costos.get("c")).toBe(15n);
  });
});
