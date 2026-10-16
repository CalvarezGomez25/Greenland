-- 0023: correo y teléfono en los interesados, y directorio de contactos reutilizable entre proyectos.
--
-- Idea: cada interesado de un proyecto guarda su correo y teléfono. Al guardarlo, la base de datos lo
-- vincula con un contacto del directorio (lo crea si no existe). En un proyecto nuevo se elige el contacto del
-- directorio y se rellenan sus datos. Poder, interés y necesidades NO se copian: cambian en cada proyecto.

-- 1. DIRECTORIO ---------------------------------------------------------------------
create table public.contactos (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null check (length(btrim(nombre)) between 1 and 200),
  rol            text check (length(rol) <= 200),
  correo         text check (length(correo) <= 200 and correo ~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$'),
  telefono       text check (telefono ~ '^[0-9+() .-]{6,40}$'),
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
-- Un correo identifica a una sola persona; sin correo, el nombre (sin distinguir mayúsculas).
create unique index contactos_correo_uq on public.contactos (lower(correo)) where correo is not null;
create unique index contactos_nombre_sin_correo_uq on public.contactos (lower(btrim(nombre))) where correo is null;

-- Quién usa el directorio: administrador, director general, analista PMO y quien sea gerente de algún proyecto.
create function public.puede_usar_directorio()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce(public.mi_rol_global() in ('administrador', 'director_general', 'analista_pmo'), false)
      or exists (select 1 from public.miembros_proyecto where usuario_id = auth.uid() and rol = 'gerente');
$$;
revoke execute on function public.puede_usar_directorio() from public, anon;
grant execute on function public.puede_usar_directorio() to authenticated;

alter table public.contactos enable row level security;
revoke all on public.contactos from anon, authenticated;
grant select, insert, update, delete on public.contactos to authenticated;
create policy contactos_ver    on public.contactos for select to authenticated using (public.puede_usar_directorio());
create policy contactos_crear  on public.contactos for insert to authenticated with check (public.puede_usar_directorio());
create policy contactos_editar on public.contactos for update to authenticated
  using (public.puede_usar_directorio()) with check (public.puede_usar_directorio());
create policy contactos_borrar on public.contactos for delete to authenticated using (public.es_admin());

create function public.contactos_actualizado()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.nombre := btrim(new.nombre);
  new.rol := nullif(btrim(coalesce(new.rol, '')), '');
  new.correo := lower(nullif(btrim(coalesce(new.correo, '')), ''));
  new.telefono := nullif(btrim(coalesce(new.telefono, '')), '');
  new.actualizado_en := now();
  return new;
end;
$$;
create trigger contactos_actualizado before insert or update on public.contactos
  for each row execute function public.contactos_actualizado();

-- 2. INTERESADOS: correo, teléfono y vínculo con el directorio ------------------------
alter table public.stakeholders
  add column correo      text check (length(correo) <= 200 and correo ~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$'),
  add column telefono    text check (telefono ~ '^[0-9+() .-]{6,40}$'),
  add column contacto_id uuid references public.contactos (id) on delete set null;
create index stakeholders_contacto_idx on public.stakeholders (contacto_id);

-- Al guardar un interesado (alta o cambio de nombre, rol, correo o teléfono): se normalizan los datos y se
-- vincula con su contacto del directorio. Si no existe, se crea. Se busca por correo y, sin correo, por nombre.
-- Lo que llega vacío no borra lo que el directorio ya tiene. Corre con permisos propios porque el directorio
-- tiene reglas de acceso distintas a las del proyecto; la regla de quién puede guardar el interesado
-- (gerente del proyecto o administrador) la sigue imponiendo la tabla de interesados.
create function public.interesado_vincular_contacto()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v uuid;
begin
  new.nombre := btrim(new.nombre);
  new.rol := nullif(btrim(coalesce(new.rol, '')), '');
  new.correo := lower(nullif(btrim(coalesce(new.correo, '')), ''));
  new.telefono := nullif(btrim(coalesce(new.telefono, '')), '');

  if new.correo is not null then
    select id into v from public.contactos where lower(correo) = new.correo;
  else
    select id into v from public.contactos where lower(btrim(nombre)) = lower(new.nombre)
      order by creado_en limit 1;
  end if;

  if v is null then
    insert into public.contactos (nombre, rol, correo, telefono)
      values (new.nombre, new.rol, new.correo, new.telefono)
      on conflict do nothing
      returning id into v;
    if v is null then -- otra sesión lo creó en el mismo instante
      select id into v from public.contactos
        where (new.correo is not null and lower(correo) = new.correo)
           or (new.correo is null and correo is null and lower(btrim(nombre)) = lower(new.nombre))
        limit 1;
    end if;
  else
    update public.contactos set
      nombre = new.nombre,
      rol = coalesce(new.rol, rol),
      correo = coalesce(new.correo, correo),
      telefono = coalesce(new.telefono, telefono)
    where id = v;
  end if;

  new.contacto_id := v;
  return new;
end;
$$;
create trigger interesado_vincular_contacto
  before insert or update of nombre, rol, correo, telefono on public.stakeholders
  for each row execute function public.interesado_vincular_contacto();

-- 3. Interesados que ya existían: se incorporan al directorio -----------------------------
update public.stakeholders set nombre = nombre;
