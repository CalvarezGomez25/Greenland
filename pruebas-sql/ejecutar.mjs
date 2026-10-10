// Ejecuta todas las suites SQL (PGlite = PostgreSQL real en memoria) y falla si alguna comprobación falla.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const carpeta = fileURLToPath(new URL(".", import.meta.url));
const suites = fs.readdirSync(carpeta).filter((f) => /^t-.*\.mjs$/.test(f)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
let malas = 0, pasadas = 0;
for (const s of suites) {
  const r = spawnSync(process.execPath, [carpeta + s], { encoding: "utf8", timeout: 600_000 });
  const salida = (r.stdout ?? "") + (r.stderr ?? "");
  const n = (salida.match(/^\s+OK\s/gm) ?? []).length, f = (salida.match(/^\s+FALLA\s/gm) ?? []).length;
  pasadas += n; malas += f + (r.status === 0 ? 0 : 1);
  console.log(`${r.status === 0 && f === 0 ? "OK   " : "FALLA"} ${s}: ${n} comprobaciones, ${f} fallidas`);
  if (r.status !== 0 || f > 0) console.log(salida.split("\n").filter((l) => /FALLA|Error/.test(l)).slice(0, 15).join("\n"));
}
console.log(`\n${pasadas} comprobaciones correctas; ${malas} suites con fallos`);
process.exit(malas ? 1 : 0);
