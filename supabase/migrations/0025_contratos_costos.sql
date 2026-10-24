-- 0025: integración de contratos y costos.
--
-- 1. Costos indirectos (A.I.U.): cada línea de `costos_adicionales` recibe una categoría (administración,
--    imprevistos, utilidad, impuestos u otro). El nombre de la tabla se conserva por compatibilidad: en la
--    plataforma estos son los COSTOS INDIRECTOS, y no deben confundirse con los ADICIONALES DE OBRA.
-- 2. Adicionales de obra: trabajos que no estaban contemplados en la EDT original o que llegaron como añadidura
--    durante la ejecución. Son un concepto distinto de los costos indirectos; se aprueban por el control de cambios.
-- 3. Asignación de contratos al presupuesto: cada contrato reparte su valor entre capítulos del presupuesto y/o
--    adicionales, para poder comparar lo presupuestado con lo contratado y lo facturado.

-- 1. COSTOS INDIRECTOS (A.I.U.) ---------------------------------------------------------
alter table public.costos_adicionales
  add column categoria text not null default 'otro'
    check (categoria in ('administracion', 'imprevistos', 'utilidad', 'impuestos', 'otro'));
update public.costos_adicionales set categoria = case
  when lower(btrim(nombre)) like 'admin%' then 'administracion'
  when lower(btrim(nombre)) like 'imprevisto%' then 'imprevistos'
  when lower(btrim(nombre)) like 'utilidad%' then 'utilidad'
  when lower(btrim(nombre)) like 'iva%' or lower(btrim(nombre)) like 'rete%' then 'impuestos'
  else 'otro' end;
comment on table public.costos_adicionales is
  'Costos indirectos (A.I.U.) e impuestos del presupuesto, como porcentajes. No son los adicionales de obra (tabla adicionales).';

