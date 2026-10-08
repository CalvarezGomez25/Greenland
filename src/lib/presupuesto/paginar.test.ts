import { describe, expect, it } from "vitest";
import { leerTodo, TAMANO_PAGINA } from "./paginar";

// Simula a Supabase: devuelve el trozo pedido y registra cuántas consultas se hicieron.
function origen(total: number) {
  const filas = Array.from({ length: total }, (_, i) => i);
  const llamadas: [number, number][] = [];
  const pedir = async (desde: number, hasta: number) => {
    llamadas.push([desde, hasta]);
    return { data: filas.slice(desde, hasta + 1), error: null };
  };
  return { filas, llamadas, pedir };
}

describe("leerTodo", () => {
  it("una sola página cuando hay pocas filas", async () => {
    const o = origen(10);
    expect(await leerTodo(o.pedir)).toEqual(o.filas);
    expect(o.llamadas).toEqual([[0, 999]]);
  });

  it("junta varias páginas sin perder ni repetir filas", async () => {
    const o = origen(2500);
    const r = await leerTodo(o.pedir);
    expect(r).toHaveLength(2500);
    expect(r).toEqual(o.filas);
    expect(o.llamadas).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("con un múltiplo exacto del tamaño de página pide una más para confirmar que terminó", async () => {
    const o = origen(2 * TAMANO_PAGINA);
    expect(await leerTodo(o.pedir)).toHaveLength(2000);
    expect(o.llamadas).toHaveLength(3);
  });

  it("sin filas devuelve una lista vacía", async () => {
    expect(await leerTodo(origen(0).pedir)).toEqual([]);
  });

  it("propaga el error de la base de datos", async () => {
    await expect(leerTodo(async () => ({ data: null, error: { message: "sin permiso" } }))).rejects.toThrow("sin permiso");
  });

  it("falla en voz alta si supera el máximo en vez de devolver datos incompletos", async () => {
    await expect(leerTodo(origen(5000).pedir, 3000)).rejects.toThrow(/máximo/);
  });
});
