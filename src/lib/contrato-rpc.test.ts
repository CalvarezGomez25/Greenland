import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// La aplicación llama a funciones de la base de datos por nombre y con parámetros con nombre.
// Si alguien cambia un lado y no el otro, solo se descubriría al usar la pantalla. Esta prueba
// recorre TODO el código, encuentra cada .rpc("nombre", { p_...: ... }) y lo compara con las firmas
// de las funciones en todas las migraciones (la última definición de cada función es la que vale).

const RAIZ = process.cwd();
const migraciones = readdirSync(resolve(RAIZ, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
const sql = migraciones.map((f) => readFileSync(resolve(RAIZ, "supabase/migrations", f), "utf8")).join("\n");

type Firma = { requeridos: string[]; todos: string[] };

function partirParametros(texto: string): string[] {
  const partes: string[] = [];
  let nivel = 0, actual = "";
  for (const c of texto) {
    if (c === "(") nivel++;
    if (c === ")") nivel--;
    if (c === "," && nivel === 0) { partes.push(actual); actual = ""; } else actual += c;
  }
  if (actual.trim()) partes.push(actual);
  return partes.map((p) => p.trim()).filter(Boolean);
}

function firmasSql(): Map<string, Firma> {
  const mapa = new Map<string, Firma>();
  for (const m of sql.matchAll(/create (?:or replace )?function public\.(\w+)\(([\s\S]*?)\)\s*(?:returns|language)/g)) {
    const params = partirParametros(m[2])
      .filter((p) => !/^out\s/i.test(p))
      .map((p) => ({ nombre: p.split(/\s+/)[0], conDefecto: /\bdefault\b/i.test(p) }));
    mapa.set(m[1], { todos: params.map((p) => p.nombre), requeridos: params.filter((p) => !p.conDefecto).map((p) => p.nombre) });
  }
  return mapa;
}

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const ruta = join(dir, f);
    if (statSync(ruta).isDirectory()) return f === "node_modules" ? [] : archivos(ruta);
    return /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) ? [ruta] : [];
  });
}

type Llamada = { archivo: string; nombre: string; parametros: string[] };

function llamadasRpc(): Llamada[] {
  const llamadas: Llamada[] = [];
  for (const archivo of archivos(resolve(RAIZ, "src"))) {
    const texto = readFileSync(archivo, "utf8");
    for (const m of texto.matchAll(/\.rpc\(\s*"(\w+)"\s*(,)?/g)) {
      const parametros: string[] = [];
      if (m[2]) {
        // Recorre los argumentos hasta el paréntesis que cierra, tomando las claves p_xxx del objeto de primer nivel.
        let i = (m.index ?? 0) + m[0].length, pParen = 1, pLlave = 0;
        let buffer = "";
        for (; i < texto.length && pParen > 0; i++) {
          const c = texto[i];
          if (c === "(") pParen++;
          else if (c === ")") pParen--;
          else if (c === "{") pLlave++;
          else if (c === "}") pLlave--;
          if (pLlave === 1 && pParen === 1) buffer += c;
          else if (pLlave === 1 && c === "{") buffer += c;
          if (pLlave !== 1 || pParen !== 1) buffer += " ";
        }
        for (const k of buffer.matchAll(/\b(p_\w+)\s*:/g)) parametros.push(k[1]);
      }
      llamadas.push({ archivo: archivo.replace(RAIZ, ""), nombre: m[1], parametros: [...new Set(parametros)] });
    }
  }
  return llamadas;
}

describe("contrato entre el código y las funciones SQL", () => {
  const firmas = firmasSql();
  const llamadas = llamadasRpc();

  it("encuentra las funciones y las llamadas (si no, la propia prueba estaría rota)", () => {
    expect(firmas.size).toBeGreaterThanOrEqual(40);
    expect(llamadas.length).toBeGreaterThanOrEqual(30);
  });

  for (const nombre of [...new Set(llamadas.map((l) => l.nombre))].sort()) {
    it(`${nombre}: existe y los parámetros coinciden`, () => {
      const firma = firmas.get(nombre);
      expect(firma, `la función ${nombre} no existe en las migraciones`).toBeDefined();
      for (const l of llamadas.filter((x) => x.nombre === nombre)) {
        const sobran = l.parametros.filter((p) => !firma!.todos.includes(p));
        const faltan = firma!.requeridos.filter((p) => !l.parametros.includes(p));
        expect(sobran, `${l.archivo}: parámetros que la función ${nombre} no tiene`).toEqual([]);
        expect(faltan, `${l.archivo}: parámetros obligatorios que faltan en la llamada a ${nombre}`).toEqual([]);
      }
    });
  }
});
