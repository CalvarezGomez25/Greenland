-- 0020: el presupuesto puede construirse sobre la EDT.
--  - Un capítulo puede ligarse (opcionalmente) a un elemento de la EDT.
--  - «Capítulos desde la EDT»: crea (o liga, si ya existe uno con el mismo nombre) los capítulos de los elementos de un nivel.
--  - Los capítulos ligados a la EDT no se borran aunque queden sin partidas.
--  - Una tarea ligada a un elemento de la EDT hereda el capítulo del elemento (o de su ancestro más cercano con capítulo).

alter table public.wbs_elementos add constraint wbs_elementos_id_proyecto_unico unique (id, proyecto_id);
alter table public.capitulos add column wbs_id uuid;
alter table public.capitulos add constraint capitulos_wbs_fk
  foreign key (wbs_id, proyecto_id) references public.wbs_elementos (id, proyecto_id) on delete set null (wbs_id);
create unique index capitulos_wbs_unico on public.capitulos (wbs_id) where wbs_id is not null;

-- Los capítulos ligados a la EDT se conservan aunque no tengan partidas.
create or replace function public.limpiar_capitulos_vacios(p_proyecto uuid)
returns void language sql security definer set search_path = ''
as $$
  delete from public.capitulos c
   where c.proyecto_id = p_proyecto
     and c.wbs_id is null
     and not exists (select 1 from public.apu_partidas a where a.capitulo_id = c.id);
$$;

-- Capítulo que le corresponde a un elemento de la EDT: el suyo o el del ancestro más cercano que tenga uno.
create function public.capitulo_de_wbs(p_wbs uuid, p_proyecto uuid)
returns uuid language sql stable security definer set search_path = ''
as $$
  with recursive subida as (
    select w.id, w.padre_id, 0 as nivel from public.wbs_elementos w where w.id = p_wbs and w.proyecto_id = p_proyecto
    union all
    select w.id, w.padre_id, s.nivel + 1 from public.wbs_elementos w join subida s on w.id = s.padre_id where s.nivel < 60
  )
  select c.id from subida s join public.capitulos c on c.wbs_id = s.id and c.proyecto_id = p_proyecto
  order by s.nivel limit 1;
$$;
revoke execute on function public.capitulo_de_wbs(uuid, uuid) from public, anon, authenticated;

-- Las tareas con EDT y sin capítulo toman el capítulo de su elemento.
create function public.tareas_capitulo_desde_edt()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v uuid;
begin
  if new.wbs_id is not null and (
       (tg_op = 'INSERT' and new.capitulo_id is null)
       or (tg_op = 'UPDATE' and new.wbs_id is distinct from old.wbs_id and new.capitulo_id is not distinct from old.capitulo_id)) then
    v := public.capitulo_de_wbs(new.wbs_id, new.proyecto_id);
    if v is not null then new.capitulo_id := v; end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.tareas_capitulo_desde_edt() from public, anon, authenticated;
create trigger tareas_capitulo_edt before insert or update of wbs_id, capitulo_id on public.tareas
  for each row execute function public.tareas_capitulo_desde_edt();

-- Tareas que ya existían: se les completa el capítulo al crear o ligar capítulos.
create function public.tareas_heredar_capitulo(p_proyecto uuid)
returns integer language plpgsql security definer set search_path = ''
as $$
declare n integer;
begin
  update public.tareas t set capitulo_id = public.capitulo_de_wbs(t.wbs_id, t.proyecto_id)
   where t.proyecto_id = p_proyecto and t.capitulo_id is null and t.wbs_id is not null
     and public.capitulo_de_wbs(t.wbs_id, t.proyecto_id) is not null;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.tareas_heredar_capitulo(uuid) from public, anon, authenticated;

