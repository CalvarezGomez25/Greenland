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
