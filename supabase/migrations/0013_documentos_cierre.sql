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
