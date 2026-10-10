-- INSTALADOR COMPLETO de la base de datos (generado con "npm run generar:instalador").
-- Pégalo ENTERO en Supabase -> SQL Editor -> Run. Se puede ejecutar más de una vez sin problema.
create table if not exists public.migraciones_aplicadas (
  nombre text primary key, aplicada_en timestamptz not null default now());
revoke all on public.migraciones_aplicadas from anon, authenticated;
alter table public.migraciones_aplicadas enable row level security;

-- Base creada a mano antes de existir este instalador (archivos 0001 a 0004)
do $mig$ begin
  if not exists (select 1 from public.migraciones_aplicadas) and to_regclass('public.perfiles') is not null then
    insert into public.migraciones_aplicadas (nombre) values ('0001_cimientos.sql') on conflict do nothing; insert into public.migraciones_aplicadas (nombre) values ('0002_ajustar_permisos.sql') on conflict do nothing;
    if to_regclass('public.capitulos') is not null and to_regclass('public.apu_partidas') is not null
       and to_regclass('public.costos_adicionales') is not null and to_regclass('public.gasto_mensual') is not null
       and to_regclass('public.cambios_presupuesto') is not null
       and to_regprocedure('public.partida_guardar(uuid,uuid,text,text,text,text,numeric,numeric,text)') is not null then
      insert into public.migraciones_aplicadas (nombre) values ('0003_presupuesto.sql') on conflict do nothing;
      if to_regprocedure('public.proyecto_editar(uuid,text,text,text,date,integer)') is not null then
        insert into public.migraciones_aplicadas (nombre) values ('0004_editar_proyecto.sql') on conflict do nothing;
      end if;
    else
      execute $inst$
-- =============================================================================
-- INSTALACIÓN COMPLETA DEL HITO 2 (presupuesto + editar proyecto) — UN SOLO PASO
-- Se puede ejecutar cuantas veces haga falta: primero borra lo que haya del
-- presupuesto (solo datos de prueba) y lo vuelve a crear completo.
-- NO toca: usuarios, perfiles, proyectos ni miembros.
-- =============================================================================

drop table if exists public.cambios_presupuesto, public.gasto_mensual,
  public.costos_adicionales, public.apu_partidas, public.capitulos cascade;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as firma
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'es_gerente_proyecto','puede_ver_proyecto','puede_editar_presupuesto','puede_ver_auditoria',
      'exigir_edicion_presupuesto','fijar_motivo','auditar_cambio','limpiar_capitulos_vacios',
      'partida_guardar','partida_borrar','presupuesto_importar','costo_adicional_guardar',
      'costo_adicional_borrar','costos_adicionales_plantilla','gasto_registrar','gasto_borrar_mes',
      'proyecto_editar')
  loop
    execute 'drop function ' || f.firma || ' cascade';
  end loop;
end $$;

-- =============================================================================
-- Hito 2 (Presupuesto y costos): capítulos, partidas (APU), costos adicionales,
-- gasto real mensual y registro automático de cambios.
-- Ejecutar UNA sola vez en Supabase > SQL Editor, después de 0001 y 0002.
--
-- Diseño en una frase: TODOS pueden LEER (según su acceso al proyecto), pero
-- NADIE escribe directamente en las tablas. Todo cambio pasa por funciones que
-- verifican permisos, validan los datos y dejan constancia en el registro de
-- cambios. Así el registro no se puede saltar desde la aplicación.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. TABLAS
-- -----------------------------------------------------------------------------

-- Capítulos del presupuesto (un solo nivel: capítulo y partida).
create table public.capitulos (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos (id) on delete cascade,
  codigo      text not null,
  nombre      text not null check (length(btrim(nombre)) > 0),
  orden       integer not null check (orden > 0),
  creado_en   timestamptz not null default now(),
  unique (id, proyecto_id),
  unique (proyecto_id, codigo)
);
-- Un nombre de capítulo no se repite dentro del proyecto (sin distinguir mayúsculas).
create unique index capitulos_nombre_unico on public.capitulos (proyecto_id, lower(nombre));

-- Partidas del presupuesto (APU). Siempre pertenecen a un capítulo DEL MISMO proyecto.
create table public.apu_partidas (
  id              uuid primary key default gen_random_uuid(),
  proyecto_id     uuid not null references public.proyectos (id) on delete cascade,
  capitulo_id     uuid not null,
  codigo          text not null check (length(btrim(codigo)) > 0),
  descripcion     text not null check (length(btrim(descripcion)) > 0),
  unidad          text not null check (length(btrim(unidad)) > 0),
  cantidad        numeric(18, 4) not null check (cantidad >= 0),
  precio_unitario numeric(18, 2) not null check (precio_unitario >= 0),
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  unique (proyecto_id, codigo),
  foreign key (capitulo_id, proyecto_id) references public.capitulos (id, proyecto_id)
);
create index apu_partidas_capitulo_idx on public.apu_partidas (proyecto_id, capitulo_id);

-- Costos adicionales del proyecto (AIU, IVA, retefuente...). Cada línea se calcula como
-- un porcentaje del costo directo, o como un porcentaje de OTRA línea (p. ej. IVA sobre
-- la utilidad). La plataforma no fija tasas: las define quien edita el presupuesto.
create table public.costos_adicionales (
  id             uuid primary key default gen_random_uuid(),
  proyecto_id    uuid not null references public.proyectos (id) on delete cascade,
  nombre         text not null check (length(btrim(nombre)) > 0),
  base           text not null check (base in ('costo_directo', 'linea')),
  linea_base_id  uuid,
  porcentaje     numeric(8, 4) not null check (porcentaje >= 0 and porcentaje <= 100),
  orden          integer not null default 0,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (id, proyecto_id),
  foreign key (linea_base_id, proyecto_id) references public.costos_adicionales (id, proyecto_id),
  check ((base = 'costo_directo' and linea_base_id is null)
      or (base = 'linea' and linea_base_id is not null)),
  check (linea_base_id is distinct from id)
);
create unique index costos_adicionales_nombre_unico
  on public.costos_adicionales (proyecto_id, lower(nombre));

-- Gasto real por mes (mes 1 = primer mes del proyecto), en pesos.
create table public.gasto_mensual (
  proyecto_id    uuid not null references public.proyectos (id) on delete cascade,
  mes            integer not null check (mes >= 1),
  valor_real     numeric(18, 2) not null check (valor_real >= 0),
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  primary key (proyecto_id, mes)
);

-- Registro de cambios: quién, cuándo, qué había antes y qué hay ahora.
-- Solo se lee: nadie puede editarlo ni borrarlo desde la aplicación.
create table public.cambios_presupuesto (
  id             bigint generated always as identity primary key,
  proyecto_id    uuid not null references public.proyectos (id),
  fecha          timestamptz not null default now(),
  usuario_id     uuid,
  usuario_nombre text,
  entidad        text not null check (entidad in
                   ('partida', 'capitulo', 'costo_adicional', 'gasto_mensual', 'importacion')),
  operacion      text not null check (operacion in ('crear', 'editar', 'borrar', 'importar')),
  registro_id    text,
  antes          jsonb,
  despues        jsonb,
  motivo         text
);
create index cambios_presupuesto_proyecto_idx on public.cambios_presupuesto (proyecto_id, fecha desc);


-- -----------------------------------------------------------------------------
-- 2. FUNCIONES DE PERMISOS
--    Ver el presupuesto: cualquiera con acceso al proyecto (Administrador, Director
--    general y todos los miembros, incluido el Supervisor).
--    Modificarlo: Administrador y Gerente del proyecto.
--    Ver el registro de cambios: Administrador, Director general y Gerente del proyecto.
-- -----------------------------------------------------------------------------
create function public.es_gerente_proyecto(p_proyecto uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.miembros_proyecto
    where proyecto_id = p_proyecto and usuario_id = auth.uid() and rol = 'gerente'
  );
$$;

