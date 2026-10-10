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
