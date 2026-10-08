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
