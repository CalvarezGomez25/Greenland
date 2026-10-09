import { describe, expect, it } from "vitest";
import { describirCambio, type CambioFila } from "./cambios";

const base = { id: 1, fecha: "2026-10-09T15:00:00Z", usuario_nombre: "Ana", registro_id: "x", motivo: null };
const fila = (c: Partial<CambioFila>): CambioFila =>
  ({ ...base, entidad: "partida", operacion: "editar", antes: null, despues: null, ...c }) as CambioFila;

// Formas reales: así guarda la base de datos las filas (probado contra PostgreSQL).
const partida = { id: "p", codigo: "1.01", descripcion: "Replanteo", unidad: "m2", cantidad: 1200.0, precio_unitario: 4500.5, capitulo_id: "c1", proyecto_id: "pr" };

describe("describirCambio: partidas", () => {
  it("edición: lista solo lo que cambió, con formato colombiano", () => {
    const r = describirCambio(fila({ antes: partida, despues: { ...partida, cantidad: 1500, precio_unitario: 5000 } }));
    expect(r.titulo).toBe("Partida editada: 1.01 — Replanteo");
    expect(r.detalles).toEqual(["Cantidad: 1.200 → 1.500", "Precio unitario: 4.500,5 → 5.000"]);
  });

  it("edición con cambio de capítulo", () => {
    const r = describirCambio(fila({ antes: partida, despues: { ...partida, capitulo_id: "c2" } }));
    expect(r.detalles).toEqual(["Cambió de capítulo"]);
  });

  it("creación y borrado muestran los valores", () => {
    const creada = describirCambio(fila({ operacion: "crear", despues: partida }));
    expect(creada.titulo).toBe("Partida creada: 1.01 — Replanteo");
    expect(creada.detalles).toEqual(["Unidad: m2", "Cantidad: 1.200", "Precio unitario: 4.500,5"]);
    const borrada = describirCambio(fila({ operacion: "borrar", antes: partida }));
    expect(borrada.titulo).toBe("Partida eliminada: 1.01 — Replanteo");
  });
});

describe("describirCambio: importación", () => {
  it("resume antes y después", () => {
    const r = describirCambio(
      fila({
        entidad: "importacion",
        operacion: "importar",
        antes: { partidas: 3, capitulos: 1, costo_directo: 2000 },
        despues: { partidas: 10, capitulos: 5, costo_directo: 1231970000 },
      }),
    );
    expect(r.titulo).toBe("Presupuesto importado desde un archivo");
    expect(r.detalles).toEqual([
      "Antes: 3 partidas en 1 capítulos, costo directo $ 2.000",
      "Después: 10 partidas en 5 capítulos, costo directo $ 1.231.970.000",
    ]);
  });
});

describe("describirCambio: costos adicionales", () => {
  const linea = { id: "l", nombre: "IVA sobre la utilidad", base: "linea", linea_base_id: "u", porcentaje: 19 };
  it("edición del porcentaje", () => {
    const r = describirCambio(fila({ entidad: "costo_adicional", antes: linea, despues: { ...linea, porcentaje: 16 } }));
    expect(r.titulo).toBe("Costo adicional editado: IVA sobre la utilidad");
    expect(r.detalles).toEqual(["Porcentaje: 19 % → 16 %"]);
  });
  it("creación", () => {
    const r = describirCambio(fila({ entidad: "costo_adicional", operacion: "crear", despues: linea }));
    expect(r.detalles).toEqual(["Porcentaje: 19 %", "Se calcula sobre: Otra línea"]);
  });
  it("cambio de la línea base", () => {
    const r = describirCambio(fila({ entidad: "costo_adicional", antes: linea, despues: { ...linea, linea_base_id: "otra" } }));
    expect(r.detalles).toEqual(["Cambió la línea base"]);
  });
});

describe("describirCambio: gasto mensual y capítulos", () => {
  it("registro, corrección y borrado de un mes", () => {
    const g = { proyecto_id: "p", mes: 3, valor_real: 46000000.5 };
    expect(describirCambio(fila({ entidad: "gasto_mensual", operacion: "crear", despues: g }))).toEqual({
      titulo: "Gasto del mes 3 registrado",
      detalles: ["Valor: $ 46.000.001"],
    });
    expect(describirCambio(fila({ entidad: "gasto_mensual", antes: { ...g, valor_real: 1000 }, despues: g })).detalles).toEqual([
      "Valor: $ 1.000 → $ 46.000.001",
    ]);
    expect(describirCambio(fila({ entidad: "gasto_mensual", operacion: "borrar", antes: g })).titulo).toBe("Gasto del mes 3 eliminado");
  });

  it("capítulos", () => {
    expect(describirCambio(fila({ entidad: "capitulo", operacion: "crear", despues: { nombre: "Acabados" } })).titulo).toBe("Capítulo creado: Acabados");
    expect(describirCambio(fila({ entidad: "capitulo", operacion: "borrar", antes: { nombre: "Acabados" } })).titulo).toBe("Capítulo eliminado: Acabados");
  });

  it("un valor ilegible se muestra tal cual, sin romper la pantalla", () => {
    const r = describirCambio(fila({ entidad: "gasto_mensual", operacion: "crear", despues: { mes: 1, valor_real: "no-es-numero" } }));
    expect(r.detalles).toEqual(["Valor: no-es-numero"]);
  });
});
