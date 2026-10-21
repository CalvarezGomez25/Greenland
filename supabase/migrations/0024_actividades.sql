-- 0024: Actividades. Trabajo asignado a personas del proyecto, con responsable, fecha límite y estado.
--
-- Idea: hasta ahora el responsable de la EDT y de los riesgos era texto libre y no había dónde repartir el trabajo
-- diario. Una actividad tiene un responsable real (una persona con cuenta), una fecha límite y un estado
-- (por hacer, en curso, bloqueada, hecha). Puede ligarse a un riesgo (por ejemplo, la acción de su plan de
-- respuesta) y a un elemento de la EDT. No toca las tareas del cronograma: esas tienen peso y alimentan el valor ganado.
--
-- Quién puede qué:
--   - Ven todo el proyecto: quienes ya ven el proyecto (administrador, director general, analista PMO, finanzas,
--     equipo del proyecto).
--   - Crean, editan y borran: administrador, gerente del proyecto, director general y analista PMO.
--   - La persona responsable puede cambiar el ESTADO de su actividad (y nada más).
--   - Interventoría: ve solo las actividades que le asignaron o que creó; crea actividades para sí misma
--     (sin ligarlas a riesgos, que ella no ve), edita y borra las que creó, y cambia el estado de las que le asignaron.

-- 1. TABLA -------------------------------------------------------------------------------------------------
create table public.actividades (
  id             uuid primary key default gen_random_uuid(),
  proyecto_id    uuid not null references public.proyectos (id) on delete cascade,
  titulo         text not null check (length(btrim(titulo)) between 1 and 200),
  descripcion    text check (length(descripcion) <= 4000),
  responsable_id uuid references public.perfiles (id) on delete set null,
  fecha_limite   date,
  prioridad      text not null default 'media' check (prioridad in ('alta', 'media', 'baja')),
  estado         text not null default 'por_hacer' check (estado in ('por_hacer', 'en_curso', 'bloqueada', 'hecha')),
  riesgo_id      uuid references public.riesgos (id) on delete set null,
  wbs_id         uuid references public.wbs_elementos (id) on delete set null,
  creado_por     uuid default auth.uid(),
  completada_en  timestamptz,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index actividades_proyecto_idx on public.actividades (proyecto_id, estado);
create index actividades_responsable_idx on public.actividades (responsable_id) where estado <> 'hecha';

-- 2. PERMISOS ----------------------------------------------------------------------------------------------
create function public.puede_gestionar_actividades(p_proyecto uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.puede_gestionar(p_proyecto)
      or coalesce(public.mi_rol_global() in ('director_general', 'analista_pmo'), false);
$$;
revoke execute on function public.puede_gestionar_actividades(uuid) from public, anon;
grant execute on function public.puede_gestionar_actividades(uuid) to authenticated;

-- 3. REGLAS DE DATOS -----------------------------------------------------------------------------------------
-- Valida responsable y ligas, fija quién creó la actividad, marca cuándo se completó y limita lo que puede
-- cambiar quien solo es responsable (únicamente el estado).
create function public.actividades_validar()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  new.titulo := btrim(new.titulo);
  new.actualizado_en := now();

  if new.responsable_id is not null and (tg_op = 'INSERT' or new.responsable_id is distinct from old.responsable_id) then
    if not exists (select 1 from public.miembros_proyecto where proyecto_id = new.proyecto_id and usuario_id = new.responsable_id)
       and not exists (select 1 from public.perfiles where id = new.responsable_id
                         and rol_global in ('administrador', 'director_general', 'analista_pmo')) then
      raise exception 'El responsable debe ser parte del equipo del proyecto.' using errcode = '22023';
    end if;
  end if;
  if new.riesgo_id is not null and not exists (select 1 from public.riesgos where id = new.riesgo_id and proyecto_id = new.proyecto_id) then
    raise exception 'El riesgo no pertenece a este proyecto.' using errcode = '22023';
  end if;
  if new.wbs_id is not null and not exists (select 1 from public.wbs_elementos where id = new.wbs_id and proyecto_id = new.proyecto_id) then
    raise exception 'El elemento de la EDT no pertenece a este proyecto.' using errcode = '22023';
  end if;

  if tg_op = 'INSERT' then
    new.creado_por := auth.uid();
  else
    if new.proyecto_id is distinct from old.proyecto_id or new.creado_por is distinct from old.creado_por then
      raise exception 'No se puede cambiar el proyecto ni quién creó la actividad.' using errcode = '22023';
    end if;
    -- Quien no gestiona solo cambia el estado (salvo la interventoría con sus propias actividades).
    if auth.uid() is not null and not public.puede_gestionar_actividades(old.proyecto_id)
       and not (old.creado_por = auth.uid() and public.es_interventor(old.proyecto_id)
                and new.responsable_id = auth.uid() and new.riesgo_id is null)
       and (to_jsonb(new) - 'estado' - 'completada_en' - 'actualizado_en') is distinct from (to_jsonb(old) - 'estado' - 'completada_en' - 'actualizado_en') then
      raise exception 'Solo puedes cambiar el estado de tus actividades.' using errcode = '42501';
    end if;
  end if;

  if new.estado = 'hecha' then
    if tg_op = 'INSERT' or old.estado <> 'hecha' then new.completada_en := now(); else new.completada_en := old.completada_en; end if;
  else
    new.completada_en := null;
  end if;
  return new;
end;
$$;
create trigger actividades_validar before insert or update on public.actividades
  for each row execute function public.actividades_validar();
create trigger actividades_audit after insert or update or delete on public.actividades
  for each row execute function public.auditar_tabla();

-- 4. SEGURIDAD POR FILAS --------------------------------------------------------------------------------------
alter table public.actividades enable row level security;
revoke all on public.actividades from anon, authenticated;
grant select, insert, update, delete on public.actividades to authenticated;

create policy actividades_ver on public.actividades for select to authenticated using (
  public.puede_ver_proyecto(proyecto_id)
  or (public.es_interventor(proyecto_id) and (responsable_id = auth.uid() or creado_por = auth.uid())));
create policy actividades_crear on public.actividades for insert to authenticated with check (
  public.puede_gestionar_actividades(proyecto_id)
  or (public.es_interventor(proyecto_id) and responsable_id = auth.uid() and riesgo_id is null));
create policy actividades_editar on public.actividades for update to authenticated
  using (public.puede_gestionar_actividades(proyecto_id)
    or (responsable_id = auth.uid() and (public.puede_ver_proyecto(proyecto_id) or public.es_interventor(proyecto_id))))
  with check (public.puede_gestionar_actividades(proyecto_id)
    or (responsable_id = auth.uid() and (public.puede_ver_proyecto(proyecto_id) or public.es_interventor(proyecto_id))));
create policy actividades_borrar on public.actividades for delete to authenticated using (
  public.puede_gestionar_actividades(proyecto_id)
  or (creado_por = auth.uid() and responsable_id = auth.uid() and public.es_interventor(proyecto_id)));
