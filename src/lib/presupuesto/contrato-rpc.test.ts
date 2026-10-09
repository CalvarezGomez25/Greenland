import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// La aplicación llama a funciones de la base de datos por nombre y con parámetros con nombre.
// Si alguien cambia un lado y no el otro, solo se descubriría al usar la pantalla. Esta prueba
// compara las llamadas de acciones.ts con las firmas de las funciones de 0003_presupuesto.sql.

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), "utf8");
const sql = leer("supabase/migrations/0003_presupuesto.sql");
const acciones = leer("src/app/(app)/proyectos/[id]/presupuesto/acciones.ts");

type Firma = { requeridos: string[]; todos: string[] };

function firmasSql(): Map<string, Firma> {
  const mapa = new Map<string, Firma>();
  for (const m of sql.matchAll(/create function public\.(\w+)\(([\s\S]*?)\)\s*returns/g)) {
    const params = m[2]
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => ({ nombre: p.split(/\s+/)[0], conDefecto: /\bdefault\b/i.test(p) }));
    mapa.set(m[1], { todos: params.map((p) => p.nombre), requeridos: params.filter((p) => !p.conDefecto).map((p) => p.nombre) });
  }
  return mapa;
}

function llamadasRpc(): { nombre: string; parametros: string[] }[] {
  const llamadas: { nombre: string; parametros: string[] }[] = [];
  for (const m of acciones.matchAll(/\.rpc\("(\w+)",([\s\S]*?)\);/g)) {
    llamadas.push({ nombre: m[1], parametros: [...new Set([...m[2].matchAll(/\b(p_\w+)\s*:/g)].map((x) => x[1]))] });
  }
  return llamadas;
}

describe("contrato entre las acciones y las funciones SQL", () => {
  const firmas = firmasSql();
  const llamadas = llamadasRpc();

  it("encuentra las funciones y las llamadas (si no, la propia prueba estaría rota)", () => {
    expect(firmas.size).toBeGreaterThanOrEqual(8);
    expect(llamadas.map((l) => l.nombre).sort()).toEqual(
      [
        "costo_adicional_borrar",
        "costo_adicional_guardar",
        "costos_adicionales_plantilla",
        "gasto_borrar_mes",
        "gasto_registrar",
        "partida_borrar",
        "partida_guardar",
        "presupuesto_importar",
      ].sort(),
    );
  });

  for (const llamada of llamadasRpc()) {
    it(`${llamada.nombre}: existe y los parámetros coinciden`, () => {
      const firma = firmas.get(llamada.nombre);
      expect(firma, `la función ${llamada.nombre} no existe en el SQL`).toBeDefined();
      const sobrantes = llamada.parametros.filter((p) => !firma!.todos.includes(p));
      const faltantes = firma!.requeridos.filter((p) => !llamada.parametros.includes(p));
      expect(sobrantes, "parámetros que el SQL no conoce").toEqual([]);
      expect(faltantes, "parámetros obligatorios que la llamada no envía").toEqual([]);
    });
  }
});
