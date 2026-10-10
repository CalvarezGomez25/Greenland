// El instalador único (supabase/instalar_todo.sql) debe dejar la base igual que el runner de migraciones.
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import { REPO, PRELUDIO, ok, seccion, fin } from "./base.mjs";
const { listarMigraciones } = await import(`${REPO}/scripts/migrar.mjs`);
const { generarInstalador } = await import(`${REPO}/scripts/generar-instalador.mjs`);
const todas = listarMigraciones();
const sql = generarInstalador();
const tablas = async (db) => (await db.query("select count(*)::int n from information_schema.tables where table_schema='public'")).rows[0].n;
const funciones = async (db) => (await db.query("select count(*)::int n from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public'")).rows[0].n;
const registradas = async (db) => (await db.query("select count(*)::int n from public.migraciones_aplicadas")).rows[0].n;

seccion("El archivo publicado está al día");
ok(fs.readFileSync(`${REPO}/supabase/instalar_todo.sql`, "utf8") === sql, "supabase/instalar_todo.sql coincide con las migraciones (ejecuta npm run generar:instalador)");

seccion("Base vacía; segunda ejecución sin efecto");
const { aplicarMigraciones, } = await import(`${REPO}/scripts/migrar.mjs`);
const ref = new PGlite(); await ref.exec(PRELUDIO);
await aplicarMigraciones({ sql: async (t) => { const r = await ref.exec(t); const u = r[r.length - 1]; return u?.rows ?? []; } }, { log: () => {} });
{ const db = new PGlite(); await db.exec(PRELUDIO);
  await db.exec(sql);
  ok(await registradas(db) === todas.length, `registra las ${todas.length} migraciones`);
  ok(await tablas(db) === await tablas(ref), "mismas tablas que el runner");
  ok(await funciones(db) === await funciones(ref), "mismas funciones que el runner");
  await db.exec(sql);
  ok(await registradas(db) === todas.length && await tablas(db) === await tablas(ref), "segunda ejecución: sin cambios ni errores"); }

seccion("Base creada a mano con 0001-0004");
{ const db = new PGlite(); await db.exec(PRELUDIO);
  for (const f of todas.slice(0, 4)) await db.exec(fs.readFileSync(`${REPO}/supabase/migrations/${f}`, "utf8"));
  await db.exec(sql);
  ok(await registradas(db) === todas.length && await tablas(db) === await tablas(ref), "reconoce la base y aplica solo lo nuevo"); }

seccion("Base con solo 0001-0002");
{ const db = new PGlite(); await db.exec(PRELUDIO);
  for (const f of todas.slice(0, 2)) await db.exec(fs.readFileSync(`${REPO}/supabase/migrations/${f}`, "utf8"));
  await db.exec(sql);
  ok(await registradas(db) === todas.length && await tablas(db) === await tablas(ref), "instala el presupuesto y lo demás"); }
fin();
