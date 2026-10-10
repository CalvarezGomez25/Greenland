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