-- La función de guardado gana el parámetro de categoría (se reemplaza la anterior).
drop function public.costo_adicional_guardar(uuid, uuid, text, text, uuid, numeric, text);
create function public.costo_adicional_guardar(
  p_proyecto uuid, p_id uuid, p_nombre text, p_base text, p_linea_base uuid,
  p_porcentaje numeric, p_motivo text default null, p_categoria text default 'otro'
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
  if p_categoria is null or p_categoria not in ('administracion', 'imprevistos', 'utilidad', 'impuestos', 'otro') then
    raise exception 'Elige el tipo de costo: administración, imprevistos, utilidad, impuestos u otro.' using errcode = '22023';
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
    insert into public.costos_adicionales (proyecto_id, nombre, base, linea_base_id, porcentaje, orden, categoria)
    values (p_proyecto, v_nombre, p_base, v_base_linea, p_porcentaje, v_orden, p_categoria)
    returning id into v_id;
  else
    update public.costos_adicionales
       set nombre = v_nombre, base = p_base, linea_base_id = v_base_linea, porcentaje = p_porcentaje, categoria = p_categoria
     where id = p_id and proyecto_id = p_proyecto
    returning id into v_id;
    if v_id is null then
      raise exception 'La línea no existe en este proyecto.' using errcode = '22023';
    end if;
  end if;
  return v_id;
end;
$$;

-- La plantilla de costos indirectos deja cada línea con su categoría.
create or replace function public.costos_adicionales_plantilla(p_proyecto uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_utilidad uuid;
begin
  perform public.exigir_edicion_presupuesto(p_proyecto);
  perform public.fijar_motivo('Plantilla inicial de costos adicionales', false);

  if exists (select 1 from public.costos_adicionales where proyecto_id = p_proyecto) then
    raise exception 'Este proyecto ya tiene costos adicionales.' using errcode = '22023';
  end if;

  insert into public.costos_adicionales (proyecto_id, nombre, base, porcentaje, orden, categoria)
  values (p_proyecto, 'Administración', 'costo_directo', 0, 1, 'administracion'),
         (p_proyecto, 'Imprevistos',    'costo_directo', 0, 2, 'imprevistos');
  insert into public.costos_adicionales (proyecto_id, nombre, base, porcentaje, orden, categoria)
  values (p_proyecto, 'Utilidad', 'costo_directo', 0, 3, 'utilidad')
  returning id into v_utilidad;
  insert into public.costos_adicionales (proyecto_id, nombre, base, linea_base_id, porcentaje, orden, categoria)
  values (p_proyecto, 'IVA sobre la utilidad', 'linea', v_utilidad, 0, 4, 'impuestos');
  insert into public.costos_adicionales (proyecto_id, nombre, base, porcentaje, orden, categoria)
  values (p_proyecto, 'Retefuente', 'costo_directo', 0, 5, 'impuestos');
end;
$$;

-- 2. ADICIONALES DE OBRA -----------------------------------------------------------------
create table public.adicionales (
  id                uuid primary key default gen_random_uuid(),
  proyecto_id       uuid not null references public.proyectos (id) on delete cascade,
  codigo            text not null,
  descripcion       text not null check (length(btrim(descripcion)) between 1 and 500),
  origen            text not null check (origen in ('no_contemplado', 'anadidura')),
  wbs_id            uuid,
  valor_directo     numeric(15, 2) not null check (valor_directo >= 0),
  aplica_indirectos boolean not null default true,
  cambio_id         uuid references public.cambios (id) on delete set null,
  nota              text check (length(nota) <= 1000),
  creado_por        uuid default auth.uid(),
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),
  unique (id, proyecto_id),
  unique (proyecto_id, codigo),
  foreign key (wbs_id, proyecto_id) references public.wbs_elementos (id, proyecto_id) on delete set null (wbs_id)
);
create index adicionales_proyecto_idx on public.adicionales (proyecto_id);
create trigger adicionales_actualizado before update on public.adicionales
  for each row execute function public.marcar_actualizado();
create trigger adicionales_audit after insert or update or delete on public.adicionales
  for each row execute function public.auditar_tabla();
comment on table public.adicionales is
  'Adicionales de obra: trabajos no contemplados en la EDT original o añadidos durante la ejecución. Su estado sale del cambio ligado.';

-- 3. ASIGNACIÓN DE CONTRATOS AL PRESUPUESTO ---------------------------------------------
create table public.contrato_asignaciones (
  id             uuid primary key default gen_random_uuid(),
  contrato_id    uuid not null references public.contratos (id) on delete cascade,
  proyecto_id    uuid not null references public.proyectos (id) on delete cascade,
  capitulo_id    uuid references public.capitulos (id) on delete restrict,
  adicional_id   uuid references public.adicionales (id) on delete restrict,
  valor          numeric(15, 2) not null check (valor > 0),
  creado_por     uuid default auth.uid(),
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check (num_nonnulls(capitulo_id, adicional_id) = 1),
  unique (contrato_id, capitulo_id),
  unique (contrato_id, adicional_id)
);
create index contrato_asignaciones_proyecto_idx on public.contrato_asignaciones (proyecto_id);
create index contrato_asignaciones_capitulo_idx on public.contrato_asignaciones (capitulo_id);
create index contrato_asignaciones_adicional_idx on public.contrato_asignaciones (adicional_id);
create trigger contrato_asignaciones_actualizado before update on public.contrato_asignaciones
  for each row execute function public.marcar_actualizado();
create trigger contrato_asignaciones_audit after insert or update or delete on public.contrato_asignaciones
  for each row execute function public.auditar_tabla();

create function public.pesos_texto(p numeric)
returns text language sql immutable set search_path = ''
as $$ select '$ ' || replace(to_char(p, 'FM999,999,999,999,990'), ',', '.'); $$;
revoke execute on function public.pesos_texto(numeric) from public, anon;
grant execute on function public.pesos_texto(numeric) to authenticated;

-- Reglas que no se pueden saltar: todo del mismo proyecto y lo asignado no supera el valor del contrato.
create function public.contrato_asignaciones_validar()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare c record; v_otros numeric;
begin
  select proyecto_id, valor into c from public.contratos where id = new.contrato_id;
  if not found or c.proyecto_id is distinct from new.proyecto_id then
    raise exception 'El contrato no pertenece a este proyecto.' using errcode = '22023';
  end if;
  if new.capitulo_id is not null and not exists (select 1 from public.capitulos where id = new.capitulo_id and proyecto_id = new.proyecto_id) then
    raise exception 'El capítulo no pertenece a este proyecto.' using errcode = '22023';
  end if;
  if new.adicional_id is not null and not exists (select 1 from public.adicionales where id = new.adicional_id and proyecto_id = new.proyecto_id) then
    raise exception 'El adicional no pertenece a este proyecto.' using errcode = '22023';
  end if;
  select coalesce(sum(valor), 0) into v_otros from public.contrato_asignaciones
   where contrato_id = new.contrato_id and id is distinct from new.id;
  if v_otros + new.valor > c.valor then
    raise exception 'Lo asignado al presupuesto (%) supera el valor del contrato (%).',
      public.pesos_texto(v_otros + new.valor), public.pesos_texto(c.valor) using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke execute on function public.contrato_asignaciones_validar() from public, anon, authenticated;
create trigger contrato_asignaciones_validar before insert or update on public.contrato_asignaciones
  for each row execute function public.contrato_asignaciones_validar();

-- El valor de un contrato no puede bajar de lo que ya se asignó al presupuesto.
create function public.contrato_valor_vs_asignaciones()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_asignado numeric;
begin
  select coalesce(sum(valor), 0) into v_asignado from public.contrato_asignaciones where contrato_id = new.id;
  if new.valor < v_asignado then
    raise exception 'El valor del contrato no puede ser menor que lo ya asignado al presupuesto (%).', public.pesos_texto(v_asignado)
      using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke execute on function public.contrato_valor_vs_asignaciones() from public, anon, authenticated;
create trigger contratos_valor_vs_asignaciones before update of valor on public.contratos
  for each row execute function public.contrato_valor_vs_asignaciones();

-- Lectura: quien ve el presupuesto del proyecto (la interventoría no). Escritura: solo por las funciones.
alter table public.adicionales enable row level security;
alter table public.contrato_asignaciones enable row level security;
revoke all on public.adicionales, public.contrato_asignaciones from anon, authenticated;
grant select on public.adicionales, public.contrato_asignaciones to authenticated;
create policy adicionales_ver on public.adicionales for select to authenticated using (public.puede_ver_proyecto(proyecto_id));
create policy contrato_asignaciones_ver on public.contrato_asignaciones for select to authenticated using (public.puede_ver_proyecto(proyecto_id));

-- Funciones de escritura -------------------------------------------------------------------
create function public.adicional_guardar(
  p_proyecto uuid, p_id uuid, p_descripcion text, p_origen text, p_valor numeric,
  p_aplica_indirectos boolean, p_wbs uuid, p_cambio uuid, p_nota text default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_desc text := btrim(coalesce(p_descripcion, ''));
  v_nota text := nullif(btrim(coalesce(p_nota, '')), '');
  v_id uuid;
begin
  perform public.exigir_edicion_presupuesto(p_proyecto);
  if v_desc = '' or length(v_desc) > 500 then
    raise exception 'La descripción es obligatoria (máximo 500 caracteres).' using errcode = '22023';
  end if;
  if p_origen is null or p_origen not in ('no_contemplado', 'anadidura') then
    raise exception 'Indica si no estaba contemplado en la EDT o si llegó como añadidura durante la ejecución.' using errcode = '22023';
  end if;
  if p_valor is null or p_valor < 0 or p_valor <> round(p_valor, 2) or p_valor >= 10000000000000 then
    raise exception 'El valor debe ser un número de cero en adelante, con máximo 2 decimales.' using errcode = '22023';
  end if;
  if v_nota is not null and length(v_nota) > 1000 then
    raise exception 'La nota admite máximo 1.000 caracteres.' using errcode = '22023';
  end if;
  if p_wbs is not null and not exists (select 1 from public.wbs_elementos where id = p_wbs and proyecto_id = p_proyecto) then
    raise exception 'El elemento de la EDT no existe en este proyecto.' using errcode = '22023';
  end if;
  if p_cambio is not null and not exists (select 1 from public.cambios where id = p_cambio and proyecto_id = p_proyecto) then
    raise exception 'El cambio no existe en este proyecto.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.adicionales (proyecto_id, codigo, descripcion, origen, wbs_id, valor_directo, aplica_indirectos, cambio_id, nota)
    values (p_proyecto, 'AD-' || lpad(public.siguiente_consecutivo(p_proyecto, 'adicional')::text, 3, '0'),
            v_desc, p_origen, p_wbs, p_valor, coalesce(p_aplica_indirectos, true), p_cambio, v_nota)
    returning id into v_id;
  else
    update public.adicionales
       set descripcion = v_desc, origen = p_origen, wbs_id = p_wbs, valor_directo = p_valor,
           aplica_indirectos = coalesce(p_aplica_indirectos, true), cambio_id = p_cambio, nota = v_nota
     where id = p_id and proyecto_id = p_proyecto
    returning id into v_id;
    if v_id is null then raise exception 'El adicional no existe en este proyecto.' using errcode = '22023'; end if;
  end if;
  return v_id;
end;
$$;

create function public.adicional_borrar(p_adicional uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_proyecto uuid;
begin
  select proyecto_id into v_proyecto from public.adicionales where id = p_adicional;
  if v_proyecto is null then raise exception 'El adicional no existe.' using errcode = '22023'; end if;
  perform public.exigir_edicion_presupuesto(v_proyecto);
  if exists (select 1 from public.contrato_asignaciones where adicional_id = p_adicional) then
    raise exception 'Hay contratos asignados a este adicional. Quita primero esas asignaciones.' using errcode = '22023';
  end if;
  delete from public.adicionales where id = p_adicional;
end;
$$;

-- Asigna (o corrige) la parte de un contrato que corresponde a un capítulo o a un adicional.
create function public.contrato_asignar(p_contrato uuid, p_capitulo uuid, p_adicional uuid, p_valor numeric)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_proyecto uuid; v_id uuid;
begin
  select proyecto_id into v_proyecto from public.contratos where id = p_contrato;
  if v_proyecto is null then raise exception 'El contrato no existe.' using errcode = '22023'; end if;
  perform public.exigir_edicion_presupuesto(v_proyecto);
  if num_nonnulls(p_capitulo, p_adicional) <> 1 then
    raise exception 'Elige un capítulo o un adicional (solo uno).' using errcode = '22023';
  end if;
  if p_valor is null or p_valor <= 0 or p_valor <> round(p_valor, 2) or p_valor >= 10000000000000 then
    raise exception 'El valor asignado debe ser mayor que cero, con máximo 2 decimales.' using errcode = '22023';
  end if;
  -- Si ya hay una asignación a ese capítulo o adicional, se corrige su valor; si no, se crea.
  select id into v_id from public.contrato_asignaciones
   where contrato_id = p_contrato and capitulo_id is not distinct from p_capitulo and adicional_id is not distinct from p_adicional;
  if v_id is not null then
    update public.contrato_asignaciones set valor = p_valor where id = v_id;
  else
    insert into public.contrato_asignaciones (contrato_id, proyecto_id, capitulo_id, adicional_id, valor)
    values (p_contrato, v_proyecto, p_capitulo, p_adicional, p_valor)
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

create function public.contrato_asignacion_borrar(p_asignacion uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_proyecto uuid;
begin
  select proyecto_id into v_proyecto from public.contrato_asignaciones where id = p_asignacion;
  if v_proyecto is null then raise exception 'La asignación no existe.' using errcode = '22023'; end if;
  perform public.exigir_edicion_presupuesto(v_proyecto);
  delete from public.contrato_asignaciones where id = p_asignacion;
end;
$$;

revoke execute on function
  public.adicional_guardar(uuid, uuid, text, text, numeric, boolean, uuid, uuid, text),
  public.adicional_borrar(uuid),
  public.contrato_asignar(uuid, uuid, uuid, numeric),
  public.contrato_asignacion_borrar(uuid),
  public.costo_adicional_guardar(uuid, uuid, text, text, uuid, numeric, text, text)
  from public, anon, authenticated;
grant execute on function
  public.adicional_guardar(uuid, uuid, text, text, numeric, boolean, uuid, uuid, text),
  public.adicional_borrar(uuid),
  public.contrato_asignar(uuid, uuid, uuid, numeric),
  public.contrato_asignacion_borrar(uuid),
  public.costo_adicional_guardar(uuid, uuid, text, text, uuid, numeric, text, text)
  to authenticated;

-- Los capítulos con contratos asignados no se retiran al limpiar los vacíos.
create or replace function public.limpiar_capitulos_vacios(p_proyecto uuid)
returns void language sql security definer set search_path = ''
as $$
  delete from public.capitulos c
   where c.proyecto_id = p_proyecto
     and c.wbs_id is null
     and not exists (select 1 from public.apu_partidas a where a.capitulo_id = c.id)
     and not exists (select 1 from public.contrato_asignaciones x where x.capitulo_id = c.id);
$$;

-- La importación del presupuesto conserva las asignaciones de contratos (se religan por nombre de capítulo).
create or replace function public.presupuesto_importar(p_proyecto uuid, p_filas jsonb, p_motivo text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_motivo   text;
  v_fila     record;
  v_dup      text;
  v_antes    jsonb;
  v_despues  jsonb;
  v_perdidos text;
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

  -- Los contratos asignados a capítulos se conservan: se vuelven a ligar por nombre de capítulo.
  -- Si el archivo ya no trae un capítulo que tiene contratos asignados, se corta la importación.
  select string_agg(distinct c.codigo || ' ' || c.nombre, ', ') into v_perdidos
    from public.contrato_asignaciones a join public.capitulos c on c.id = a.capitulo_id
   where a.proyecto_id = p_proyecto
     and lower(btrim(c.nombre)) not in (select lower(btrim(e ->> 'capitulo')) from jsonb_array_elements(p_filas) as t(e));
  if v_perdidos is not null then
    raise exception 'No se puede reemplazar el presupuesto: hay contratos asignados a capítulos que el archivo no trae (%). Quita esas asignaciones o incluye los capítulos.', v_perdidos
      using errcode = '22023';
  end if;
  drop table if exists pg_temp.asignaciones_previas;
  create temporary table asignaciones_previas on commit drop as
    select a.contrato_id, lower(btrim(c.nombre)) as nombre, a.valor, a.creado_por
      from public.contrato_asignaciones a join public.capitulos c on c.id = a.capitulo_id
     where a.proyecto_id = p_proyecto;
  delete from public.contrato_asignaciones where proyecto_id = p_proyecto and capitulo_id is not null;

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

  insert into public.contrato_asignaciones (contrato_id, proyecto_id, capitulo_id, valor, creado_por)
  select p.contrato_id, p_proyecto, nu.id, p.valor, p.creado_por
    from pg_temp.asignaciones_previas p
    join public.capitulos nu on nu.proyecto_id = p_proyecto and lower(btrim(nu.nombre)) = p.nombre;
  drop table pg_temp.asignaciones_previas;

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
