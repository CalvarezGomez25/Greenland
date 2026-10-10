// Genera supabase/instalar_todo.sql: UN solo archivo con todas las migraciones, para pegarlo en el
// SQL Editor de Supabase cuando no se usa DATABASE_URL. Es seguro repetirlo: cada migración se aplica
// una sola vez (queda en public.migraciones_aplicadas) y reconoce bases creadas a mano con 0001–0004.
// Uso: npm run generar:instalador
import fs from "node:fs";
import path from "node:path";
import { CARPETA, listarMigraciones } from "./migrar.mjs";

const leer = (f) => fs.readFileSync(path.join(CARPETA, f), "utf8");
const marca = (f) => `insert into public.migraciones_aplicadas (nombre) values ('${f}') on conflict do nothing;`;

export function generarInstalador() {
  const partes = [];
  partes.push(`-- INSTALADOR COMPLETO de la base de datos (generado con "npm run generar:instalador").
-- Pégalo ENTERO en Supabase -> SQL Editor -> Run. Se puede ejecutar más de una vez sin problema.
create table if not exists public.migraciones_aplicadas (
  nombre text primary key, aplicada_en timestamptz not null default now());
revoke all on public.migraciones_aplicadas from anon, authenticated;
alter table public.migraciones_aplicadas enable row level security;
`);
  partes.push(`-- Base creada a mano antes de existir este instalador (archivos 0001 a 0004)
do $mig$ begin
  if not exists (select 1 from public.migraciones_aplicadas) and to_regclass('public.perfiles') is not null then
    ${marca("0001_cimientos.sql")} ${marca("0002_ajustar_permisos.sql")}
    if to_regclass('public.capitulos') is not null and to_regclass('public.apu_partidas') is not null
       and to_regclass('public.costos_adicionales') is not null and to_regclass('public.gasto_mensual') is not null
       and to_regclass('public.cambios_presupuesto') is not null
       and to_regprocedure('public.partida_guardar(uuid,uuid,text,text,text,text,numeric,numeric,text)') is not null then
      ${marca("0003_presupuesto.sql")}
      if to_regprocedure('public.proyecto_editar(uuid,text,text,text,date,integer)') is not null then
        ${marca("0004_editar_proyecto.sql")}
      end if;
    else
      execute $inst$
${leer("instalar_hito2.sql")}
      $inst$;
      ${marca("0003_presupuesto.sql")} ${marca("0004_editar_proyecto.sql")}
    end if;
  end if;
end $mig$;
`);
  for (const f of listarMigraciones()) {
    const etiqueta = "m" + f.slice(0, 4);
    partes.push(`-- ${f}
do $mig$ begin
  if not exists (select 1 from public.migraciones_aplicadas where nombre = '${f}') then
    execute $${etiqueta}$
${leer(`migrations/${f}`)}
    $${etiqueta}$;
    ${marca(f)}
  end if;
end $mig$;
`);
  }
  partes.push("select nombre, aplicada_en from public.migraciones_aplicadas order by nombre;\n");
  return partes.join("\n");
}

import { fileURLToPath } from "node:url";
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.writeFileSync(path.join(CARPETA, "instalar_todo.sql"), generarInstalador());
  console.log("Generado supabase/instalar_todo.sql");
}
