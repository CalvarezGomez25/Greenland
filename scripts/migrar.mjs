// Aplica automáticamente las migraciones de supabase/migrations a la base de datos.
// Se ejecuta en cada despliegue (script "build"), antes de compilar la aplicación.
// - Si no hay DATABASE_URL, no hace nada (avisa y sigue).
// - Cada migración se aplica una sola vez y queda registrada en public.migraciones_aplicadas.
// - Cada archivo se envía en UNA sola llamada: si algo falla, no queda nada a medias.
// - Bases creadas a mano antes de existir este script: se reconocen (ver "reconocerBase").

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const CARPETA = path.join(AQUI, "..", "supabase");

export function listarMigraciones(carpeta = CARPETA) {
  return fs
    .readdirSync(path.join(carpeta, "migrations"))
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort();
}

const comillas = (t) => t.replace(/'/g, "''");

// db = { sql(texto) -> filas[] }  (una sola llamada, multi-sentencia permitida)
export async function aplicarMigraciones(db, { carpeta = CARPETA, log = console.log } = {}) {
  await db.sql(`create table if not exists public.migraciones_aplicadas (
    nombre text primary key, aplicada_en timestamptz not null default now());
    revoke all on public.migraciones_aplicadas from anon, authenticated;
    alter table public.migraciones_aplicadas enable row level security;`);

  const hechas = new Set((await db.sql("select nombre from public.migraciones_aplicadas")).map((r) => r.nombre));
  const archivos = listarMigraciones(carpeta);
  const leer = (f) => fs.readFileSync(path.join(carpeta, "migrations", f), "utf8");
  const marcar = (f) => `insert into public.migraciones_aplicadas (nombre) values ('${comillas(f)}') on conflict do nothing;`;
  const bloqueo = "select pg_advisory_xact_lock(871001);";

  // Bases creadas a mano con los archivos 0001 a 0004 (antes de existir este script).
  if (hechas.size === 0) {
    const [e] = await db.sql(`select
      to_regclass('public.perfiles') is not null as base,
      (to_regclass('public.capitulos') is not null and to_regclass('public.apu_partidas') is not null
        and to_regclass('public.costos_adicionales') is not null and to_regclass('public.gasto_mensual') is not null
        and to_regclass('public.cambios_presupuesto') is not null
        and to_regprocedure('public.partida_guardar(uuid,uuid,text,text,text,text,numeric,numeric,text)') is not null) as presupuesto,
      to_regprocedure('public.proyecto_editar(uuid,text,text,text,date,integer)') is not null as editar`);
    if (e.base) {
      log("Base existente reconocida: se registran 0001 y 0002 como ya aplicadas.");
      await db.sql(marcar("0001_cimientos.sql") + marcar("0002_ajustar_permisos.sql"));
      hechas.add("0001_cimientos.sql").add("0002_ajustar_permisos.sql");
      if (e.presupuesto) {
        await db.sql(marcar("0003_presupuesto.sql"));
        hechas.add("0003_presupuesto.sql");
        if (e.editar) {
          await db.sql(marcar("0004_editar_proyecto.sql"));
          hechas.add("0004_editar_proyecto.sql");
        }
      } else {
        // El presupuesto no está completo en la base: se instala todo de una vez (idempotente).
        log("El presupuesto no está completo: se instala 0003 y 0004 desde cero.");
        const todo = fs.readFileSync(path.join(carpeta, "instalar_hito2.sql"), "utf8");
        await db.sql(`${bloqueo}\n${todo}\n${marcar("0003_presupuesto.sql")}${marcar("0004_editar_proyecto.sql")}`);
        hechas.add("0003_presupuesto.sql").add("0004_editar_proyecto.sql");
      }
    }
  }

  let n = 0;
  for (const f of archivos) {
    if (hechas.has(f)) continue;
    log(`Aplicando ${f} ...`);
    try {
      await db.sql(`${bloqueo}\n${leer(f)}\n${marcar(f)}`);
    } catch (e) {
      throw new Error(`Falló la migración ${f}: ${e.message}`);
    }
    n++;
  }
  log(n === 0 ? "Base de datos al día." : `Se aplicaron ${n} migración(es).`);
  return n;
}

// Ejecución desde la línea de comandos / build
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("[migrar] DATABASE_URL no está definida: se omiten las migraciones de la base de datos.");
    process.exit(0);
  }
  const { default: pg } = await import("pg");
  const cliente = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 20000 });
  try {
    await cliente.connect();
    await aplicarMigraciones({
      async sql(texto) {
        const r = await cliente.query(texto);
        const ultimo = Array.isArray(r) ? r[r.length - 1] : r;
        return ultimo?.rows ?? [];
      },
    });
  } catch (e) {
    console.error("[migrar] ERROR:", e.message);
    process.exit(1);
  } finally {
    await cliente.end().catch(() => {});
  }
}
