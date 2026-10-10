import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import { REPO, PRELUDIO, adaptador, ok, seccion, fin } from "./base.mjs";
const { aplicarMigraciones, listarMigraciones } = await import(`${REPO}/scripts/migrar.mjs`);
const todas = listarMigraciones();
const aplicadas = async (db) => (await db.query("select nombre from public.migraciones_aplicadas order by 1")).rows.map(r => r.nombre);

seccion("Base vacía: se aplican todas, y la segunda vez no hace nada");
{ const db = new PGlite(); await db.exec(PRELUDIO);
  const n = await aplicarMigraciones(adaptador(db), { log: () => {} });
  ok(n === todas.length, `aplica ${n} de ${todas.length}`);
  ok(await aplicarMigraciones(adaptador(db), { log: () => {} }) === 0, "segunda ejecución: 0 migraciones"); }

seccion("Base creada a mano con 0001-0004: se reconoce y solo aplica las nuevas");
{ const db = new PGlite(); await db.exec(PRELUDIO);
  for (const f of todas.slice(0, 4)) await db.exec(fs.readFileSync(`${REPO}/supabase/migrations/${f}`, "utf8"));
  const n = await aplicarMigraciones(adaptador(db), { log: () => {} });
  ok(n === todas.length - 4, `aplica solo las nuevas (${n})`);
  ok((await aplicadas(db)).length === todas.length, "todas quedan registradas"); }

seccion("Base con solo 0001-0002 (presupuesto no instalado): instala todo");
{ const db = new PGlite(); await db.exec(PRELUDIO);
  for (const f of todas.slice(0, 2)) await db.exec(fs.readFileSync(`${REPO}/supabase/migrations/${f}`, "utf8"));
  const n = await aplicarMigraciones(adaptador(db), { log: () => {} });
  ok(n === todas.length - 4, "instala 0003/0004 por el script único y sigue con las nuevas");
  const r = await db.query("select to_regclass('public.apu_partidas') as t"); ok(r.rows[0].t !== null, "tabla apu_partidas existe"); }

seccion("Una migración que falla no deja nada a medias");
{ const db = new PGlite(); await db.exec(PRELUDIO);
  const tmp = fs.mkdtempSync("/tmp/mig-"); fs.mkdirSync(`${tmp}/migrations`);
  fs.writeFileSync(`${tmp}/migrations/0001_a.sql`, "create table public.a (x int);");
  fs.writeFileSync(`${tmp}/migrations/0002_b.sql`, "create table public.b (x int); select 1/0;");
  let fallo = false; try { await aplicarMigraciones(adaptador(db), { carpeta: tmp, log: () => {} }); } catch { fallo = true; }
  ok(fallo, "lanza error");
  ok((await db.query("select to_regclass('public.b') as t")).rows[0].t === null, "la tabla b NO quedó creada");
  ok((await aplicadas(db)).join() === "0001_a.sql", "solo 0001 registrada"); }
fin();
