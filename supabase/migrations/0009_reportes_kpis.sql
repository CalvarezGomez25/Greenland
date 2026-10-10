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