create function public.puede_ver_proyecto(p_proyecto uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.ve_todos() or public.es_miembro(p_proyecto);
$$;

create function public.puede_editar_presupuesto(p_proyecto uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.es_admin() or public.es_gerente_proyecto(p_proyecto);
$$;

create function public.puede_ver_auditoria(p_proyecto uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.ve_todos() or public.es_gerente_proyecto(p_proyecto);
$$;

-- Uso interno de las funciones de escritura: corta la operación si no hay permiso.
create function public.exigir_edicion_presupuesto(p_proyecto uuid)
returns void language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  if not public.puede_editar_presupuesto(p_proyecto) then
    raise exception 'No tienes permiso para modificar el presupuesto de este proyecto.'
      using errcode = '42501';
  end if;
end;
$$;

-- Uso interno: motivo del cambio (obligatorio o no) para el registro de cambios.
create function public.fijar_motivo(p_motivo text, p_obligatorio boolean)
returns text language plpgsql security definer set search_path = ''
as $$
declare v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  if p_obligatorio and (v_motivo is null or length(v_motivo) < 3) then
    raise exception 'El motivo es obligatorio (mínimo 3 caracteres).' using errcode = '22023';
  end if;
  if v_motivo is not null and length(v_motivo) > 500 then
    raise exception 'El motivo no puede superar 500 caracteres.' using errcode = '22023';
  end if;
  -- "true" = vale solo durante esta operación
  perform set_config('app.motivo', coalesce(v_motivo, ''), true);
  return v_motivo;
end;
$$;


-- -----------------------------------------------------------------------------
-- 3. AUTOMATISMOS
-- -----------------------------------------------------------------------------

-- 3a. Fecha de última modificación.
create trigger apu_partidas_actualizado before update on public.apu_partidas
  for each row execute function public.marcar_actualizado();
create trigger costos_adicionales_actualizado before update on public.costos_adicionales
  for each row execute function public.marcar_actualizado();
create trigger gasto_mensual_actualizado before update on public.gasto_mensual
  for each row execute function public.marcar_actualizado();

-- 3b. Registro automático de cambios: se dispara solo, con cada alta, edición o baja.
--     (Si el cambio lo hace una importación, se registra UNA sola línea resumen en vez
--     de miles de filas; ver presupuesto_importar.)
create function public.auditar_cambio()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_entidad  text := tg_argv[0];
  v_operacion text;
  v_proyecto uuid;
  v_antes    jsonb;
  v_despues  jsonb;
  v_ref      jsonb;
begin
  if coalesce(current_setting('app.sin_auditoria_filas', true), '') = 'on' then
    return null;
  end if;

  if tg_op = 'INSERT' then
    v_operacion := 'crear';  v_despues := to_jsonb(new); v_proyecto := new.proyecto_id;
  elsif tg_op = 'UPDATE' then
    v_operacion := 'editar'; v_antes := to_jsonb(old); v_despues := to_jsonb(new);
    v_proyecto := new.proyecto_id;
    -- no registrar "ediciones" que no cambiaron nada
    if (v_antes - 'actualizado_en') = (v_despues - 'actualizado_en') then
      return null;
    end if;
  else
    v_operacion := 'borrar'; v_antes := to_jsonb(old); v_proyecto := old.proyecto_id;
  end if;

  v_ref := coalesce(v_despues, v_antes);

  insert into public.cambios_presupuesto
    (proyecto_id, usuario_id, usuario_nombre, entidad, operacion, registro_id, antes, despues, motivo)
  values (
    v_proyecto,
    auth.uid(),
    coalesce((select nombre from public.perfiles where id = auth.uid()), 'Sistema'),
    v_entidad,
    v_operacion,
    coalesce(v_ref ->> 'id', v_ref ->> 'mes'),
    v_antes,
    v_despues,
    nullif(current_setting('app.motivo', true), '')
  );
  return null;
end;
$$;

create trigger capitulos_auditoria after insert or update or delete on public.capitulos
  for each row execute function public.auditar_cambio('capitulo');
create trigger apu_partidas_auditoria after insert or update or delete on public.apu_partidas
  for each row execute function public.auditar_cambio('partida');
create trigger costos_adicionales_auditoria after insert or update or delete on public.costos_adicionales
  for each row execute function public.auditar_cambio('costo_adicional');
create trigger gasto_mensual_auditoria after insert or update or delete on public.gasto_mensual
  for each row execute function public.auditar_cambio('gasto_mensual');


-- -----------------------------------------------------------------------------
-- 4. FUNCIONES DE ESCRITURA (lo único que modifica el presupuesto)
-- -----------------------------------------------------------------------------

-- Retira los capítulos que se quedaron sin partidas.
create function public.limpiar_capitulos_vacios(p_proyecto uuid)
returns void language sql security definer set search_path = ''
as $$
  delete from public.capitulos c
   where c.proyecto_id = p_proyecto
     and not exists (select 1 from public.apu_partidas a where a.capitulo_id = c.id);
$$;

-- 4a. Crear o editar UNA partida (si p_id es nulo, se crea). El capítulo se indica por
--     nombre; si no existe, se crea. Motivo opcional.
create function public.partida_guardar(
  p_proyecto uuid, p_id uuid, p_capitulo text, p_codigo text, p_descripcion text,
  p_unidad text, p_cantidad numeric, p_precio numeric, p_motivo text default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_capitulo text := btrim(coalesce(p_capitulo, ''));
  v_codigo   text := btrim(coalesce(p_codigo, ''));
  v_desc     text := btrim(coalesce(p_descripcion, ''));
  v_unidad   text := btrim(coalesce(p_unidad, ''));
  v_cap_id   uuid;
  v_orden    integer;
  v_id       uuid;
begin
  perform public.exigir_edicion_presupuesto(p_proyecto);
  perform public.fijar_motivo(p_motivo, false);

  if v_capitulo = '' or length(v_capitulo) > 120 then
    raise exception 'El capítulo es obligatorio (máximo 120 caracteres).' using errcode = '22023';
  end if;
  if v_codigo = '' or length(v_codigo) > 40 then
    raise exception 'El código es obligatorio (máximo 40 caracteres).' using errcode = '22023';
  end if;
  if v_desc = '' or length(v_desc) > 300 then
    raise exception 'La descripción es obligatoria (máximo 300 caracteres).' using errcode = '22023';
  end if;
  if v_unidad = '' or length(v_unidad) > 20 then
    raise exception 'La unidad es obligatoria (máximo 20 caracteres).' using errcode = '22023';
  end if;
  if p_cantidad is null or p_cantidad < 0 or p_cantidad <> round(p_cantidad, 4) then
    raise exception 'La cantidad debe ser un número mayor o igual a cero, con máximo 4 decimales.'
      using errcode = '22023';
  end if;
  if p_precio is null or p_precio < 0 or p_precio <> round(p_precio, 2) then
    raise exception 'El precio unitario debe ser un número mayor o igual a cero, con máximo 2 decimales.'
      using errcode = '22023';
  end if;

  select id into v_cap_id from public.capitulos
   where proyecto_id = p_proyecto and lower(nombre) = lower(v_capitulo);
  if v_cap_id is null then
    select coalesce(max(orden), 0) + 1 into v_orden from public.capitulos where proyecto_id = p_proyecto;
    insert into public.capitulos (proyecto_id, codigo, nombre, orden)
    values (p_proyecto, v_orden::text, v_capitulo, v_orden)
    returning id into v_cap_id;
  end if;

  if p_id is null then
    insert into public.apu_partidas
      (proyecto_id, capitulo_id, codigo, descripcion, unidad, cantidad, precio_unitario)
    values (p_proyecto, v_cap_id, v_codigo, v_desc, v_unidad, p_cantidad, p_precio)
    returning id into v_id;
  else
    update public.apu_partidas
       set capitulo_id = v_cap_id, codigo = v_codigo, descripcion = v_desc, unidad = v_unidad,
           cantidad = p_cantidad, precio_unitario = p_precio
     where id = p_id and proyecto_id = p_proyecto
    returning id into v_id;
    if v_id is null then
      raise exception 'La partida no existe en este proyecto.' using errcode = '22023';
    end if;
  end if;

  perform public.limpiar_capitulos_vacios(p_proyecto);
  return v_id;
end;
$$;

-- 4b. Borrar una partida. El motivo es OBLIGATORIO.
create function public.partida_borrar(p_partida uuid, p_motivo text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_proyecto uuid;
begin
  select proyecto_id into v_proyecto from public.apu_partidas where id = p_partida;
  if v_proyecto is null then
    raise exception 'La partida no existe.' using errcode = '22023';
  end if;
  perform public.exigir_edicion_presupuesto(v_proyecto);
  perform public.fijar_motivo(p_motivo, true);

  delete from public.apu_partidas where id = p_partida;
  perform public.limpiar_capitulos_vacios(v_proyecto);
end;
$$;

-- 4c. Importar un presupuesto completo: REEMPLAZA las partidas y capítulos del proyecto,
--     todo o nada (si algo falla, no cambia nada). p_filas es una lista JSON de objetos
--     {capitulo, codigo, descripcion, unidad, cantidad, precio_unitario}, con los números
--     como TEXTO con punto decimal (p. ej. "1234.56"). Motivo OBLIGATORIO.
--     Se registra UNA línea de cambio con el resumen antes/después.
create function public.presupuesto_importar(p_proyecto uuid, p_filas jsonb, p_motivo text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_motivo   text;
  v_fila     record;
  v_dup      text;
  v_antes    jsonb;
  v_despues  jsonb;
begin
  perform public.exigir_edicion_presupuesto(p_proyecto);
  v_motivo := public.fijar_motivo(p_motivo, true);
  -- una importación a la vez por proyecto
  perform pg_advisory_xact_lock(hashtext(p_proyecto::text));

  if p_filas is null or jsonb_typeof(p_filas) <> 'array' or jsonb_array_length(p_filas) = 0 then
    raise exception 'No hay filas para importar.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_filas) > 5000 then
    raise exception 'Se admiten como máximo 5.000 partidas por importación.' using errcode = '22023';
  end if;

  -- Validación fila por fila (la aplicación ya valida; esto es la segunda barrera).
  for v_fila in select t.e as e, t.n as n from jsonb_array_elements(p_filas) with ordinality as t(e, n) loop
    if jsonb_typeof(v_fila.e) <> 'object'
       or length(btrim(coalesce(v_fila.e ->> 'capitulo', ''))) not between 1 and 120 then
      raise exception 'Fila %: el capítulo es obligatorio (máximo 120 caracteres).', v_fila.n using errcode = '22023';
    end if;
    if length(btrim(coalesce(v_fila.e ->> 'codigo', ''))) not between 1 and 40 then
      raise exception 'Fila %: el código es obligatorio (máximo 40 caracteres).', v_fila.n using errcode = '22023';
    end if;
    if length(btrim(coalesce(v_fila.e ->> 'descripcion', ''))) not between 1 and 300 then
      raise exception 'Fila %: la descripción es obligatoria (máximo 300 caracteres).', v_fila.n using errcode = '22023';
    end if;
    if length(btrim(coalesce(v_fila.e ->> 'unidad', ''))) not between 1 and 20 then
      raise exception 'Fila %: la unidad es obligatoria (máximo 20 caracteres).', v_fila.n using errcode = '22023';
    end if;
    if coalesce(v_fila.e ->> 'cantidad', '') !~ '^[0-9]{1,14}(\.[0-9]{1,4})?$' then
      raise exception 'Fila %: la cantidad debe ser un número positivo con máximo 4 decimales.', v_fila.n using errcode = '22023';
    end if;
    if coalesce(v_fila.e ->> 'precio_unitario', '') !~ '^[0-9]{1,16}(\.[0-9]{1,2})?$' then
      raise exception 'Fila %: el precio unitario debe ser un número positivo con máximo 2 decimales.', v_fila.n using errcode = '22023';
    end if;
  end loop;

  select btrim(e ->> 'codigo') into v_dup
    from jsonb_array_elements(p_filas) as t(e)
   group by btrim(e ->> 'codigo') having count(*) > 1 limit 1;
  if v_dup is not null then
    raise exception 'El código "%" está repetido en el archivo.', v_dup using errcode = '22023';
  end if;

  -- Resumen de lo que había
  select jsonb_build_object(
           'partidas', count(*),
           'capitulos', count(distinct capitulo_id),
           'costo_directo', coalesce(sum(cantidad * precio_unitario), 0))
    into v_antes from public.apu_partidas where proyecto_id = p_proyecto;

  -- Reemplazo (las filas individuales no se registran: se registra el resumen)
  perform set_config('app.sin_auditoria_filas', 'on', true);

  delete from public.apu_partidas where proyecto_id = p_proyecto;
  delete from public.capitulos where proyecto_id = p_proyecto;

  with filas as (
    select btrim(e ->> 'capitulo') as capitulo,
           btrim(e ->> 'codigo') as codigo,
           btrim(e ->> 'descripcion') as descripcion,
           btrim(e ->> 'unidad') as unidad,
           (e ->> 'cantidad')::numeric as cantidad,
           (e ->> 'precio_unitario')::numeric as precio,
           n
      from jsonb_array_elements(p_filas) with ordinality as t(e, n)
  ),
  orden_caps as (
    -- los capítulos se numeran en el orden en que aparecen por primera vez
    select (array_agg(capitulo order by n))[1] as nombre,
           row_number() over (order by min(n)) as orden
      from filas group by lower(capitulo)
  ),
  nuevos as (
    insert into public.capitulos (proyecto_id, codigo, nombre, orden)
    select p_proyecto, orden::text, nombre, orden::integer from orden_caps
    returning id, nombre
  )
  insert into public.apu_partidas
    (proyecto_id, capitulo_id, codigo, descripcion, unidad, cantidad, precio_unitario)
  select p_proyecto, nu.id, f.codigo, f.descripcion, f.unidad, f.cantidad, f.precio
    from filas f join nuevos nu on lower(nu.nombre) = lower(f.capitulo);

  perform set_config('app.sin_auditoria_filas', 'off', true);

  select jsonb_build_object(
           'partidas', count(*),
           'capitulos', count(distinct capitulo_id),
           'costo_directo', coalesce(sum(cantidad * precio_unitario), 0))
    into v_despues from public.apu_partidas where proyecto_id = p_proyecto;

  insert into public.cambios_presupuesto
    (proyecto_id, usuario_id, usuario_nombre, entidad, operacion, antes, despues, motivo)
  values (
    p_proyecto, auth.uid(),
    coalesce((select nombre from public.perfiles where id = auth.uid()), 'Sistema'),
    'importacion', 'importar', v_antes, v_despues, v_motivo
  );

  return v_despues;
end;
$$;

-- 4d. Costos adicionales -------------------------------------------------------

-- Crear o editar una línea (si p_id es nulo, se crea). base = 'costo_directo' o 'linea'.
-- Una línea calculada sobre otra línea solo puede apoyarse en una línea calculada sobre
-- el costo directo (un solo nivel: IVA sobre la utilidad, por ejemplo).
create function public.costo_adicional_guardar(
  p_proyecto uuid, p_id uuid, p_nombre text, p_base text, p_linea_base uuid,
  p_porcentaje numeric, p_motivo text default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_base_linea uuid := p_linea_base;
  v_orden integer;
  v_id uuid;
begin
  perform public.exigir_edicion_presupuesto(p_proyecto);
  perform public.fijar_motivo(p_motivo, false);

  if v_nombre = '' or length(v_nombre) > 80 then
    raise exception 'El nombre es obligatorio (máximo 80 caracteres).' using errcode = '22023';
  end if;
  if p_base is null or p_base not in ('costo_directo', 'linea') then
    raise exception 'La base de cálculo debe ser "costo_directo" o "linea".' using errcode = '22023';
  end if;
  if p_porcentaje is null or p_porcentaje < 0 or p_porcentaje > 100
     or p_porcentaje <> round(p_porcentaje, 4) then
    raise exception 'El porcentaje debe estar entre 0 y 100, con máximo 4 decimales.' using errcode = '22023';
  end if;

  if p_base = 'linea' then
    if v_base_linea is null or v_base_linea is not distinct from p_id then
      raise exception 'Elige otra línea como base de cálculo.' using errcode = '22023';
    end if;
    if not exists (select 1 from public.costos_adicionales
                    where id = v_base_linea and proyecto_id = p_proyecto and base = 'costo_directo') then
      raise exception 'La línea base debe existir en este proyecto y calcularse sobre el costo directo.'
        using errcode = '22023';
    end if;
    if p_id is not null and exists (select 1 from public.costos_adicionales where linea_base_id = p_id) then
      raise exception 'Otras líneas se calculan sobre esta; no puede calcularse sobre otra línea.'
        using errcode = '22023';
    end if;
  else
    v_base_linea := null;
  end if;

  if p_id is null then
    select coalesce(max(orden), 0) + 1 into v_orden from public.costos_adicionales where proyecto_id = p_proyecto;
    insert into public.costos_adicionales (proyecto_id, nombre, base, linea_base_id, porcentaje, orden)
    values (p_proyecto, v_nombre, p_base, v_base_linea, p_porcentaje, v_orden)
    returning id into v_id;
  else
    update public.costos_adicionales
       set nombre = v_nombre, base = p_base, linea_base_id = v_base_linea, porcentaje = p_porcentaje
     where id = p_id and proyecto_id = p_proyecto
    returning id into v_id;
    if v_id is null then
      raise exception 'La línea no existe en este proyecto.' using errcode = '22023';
    end if;
  end if;
  return v_id;
end;
$$;

-- Borrar una línea. Motivo OBLIGATORIO.
create function public.costo_adicional_borrar(p_linea uuid, p_motivo text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_proyecto uuid;
begin
  select proyecto_id into v_proyecto from public.costos_adicionales where id = p_linea;
  if v_proyecto is null then
    raise exception 'La línea no existe.' using errcode = '22023';
  end if;
  perform public.exigir_edicion_presupuesto(v_proyecto);
  perform public.fijar_motivo(p_motivo, true);

  if exists (select 1 from public.costos_adicionales where linea_base_id = p_linea) then
    raise exception 'Otras líneas se calculan sobre esta. Bórralas o cámbialas primero.'
      using errcode = '22023';
  end if;
  delete from public.costos_adicionales where id = p_linea;
end;
$$;

-- Crea las líneas habituales (todas en 0 %, para que se completen): Administración,
-- Imprevistos y Utilidad sobre el costo directo; IVA sobre la utilidad; Retefuente.
-- Solo si el proyecto aún no tiene líneas.
create function public.costos_adicionales_plantilla(p_proyecto uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_utilidad uuid;
begin
  perform public.exigir_edicion_presupuesto(p_proyecto);
  perform public.fijar_motivo('Plantilla inicial de costos adicionales', false);

  if exists (select 1 from public.costos_adicionales where proyecto_id = p_proyecto) then
    raise exception 'Este proyecto ya tiene costos adicionales.' using errcode = '22023';
  end if;

  insert into public.costos_adicionales (proyecto_id, nombre, base, porcentaje, orden)
  values (p_proyecto, 'Administración', 'costo_directo', 0, 1),
         (p_proyecto, 'Imprevistos',    'costo_directo', 0, 2);
  insert into public.costos_adicionales (proyecto_id, nombre, base, porcentaje, orden)
  values (p_proyecto, 'Utilidad', 'costo_directo', 0, 3)
  returning id into v_utilidad;
  insert into public.costos_adicionales (proyecto_id, nombre, base, linea_base_id, porcentaje, orden)
  values (p_proyecto, 'IVA sobre la utilidad', 'linea', v_utilidad, 0, 4);
  insert into public.costos_adicionales (proyecto_id, nombre, base, porcentaje, orden)
  values (p_proyecto, 'Retefuente', 'costo_directo', 0, 5);
end;
$$;

-- 4e. Gasto real mensual -------------------------------------------------------

-- Registrar (o corregir) el gasto real de un mes, en pesos. Motivo opcional.
create function public.gasto_registrar(p_proyecto uuid, p_mes integer, p_valor numeric, p_motivo text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_duracion integer;
begin
  perform public.exigir_edicion_presupuesto(p_proyecto);
  perform public.fijar_motivo(p_motivo, false);

  select duracion_meses into v_duracion from public.proyectos where id = p_proyecto;
  if v_duracion is null then
    raise exception 'El proyecto no existe.' using errcode = '22023';
  end if;
  if p_mes is null or p_mes < 1 or p_mes > v_duracion then
    raise exception 'El mes debe estar entre 1 y % (la duración del proyecto).', v_duracion using errcode = '22023';
  end if;
  if p_valor is null or p_valor < 0 or p_valor <> round(p_valor, 2) then
    raise exception 'El gasto debe ser un valor mayor o igual a cero, con máximo 2 decimales.' using errcode = '22023';
  end if;

  insert into public.gasto_mensual (proyecto_id, mes, valor_real)
  values (p_proyecto, p_mes, p_valor)
  on conflict (proyecto_id, mes) do update set valor_real = excluded.valor_real;
end;
$$;

-- Borrar el gasto registrado de un mes. Motivo OBLIGATORIO.
create function public.gasto_borrar_mes(p_proyecto uuid, p_mes integer, p_motivo text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform public.exigir_edicion_presupuesto(p_proyecto);
  perform public.fijar_motivo(p_motivo, true);
  delete from public.gasto_mensual where proyecto_id = p_proyecto and mes = p_mes;
end;
$$;


-- -----------------------------------------------------------------------------
-- 5. REGLAS DE ACCESO Y PERMISOS (mínimos desde el inicio)
-- -----------------------------------------------------------------------------
alter table public.capitulos           enable row level security;
alter table public.apu_partidas        enable row level security;
alter table public.costos_adicionales  enable row level security;
alter table public.gasto_mensual       enable row level security;
alter table public.cambios_presupuesto enable row level security;

-- Se retira todo y se concede solo lectura. No hay permisos de escritura: se escribe
-- únicamente a través de las funciones de la sección 4.
revoke all on public.capitulos, public.apu_partidas, public.costos_adicionales,
              public.gasto_mensual, public.cambios_presupuesto from anon, authenticated;
grant select on public.capitulos, public.apu_partidas, public.costos_adicionales,
                public.gasto_mensual, public.cambios_presupuesto to authenticated;

create policy capitulos_ver on public.capitulos
  for select to authenticated using (public.puede_ver_proyecto(proyecto_id));
create policy apu_partidas_ver on public.apu_partidas
  for select to authenticated using (public.puede_ver_proyecto(proyecto_id));
create policy costos_adicionales_ver on public.costos_adicionales
  for select to authenticated using (public.puede_ver_proyecto(proyecto_id));
create policy gasto_mensual_ver on public.gasto_mensual
  for select to authenticated using (public.puede_ver_proyecto(proyecto_id));
create policy cambios_presupuesto_ver on public.cambios_presupuesto
  for select to authenticated using (public.puede_ver_auditoria(proyecto_id));

-- Quién puede ejecutar cada función. Las de uso interno no se exponen a nadie más.
revoke execute on function
  public.es_gerente_proyecto(uuid), public.puede_ver_proyecto(uuid),
  public.puede_editar_presupuesto(uuid), public.puede_ver_auditoria(uuid),
  public.exigir_edicion_presupuesto(uuid), public.fijar_motivo(text, boolean),
  public.auditar_cambio(), public.limpiar_capitulos_vacios(uuid),
  public.partida_guardar(uuid, uuid, text, text, text, text, numeric, numeric, text),
  public.partida_borrar(uuid, text),
  public.presupuesto_importar(uuid, jsonb, text),
  public.costo_adicional_guardar(uuid, uuid, text, text, uuid, numeric, text),
  public.costo_adicional_borrar(uuid, text),
  public.costos_adicionales_plantilla(uuid),
  public.gasto_registrar(uuid, integer, numeric, text),
  public.gasto_borrar_mes(uuid, integer, text)
  from public, anon, authenticated;

-- Las usadas por las reglas de lectura y las acciones de la aplicación:
grant execute on function
  public.es_gerente_proyecto(uuid), public.puede_ver_proyecto(uuid),
  public.puede_editar_presupuesto(uuid), public.puede_ver_auditoria(uuid),
  public.partida_guardar(uuid, uuid, text, text, text, text, numeric, numeric, text),
  public.partida_borrar(uuid, text),
  public.presupuesto_importar(uuid, jsonb, text),
  public.costo_adicional_guardar(uuid, uuid, text, text, uuid, numeric, text),
  public.costo_adicional_borrar(uuid, text),
  public.costos_adicionales_plantilla(uuid),
  public.gasto_registrar(uuid, integer, numeric, text),
  public.gasto_borrar_mes(uuid, integer, text)
  to authenticated;
-- =============================================================================
-- Hito 2 (ajuste): editar los datos de un proyecto
-- Pueden: el Administrador y el Gerente de ESE proyecto. Se hace con una función
-- (no con permiso directo sobre la tabla) para limitar qué columnas cambian y
-- verificar el gasto ya registrado dentro de la misma base de datos.
-- =============================================================================

create or replace function public.proyecto_editar(
  p_proyecto uuid,
  p_nombre text,
  p_cliente text,
  p_ubicacion text,
  p_fecha_inicio date,
  p_duracion integer
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_mes_max integer;
begin
  if auth.uid() is null
     or not (public.es_admin() or public.es_gerente_proyecto(p_proyecto)) then
    raise exception 'No tienes permiso para editar este proyecto.' using errcode = '42501';
  end if;

  if p_nombre is null or length(btrim(p_nombre)) not between 1 and 120 then
    raise exception 'El nombre es obligatorio (máximo 120 caracteres).' using errcode = '22023';
  end if;
  if length(coalesce(p_cliente, '')) > 120 or length(coalesce(p_ubicacion, '')) > 160 then
    raise exception 'Cliente o ubicación demasiado largos.' using errcode = '22023';
  end if;
  if p_fecha_inicio is null then
    raise exception 'Indica una fecha de inicio válida.' using errcode = '22023';
  end if;
  if p_duracion is null or p_duracion not between 1 and 120 then
    raise exception 'La duración debe estar entre 1 y 120 meses.' using errcode = '22023';
  end if;

  select max(mes) into v_mes_max from public.gasto_mensual where proyecto_id = p_proyecto;
  if v_mes_max is not null and p_duracion < v_mes_max then
    raise exception 'Ya hay gasto registrado hasta el mes %. La duración no puede ser menor.', v_mes_max
      using errcode = '22023';
  end if;

  update public.proyectos
     set nombre = btrim(p_nombre),
         cliente = nullif(btrim(coalesce(p_cliente, '')), ''),
         ubicacion = nullif(btrim(coalesce(p_ubicacion, '')), ''),
         fecha_inicio = p_fecha_inicio,
         duracion_meses = p_duracion
   where id = p_proyecto;

  if not found then
    raise exception 'Proyecto no encontrado.' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.proyecto_editar(uuid, text, text, text, date, integer)
  from public, anon, authenticated;
grant execute on function public.proyecto_editar(uuid, text, text, text, date, integer)
  to authenticated;

-- Refresca la API para que vea las tablas nuevas
notify pgrst, 'reload schema';

      $inst$;
      insert into public.migraciones_aplicadas (nombre) values ('0003_presupuesto.sql') on conflict do nothing; insert into public.migraciones_aplicadas (nombre) values ('0004_editar_proyecto.sql') on conflict do nothing;
    end if;
  end if;
end $mig$;

-- 0001_cimientos.sql
do $mig$ begin
  if not exists (select 1 from public.migraciones_aplicadas where nombre = '0001_cimientos.sql') then
    execute $m0001$
-- =============================================================================
-- Hito 1 (Cimientos): perfiles, proyectos, miembros y reglas de acceso
-- Ejecutar UNA sola vez en Supabase > SQL Editor.
-- Está escrito para ser leído: cada bloque explica qué hace.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. TABLA: perfiles
--    Una ficha por cada persona que puede entrar. Guarda su nombre, su correo
--    y su rol global (solo 'administrador' o 'director_general').
--    Quien no tiene rol global (valor vacío) solo ve las obras donde lo asignen.
-- -----------------------------------------------------------------------------
create table public.perfiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  nombre      text not null,
  correo      text,
  rol_global  text check (rol_global in ('administrador', 'director_general')),
  creado_en   timestamptz not null default now()
);


-- -----------------------------------------------------------------------------
-- 2. TABLA: proyectos
--    Cada obra. La moneda queda fija en COP (la especificación no contempla otras).
-- -----------------------------------------------------------------------------
create table public.proyectos (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null check (length(trim(nombre)) > 0),
  cliente          text,
  ubicacion        text,
  fecha_inicio     date not null,
  duracion_meses   integer not null check (duracion_meses between 1 and 120),
  moneda           text not null default 'COP' check (moneda = 'COP'),
  creado_por       uuid references auth.users (id) default auth.uid(),
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now()
);


-- -----------------------------------------------------------------------------
-- 3. TABLA: miembros_proyecto
--    Quién participa en cada obra y con qué rol. Una persona puede tener roles
--    distintos en obras distintas, pero un solo rol por obra.
-- -----------------------------------------------------------------------------
create table public.miembros_proyecto (
  proyecto_id  uuid not null references public.proyectos (id) on delete cascade,
  usuario_id   uuid not null references public.perfiles (id) on delete cascade,
  rol          text not null check (rol in ('gerente', 'supervisor', 'consulta')),
  creado_en    timestamptz not null default now(),
  primary key (proyecto_id, usuario_id)
);

create index miembros_proyecto_usuario_idx on public.miembros_proyecto (usuario_id);


-- -----------------------------------------------------------------------------
-- 4. FUNCIONES AUXILIARES
--    Responden preguntas sencillas sobre quien está haciendo la consulta:
--    ¿es administrador?, ¿ve todos los proyectos?, ¿es miembro de esta obra?
--    Se usan en las reglas de acceso de más abajo.
-- -----------------------------------------------------------------------------

-- Rol global de la persona actual (vacío si no tiene).
create function public.mi_rol_global()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select rol_global from public.perfiles where id = auth.uid();
$$;

-- ¿La persona actual es administrador?
create function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.mi_rol_global() = 'administrador', false);
$$;

-- ¿La persona actual ve todos los proyectos? (administrador o director general)
create function public.ve_todos()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.mi_rol_global() in ('administrador', 'director_general'), false);
$$;

-- ¿La persona actual es miembro de este proyecto?
create function public.es_miembro(p_proyecto uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.miembros_proyecto
    where proyecto_id = p_proyecto and usuario_id = auth.uid()
  );
$$;

-- ¿La persona actual comparte alguna obra con este usuario?
-- (permite ver los nombres de los compañeros de obra)
create function public.comparte_proyecto(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.miembros_proyecto yo
    join public.miembros_proyecto otro on otro.proyecto_id = yo.proyecto_id
    where yo.usuario_id = auth.uid() and otro.usuario_id = p_usuario
  );
$$;

-- Solo personas con sesión iniciada pueden usar estas funciones.
revoke execute on function public.mi_rol_global()          from public, anon;
revoke execute on function public.es_admin()               from public, anon;
revoke execute on function public.ve_todos()               from public, anon;
revoke execute on function public.es_miembro(uuid)         from public, anon;
revoke execute on function public.comparte_proyecto(uuid)  from public, anon;
grant  execute on function public.mi_rol_global()          to authenticated;
grant  execute on function public.es_admin()               to authenticated;
grant  execute on function public.ve_todos()               to authenticated;
grant  execute on function public.es_miembro(uuid)         to authenticated;
grant  execute on function public.comparte_proyecto(uuid)  to authenticated;


-- -----------------------------------------------------------------------------
-- 5. AUTOMATISMOS
-- -----------------------------------------------------------------------------

-- 5a. Al aceptar una invitación (se crea el usuario), se crea su ficha de perfil.
--     No tiene rol global: el administrador lo asigna después si corresponde.
create function public.crear_perfil_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfiles (id, nombre, correo)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''), new.email),
    new.email
  );
  return new;
end;
$$;

revoke execute on function public.crear_perfil_nuevo_usuario() from public, anon, authenticated;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil_nuevo_usuario();

-- 5b. Al modificar un proyecto, se actualiza solo la fecha de "actualizado_en".
create function public.marcar_actualizado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

create trigger proyectos_actualizado
  before update on public.proyectos
  for each row execute function public.marcar_actualizado();


-- -----------------------------------------------------------------------------
-- 6. REGLAS DE ACCESO (seguridad por filas)
--    Se activan en cada tabla. Lo que no esté permitido expresamente, queda
--    prohibido. Estas reglas viven en la base de datos: no dependen de la pantalla.
-- -----------------------------------------------------------------------------
alter table public.perfiles          enable row level security;
alter table public.proyectos         enable row level security;
alter table public.miembros_proyecto enable row level security;

-- Permisos básicos: solo usuarios con sesión; nada para visitantes anónimos.
revoke all on public.perfiles          from anon;
revoke all on public.proyectos         from anon;
revoke all on public.miembros_proyecto from anon;

grant select, update         on public.perfiles          to authenticated;
grant select, insert, update on public.proyectos         to authenticated;
grant select, insert, update, delete on public.miembros_proyecto to authenticated;

-- ---- perfiles ---------------------------------------------------------------
-- Ver: tu propia ficha; todas si eres administrador o director general;
--      y las de quienes comparten obra contigo.
create policy perfiles_ver on public.perfiles
  for select to authenticated
  using (id = auth.uid() or public.ve_todos() or public.comparte_proyecto(id));

-- Editar: el administrador edita cualquiera. Cada persona solo puede cambiar
--         su propia ficha y NO puede cambiarse el rol global.
create policy perfiles_editar_admin on public.perfiles
  for update to authenticated
  using (public.es_admin())
  with check (public.es_admin());

create policy perfiles_editar_propio on public.perfiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and rol_global is not distinct from public.mi_rol_global()
  );

-- (No hay reglas de crear ni borrar perfiles: los crea el automatismo 5a.)

-- ---- proyectos --------------------------------------------------------------
-- Ver: administrador y director general ven todos; el resto, solo sus obras.
create policy proyectos_ver on public.proyectos
  for select to authenticated
  using (public.ve_todos() or public.es_miembro(id));

-- Crear y editar: solo el administrador.
create policy proyectos_crear on public.proyectos
  for insert to authenticated
  with check (public.es_admin());

create policy proyectos_editar on public.proyectos
  for update to authenticated
  using (public.es_admin())
  with check (public.es_admin());

-- (No hay regla de borrar proyectos: por seguridad, nadie puede borrar una obra
--  desde la aplicación. Si hace falta, se hace con intervención manual.)

-- ---- miembros_proyecto ------------------------------------------------------
-- Ver: administrador y director general ven todo; los demás ven su propia
--      pertenencia y la de sus compañeros de obra.
create policy miembros_ver on public.miembros_proyecto
  for select to authenticated
  using (public.ve_todos() or usuario_id = auth.uid() or public.es_miembro(proyecto_id));

-- Asignar, cambiar rol y quitar miembros: solo el administrador.
create policy miembros_crear on public.miembros_proyecto
  for insert to authenticated
  with check (public.es_admin());

create policy miembros_editar on public.miembros_proyecto
  for update to authenticated
  using (public.es_admin())
  with check (public.es_admin());

create policy miembros_borrar on public.miembros_proyecto
  for delete to authenticated
  using (public.es_admin());


-- =============================================================================
-- DESPUÉS DE EJECUTAR (pasos manuales, no se hacen aquí):
--  1. Crear tu usuario desde Supabase > Authentication > Users > Invite user.
--  2. Cuando aparezca tu ficha en la tabla "perfiles", asignarte como
--     administrador (esto se hace UNA vez, desde el SQL Editor, que no está
--     sujeto a las reglas de acceso):
--
--       update public.perfiles
--          set rol_global = 'administrador'
--        where correo = 'TU_CORREO@ejemplo.com';
--
--  3. Desactivar el registro abierto en Authentication > Sign In / Providers
--     (opción "Allow new users to sign up").
-- =============================================================================

    $m0001$;
    insert into public.migraciones_aplicadas (nombre) values ('0001_cimientos.sql') on conflict do nothing;
  end if;
end $mig$;

-- 0002_ajustar_permisos.sql
do $mig$ begin
  if not exists (select 1 from public.migraciones_aplicadas where nombre = '0002_ajustar_permisos.sql') then
    execute $m0002$
-- =============================================================================
-- Hito 1 (ajuste): dejar a los usuarios con sesión solo los permisos necesarios
-- Ejecutar UNA sola vez en Supabase > SQL Editor, después de 0001.
--
-- Por qué: Supabase entrega por defecto TODOS los permisos de tabla al rol
-- "authenticated" (incluidos TRUNCATE, TRIGGER y REFERENCES). La migración 0001
-- retiró los de "anon" pero no los sobrantes de "authenticated". Las reglas por
-- filas ya impedían leer o escribir lo no permitido, pero TRUNCATE no pasa por
-- esas reglas, así que se retira todo y se concede solo lo estrictamente usado.
-- =============================================================================

revoke all on public.perfiles          from authenticated;
revoke all on public.proyectos         from authenticated;
revoke all on public.miembros_proyecto from authenticated;

-- perfiles: leer y editar (las filas permitidas las decide la seguridad por filas)
grant select, update                 on public.perfiles          to authenticated;

-- proyectos: leer, crear y editar (no se borra desde la aplicación)
grant select, insert, update         on public.proyectos         to authenticated;

-- miembros_proyecto: leer, asignar, cambiar rol y quitar miembros
grant select, insert, update, delete on public.miembros_proyecto to authenticated;

    $m0002$;
    insert into public.migraciones_aplicadas (nombre) values ('0002_ajustar_permisos.sql') on conflict do nothing;
  end if;
end $mig$;

-- 0003_presupuesto.sql
do $mig$ begin
  if not exists (select 1 from public.migraciones_aplicadas where nombre = '0003_presupuesto.sql') then
    execute $m0003$
-- =============================================================================
-- Hito 2 (Presupuesto y costos): capítulos, partidas (APU), costos adicionales,
-- gasto real mensual y registro automático de cambios.
-- Ejecutar UNA sola vez en Supabase > SQL Editor, después de 0001 y 0002.
--
-- Diseño en una frase: TODOS pueden LEER (según su acceso al proyecto), pero
-- NADIE escribe directamente en las tablas. Todo cambio pasa por funciones que
-- verifican permisos, validan los datos y dejan constancia en el registro de
-- cambios. Así el registro no se puede saltar desde la aplicación.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. TABLAS
-- -----------------------------------------------------------------------------

-- Capítulos del presupuesto (un solo nivel: capítulo y partida).
create table public.capitulos (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos (id) on delete cascade,
  codigo      text not null,
  nombre      text not null check (length(btrim(nombre)) > 0),
  orden       integer not null check (orden > 0),
  creado_en   timestamptz not null default now(),
  unique (id, proyecto_id),
  unique (proyecto_id, codigo)
);
-- Un nombre de capítulo no se repite dentro del proyecto (sin distinguir mayúsculas).
create unique index capitulos_nombre_unico on public.capitulos (proyecto_id, lower(nombre));

-- Partidas del presupuesto (APU). Siempre pertenecen a un capítulo DEL MISMO proyecto.
create table public.apu_partidas (
  id              uuid primary key default gen_random_uuid(),
  proyecto_id     uuid not null references public.proyectos (id) on delete cascade,
  capitulo_id     uuid not null,
  codigo          text not null check (length(btrim(codigo)) > 0),
  descripcion     text not null check (length(btrim(descripcion)) > 0),
  unidad          text not null check (length(btrim(unidad)) > 0),
  cantidad        numeric(18, 4) not null check (cantidad >= 0),
  precio_unitario numeric(18, 2) not null check (precio_unitario >= 0),
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  unique (proyecto_id, codigo),
  foreign key (capitulo_id, proyecto_id) references public.capitulos (id, proyecto_id)
);
create index apu_partidas_capitulo_idx on public.apu_partidas (proyecto_id, capitulo_id);

-- Costos adicionales del proyecto (AIU, IVA, retefuente...). Cada línea se calcula como
-- un porcentaje del costo directo, o como un porcentaje de OTRA línea (p. ej. IVA sobre
-- la utilidad). La plataforma no fija tasas: las define quien edita el presupuesto.
create table public.costos_adicionales (
  id             uuid primary key default gen_random_uuid(),
  proyecto_id    uuid not null references public.proyectos (id) on delete cascade,
  nombre         text not null check (length(btrim(nombre)) > 0),
  base           text not null check (base in ('costo_directo', 'linea')),
  linea_base_id  uuid,
  porcentaje     numeric(8, 4) not null check (porcentaje >= 0 and porcentaje <= 100),
  orden          integer not null default 0,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (id, proyecto_id),
  foreign key (linea_base_id, proyecto_id) references public.costos_adicionales (id, proyecto_id),
  check ((base = 'costo_directo' and linea_base_id is null)
      or (base = 'linea' and linea_base_id is not null)),
  check (linea_base_id is distinct from id)
);
create unique index costos_adicionales_nombre_unico
  on public.costos_adicionales (proyecto_id, lower(nombre));

-- Gasto real por mes (mes 1 = primer mes del proyecto), en pesos.
create table public.gasto_mensual (
  proyecto_id    uuid not null references public.proyectos (id) on delete cascade,
  mes            integer not null check (mes >= 1),
  valor_real     numeric(18, 2) not null check (valor_real >= 0),
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  primary key (proyecto_id, mes)
);

-- Registro de cambios: quién, cuándo, qué había antes y qué hay ahora.
-- Solo se lee: nadie puede editarlo ni borrarlo desde la aplicación.
create table public.cambios_presupuesto (
  id             bigint generated always as identity primary key,
  proyecto_id    uuid not null references public.proyectos (id),
  fecha          timestamptz not null default now(),
  usuario_id     uuid,
  usuario_nombre text,
  entidad        text not null check (entidad in
                   ('partida', 'capitulo', 'costo_adicional', 'gasto_mensual', 'importacion')),
  operacion      text not null check (operacion in ('crear', 'editar', 'borrar', 'importar')),
  registro_id    text,
  antes          jsonb,
  despues        jsonb,
  motivo         text
);
create index cambios_presupuesto_proyecto_idx on public.cambios_presupuesto (proyecto_id, fecha desc);


-- -----------------------------------------------------------------------------
-- 2. FUNCIONES DE PERMISOS
--    Ver el presupuesto: cualquiera con acceso al proyecto (Administrador, Director
--    general y todos los miembros, incluido el Supervisor).
--    Modificarlo: Administrador y Gerente del proyecto.
--    Ver el registro de cambios: Administrador, Director general y Gerente del proyecto.
-- -----------------------------------------------------------------------------
create function public.es_gerente_proyecto(p_proyecto uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.miembros_proyecto
    where proyecto_id = p_proyecto and usuario_id = auth.uid() and rol = 'gerente'
  );
$$;

create function public.puede_ver_proyecto(p_proyecto uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.ve_todos() or public.es_miembro(p_proyecto);
$$;

create function public.puede_editar_presupuesto(p_proyecto uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.es_admin() or public.es_gerente_proyecto(p_proyecto);
$$;

create function public.puede_ver_auditoria(p_proyecto uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.ve_todos() or public.es_gerente_proyecto(p_proyecto);
$$;

-- Uso interno de las funciones de escritura: corta la operación si no hay permiso.
create function public.exigir_edicion_presupuesto(p_proyecto uuid)
returns void language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  if not public.puede_editar_presupuesto(p_proyecto) then
    raise exception 'No tienes permiso para modificar el presupuesto de este proyecto.'
      using errcode = '42501';
  end if;
end;
$$;

-- Uso interno: motivo del cambio (obligatorio o no) para el registro de cambios.
create function public.fijar_motivo(p_motivo text, p_obligatorio boolean)
returns text language plpgsql security definer set search_path = ''
as $$
declare v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  if p_obligatorio and (v_motivo is null or length(v_motivo) < 3) then
    raise exception 'El motivo es obligatorio (mínimo 3 caracteres).' using errcode = '22023';
  end if;
  if v_motivo is not null and length(v_motivo) > 500 then
    raise exception 'El motivo no puede superar 500 caracteres.' using errcode = '22023';
  end if;
  -- "true" = vale solo durante esta operación
  perform set_config('app.motivo', coalesce(v_motivo, ''), true);
  return v_motivo;
end;
$$;


-- -----------------------------------------------------------------------------
-- 3. AUTOMATISMOS
-- -----------------------------------------------------------------------------

-- 3a. Fecha de última modificación.
create trigger apu_partidas_actualizado before update on public.apu_partidas
  for each row execute function public.marcar_actualizado();
create trigger costos_adicionales_actualizado before update on public.costos_adicionales
  for each row execute function public.marcar_actualizado();
create trigger gasto_mensual_actualizado before update on public.gasto_mensual
  for each row execute function public.marcar_actualizado();

-- 3b. Registro automático de cambios: se dispara solo, con cada alta, edición o baja.
--     (Si el cambio lo hace una importación, se registra UNA sola línea resumen en vez
--     de miles de filas; ver presupuesto_importar.)
create function public.auditar_cambio()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_entidad  text := tg_argv[0];
  v_operacion text;
  v_proyecto uuid;
  v_antes    jsonb;
  v_despues  jsonb;
  v_ref      jsonb;
begin
  if coalesce(current_setting('app.sin_auditoria_filas', true), '') = 'on' then
    return null;
  end if;

  if tg_op = 'INSERT' then
    v_operacion := 'crear';  v_despues := to_jsonb(new); v_proyecto := new.proyecto_id;
  elsif tg_op = 'UPDATE' then
    v_operacion := 'editar'; v_antes := to_jsonb(old); v_despues := to_jsonb(new);
    v_proyecto := new.proyecto_id;
    -- no registrar "ediciones" que no cambiaron nada
    if (v_antes - 'actualizado_en') = (v_despues - 'actualizado_en') then
      return null;
    end if;
  else
    v_operacion := 'borrar'; v_antes := to_jsonb(old); v_proyecto := old.proyecto_id;
  end if;

  v_ref := coalesce(v_despues, v_antes);

  insert into public.cambios_presupuesto
    (proyecto_id, usuario_id, usuario_nombre, entidad, operacion, registro_id, antes, despues, motivo)
  values (
    v_proyecto,
    auth.uid(),
    coalesce((select nombre from public.perfiles where id = auth.uid()), 'Sistema'),
    v_entidad,
    v_operacion,
    coalesce(v_ref ->> 'id', v_ref ->> 'mes'),
    v_antes,
    v_despues,
    nullif(current_setting('app.motivo', true), '')
  );
  return null;
end;
$$;

create trigger capitulos_auditoria after insert or update or delete on public.capitulos
  for each row execute function public.auditar_cambio('capitulo');
create trigger apu_partidas_auditoria after insert or update or delete on public.apu_partidas
  for each row execute function public.auditar_cambio('partida');
create trigger costos_adicionales_auditoria after insert or update or delete on public.costos_adicionales
  for each row execute function public.auditar_cambio('costo_adicional');
create trigger gasto_mensual_auditoria after insert or update or delete on public.gasto_mensual
  for each row execute function public.auditar_cambio('gasto_mensual');


-- -----------------------------------------------------------------------------
-- 4. FUNCIONES DE ESCRITURA (lo único que modifica el presupuesto)
-- -----------------------------------------------------------------------------

-- Retira los capítulos que se quedaron sin partidas.
create function public.limpiar_capitulos_vacios(p_proyecto uuid)
returns void language sql security definer set search_path = ''
as $$
  delete from public.capitulos c
   where c.proyecto_id = p_proyecto
     and not exists (select 1 from public.apu_partidas a where a.capitulo_id = c.id);
$$;

-- 4a. Crear o editar UNA partida (si p_id es nulo, se crea). El capítulo se indica por
--     nombre; si no existe, se crea. Motivo opcional.
create function public.partida_guardar(
  p_proyecto uuid, p_id uuid, p_capitulo text, p_codigo text, p_descripcion text,
  p_unidad text, p_cantidad numeric, p_precio numeric, p_motivo text default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_capitulo text := btrim(coalesce(p_capitulo, ''));
  v_codigo   text := btrim(coalesce(p_codigo, ''));
  v_desc     text := btrim(coalesce(p_descripcion, ''));
  v_unidad   text := btrim(coalesce(p_unidad, ''));
  v_cap_id   uuid;
  v_orden    integer;
  v_id       uuid;
begin
  perform public.exigir_edicion_presupuesto(p_proyecto);
  perform public.fijar_motivo(p_motivo, false);

  if v_capitulo = '' or length(v_capitulo) > 120 then
    raise exception 'El capítulo es obligatorio (máximo 120 caracteres).' using errcode = '22023';
  end if;
  if v_codigo = '' or length(v_codigo) > 40 then
    raise exception 'El código es obligatorio (máximo 40 caracteres).' using errcode = '22023';
  end if;
  if v_desc = '' or length(v_desc) > 300 then
    raise exception 'La descripción es obligatoria (máximo 300 caracteres).' using errcode = '22023';
  end if;
  if v_unidad = '' or length(v_unidad) > 20 then
    raise exception 'La unidad es obligatoria (máximo 20 caracteres).' using errcode = '22023';
  end if;
  if p_cantidad is null or p_cantidad < 0 or p_cantidad <> round(p_cantidad, 4) then
    raise exception 'La cantidad debe ser un número mayor o igual a cero, con máximo 4 decimales.'
      using errcode = '22023';
  end if;
  if p_precio is null or p_precio < 0 or p_precio <> round(p_precio, 2) then
    raise exception 'El precio unitario debe ser un número mayor o igual a cero, con máximo 2 decimales.'
      using errcode = '22023';
  end if;

  select id into v_cap_id from public.capitulos
   where proyecto_id = p_proyecto and lower(nombre) = lower(v_capitulo);
  if v_cap_id is null then
    select coalesce(max(orden), 0) + 1 into v_orden from public.capitulos where proyecto_id = p_proyecto;
    insert into public.capitulos (proyecto_id, codigo, nombre, orden)
    values (p_proyecto, v_orden::text, v_capitulo, v_orden)
    returning id into v_cap_id;
  end if;

  if p_id is null then
    insert into public.apu_partidas
      (proyecto_id, capitulo_id, codigo, descripcion, unidad, cantidad, precio_unitario)
    values (p_proyecto, v_cap_id, v_codigo, v_desc, v_unidad, p_cantidad, p_precio)
    returning id into v_id;
  else
    update public.apu_partidas
       set capitulo_id = v_cap_id, codigo = v_codigo, descripcion = v_desc, unidad = v_unidad,
           cantidad = p_cantidad, precio_unitario = p_precio
     where id = p_id and proyecto_id = p_proyecto
    returning id into v_id;
    if v_id is null then
      raise exception 'La partida no existe en este proyecto.' using errcode = '22023';
    end if;
  end if;

  perform public.limpiar_capitulos_vacios(p_proyecto);
  return v_id;
end;
$$;

-- 4b. Borrar una partida. El motivo es OBLIGATORIO.
create function public.partida_borrar(p_partida uuid, p_motivo text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_proyecto uuid;
begin
  select proyecto_id into v_proyecto from public.apu_partidas where id = p_partida;
  if v_proyecto is null then
    raise exception 'La partida no existe.' using errcode = '22023';
  end if;
  perform public.exigir_edicion_presupuesto(v_proyecto);
  perform public.fijar_motivo(p_motivo, true);

  delete from public.apu_partidas where id = p_partida;
  perform public.limpiar_capitulos_vacios(v_proyecto);
end;
$$;

-- 4c. Importar un presupuesto completo: REEMPLAZA las partidas y capítulos del proyecto,
--     todo o nada (si algo falla, no cambia nada). p_filas es una lista JSON de objetos
--     {capitulo, codigo, descripcion, unidad, cantidad, precio_unitario}, con los números
--     como TEXTO con punto decimal (p. ej. "1234.56"). Motivo OBLIGATORIO.
--     Se registra UNA línea de cambio con el resumen antes/después.
create function public.presupuesto_importar(p_proyecto uuid, p_filas jsonb, p_motivo text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_motivo   text;
  v_fila     record;
  v_dup      text;
  v_antes    jsonb;
  v_despues  jsonb;
begin
  perform public.exigir_edicion_presupuesto(p_proyecto);
  v_motivo := public.fijar_motivo(p_motivo, true);
  -- una importación a la vez por proyecto
  perform pg_advisory_xact_lock(hashtext(p_proyecto::text));

  if p_filas is null or jsonb_typeof(p_filas) <> 'array' or jsonb_array_length(p_filas) = 0 then
    raise exception 'No hay filas para importar.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_filas) > 5000 then
    raise exception 'Se admiten como máximo 5.000 partidas por importación.' using errcode = '22023';
  end if;

  -- Validación fila por fila (la aplicación ya valida; esto es la segunda barrera).
  for v_fila in select t.e as e, t.n as n from jsonb_array_elements(p_filas) with ordinality as t(e, n) loop
    if jsonb_typeof(v_fila.e) <> 'object'
       or length(btrim(coalesce(v_fila.e ->> 'capitulo', ''))) not between 1 and 120 then
      raise exception 'Fila %: el capítulo es obligatorio (máximo 120 caracteres).', v_fila.n using errcode = '22023';
    end if;
    if length(btrim(coalesce(v_fila.e ->> 'codigo', ''))) not between 1 and 40 then
      raise exception 'Fila %: el código es obligatorio (máximo 40 caracteres).', v_fila.n using errcode = '22023';
    end if;
    if length(btrim(coalesce(v_fila.e ->> 'descripcion', ''))) not between 1 and 300 then
      raise exception 'Fila %: la descripción es obligatoria (máximo 300 caracteres).', v_fila.n using errcode = '22023';
    end if;
    if length(btrim(coalesce(v_fila.e ->> 'unidad', ''))) not between 1 and 20 then
      raise exception 'Fila %: la unidad es obligatoria (máximo 20 caracteres).', v_fila.n using errcode = '22023';
    end if;
    if coalesce(v_fila.e ->> 'cantidad', '') !~ '^[0-9]{1,14}(\.[0-9]{1,4})?$' then
      raise exception 'Fila %: la cantidad debe ser un número positivo con máximo 4 decimales.', v_fila.n using errcode = '22023';
    end if;
    if coalesce(v_fila.e ->> 'precio_unitario', '') !~ '^[0-9]{1,16}(\.[0-9]{1,2})?$' then
      raise exception 'Fila %: el precio unitario debe ser un número positivo con máximo 2 decimales.', v_fila.n using errcode = '22023';
    end if;
  end loop;

  select btrim(e ->> 'codigo') into v_dup
    from jsonb_array_elements(p_filas) as t(e)
   group by btrim(e ->> 'codigo') having count(*) > 1 limit 1;
  if v_dup is not null then
    raise exception 'El código "%" está repetido en el archivo.', v_dup using errcode = '22023';
  end if;

  -- Resumen de lo que había
  select jsonb_build_object(
           'partidas', count(*),
           'capitulos', count(distinct capitulo_id),
           'costo_directo', coalesce(sum(cantidad * precio_unitario), 0))
    into v_antes from public.apu_partidas where proyecto_id = p_proyecto;

  -- Reemplazo (las filas individuales no se registran: se registra el resumen)
  perform set_config('app.sin_auditoria_filas', 'on', true);

  delete from public.apu_partidas where proyecto_id = p_proyecto;
  delete from public.capitulos where proyecto_id = p_proyecto;

  with filas as (
    select btrim(e ->> 'capitulo') as capitulo,
           btrim(e ->> 'codigo') as codigo,
           btrim(e ->> 'descripcion') as descripcion,
           btrim(e ->> 'unidad') as unidad,
           (e ->> 'cantidad')::numeric as cantidad,
           (e ->> 'precio_unitario')::numeric as precio,
           n
      from jsonb_array_elements(p_filas) with ordinality as t(e, n)
  ),
  orden_caps as (
    -- los capítulos se numeran en el orden en que aparecen por primera vez
    select (array_agg(capitulo order by n))[1] as nombre,
           row_number() over (order by min(n)) as orden
      from filas group by lower(capitulo)
  ),
  nuevos as (
    insert into public.capitulos (proyecto_id, codigo, nombre, orden)
    select p_proyecto, orden::text, nombre, orden::integer from orden_caps
    returning id, nombre
  )
  insert into public.apu_partidas
    (proyecto_id, capitulo_id, codigo, descripcion, unidad, cantidad, precio_unitario)
  select p_proyecto, nu.id, f.codigo, f.descripcion, f.unidad, f.cantidad, f.precio
    from filas f join nuevos nu on lower(nu.nombre) = lower(f.capitulo);

  perform set_config('app.sin_auditoria_filas', 'off', true);

  select jsonb_build_object(
           'partidas', count(*),
           'capitulos', count(distinct capitulo_id),
           'costo_directo', coalesce(sum(cantidad * precio_unitario), 0))
    into v_despues from public.apu_partidas where proyecto_id = p_proyecto;

  insert into public.cambios_presupuesto
    (proyecto_id, usuario_id, usuario_nombre, entidad, operacion, antes, despues, motivo)
  values (
    p_proyecto, auth.uid(),
    coalesce((select nombre from public.perfiles where id = auth.uid()), 'Sistema'),
    'importacion', 'importar', v_antes, v_despues, v_motivo
  );

  return v_despues;
end;
$$;

-- 4d. Costos adicionales -------------------------------------------------------

-- Crear o editar una línea (si p_id es nulo, se crea). base = 'costo_directo' o 'linea'.
-- Una línea calculada sobre otra línea solo puede apoyarse en una línea calculada sobre
-- el costo directo (un solo nivel: IVA sobre la utilidad, por ejemplo).
create function public.costo_adicional_guardar(
  p_proyecto uuid, p_id uuid, p_nombre text, p_base text, p_linea_base uuid,
  p_porcentaje numeric, p_motivo text default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_base_linea uuid := p_linea_base;
  v_orden integer;
  v_id uuid;
begin
  perform public.exigir_edicion_presupuesto(p_proyecto);
  perform public.fijar_motivo(p_motivo, false);

  if v_nombre = '' or length(v_nombre) > 80 then
    raise exception 'El nombre es obligatorio (máximo 80 caracteres).' using errcode = '22023';
  end if;
  if p_base is null or p_base not in ('costo_directo', 'linea') then
    raise exception 'La base de cálculo debe ser "costo_directo" o "linea".' using errcode = '22023';
  end if;
  if p_porcentaje is null or p_porcentaje < 0 or p_porcentaje > 100
     or p_porcentaje <> round(p_porcentaje, 4) then
    raise exception 'El porcentaje debe estar entre 0 y 100, con máximo 4 decimales.' using errcode = '22023';
  end if;

  if p_base = 'linea' then
    if v_base_linea is null or v_base_linea is not distinct from p_id then
      raise exception 'Elige otra línea como base de cálculo.' using errcode = '22023';
    end if;
    if not exists (select 1 from public.costos_adicionales
                    where id = v_base_linea and proyecto_id = p_proyecto and base = 'costo_directo') then
      raise exception 'La línea base debe existir en este proyecto y calcularse sobre el costo directo.'
        using errcode = '22023';
    end if;
    if p_id is not null and exists (select 1 from public.costos_adicionales where linea_base_id = p_id) then
      raise exception 'Otras líneas se calculan sobre esta; no puede calcularse sobre otra línea.'
        using errcode = '22023';
    end if;
  else
    v_base_linea := null;
  end if;

  if p_id is null then
    select coalesce(max(orden), 0) + 1 into v_orden from public.costos_adicionales where proyecto_id = p_proyecto;
    insert into public.costos_adicionales (proyecto_id, nombre, base, linea_base_id, porcentaje, orden)
    values (p_proyecto, v_nombre, p_base, v_base_linea, p_porcentaje, v_orden)
    returning id into v_id;
  else
    update public.costos_adicionales
       set nombre = v_nombre, base = p_base, linea_base_id = v_base_linea, porcentaje = p_porcentaje
     where id = p_id and proyecto_id = p_proyecto
    returning id into v_id;
    if v_id is null then
      raise exception 'La línea no existe en este proyecto.' using errcode = '22023';
    end if;
  end if;
  return v_id;
end;
$$;

-- Borrar una línea. Motivo OBLIGATORIO.
create function public.costo_adicional_borrar(p_linea uuid, p_motivo text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_proyecto uuid;
begin
  select proyecto_id into v_proyecto from public.costos_adicionales where id = p_linea;
  if v_proyecto is null then
    raise exception 'La línea no existe.' using errcode = '22023';
  end if;
  perform public.exigir_edicion_presupuesto(v_proyecto);
  perform public.fijar_motivo(p_motivo, true);

  if exists (select 1 from public.costos_adicionales where linea_base_id = p_linea) then
    raise exception 'Otras líneas se calculan sobre esta. Bórralas o cámbialas primero.'
      using errcode = '22023';
  end if;
  delete from public.costos_adicionales where id = p_linea;
end;
$$;

-- Crea las líneas habituales (todas en 0 %, para que se completen): Administración,
-- Imprevistos y Utilidad sobre el costo directo; IVA sobre la utilidad; Retefuente.
-- Solo si el proyecto aún no tiene líneas.
create function public.costos_adicionales_plantilla(p_proyecto uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_utilidad uuid;
begin
  perform public.exigir_edicion_presupuesto(p_proyecto);
  perform public.fijar_motivo('Plantilla inicial de costos adicionales', false);

  if exists (select 1 from public.costos_adicionales where proyecto_id = p_proyecto) then
    raise exception 'Este proyecto ya tiene costos adicionales.' using errcode = '22023';
  end if;

  insert into public.costos_adicionales (proyecto_id, nombre, base, porcentaje, orden)
  values (p_proyecto, 'Administración', 'costo_directo', 0, 1),
         (p_proyecto, 'Imprevistos',    'costo_directo', 0, 2);
  insert into public.costos_adicionales (proyecto_id, nombre, base, porcentaje, orden)
  values (p_proyecto, 'Utilidad', 'costo_directo', 0, 3)
  returning id into v_utilidad;
  insert into public.costos_adicionales (proyecto_id, nombre, base, linea_base_id, porcentaje, orden)
  values (p_proyecto, 'IVA sobre la utilidad', 'linea', v_utilidad, 0, 4);
  insert into public.costos_adicionales (proyecto_id, nombre, base, porcentaje, orden)
  values (p_proyecto, 'Retefuente', 'costo_directo', 0, 5);
end;
$$;

-- 4e. Gasto real mensual -------------------------------------------------------

-- Registrar (o corregir) el gasto real de un mes, en pesos. Motivo opcional.
create function public.gasto_registrar(p_proyecto uuid, p_mes integer, p_valor numeric, p_motivo text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_duracion integer;
begin
  perform public.exigir_edicion_presupuesto(p_proyecto);
  perform public.fijar_motivo(p_motivo, false);

  select duracion_meses into v_duracion from public.proyectos where id = p_proyecto;
  if v_duracion is null then
    raise exception 'El proyecto no existe.' using errcode = '22023';
  end if;
  if p_mes is null or p_mes < 1 or p_mes > v_duracion then
    raise exception 'El mes debe estar entre 1 y % (la duración del proyecto).', v_duracion using errcode = '22023';
  end if;
  if p_valor is null or p_valor < 0 or p_valor <> round(p_valor, 2) then
    raise exception 'El gasto debe ser un valor mayor o igual a cero, con máximo 2 decimales.' using errcode = '22023';
  end if;

  insert into public.gasto_mensual (proyecto_id, mes, valor_real)
  values (p_proyecto, p_mes, p_valor)
  on conflict (proyecto_id, mes) do update set valor_real = excluded.valor_real;
end;
$$;

-- Borrar el gasto registrado de un mes. Motivo OBLIGATORIO.
create function public.gasto_borrar_mes(p_proyecto uuid, p_mes integer, p_motivo text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform public.exigir_edicion_presupuesto(p_proyecto);
  perform public.fijar_motivo(p_motivo, true);
  delete from public.gasto_mensual where proyecto_id = p_proyecto and mes = p_mes;
end;
$$;


-- -----------------------------------------------------------------------------
-- 5. REGLAS DE ACCESO Y PERMISOS (mínimos desde el inicio)
-- -----------------------------------------------------------------------------
alter table public.capitulos           enable row level security;
alter table public.apu_partidas        enable row level security;
alter table public.costos_adicionales  enable row level security;
alter table public.gasto_mensual       enable row level security;
alter table public.cambios_presupuesto enable row level security;

-- Se retira todo y se concede solo lectura. No hay permisos de escritura: se escribe
-- únicamente a través de las funciones de la sección 4.
revoke all on public.capitulos, public.apu_partidas, public.costos_adicionales,
              public.gasto_mensual, public.cambios_presupuesto from anon, authenticated;
grant select on public.capitulos, public.apu_partidas, public.costos_adicionales,
                public.gasto_mensual, public.cambios_presupuesto to authenticated;

create policy capitulos_ver on public.capitulos
  for select to authenticated using (public.puede_ver_proyecto(proyecto_id));
create policy apu_partidas_ver on public.apu_partidas
  for select to authenticated using (public.puede_ver_proyecto(proyecto_id));
create policy costos_adicionales_ver on public.costos_adicionales
  for select to authenticated using (public.puede_ver_proyecto(proyecto_id));
create policy gasto_mensual_ver on public.gasto_mensual
  for select to authenticated using (public.puede_ver_proyecto(proyecto_id));
create policy cambios_presupuesto_ver on public.cambios_presupuesto
  for select to authenticated using (public.puede_ver_auditoria(proyecto_id));

-- Quién puede ejecutar cada función. Las de uso interno no se exponen a nadie más.
revoke execute on function
  public.es_gerente_proyecto(uuid), public.puede_ver_proyecto(uuid),
  public.puede_editar_presupuesto(uuid), public.puede_ver_auditoria(uuid),
  public.exigir_edicion_presupuesto(uuid), public.fijar_motivo(text, boolean),
  public.auditar_cambio(), public.limpiar_capitulos_vacios(uuid),
  public.partida_guardar(uuid, uuid, text, text, text, text, numeric, numeric, text),
  public.partida_borrar(uuid, text),
  public.presupuesto_importar(uuid, jsonb, text),
  public.costo_adicional_guardar(uuid, uuid, text, text, uuid, numeric, text),
  public.costo_adicional_borrar(uuid, text),
  public.costos_adicionales_plantilla(uuid),
  public.gasto_registrar(uuid, integer, numeric, text),
  public.gasto_borrar_mes(uuid, integer, text)
  from public, anon, authenticated;

-- Las usadas por las reglas de lectura y las acciones de la aplicación:
grant execute on function
  public.es_gerente_proyecto(uuid), public.puede_ver_proyecto(uuid),
  public.puede_editar_presupuesto(uuid), public.puede_ver_auditoria(uuid),
  public.partida_guardar(uuid, uuid, text, text, text, text, numeric, numeric, text),
  public.partida_borrar(uuid, text),
  public.presupuesto_importar(uuid, jsonb, text),
  public.costo_adicional_guardar(uuid, uuid, text, text, uuid, numeric, text),
  public.costo_adicional_borrar(uuid, text),
  public.costos_adicionales_plantilla(uuid),
  public.gasto_registrar(uuid, integer, numeric, text),
  public.gasto_borrar_mes(uuid, integer, text)
  to authenticated;

    $m0003$;
    insert into public.migraciones_aplicadas (nombre) values ('0003_presupuesto.sql') on conflict do nothing;
  end if;
end $mig$;

-- 0004_editar_proyecto.sql
do $mig$ begin
  if not exists (select 1 from public.migraciones_aplicadas where nombre = '0004_editar_proyecto.sql') then
    execute $m0004$
-- =============================================================================
-- Hito 2 (ajuste): editar los datos de un proyecto
-- Pueden: el Administrador y el Gerente de ESE proyecto. Se hace con una función
-- (no con permiso directo sobre la tabla) para limitar qué columnas cambian y
-- verificar el gasto ya registrado dentro de la misma base de datos.
-- =============================================================================

create or replace function public.proyecto_editar(
  p_proyecto uuid,
  p_nombre text,
  p_cliente text,
  p_ubicacion text,
  p_fecha_inicio date,
  p_duracion integer
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_mes_max integer;
begin
  if auth.uid() is null
     or not (public.es_admin() or public.es_gerente_proyecto(p_proyecto)) then
    raise exception 'No tienes permiso para editar este proyecto.' using errcode = '42501';
  end if;

  if p_nombre is null or length(btrim(p_nombre)) not between 1 and 120 then
    raise exception 'El nombre es obligatorio (máximo 120 caracteres).' using errcode = '22023';
  end if;
  if length(coalesce(p_cliente, '')) > 120 or length(coalesce(p_ubicacion, '')) > 160 then
    raise exception 'Cliente o ubicación demasiado largos.' using errcode = '22023';
  end if;
  if p_fecha_inicio is null then
    raise exception 'Indica una fecha de inicio válida.' using errcode = '22023';
  end if;
  if p_duracion is null or p_duracion not between 1 and 120 then
    raise exception 'La duración debe estar entre 1 y 120 meses.' using errcode = '22023';
  end if;

  select max(mes) into v_mes_max from public.gasto_mensual where proyecto_id = p_proyecto;
  if v_mes_max is not null and p_duracion < v_mes_max then
    raise exception 'Ya hay gasto registrado hasta el mes %. La duración no puede ser menor.', v_mes_max
      using errcode = '22023';
  end if;

  update public.proyectos
     set nombre = btrim(p_nombre),
         cliente = nullif(btrim(coalesce(p_cliente, '')), ''),
         ubicacion = nullif(btrim(coalesce(p_ubicacion, '')), ''),
         fecha_inicio = p_fecha_inicio,
         duracion_meses = p_duracion
   where id = p_proyecto;

  if not found then
    raise exception 'Proyecto no encontrado.' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.proyecto_editar(uuid, text, text, text, date, integer)
  from public, anon, authenticated;
grant execute on function public.proyecto_editar(uuid, text, text, text, date, integer)
  to authenticated;

    $m0004$;
    insert into public.migraciones_aplicadas (nombre) values ('0004_editar_proyecto.sql') on conflict do nothing;
  end if;
end $mig$;

-- 0005_cimientos_v2.sql
do $mig$ begin
  if not exists (select 1 from public.migraciones_aplicadas where nombre = '0005_cimientos_v2.sql') then
    execute $m0005$
-- =============================================================================
-- Hito 1 (v2.0): roles completos, organizaciones, portafolios, ficha del proyecto,
-- parámetros configurables y auditoría general.
-- =============================================================================

-- 1. ROLES --------------------------------------------------------------------
alter table public.perfiles drop constraint perfiles_rol_global_check;
alter table public.perfiles add constraint perfiles_rol_global_check
  check (rol_global in ('administrador', 'director_general', 'analista_pmo', 'finanzas'));

alter table public.miembros_proyecto drop constraint miembros_proyecto_rol_check;
alter table public.miembros_proyecto add constraint miembros_proyecto_rol_check
  check (rol in ('gerente', 'patrocinador', 'supervisor', 'interventoria', 'consulta'));

-- Ven todo el portafolio: administrador, director general, analista PMO y finanzas.
create or replace function public.ve_todos()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce(public.mi_rol_global() in ('administrador', 'director_general', 'analista_pmo', 'finanzas'), false);
$$;

-- Miembro del proyecto con acceso general. La interventoría NO cuenta: ve solo lo asignado.
create or replace function public.es_miembro(p_proyecto uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.miembros_proyecto
    where proyecto_id = p_proyecto and usuario_id = auth.uid() and rol <> 'interventoria'
  );
$$;

create function public.es_interventor(p_proyecto uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.miembros_proyecto
    where proyecto_id = p_proyecto and usuario_id = auth.uid() and rol = 'interventoria'
  );
$$;

-- ¿Tiene acceso general (no es solo interventor)? Para parámetros y datos transversales.
create function public.acceso_general()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.ve_todos() or exists (
    select 1 from public.miembros_proyecto where usuario_id = auth.uid() and rol <> 'interventoria'
  );
$$;

create function public.es_director_general()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(public.mi_rol_global() = 'director_general', false); $$;

-- Administrador o gerente del proyecto: quien gestiona el proyecto.
create function public.puede_gestionar(p_proyecto uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select public.es_admin() or public.es_gerente_proyecto(p_proyecto); $$;

revoke execute on function public.es_interventor(uuid), public.acceso_general(),
  public.es_director_general(), public.puede_gestionar(uuid) from public, anon;
grant execute on function public.es_interventor(uuid), public.acceso_general(),
  public.es_director_general(), public.puede_gestionar(uuid) to authenticated;

drop policy proyectos_ver on public.proyectos;
create policy proyectos_ver on public.proyectos
  for select to authenticated
  using (public.ve_todos() or public.es_miembro(id) or public.es_interventor(id));

drop policy miembros_ver on public.miembros_proyecto;
create policy miembros_ver on public.miembros_proyecto
  for select to authenticated
  using (public.ve_todos() or usuario_id = auth.uid() or public.es_miembro(proyecto_id));

-- 2. ORGANIZACIONES Y PORTAFOLIOS -----------------------------------------------
create table public.organizaciones (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null check (length(btrim(nombre)) > 0),
  tipo      text not null default 'empresa' check (tipo in ('grupo', 'empresa', 'unidad')),
  creado_en timestamptz not null default now()
);
create table public.portafolios (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones (id),
  nombre          text not null check (length(btrim(nombre)) > 0),
  creado_en       timestamptz not null default now()
);

with o as (insert into public.organizaciones (nombre, tipo) values ('Greenland', 'grupo') returning id)
insert into public.portafolios (organizacion_id, nombre) select id, 'Portafolio general' from o;

alter table public.organizaciones enable row level security;
alter table public.portafolios enable row level security;
revoke all on public.organizaciones, public.portafolios from anon, authenticated;
grant select, insert, update on public.organizaciones, public.portafolios to authenticated;

create policy organizaciones_ver on public.organizaciones for select to authenticated using (public.acceso_general());
create policy organizaciones_crear on public.organizaciones for insert to authenticated with check (public.es_admin());
create policy organizaciones_editar on public.organizaciones for update to authenticated
  using (public.es_admin()) with check (public.es_admin());
create policy portafolios_ver on public.portafolios for select to authenticated using (public.acceso_general());
create policy portafolios_crear on public.portafolios for insert to authenticated with check (public.es_admin());
create policy portafolios_editar on public.portafolios for update to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- 3. FICHA DEL PROYECTO ---------------------------------------------------------
create sequence public.proyectos_codigo_seq;

alter table public.proyectos
  add column codigo          text unique,
  add column organizacion_id uuid references public.organizaciones (id),
  add column portafolio_id   uuid references public.portafolios (id),
  add column tipo            text not null default 'obra_civil'
    check (tipo in ('obra_civil', 'industrial', 'logistico', 'agroindustrial', 'otro')),
  add column fase            text not null default 'inicio'
    check (fase in ('inicio', 'planificacion', 'ejecucion', 'cierre')),
  add column estado          text not null default 'activo'
    check (estado in ('activo', 'en_pausa', 'cerrado', 'cancelado')),
  add column usa_obra        boolean not null default true;

-- Proyectos existentes: código y portafolio por defecto.
update public.proyectos set
  organizacion_id = (select id from public.organizaciones order by creado_en limit 1),
  portafolio_id = (select id from public.portafolios order by creado_en limit 1);
update public.proyectos p set codigo = 'GL-' || lpad(nextval('public.proyectos_codigo_seq')::text, 3, '0')
  from (select id from public.proyectos order by creado_en, id) o where p.id = o.id;

create function public.proyecto_valores_iniciales()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.organizacion_id is null then
    new.organizacion_id := (select id from public.organizaciones order by creado_en limit 1);
  end if;
  if new.portafolio_id is null then
    new.portafolio_id := (select id from public.portafolios
      where organizacion_id = new.organizacion_id order by creado_en limit 1);
  end if;
  if new.codigo is null then
    new.codigo := 'GL-' || lpad(nextval('public.proyectos_codigo_seq')::text, 3, '0');
  end if;
  return new;
end;
$$;
create trigger proyectos_valores_iniciales before insert on public.proyectos
  for each row execute function public.proyecto_valores_iniciales();
grant usage on sequence public.proyectos_codigo_seq to authenticated;

-- Ficha: el gerente y el administrador editan tipo, fase, estado y uso del área de Obra.
-- Código, organización y portafolio solo los cambia el administrador.
create function public.proyecto_ficha_guardar(
  p_proyecto uuid, p_tipo text, p_fase text, p_estado text, p_usa_obra boolean,
  p_organizacion uuid, p_portafolio uuid, p_codigo text
) returns void language plpgsql security definer set search_path = ''
as $$
declare v public.proyectos;
begin
  if auth.uid() is null or not public.puede_gestionar(p_proyecto) then
    raise exception 'No tienes permiso para editar este proyecto.' using errcode = '42501';
  end if;
  select * into v from public.proyectos where id = p_proyecto;
  if not found then raise exception 'Proyecto no encontrado.' using errcode = '22023'; end if;

  if (p_organizacion is distinct from v.organizacion_id
      or p_portafolio is distinct from v.portafolio_id
      or coalesce(nullif(btrim(coalesce(p_codigo, '')), '') <> v.codigo, false))
     and not public.es_admin() then
    raise exception 'Solo el administrador cambia el código, la organización y el portafolio.' using errcode = '42501';
  end if;
  if p_portafolio is not null and not exists (
       select 1 from public.portafolios where id = p_portafolio and organizacion_id = p_organizacion) then
    raise exception 'El portafolio no pertenece a la organización.' using errcode = '22023';
  end if;
  if p_codigo is not null and length(btrim(p_codigo)) > 30 then
    raise exception 'El código no puede superar 30 caracteres.' using errcode = '22023';
  end if;

  update public.proyectos set
    tipo = p_tipo, fase = p_fase, estado = p_estado, usa_obra = coalesce(p_usa_obra, true),
    organizacion_id = p_organizacion, portafolio_id = p_portafolio,
    codigo = coalesce(nullif(btrim(coalesce(p_codigo, '')), ''), v.codigo)
  where id = p_proyecto;
exception when check_violation then
  raise exception 'Valor no válido en la ficha del proyecto.' using errcode = '22023';
  when unique_violation then
  raise exception 'Ya existe un proyecto con ese código.' using errcode = '22023';
end;
$$;
revoke execute on function public.proyecto_ficha_guardar(uuid, text, text, text, boolean, uuid, uuid, text) from public, anon;
grant execute on function public.proyecto_ficha_guardar(uuid, text, text, text, boolean, uuid, uuid, text) to authenticated;

-- 4. AUDITORÍA GENERAL ------------------------------------------------------------
create table public.auditoria (
  id             bigint generated always as identity primary key,
  usuario_id     uuid,
  fecha          timestamptz not null default now(),
  tabla          text not null,
  registro_id    text,
  proyecto_id    uuid,
  campo          text not null,
  valor_anterior text,
  valor_nuevo    text
);
create index auditoria_proyecto_idx on public.auditoria (proyecto_id, fecha desc);
create index auditoria_fecha_idx on public.auditoria (fecha desc);

-- Trigger genérico: guarda un renglón por campo cambiado (o uno por alta / baja).
create function public.auditar_tabla()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_viejo jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_nuevo jsonb := case when tg_op in ('UPDATE', 'INSERT') then to_jsonb(new) end;
  v_base  jsonb := coalesce(v_nuevo, v_viejo);
  v_id    text := coalesce(v_base ->> 'id', v_base ->> 'usuario_id', v_base ->> 'proyecto_id');
  v_proy  uuid := nullif(case when tg_table_name = 'proyectos' then v_base ->> 'id' else v_base ->> 'proyecto_id' end, '')::uuid;
  k text;
begin
  if tg_op = 'INSERT' then
    insert into public.auditoria (usuario_id, tabla, registro_id, proyecto_id, campo, valor_nuevo)
      values (auth.uid(), tg_table_name, v_id, v_proy, '(alta)', v_nuevo::text);
  elsif tg_op = 'DELETE' then
    insert into public.auditoria (usuario_id, tabla, registro_id, proyecto_id, campo, valor_anterior)
      values (auth.uid(), tg_table_name, v_id, v_proy, '(baja)', v_viejo::text);
  else
    for k in select key from jsonb_each(v_nuevo) loop
      continue when k in ('actualizado_en', 'creado_en');
      if (v_viejo -> k) is distinct from (v_nuevo -> k) then
        insert into public.auditoria (usuario_id, tabla, registro_id, proyecto_id, campo, valor_anterior, valor_nuevo)
          values (auth.uid(), tg_table_name, v_id, v_proy, k,
                  v_viejo ->> k, v_nuevo ->> k);
      end if;
    end loop;
  end if;
  return null;
end;
$$;
revoke execute on function public.auditar_tabla() from public, anon, authenticated;

alter table public.auditoria enable row level security;
revoke all on public.auditoria from anon, authenticated;
grant select on public.auditoria to authenticated;
create policy auditoria_ver on public.auditoria for select to authenticated
  using (public.es_admin() or public.es_director_general()
         or (proyecto_id is not null and public.es_gerente_proyecto(proyecto_id)));

create trigger proyectos_audit after insert or update or delete on public.proyectos
  for each row execute function public.auditar_tabla();
create trigger miembros_audit after insert or update or delete on public.miembros_proyecto
  for each row execute function public.auditar_tabla();
create trigger perfiles_audit after update on public.perfiles
  for each row execute function public.auditar_tabla();

-- 5. PARÁMETROS --------------------------------------------------------------------
create table public.parametros (
  id          uuid primary key default gen_random_uuid(),
  ambito      text not null check (ambito in ('global', 'portafolio', 'proyecto')),
  ambito_id   uuid,
  clave       text not null,
  valor       text not null,
  descripcion text,
  fuente      text,
  check ((ambito = 'global') = (ambito_id is null))
);
create unique index parametros_unico on public.parametros
  (ambito, coalesce(ambito_id, '00000000-0000-0000-0000-000000000000'::uuid), clave);

insert into public.parametros (ambito, clave, valor, descripcion, fuente) values
 ('global','retencion_garantia_pct','10','Retención de garantía sobre cada acta de pago (%)','Reglas de contratos'),
 ('global','anticipo_max_pct','20','Anticipo máximo para todos los contratos (%)','Reglas de contratos'),
 ('global','anticipo_umbral_referencia_cop','350000000','Por debajo de este valor, lo normal es no dar anticipo (COP)','Reglas de contratos'),
 ('global','spi_verde_min','0.95','SPI mínimo para Verde','Libro, Dashboard RAG'),
 ('global','cpi_verde_min','0.95','CPI mínimo para Verde','Libro, Dashboard RAG'),
 ('global','spi_amarillo_min','0.85','SPI mínimo para Amarillo','Libro, Dashboard RAG'),
 ('global','cpi_amarillo_min','0.85','CPI mínimo para Amarillo','Libro, Dashboard RAG'),
 ('global','tcpi_max','1.10','TCPI máximo aceptable','Libro, KPIs y EVM'),
 ('global','riesgo_critico_min','15','Score mínimo de riesgo Crítico','Libro, Registro de Riesgos'),
 ('global','riesgo_alto_min','8','Score mínimo de riesgo Alto','Libro, Registro de Riesgos'),
 ('global','riesgo_medio_min','4','Score mínimo de riesgo Medio','Libro, Registro de Riesgos'),
 ('global','cambio_menor_max_pct','2','Cambio Menor: hasta este % (inclusive)','Metodología GL'),
 ('global','cambio_moderado_max_pct','5','Cambio Moderado: hasta este % (inclusive); por encima es Crítico','Metodología GL'),
 ('global','cambio_firma_patrocinador_pct','5','Cambios por encima de este % exigen firma del patrocinador','Libro, Registro de Cambios'),
 ('global','cambio_aprobador_menor','gerente','Quién aprueba cambios menores (gerente | director_general)','Usuario, 9 de octubre de 2026'),
 ('global','cambio_aprobador_moderado','director_general','Quién aprueba cambios moderados','Usuario, 9 de octubre de 2026'),
 ('global','cambio_aprobador_critico','director_general','Quién aprueba cambios críticos','Usuario, 9 de octubre de 2026'),
 ('global','cambio_umbral_monto_cop','10000000','Valor del prototipo SGCC, por confirmar (COP)','SGCC, Configuración'),
 ('global','tipos_cambio','Alcance,Cronograma,Costo,Contractual (otrosí),Riesgo materializado,Calidad,Otro','Catálogo único de tipos de cambio (discrepancia D3)','Propuesta'),
 ('global','interventoria_vb_acta_obligatorio','si','Exigir concepto favorable de interventoría antes de aprobar un acta (si | no)','Propuesta'),
 ('global','plazo_hallazgo_observacion','5','Días hábiles para responder una Observación','Propuesta, ver S12'),
 ('global','plazo_hallazgo_no_conformidad','3','Días hábiles para responder una No conformidad','Propuesta, ver S12'),
 ('global','plazo_hallazgo_incumplimiento_grave','1','Días hábiles para responder un Incumplimiento grave','Propuesta, ver S12'),
 ('global','criterios_evaluacion_proveedor','Calidad,Cumplimiento del plazo,Seguridad y salud,Documentación,Respuesta a requerimientos','Criterios de evaluación (escala 1 a 5)','Propuesta, ver S12'),
 ('global','ev_usa_avance_verificado','si','El valor ganado usa el avance verificado por interventoría si existe (si | no)','Supuesto S11'),
 ('global','catalogo_disciplinas_diseno','Arquitectónico,Estructural,Geotécnico,Hidrosanitario,Eléctrico,Otros','Disciplinas de revisión de diseños','Propuesta, por validar'),
 ('global','categorias_riesgo','Técnico,Permisos,Financiero,Ambiental,Stakeholders,Cadena de suministro,Seguridad SST','Categorías de riesgo','Libro'),
 ('global','kpi_hitos_min','90','KPI: cumplimiento de hitos mínimo (%)','Libro'),
 ('global','kpi_riesgos_con_plan','100','KPI: riesgos críticos con plan (%)','Libro'),
 ('global','kpi_cambios_controlados_min','85','KPI: cambios controlados mínimo (%)','Libro'),
 ('global','kpi_reuniones_con_acta','100','KPI: reuniones con acta (%)','Libro'),
 ('global','kpi_satisfaccion_min','4.0','KPI: satisfacción del patrocinador mínima (1 a 5)','Libro'),
 ('global','kpi_reportes_a_tiempo','100','KPI: reportes a tiempo (%)','Libro'),
 ('global','stakeholder_cortes_estrategia','16,10,5','Cortes de poder × interés: Gestionar de cerca, Mantener satisfecho, Mantener informado (resto: Monitorear)','Libro; ver D2');

-- Valor vigente: el del proyecto, si no el de su portafolio, si no el global.
create function public.parametro(p_clave text, p_proyecto uuid default null)
returns text language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select valor from public.parametros where ambito = 'proyecto' and ambito_id = p_proyecto and clave = p_clave),
    (select pa.valor from public.parametros pa join public.proyectos pr on pr.portafolio_id = pa.ambito_id
       where pa.ambito = 'portafolio' and pr.id = p_proyecto and pa.clave = p_clave),
    (select valor from public.parametros where ambito = 'global' and clave = p_clave)
  );
$$;
revoke execute on function public.parametro(text, uuid) from public, anon;
grant execute on function public.parametro(text, uuid) to authenticated;

alter table public.parametros enable row level security;
revoke all on public.parametros from anon, authenticated;
grant select on public.parametros to authenticated;
create policy parametros_ver on public.parametros for select to authenticated using (public.acceso_general());
create trigger parametros_audit after insert or update or delete on public.parametros
  for each row execute function public.auditar_tabla();

-- Solo el administrador cambia parámetros. Nunca se crean claves nuevas: solo se ajustan las existentes.
create function public.parametro_guardar(p_ambito text, p_ambito_id uuid, p_clave text, p_valor text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_base public.parametros;
begin
  if auth.uid() is null or not public.es_admin() then
    raise exception 'Solo el administrador puede cambiar parámetros.' using errcode = '42501';
  end if;
  select * into v_base from public.parametros where ambito = 'global' and clave = p_clave;
  if not found then raise exception 'El parámetro % no existe.', p_clave using errcode = '22023'; end if;
  if p_valor is null or length(btrim(p_valor)) = 0 or length(p_valor) > 500 then
    raise exception 'El valor es obligatorio (máximo 500 caracteres).' using errcode = '22023';
  end if;
  if v_base.valor ~ '^[0-9]+([.][0-9]+)?$' and btrim(p_valor) !~ '^[0-9]+([.][0-9]+)?$' then
    raise exception 'El parámetro % debe ser un número (use punto para decimales).', p_clave using errcode = '22023';
  end if;
  if p_ambito = 'global' then
    update public.parametros set valor = btrim(p_valor) where id = v_base.id;
  elsif p_ambito = 'portafolio' and exists (select 1 from public.portafolios where id = p_ambito_id)
     or p_ambito = 'proyecto' and exists (select 1 from public.proyectos where id = p_ambito_id) then
    insert into public.parametros (ambito, ambito_id, clave, valor, descripcion, fuente)
      values (p_ambito, p_ambito_id, p_clave, btrim(p_valor), v_base.descripcion, 'Ajuste manual')
    on conflict (ambito, coalesce(ambito_id, '00000000-0000-0000-0000-000000000000'::uuid), clave)
      do update set valor = excluded.valor;
  else
    raise exception 'Ámbito no válido.' using errcode = '22023';
  end if;
end;
$$;
revoke execute on function public.parametro_guardar(text, uuid, text, text) from public, anon;
grant execute on function public.parametro_guardar(text, uuid, text, text) to authenticated;

-- Quitar un ajuste de portafolio o proyecto (vuelve a regir el valor superior).
create function public.parametro_quitar_ajuste(p_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.es_admin() then
    raise exception 'Solo el administrador puede cambiar parámetros.' using errcode = '42501';
  end if;
  delete from public.parametros where id = p_id and ambito <> 'global';
end;
$$;
revoke execute on function public.parametro_quitar_ajuste(uuid) from public, anon;
grant execute on function public.parametro_quitar_ajuste(uuid) to authenticated;

-- 6. ASIGNAR ROL GLOBAL ----------------------------------------------------------------
create function public.perfil_asignar_rol_global(p_usuario uuid, p_rol text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.es_admin() then
    raise exception 'Solo el administrador asigna roles.' using errcode = '42501';
  end if;
  if p_usuario = auth.uid() then
    raise exception 'No puedes cambiar tu propio rol (para evitar quedarte sin administrador).' using errcode = '22023';
  end if;
  if p_rol is not null and p_rol not in ('administrador', 'director_general', 'analista_pmo', 'finanzas') then
    raise exception 'Rol no válido.' using errcode = '22023';
  end if;
  update public.perfiles set rol_global = p_rol where id = p_usuario;
  if not found then raise exception 'Usuario no encontrado.' using errcode = '22023'; end if;
end;
$$;
revoke execute on function public.perfil_asignar_rol_global(uuid, text) from public, anon;
grant execute on function public.perfil_asignar_rol_global(uuid, text) to authenticated;

    $m0005$;
    insert into public.migraciones_aplicadas (nombre) values ('0005_cimientos_v2.sql') on conflict do nothing;
  end if;
end $mig$;

-- 0006_dashboard_v1.sql
do $mig$ begin
  if not exists (select 1 from public.migraciones_aplicadas where nombre = '0006_dashboard_v1.sql') then
    execute $m0006$
-- =============================================================================
-- Hito 2 (v2.0): Acta de constitución y captura manual de BAC, PV, EV y AC
-- =============================================================================

-- ¿Puede reportar? Administrador, gerente del proyecto o analista PMO.
create function public.puede_reportar(p_proyecto uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.puede_gestionar(p_proyecto) or coalesce(public.mi_rol_global() = 'analista_pmo', false);
$$;
revoke execute on function public.puede_reportar(uuid) from public, anon;
grant execute on function public.puede_reportar(uuid) to authenticated;

-- 1. ACTA DE CONSTITUCIÓN (una por proyecto) ---------------------------------------
create table public.actas_constitucion (
  proyecto_id            uuid primary key references public.proyectos (id) on delete cascade,
  proposito              text,
  objetivo_smart         text,
  beneficios             text,
  alcance_incluido       text,
  alcance_excluido       text,
  supuestos              text,
  restricciones          text,
  presupuesto_estimado   numeric(15, 2) check (presupuesto_estimado >= 0),
  fuente_financiamiento  text,
  equipo_n               integer check (equipo_n >= 0),
  contratistas_externos  text,
  firma_gerente          date,
  firma_patrocinador     date,
  actualizado_en         timestamptz not null default now()
);
create trigger actas_actualizado before update on public.actas_constitucion
  for each row execute function public.marcar_actualizado();
create trigger actas_audit after insert or update or delete on public.actas_constitucion
  for each row execute function public.auditar_tabla();

alter table public.actas_constitucion enable row level security;
revoke all on public.actas_constitucion from anon, authenticated;
grant select on public.actas_constitucion to authenticated;
create policy actas_ver on public.actas_constitucion for select to authenticated
  using (public.puede_ver_proyecto(proyecto_id));

-- Guardar el contenido. Si el contenido cambia después de firmado, las firmas se anulan.
create function public.acta_guardar(p_proyecto uuid, p_datos jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v public.actas_constitucion;
  campos text[] := array['proposito','objetivo_smart','beneficios','alcance_incluido','alcance_excluido',
                         'supuestos','restricciones','fuente_financiamiento','contratistas_externos'];
  c text; t text;
  n_presupuesto numeric(15,2);
  n_equipo integer;
  nuevo jsonb := '{}'::jsonb;
  cambio boolean := false;
begin
  if auth.uid() is null or not public.puede_gestionar(p_proyecto) then
    raise exception 'No tienes permiso para editar el acta de este proyecto.' using errcode = '42501';
  end if;
  foreach c in array campos loop
    t := nullif(btrim(coalesce(p_datos ->> c, '')), '');
    if t is not null and length(t) > 4000 then
      raise exception 'Un campo del acta supera 4000 caracteres.' using errcode = '22023';
    end if;
    nuevo := nuevo || jsonb_build_object(c, t);
  end loop;
  begin
    n_presupuesto := nullif(btrim(coalesce(p_datos ->> 'presupuesto_estimado', '')), '')::numeric;
    n_equipo := nullif(btrim(coalesce(p_datos ->> 'equipo_n', '')), '')::integer;
  exception when others then
    raise exception 'El presupuesto estimado y el equipo deben ser números válidos.' using errcode = '22023';
  end;
  if n_presupuesto < 0 or n_equipo < 0 then
    raise exception 'El presupuesto estimado y el equipo no pueden ser negativos.' using errcode = '22023';
  end if;

  select * into v from public.actas_constitucion where proyecto_id = p_proyecto;
  if not found then
    insert into public.actas_constitucion (proyecto_id, proposito, objetivo_smart, beneficios, alcance_incluido,
      alcance_excluido, supuestos, restricciones, presupuesto_estimado, fuente_financiamiento, equipo_n, contratistas_externos)
    values (p_proyecto, nuevo ->> 'proposito', nuevo ->> 'objetivo_smart', nuevo ->> 'beneficios',
      nuevo ->> 'alcance_incluido', nuevo ->> 'alcance_excluido', nuevo ->> 'supuestos', nuevo ->> 'restricciones',
      n_presupuesto, nuevo ->> 'fuente_financiamiento', n_equipo, nuevo ->> 'contratistas_externos');
  else
    cambio := (v.proposito, v.objetivo_smart, v.beneficios, v.alcance_incluido, v.alcance_excluido, v.supuestos,
               v.restricciones, v.presupuesto_estimado, v.fuente_financiamiento, v.equipo_n, v.contratistas_externos)
      is distinct from (nuevo ->> 'proposito', nuevo ->> 'objetivo_smart', nuevo ->> 'beneficios', nuevo ->> 'alcance_incluido',
               nuevo ->> 'alcance_excluido', nuevo ->> 'supuestos', nuevo ->> 'restricciones', n_presupuesto,
               nuevo ->> 'fuente_financiamiento', n_equipo, nuevo ->> 'contratistas_externos');
    update public.actas_constitucion set
      proposito = nuevo ->> 'proposito', objetivo_smart = nuevo ->> 'objetivo_smart', beneficios = nuevo ->> 'beneficios',
      alcance_incluido = nuevo ->> 'alcance_incluido', alcance_excluido = nuevo ->> 'alcance_excluido',
      supuestos = nuevo ->> 'supuestos', restricciones = nuevo ->> 'restricciones', presupuesto_estimado = n_presupuesto,
      fuente_financiamiento = nuevo ->> 'fuente_financiamiento', equipo_n = n_equipo,
      contratistas_externos = nuevo ->> 'contratistas_externos',
      firma_gerente = case when cambio then null else firma_gerente end,
      firma_patrocinador = case when cambio then null else firma_patrocinador end
    where proyecto_id = p_proyecto;
  end if;
end;
$$;

-- Firmar: el gerente firma como gerente; el patrocinador (o el administrador, si el patrocinador
-- no es usuario de la plataforma) firma como patrocinador. Queda en auditoría quién registró la firma.
create function public.acta_firmar(p_proyecto uuid, p_como text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.' using errcode = '28000'; end if;
  if not exists (select 1 from public.actas_constitucion where proyecto_id = p_proyecto) then
    raise exception 'Primero guarda el contenido del acta.' using errcode = '22023';
  end if;
  if p_como = 'gerente' then
    if not public.es_gerente_proyecto(p_proyecto) then
      raise exception 'Solo el gerente del proyecto firma como gerente.' using errcode = '42501';
    end if;
    update public.actas_constitucion set firma_gerente = current_date where proyecto_id = p_proyecto;
  elsif p_como = 'patrocinador' then
    if not (public.es_admin() or exists (select 1 from public.miembros_proyecto
        where proyecto_id = p_proyecto and usuario_id = auth.uid() and rol = 'patrocinador')) then
      raise exception 'Solo el patrocinador (o el administrador) firma como patrocinador.' using errcode = '42501';
    end if;
    update public.actas_constitucion set firma_patrocinador = current_date where proyecto_id = p_proyecto;
  else
    raise exception 'Firma no válida.' using errcode = '22023';
  end if;
end;
$$;
revoke execute on function public.acta_guardar(uuid, jsonb), public.acta_firmar(uuid, text) from public, anon;
grant execute on function public.acta_guardar(uuid, jsonb), public.acta_firmar(uuid, text) to authenticated;

-- 2. MEDICIONES DE VALOR GANADO (captura manual) -----------------------------------
create table public.mediciones_evm (
  id           uuid primary key default gen_random_uuid(),
  proyecto_id  uuid not null references public.proyectos (id) on delete cascade,
  fecha_corte  date not null,
  bac          numeric(15, 2) not null check (bac >= 0),
  pv           numeric(15, 2) not null check (pv >= 0),
  ev           numeric(15, 2) not null check (ev >= 0),
  ac           numeric(15, 2) not null check (ac >= 0),
  origen       text not null default 'manual' check (origen in ('manual', 'calculado')),
  creado_por   uuid default auth.uid(),
  creado_en    timestamptz not null default now(),
  unique (proyecto_id, fecha_corte)
);
create index mediciones_evm_idx on public.mediciones_evm (proyecto_id, fecha_corte desc);
create trigger mediciones_audit after insert or update or delete on public.mediciones_evm
  for each row execute function public.auditar_tabla();

alter table public.mediciones_evm enable row level security;
revoke all on public.mediciones_evm from anon, authenticated;
grant select on public.mediciones_evm to authenticated;
create policy mediciones_ver on public.mediciones_evm for select to authenticated
  using (public.puede_ver_proyecto(proyecto_id));

create function public.medicion_guardar(p_proyecto uuid, p_fecha date, p_bac numeric, p_pv numeric, p_ev numeric, p_ac numeric)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.puede_reportar(p_proyecto) then
    raise exception 'No tienes permiso para registrar mediciones de este proyecto.' using errcode = '42501';
  end if;
  if p_fecha is null then raise exception 'Indica la fecha de corte.' using errcode = '22023'; end if;
  if p_bac is null or p_pv is null or p_ev is null or p_ac is null or least(p_bac, p_pv, p_ev, p_ac) < 0 then
    raise exception 'BAC, PV, EV y AC son obligatorios y no pueden ser negativos.' using errcode = '22023';
  end if;
  if p_bac = 0 then raise exception 'El BAC debe ser mayor que cero.' using errcode = '22023'; end if;
  if p_pv > p_bac or p_ev > p_bac then
    raise exception 'PV y EV no pueden superar el BAC.' using errcode = '22023';
  end if;
  insert into public.mediciones_evm (proyecto_id, fecha_corte, bac, pv, ev, ac, origen)
    values (p_proyecto, p_fecha, p_bac, p_pv, p_ev, p_ac, 'manual')
  on conflict (proyecto_id, fecha_corte) do update
    set bac = excluded.bac, pv = excluded.pv, ev = excluded.ev, ac = excluded.ac, origen = 'manual';
exception when numeric_value_out_of_range then
  raise exception 'Algún valor es demasiado grande.' using errcode = '22023';
end;
$$;

create function public.medicion_borrar(p_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_proy uuid;
begin
  select proyecto_id into v_proy from public.mediciones_evm where id = p_id;
  if v_proy is null then return; end if;
  if auth.uid() is null or not public.puede_reportar(v_proy) then
    raise exception 'No tienes permiso para borrar mediciones de este proyecto.' using errcode = '42501';
  end if;
  delete from public.mediciones_evm where id = p_id;
end;
$$;
revoke execute on function public.medicion_guardar(uuid, date, numeric, numeric, numeric, numeric), public.medicion_borrar(uuid) from public, anon;
grant execute on function public.medicion_guardar(uuid, date, numeric, numeric, numeric, numeric), public.medicion_borrar(uuid) to authenticated;

    $m0006$;
    insert into public.migraciones_aplicadas (nombre) values ('0006_dashboard_v1.sql') on conflict do nothing;
  end if;
end $mig$;

-- 0007_planificacion.sql
do $mig$ begin
  if not exists (select 1 from public.migraciones_aplicadas where nombre = '0007_planificacion.sql') then
    execute $m0007$
-- =============================================================================
-- Hito 3 (v2.0): Stakeholders, WBS (EDT) y Riesgos
-- =============================================================================

-- 1. STAKEHOLDERS ----------------------------------------------------------------
create table public.stakeholders (
  id           uuid primary key default gen_random_uuid(),
  proyecto_id  uuid not null references public.proyectos (id) on delete cascade,
  nombre       text not null check (length(btrim(nombre)) between 1 and 200),
  rol          text check (length(rol) <= 200),
  poder        integer not null check (poder between 1 and 5),
  interes      integer not null check (interes between 1 and 5),
  influencia   integer generated always as (poder * interes) stored,
  necesidades  text check (length(necesidades) <= 4000),
  canal        text check (length(canal) <= 200),
  creado_en    timestamptz not null default now()
);
create index stakeholders_proyecto_idx on public.stakeholders (proyecto_id);

-- 2. WBS ---------------------------------------------------------------------------
create table public.wbs_elementos (
  id           uuid primary key default gen_random_uuid(),
  proyecto_id  uuid not null references public.proyectos (id) on delete cascade,
  padre_id     uuid references public.wbs_elementos (id) on delete restrict,
  codigo       text not null check (codigo ~ '^[0-9]+(\.[0-9]+)*$' and length(codigo) <= 30),
  nombre       text not null check (length(btrim(nombre)) between 1 and 200),
  descripcion  text check (length(descripcion) <= 4000),
  responsable  text check (length(responsable) <= 200),
  inicio_plan  date,
  fin_plan     date,
  estado       text not null default 'pendiente'
    check (estado in ('en_curso', 'completado', 'pendiente', 'en_riesgo', 'bloqueado')),
  creado_en    timestamptz not null default now(),
  unique (proyecto_id, codigo),
  check (fin_plan is null or inicio_plan is null or fin_plan >= inicio_plan)
);
create index wbs_proyecto_idx on public.wbs_elementos (proyecto_id, codigo);

-- El padre debe ser del mismo proyecto y no puede ser el propio elemento.
create function public.wbs_validar_padre()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.padre_id is not null then
    if new.padre_id = new.id then
      raise exception 'Un elemento no puede ser su propio padre.' using errcode = '22023';
    end if;
    if not exists (select 1 from public.wbs_elementos where id = new.padre_id and proyecto_id = new.proyecto_id) then
      raise exception 'El elemento padre debe ser del mismo proyecto.' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;
create trigger wbs_padre before insert or update on public.wbs_elementos
  for each row execute function public.wbs_validar_padre();

-- Plantilla estándar del libro (solo si el proyecto aún no tiene WBS).
create function public.wbs_plantilla(p_proyecto uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_raiz uuid; v_nombre text;
begin
  if auth.uid() is null or not public.puede_gestionar(p_proyecto) then
    raise exception 'No tienes permiso para editar la WBS de este proyecto.' using errcode = '42501';
  end if;
  if exists (select 1 from public.wbs_elementos where proyecto_id = p_proyecto) then
    raise exception 'El proyecto ya tiene elementos en la WBS.' using errcode = '22023';
  end if;
  select nombre into v_nombre from public.proyectos where id = p_proyecto;
  insert into public.wbs_elementos (proyecto_id, codigo, nombre, estado)
    values (p_proyecto, '1.0', v_nombre, 'en_curso') returning id into v_raiz;
  insert into public.wbs_elementos (proyecto_id, padre_id, codigo, nombre)
  select p_proyecto, v_raiz, x.codigo, x.nombre from (values
    ('1.1', 'Gestión del proyecto'), ('1.2', 'Ingeniería y diseño'), ('1.3', 'Permisos y licencias'),
    ('1.4', 'Adquisiciones y contratos'), ('1.5', 'Construcción o ejecución'),
    ('1.6', 'Calidad y SST'), ('1.7', 'Entrega y cierre')) as x(codigo, nombre);
end;
$$;
revoke execute on function public.wbs_plantilla(uuid) from public, anon;
grant execute on function public.wbs_plantilla(uuid) to authenticated;

-- 3. RIESGOS -----------------------------------------------------------------------
create table public.riesgos (
  id            uuid primary key default gen_random_uuid(),
  proyecto_id   uuid not null references public.proyectos (id) on delete cascade,
  codigo        text not null,
  categoria     text not null check (length(btrim(categoria)) between 1 and 100),
  descripcion   text not null check (length(btrim(descripcion)) between 1 and 4000),
  probabilidad  integer not null check (probabilidad between 1 and 5),
  impacto       integer not null check (impacto between 1 and 5),
  score         integer generated always as (probabilidad * impacto) stored,
  estrategia    text check (estrategia in ('evitar', 'mitigar', 'transferir', 'aceptar')),
  plan_accion   text check (length(plan_accion) <= 4000),
  responsable   text check (length(responsable) <= 200),
  estado        text not null default 'activo' check (estado in ('activo', 'materializado', 'cerrado')),
  creado_en     timestamptz not null default now(),
  unique (proyecto_id, codigo)
);
create index riesgos_proyecto_idx on public.riesgos (proyecto_id, estado);

-- Contadores consecutivos por proyecto (nunca se reutilizan, aunque se borre un registro).
create table public.contadores (
  proyecto_id uuid not null references public.proyectos (id) on delete cascade,
  clave       text not null,
  valor       integer not null default 0,
  primary key (proyecto_id, clave)
);
alter table public.contadores enable row level security;
revoke all on public.contadores from anon, authenticated;

create function public.siguiente_consecutivo(p_proyecto uuid, p_clave text)
returns integer language plpgsql security definer set search_path = ''
as $$
declare v integer;
begin
  insert into public.contadores (proyecto_id, clave, valor) values (p_proyecto, p_clave, 1)
  on conflict (proyecto_id, clave) do update set valor = public.contadores.valor + 1
  returning valor into v;
  return v;
end;
$$;
revoke execute on function public.siguiente_consecutivo(uuid, text) from public, anon, authenticated;

-- Código consecutivo por proyecto: R01, R02...
create function public.riesgo_codigo()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.codigo is null or btrim(new.codigo) = '' then
    new.codigo := 'R' || lpad(public.siguiente_consecutivo(new.proyecto_id, 'riesgo')::text, 2, '0');
  end if;
  return new;
end;
$$;
revoke execute on function public.riesgo_codigo() from public, anon, authenticated;
create trigger riesgos_codigo before insert on public.riesgos
  for each row execute function public.riesgo_codigo();
alter table public.riesgos alter column codigo drop not null;
-- (el trigger lo completa siempre; la restricción vuelve tras el trigger)
alter table public.riesgos add constraint riesgos_codigo_lleno check (codigo is not null);

-- 4. ACCESO ---------------------------------------------------------------------------
alter table public.stakeholders  enable row level security;
alter table public.wbs_elementos enable row level security;
alter table public.riesgos       enable row level security;
revoke all on public.stakeholders, public.wbs_elementos, public.riesgos from anon, authenticated;
grant select, insert, update, delete on public.stakeholders, public.wbs_elementos, public.riesgos to authenticated;

-- Stakeholders y riesgos: sin acceso para interventoría (datos internos).
create policy stakeholders_ver on public.stakeholders for select to authenticated using (public.puede_ver_proyecto(proyecto_id));
create policy stakeholders_crear on public.stakeholders for insert to authenticated with check (public.puede_gestionar(proyecto_id));
create policy stakeholders_editar on public.stakeholders for update to authenticated using (public.puede_gestionar(proyecto_id)) with check (public.puede_gestionar(proyecto_id));
create policy stakeholders_borrar on public.stakeholders for delete to authenticated using (public.puede_gestionar(proyecto_id));

create policy riesgos_ver on public.riesgos for select to authenticated using (public.puede_ver_proyecto(proyecto_id));
create policy riesgos_crear on public.riesgos for insert to authenticated with check (public.puede_gestionar(proyecto_id));
create policy riesgos_editar on public.riesgos for update to authenticated using (public.puede_gestionar(proyecto_id)) with check (public.puede_gestionar(proyecto_id));
create policy riesgos_borrar on public.riesgos for delete to authenticated using (public.puede_gestionar(proyecto_id));

-- WBS: la interventoría la puede leer.
create policy wbs_ver on public.wbs_elementos for select to authenticated
  using (public.puede_ver_proyecto(proyecto_id) or public.es_interventor(proyecto_id));
create policy wbs_crear on public.wbs_elementos for insert to authenticated with check (public.puede_gestionar(proyecto_id));
create policy wbs_editar on public.wbs_elementos for update to authenticated using (public.puede_gestionar(proyecto_id)) with check (public.puede_gestionar(proyecto_id));
create policy wbs_borrar on public.wbs_elementos for delete to authenticated using (public.puede_gestionar(proyecto_id));

    $m0007$;
    insert into public.migraciones_aplicadas (nombre) values ('0007_planificacion.sql') on conflict do nothing;
  end if;
end $mig$;

-- 0008_cambios.sql
do $mig$ begin
  if not exists (select 1 from public.migraciones_aplicadas where nombre = '0008_cambios.sql') then
    execute $m0008$
-- =============================================================================
-- Hito 4 (v2.0): Control de cambios (flujo de 8 fases), niveles, aprobación por nivel,
-- firma del patrocinador y versionado de la línea base.
-- =============================================================================

-- Parámetro nuevo: ¿el administrador puede aprobar cambios? (por defecto no: lo decide el rol de la regla)
insert into public.parametros (ambito, clave, valor, descripcion, fuente) values
 ('global', 'cambio_admin_puede_aprobar', 'no',
  'Si es "si", el administrador también puede aprobar o rechazar cambios (útil solo en pruebas)', 'Propuesta');

-- 1. LÍNEAS BASE ---------------------------------------------------------------------
create table public.lineas_base (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos (id) on delete cascade,
  tipo        text not null check (tipo in ('alcance', 'cronograma', 'costo')),
  version     integer not null check (version >= 1),
  bac         numeric(15, 2) check (bac >= 0),       -- línea base de costo
  fecha_fin   date,                                  -- línea base de cronograma
  nota        text check (length(nota) <= 500),
  aprobada_por uuid,
  fecha       date not null default current_date,
  cambio_id   uuid,
  unique (proyecto_id, tipo, version)
);
create index lineas_base_idx on public.lineas_base (proyecto_id, tipo, version desc);

-- BAC vigente: la última línea base de costo; si aún no hay, el BAC de la última medición de valor ganado.
create function public.linea_base_bac(p_proyecto uuid)
returns numeric language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select bac from public.lineas_base where proyecto_id = p_proyecto and tipo = 'costo' order by version desc limit 1),
    (select bac from public.mediciones_evm where proyecto_id = p_proyecto order by fecha_corte desc limit 1)
  );
$$;
revoke execute on function public.linea_base_bac(uuid) from public, anon;
grant execute on function public.linea_base_bac(uuid) to authenticated;

-- Valor del contrato (lo reemplaza el hito de contratos). Mientras tanto no hay contratos.
create function public.valor_contrato(p_contrato uuid)
returns numeric language sql stable security definer set search_path = ''
as $$ select null::numeric; $$;
revoke execute on function public.valor_contrato(uuid) from public, anon, authenticated;

-- Concepto de interventoría pendiente (lo reemplaza el hito de interventoría).
create function public.cambio_concepto_pendiente(p_cambio uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select false; $$;
revoke execute on function public.cambio_concepto_pendiente(uuid) from public, anon, authenticated;

-- 2. CAMBIOS ----------------------------------------------------------------------------
create table public.cambios (
  id                         uuid primary key default gen_random_uuid(),
  proyecto_id                uuid not null references public.proyectos (id) on delete cascade,
  codigo                     text not null,
  contrato_id                uuid,
  riesgo_id                  uuid references public.riesgos (id) on delete set null,
  fecha_solicitud            date not null default current_date,
  solicitante_id             uuid default auth.uid(),
  tipo                       text not null check (length(btrim(tipo)) between 1 and 100),
  descripcion_antes          text check (length(descripcion_antes) <= 4000),
  descripcion_despues        text not null check (length(btrim(descripcion_despues)) between 1 and 4000),
  justificacion              text not null check (length(btrim(justificacion)) between 1 and 4000),
  impacto_alcance            text check (length(impacto_alcance) <= 4000),
  impacto_costo              numeric(15, 2) not null default 0,
  impacto_dias               integer not null default 0 check (impacto_dias between -3650 and 3650),
  ambitos                    text[] not null default '{}'
    check (ambitos <@ array['alcance','financiero','cronograma','flujo_caja','contractual','operativo','riesgos','calidad','reputacional','regulatorio']),
  estado_flujo               text not null default 'identificado'
    check (estado_flujo in ('identificado','radicado','evaluacion_tecnica_financiera','analisis_impacto','aprobacion','aprobado','rechazado','implementacion','cerrado')),
  -- calculados (los fija la base de datos, nunca la pantalla)
  nivel                      text check (nivel in ('menor', 'moderado', 'critico')),
  variacion_pct              numeric(12, 4),
  base_valor                 numeric(15, 2),
  requiere_firma_patrocinador boolean not null default false,
  en_aprobacion_desde        timestamptz,
  firma_patrocinador         date,
  firma_patrocinador_por     uuid,
  aprobador_id               uuid,
  fecha_aprobacion           date,
  responsable_implementacion text check (length(responsable_implementacion) <= 200),
  observaciones              text check (length(observaciones) <= 4000),
  lecciones                  text check (length(lecciones) <= 4000),
  detectado_sin_formato      boolean not null default false,
  creado_en                  timestamptz not null default now(),
  actualizado_en             timestamptz not null default now(),
  unique (proyecto_id, codigo)
);
create index cambios_proyecto_idx on public.cambios (proyecto_id, estado_flujo);
create trigger cambios_actualizado before update on public.cambios
  for each row execute function public.marcar_actualizado();
create trigger cambios_audit after insert or update or delete on public.cambios
  for each row execute function public.auditar_tabla();
create trigger lineas_base_audit after insert or update or delete on public.lineas_base
  for each row execute function public.auditar_tabla();

create table public.cambios_historial (
  id         bigint generated always as identity primary key,
  cambio_id  uuid not null references public.cambios (id) on delete cascade,
  proyecto_id uuid not null,
  fecha      timestamptz not null default now(),
  usuario_id uuid default auth.uid(),
  de_estado  text,
  a_estado   text not null,
  nota       text
);
create index cambios_historial_idx on public.cambios_historial (cambio_id, id);

alter table public.cambios enable row level security;
alter table public.cambios_historial enable row level security;
alter table public.lineas_base enable row level security;
revoke all on public.cambios, public.cambios_historial, public.lineas_base from anon, authenticated;
grant select on public.cambios, public.cambios_historial, public.lineas_base to authenticated;
create policy cambios_ver on public.cambios for select to authenticated using (public.puede_ver_proyecto(proyecto_id));
create policy cambios_historial_ver on public.cambios_historial for select to authenticated using (public.puede_ver_proyecto(proyecto_id));
create policy lineas_base_ver on public.lineas_base for select to authenticated using (public.puede_ver_proyecto(proyecto_id));

-- 3. NIVEL Y BASE --------------------------------------------------------------------------
-- Base del porcentaje: valor del contrato si el cambio está ligado a uno; si no, el BAC (S6).
-- Menor: hasta 2 %. Moderado: más de 2 % hasta 5 %. Crítico: más de 5 %, o cambio de plazo en un
-- contrato. Comparación exacta (sin redondear): 9.600.000 sobre 480.000.000 es exactamente 2 %.
create function public.cambio_calcular(
  p_proyecto uuid, p_contrato uuid, p_costo numeric, p_dias integer,
  out base_valor numeric, out variacion_pct numeric, out nivel text, out requiere_firma boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_menor numeric := coalesce(public.parametro('cambio_menor_max_pct', p_proyecto)::numeric, 2);
  v_mod   numeric := coalesce(public.parametro('cambio_moderado_max_pct', p_proyecto)::numeric, 5);
  v_firma numeric := coalesce(public.parametro('cambio_firma_patrocinador_pct', p_proyecto)::numeric, 5);
  v_abs numeric := abs(coalesce(p_costo, 0));
begin
  if p_contrato is not null then base_valor := public.valor_contrato(p_contrato); end if;
  if base_valor is null or base_valor <= 0 then base_valor := public.linea_base_bac(p_proyecto); end if;
  if base_valor is not null and base_valor <= 0 then base_valor := null; end if;

  if v_abs = 0 then variacion_pct := 0;
  elsif base_valor is null then variacion_pct := null;
  else variacion_pct := round(v_abs * 100 / base_valor, 4);
  end if;

  if p_contrato is not null and coalesce(p_dias, 0) <> 0 then nivel := 'critico';
  elsif v_abs = 0 then nivel := 'menor';
  elsif base_valor is null then nivel := null;
  elsif v_abs * 100 <= v_menor * base_valor then nivel := 'menor';
  elsif v_abs * 100 <= v_mod * base_valor then nivel := 'moderado';
  else nivel := 'critico';
  end if;

  requiere_firma := (base_valor is not null and v_abs * 100 > v_firma * base_valor);
end;
$$;
revoke execute on function public.cambio_calcular(uuid, uuid, numeric, integer) from public, anon, authenticated;

-- 4. VALIDACIÓN DE DATOS ---------------------------------------------------------------------
create function public.cambio_leer_texto(p_datos jsonb, p_campo text, p_max integer, p_obligatorio boolean)
returns text language plpgsql immutable set search_path = ''
as $$
declare t text := nullif(btrim(coalesce(p_datos ->> p_campo, '')), '');
begin
  if t is null and p_obligatorio then
    raise exception 'El campo % es obligatorio.', replace(p_campo, '_', ' ') using errcode = '22023';
  end if;
  if t is not null and length(t) > p_max then
    raise exception 'El campo % supera % caracteres.', replace(p_campo, '_', ' '), p_max using errcode = '22023';
  end if;
  return t;
end;
$$;
revoke execute on function public.cambio_leer_texto(jsonb, text, integer, boolean) from public, anon, authenticated;

-- 5. CREAR ---------------------------------------------------------------------------------------
create function public.cambio_crear(p_proyecto uuid, p_datos jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid; v_anio text := to_char(current_date, 'YYYY'); v_codigo text;
  v_costo numeric(15,2); v_dias integer; v_ambitos text[]; calc record;
  v_contrato uuid := nullif(p_datos ->> 'contrato_id', '')::uuid;
  v_riesgo uuid := nullif(p_datos ->> 'riesgo_id', '')::uuid;
begin
  if auth.uid() is null or not public.puede_gestionar(p_proyecto) then
    raise exception 'No tienes permiso para registrar cambios en este proyecto.' using errcode = '42501';
  end if;
  begin
    v_costo := coalesce(nullif(btrim(coalesce(p_datos ->> 'impacto_costo', '')), '')::numeric, 0);
    v_dias := coalesce(nullif(btrim(coalesce(p_datos ->> 'impacto_dias', '')), '')::integer, 0);
  exception when others then
    raise exception 'El impacto en costo y en días deben ser números válidos.' using errcode = '22023';
  end;
  v_ambitos := coalesce(array(select jsonb_array_elements_text(coalesce(p_datos -> 'ambitos', '[]'::jsonb))), '{}');
  if v_riesgo is not null and not exists (select 1 from public.riesgos where id = v_riesgo and proyecto_id = p_proyecto) then
    raise exception 'El riesgo no es de este proyecto.' using errcode = '22023';
  end if;

  select * into calc from public.cambio_calcular(p_proyecto, v_contrato, v_costo, v_dias);
  v_codigo := 'CC-' || v_anio || '-' || lpad(public.siguiente_consecutivo(p_proyecto, 'cambio-' || v_anio)::text, 3, '0');
  insert into public.cambios (proyecto_id, codigo, contrato_id, riesgo_id, tipo, descripcion_antes, descripcion_despues,
      justificacion, impacto_alcance, impacto_costo, impacto_dias, ambitos, nivel, variacion_pct, base_valor,
      requiere_firma_patrocinador, responsable_implementacion, observaciones, detectado_sin_formato)
    values (p_proyecto, v_codigo, v_contrato, v_riesgo,
      public.cambio_leer_texto(p_datos, 'tipo', 100, true),
      public.cambio_leer_texto(p_datos, 'descripcion_antes', 4000, false),
      public.cambio_leer_texto(p_datos, 'descripcion_despues', 4000, true),
      public.cambio_leer_texto(p_datos, 'justificacion', 4000, true),
      public.cambio_leer_texto(p_datos, 'impacto_alcance', 4000, false),
      v_costo, v_dias, v_ambitos, calc.nivel, calc.variacion_pct, calc.base_valor, calc.requiere_firma,
      public.cambio_leer_texto(p_datos, 'responsable_implementacion', 200, false),
      public.cambio_leer_texto(p_datos, 'observaciones', 4000, false),
      coalesce((p_datos ->> 'detectado_sin_formato')::boolean, false))
    returning id into v_id;
  insert into public.cambios_historial (cambio_id, proyecto_id, a_estado, nota) values (v_id, p_proyecto, 'identificado', 'Cambio identificado y documentado');
  return v_id;
exception when check_violation then
  raise exception 'Algún valor del cambio no es válido (revisa el impacto en días y los ámbitos).' using errcode = '22023';
  when numeric_value_out_of_range then
  raise exception 'El impacto en costo es demasiado grande.' using errcode = '22023';
end;
$$;

-- 6. ACTUALIZAR ----------------------------------------------------------------------------------
-- Antes de la aprobación se puede editar todo (gerente o analista PMO). Desde la aprobación solo
-- observaciones, responsable de implementación y lecciones aprendidas (gerente).
create function public.cambio_actualizar(p_cambio uuid, p_datos jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare c public.cambios; calc record; v_costo numeric(15,2); v_dias integer; v_ambitos text[];
  v_contrato uuid; v_antes boolean;
begin
  select * into c from public.cambios where id = p_cambio for update;
  if not found then raise exception 'Cambio no encontrado.' using errcode = '22023'; end if;
  v_antes := c.estado_flujo in ('identificado','radicado','evaluacion_tecnica_financiera','analisis_impacto');

  if auth.uid() is null or not (public.puede_gestionar(c.proyecto_id) or (v_antes and public.puede_reportar(c.proyecto_id))) then
    raise exception 'No tienes permiso para editar este cambio.' using errcode = '42501';
  end if;
  if c.estado_flujo = 'cerrado' then
    raise exception 'El cambio está cerrado y no se puede editar.' using errcode = '22023';
  end if;

  if v_antes then
    begin
      v_costo := coalesce(nullif(btrim(coalesce(p_datos ->> 'impacto_costo', '')), '')::numeric, 0);
      v_dias := coalesce(nullif(btrim(coalesce(p_datos ->> 'impacto_dias', '')), '')::integer, 0);
    exception when others then
      raise exception 'El impacto en costo y en días deben ser números válidos.' using errcode = '22023';
    end;
    v_ambitos := coalesce(array(select jsonb_array_elements_text(coalesce(p_datos -> 'ambitos', '[]'::jsonb))), '{}');
    v_contrato := nullif(p_datos ->> 'contrato_id', '')::uuid;
    select * into calc from public.cambio_calcular(c.proyecto_id, v_contrato, v_costo, v_dias);
    update public.cambios set
      contrato_id = v_contrato,
      tipo = public.cambio_leer_texto(p_datos, 'tipo', 100, true),
      descripcion_antes = public.cambio_leer_texto(p_datos, 'descripcion_antes', 4000, false),
      descripcion_despues = public.cambio_leer_texto(p_datos, 'descripcion_despues', 4000, true),
      justificacion = public.cambio_leer_texto(p_datos, 'justificacion', 4000, true),
      impacto_alcance = public.cambio_leer_texto(p_datos, 'impacto_alcance', 4000, false),
      impacto_costo = v_costo, impacto_dias = v_dias, ambitos = v_ambitos,
      nivel = calc.nivel, variacion_pct = calc.variacion_pct, base_valor = calc.base_valor,
      requiere_firma_patrocinador = calc.requiere_firma,
      detectado_sin_formato = coalesce((p_datos ->> 'detectado_sin_formato')::boolean, false)
    where id = p_cambio;
  end if;

  update public.cambios set
    responsable_implementacion = public.cambio_leer_texto(p_datos, 'responsable_implementacion', 200, false),
    observaciones = public.cambio_leer_texto(p_datos, 'observaciones', 4000, false),
    lecciones = public.cambio_leer_texto(p_datos, 'lecciones', 4000, false)
  where id = p_cambio;
exception when check_violation then
  raise exception 'Algún valor del cambio no es válido (revisa el impacto en días y los ámbitos).' using errcode = '22023';
  when numeric_value_out_of_range then
  raise exception 'El impacto en costo es demasiado grande.' using errcode = '22023';
end;
$$;

-- 7. AVANZAR / DEVOLVER -------------------------------------------------------------------------------
create function public.cambio_avanzar(p_cambio uuid, p_nota text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare c public.cambios; v_sig text; calc record; v_nota text := nullif(btrim(coalesce(p_nota, '')), '');
begin
  select * into c from public.cambios where id = p_cambio for update;
  if not found then raise exception 'Cambio no encontrado.' using errcode = '22023'; end if;
  if auth.uid() is null then raise exception 'Debes iniciar sesión.' using errcode = '28000'; end if;
  if v_nota is not null and length(v_nota) > 500 then raise exception 'La nota no puede superar 500 caracteres.' using errcode = '22023'; end if;

  v_sig := case c.estado_flujo
    when 'identificado' then 'radicado'
    when 'radicado' then 'evaluacion_tecnica_financiera'
    when 'evaluacion_tecnica_financiera' then 'analisis_impacto'
    when 'analisis_impacto' then 'aprobacion'
    when 'aprobado' then 'implementacion'
    when 'implementacion' then 'cerrado'
    when 'rechazado' then 'cerrado'
    else null end;
  if v_sig is null then
    raise exception '%', case c.estado_flujo
      when 'aprobacion' then 'En esta fase se aprueba o se rechaza el cambio.'
      else 'El cambio ya está cerrado.' end using errcode = '22023';
  end if;

  -- Quién puede dar cada paso
  if c.estado_flujo in ('identificado', 'aprobado', 'implementacion', 'rechazado') then
    if not public.puede_gestionar(c.proyecto_id) then
      raise exception 'Solo el gerente del proyecto (o el administrador) puede dar este paso.' using errcode = '42501';
    end if;
  elsif not public.puede_reportar(c.proyecto_id) then
    raise exception 'Solo el gerente, el analista PMO o el administrador pueden dar este paso.' using errcode = '42501';
  end if;

  if c.estado_flujo = 'identificado' and c.nivel is null then
    raise exception 'No hay línea base de costo (BAC) para calcular el nivel del cambio. Registra primero una medición de valor ganado.' using errcode = '22023';
  end if;
  if c.estado_flujo = 'evaluacion_tecnica_financiera' and public.cambio_concepto_pendiente(c.id) then
    raise exception 'Falta el concepto de la interventoría antes de pasar al análisis de impacto.' using errcode = '22023';
  end if;

  if v_sig = 'aprobacion' then
    -- Al entrar a aprobación se recalcula el nivel con la línea base vigente y queda fijo.
    select * into calc from public.cambio_calcular(c.proyecto_id, c.contrato_id, c.impacto_costo, c.impacto_dias);
    if calc.nivel is null then
      raise exception 'No hay línea base de costo (BAC) para calcular el nivel del cambio.' using errcode = '22023';
    end if;
    update public.cambios set nivel = calc.nivel, variacion_pct = calc.variacion_pct, base_valor = calc.base_valor,
      requiere_firma_patrocinador = calc.requiere_firma, en_aprobacion_desde = now() where id = c.id;
  end if;

  update public.cambios set estado_flujo = v_sig where id = c.id;
  insert into public.cambios_historial (cambio_id, proyecto_id, de_estado, a_estado, nota)
    values (c.id, c.proyecto_id, c.estado_flujo, v_sig, v_nota);
end;
$$;

create function public.cambio_devolver(p_cambio uuid, p_nota text)
returns void language plpgsql security definer set search_path = ''
as $$
declare c public.cambios; v_nota text := nullif(btrim(coalesce(p_nota, '')), '');
begin
  select * into c from public.cambios where id = p_cambio for update;
  if not found then raise exception 'Cambio no encontrado.' using errcode = '22023'; end if;
  if auth.uid() is null or not public.puede_reportar(c.proyecto_id) then
    raise exception 'No tienes permiso para devolver este cambio.' using errcode = '42501';
  end if;
  if c.estado_flujo <> 'aprobacion' then
    raise exception 'Solo se puede devolver un cambio que está en aprobación.' using errcode = '22023';
  end if;
  if v_nota is null or length(v_nota) < 3 or length(v_nota) > 500 then
    raise exception 'Escribe el motivo de la devolución (3 a 500 caracteres).' using errcode = '22023';
  end if;
  update public.cambios set estado_flujo = 'analisis_impacto', en_aprobacion_desde = null,
    firma_patrocinador = null, firma_patrocinador_por = null where id = c.id;
  insert into public.cambios_historial (cambio_id, proyecto_id, de_estado, a_estado, nota)
    values (c.id, c.proyecto_id, 'aprobacion', 'analisis_impacto', 'Devuelto: ' || v_nota);
end;
$$;

-- 8. FIRMA DEL PATROCINADOR -------------------------------------------------------------------------------
create function public.cambio_firmar_patrocinador(p_cambio uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare c public.cambios;
begin
  select * into c from public.cambios where id = p_cambio for update;
  if not found then raise exception 'Cambio no encontrado.' using errcode = '22023'; end if;
  if auth.uid() is null or not (public.es_admin() or exists (select 1 from public.miembros_proyecto
      where proyecto_id = c.proyecto_id and usuario_id = auth.uid() and rol = 'patrocinador')) then
    raise exception 'Solo el patrocinador (o el administrador) registra su firma.' using errcode = '42501';
  end if;
  if c.estado_flujo <> 'aprobacion' then
    raise exception 'La firma se registra cuando el cambio está en aprobación.' using errcode = '22023';
  end if;
  if not c.requiere_firma_patrocinador then
    raise exception 'Este cambio no requiere la firma del patrocinador.' using errcode = '22023';
  end if;
  update public.cambios set firma_patrocinador = current_date, firma_patrocinador_por = auth.uid() where id = c.id;
  insert into public.cambios_historial (cambio_id, proyecto_id, de_estado, a_estado, nota)
    values (c.id, c.proyecto_id, 'aprobacion', 'aprobacion', 'Firma del patrocinador registrada');
end;
$$;

-- 9. DECIDIR: APROBAR O RECHAZAR -------------------------------------------------------------------------------
-- Quién decide lo define el parámetro cambio_aprobador_<nivel>: "gerente" o "director_general".
create function public.cambio_decidir(p_cambio uuid, p_decision text, p_nota text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  c public.cambios; v_aprobador text; v_permitido boolean; v_nota text := nullif(btrim(coalesce(p_nota, '')), '');
  v_bac numeric; v_fin date; v_ver integer; v_nuevo text;
begin
  select * into c from public.cambios where id = p_cambio for update;
  if not found then raise exception 'Cambio no encontrado.' using errcode = '22023'; end if;
  if auth.uid() is null then raise exception 'Debes iniciar sesión.' using errcode = '28000'; end if;
  if c.estado_flujo <> 'aprobacion' then
    raise exception 'El cambio no está en la fase de aprobación.' using errcode = '22023';
  end if;
  if p_decision not in ('aprobar', 'rechazar') then raise exception 'Decisión no válida.' using errcode = '22023'; end if;
  if v_nota is not null and length(v_nota) > 500 then raise exception 'La nota no puede superar 500 caracteres.' using errcode = '22023'; end if;

  v_aprobador := public.parametro('cambio_aprobador_' || case c.nivel when 'menor' then 'menor' when 'moderado' then 'moderado' else 'critico' end, c.proyecto_id);
  v_permitido := (v_aprobador = 'gerente' and public.es_gerente_proyecto(c.proyecto_id))
              or (v_aprobador = 'director_general' and public.es_director_general())
              or (public.es_admin() and public.parametro('cambio_admin_puede_aprobar', c.proyecto_id) = 'si');
  if not v_permitido then
    raise exception 'Este cambio es de nivel % y lo decide: %.', c.nivel,
      case v_aprobador when 'gerente' then 'el gerente del proyecto' else 'el director general de planificación y proyectos' end
      using errcode = '42501';
  end if;

  if p_decision = 'rechazar' then
    if v_nota is null or length(v_nota) < 3 then
      raise exception 'Escribe el motivo del rechazo (mínimo 3 caracteres).' using errcode = '22023';
    end if;
    update public.cambios set estado_flujo = 'rechazado', aprobador_id = auth.uid(), fecha_aprobacion = current_date where id = c.id;
    insert into public.cambios_historial (cambio_id, proyecto_id, de_estado, a_estado, nota) values (c.id, c.proyecto_id, 'aprobacion', 'rechazado', v_nota);
    return;
  end if;

  if c.requiere_firma_patrocinador and c.firma_patrocinador is null then
    raise exception 'Este cambio supera el % del presupuesto y requiere la firma del patrocinador antes de aprobarse.',
      coalesce(public.parametro('cambio_firma_patrocinador_pct', c.proyecto_id), '5') || ' %' using errcode = '22023';
  end if;

  update public.cambios set estado_flujo = 'aprobado', aprobador_id = auth.uid(), fecha_aprobacion = current_date where id = c.id;
  insert into public.cambios_historial (cambio_id, proyecto_id, de_estado, a_estado, nota) values (c.id, c.proyecto_id, 'aprobacion', 'aprobado', v_nota);

  -- Todo cambio aprobado versiona la línea base que corresponda.
  if c.impacto_costo <> 0 then
    v_bac := public.linea_base_bac(c.proyecto_id);
    select coalesce(max(version), 0) + 1 into v_ver from public.lineas_base where proyecto_id = c.proyecto_id and tipo = 'costo';
    insert into public.lineas_base (proyecto_id, tipo, version, bac, aprobada_por, cambio_id, nota)
      values (c.proyecto_id, 'costo', v_ver, coalesce(v_bac, 0) + c.impacto_costo, auth.uid(), c.id, 'Cambio ' || c.codigo);
  end if;
  if c.impacto_dias <> 0 then
    select coalesce((select fecha_fin from public.lineas_base where proyecto_id = c.proyecto_id and tipo = 'cronograma' order by version desc limit 1),
      (select (fecha_inicio + make_interval(months => duracion_meses))::date from public.proyectos where id = c.proyecto_id)) into v_fin;
    select coalesce(max(version), 0) + 1 into v_ver from public.lineas_base where proyecto_id = c.proyecto_id and tipo = 'cronograma';
    insert into public.lineas_base (proyecto_id, tipo, version, fecha_fin, aprobada_por, cambio_id, nota)
      values (c.proyecto_id, 'cronograma', v_ver, v_fin + c.impacto_dias, auth.uid(), c.id, 'Cambio ' || c.codigo);
  end if;
  if nullif(btrim(coalesce(c.impacto_alcance, '')), '') is not null then
    select coalesce(max(version), 0) + 1 into v_ver from public.lineas_base where proyecto_id = c.proyecto_id and tipo = 'alcance';
    insert into public.lineas_base (proyecto_id, tipo, version, aprobada_por, cambio_id, nota)
      values (c.proyecto_id, 'alcance', v_ver, auth.uid(), c.id, 'Cambio ' || c.codigo);
  end if;
end;
$$;

revoke execute on function
  public.cambio_crear(uuid, jsonb), public.cambio_actualizar(uuid, jsonb), public.cambio_avanzar(uuid, text),
  public.cambio_devolver(uuid, text), public.cambio_firmar_patrocinador(uuid), public.cambio_decidir(uuid, text, text)
  from public, anon;
grant execute on function
  public.cambio_crear(uuid, jsonb), public.cambio_actualizar(uuid, jsonb), public.cambio_avanzar(uuid, text),
  public.cambio_devolver(uuid, text), public.cambio_firmar_patrocinador(uuid), public.cambio_decidir(uuid, text, text)
  to authenticated;

    $m0008$;
    insert into public.migraciones_aplicadas (nombre) values ('0008_cambios.sql') on conflict do nothing;
  end if;
end $mig$;

-- 0009_reportes_kpis.sql
do $mig$ begin
  if not exists (select 1 from public.migraciones_aplicadas where nombre = '0009_reportes_kpis.sql') then
    execute $m0009$
-- =============================================================================
-- Hito 5 (v2.0): Reporte semanal, hitos, reuniones, evaluación del patrocinador
-- (base de los seis KPIs de gestión)
-- =============================================================================

insert into public.parametros (ambito, clave, valor, descripcion, fuente) values
 ('global', 'reporte_dias_gracia', '2',
  'Días después del domingo de la semana en que aún se considera "a tiempo" un reporte', 'Propuesta (P4: semana ISO)'),
 ('global', 'tipos_reunion', 'Seguimiento,Comité,Coordinación,Cliente,Otra', 'Catálogo de tipos de reunión', 'Propuesta');

-- 1. HITOS ------------------------------------------------------------------------------
-- Cumplido = tiene fecha real. Vencido = sin fecha real, no cancelado y con fecha plan pasada.
create table public.hitos (
  id           uuid primary key default gen_random_uuid(),
  proyecto_id  uuid not null references public.proyectos (id) on delete cascade,
  nombre       text not null check (length(btrim(nombre)) between 1 and 200),
  fecha_plan   date not null,
  fecha_real   date,
  cancelado    boolean not null default false,
  creado_en    timestamptz not null default now(),
  check (not (cancelado and fecha_real is not null))
);
create index hitos_proyecto_idx on public.hitos (proyecto_id, fecha_plan);

-- 2. REUNIONES ---------------------------------------------------------------------------
create table public.reuniones (
  id           uuid primary key default gen_random_uuid(),
  proyecto_id  uuid not null references public.proyectos (id) on delete cascade,
  fecha        date not null,
  tipo         text not null check (length(btrim(tipo)) between 1 and 100),
  tiene_acta   boolean not null default false,
  acuerdos     text check (length(acuerdos) <= 4000),
  creado_en    timestamptz not null default now()
);
create index reuniones_proyecto_idx on public.reuniones (proyecto_id, fecha desc);

-- 3. EVALUACIÓN DEL PATROCINADOR (encuesta simple 1 a 5, una por mes) --------------------------
create table public.evaluaciones_patrocinador (
  proyecto_id  uuid not null references public.proyectos (id) on delete cascade,
  mes          date not null check (mes = date_trunc('month', mes)::date),
  puntaje      integer not null check (puntaje between 1 and 5),
  registrado_por uuid default auth.uid(),
  primary key (proyecto_id, mes)
);

-- 4. REPORTES SEMANALES --------------------------------------------------------------------
create table public.reportes_semanales (
  id                    uuid primary key default gen_random_uuid(),
  proyecto_id           uuid not null references public.proyectos (id) on delete cascade,
  anio                  integer not null,   -- año ISO
  semana                integer not null check (semana between 1 and 53),
  fecha_reporte         date not null,
  proxima_revision      date,
  estado_reportado      text not null default 'verde' check (estado_reportado in ('verde', 'amarillo', 'rojo')),
  logros                text check (length(logros) <= 4000),
  alertas               text check (length(alertas) <= 4000),
  decisiones_requeridas text check (length(decisiones_requeridas) <= 4000),
  proximos_hitos        text check (length(proximos_hitos) <= 4000),
  gerente_id            uuid default auth.uid(),
  foto                  jsonb,              -- indicadores al momento de enviar (histórico, no se recalcula)
  enviado_en            timestamptz,
  creado_en             timestamptz not null default now(),
  unique (proyecto_id, anio, semana)
);
create index reportes_proyecto_idx on public.reportes_semanales (proyecto_id, anio desc, semana desc);

-- Un reporte enviado es inmutable.
create function public.reporte_inmutable()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if old.enviado_en is not null then
    raise exception 'Un reporte enviado no se puede modificar ni borrar.' using errcode = '22023';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger reportes_inmutable before update or delete on public.reportes_semanales
  for each row execute function public.reporte_inmutable();

-- 5. ACCESO -------------------------------------------------------------------------------------
alter table public.hitos enable row level security;
alter table public.reuniones enable row level security;
alter table public.evaluaciones_patrocinador enable row level security;
alter table public.reportes_semanales enable row level security;
revoke all on public.hitos, public.reuniones, public.evaluaciones_patrocinador, public.reportes_semanales from anon, authenticated;
grant select, insert, update, delete on public.hitos, public.reuniones to authenticated;
grant select on public.evaluaciones_patrocinador, public.reportes_semanales to authenticated;

-- Hitos y reuniones: la interventoría no ve las reuniones; los hitos los ve el equipo.
create policy hitos_ver on public.hitos for select to authenticated using (public.puede_ver_proyecto(proyecto_id) or public.es_interventor(proyecto_id));
create policy hitos_crear on public.hitos for insert to authenticated with check (public.puede_gestionar(proyecto_id));
create policy hitos_editar on public.hitos for update to authenticated using (public.puede_gestionar(proyecto_id)) with check (public.puede_gestionar(proyecto_id));
create policy hitos_borrar on public.hitos for delete to authenticated using (public.puede_gestionar(proyecto_id));
create policy reuniones_ver on public.reuniones for select to authenticated using (public.puede_ver_proyecto(proyecto_id));
create policy reuniones_crear on public.reuniones for insert to authenticated with check (public.puede_gestionar(proyecto_id));
create policy reuniones_editar on public.reuniones for update to authenticated using (public.puede_gestionar(proyecto_id)) with check (public.puede_gestionar(proyecto_id));
create policy reuniones_borrar on public.reuniones for delete to authenticated using (public.puede_gestionar(proyecto_id));
create policy evaluaciones_ver on public.evaluaciones_patrocinador for select to authenticated using (public.puede_ver_proyecto(proyecto_id));
create policy reportes_ver on public.reportes_semanales for select to authenticated using (public.puede_ver_proyecto(proyecto_id));

create function public.evaluacion_patrocinador_guardar(p_proyecto uuid, p_mes date, p_puntaje integer)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not (public.puede_gestionar(p_proyecto) or exists (
      select 1 from public.miembros_proyecto where proyecto_id = p_proyecto and usuario_id = auth.uid() and rol = 'patrocinador')) then
    raise exception 'Solo el gerente, el patrocinador o el administrador registran la evaluación.' using errcode = '42501';
  end if;
  if p_puntaje is null or p_puntaje not between 1 and 5 then
    raise exception 'El puntaje debe estar entre 1 y 5.' using errcode = '22023';
  end if;
  if p_mes is null then raise exception 'Indica el mes.' using errcode = '22023'; end if;
  insert into public.evaluaciones_patrocinador (proyecto_id, mes, puntaje)
    values (p_proyecto, date_trunc('month', p_mes)::date, p_puntaje)
  on conflict (proyecto_id, mes) do update set puntaje = excluded.puntaje, registrado_por = auth.uid();
end;
$$;

-- Crear el borrador del reporte de la semana ISO de una fecha.
create function public.reporte_crear(p_proyecto uuid, p_fecha date)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.puede_gestionar(p_proyecto) then
    raise exception 'No tienes permiso para crear reportes de este proyecto.' using errcode = '42501';
  end if;
  if p_fecha is null then raise exception 'Indica la fecha del reporte.' using errcode = '22023'; end if;
  insert into public.reportes_semanales (proyecto_id, anio, semana, fecha_reporte, proxima_revision)
    values (p_proyecto, extract(isoyear from p_fecha)::integer, extract(week from p_fecha)::integer, p_fecha, p_fecha + 7)
    returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'Ya existe un reporte de esa semana para este proyecto.' using errcode = '22023';
end;
$$;

create function public.reporte_guardar(p_reporte uuid, p_datos jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare r public.reportes_semanales; v_prox date;
begin
  select * into r from public.reportes_semanales where id = p_reporte for update;
  if not found then raise exception 'Reporte no encontrado.' using errcode = '22023'; end if;
  if auth.uid() is null or not public.puede_gestionar(r.proyecto_id) then
    raise exception 'No tienes permiso para editar este reporte.' using errcode = '42501';
  end if;
  if r.enviado_en is not null then
    raise exception 'Un reporte enviado no se puede modificar.' using errcode = '22023';
  end if;
  if coalesce(p_datos ->> 'estado_reportado', '') not in ('verde', 'amarillo', 'rojo') then
    raise exception 'Elige el estado general del proyecto.' using errcode = '22023';
  end if;
  begin
    v_prox := nullif(btrim(coalesce(p_datos ->> 'proxima_revision', '')), '')::date;
  exception when others then
    raise exception 'La fecha de la próxima revisión no es válida.' using errcode = '22023';
  end;
  update public.reportes_semanales set
    estado_reportado = p_datos ->> 'estado_reportado',
    proxima_revision = v_prox,
    logros = nullif(btrim(coalesce(p_datos ->> 'logros', '')), ''),
    alertas = nullif(btrim(coalesce(p_datos ->> 'alertas', '')), ''),
    decisiones_requeridas = nullif(btrim(coalesce(p_datos ->> 'decisiones_requeridas', '')), ''),
    proximos_hitos = nullif(btrim(coalesce(p_datos ->> 'proximos_hitos', '')), '')
  where id = p_reporte;
exception when check_violation then
  raise exception 'Algún texto supera los 4000 caracteres.' using errcode = '22023';
end;
$$;

-- Enviar: fija la "foto" de los indicadores (valor ganado, hitos de la semana) que ya no se recalcula.
create function public.reporte_enviar(p_reporte uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  r public.reportes_semanales; m public.mediciones_evm; v_foto jsonb; v_lunes date; v_hitos integer;
begin
  select * into r from public.reportes_semanales where id = p_reporte for update;
  if not found then raise exception 'Reporte no encontrado.' using errcode = '22023'; end if;
  if auth.uid() is null or not public.puede_gestionar(r.proyecto_id) then
    raise exception 'No tienes permiso para enviar este reporte.' using errcode = '42501';
  end if;
  if r.enviado_en is not null then raise exception 'El reporte ya fue enviado.' using errcode = '22023'; end if;

  v_lunes := date_trunc('week', r.fecha_reporte)::date;
  select count(*)::integer into v_hitos from public.hitos
    where proyecto_id = r.proyecto_id and not cancelado and fecha_real between v_lunes and v_lunes + 6;
  select * into m from public.mediciones_evm
    where proyecto_id = r.proyecto_id and fecha_corte <= r.fecha_reporte order by fecha_corte desc limit 1;

  v_foto := jsonb_build_object('hitos_cumplidos_semana', v_hitos);
  if m.id is not null then
    v_foto := v_foto || jsonb_build_object(
      'fecha_corte', m.fecha_corte, 'bac', m.bac, 'pv', m.pv, 'ev', m.ev, 'ac', m.ac,
      'spi', case when m.pv > 0 then round(m.ev / m.pv, 4) end,
      'cpi', case when m.ac > 0 then round(m.ev / m.ac, 4) end,
      'avance_fisico', case when m.bac > 0 then round(m.ev * 100 / m.bac, 2) end,
      'avance_presupuestal', case when m.bac > 0 then round(m.ac * 100 / m.bac, 2) end);
  end if;
  update public.reportes_semanales set foto = v_foto, enviado_en = now() where id = p_reporte;
end;
$$;

revoke execute on function public.evaluacion_patrocinador_guardar(uuid, date, integer), public.reporte_crear(uuid, date),
  public.reporte_guardar(uuid, jsonb), public.reporte_enviar(uuid) from public, anon;
grant execute on function public.evaluacion_patrocinador_guardar(uuid, date, integer), public.reporte_crear(uuid, date),
  public.reporte_guardar(uuid, jsonb), public.reporte_enviar(uuid) to authenticated;

    $m0009$;
    insert into public.migraciones_aplicadas (nombre) values ('0009_reportes_kpis.sql') on conflict do nothing;
  end if;
end $mig$;

-- 0010_cronograma.sql
do $mig$ begin
  if not exists (select 1 from public.migraciones_aplicadas where nombre = '0010_cronograma.sql') then
    execute $m0010$
-- =============================================================================
-- Hito 6 (v2.0): Cronograma y avance; el valor ganado se calcula desde presupuesto y cronograma
-- =============================================================================

-- 1. TAREAS ------------------------------------------------------------------------------
-- semana_inicio es 1 para la primera semana del proyecto. Planificado a las k semanas transcurridas:
-- peso × mínimo(1, máximo(0, (k − (semana_inicio − 1)) / duración)).
create table public.tareas (
  id                    uuid primary key default gen_random_uuid(),
  proyecto_id           uuid not null references public.proyectos (id) on delete cascade,
  nombre                text not null check (length(btrim(nombre)) between 1 and 200),
  semana_inicio         integer not null check (semana_inicio between 1 and 1000),
  duracion_semanas      integer not null check (duracion_semanas between 1 and 1000),
  peso_pct              numeric(7, 4) not null check (peso_pct between 0 and 100),
  avance_pct            numeric(5, 2) not null default 0 check (avance_pct between 0 and 100),
  avance_verificado_pct numeric(5, 2) check (avance_verificado_pct between 0 and 100),
  nota_verificacion     text check (length(nota_verificacion) <= 500),
  verificado_por        uuid,
  fecha_verificacion    date,
  orden                 integer not null default 0,
  wbs_id                uuid references public.wbs_elementos (id) on delete set null,
  capitulo_id           uuid references public.capitulos (id) on delete set null,
  creado_en             timestamptz not null default now()
);
create index tareas_proyecto_idx on public.tareas (proyecto_id, orden, semana_inicio);
create trigger tareas_audit after insert or update or delete on public.tareas
  for each row execute function public.auditar_tabla();

alter table public.tareas enable row level security;
revoke all on public.tareas from anon, authenticated;
grant select, delete on public.tareas to authenticated;
-- El gerente edita la planificación; el avance verificado solo se escribe por la función de verificación.
grant insert (proyecto_id, nombre, semana_inicio, duracion_semanas, peso_pct, avance_pct, orden, wbs_id, capitulo_id) on public.tareas to authenticated;
grant update (nombre, semana_inicio, duracion_semanas, peso_pct, avance_pct, orden, wbs_id, capitulo_id) on public.tareas to authenticated;
create policy tareas_ver on public.tareas for select to authenticated using (public.puede_ver_proyecto(proyecto_id) or public.es_interventor(proyecto_id));
create policy tareas_crear on public.tareas for insert to authenticated with check (public.puede_gestionar(proyecto_id));
create policy tareas_editar on public.tareas for update to authenticated using (public.puede_gestionar(proyecto_id)) with check (public.puede_gestionar(proyecto_id));
create policy tareas_borrar on public.tareas for delete to authenticated using (public.puede_gestionar(proyecto_id));

-- Avance de una tarea: el supervisor de obra, el gerente o el administrador.
create function public.tarea_avance_guardar(p_tarea uuid, p_avance numeric)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_proy uuid;
begin
  select proyecto_id into v_proy from public.tareas where id = p_tarea;
  if v_proy is null then raise exception 'Tarea no encontrada.' using errcode = '22023'; end if;
  if auth.uid() is null or not (public.puede_gestionar(v_proy) or exists (
      select 1 from public.miembros_proyecto where proyecto_id = v_proy and usuario_id = auth.uid() and rol = 'supervisor')) then
    raise exception 'Solo el supervisor de obra, el gerente o el administrador actualizan el avance.' using errcode = '42501';
  end if;
  if p_avance is null or p_avance < 0 or p_avance > 100 then
    raise exception 'El avance debe estar entre 0 y 100.' using errcode = '22023';
  end if;
  update public.tareas set avance_pct = round(p_avance, 2) where id = p_tarea;
end;
$$;

-- Avance verificado por la interventoría (con una nota obligatoria).
create function public.tarea_verificar(p_tarea uuid, p_pct numeric, p_nota text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_proy uuid; v_nota text := nullif(btrim(coalesce(p_nota, '')), '');
begin
  select proyecto_id into v_proy from public.tareas where id = p_tarea;
  if v_proy is null then raise exception 'Tarea no encontrada.' using errcode = '22023'; end if;
  if auth.uid() is null or not public.es_interventor(v_proy) then
    raise exception 'Solo la interventoría registra el avance verificado.' using errcode = '42501';
  end if;
  if p_pct is null or p_pct < 0 or p_pct > 100 then
    raise exception 'El avance verificado debe estar entre 0 y 100.' using errcode = '22023';
  end if;
  if v_nota is null or length(v_nota) < 3 or length(v_nota) > 500 then
    raise exception 'Escribe la nota de verificación (3 a 500 caracteres).' using errcode = '22023';
  end if;
  update public.tareas set avance_verificado_pct = round(p_pct, 2), nota_verificacion = v_nota,
    verificado_por = auth.uid(), fecha_verificacion = current_date where id = p_tarea;
end;
$$;

-- 2. LÍNEA BASE DE COSTO INICIAL (aprobación del presupuesto) -------------------------------------
-- El BAC lo calcula la aplicación del presupuesto vigente; las versiones siguientes nacen de cambios aprobados.
create function public.linea_base_aprobar_presupuesto(p_proyecto uuid, p_bac numeric, p_nota text default null)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.puede_gestionar(p_proyecto) then
    raise exception 'No tienes permiso para aprobar el presupuesto de este proyecto.' using errcode = '42501';
  end if;
  if p_bac is null or p_bac <= 0 then
    raise exception 'El presupuesto debe ser mayor que cero para aprobarlo.' using errcode = '22023';
  end if;
  if exists (select 1 from public.lineas_base where proyecto_id = p_proyecto and tipo = 'costo') then
    raise exception 'El proyecto ya tiene línea base de costo; los ajustes se hacen con un cambio aprobado.' using errcode = '22023';
  end if;
  insert into public.lineas_base (proyecto_id, tipo, version, bac, aprobada_por, nota)
    values (p_proyecto, 'costo', 1, round(p_bac, 2), auth.uid(), coalesce(nullif(btrim(p_nota), ''), 'Presupuesto aprobado'));
exception when numeric_value_out_of_range then
  raise exception 'El presupuesto es demasiado grande.' using errcode = '22023';
end;
$$;

-- 3. VALOR GANADO CALCULADO ------------------------------------------------------------------------
-- PV, EV y AC salen del cronograma y del gasto; el BAC, de la línea base de costo vigente.
-- Solo guarda valores calculados aquí mismo (no recibe cifras de nadie), por eso puede llamarla quien vea el proyecto.
create function public.medicion_calcular(p_proyecto uuid, p_fecha date)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_inicio date; v_bac numeric; v_k numeric; v_pv numeric; v_ev numeric; v_ac numeric; v_pesos numeric;
  v_mes integer; v_usa boolean;
begin
  if auth.uid() is null or not (public.puede_ver_proyecto(p_proyecto) or public.es_interventor(p_proyecto)) then
    raise exception 'No tienes acceso a este proyecto.' using errcode = '42501';
  end if;
  select fecha_inicio into v_inicio from public.proyectos where id = p_proyecto and usa_obra;
  if v_inicio is null then return; end if;
  select bac into v_bac from public.lineas_base where proyecto_id = p_proyecto and tipo = 'costo' order by version desc limit 1;
  select coalesce(sum(peso_pct), 0) into v_pesos from public.tareas where proyecto_id = p_proyecto;
  if v_bac is null or v_bac <= 0 or v_pesos <= 0 then return; end if;   -- faltan línea base o cronograma: no hay nada que calcular

  v_usa := coalesce(public.parametro('ev_usa_avance_verificado', p_proyecto), 'si') = 'si';
  v_k := greatest(0, (p_fecha - v_inicio)::numeric / 7);
  select coalesce(sum(peso_pct * least(1, greatest(0, (v_k - (semana_inicio - 1)) / duracion_semanas))), 0) / 100 * v_bac,
         coalesce(sum(peso_pct * (case when v_usa then coalesce(avance_verificado_pct, avance_pct) else avance_pct end) / 100), 0) / 100 * v_bac
    into v_pv, v_ev from public.tareas where proyecto_id = p_proyecto;
  v_mes := (extract(year from p_fecha)::integer - extract(year from v_inicio)::integer) * 12
         + extract(month from p_fecha)::integer - extract(month from v_inicio)::integer + 1;
  select coalesce(sum(valor_real), 0) into v_ac from public.gasto_mensual where proyecto_id = p_proyecto and mes <= greatest(v_mes, 0);

  insert into public.mediciones_evm (proyecto_id, fecha_corte, bac, pv, ev, ac, origen, creado_por)
    values (p_proyecto, p_fecha, round(v_bac, 2), round(least(v_pv, v_bac), 2), round(least(v_ev, v_bac), 2), round(v_ac, 2), 'calculado', auth.uid())
  on conflict (proyecto_id, fecha_corte) do update
    set bac = excluded.bac, pv = excluded.pv, ev = excluded.ev, ac = excluded.ac, origen = 'calculado'
    where public.mediciones_evm.origen = 'calculado';   -- una medición manual de la misma fecha no se pisa
exception when numeric_value_out_of_range then
  return;
end;
$$;

revoke execute on function public.tarea_avance_guardar(uuid, numeric), public.tarea_verificar(uuid, numeric, text),
  public.linea_base_aprobar_presupuesto(uuid, numeric, text), public.medicion_calcular(uuid, date) from public, anon;
grant execute on function public.tarea_avance_guardar(uuid, numeric), public.tarea_verificar(uuid, numeric, text),
  public.linea_base_aprobar_presupuesto(uuid, numeric, text), public.medicion_calcular(uuid, date) to authenticated;

    $m0010$;
    insert into public.migraciones_aplicadas (nombre) values ('0010_cronograma.sql') on conflict do nothing;
  end if;
end $mig$;

-- 0011_contratos.sql
do $mig$ begin
  if not exists (select 1 from public.migraciones_aplicadas where nombre = '0011_contratos.sql') then
    execute $m0011$
-- =============================================================================
-- Hito 7 (v2.0): Contratos y pagos (anticipo autorizado, actas de pago, retención)
-- =============================================================================

insert into public.parametros (ambito, clave, valor, descripcion, fuente) values
 ('global', 'anticipo_admin_puede_autorizar', 'no',
  'Si es "si", el administrador también puede autorizar anticipos (útil solo en pruebas); por defecto solo el director general', 'Propuesta'),
 ('global', 'tipos_contrato', 'obra,interventoria,consultoria,suministro,otro', 'Tipos de contrato admitidos', 'Especificación, módulo M');

-- 1. CONTRATOS -------------------------------------------------------------------------------
create table public.contratos (
  id                    uuid primary key default gen_random_uuid(),
  proyecto_id           uuid not null references public.proyectos (id) on delete cascade,
  tipo                  text not null check (tipo in ('obra', 'interventoria', 'consultoria', 'suministro', 'otro')),
  contratista           text not null check (length(btrim(contratista)) between 1 and 200),
  objeto                text not null check (length(btrim(objeto)) between 1 and 1000),
  valor                 numeric(15, 2) not null check (valor > 0),
  anticipo_pct          numeric(5, 2) not null default 0 check (anticipo_pct between 0 and 100),
  anticipo_valor        numeric(15, 2) not null default 0 check (anticipo_valor >= 0),
  anticipo_autorizado_por uuid,
  anticipo_motivo       text check (length(anticipo_motivo) <= 500),
  anticipo_autorizado_en timestamptz,
  retencion_pct         numeric(5, 2) not null check (retencion_pct between 0 and 100),  -- vigente al crear el contrato
  retencion_liberada    boolean not null default false,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now()
);
create index contratos_proyecto_idx on public.contratos (proyecto_id);
create trigger contratos_actualizado before update on public.contratos
  for each row execute function public.marcar_actualizado();
create trigger contratos_audit after insert or update or delete on public.contratos
  for each row execute function public.auditar_tabla();

-- 2. ACTAS DE PAGO -----------------------------------------------------------------------------
-- Los valores se calculan al crear el acta y quedan fijos (la amortización depende del anticipo pendiente de ese momento).
create table public.actas_pago (
  id            uuid primary key default gen_random_uuid(),
  contrato_id   uuid not null references public.contratos (id) on delete cascade,
  proyecto_id   uuid not null references public.proyectos (id) on delete cascade,
  numero        integer not null check (numero >= 1),
  fecha         date not null,
  valor_bruto   numeric(15, 2) not null check (valor_bruto > 0),
  amortizacion  numeric(15, 2) not null check (amortizacion >= 0),
  retencion     numeric(15, 2) not null check (retencion >= 0),
  neto          numeric(15, 2) not null,
  estado        text not null default 'radicada'
    check (estado in ('radicada', 'en_revision_interventoria', 'con_observaciones', 'aprobada_pago')),
  creado_por    uuid default auth.uid(),
  creado_en     timestamptz not null default now(),
  unique (contrato_id, numero)
);
create index actas_pago_proyecto_idx on public.actas_pago (proyecto_id, estado);
create trigger actas_pago_audit after insert or update or delete on public.actas_pago
  for each row execute function public.auditar_tabla();

alter table public.contratos enable row level security;
alter table public.actas_pago enable row level security;
revoke all on public.contratos, public.actas_pago from anon, authenticated;
grant select on public.contratos, public.actas_pago to authenticated;
create policy contratos_ver on public.contratos for select to authenticated using (public.puede_ver_proyecto(proyecto_id));
create policy actas_pago_ver on public.actas_pago for select to authenticated using (public.puede_ver_proyecto(proyecto_id));

-- 3. FUNCIONES DE APOYO ---------------------------------------------------------------------------
-- Ahora el valor del contrato es real (antes no había contratos).
create or replace function public.valor_contrato(p_contrato uuid)
returns numeric language sql stable security definer set search_path = ''
as $$ select valor from public.contratos where id = p_contrato; $$;

alter table public.cambios add constraint cambios_contrato_fk
  foreign key (contrato_id) references public.contratos (id) on delete set null;

-- ¿Requiere concepto de interventoría el acta? (lo reemplaza el hito de interventoría)
create function public.acta_requiere_interventoria(p_acta uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select false; $$;
create function public.acta_concepto_favorable(p_acta uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select true; $$;
revoke execute on function public.acta_requiere_interventoria(uuid), public.acta_concepto_favorable(uuid) from public, anon, authenticated;

-- 4. CREAR Y ACTUALIZAR CONTRATOS -------------------------------------------------------------------------
create function public.contrato_crear(p_proyecto uuid, p_datos jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid; v_valor numeric(15,2);
begin
  if auth.uid() is null or not public.puede_gestionar(p_proyecto) then
    raise exception 'No tienes permiso para registrar contratos en este proyecto.' using errcode = '42501';
  end if;
  begin
    v_valor := nullif(btrim(coalesce(p_datos ->> 'valor', '')), '')::numeric;
  exception when others then
    raise exception 'El valor del contrato debe ser un número válido.' using errcode = '22023';
  end;
  if v_valor is null or v_valor <= 0 then raise exception 'El valor del contrato debe ser mayor que cero.' using errcode = '22023'; end if;
  insert into public.contratos (proyecto_id, tipo, contratista, objeto, valor, retencion_pct)
    values (p_proyecto,
      coalesce(p_datos ->> 'tipo', ''),
      public.cambio_leer_texto(p_datos, 'contratista', 200, true),
      public.cambio_leer_texto(p_datos, 'objeto', 1000, true),
      v_valor,
      coalesce(public.parametro('retencion_garantia_pct', p_proyecto)::numeric, 10))
    returning id into v_id;
  return v_id;
exception when check_violation then
  raise exception 'Tipo de contrato o valor no válido.' using errcode = '22023';
  when numeric_value_out_of_range then
  raise exception 'El valor del contrato es demasiado grande.' using errcode = '22023';
end;
$$;

create function public.contrato_actualizar(p_contrato uuid, p_datos jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare c public.contratos; v_valor numeric(15,2); v_pagado numeric;
begin
  select * into c from public.contratos where id = p_contrato for update;
  if not found then raise exception 'Contrato no encontrado.' using errcode = '22023'; end if;
  if auth.uid() is null or not public.puede_gestionar(c.proyecto_id) then
    raise exception 'No tienes permiso para editar este contrato.' using errcode = '42501';
  end if;
  begin
    v_valor := nullif(btrim(coalesce(p_datos ->> 'valor', '')), '')::numeric;
  exception when others then
    raise exception 'El valor del contrato debe ser un número válido.' using errcode = '22023';
  end;
  if v_valor is null or v_valor <= 0 then raise exception 'El valor del contrato debe ser mayor que cero.' using errcode = '22023'; end if;
  select coalesce(sum(valor_bruto), 0) into v_pagado from public.actas_pago where contrato_id = p_contrato;
  if v_valor < v_pagado then
    raise exception 'El valor del contrato no puede ser menor que lo ya facturado en actas (%).', v_pagado using errcode = '22023';
  end if;
  update public.contratos set
    tipo = coalesce(p_datos ->> 'tipo', tipo),
    contratista = public.cambio_leer_texto(p_datos, 'contratista', 200, true),
    objeto = public.cambio_leer_texto(p_datos, 'objeto', 1000, true),
    valor = v_valor
  where id = p_contrato;
exception when check_violation then
  raise exception 'Tipo de contrato o valor no válido.' using errcode = '22023';
  when numeric_value_out_of_range then
  raise exception 'El valor del contrato es demasiado grande.' using errcode = '22023';
end;
$$;

-- 5. ANTICIPO ---------------------------------------------------------------------------------------------
-- Discrecional: lo autoriza el director general según la urgencia o necesidad. Nunca supera el máximo.
-- Por debajo del umbral de referencia, lo normal es no darlo: se advierte pero se permite.
create function public.contrato_anticipo_autorizar(p_contrato uuid, p_pct numeric, p_motivo text)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  c public.contratos; v_max numeric; v_umbral numeric; v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_aviso text;
begin
  select * into c from public.contratos where id = p_contrato for update;
  if not found then raise exception 'Contrato no encontrado.' using errcode = '22023'; end if;
  if auth.uid() is null or not (public.es_director_general()
      or (public.es_admin() and public.parametro('anticipo_admin_puede_autorizar', c.proyecto_id) = 'si')) then
    raise exception 'Solo el director general de planificación y proyectos autoriza anticipos.' using errcode = '42501';
  end if;
  if exists (select 1 from public.actas_pago where contrato_id = p_contrato) then
    raise exception 'El contrato ya tiene actas de pago: el anticipo no se puede cambiar.' using errcode = '22023';
  end if;
  v_max := coalesce(public.parametro('anticipo_max_pct', c.proyecto_id)::numeric, 20);
  v_umbral := coalesce(public.parametro('anticipo_umbral_referencia_cop', c.proyecto_id)::numeric, 350000000);
  if p_pct is null or p_pct < 0 then raise exception 'El porcentaje de anticipo no puede ser negativo.' using errcode = '22023'; end if;
  if p_pct > v_max then
    raise exception 'El anticipo no puede superar el % %% del valor del contrato (máximo para todos los contratos).', v_max using errcode = '22023';
  end if;
  if p_pct > 0 and (v_motivo is null or length(v_motivo) < 3) then
    raise exception 'Escribe el motivo del anticipo (urgencia o necesidad del servicio o insumo).' using errcode = '22023';
  end if;
  if v_motivo is not null and length(v_motivo) > 500 then raise exception 'El motivo no puede superar 500 caracteres.' using errcode = '22023'; end if;

  update public.contratos set
    anticipo_pct = round(p_pct, 2),
    anticipo_valor = round(valor * p_pct / 100, 2),
    anticipo_autorizado_por = case when p_pct > 0 then auth.uid() end,
    anticipo_motivo = case when p_pct > 0 then v_motivo end,
    anticipo_autorizado_en = case when p_pct > 0 then now() end
  where id = p_contrato;
  if p_pct > 0 and c.valor < v_umbral then
    v_aviso := 'Atención: el contrato es menor a la referencia de ' || to_char(v_umbral, 'FM999G999G999G999') ||
               ' y lo normal es no dar anticipo. Quedó registrado quién lo autorizó y el motivo.';
  end if;
  return v_aviso;
end;
$$;

-- 6. ACTAS DE PAGO ---------------------------------------------------------------------------------------
-- amortización = mínimo(anticipo pendiente, bruto × anticipo %); retención = bruto × retención %;
-- neto = bruto − amortización − retención. La suma de las actas no puede superar el valor del contrato.
create function public.acta_pago_crear(p_contrato uuid, p_fecha date, p_bruto numeric)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  c public.contratos; v_facturado numeric; v_amortizado numeric; v_pendiente numeric;
  v_amort numeric; v_ret numeric; v_num integer; v_id uuid;
begin
  select * into c from public.contratos where id = p_contrato for update;
  if not found then raise exception 'Contrato no encontrado.' using errcode = '22023'; end if;
  if auth.uid() is null or not public.puede_gestionar(c.proyecto_id) then
    raise exception 'No tienes permiso para radicar actas de pago en este proyecto.' using errcode = '42501';
  end if;
  if p_fecha is null then raise exception 'Indica la fecha del acta.' using errcode = '22023'; end if;
  if p_bruto is null or p_bruto <= 0 then raise exception 'El valor bruto del acta debe ser mayor que cero.' using errcode = '22023'; end if;
  if c.retencion_liberada then raise exception 'La retención de este contrato ya fue liberada: no se radican más actas.' using errcode = '22023'; end if;

  select coalesce(sum(valor_bruto), 0), coalesce(sum(amortizacion), 0), coalesce(max(numero), 0) + 1
    into v_facturado, v_amortizado, v_num from public.actas_pago where contrato_id = p_contrato;
  if v_facturado + p_bruto > c.valor then
    raise exception 'La suma de las actas (%) superaría el valor del contrato (%).', v_facturado + p_bruto, c.valor using errcode = '22023';
  end if;
  v_pendiente := greatest(c.anticipo_valor - v_amortizado, 0);
  v_amort := round(least(v_pendiente, p_bruto * c.anticipo_pct / 100), 2);
  v_ret := round(p_bruto * c.retencion_pct / 100, 2);
  insert into public.actas_pago (contrato_id, proyecto_id, numero, fecha, valor_bruto, amortizacion, retencion, neto)
    values (p_contrato, c.proyecto_id, v_num, p_fecha, round(p_bruto, 2), v_amort, v_ret, round(p_bruto, 2) - v_amort - v_ret)
    returning id into v_id;
  return v_id;
exception when numeric_value_out_of_range then
  raise exception 'El valor del acta es demasiado grande.' using errcode = '22023';
end;
$$;

-- Estados: radicada → en revisión de interventoría → con observaciones / aprobada para pago.
-- Con interventoría asignada y parámetro activo, no se aprueba sin concepto favorable.
create function public.acta_pago_estado(p_acta uuid, p_estado text)
returns void language plpgsql security definer set search_path = ''
as $$
declare a public.actas_pago;
begin
  select * into a from public.actas_pago where id = p_acta for update;
  if not found then raise exception 'Acta no encontrada.' using errcode = '22023'; end if;
  if auth.uid() is null or not public.puede_gestionar(a.proyecto_id) then
    raise exception 'Solo el gerente o el administrador cambian el estado del acta.' using errcode = '42501';
  end if;
  if p_estado not in ('radicada', 'en_revision_interventoria', 'con_observaciones', 'aprobada_pago') then
    raise exception 'Estado no válido.' using errcode = '22023';
  end if;
  if a.estado = 'aprobada_pago' then
    raise exception 'El acta ya está aprobada para pago.' using errcode = '22023';
  end if;
  if p_estado = 'aprobada_pago'
     and public.acta_requiere_interventoria(p_acta)
     and coalesce(public.parametro('interventoria_vb_acta_obligatorio', a.proyecto_id), 'si') = 'si'
     and not public.acta_concepto_favorable(p_acta) then
    raise exception 'El acta no puede aprobarse para pago sin concepto favorable de la interventoría.' using errcode = '22023';
  end if;
  update public.actas_pago set estado = p_estado where id = p_acta;
end;
$$;

-- Solo se borra la última acta, si aún no está aprobada.
create function public.acta_pago_borrar(p_acta uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare a public.actas_pago;
begin
  select * into a from public.actas_pago where id = p_acta for update;
  if not found then return; end if;
  if auth.uid() is null or not public.puede_gestionar(a.proyecto_id) then
    raise exception 'No tienes permiso para borrar actas.' using errcode = '42501';
  end if;
  if a.estado = 'aprobada_pago' then raise exception 'Un acta aprobada para pago no se borra.' using errcode = '22023'; end if;
  if exists (select 1 from public.actas_pago where contrato_id = a.contrato_id and numero > a.numero) then
    raise exception 'Solo se puede borrar la última acta del contrato.' using errcode = '22023';
  end if;
  delete from public.actas_pago where id = p_acta;
end;
$$;

-- 7. RETENCIÓN ------------------------------------------------------------------------------------------------
create function public.contrato_retencion_liberar(p_contrato uuid, p_liberar boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare c public.contratos; v_fact numeric;
begin
  select * into c from public.contratos where id = p_contrato for update;
  if not found then raise exception 'Contrato no encontrado.' using errcode = '22023'; end if;
  if auth.uid() is null or not public.puede_gestionar(c.proyecto_id) then
    raise exception 'No tienes permiso para liberar o revertir la retención.' using errcode = '42501';
  end if;
  if p_liberar then
    select coalesce(sum(valor_bruto), 0) into v_fact from public.actas_pago where contrato_id = p_contrato;
    if v_fact < c.valor then
      raise exception 'La retención se libera solo al ejecutar el 100 %% del contrato (facturado %, de %).', v_fact, c.valor using errcode = '22023';
    end if;
  end if;
  update public.contratos set retencion_liberada = p_liberar where id = p_contrato;
end;
$$;

-- 8. OTROSÍ: un cambio aprobado ligado a un contrato ajusta su valor -----------------------------------------
create function public.cambio_aplicar_a_contrato()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare c public.contratos; v_nuevo numeric; v_fact numeric;
begin
  if new.estado_flujo = 'aprobado' and old.estado_flujo is distinct from 'aprobado' and new.contrato_id is not null and new.impacto_costo <> 0 then
    select * into c from public.contratos where id = new.contrato_id for update;
    if found then
      v_nuevo := c.valor + new.impacto_costo;
      select coalesce(sum(valor_bruto), 0) into v_fact from public.actas_pago where contrato_id = c.id;
      if v_nuevo <= 0 or v_nuevo < v_fact then
        raise exception 'El cambio dejaría el contrato en %, por debajo de lo ya facturado (%).', v_nuevo, v_fact using errcode = '22023';
      end if;
      update public.contratos set valor = v_nuevo where id = c.id;
    end if;
  end if;
  return null;
end;
$$;
revoke execute on function public.cambio_aplicar_a_contrato() from public, anon, authenticated;
create trigger cambios_a_contrato after update of estado_flujo on public.cambios
  for each row execute function public.cambio_aplicar_a_contrato();

revoke execute on function public.contrato_crear(uuid, jsonb), public.contrato_actualizar(uuid, jsonb),
  public.contrato_anticipo_autorizar(uuid, numeric, text), public.acta_pago_crear(uuid, date, numeric),
  public.acta_pago_estado(uuid, text), public.acta_pago_borrar(uuid), public.contrato_retencion_liberar(uuid, boolean) from public, anon;
grant execute on function public.contrato_crear(uuid, jsonb), public.contrato_actualizar(uuid, jsonb),
  public.contrato_anticipo_autorizar(uuid, numeric, text), public.acta_pago_crear(uuid, date, numeric),
  public.acta_pago_estado(uuid, text), public.acta_pago_borrar(uuid), public.contrato_retencion_liberar(uuid, boolean) to authenticated;

    $m0011$;
    insert into public.migraciones_aplicadas (nombre) values ('0011_contratos.sql') on conflict do nothing;
  end if;
end $mig$;

-- 0012_bitacora.sql
do $mig$ begin
  if not exists (select 1 from public.migraciones_aplicadas where nombre = '0012_bitacora.sql') then
    execute $m0012$
-- =============================================================================
-- Hito 8 (v2.0): Bitácora de obra móvil con fotos permanentes
-- =============================================================================

-- 1. TABLAS -----------------------------------------------------------------------------------
-- Las entradas de la bitácora no se editan ni se borran (registro permanente): se corrigen con una entrada o
-- comentario nuevo. Por eso el avance del día que suman a las tareas nunca se revierte (pendiente del prototipo, resuelto así).
create table public.bitacoras (
  id                       uuid primary key,
  proyecto_id              uuid not null references public.proyectos (id) on delete cascade,
  fecha                    date not null,
  supervisor_id            uuid not null default auth.uid(),
  es_interventoria         boolean not null default false,
  clima                    text not null check (clima in ('soleado', 'nublado', 'lluvia_leve', 'lluvia_fuerte', 'tormenta')),
  horas_perdidas_clima     numeric(4, 1) not null default 0 check (horas_perdidas_clima between 0 and 24),
  personal_propio          integer not null check (personal_propio between 0 and 100000),
  personal_subcontratistas integer not null default 0 check (personal_subcontratistas between 0 and 100000),
  retraso_causa            text check (retraso_causa in ('clima', 'material', 'personal', 'diseno', 'cliente', 'otra')),
  retraso_horas            numeric(4, 1) check (retraso_horas > 0 and retraso_horas <= 24),
  retraso_descripcion      text check (length(retraso_descripcion) <= 2000),
  incidente_tipo           text check (incidente_tipo in ('accidente', 'casi_accidente', 'condicion_insegura')),
  incidente_persona        text check (length(incidente_persona) <= 200),
  incidente_descripcion    text check (length(incidente_descripcion) <= 2000),
  materiales               text check (length(materiales) <= 2000),
  equipos                  text check (length(equipos) <= 2000),
  visitas                  text check (length(visitas) <= 2000),
  instrucciones            text check (length(instrucciones) <= 2000),
  observaciones            text check (length(observaciones) <= 2000),
  -- Horas perdidas = horas por clima + horas de retrasos cuya causa no sea el clima (para no contar dos veces).
  horas_perdidas_total     numeric(5, 1) generated always as
    (horas_perdidas_clima + case when retraso_causa is distinct from 'clima' then coalesce(retraso_horas, 0) else 0 end) stored,
  creado_en                timestamptz not null default now(),
  check ((retraso_causa is null) = (retraso_horas is null) and (retraso_causa is null) = (retraso_descripcion is null)),
  check ((incidente_tipo is null) = (incidente_persona is null) and (incidente_tipo is null) = (incidente_descripcion is null)),
  unique (proyecto_id, fecha, supervisor_id, es_interventoria)
);
create index bitacoras_proyecto_idx on public.bitacoras (proyecto_id, fecha desc);

create table public.bitacora_actividades (
  id             uuid primary key default gen_random_uuid(),
  bitacora_id    uuid not null references public.bitacoras (id) on delete cascade,
  proyecto_id    uuid not null,
  tarea_id       uuid references public.tareas (id) on delete set null,
  avance_dia_pct numeric(5, 2) not null default 0 check (avance_dia_pct between 0 and 100),
  descripcion    text not null check (length(btrim(descripcion)) between 1 and 2000)
);
create index bitacora_actividades_idx on public.bitacora_actividades (bitacora_id);

create table public.bitacora_fotos (
  id          uuid primary key default gen_random_uuid(),
  bitacora_id uuid not null references public.bitacoras (id) on delete cascade,
  proyecto_id uuid not null,
  ruta        text not null check (length(ruta) between 10 and 300),
  creado_en   timestamptz not null default now(),
  unique (ruta)
);
create index bitacora_fotos_idx on public.bitacora_fotos (bitacora_id);

create table public.bitacora_comentarios (
  id          uuid primary key default gen_random_uuid(),
  bitacora_id uuid not null references public.bitacoras (id) on delete cascade,
  proyecto_id uuid not null,
  autor_id    uuid not null default auth.uid(),
  tipo        text not null check (tipo in ('visto_bueno', 'comentario')),
  texto       text check (length(texto) <= 2000),
  fecha       timestamptz not null default now(),
  check (tipo = 'visto_bueno' or length(btrim(coalesce(texto, ''))) > 0)
);
create index bitacora_comentarios_idx on public.bitacora_comentarios (bitacora_id, fecha);

-- 2. PERMISOS --------------------------------------------------------------------------------------
create function public.puede_ver_bitacora(p_proyecto uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select public.puede_ver_proyecto(p_proyecto) or public.es_interventor(p_proyecto); $$;

create function public.puede_registrar_bitacora(p_proyecto uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.puede_gestionar(p_proyecto) or exists (
    select 1 from public.miembros_proyecto
    where proyecto_id = p_proyecto and usuario_id = auth.uid() and rol in ('supervisor', 'interventoria'));
$$;
revoke execute on function public.puede_ver_bitacora(uuid), public.puede_registrar_bitacora(uuid) from public, anon;
grant execute on function public.puede_ver_bitacora(uuid), public.puede_registrar_bitacora(uuid) to authenticated;

alter table public.bitacoras enable row level security;
alter table public.bitacora_actividades enable row level security;
alter table public.bitacora_fotos enable row level security;
alter table public.bitacora_comentarios enable row level security;
revoke all on public.bitacoras, public.bitacora_actividades, public.bitacora_fotos, public.bitacora_comentarios from anon, authenticated;
grant select on public.bitacoras, public.bitacora_actividades, public.bitacora_fotos, public.bitacora_comentarios to authenticated;
create policy bitacoras_ver on public.bitacoras for select to authenticated using (public.puede_ver_bitacora(proyecto_id));
create policy bitacora_actividades_ver on public.bitacora_actividades for select to authenticated using (public.puede_ver_bitacora(proyecto_id));
create policy bitacora_fotos_ver on public.bitacora_fotos for select to authenticated using (public.puede_ver_bitacora(proyecto_id));
create policy bitacora_comentarios_ver on public.bitacora_comentarios for select to authenticated using (public.puede_ver_bitacora(proyecto_id));

-- 3. ARCHIVOS (Storage) -----------------------------------------------------------------------------
-- Bucket privado. Ruta: <proyecto>/<bitácora>/<archivo>. Solo se ve o se sube a proyectos con acceso.
insert into storage.buckets (id, name, public) values ('bitacora', 'bitacora', false) on conflict (id) do nothing;

create function public.proyecto_de_ruta(p_ruta text)
returns uuid language plpgsql immutable set search_path = ''
as $$
begin
  return split_part(p_ruta, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;
revoke execute on function public.proyecto_de_ruta(text) from public, anon;
grant execute on function public.proyecto_de_ruta(text) to authenticated;

create policy bitacora_objetos_leer on storage.objects for select to authenticated
  using (bucket_id = 'bitacora' and public.puede_ver_bitacora(public.proyecto_de_ruta(name)));
create policy bitacora_objetos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'bitacora' and public.puede_registrar_bitacora(public.proyecto_de_ruta(name)));

-- 4. REGISTRAR UNA ENTRADA ------------------------------------------------------------------------------------
create function public.bitacora_crear(p_id uuid, p_proyecto uuid, p_datos jsonb, p_actividades jsonb, p_fotos jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_inter boolean; v_fecha date; a jsonb; v_tarea uuid; v_av numeric; v_desc text; v_n integer; r text;
  v_rc text := nullif(btrim(coalesce(p_datos ->> 'retraso_causa', '')), '');
  v_it text := nullif(btrim(coalesce(p_datos ->> 'incidente_tipo', '')), '');
  v_rh numeric(4,1); v_hc numeric(4,1);
begin
  if auth.uid() is null or not public.puede_registrar_bitacora(p_proyecto) then
    raise exception 'No tienes permiso para registrar la bitácora de este proyecto.' using errcode = '42501';
  end if;
  v_inter := public.es_interventor(p_proyecto) and not public.puede_gestionar(p_proyecto)
             and not exists (select 1 from public.miembros_proyecto where proyecto_id = p_proyecto and usuario_id = auth.uid() and rol = 'supervisor');
  begin
    v_fecha := (p_datos ->> 'fecha')::date;
    v_hc := coalesce(nullif(btrim(coalesce(p_datos ->> 'horas_perdidas_clima', '')), '')::numeric, 0);
    v_rh := nullif(btrim(coalesce(p_datos ->> 'retraso_horas', '')), '')::numeric;
  exception when others then
    raise exception 'La fecha y las horas deben ser valores válidos.' using errcode = '22023';
  end;
  if v_fecha is null then raise exception 'Indica la fecha de la bitácora.' using errcode = '22023'; end if;
  if v_fecha > current_date then raise exception 'La fecha de la bitácora no puede ser futura.' using errcode = '22023'; end if;
  if jsonb_typeof(p_actividades) is distinct from 'array' or jsonb_array_length(p_actividades) = 0 then
    raise exception 'Registra al menos una actividad del día.' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_fotos, '[]'::jsonb)) > 5 then
    raise exception 'Máximo 5 fotos por entrada.' using errcode = '22023';
  end if;
  if (v_rc is null) <> (v_rh is null) or (v_rc is null) <> (nullif(btrim(coalesce(p_datos ->> 'retraso_descripcion', '')), '') is null) then
    raise exception 'Si hubo retraso, indica la causa, las horas y la descripción.' using errcode = '22023';
  end if;
  if (v_it is null) <> (nullif(btrim(coalesce(p_datos ->> 'incidente_persona', '')), '') is null)
     or (v_it is null) <> (nullif(btrim(coalesce(p_datos ->> 'incidente_descripcion', '')), '') is null) then
    raise exception 'Si hubo un incidente, indica el tipo, la persona y la descripción.' using errcode = '22023';
  end if;

  insert into public.bitacoras (id, proyecto_id, fecha, es_interventoria, clima, horas_perdidas_clima, personal_propio,
      personal_subcontratistas, retraso_causa, retraso_horas, retraso_descripcion, incidente_tipo, incidente_persona,
      incidente_descripcion, materiales, equipos, visitas, instrucciones, observaciones)
    values (p_id, p_proyecto, v_fecha, v_inter, coalesce(p_datos ->> 'clima', ''), v_hc,
      coalesce(nullif(btrim(coalesce(p_datos ->> 'personal_propio', '')), '')::integer, -1),
      coalesce(nullif(btrim(coalesce(p_datos ->> 'personal_subcontratistas', '')), '')::integer, 0),
      v_rc, v_rh, public.cambio_leer_texto(p_datos, 'retraso_descripcion', 2000, false),
      v_it, public.cambio_leer_texto(p_datos, 'incidente_persona', 200, false), public.cambio_leer_texto(p_datos, 'incidente_descripcion', 2000, false),
      public.cambio_leer_texto(p_datos, 'materiales', 2000, false), public.cambio_leer_texto(p_datos, 'equipos', 2000, false),
      public.cambio_leer_texto(p_datos, 'visitas', 2000, false), public.cambio_leer_texto(p_datos, 'instrucciones', 2000, false),
      public.cambio_leer_texto(p_datos, 'observaciones', 2000, false));

  for a in select * from jsonb_array_elements(p_actividades) loop
    v_tarea := nullif(a ->> 'tarea_id', '')::uuid;
    v_desc := public.cambio_leer_texto(a, 'descripcion', 2000, true);
    v_av := coalesce(nullif(btrim(coalesce(a ->> 'avance_dia_pct', '')), '')::numeric, 0);
    if v_av < 0 or v_av > 100 then raise exception 'El avance del día debe estar entre 0 y 100.' using errcode = '22023'; end if;
    if v_tarea is not null and not exists (select 1 from public.tareas where id = v_tarea and proyecto_id = p_proyecto) then
      raise exception 'Una tarea no pertenece a este proyecto.' using errcode = '22023';
    end if;
    insert into public.bitacora_actividades (bitacora_id, proyecto_id, tarea_id, avance_dia_pct, descripcion)
      values (p_id, p_proyecto, v_tarea, round(v_av, 2), v_desc);
    -- El avance del día se suma al de la tarea, con tope de 100 %. Las entradas de interventoría no mueven el avance.
    if v_tarea is not null and not v_inter and v_av > 0 then
      update public.tareas set avance_pct = least(100, avance_pct + round(v_av, 2)) where id = v_tarea;
    end if;
  end loop;

  v_n := 0;
  for r in select jsonb_array_elements_text(coalesce(p_fotos, '[]'::jsonb)) loop
    if left(r, length(p_proyecto::text || '/' || p_id::text || '/')) <> p_proyecto::text || '/' || p_id::text || '/' then
      raise exception 'Una foto no corresponde a esta entrada.' using errcode = '22023';
    end if;
    insert into public.bitacora_fotos (bitacora_id, proyecto_id, ruta) values (p_id, p_proyecto, r);
    v_n := v_n + 1;
  end loop;
  return p_id;
exception when check_violation then
  raise exception 'Algún dato de la bitácora no es válido (clima, personal u horas).' using errcode = '22023';
  when unique_violation then
  raise exception 'Ya registraste la bitácora de esa fecha. Agrega un comentario o corrígela con tu supervisor.' using errcode = '22023';
end;
$$;

-- 5. COMENTARIOS Y VISTO BUENO ---------------------------------------------------------------------------------------
-- La interventoría da visto bueno o deja comentarios fechados; el gerente también puede comentar.
create function public.bitacora_comentar(p_bitacora uuid, p_tipo text, p_texto text)
returns void language plpgsql security definer set search_path = ''
as $$
declare b public.bitacoras; v_texto text := nullif(btrim(coalesce(p_texto, '')), '');
begin
  select * into b from public.bitacoras where id = p_bitacora;
  if not found then raise exception 'Entrada no encontrada.' using errcode = '22023'; end if;
  if p_tipo not in ('visto_bueno', 'comentario') then raise exception 'Tipo no válido.' using errcode = '22023'; end if;
  if auth.uid() is null or not (public.es_interventor(b.proyecto_id) or (p_tipo = 'comentario' and public.puede_gestionar(b.proyecto_id))) then
    raise exception 'No tienes permiso para comentar esta entrada.' using errcode = '42501';
  end if;
  if p_tipo = 'comentario' and v_texto is null then raise exception 'Escribe el comentario.' using errcode = '22023'; end if;
  if v_texto is not null and length(v_texto) > 2000 then raise exception 'El comentario no puede superar 2000 caracteres.' using errcode = '22023'; end if;
  insert into public.bitacora_comentarios (bitacora_id, proyecto_id, tipo, texto) values (p_bitacora, b.proyecto_id, p_tipo, v_texto);
end;
$$;
revoke execute on function public.bitacora_crear(uuid, uuid, jsonb, jsonb, jsonb), public.bitacora_comentar(uuid, text, text) from public, anon;
grant execute on function public.bitacora_crear(uuid, uuid, jsonb, jsonb, jsonb), public.bitacora_comentar(uuid, text, text) to authenticated;

    $m0012$;
    insert into public.migraciones_aplicadas (nombre) values ('0012_bitacora.sql') on conflict do nothing;
  end if;
end $mig$;

-- 0013_documentos_cierre.sql
do $mig$ begin
  if not exists (select 1 from public.migraciones_aplicadas where nombre = '0013_documentos_cierre.sql') then
    execute $m0013$
-- =============================================================================
-- Hito 9 (v2.0): Documentos con versiones, cierre del proyecto y lecciones aprendidas
-- =============================================================================

-- 1. DOCUMENTOS ----------------------------------------------------------------------------------
-- Un documento tiene versiones; cada versión es un archivo y no se edita ni se borra.
create table public.documentos (
  id                   uuid primary key,
  proyecto_id          uuid not null references public.proyectos (id) on delete cascade,
  tipo                 text not null check (tipo in ('plano', 'contrato', 'acta', 'informe', 'otro')),
  nombre               text not null check (length(btrim(nombre)) between 1 and 200),
  entidad_tipo         text check (entidad_tipo in ('contrato', 'cambio', 'tarea')),
  entidad_id           uuid,
  visible_interventoria boolean not null default false,
  creado_por           uuid default auth.uid(),
  creado_en            timestamptz not null default now(),
  check ((entidad_tipo is null) = (entidad_id is null))
);
create index documentos_proyecto_idx on public.documentos (proyecto_id, tipo);

create table public.documento_versiones (
  id             uuid primary key default gen_random_uuid(),
  documento_id   uuid not null references public.documentos (id) on delete cascade,
  proyecto_id    uuid not null,
  version        integer not null check (version >= 1),
  ruta           text not null unique check (length(ruta) between 10 and 400),
  nombre_archivo text not null check (length(nombre_archivo) between 1 and 200),
  tamano_bytes   bigint not null check (tamano_bytes > 0 and tamano_bytes <= 52428800),
  tipo_mime      text check (length(tipo_mime) <= 100),
  nota           text check (length(nota) <= 500),
  subido_por     uuid default auth.uid(),
  fecha          timestamptz not null default now(),
  unique (documento_id, version)
);
create index documento_versiones_idx on public.documento_versiones (documento_id, version desc);
create trigger documentos_audit after insert or update or delete on public.documentos
  for each row execute function public.auditar_tabla();

create function public.puede_subir_documento(p_proyecto uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select public.puede_reportar(p_proyecto) or public.es_interventor(p_proyecto); $$;

-- La interventoría ve solo los documentos que el gerente le abre o que ella misma sube.
create function public.puede_ver_documento(p_proyecto uuid, p_visible boolean)
returns boolean language sql stable security definer set search_path = ''
as $$ select public.puede_ver_proyecto(p_proyecto) or (p_visible and public.es_interventor(p_proyecto)); $$;
revoke execute on function public.puede_subir_documento(uuid), public.puede_ver_documento(uuid, boolean) from public, anon;
grant execute on function public.puede_subir_documento(uuid), public.puede_ver_documento(uuid, boolean) to authenticated;

alter table public.documentos enable row level security;
alter table public.documento_versiones enable row level security;
revoke all on public.documentos, public.documento_versiones from anon, authenticated;
grant select on public.documentos, public.documento_versiones to authenticated;
create policy documentos_ver on public.documentos for select to authenticated
  using (public.puede_ver_documento(proyecto_id, visible_interventoria));
create policy documento_versiones_ver on public.documento_versiones for select to authenticated
  using (exists (select 1 from public.documentos d where d.id = documento_id and public.puede_ver_documento(d.proyecto_id, d.visible_interventoria)));

-- 2. ARCHIVOS (Storage) -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('documentos', 'documentos', false) on conflict (id) do nothing;

create function public.puede_ver_ruta_documento(p_ruta text)
returns boolean language plpgsql stable security definer set search_path = ''
as $$
declare v_proy uuid := public.proyecto_de_ruta(p_ruta);
begin
  if v_proy is null then return false; end if;
  if public.puede_ver_proyecto(v_proy) then return true; end if;
  return public.es_interventor(v_proy) and exists (
    select 1 from public.documento_versiones v join public.documentos d on d.id = v.documento_id
    where v.ruta = p_ruta and d.visible_interventoria);
end;
$$;
revoke execute on function public.puede_ver_ruta_documento(text) from public, anon;
grant execute on function public.puede_ver_ruta_documento(text) to authenticated;

create policy documentos_objetos_leer on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and public.puede_ver_ruta_documento(name));
create policy documentos_objetos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and public.puede_subir_documento(public.proyecto_de_ruta(name)));

-- 3. SUBIR Y VERSIONAR ---------------------------------------------------------------------------------
create function public.documento_crear(
  p_id uuid, p_proyecto uuid, p_tipo text, p_nombre text, p_entidad_tipo text, p_entidad_id uuid,
  p_ruta text, p_nombre_archivo text, p_tamano bigint, p_mime text, p_nota text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_inter boolean;
begin
  if auth.uid() is null or not public.puede_subir_documento(p_proyecto) then
    raise exception 'No tienes permiso para subir documentos a este proyecto.' using errcode = '42501';
  end if;
  v_inter := public.es_interventor(p_proyecto) and not public.puede_reportar(p_proyecto);
  if v_inter and p_tipo <> 'informe' then
    raise exception 'La interventoría sube informes y revisiones (tipo informe).' using errcode = '42501';
  end if;
  if left(coalesce(p_ruta, ''), length(p_proyecto::text || '/' || p_id::text || '/')) <> p_proyecto::text || '/' || p_id::text || '/' then
    raise exception 'El archivo no corresponde a este documento.' using errcode = '22023';
  end if;
  insert into public.documentos (id, proyecto_id, tipo, nombre, entidad_tipo, entidad_id, visible_interventoria)
    values (p_id, p_proyecto, p_tipo, btrim(coalesce(p_nombre, '')), nullif(p_entidad_tipo, ''), p_entidad_id, v_inter);
  insert into public.documento_versiones (documento_id, proyecto_id, version, ruta, nombre_archivo, tamano_bytes, tipo_mime, nota)
    values (p_id, p_proyecto, 1, p_ruta, p_nombre_archivo, p_tamano, p_mime, nullif(btrim(coalesce(p_nota, '')), ''));
  return p_id;
exception when check_violation then
  raise exception 'Algún dato del documento no es válido (tipo, nombre o tamaño máximo de 50 MB).' using errcode = '22023';
  when unique_violation then
  raise exception 'Ese documento o archivo ya está registrado.' using errcode = '22023';
end;
$$;

create function public.documento_nueva_version(p_documento uuid, p_ruta text, p_nombre_archivo text, p_tamano bigint, p_mime text, p_nota text)
returns integer language plpgsql security definer set search_path = ''
as $$
declare d public.documentos; v_ver integer; v_inter boolean;
begin
  select * into d from public.documentos where id = p_documento for update;
  if not found or auth.uid() is null or not public.puede_ver_documento(d.proyecto_id, d.visible_interventoria) then
    raise exception 'Documento no encontrado.' using errcode = '22023';
  end if;
  if not public.puede_subir_documento(d.proyecto_id) then
    raise exception 'No tienes permiso para versionar documentos de este proyecto.' using errcode = '42501';
  end if;
  v_inter := public.es_interventor(d.proyecto_id) and not public.puede_reportar(d.proyecto_id);
  if v_inter and d.tipo <> 'informe' then
    raise exception 'La interventoría solo versiona informes y revisiones.' using errcode = '42501';
  end if;
  if left(coalesce(p_ruta, ''), length(d.proyecto_id::text || '/' || d.id::text || '/')) <> d.proyecto_id::text || '/' || d.id::text || '/' then
    raise exception 'El archivo no corresponde a este documento.' using errcode = '22023';
  end if;
  select coalesce(max(version), 0) + 1 into v_ver from public.documento_versiones where documento_id = p_documento;
  insert into public.documento_versiones (documento_id, proyecto_id, version, ruta, nombre_archivo, tamano_bytes, tipo_mime, nota)
    values (p_documento, d.proyecto_id, v_ver, p_ruta, p_nombre_archivo, p_tamano, p_mime, nullif(btrim(coalesce(p_nota, '')), ''));
  return v_ver;
exception when check_violation then
  raise exception 'Algún dato del archivo no es válido (tamaño máximo de 50 MB).' using errcode = '22023';
  when unique_violation then
  raise exception 'Ese archivo ya está registrado.' using errcode = '22023';
end;
$$;

create function public.documento_visibilidad(p_documento uuid, p_visible boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_proy uuid;
begin
  select proyecto_id into v_proy from public.documentos where id = p_documento;
  if v_proy is null then raise exception 'Documento no encontrado.' using errcode = '22023'; end if;
  if auth.uid() is null or not public.puede_gestionar(v_proy) then
    raise exception 'Solo el gerente o el administrador deciden qué ve la interventoría.' using errcode = '42501';
  end if;
  update public.documentos set visible_interventoria = coalesce(p_visible, false) where id = p_documento;
end;
$$;

-- 4. CIERRE Y LECCIONES APRENDIDAS --------------------------------------------------------------------------
create table public.cierres (
  proyecto_id    uuid primary key references public.proyectos (id) on delete cascade,
  fecha_entrega  date not null,
  receptor       text not null check (length(btrim(receptor)) between 1 and 200),
  observaciones  text check (length(observaciones) <= 4000),
  cerrado_por    uuid default auth.uid(),
  cerrado_en     timestamptz not null default now()
);
create trigger cierres_audit after insert or update or delete on public.cierres
  for each row execute function public.auditar_tabla();

create table public.lecciones_aprendidas (
  id             uuid primary key default gen_random_uuid(),
  proyecto_id    uuid not null references public.proyectos (id) on delete cascade,
  cambio_id      uuid references public.cambios (id) on delete set null,
  categoria      text not null check (length(btrim(categoria)) between 1 and 100),
  descripcion    text not null check (length(btrim(descripcion)) between 1 and 4000),
  recomendacion  text check (length(recomendacion) <= 4000),
  creado_en      timestamptz not null default now()
);
create index lecciones_proyecto_idx on public.lecciones_aprendidas (proyecto_id);

insert into public.parametros (ambito, clave, valor, descripcion, fuente) values
 ('global', 'categorias_leccion', 'Técnica,Gestión,Contratación,Seguridad y salud,Calidad,Comunicación,Otra', 'Categorías de lecciones aprendidas', 'Propuesta');

alter table public.cierres enable row level security;
alter table public.lecciones_aprendidas enable row level security;
revoke all on public.cierres, public.lecciones_aprendidas from anon, authenticated;
grant select on public.cierres to authenticated;
grant select, insert, update, delete on public.lecciones_aprendidas to authenticated;
create policy cierres_ver on public.cierres for select to authenticated using (public.puede_ver_proyecto(proyecto_id));
create policy lecciones_ver on public.lecciones_aprendidas for select to authenticated using (public.puede_ver_proyecto(proyecto_id));
create policy lecciones_crear on public.lecciones_aprendidas for insert to authenticated with check (public.puede_gestionar(proyecto_id));
create policy lecciones_editar on public.lecciones_aprendidas for update to authenticated using (public.puede_gestionar(proyecto_id)) with check (public.puede_gestionar(proyecto_id));
create policy lecciones_borrar on public.lecciones_aprendidas for delete to authenticated using (public.puede_gestionar(proyecto_id));

-- Cerrar el proyecto: acta de entrega y cierre. No se puede con cambios pendientes de decisión o implementación.
create function public.proyecto_cerrar(p_proyecto uuid, p_fecha date, p_receptor text, p_observaciones text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_pend integer; v_estado text;
begin
  if auth.uid() is null or not public.puede_gestionar(p_proyecto) then
    raise exception 'No tienes permiso para cerrar este proyecto.' using errcode = '42501';
  end if;
  select estado into v_estado from public.proyectos where id = p_proyecto;
  if v_estado is null then raise exception 'Proyecto no encontrado.' using errcode = '22023'; end if;
  if v_estado = 'cerrado' then raise exception 'El proyecto ya está cerrado.' using errcode = '22023'; end if;
  if p_fecha is null then raise exception 'Indica la fecha de entrega.' using errcode = '22023'; end if;
  if nullif(btrim(coalesce(p_receptor, '')), '') is null then raise exception 'Indica quién recibe el proyecto.' using errcode = '22023'; end if;
  select count(*)::integer into v_pend from public.cambios where proyecto_id = p_proyecto and estado_flujo not in ('cerrado', 'rechazado');
  if v_pend > 0 then
    raise exception 'No se puede cerrar: hay % cambio(s) sin cerrar ni rechazar.', v_pend using errcode = '22023';
  end if;
  insert into public.cierres (proyecto_id, fecha_entrega, receptor, observaciones)
    values (p_proyecto, p_fecha, btrim(p_receptor), nullif(btrim(coalesce(p_observaciones, '')), ''))
  on conflict (proyecto_id) do update set fecha_entrega = excluded.fecha_entrega, receptor = excluded.receptor,
    observaciones = excluded.observaciones, cerrado_por = auth.uid(), cerrado_en = now();
  update public.proyectos set estado = 'cerrado', fase = 'cierre' where id = p_proyecto;
exception when check_violation then
  raise exception 'Algún dato del cierre no es válido.' using errcode = '22023';
end;
$$;

-- Reabrir: solo el administrador (queda en la auditoría).
create function public.proyecto_reabrir(p_proyecto uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.es_admin() then
    raise exception 'Solo el administrador puede reabrir un proyecto cerrado.' using errcode = '42501';
  end if;
  update public.proyectos set estado = 'activo', fase = 'ejecucion' where id = p_proyecto and estado = 'cerrado';
end;
$$;

revoke execute on function public.documento_crear(uuid, uuid, text, text, text, uuid, text, text, bigint, text, text),
  public.documento_nueva_version(uuid, text, text, bigint, text, text), public.documento_visibilidad(uuid, boolean),
  public.proyecto_cerrar(uuid, date, text, text), public.proyecto_reabrir(uuid) from public, anon;
grant execute on function public.documento_crear(uuid, uuid, text, text, text, uuid, text, text, bigint, text, text),
  public.documento_nueva_version(uuid, text, text, bigint, text, text), public.documento_visibilidad(uuid, boolean),
  public.proyecto_cerrar(uuid, date, text, text), public.proyecto_reabrir(uuid) to authenticated;

    $m0013$;
    insert into public.migraciones_aplicadas (nombre) values ('0013_documentos_cierre.sql') on conflict do nothing;
  end if;
end $mig$;

-- 0014_interventoria.sql
do $mig$ begin
  if not exists (select 1 from public.migraciones_aplicadas where nombre = '0014_interventoria.sql') then
    execute $m0014$
-- =============================================================================
-- Hito 11 (v2.0): Interventoría (módulo N)
-- La interventoría conceptúa, verifica, observa e informa; no aprueba ni modifica datos del contrato.
-- =============================================================================

-- 0. UTILIDADES: hora de Colombia, Pascua y festivos -----------------------------------------------------
create function public.hoy_co() returns date language sql stable set search_path = ''
as $$ select (now() at time zone 'America/Bogota')::date; $$;

-- Domingo de Pascua (algoritmo de Meeus/Jones/Butcher).
create function public.pascua(p_anio integer) returns date language plpgsql immutable set search_path = ''
as $$
declare
  a integer := p_anio % 19; b integer := p_anio / 100; c integer := p_anio % 100; d integer := b / 4; e integer := b % 4;
  f integer := (b + 8) / 25; g integer := (b - f + 1) / 3; h integer := (19 * a + b - d - g + 15) % 30;
  i integer := c / 4; k integer := c % 4; l integer := (32 + 2 * e + 2 * i - h - k) % 7; m integer := (a + 11 * h + 22 * l) / 451;
begin
  return make_date(p_anio, (h + l - 7 * m + 114) / 31, ((h + l - 7 * m + 114) % 31) + 1);
end;
$$;

-- Si el día no es lunes, pasa al lunes siguiente (Ley 51 de 1983, "ley Emiliani").
create function public.al_lunes(p_fecha date) returns date language sql immutable set search_path = ''
as $$ select p_fecha + case when extract(isodow from p_fecha)::integer = 1 then 0 else 8 - extract(isodow from p_fecha)::integer end; $$;

create table public.festivos (
  fecha  date primary key,
  nombre text not null check (length(btrim(nombre)) between 1 and 100)
);

-- Festivos de Colombia calculados con la regla de la ley (fijos, trasladados al lunes y los de Semana Santa).
-- Conviene confirmarlos cada año con el calendario oficial; el administrador puede agregar o quitar fechas.
create function public.festivos_colombia(p_anio integer)
returns table (fecha date, nombre text) language plpgsql immutable set search_path = ''
as $$
declare p date := public.pascua(p_anio);
begin
  return query values
    (make_date(p_anio, 1, 1), 'Año Nuevo'),
    (public.al_lunes(make_date(p_anio, 1, 6)), 'Reyes Magos'),
    (public.al_lunes(make_date(p_anio, 3, 19)), 'San José'),
    (p - 3, 'Jueves Santo'),
    (p - 2, 'Viernes Santo'),
    (make_date(p_anio, 5, 1), 'Día del Trabajo'),
    (p + 43, 'Ascensión del Señor'),
    (p + 64, 'Corpus Christi'),
    (p + 71, 'Sagrado Corazón'),
    (public.al_lunes(make_date(p_anio, 6, 29)), 'San Pedro y San Pablo'),
    (make_date(p_anio, 7, 20), 'Día de la Independencia'),
    (make_date(p_anio, 8, 7), 'Batalla de Boyacá'),
    (public.al_lunes(make_date(p_anio, 8, 15)), 'Asunción de la Virgen'),
    (public.al_lunes(make_date(p_anio, 10, 12)), 'Día de la Raza'),
    (public.al_lunes(make_date(p_anio, 11, 1)), 'Todos los Santos'),
    (public.al_lunes(make_date(p_anio, 11, 11)), 'Independencia de Cartagena'),
    (make_date(p_anio, 12, 8), 'Inmaculada Concepción'),
    (make_date(p_anio, 12, 25), 'Navidad');
end;
$$;

insert into public.festivos (fecha, nombre)
select f.fecha, f.nombre from generate_series(2026, 2040) as anio, lateral public.festivos_colombia(anio) f
on conflict (fecha) do nothing;

alter table public.festivos enable row level security;
revoke all on public.festivos from anon, authenticated;
grant select on public.festivos to authenticated;
create policy festivos_ver on public.festivos for select to authenticated using (true);
create trigger festivos_audit after insert or update or delete on public.festivos
  for each row execute function public.auditar_tabla();

create function public.festivo_guardar(p_fecha date, p_nombre text, p_quitar boolean default false)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.es_admin() then
    raise exception 'Solo el administrador cambia el calendario de festivos.' using errcode = '42501';
  end if;
  if p_quitar then delete from public.festivos where fecha = p_fecha; return; end if;
  if p_fecha is null or nullif(btrim(coalesce(p_nombre, '')), '') is null then
    raise exception 'Indica la fecha y el nombre del festivo.' using errcode = '22023';
  end if;
  insert into public.festivos (fecha, nombre) values (p_fecha, btrim(p_nombre))
    on conflict (fecha) do update set nombre = excluded.nombre;
exception when check_violation then
  raise exception 'El nombre del festivo es demasiado largo.' using errcode = '22023';
end;
$$;

-- Suma días hábiles (lunes a viernes que no sean festivo).
create function public.dias_habiles_sumar(p_fecha date, p_n integer)
returns date language plpgsql stable security definer set search_path = ''
as $$
declare f date := p_fecha; n integer := 0;
begin
  while n < p_n loop
    f := f + 1;
    if extract(isodow from f)::integer < 6 and not exists (select 1 from public.festivos where fecha = f) then n := n + 1; end if;
  end loop;
  return f;
end;
$$;
revoke execute on function public.dias_habiles_sumar(date, integer) from public, anon;
grant execute on function public.dias_habiles_sumar(date, integer) to authenticated;

-- 1. ASIGNACIÓN ------------------------------------------------------------------------------------------
create table public.interventoria_alcances (
  id                        uuid primary key default gen_random_uuid(),
  proyecto_id               uuid not null references public.proyectos (id) on delete cascade,
  contrato_interventoria_id uuid references public.contratos (id) on delete set null,
  contrato_vigilado_id      uuid references public.contratos (id) on delete cascade,  -- vacío: diseños y asesoría antes de la obra
  alcances                  text[] not null check (cardinality(alcances) > 0
    and alcances <@ array['tecnica','administrativa','financiera','juridica','contable','disenos','asesoria']),
  fecha_inicio              date,
  fecha_fin                 date,
  creado_en                 timestamptz not null default now(),
  check (fecha_fin is null or fecha_inicio is null or fecha_fin >= fecha_inicio)
);
create index interventoria_alcances_idx on public.interventoria_alcances (proyecto_id);

create table public.interventoria_usuarios (
  alcance_id uuid not null references public.interventoria_alcances (id) on delete cascade,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  subrol     text not null check (subrol in ('director', 'tecnico', 'administrativo', 'financiero', 'juridico_contable')),
  primary key (alcance_id, usuario_id)
);
create index interventoria_usuarios_idx on public.interventoria_usuarios (usuario_id);
create trigger interventoria_alcances_audit after insert or update or delete on public.interventoria_alcances
  for each row execute function public.auditar_tabla();
create trigger interventoria_usuarios_audit after insert or update or delete on public.interventoria_usuarios
  for each row execute function public.auditar_tabla();

-- Mis alcances vigentes en un proyecto (solo cuenta quien además es miembro con rol de interventoría).
create function public.mis_alcances(p_proyecto uuid)
returns setof public.interventoria_alcances language sql stable security definer set search_path = ''
as $$
  select a.* from public.interventoria_alcances a
  join public.interventoria_usuarios u on u.alcance_id = a.id and u.usuario_id = auth.uid()
  where a.proyecto_id = p_proyecto
    and exists (select 1 from public.miembros_proyecto m where m.proyecto_id = p_proyecto and m.usuario_id = auth.uid() and m.rol = 'interventoria')
    and (a.fecha_inicio is null or a.fecha_inicio <= public.hoy_co())
    and (a.fecha_fin is null or a.fecha_fin >= public.hoy_co());
$$;

-- Con alguna asignación vigente: ve documentos, revisiones y asesorías del proyecto.
create or replace function public.es_interventor(p_proyecto uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.mis_alcances(p_proyecto)); $$;
-- Con asignación sobre un contrato de obra: además ve cronograma, WBS, bitácora e hitos.
create function public.es_interventor_obra(p_proyecto uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.mis_alcances(p_proyecto) where contrato_vigilado_id is not null); $$;
-- ¿Veo este contrato como interventor? (el vigilado o el propio contrato de interventoría)
create function public.es_interventor_de_contrato(p_contrato uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.contratos c, lateral public.mis_alcances(c.proyecto_id) a
    where c.id = p_contrato and (a.contrato_vigilado_id = p_contrato or a.contrato_interventoria_id = p_contrato));
$$;
-- Sub-rol con el que puedo actuar (o null): coincide con uno de los pedidos y el alcance cubre lo pedido.
create function public.interventor_subrol(p_proyecto uuid, p_subroles text[], p_alcances text[], p_contrato uuid default null)
returns text language sql stable security definer set search_path = ''
as $$
  select u.subrol from public.mis_alcances(p_proyecto) a
  join public.interventoria_usuarios u on u.alcance_id = a.id and u.usuario_id = auth.uid()
  where u.subrol = any(p_subroles)
    and (p_alcances is null or a.alcances && p_alcances)
    and (p_contrato is null or a.contrato_vigilado_id = p_contrato)
  order by (u.subrol = 'director') desc limit 1;
$$;
revoke execute on function public.mis_alcances(uuid), public.es_interventor_obra(uuid), public.es_interventor_de_contrato(uuid),
  public.interventor_subrol(uuid, text[], text[], uuid) from public, anon;
grant execute on function public.mis_alcances(uuid), public.es_interventor_obra(uuid), public.es_interventor_de_contrato(uuid),
  public.interventor_subrol(uuid, text[], text[], uuid) to authenticated;

alter table public.interventoria_alcances enable row level security;
alter table public.interventoria_usuarios enable row level security;
revoke all on public.interventoria_alcances, public.interventoria_usuarios from anon, authenticated;
grant select on public.interventoria_alcances, public.interventoria_usuarios to authenticated;
create policy ialcances_ver on public.interventoria_alcances for select to authenticated
  using (public.puede_ver_proyecto(proyecto_id) or id in (select a.id from public.mis_alcances(proyecto_id) a));
create policy iusuarios_ver on public.interventoria_usuarios for select to authenticated
  using (usuario_id = auth.uid() or exists (select 1 from public.interventoria_alcances a where a.id = alcance_id and public.puede_ver_proyecto(a.proyecto_id)));

create function public.interventoria_alcance_guardar(
  p_id uuid, p_proyecto uuid, p_contrato_interventoria uuid, p_contrato_vigilado uuid, p_alcances text[], p_inicio date, p_fin date)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.puede_gestionar(p_proyecto) then
    raise exception 'No tienes permiso para asignar interventoría en este proyecto.' using errcode = '42501';
  end if;
  if p_contrato_interventoria is not null and not exists (select 1 from public.contratos where id = p_contrato_interventoria and proyecto_id = p_proyecto and tipo = 'interventoria') then
    raise exception 'El contrato de interventoría no es válido (debe ser de tipo interventoría y de este proyecto).' using errcode = '22023';
  end if;
  if p_contrato_vigilado is not null and not exists (select 1 from public.contratos where id = p_contrato_vigilado and proyecto_id = p_proyecto and tipo <> 'interventoria') then
    raise exception 'El contrato vigilado no es válido.' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.interventoria_alcances (proyecto_id, contrato_interventoria_id, contrato_vigilado_id, alcances, fecha_inicio, fecha_fin)
      values (p_proyecto, p_contrato_interventoria, p_contrato_vigilado, coalesce(p_alcances, '{}'), p_inicio, p_fin) returning id into v_id;
  else
    update public.interventoria_alcances set contrato_interventoria_id = p_contrato_interventoria, contrato_vigilado_id = p_contrato_vigilado,
      alcances = coalesce(p_alcances, '{}'), fecha_inicio = p_inicio, fecha_fin = p_fin where id = p_id and proyecto_id = p_proyecto returning id into v_id;
    if v_id is null then raise exception 'Asignación no encontrada.' using errcode = '22023'; end if;
  end if;
  return v_id;
exception when check_violation then
  raise exception 'Elige al menos un alcance y revisa que la fecha final no sea anterior a la inicial.' using errcode = '22023';
end;
$$;

create function public.interventoria_usuario_asignar(p_alcance uuid, p_usuario uuid, p_subrol text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_proy uuid;
begin
  select proyecto_id into v_proy from public.interventoria_alcances where id = p_alcance;
  if v_proy is null then raise exception 'Asignación no encontrada.' using errcode = '22023'; end if;
  if auth.uid() is null or not public.puede_gestionar(v_proy) then
    raise exception 'No tienes permiso para asignar interventoría en este proyecto.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.miembros_proyecto where proyecto_id = v_proy and usuario_id = p_usuario and rol = 'interventoria') then
    raise exception 'La persona debe estar en el equipo del proyecto con el rol Interventoría (lo asigna el administrador).' using errcode = '22023';
  end if;
  insert into public.interventoria_usuarios (alcance_id, usuario_id, subrol) values (p_alcance, p_usuario, p_subrol)
    on conflict (alcance_id, usuario_id) do update set subrol = excluded.subrol;
exception when check_violation then
  raise exception 'Sub-rol no válido.' using errcode = '22023';
end;
$$;

create function public.interventoria_asignacion_quitar(p_alcance uuid, p_usuario uuid default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_proy uuid;
begin
  select proyecto_id into v_proy from public.interventoria_alcances where id = p_alcance;
  if v_proy is null then return; end if;
  if auth.uid() is null or not public.puede_gestionar(v_proy) then
    raise exception 'No tienes permiso para cambiar la interventoría de este proyecto.' using errcode = '42501';
  end if;
  if p_usuario is null then delete from public.interventoria_alcances where id = p_alcance;
  else delete from public.interventoria_usuarios where alcance_id = p_alcance and usuario_id = p_usuario; end if;
end;
$$;

-- 2. LA INTERVENTORÍA SOLO VE LOS CONTRATOS ASIGNADOS ---------------------------------------------------
drop policy contratos_ver on public.contratos;
create policy contratos_ver on public.contratos for select to authenticated
  using (public.puede_ver_proyecto(proyecto_id) or public.es_interventor_de_contrato(id));
drop policy actas_pago_ver on public.actas_pago;
create policy actas_pago_ver on public.actas_pago for select to authenticated
  using (public.puede_ver_proyecto(proyecto_id) or public.es_interventor_de_contrato(contrato_id));
drop policy cambios_ver on public.cambios;
create policy cambios_ver on public.cambios for select to authenticated
  using (public.puede_ver_proyecto(proyecto_id) or (contrato_id is not null and public.es_interventor_de_contrato(contrato_id)));
drop policy cambios_historial_ver on public.cambios_historial;
create policy cambios_historial_ver on public.cambios_historial for select to authenticated
  using (public.puede_ver_proyecto(proyecto_id) or exists (select 1 from public.cambios c where c.id = cambio_id and c.contrato_id is not null and public.es_interventor_de_contrato(c.contrato_id)));

-- Datos de obra: solo con una asignación sobre un contrato de obra.
drop policy wbs_ver on public.wbs_elementos;
create policy wbs_ver on public.wbs_elementos for select to authenticated using (public.puede_ver_proyecto(proyecto_id) or public.es_interventor_obra(proyecto_id));
drop policy hitos_ver on public.hitos;
create policy hitos_ver on public.hitos for select to authenticated using (public.puede_ver_proyecto(proyecto_id) or public.es_interventor_obra(proyecto_id));
drop policy tareas_ver on public.tareas;
create policy tareas_ver on public.tareas for select to authenticated using (public.puede_ver_proyecto(proyecto_id) or public.es_interventor_obra(proyecto_id));

create or replace function public.puede_ver_bitacora(p_proyecto uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select public.puede_ver_proyecto(p_proyecto) or public.es_interventor_obra(p_proyecto); $$;
create or replace function public.puede_registrar_bitacora(p_proyecto uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.puede_gestionar(p_proyecto) or public.es_interventor_obra(p_proyecto) or exists (
    select 1 from public.miembros_proyecto where proyecto_id = p_proyecto and usuario_id = auth.uid() and rol = 'supervisor');
$$;
create or replace function public.bitacora_comentar(p_bitacora uuid, p_tipo text, p_texto text)
returns void language plpgsql security definer set search_path = ''
as $$
declare b public.bitacoras; v_texto text := nullif(btrim(coalesce(p_texto, '')), '');
begin
  select * into b from public.bitacoras where id = p_bitacora;
  if not found then raise exception 'Entrada no encontrada.' using errcode = '22023'; end if;
  if p_tipo not in ('visto_bueno', 'comentario') then raise exception 'Tipo no válido.' using errcode = '22023'; end if;
  if auth.uid() is null or not (public.es_interventor_obra(b.proyecto_id) or (p_tipo = 'comentario' and public.puede_gestionar(b.proyecto_id))) then
    raise exception 'No tienes permiso para comentar esta entrada.' using errcode = '42501';
  end if;
  if p_tipo = 'comentario' and v_texto is null then raise exception 'Escribe el comentario.' using errcode = '22023'; end if;
  if v_texto is not null and length(v_texto) > 2000 then raise exception 'El comentario no puede superar 2000 caracteres.' using errcode = '22023'; end if;
  insert into public.bitacora_comentarios (bitacora_id, proyecto_id, tipo, texto) values (p_bitacora, b.proyecto_id, p_tipo, v_texto);
end;
$$;

-- Avance verificado: solo el interventor técnico (o el director de interventoría) con alcance técnico.
create or replace function public.tarea_verificar(p_tarea uuid, p_pct numeric, p_nota text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_proy uuid; v_nota text := nullif(btrim(coalesce(p_nota, '')), '');
begin
  select proyecto_id into v_proy from public.tareas where id = p_tarea;
  if v_proy is null then raise exception 'Tarea no encontrada.' using errcode = '22023'; end if;
  if auth.uid() is null or public.interventor_subrol(v_proy, array['tecnico', 'director'], array['tecnica']) is null then
    raise exception 'Solo el interventor técnico (o el director de interventoría) registra el avance verificado.' using errcode = '42501';
  end if;
  if p_pct is null or p_pct < 0 or p_pct > 100 then
    raise exception 'El avance verificado debe estar entre 0 y 100.' using errcode = '22023';
  end if;
  if v_nota is null or length(v_nota) < 3 or length(v_nota) > 500 then
    raise exception 'Escribe la nota de verificación (3 a 500 caracteres).' using errcode = '22023';
  end if;
  update public.tareas set avance_verificado_pct = round(p_pct, 2), nota_verificacion = v_nota,
    verificado_por = auth.uid(), fecha_verificacion = public.hoy_co() where id = p_tarea;
end;
$$;

drop policy proyectos_ver on public.proyectos;
create policy proyectos_ver on public.proyectos for select to authenticated
  using (public.ve_todos() or public.es_miembro(id) or public.es_interventor(id));

-- 3. CONCEPTOS (inmutables) ---------------------------------------------------------------------------------
create function public.concepto_permitido(p_subrol text, p_tipo text)
returns boolean language sql immutable set search_path = ''
as $$
  select case p_subrol
    when 'director' then true
    when 'tecnico' then p_tipo in ('acta_pago', 'avance', 'cambio', 'diseno', 'estudios_previos_pliegos', 'otro')
    when 'financiero' then p_tipo in ('acta_pago', 'anticipo', 'cambio', 'otro')
    when 'administrativo' then p_tipo in ('estudios_previos_pliegos', 'otro')
    when 'juridico_contable' then p_tipo in ('cambio', 'estudios_previos_pliegos', 'otro')
    else false end;
$$;
-- Alcance que debe tener la asignación para cada tipo de concepto.
create function public.concepto_alcances(p_tipo text)
returns text[] language sql immutable set search_path = ''
as $$
  select case p_tipo
    when 'acta_pago' then array['tecnica', 'financiera']
    when 'anticipo' then array['financiera']
    when 'avance' then array['tecnica']
    when 'cambio' then array['tecnica', 'financiera', 'juridica', 'contable']
    when 'diseno' then array['disenos']
    when 'estudios_previos_pliegos' then array['asesoria']
    else null end;
$$;

create table public.conceptos_interventoria (
  id            uuid primary key default gen_random_uuid(),
  proyecto_id   uuid not null references public.proyectos (id) on delete cascade,
  tipo          text not null check (tipo in ('acta_pago', 'avance', 'cambio', 'anticipo', 'diseno', 'estudios_previos_pliegos', 'otro')),
  entidad_tipo  text not null check (entidad_tipo in ('acta_pago', 'tarea', 'cambio', 'contrato', 'documento', 'proyecto')),
  entidad_id    uuid not null,
  contrato_id   uuid,
  resultado     text not null check (resultado in ('aprobado', 'aprobado_con_observaciones', 'no_aprobado')),
  texto         text check (length(texto) <= 4000),
  autor_id      uuid not null default auth.uid(),
  subrol        text not null,
  fecha         timestamptz not null default now()
);
create index conceptos_entidad_idx on public.conceptos_interventoria (entidad_tipo, entidad_id, fecha desc);
create index conceptos_proyecto_idx on public.conceptos_interventoria (proyecto_id, fecha desc);

alter table public.conceptos_interventoria enable row level security;
revoke all on public.conceptos_interventoria from anon, authenticated;
grant select on public.conceptos_interventoria to authenticated;
create policy conceptos_ver on public.conceptos_interventoria for select to authenticated
  using (public.puede_ver_proyecto(proyecto_id) or (contrato_id is not null and public.es_interventor_de_contrato(contrato_id)) or (contrato_id is null and public.es_interventor(proyecto_id)));

-- ¿El contrato tiene interventoría asignada? Y ¿los interventores requeridos ya dieron concepto favorable?
create function public.contrato_con_interventoria(p_contrato uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.interventoria_alcances a join public.interventoria_usuarios u on u.alcance_id = a.id
    where a.contrato_vigilado_id = p_contrato and (a.fecha_inicio is null or a.fecha_inicio <= public.hoy_co()) and (a.fecha_fin is null or a.fecha_fin >= public.hoy_co()));
$$;

create or replace function public.acta_requiere_interventoria(p_acta uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce((select public.contrato_con_interventoria(contrato_id) from public.actas_pago where id = p_acta), false); $$;

-- Favorable: el último concepto de cada interventor técnico y financiero asignado es Aprobado o Aprobado con observaciones
-- (si no hay técnico ni financiero, el del director), y ninguno de los últimos conceptos es No aprobado.
create or replace function public.acta_concepto_favorable(p_acta uuid)
returns boolean language plpgsql stable security definer set search_path = ''
as $$
declare v_contrato uuid; v_req text[]; s text; v_res text;
begin
  select contrato_id into v_contrato from public.actas_pago where id = p_acta;
  if v_contrato is null then return false; end if;
  select coalesce(array_agg(distinct u.subrol) filter (where u.subrol in ('tecnico', 'financiero')), '{}') into v_req
    from public.interventoria_alcances a join public.interventoria_usuarios u on u.alcance_id = a.id where a.contrato_vigilado_id = v_contrato;
  if cardinality(v_req) = 0 then v_req := array['director']; end if;
  if exists (select 1 from (select distinct on (subrol) resultado from public.conceptos_interventoria
      where tipo = 'acta_pago' and entidad_id = p_acta order by subrol, fecha desc, id desc) x where resultado = 'no_aprobado') then
    return false;
  end if;
  foreach s in array v_req loop
    select resultado into v_res from public.conceptos_interventoria where tipo = 'acta_pago' and entidad_id = p_acta and subrol = s order by fecha desc, id desc limit 1;
    if v_res is null or v_res = 'no_aprobado' then return false; end if;
  end loop;
  return true;
end;
$$;

-- Un cambio ligado a un contrato con interventoría necesita su concepto antes del análisis de impacto.
create or replace function public.cambio_concepto_pendiente(p_cambio uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((select c.contrato_id is not null and public.contrato_con_interventoria(c.contrato_id)
      and not exists (select 1 from public.conceptos_interventoria k where k.tipo = 'cambio' and k.entidad_id = c.id)
    from public.cambios c where c.id = p_cambio), false);
$$;

create function public.concepto_emitir(p_proyecto uuid, p_tipo text, p_entidad_tipo text, p_entidad_id uuid, p_resultado text, p_texto text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_contrato uuid; v_subrol text; v_texto text := nullif(btrim(coalesce(p_texto, '')), ''); v_id uuid; v_estado text;
begin
  if auth.uid() is null or not public.es_interventor(p_proyecto) then
    raise exception 'Solo la interventoría asignada emite conceptos.' using errcode = '42501';
  end if;
  if p_resultado not in ('aprobado', 'aprobado_con_observaciones', 'no_aprobado') then raise exception 'Resultado no válido.' using errcode = '22023'; end if;
  if p_resultado <> 'aprobado' and (v_texto is null or length(v_texto) < 3) then
    raise exception 'Explica las observaciones del concepto (mínimo 3 caracteres).' using errcode = '22023';
  end if;
  if v_texto is not null and length(v_texto) > 4000 then raise exception 'El texto no puede superar 4000 caracteres.' using errcode = '22023'; end if;

  -- El registro al que se refiere debe existir en este proyecto; de él sale el contrato.
  v_contrato := case p_entidad_tipo
    when 'acta_pago' then (select contrato_id from public.actas_pago where id = p_entidad_id and proyecto_id = p_proyecto)
    when 'cambio' then (select contrato_id from public.cambios where id = p_entidad_id and proyecto_id = p_proyecto)
    when 'contrato' then (select id from public.contratos where id = p_entidad_id and proyecto_id = p_proyecto)
    else null end;
  if p_entidad_tipo in ('acta_pago', 'contrato') and v_contrato is null then raise exception 'El registro no existe en este proyecto.' using errcode = '22023'; end if;
  if p_entidad_tipo = 'cambio' and not exists (select 1 from public.cambios where id = p_entidad_id and proyecto_id = p_proyecto) then raise exception 'El registro no existe en este proyecto.' using errcode = '22023'; end if;
  if p_entidad_tipo = 'tarea' and not exists (select 1 from public.tareas where id = p_entidad_id and proyecto_id = p_proyecto) then raise exception 'El registro no existe en este proyecto.' using errcode = '22023'; end if;
  if p_entidad_tipo = 'documento' and not exists (select 1 from public.documentos where id = p_entidad_id and proyecto_id = p_proyecto) then raise exception 'El registro no existe en este proyecto.' using errcode = '22023'; end if;
  if p_entidad_tipo = 'proyecto' and p_entidad_id <> p_proyecto then raise exception 'El registro no existe en este proyecto.' using errcode = '22023'; end if;
  if p_entidad_tipo not in ('acta_pago', 'tarea', 'cambio', 'contrato', 'documento', 'proyecto') then raise exception 'Tipo de registro no válido.' using errcode = '22023'; end if;

  -- Sub-rol: cada tipo de concepto lo emite solo quien corresponde (el financiero no conceptúa sobre diseños; el técnico no sobre el anticipo).
  select u.subrol into v_subrol from public.mis_alcances(p_proyecto) a
    join public.interventoria_usuarios u on u.alcance_id = a.id and u.usuario_id = auth.uid()
    where public.concepto_permitido(u.subrol, p_tipo)
      and (public.concepto_alcances(p_tipo) is null or a.alcances && public.concepto_alcances(p_tipo))
      and (v_contrato is null or a.contrato_vigilado_id = v_contrato)
    order by (u.subrol = 'director') desc limit 1;
  if v_subrol is null then
    raise exception 'Tu sub-rol o tu asignación no permiten emitir conceptos de tipo "%" sobre este registro.', p_tipo using errcode = '42501';
  end if;

  insert into public.conceptos_interventoria (proyecto_id, tipo, entidad_tipo, entidad_id, contrato_id, resultado, texto, subrol)
    values (p_proyecto, p_tipo, p_entidad_tipo, p_entidad_id, v_contrato, p_resultado, v_texto, v_subrol) returning id into v_id;

  -- El concepto mueve el estado del acta: con un No aprobado vigente pasa a Con observaciones; si no, queda En revisión.
  if p_tipo = 'acta_pago' and p_entidad_tipo = 'acta_pago' then
    select estado into v_estado from public.actas_pago where id = p_entidad_id;
    if v_estado <> 'aprobada_pago' then
      if exists (select 1 from (select distinct on (subrol) resultado from public.conceptos_interventoria
          where tipo = 'acta_pago' and entidad_id = p_entidad_id order by subrol, fecha desc, id desc) x where resultado = 'no_aprobado') then
        update public.actas_pago set estado = 'con_observaciones' where id = p_entidad_id;
      else
        update public.actas_pago set estado = 'en_revision_interventoria' where id = p_entidad_id;
      end if;
    end if;
  end if;
  return v_id;
end;
$$;

-- 4. HALLAZGOS Y REQUERIMIENTOS ----------------------------------------------------------------------------
create table public.hallazgos (
  id               uuid primary key default gen_random_uuid(),
  proyecto_id      uuid not null references public.proyectos (id) on delete cascade,
  contrato_id      uuid references public.contratos (id) on delete set null,
  severidad        text not null check (severidad in ('observacion', 'no_conformidad', 'incumplimiento_grave')),
  descripcion      text not null check (length(btrim(descripcion)) between 1 and 4000),
  evidencia        uuid[] not null default '{}',                 -- documentos del proyecto
  fecha            date not null default public.hoy_co(),
  plazo_respuesta  date not null,
  estado           text not null default 'abierto' check (estado in ('abierto', 'respondido', 'cerrado', 'escalado')),
  respuesta        text check (length(respuesta) <= 4000),
  respondido_por   uuid,
  respondido_en    timestamptz,
  escalado_en      timestamptz,
  cerrado_por      uuid,
  cerrado_en       timestamptz,
  creado_por       uuid not null default auth.uid(),
  creado_en        timestamptz not null default now()
);
create index hallazgos_proyecto_idx on public.hallazgos (proyecto_id, estado);
create trigger hallazgos_audit after insert or update or delete on public.hallazgos
  for each row execute function public.auditar_tabla();

alter table public.hallazgos enable row level security;
revoke all on public.hallazgos from anon, authenticated;
grant select on public.hallazgos to authenticated;
create policy hallazgos_ver on public.hallazgos for select to authenticated
  using (public.puede_ver_proyecto(proyecto_id) or (contrato_id is not null and public.es_interventor_de_contrato(contrato_id)) or (contrato_id is null and public.es_interventor(proyecto_id)));

create function public.hallazgo_crear(p_proyecto uuid, p_contrato uuid, p_severidad text, p_descripcion text, p_evidencia uuid[])
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_dias integer; v_id uuid; v_desc text := nullif(btrim(coalesce(p_descripcion, '')), '');
begin
  if auth.uid() is null or public.interventor_subrol(p_proyecto, array['director', 'tecnico', 'administrativo', 'financiero', 'juridico_contable'], null, p_contrato) is null then
    raise exception 'Solo la interventoría asignada registra hallazgos (sobre sus contratos).' using errcode = '42501';
  end if;
  if p_severidad not in ('observacion', 'no_conformidad', 'incumplimiento_grave') then raise exception 'Severidad no válida.' using errcode = '22023'; end if;
  if v_desc is null then raise exception 'Describe el hallazgo.' using errcode = '22023'; end if;
  if p_contrato is not null and not exists (select 1 from public.contratos where id = p_contrato and proyecto_id = p_proyecto) then
    raise exception 'El contrato no es de este proyecto.' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_evidencia), 0) > 0 and (select count(*) from public.documentos where id = any(p_evidencia) and proyecto_id = p_proyecto) <> cardinality(p_evidencia) then
    raise exception 'Alguna evidencia no es un documento de este proyecto.' using errcode = '22023';
  end if;
  v_dias := coalesce(public.parametro('plazo_hallazgo_' || p_severidad, p_proyecto)::integer, case p_severidad when 'observacion' then 5 when 'no_conformidad' then 3 else 1 end);
  insert into public.hallazgos (proyecto_id, contrato_id, severidad, descripcion, evidencia, plazo_respuesta)
    values (p_proyecto, p_contrato, p_severidad, v_desc, coalesce(p_evidencia, '{}'), public.dias_habiles_sumar(public.hoy_co(), v_dias)) returning id into v_id;
  return v_id;
exception when check_violation then
  raise exception 'La descripción es demasiado larga (máximo 4000 caracteres).' using errcode = '22023';
end;
$$;

-- Pasa a Escalado todo hallazgo abierto cuyo plazo venció. Lo ejecuta quien consulta (resultado determinista).
create function public.hallazgos_escalar(p_proyecto uuid)
returns integer language plpgsql security definer set search_path = ''
as $$
declare n integer;
begin
  if auth.uid() is null or not (public.puede_ver_proyecto(p_proyecto) or public.es_interventor(p_proyecto)) then return 0; end if;
  update public.hallazgos set estado = 'escalado', escalado_en = now()
    where proyecto_id = p_proyecto and estado = 'abierto' and plazo_respuesta < public.hoy_co();
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Responde el gerente (o quien lo representa: el contratista, registrado por el gerente).
create function public.hallazgo_responder(p_hallazgo uuid, p_respuesta text)
returns void language plpgsql security definer set search_path = ''
as $$
declare h public.hallazgos; v_r text := nullif(btrim(coalesce(p_respuesta, '')), '');
begin
  select * into h from public.hallazgos where id = p_hallazgo for update;
  if not found then raise exception 'Hallazgo no encontrado.' using errcode = '22023'; end if;
  if auth.uid() is null or not public.puede_gestionar(h.proyecto_id) then
    raise exception 'Solo el gerente (o el administrador) registra la respuesta.' using errcode = '42501';
  end if;
  if h.estado = 'cerrado' then raise exception 'El hallazgo ya está cerrado.' using errcode = '22023'; end if;
  if v_r is null or length(v_r) < 3 then raise exception 'Escribe la respuesta (mínimo 3 caracteres).' using errcode = '22023'; end if;
  if length(v_r) > 4000 then raise exception 'La respuesta es demasiado larga.' using errcode = '22023'; end if;
  update public.hallazgos set estado = 'respondido', respuesta = v_r, respondido_por = auth.uid(), respondido_en = now() where id = p_hallazgo;
end;
$$;

-- Cierra la interventoría (quien lo creó o el director) cuando la respuesta es satisfactoria.
create function public.hallazgo_cerrar(p_hallazgo uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare h public.hallazgos;
begin
  select * into h from public.hallazgos where id = p_hallazgo for update;
  if not found then raise exception 'Hallazgo no encontrado.' using errcode = '22023'; end if;
  if auth.uid() is null or not (h.creado_por = auth.uid() or public.interventor_subrol(h.proyecto_id, array['director'], null, h.contrato_id) is not null) then
    raise exception 'Solo quien registró el hallazgo o el director de interventoría lo cierra.' using errcode = '42501';
  end if;
  if h.estado <> 'respondido' then raise exception 'Solo se cierra un hallazgo que ya fue respondido.' using errcode = '22023'; end if;
  update public.hallazgos set estado = 'cerrado', cerrado_por = auth.uid(), cerrado_en = now() where id = p_hallazgo;
end;
$$;

-- Si la respuesta no es suficiente, se reabre con un nuevo plazo.
create function public.hallazgo_reabrir(p_hallazgo uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare h public.hallazgos; v_dias integer;
begin
  select * into h from public.hallazgos where id = p_hallazgo for update;
  if not found then raise exception 'Hallazgo no encontrado.' using errcode = '22023'; end if;
  if auth.uid() is null or not (h.creado_por = auth.uid() or public.interventor_subrol(h.proyecto_id, array['director'], null, h.contrato_id) is not null) then
    raise exception 'Solo quien registró el hallazgo o el director de interventoría lo reabre.' using errcode = '42501';
  end if;
  if h.estado not in ('respondido', 'cerrado') then raise exception 'Solo se reabre un hallazgo respondido o cerrado.' using errcode = '22023'; end if;
  v_dias := coalesce(public.parametro('plazo_hallazgo_' || h.severidad, h.proyecto_id)::integer, 3);
  update public.hallazgos set estado = 'abierto', plazo_respuesta = public.dias_habiles_sumar(public.hoy_co(), v_dias), cerrado_por = null, cerrado_en = null where id = p_hallazgo;
end;
$$;

-- 5. REVISIÓN DE DISEÑOS ------------------------------------------------------------------------------------------
create table public.revisiones_diseno (
  id             uuid primary key default gen_random_uuid(),
  proyecto_id    uuid not null references public.proyectos (id) on delete cascade,
  documento_id   uuid not null references public.documentos (id) on delete cascade,
  version        integer not null,                       -- versión del documento que se revisó
  disciplina     text not null check (length(btrim(disciplina)) between 1 and 100),
  ciclo          integer not null check (ciclo >= 1),
  estado         text not null check (estado in ('pendiente', 'con_observaciones', 'aprobado')),
  observaciones  text check (length(observaciones) <= 4000),
  revisor_id     uuid not null default auth.uid(),
  fecha          timestamptz not null default now(),
  unique (documento_id, ciclo)
);
create table public.diseno_estado (
  proyecto_id    uuid primary key references public.proyectos (id) on delete cascade,
  listo_licitar  boolean not null default false,
  marcado_por    uuid,
  fecha          timestamptz not null default now()
);
create trigger diseno_estado_audit after insert or update or delete on public.diseno_estado
  for each row execute function public.auditar_tabla();

alter table public.revisiones_diseno enable row level security;
alter table public.diseno_estado enable row level security;
revoke all on public.revisiones_diseno, public.diseno_estado from anon, authenticated;
grant select on public.revisiones_diseno, public.diseno_estado to authenticated;
create policy revisiones_ver on public.revisiones_diseno for select to authenticated using (public.puede_ver_proyecto(proyecto_id) or public.es_interventor(proyecto_id));
create policy diseno_estado_ver on public.diseno_estado for select to authenticated using (public.puede_ver_proyecto(proyecto_id) or public.es_interventor(proyecto_id));

create function public.revision_diseno_crear(p_proyecto uuid, p_documento uuid, p_disciplina text, p_estado text, p_observaciones text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_ver integer; v_ciclo integer; v_id uuid; v_obs text := nullif(btrim(coalesce(p_observaciones, '')), ''); v_cat text;
begin
  if auth.uid() is null or public.interventor_subrol(p_proyecto, array['tecnico', 'director'], array['disenos']) is null then
    raise exception 'Solo el interventor técnico (o el director) con alcance de diseños revisa entregables.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.documentos where id = p_documento and proyecto_id = p_proyecto and tipo = 'plano') then
    raise exception 'El entregable debe ser un plano de este proyecto.' using errcode = '22023';
  end if;
  if p_estado not in ('pendiente', 'con_observaciones', 'aprobado') then raise exception 'Estado no válido.' using errcode = '22023'; end if;
  if p_estado = 'con_observaciones' and v_obs is null then raise exception 'Escribe las observaciones de la revisión.' using errcode = '22023'; end if;
  v_cat := coalesce(public.parametro('catalogo_disciplinas_diseno', p_proyecto), '');
  if not (btrim(coalesce(p_disciplina, '')) = any(array(select btrim(x) from unnest(string_to_array(v_cat, ',')) x))) then
    raise exception 'La disciplina no está en el catálogo configurado.' using errcode = '22023';
  end if;
  select max(version) into v_ver from public.documento_versiones where documento_id = p_documento;
  select coalesce(max(ciclo), 0) + 1 into v_ciclo from public.revisiones_diseno where documento_id = p_documento;
  insert into public.revisiones_diseno (proyecto_id, documento_id, version, disciplina, ciclo, estado, observaciones)
    values (p_proyecto, p_documento, coalesce(v_ver, 1), btrim(p_disciplina), v_ciclo, p_estado, v_obs) returning id into v_id;
  -- Cualquier revisión nueva retira la marca de "listo para licitar" hasta que todo vuelva a estar aprobado.
  update public.diseno_estado set listo_licitar = false, fecha = now() where proyecto_id = p_proyecto and listo_licitar and p_estado <> 'aprobado';
  return v_id;
end;
$$;

-- Listo para licitar: todos los planos con su última revisión Aprobada y sobre su última versión.
create function public.diseno_marcar_listo(p_proyecto uuid, p_listo boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_total integer; v_ok integer;
begin
  if auth.uid() is null or not public.puede_gestionar(p_proyecto) then
    raise exception 'Solo el gerente o el administrador marcan el diseño como listo para licitar.' using errcode = '42501';
  end if;
  if p_listo then
    select count(*)::integer into v_total from public.documentos where proyecto_id = p_proyecto and tipo = 'plano';
    select count(*)::integer into v_ok from public.documentos d
      where d.proyecto_id = p_proyecto and d.tipo = 'plano' and exists (
        select 1 from public.revisiones_diseno r where r.documento_id = d.id and r.estado = 'aprobado'
          and r.ciclo = (select max(ciclo) from public.revisiones_diseno where documento_id = d.id)
          and r.version = (select max(version) from public.documento_versiones where documento_id = d.id));
    if v_total = 0 then raise exception 'No hay planos registrados.' using errcode = '22023'; end if;
    if v_ok < v_total then
      raise exception 'Solo % de % planos están aprobados en su última versión. Todos deben estar aprobados.', v_ok, v_total using errcode = '22023';
    end if;
  end if;
  insert into public.diseno_estado (proyecto_id, listo_licitar, marcado_por) values (p_proyecto, coalesce(p_listo, false), auth.uid())
    on conflict (proyecto_id) do update set listo_licitar = excluded.listo_licitar, marcado_por = excluded.marcado_por, fecha = now();
end;
$$;

-- 6. EVALUACIÓN DE PROVEEDORES Y CONTRATISTAS ------------------------------------------------------------------------
create table public.evaluaciones_proveedor (
  id             uuid primary key default gen_random_uuid(),
  proyecto_id    uuid not null references public.proyectos (id) on delete cascade,
  contrato_id    uuid references public.contratos (id) on delete set null,
  proveedor      text not null check (length(btrim(proveedor)) between 1 and 200),
  puntajes       jsonb not null,
  puntaje_total  numeric(4, 2) not null check (puntaje_total between 1 and 5),
  recomendacion  text not null check (recomendacion in ('recomendar', 'con_reservas', 'no_recomendar')),
  comentario     text check (length(comentario) <= 4000),
  evaluador_id   uuid not null default auth.uid(),
  fecha          timestamptz not null default now()
);
create table public.asesorias (
  id             uuid primary key default gen_random_uuid(),
  proyecto_id    uuid not null references public.proyectos (id) on delete cascade,
  tema           text not null check (length(btrim(tema)) between 1 and 200),
  tipo           text not null check (tipo in ('estudio_mercado', 'investigacion', 'estudios_previos_pliegos')),
  fuentes        text check (length(fuentes) <= 4000),
  conclusiones   text not null check (length(btrim(conclusiones)) between 1 and 4000),
  recomendacion  text not null check (length(btrim(recomendacion)) between 1 and 4000),
  autor_id       uuid not null default auth.uid(),
  fecha          timestamptz not null default now()
);
alter table public.evaluaciones_proveedor enable row level security;
alter table public.asesorias enable row level security;
revoke all on public.evaluaciones_proveedor, public.asesorias from anon, authenticated;
grant select on public.evaluaciones_proveedor, public.asesorias to authenticated;
create policy eval_prov_ver on public.evaluaciones_proveedor for select to authenticated
  using (public.puede_ver_proyecto(proyecto_id) or (contrato_id is not null and public.es_interventor_de_contrato(contrato_id)) or (contrato_id is null and public.es_interventor(proyecto_id)));
create policy asesorias_ver on public.asesorias for select to authenticated using (public.puede_ver_proyecto(proyecto_id) or public.es_interventor(proyecto_id));

-- La interventoría recomienda; la selección y la contratación son de la entidad.
create function public.evaluacion_proveedor_crear(p_proyecto uuid, p_contrato uuid, p_proveedor text, p_puntajes jsonb, p_recomendacion text, p_comentario text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_crit text[]; c text; v numeric; suma numeric := 0; v_id uuid;
begin
  if auth.uid() is null or public.interventor_subrol(p_proyecto, array['director', 'tecnico', 'administrativo', 'financiero', 'juridico_contable'], null, p_contrato) is null then
    raise exception 'Solo la interventoría asignada evalúa proveedores y contratistas.' using errcode = '42501';
  end if;
  if p_recomendacion not in ('recomendar', 'con_reservas', 'no_recomendar') then raise exception 'Recomendación no válida.' using errcode = '22023'; end if;
  if nullif(btrim(coalesce(p_proveedor, '')), '') is null then raise exception 'Indica el proveedor o contratista.' using errcode = '22023'; end if;
  v_crit := array(select btrim(x) from unnest(string_to_array(coalesce(public.parametro('criterios_evaluacion_proveedor', p_proyecto), ''), ',')) x where btrim(x) <> '');
  if cardinality(v_crit) = 0 then raise exception 'No hay criterios de evaluación configurados.' using errcode = '22023'; end if;
  foreach c in array v_crit loop
    begin
      v := (p_puntajes ->> c)::numeric;
    exception when others then v := null;
    end;
    if v is null or v < 1 or v > 5 or v <> trunc(v) then
      raise exception 'Califica el criterio "%" con un número entero de 1 a 5.', c using errcode = '22023';
    end if;
    suma := suma + v;
  end loop;
  insert into public.evaluaciones_proveedor (proyecto_id, contrato_id, proveedor, puntajes, puntaje_total, recomendacion, comentario)
    values (p_proyecto, p_contrato, btrim(p_proveedor), p_puntajes, round(suma / cardinality(v_crit), 2), p_recomendacion, nullif(btrim(coalesce(p_comentario, '')), ''))
    returning id into v_id;
  return v_id;
end;
$$;

create function public.asesoria_crear(p_proyecto uuid, p_tema text, p_tipo text, p_fuentes text, p_conclusiones text, p_recomendacion text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if auth.uid() is null or public.interventor_subrol(p_proyecto, array['director', 'tecnico', 'administrativo', 'financiero', 'juridico_contable'], array['asesoria']) is null then
    raise exception 'Solo la interventoría con alcance de asesoría aporta asesorías.' using errcode = '42501';
  end if;
  insert into public.asesorias (proyecto_id, tema, tipo, fuentes, conclusiones, recomendacion)
    values (p_proyecto, btrim(coalesce(p_tema, '')), coalesce(p_tipo, ''), nullif(btrim(coalesce(p_fuentes, '')), ''), btrim(coalesce(p_conclusiones, '')), btrim(coalesce(p_recomendacion, '')))
    returning id into v_id;
  return v_id;
exception when check_violation then
  raise exception 'Revisa el tema, el tipo, las conclusiones y la recomendación (obligatorios; máximo 4000 caracteres).' using errcode = '22023';
end;
$$;

-- 7. INFORMES ------------------------------------------------------------------------------------------------------------
create table public.informes_interventoria (
  id            uuid primary key default gen_random_uuid(),
  proyecto_id   uuid not null references public.proyectos (id) on delete cascade,
  alcance_id    uuid references public.interventoria_alcances (id) on delete set null,
  contrato_id   uuid references public.contratos (id) on delete set null,
  tipo          text not null check (tipo in ('periodico', 'especial', 'sancionatorio', 'final')),
  periodo       text not null check (length(btrim(periodo)) between 1 and 100),
  acta_pago_id  uuid references public.actas_pago (id) on delete set null,
  contenido     jsonb not null default '{}'::jsonb,           -- secciones automáticas (foto al crear)
  recomendacion text check (recomendacion in ('aprobar_pago', 'aprobar_con_observaciones', 'no_aprobar')),
  motivo        text check (length(motivo) <= 4000),
  estado        text not null default 'borrador' check (estado in ('borrador', 'firmado')),
  firmado_por   uuid,
  fecha_firma   timestamptz,
  creado_por    uuid not null default auth.uid(),
  creado_en     timestamptz not null default now()
);
create index informes_proyecto_idx on public.informes_interventoria (proyecto_id, creado_en desc);
create trigger informes_audit after insert or update or delete on public.informes_interventoria
  for each row execute function public.auditar_tabla();
alter table public.informes_interventoria enable row level security;
revoke all on public.informes_interventoria from anon, authenticated;
grant select on public.informes_interventoria to authenticated;
create policy informes_ver on public.informes_interventoria for select to authenticated
  using (public.puede_ver_proyecto(proyecto_id) or (contrato_id is not null and public.es_interventor_de_contrato(contrato_id)) or (contrato_id is null and public.es_interventor(proyecto_id)));

create function public.informe_crear(p_proyecto uuid, p_alcance uuid, p_tipo text, p_periodo text, p_acta uuid, p_contenido jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare a public.interventoria_alcances; v_id uuid;
begin
  select * into a from public.interventoria_alcances where id = p_alcance and proyecto_id = p_proyecto;
  if not found or auth.uid() is null or not exists (select 1 from public.mis_alcances(p_proyecto) m where m.id = p_alcance) then
    raise exception 'Solo la interventoría asignada elabora informes sobre su asignación.' using errcode = '42501';
  end if;
  if p_tipo not in ('periodico', 'especial', 'sancionatorio', 'final') then raise exception 'Tipo de informe no válido.' using errcode = '22023'; end if;
  if nullif(btrim(coalesce(p_periodo, '')), '') is null then raise exception 'Indica el periodo del informe.' using errcode = '22023'; end if;
  if p_acta is not null and not exists (select 1 from public.actas_pago where id = p_acta and proyecto_id = p_proyecto and contrato_id is not distinct from a.contrato_vigilado_id) then
    raise exception 'El acta de pago no corresponde al contrato de esta asignación.' using errcode = '22023';
  end if;
  insert into public.informes_interventoria (proyecto_id, alcance_id, contrato_id, tipo, periodo, acta_pago_id, contenido)
    values (p_proyecto, p_alcance, a.contrato_vigilado_id, p_tipo, btrim(p_periodo), p_acta, coalesce(p_contenido, '{}'::jsonb)) returning id into v_id;
  return v_id;
end;
$$;

create function public.informe_guardar(p_informe uuid, p_recomendacion text, p_motivo text)
returns void language plpgsql security definer set search_path = ''
as $$
declare i public.informes_interventoria;
begin
  select * into i from public.informes_interventoria where id = p_informe for update;
  if not found then raise exception 'Informe no encontrado.' using errcode = '22023'; end if;
  if auth.uid() is null or not exists (select 1 from public.mis_alcances(i.proyecto_id) m where m.id = i.alcance_id) then
    raise exception 'Solo la interventoría asignada edita sus informes.' using errcode = '42501';
  end if;
  if i.estado = 'firmado' then raise exception 'Un informe firmado no se modifica.' using errcode = '22023'; end if;
  if nullif(p_recomendacion, '') is not null and p_recomendacion not in ('aprobar_pago', 'aprobar_con_observaciones', 'no_aprobar') then
    raise exception 'Recomendación no válida.' using errcode = '22023';
  end if;
  update public.informes_interventoria set recomendacion = nullif(p_recomendacion, ''), motivo = nullif(btrim(coalesce(p_motivo, '')), '') where id = p_informe;
exception when check_violation then
  raise exception 'El motivo es demasiado largo (máximo 4000 caracteres).' using errcode = '22023';
end;
$$;

-- Firma el director de interventoría; con la firma el informe queda inmutable.
create function public.informe_firmar(p_informe uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare i public.informes_interventoria;
begin
  select * into i from public.informes_interventoria where id = p_informe for update;
  if not found then raise exception 'Informe no encontrado.' using errcode = '22023'; end if;
  if auth.uid() is null or not exists (
      select 1 from public.mis_alcances(i.proyecto_id) m join public.interventoria_usuarios u on u.alcance_id = m.id and u.usuario_id = auth.uid()
      where m.id = i.alcance_id and u.subrol = 'director') then
    raise exception 'Solo el director de interventoría de esta asignación firma el informe.' using errcode = '42501';
  end if;
  if i.estado = 'firmado' then raise exception 'El informe ya está firmado.' using errcode = '22023'; end if;
  if i.tipo = 'periodico' and (i.recomendacion is null or nullif(btrim(coalesce(i.motivo, '')), '') is null) then
    raise exception 'Antes de firmar, completa la recomendación y su motivo.' using errcode = '22023';
  end if;
  update public.informes_interventoria set estado = 'firmado', firmado_por = auth.uid(), fecha_firma = now() where id = p_informe;
end;
$$;

-- 8. PERMISOS DE EJECUCIÓN -----------------------------------------------------------------------------------------------
revoke execute on function
  public.festivo_guardar(date, text, boolean),
  public.interventoria_alcance_guardar(uuid, uuid, uuid, uuid, text[], date, date), public.interventoria_usuario_asignar(uuid, uuid, text),
  public.interventoria_asignacion_quitar(uuid, uuid),
  public.concepto_emitir(uuid, text, text, uuid, text, text),
  public.hallazgo_crear(uuid, uuid, text, text, uuid[]), public.hallazgos_escalar(uuid), public.hallazgo_responder(uuid, text),
  public.hallazgo_cerrar(uuid), public.hallazgo_reabrir(uuid),
  public.revision_diseno_crear(uuid, uuid, text, text, text), public.diseno_marcar_listo(uuid, boolean),
  public.evaluacion_proveedor_crear(uuid, uuid, text, jsonb, text, text), public.asesoria_crear(uuid, text, text, text, text, text),
  public.informe_crear(uuid, uuid, text, text, uuid, jsonb), public.informe_guardar(uuid, text, text), public.informe_firmar(uuid)
  from public, anon;
grant execute on function
  public.festivo_guardar(date, text, boolean),
  public.interventoria_alcance_guardar(uuid, uuid, uuid, uuid, text[], date, date), public.interventoria_usuario_asignar(uuid, uuid, text),
  public.interventoria_asignacion_quitar(uuid, uuid),
  public.concepto_emitir(uuid, text, text, uuid, text, text),
  public.hallazgo_crear(uuid, uuid, text, text, uuid[]), public.hallazgos_escalar(uuid), public.hallazgo_responder(uuid, text),
  public.hallazgo_cerrar(uuid), public.hallazgo_reabrir(uuid),
  public.revision_diseno_crear(uuid, uuid, text, text, text), public.diseno_marcar_listo(uuid, boolean),
  public.evaluacion_proveedor_crear(uuid, uuid, text, jsonb, text, text), public.asesoria_crear(uuid, text, text, text, text, text),
  public.informe_crear(uuid, uuid, text, text, uuid, jsonb), public.informe_guardar(uuid, text, text), public.informe_firmar(uuid)
  to authenticated;
revoke execute on function public.pascua(integer), public.al_lunes(date), public.festivos_colombia(integer), public.contrato_con_interventoria(uuid),
  public.concepto_permitido(text, text), public.concepto_alcances(text), public.hoy_co() from public, anon;
grant execute on function public.contrato_con_interventoria(uuid), public.concepto_permitido(text, text), public.concepto_alcances(text), public.hoy_co() to authenticated;

    $m0014$;
    insert into public.migraciones_aplicadas (nombre) values ('0014_interventoria.sql') on conflict do nothing;
  end if;
end $mig$;

-- 0015_hallazgos_global.sql
do $mig$ begin
  if not exists (select 1 from public.migraciones_aplicadas where nombre = '0015_hallazgos_global.sql') then
    execute $m0015$
-- Escalamiento de hallazgos vencidos en todos los proyectos que el usuario ve (se usa al abrir el dashboard).
create function public.hallazgos_escalar_todos()
returns integer language plpgsql security definer set search_path = ''
as $$
declare n integer;
begin
  if auth.uid() is null then return 0; end if;
  update public.hallazgos set estado = 'escalado', escalado_en = now()
    where estado = 'abierto' and plazo_respuesta < public.hoy_co()
      and (public.puede_ver_proyecto(proyecto_id) or public.es_interventor(proyecto_id));
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.hallazgos_escalar_todos() from public, anon;
grant execute on function public.hallazgos_escalar_todos() to authenticated;

    $m0015$;
    insert into public.migraciones_aplicadas (nombre) values ('0015_hallazgos_global.sql') on conflict do nothing;
  end if;
end $mig$;

select nombre, aplicada_en from public.migraciones_aplicadas order by nombre;