-- Liga los capítulos que ya existen con los elementos de la EDT que se llaman igual (sin distinguir mayúsculas).
create function public.capitulos_vincular_edt(p_proyecto uuid)
returns integer language plpgsql security definer set search_path = ''
as $$
declare n integer;
begin
  perform public.exigir_edicion_presupuesto(p_proyecto);
  perform set_config('app.motivo', 'Capítulos ligados a la EDT', true);
  update public.capitulos c set wbs_id = w.id
    from public.wbs_elementos w
   where c.proyecto_id = p_proyecto and w.proyecto_id = p_proyecto and c.wbs_id is null
     and lower(btrim(c.nombre)) = lower(btrim(w.nombre))
     and not exists (select 1 from public.capitulos x where x.wbs_id = w.id)
     and w.id = (select min(w2.id::text)::uuid from public.wbs_elementos w2
                  where w2.proyecto_id = p_proyecto and lower(btrim(w2.nombre)) = lower(btrim(c.nombre))
                    and not exists (select 1 from public.capitulos x2 where x2.wbs_id = w2.id));
  get diagnostics n = row_count;
  perform public.tareas_heredar_capitulo(p_proyecto);
  return n;
end;
$$;

-- Crea los capítulos de los elementos de la EDT de un nivel (0 = raíz, 1 = hijos de la raíz, 2 = nietos…).
-- Si ya hay un capítulo con ese nombre, se liga en vez de duplicarlo. Devuelve cuántos se crearon, ligaron u omitieron.
create function public.capitulos_desde_edt(p_proyecto uuid, p_nivel integer)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  w record; v_cap uuid; v_codigo text; v_orden integer;
  v_creados integer := 0; v_ligados integer := 0; v_omitidos integer := 0;
begin
  perform public.exigir_edicion_presupuesto(p_proyecto);
  if p_nivel is null or p_nivel < 0 or p_nivel > 6 then
    raise exception 'El nivel de la EDT debe estar entre 0 y 6.' using errcode = '22023';
  end if;
  perform set_config('app.motivo', 'Capítulos creados desde la EDT', true);
  for w in
    with recursive arbol as (
      select e.id, e.codigo, e.nombre, e.padre_id, 0 as nivel from public.wbs_elementos e where e.proyecto_id = p_proyecto and e.padre_id is null
      union all
      select e.id, e.codigo, e.nombre, e.padre_id, a.nivel + 1 from public.wbs_elementos e join arbol a on e.padre_id = a.id where a.nivel < 6
    )
    select * from arbol a
     where a.nivel = p_nivel and not exists (select 1 from public.capitulos c where c.wbs_id = a.id)
     order by string_to_array(a.codigo, '.')::int[]
  loop
    select id into v_cap from public.capitulos
     where proyecto_id = p_proyecto and lower(btrim(nombre)) = lower(btrim(w.nombre));
    if v_cap is not null then
      update public.capitulos set wbs_id = w.id where id = v_cap and wbs_id is null;
      if found then v_ligados := v_ligados + 1; else v_omitidos := v_omitidos + 1; end if;
    else
      select coalesce(max(orden), 0) + 1 into v_orden from public.capitulos where proyecto_id = p_proyecto;
      v_codigo := w.codigo;
      while exists (select 1 from public.capitulos where proyecto_id = p_proyecto and codigo = v_codigo) loop
        v_codigo := v_orden::text; v_orden := v_orden + 1;
      end loop;
      select coalesce(max(orden), 0) + 1 into v_orden from public.capitulos where proyecto_id = p_proyecto;
      insert into public.capitulos (proyecto_id, codigo, nombre, orden, wbs_id)
        values (p_proyecto, v_codigo, btrim(w.nombre), v_orden, w.id);
      v_creados := v_creados + 1;
    end if;
  end loop;
  perform public.tareas_heredar_capitulo(p_proyecto);
  return jsonb_build_object('creados', v_creados, 'ligados', v_ligados, 'omitidos', v_omitidos);
end;
$$;

revoke execute on function public.capitulos_vincular_edt(uuid), public.capitulos_desde_edt(uuid, integer) from public, anon;
grant execute on function public.capitulos_vincular_edt(uuid), public.capitulos_desde_edt(uuid, integer) to authenticated;
