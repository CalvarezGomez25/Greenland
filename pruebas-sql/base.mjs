import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
export const REPO = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const { aplicarMigraciones } = await import(`${REPO}/scripts/migrar.mjs`);

export const cuenta = { pasadas: 0, fallidas: 0 };
export const ok = (cond, msg) => { cond ? cuenta.pasadas++ : cuenta.fallidas++; console.log(`${cond ? "  OK   " : "  FALLA"} ${msg}`); };
export const seccion = (t) => console.log(`\n## ${t}`);

export const PRELUDIO = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text,
                           raw_user_meta_data jsonb not null default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean default false);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
  alter table storage.objects enable row level security;
  grant usage on schema public, auth, storage to anon, authenticated, service_role;
  grant select, insert on storage.objects to authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;
export const adaptador = (db) => ({
  async sql(t) { const r = await db.exec(t); return r.length ? r[r.length - 1].rows : []; },
});

export async function nuevaBase({ migrar = true } = {}) {
  const db = new PGlite();
  await db.exec(PRELUDIO);
  if (migrar) await aplicarMigraciones(adaptador(db), { log: () => {} });
  const q = (sql, params = []) => db.query(sql, params).then((r) => r.rows);
  async function como(uid, fn) {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false); set role ${uid ? "authenticated" : "anon"};`);
    try { return await fn(); } finally { await db.exec("reset role"); }
  }
  const esperaError = async (msg, promesa, patron) => {
    let r;
    try { await promesa; r = { rechazado: false }; }
    catch (e) { r = { rechazado: true, coincide: patron ? (patron.test(e.message) || patron.test(String(e.code))) : true, e }; }
    ok(r.rechazado && r.coincide, `${msg}${r.rechazado && !r.coincide ? `  [mensaje inesperado: ${r.e.message}]` : ""}${!r.rechazado ? "  [NO fue rechazado]" : ""}`);
  };
  async function usuario(correo, rolGlobal = null) {
    const [{ id }] = await q("insert into auth.users (email) values ($1) returning id", [correo]);
    if (rolGlobal) await q("update public.perfiles set rol_global = $1 where id = $2", [rolGlobal, id]);
    return id;
  }
  return { db, q, como, esperaError, usuario };
}
export const fin = () => { console.log(`\n==== RESULTADO: ${cuenta.pasadas} correctas, ${cuenta.fallidas} fallidas ====`); process.exit(cuenta.fallidas ? 1 : 0); };

// Asigna a un interventor (miembro del proyecto con rol interventoria) a un contrato de obra, con todos los alcances.
export async function asignarInterventor(q, P, I, { subrol = "director", alcances = ["tecnica", "administrativa", "financiera", "juridica", "contable", "disenos", "asesoria"], vigilado = true } = {}) {
  const [{ id: ci }] = await q("insert into public.contratos (proyecto_id, tipo, contratista, objeto, valor, retencion_pct) values ($1,'interventoria','Interventores SAS','Interventoría',100000000,10) returning id", [P]);
  let co = null;
  if (vigilado) [{ id: co }] = await q("insert into public.contratos (proyecto_id, tipo, contratista, objeto, valor, retencion_pct) values ($1,'obra','Constructora','Obra',1000000000,10) returning id", [P]);
  const [{ id: al }] = await q("insert into public.interventoria_alcances (proyecto_id, contrato_interventoria_id, contrato_vigilado_id, alcances) values ($1,$2,$3,$4) returning id", [P, ci, co, alcances]);
  await q("insert into public.interventoria_usuarios (alcance_id, usuario_id, subrol) values ($1,$2,$3)", [al, I, subrol]);
  return { alcance: al, contratoInterventoria: ci, contratoObra: co };
}
