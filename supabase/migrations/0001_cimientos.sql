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
