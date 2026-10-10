-- =============================================================================
-- Hito 11 (v2.0): Interventoría (módulo N)
-- La interventoría conceptúa, verifica, observa e informa; no aprueba ni modifica datos del contrato.
-- =============================================================================

-- 0. UTILIDADES: hora de Colombia, Pascua y festivos -----------------------------------------------------
create function public.hoy_co() returns date language sql stable set search_path = ''
as $$ select (now() at time zone 'America/Bogota')::date; $$;

-- Domingo de Pascua (algoritmo de Meeus/Jones/Butcher).
create function public.pascua(p_anio integer) returns date language plpgsql immutable set search_path = ''
as $$
declare
  a integer := p_anio % 19; b integer := p_anio / 100; c integer := p_anio % 100; d integer := b / 4; e integer := b % 4;
  f integer := (b + 8) / 25; g integer := (b - f + 1) / 3; h integer := (19 * a + b - d - g + 15) % 30;
  i integer := c / 4; k integer := c % 4; l integer := (32 + 2 * e + 2 * i - h - k) % 7; m integer := (a + 11 * h + 22 * l) / 451;
begin
  return make_date(p_anio, (h + l - 7 * m + 114) / 31, ((h + l - 7 * m + 114) % 31) + 1);
end;
$$;

-- Si el día no es lunes, pasa al lunes siguiente (Ley 51 de 1983, "ley Emiliani").
create function public.al_lunes(p_fecha date) returns date language sql immutable set search_path = ''
as $$ select p_fecha + case when extract(isodow from p_fecha)::integer = 1 then 0 else 8 - extract(isodow from p_fecha)::integer end; $$;

create table public.festivos (
  fecha  date primary key,
  nombre text not null check (length(btrim(nombre)) between 1 and 100)
);

-- Festivos de Colombia calculados con la regla de la ley (fijos, trasladados al lunes y los de Semana Santa).
-- Conviene confirmarlos cada año con el calendario oficial; el administrador puede agregar o quitar fechas.
create function public.festivos_colombia(p_anio integer)
returns table (fecha date, nombre text) language plpgsql immutable set search_path = ''
as $$
declare p date := public.pascua(p_anio);
begin
  return query values
    (make_date(p_anio, 1, 1), 'Año Nuevo'),
    (public.al_lunes(make_date(p_anio, 1, 6)), 'Reyes Magos'),
    (public.al_lunes(make_date(p_anio, 3, 19)), 'San José'),
    (p - 3, 'Jueves Santo'),
    (p - 2, 'Viernes Santo'),
    (make_date(p_anio, 5, 1), 'Día del Trabajo'),
    (p + 43, 'Ascensión del Señor'),
    (p + 64, 'Corpus Christi'),
    (p + 71, 'Sagrado Corazón'),
    (public.al_lunes(make_date(p_anio, 6, 29)), 'San Pedro y San Pablo'),
    (make_date(p_anio, 7, 20), 'Día de la Independencia'),
    (make_date(p_anio, 8, 7), 'Batalla de Boyacá'),
    (public.al_lunes(make_date(p_anio, 8, 15)), 'Asunción de la Virgen'),
    (public.al_lunes(make_date(p_anio, 10, 12)), 'Día de la Raza'),
    (public.al_lunes(make_date(p_anio, 11, 1)), 'Todos los Santos'),
    (public.al_lunes(make_date(p_anio, 11, 11)), 'Independencia de Cartagena'),
    (make_date(p_anio, 12, 8), 'Inmaculada Concepción'),
    (make_date(p_anio, 12, 25), 'Navidad');
end;
$$;

insert into public.festivos (fecha, nombre)
select f.fecha, f.nombre from generate_series(2026, 2040) as anio, lateral public.festivos_colombia(anio) f
on conflict (fecha) do nothing;

alter table public.festivos enable row level security;
revoke all on public.festivos from anon, authenticated;
grant select on public.festivos to authenticated;
create policy festivos_ver on public.festivos for select to authenticated using (true);
create trigger festivos_audit after insert or update or delete on public.festivos
  for each row execute function public.auditar_tabla();

create function public.festivo_guardar(p_fecha date, p_nombre text, p_quitar boolean default false)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.es_admin() then
    raise exception 'Solo el administrador cambia el calendario de festivos.' using errcode = '42501';
  end if;
  if p_quitar then delete from public.festivos where fecha = p_fecha; return; end if;
  if p_fecha is null or nullif(btrim(coalesce(p_nombre, '')), '') is null then
    raise exception 'Indica la fecha y el nombre del festivo.' using errcode = '22023';
  end if;
  insert into public.festivos (fecha, nombre) values (p_fecha, btrim(p_nombre))
    on conflict (fecha) do update set nombre = excluded.nombre;
exception when check_violation then
  raise exception 'El nombre del festivo es demasiado largo.' using errcode = '22023';
end;
$$;

-- Suma días hábiles (lunes a viernes que no sean festivo).
create function public.dias_habiles_sumar(p_fecha date, p_n integer)
returns date language plpgsql stable security definer set search_path = ''
as $$
declare f date := p_fecha; n integer := 0;
begin
  while n < p_n loop
    f := f + 1;
    if extract(isodow from f)::integer < 6 and not exists (select 1 from public.festivos where fecha = f) then n := n + 1; end if;
  end loop;
  return f;
end;
$$;
revoke execute on function public.dias_habiles_sumar(date, integer) from public, anon;
grant execute on function public.dias_habiles_sumar(date, integer) to authenticated;

-- 1. ASIGNACIÓN ------------------------------------------------------------------------------------------
create table public.interventoria_alcances (
  id                        uuid primary key default gen_random_uuid(),
  proyecto_id               uuid not null references public.proyectos (id) on delete cascade,
  contrato_interventoria_id uuid references public.contratos (id) on delete set null,
  contrato_vigilado_id      uuid references public.contratos (id) on delete cascade,  -- vacío: diseños y asesoría antes de la obra
  alcances                  text[] not null check (cardinality(alcances) > 0
    and alcances <@ array['tecnica','administrativa','financiera','juridica','contable','disenos','asesoria']),
  fecha_inicio              date,
  fecha_fin                 date,
  creado_en                 timestamptz not null default now(),
  check (fecha_fin is null or fecha_inicio is null or fecha_fin >= fecha_inicio)
);
create index interventoria_alcances_idx on public.interventoria_alcances (proyecto_id);

create table public.interventoria_usuarios (
  alcance_id uuid not null references public.interventoria_alcances (id) on delete cascade,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  subrol     text not null check (subrol in ('director', 'tecnico', 'administrativo', 'financiero', 'juridico_contable')),
  primary key (alcance_id, usuario_id)
);
create index interventoria_usuarios_idx on public.interventoria_usuarios (usuario_id);
create trigger interventoria_alcances_audit after insert or update or delete on public.interventoria_alcances
  for each row execute function public.auditar_tabla();
create trigger interventoria_usuarios_audit after insert or update or delete on public.interventoria_usuarios
  for each row execute function public.auditar_tabla();

-- Mis alcances vigentes en un proyecto (solo cuenta quien además es miembro con rol de interventoría).
create function public.mis_alcances(p_proyecto uuid)
returns setof public.interventoria_alcances language sql stable security definer set search_path = ''
as $$
  select a.* from public.interventoria_alcances a
  join public.interventoria_usuarios u on u.alcance_id = a.id and u.usuario_id = auth.uid()
  where a.proyecto_id = p_proyecto
    and exists (select 1 from public.miembros_proyecto m where m.proyecto_id = p_proyecto and m.usuario_id = auth.uid() and m.rol = 'interventoria')
    and (a.fecha_inicio is null or a.fecha_inicio <= public.hoy_co())
    and (a.fecha_fin is null or a.fecha_fin >= public.hoy_co());
$$;

-- Con alguna asignación vigente: ve documentos, revisiones y asesorías del proyecto.
create or replace function public.es_interventor(p_proyecto uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.mis_alcances(p_proyecto)); $$;
-- Con asignación sobre un contrato de obra: además ve cronograma, WBS, bitácora e hitos.
create function public.es_interventor_obra(p_proyecto uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.mis_alcances(p_proyecto) where contrato_vigilado_id is not null); $$;
-- ¿Veo este contrato como interventor? (el vigilado o el propio contrato de interventoría)
create function public.es_interventor_de_contrato(p_contrato uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.contratos c, lateral public.mis_alcances(c.proyecto_id) a
    where c.id = p_contrato and (a.contrato_vigilado_id = p_contrato or a.contrato_interventoria_id = p_contrato));
$$;
-- Sub-rol con el que puedo actuar (o null): coincide con uno de los pedidos y el alcance cubre lo pedido.
create function public.interventor_subrol(p_proyecto uuid, p_subroles text[], p_alcances text[], p_contrato uuid default null)
returns text language sql stable security definer set search_path = ''
as $$
  select u.subrol from public.mis_alcances(p_proyecto) a
  join public.interventoria_usuarios u on u.alcance_id = a.id and u.usuario_id = auth.uid()
  where u.subrol = any(p_subroles)
    and (p_alcances is null or a.alcances && p_alcances)
    and (p_contrato is null or a.contrato_vigilado_id = p_contrato)
  order by (u.subrol = 'director') desc limit 1;
$$;
revoke execute on function public.mis_alcances(uuid), public.es_interventor_obra(uuid), public.es_interventor_de_contrato(uuid),
  public.interventor_subrol(uuid, text[], text[], uuid) from public, anon;
grant execute on function public.mis_alcances(uuid), public.es_interventor_obra(uuid), public.es_interventor_de_contrato(uuid),
  public.interventor_subrol(uuid, text[], text[], uuid) to authenticated;

alter table public.interventoria_alcances enable row level security;
alter table public.interventoria_usuarios enable row level security;
revoke all on public.interventoria_alcances, public.interventoria_usuarios from anon, authenticated;
grant select on public.interventoria_alcances, public.interventoria_usuarios to authenticated;
create policy ialcances_ver on public.interventoria_alcances for select to authenticated
  using (public.puede_ver_proyecto(proyecto_id) or id in (select a.id from public.mis_alcances(proyecto_id) a));
create policy iusuarios_ver on public.interventoria_usuarios for select to authenticated
  using (usuario_id = auth.uid() or exists (select 1 from public.interventoria_alcances a where a.id = alcance_id and public.puede_ver_proyecto(a.proyecto_id)));

create function public.interventoria_alcance_guardar(
  p_id uuid, p_proyecto uuid, p_contrato_interventoria uuid, p_contrato_vigilado uuid, p_alcances text[], p_inicio date, p_fin date)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.puede_gestionar(p_proyecto) then
    raise exception 'No tienes permiso para asignar interventoría en este proyecto.' using errcode = '42501';
  end if;
  if p_contrato_interventoria is not null and not exists (select 1 from public.contratos where id = p_contrato_interventoria and proyecto_id = p_proyecto and tipo = 'interventoria') then
    raise exception 'El contrato de interventoría no es válido (debe ser de tipo interventoría y de este proyecto).' using errcode = '22023';
  end if;
  if p_contrato_vigilado is not null and not exists (select 1 from public.contratos where id = p_contrato_vigilado and proyecto_id = p_proyecto and tipo <> 'interventoria') then
    raise exception 'El contrato vigilado no es válido.' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.interventoria_alcances (proyecto_id, contrato_interventoria_id, contrato_vigilado_id, alcances, fecha_inicio, fecha_fin)
      values (p_proyecto, p_contrato_interventoria, p_contrato_vigilado, coalesce(p_alcances, '{}'), p_inicio, p_fin) returning id into v_id;
  else
    update public.interventoria_alcances set contrato_interventoria_id = p_contrato_interventoria, contrato_vigilado_id = p_contrato_vigilado,
      alcances = coalesce(p_alcances, '{}'), fecha_inicio = p_inicio, fecha_fin = p_fin where id = p_id and proyecto_id = p_proyecto returning id into v_id;
    if v_id is null then raise exception 'Asignación no encontrada.' using errcode = '22023'; end if;
  end if;
  return v_id;
exception when check_violation then
  raise exception 'Elige al menos un alcance y revisa que la fecha final no sea anterior a la inicial.' using errcode = '22023';
end;
$$;

create function public.interventoria_usuario_asignar(p_alcance uuid, p_usuario uuid, p_subrol text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_proy uuid;
begin
  select proyecto_id into v_proy from public.interventoria_alcances where id = p_alcance;
  if v_proy is null then raise exception 'Asignación no encontrada.' using errcode = '22023'; end if;
  if auth.uid() is null or not public.puede_gestionar(v_proy) then
    raise exception 'No tienes permiso para asignar interventoría en este proyecto.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.miembros_proyecto where proyecto_id = v_proy and usuario_id = p_usuario and rol = 'interventoria') then
    raise exception 'La persona debe estar en el equipo del proyecto con el rol Interventoría (lo asigna el administrador).' using errcode = '22023';
  end if;
  insert into public.interventoria_usuarios (alcance_id, usuario_id, subrol) values (p_alcance, p_usuario, p_subrol)
    on conflict (alcance_id, usuario_id) do update set subrol = excluded.subrol;
exception when check_violation then
  raise exception 'Sub-rol no válido.' using errcode = '22023';
end;
$$;

create function public.interventoria_asignacion_quitar(p_alcance uuid, p_usuario uuid default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_proy uuid;
begin
  select proyecto_id into v_proy from public.interventoria_alcances where id = p_alcance;
  if v_proy is null then return; end if;
  if auth.uid() is null or not public.puede_gestionar(v_proy) then
    raise exception 'No tienes permiso para cambiar la interventoría de este proyecto.' using errcode = '42501';
  end if;
  if p_usuario is null then delete from public.interventoria_alcances where id = p_alcance;
  else delete from public.interventoria_usuarios where alcance_id = p_alcance and usuario_id = p_usuario; end if;
end;
$$;

-- 2. LA INTERVENTORÍA SOLO VE LOS CONTRATOS ASIGNADOS ---------------------------------------------------
drop policy contratos_ver on public.contratos;
create policy contratos_ver on public.contratos for select to authenticated
  using (public.puede_ver_proyecto(proyecto_id) or public.es_interventor_de_contrato(id));
drop policy actas_pago_ver on public.actas_pago;
create policy actas_pago_ver on public.actas_pago for select to authenticated
  using (public.puede_ver_proyecto(proyecto_id) or public.es_interventor_de_contrato(contrato_id));
drop policy cambios_ver on public.cambios;
create policy cambios_ver on public.cambios for select to authenticated
  using (public.puede_ver_proyecto(proyecto_id) or (contrato_id is not null and public.es_interventor_de_contrato(contrato_id)));
drop policy cambios_historial_ver on public.cambios_historial;
create policy cambios_historial_ver on public.cambios_historial for select to authenticated
  using (public.puede_ver_proyecto(proyecto_id) or exists (select 1 from public.cambios c where c.id = cambio_id and c.contrato_id is not null and public.es_interventor_de_contrato(c.contrato_id)));

-- Datos de obra: solo con una asignación sobre un contrato de obra.
drop policy wbs_ver on public.wbs_elementos;
create policy wbs_ver on public.wbs_elementos for select to authenticated using (public.puede_ver_proyecto(proyecto_id) or public.es_interventor_obra(proyecto_id));
drop policy hitos_ver on public.hitos;
create policy hitos_ver on public.hitos for select to authenticated using (public.puede_ver_proyecto(proyecto_id) or public.es_interventor_obra(proyecto_id));
drop policy tareas_ver on public.tareas;
create policy tareas_ver on public.tareas for select to authenticated using (public.puede_ver_proyecto(proyecto_id) or public.es_interventor_obra(proyecto_id));

create or replace function public.puede_ver_bitacora(p_proyecto uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select public.puede_ver_proyecto(p_proyecto) or public.es_interventor_obra(p_proyecto); $$;
create or replace function public.puede_registrar_bitacora(p_proyecto uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.puede_gestionar(p_proyecto) or public.es_interventor_obra(p_proyecto) or exists (
    select 1 from public.miembros_proyecto where proyecto_id = p_proyecto and usuario_id = auth.uid() and rol = 'supervisor');
$$;
create or replace function public.bitacora_comentar(p_bitacora uuid, p_tipo text, p_texto text)
returns void language plpgsql security definer set search_path = ''
as $$
declare b public.bitacoras; v_texto text := nullif(btrim(coalesce(p_texto, '')), '');
begin
  select * into b from public.bitacoras where id = p_bitacora;
  if not found then raise exception 'Entrada no encontrada.' using errcode = '22023'; end if;
  if p_tipo not in ('visto_bueno', 'comentario') then raise exception 'Tipo no válido.' using errcode = '22023'; end if;
  if auth.uid() is null or not (public.es_interventor_obra(b.proyecto_id) or (p_tipo = 'comentario' and public.puede_gestionar(b.proyecto_id))) then
    raise exception 'No tienes permiso para comentar esta entrada.' using errcode = '42501';
  end if;
  if p_tipo = 'comentario' and v_texto is null then raise exception 'Escribe el comentario.' using errcode = '22023'; end if;
  if v_texto is not null and length(v_texto) > 2000 then raise exception 'El comentario no puede superar 2000 caracteres.' using errcode = '22023'; end if;
  insert into public.bitacora_comentarios (bitacora_id, proyecto_id, tipo, texto) values (p_bitacora, b.proyecto_id, p_tipo, v_texto);
end;
$$;

-- Avance verificado: solo el interventor técnico (o el director de interventoría) con alcance técnico.
create or replace function public.tarea_verificar(p_tarea uuid, p_pct numeric, p_nota text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_proy uuid; v_nota text := nullif(btrim(coalesce(p_nota, '')), '');
begin
  select proyecto_id into v_proy from public.tareas where id = p_tarea;
  if v_proy is null then raise exception 'Tarea no encontrada.' using errcode = '22023'; end if;
  if auth.uid() is null or public.interventor_subrol(v_proy, array['tecnico', 'director'], array['tecnica']) is null then
    raise exception 'Solo el interventor técnico (o el director de interventoría) registra el avance verificado.' using errcode = '42501';
  end if;
  if p_pct is null or p_pct < 0 or p_pct > 100 then
    raise exception 'El avance verificado debe estar entre 0 y 100.' using errcode = '22023';
  end if;
  if v_nota is null or length(v_nota) < 3 or length(v_nota) > 500 then
    raise exception 'Escribe la nota de verificación (3 a 500 caracteres).' using errcode = '22023';
  end if;
  update public.tareas set avance_verificado_pct = round(p_pct, 2), nota_verificacion = v_nota,
    verificado_por = auth.uid(), fecha_verificacion = public.hoy_co() where id = p_tarea;
end;
$$;

drop policy proyectos_ver on public.proyectos;
create policy proyectos_ver on public.proyectos for select to authenticated
  using (public.ve_todos() or public.es_miembro(id) or public.es_interventor(id));

-- 3. CONCEPTOS (inmutables) ---------------------------------------------------------------------------------
create function public.concepto_permitido(p_subrol text, p_tipo text)
returns boolean language sql immutable set search_path = ''
as $$
  select case p_subrol
    when 'director' then true
    when 'tecnico' then p_tipo in ('acta_pago', 'avance', 'cambio', 'diseno', 'estudios_previos_pliegos', 'otro')
    when 'financiero' then p_tipo in ('acta_pago', 'anticipo', 'cambio', 'otro')
    when 'administrativo' then p_tipo in ('estudios_previos_pliegos', 'otro')
    when 'juridico_contable' then p_tipo in ('cambio', 'estudios_previos_pliegos', 'otro')
    else false end;
$$;
-- Alcance que debe tener la asignación para cada tipo de concepto.
create function public.concepto_alcances(p_tipo text)
returns text[] language sql immutable set search_path = ''
as $$
  select case p_tipo
    when 'acta_pago' then array['tecnica', 'financiera']
    when 'anticipo' then array['financiera']
    when 'avance' then array['tecnica']
    when 'cambio' then array['tecnica', 'financiera', 'juridica', 'contable']
    when 'diseno' then array['disenos']
    when 'estudios_previos_pliegos' then array['asesoria']
    else null end;
$$;

create table public.conceptos_interventoria (
  id            uuid primary key default gen_random_uuid(),
  proyecto_id   uuid not null references public.proyectos (id) on delete cascade,
  tipo          text not null check (tipo in ('acta_pago', 'avance', 'cambio', 'anticipo', 'diseno', 'estudios_previos_pliegos', 'otro')),
  entidad_tipo  text not null check (entidad_tipo in ('acta_pago', 'tarea', 'cambio', 'contrato', 'documento', 'proyecto')),
  entidad_id    uuid not null,
  contrato_id   uuid,
  resultado     text not null check (resultado in ('aprobado', 'aprobado_con_observaciones', 'no_aprobado')),
  texto         text check (length(texto) <= 4000),
  autor_id      uuid not null default auth.uid(),
  subrol        text not null,
  fecha         timestamptz not null default now()
);
create index conceptos_entidad_idx on public.conceptos_interventoria (entidad_tipo, entidad_id, fecha desc);
create index conceptos_proyecto_idx on public.conceptos_interventoria (proyecto_id, fecha desc);

alter table public.conceptos_interventoria enable row level security;
revoke all on public.conceptos_interventoria from anon, authenticated;
grant select on public.conceptos_interventoria to authenticated;
create policy conceptos_ver on public.conceptos_interventoria for select to authenticated
  using (public.puede_ver_proyecto(proyecto_id) or (contrato_id is not null and public.es_interventor_de_contrato(contrato_id)) or (contrato_id is null and public.es_interventor(proyecto_id)));

-- ¿El contrato tiene interventoría asignada? Y ¿los interventores requeridos ya dieron concepto favorable?
create function public.contrato_con_interventoria(p_contrato uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.interventoria_alcances a join public.interventoria_usuarios u on u.alcance_id = a.id
    where a.contrato_vigilado_id = p_contrato and (a.fecha_inicio is null or a.fecha_inicio <= public.hoy_co()) and (a.fecha_fin is null or a.fecha_fin >= public.hoy_co()));
$$;

create or replace function public.acta_requiere_interventoria(p_acta uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce((select public.contrato_con_interventoria(contrato_id) from public.actas_pago where id = p_acta), false); $$;

-- Favorable: el último concepto de cada interventor técnico y financiero asignado es Aprobado o Aprobado con observaciones
-- (si no hay técnico ni financiero, el del director), y ninguno de los últimos conceptos es No aprobado.
create or replace function public.acta_concepto_favorable(p_acta uuid)
returns boolean language plpgsql stable security definer set search_path = ''
as $$
declare v_contrato uuid; v_req text[]; s text; v_res text;
begin
  select contrato_id into v_contrato from public.actas_pago where id = p_acta;
  if v_contrato is null then return false; end if;
  select coalesce(array_agg(distinct u.subrol) filter (where u.subrol in ('tecnico', 'financiero')), '{}') into v_req
    from public.interventoria_alcances a join public.interventoria_usuarios u on u.alcance_id = a.id where a.contrato_vigilado_id = v_contrato;
  if cardinality(v_req) = 0 then v_req := array['director']; end if;
  if exists (select 1 from (select distinct on (subrol) resultado from public.conceptos_interventoria
      where tipo = 'acta_pago' and entidad_id = p_acta order by subrol, fecha desc, id desc) x where resultado = 'no_aprobado') then
    return false;
  end if;
  foreach s in array v_req loop
    select resultado into v_res from public.conceptos_interventoria where tipo = 'acta_pago' and entidad_id = p_acta and subrol = s order by fecha desc, id desc limit 1;
    if v_res is null or v_res = 'no_aprobado' then return false; end if;
  end loop;
  return true;
end;
$$;

-- Un cambio ligado a un contrato con interventoría necesita su concepto antes del análisis de impacto.
create or replace function public.cambio_concepto_pendiente(p_cambio uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((select c.contrato_id is not null and public.contrato_con_interventoria(c.contrato_id)
      and not exists (select 1 from public.conceptos_interventoria k where k.tipo = 'cambio' and k.entidad_id = c.id)
    from public.cambios c where c.id = p_cambio), false);
$$;

create function public.concepto_emitir(p_proyecto uuid, p_tipo text, p_entidad_tipo text, p_entidad_id uuid, p_resultado text, p_texto text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_contrato uuid; v_subrol text; v_texto text := nullif(btrim(coalesce(p_texto, '')), ''); v_id uuid; v_estado text;
begin
  if auth.uid() is null or not public.es_interventor(p_proyecto) then
    raise exception 'Solo la interventoría asignada emite conceptos.' using errcode = '42501';
  end if;
  if p_resultado not in ('aprobado', 'aprobado_con_observaciones', 'no_aprobado') then raise exception 'Resultado no válido.' using errcode = '22023'; end if;
  if p_resultado <> 'aprobado' and (v_texto is null or length(v_texto) < 3) then
    raise exception 'Explica las observaciones del concepto (mínimo 3 caracteres).' using errcode = '22023';
  end if;
  if v_texto is not null and length(v_texto) > 4000 then raise exception 'El texto no puede superar 4000 caracteres.' using errcode = '22023'; end if;

  -- El registro al que se refiere debe existir en este proyecto; de él sale el contrato.
  v_contrato := case p_entidad_tipo
    when 'acta_pago' then (select contrato_id from public.actas_pago where id = p_entidad_id and proyecto_id = p_proyecto)
    when 'cambio' then (select contrato_id from public.cambios where id = p_entidad_id and proyecto_id = p_proyecto)
    when 'contrato' then (select id from public.contratos where id = p_entidad_id and proyecto_id = p_proyecto)
    else null end;
  if p_entidad_tipo in ('acta_pago', 'contrato') and v_contrato is null then raise exception 'El registro no existe en este proyecto.' using errcode = '22023'; end if;
  if p_entidad_tipo = 'cambio' and not exists (select 1 from public.cambios where id = p_entidad_id and proyecto_id = p_proyecto) then raise exception 'El registro no existe en este proyecto.' using errcode = '22023'; end if;
  if p_entidad_tipo = 'tarea' and not exists (select 1 from public.tareas where id = p_entidad_id and proyecto_id = p_proyecto) then raise exception 'El registro no existe en este proyecto.' using errcode = '22023'; end if;
  if p_entidad_tipo = 'documento' and not exists (select 1 from public.documentos where id = p_entidad_id and proyecto_id = p_proyecto) then raise exception 'El registro no existe en este proyecto.' using errcode = '22023'; end if;
  if p_entidad_tipo = 'proyecto' and p_entidad_id <> p_proyecto then raise exception 'El registro no existe en este proyecto.' using errcode = '22023'; end if;
  if p_entidad_tipo not in ('acta_pago', 'tarea', 'cambio', 'contrato', 'documento', 'proyecto') then raise exception 'Tipo de registro no válido.' using errcode = '22023'; end if;

  -- Sub-rol: cada tipo de concepto lo emite solo quien corresponde (el financiero no conceptúa sobre diseños; el técnico no sobre el anticipo).
  select u.subrol into v_subrol from public.mis_alcances(p_proyecto) a
    join public.interventoria_usuarios u on u.alcance_id = a.id and u.usuario_id = auth.uid()
    where public.concepto_permitido(u.subrol, p_tipo)
      and (public.concepto_alcances(p_tipo) is null or a.alcances && public.concepto_alcances(p_tipo))
      and (v_contrato is null or a.contrato_vigilado_id = v_contrato)
    order by (u.subrol = 'director') desc limit 1;
  if v_subrol is null then
    raise exception 'Tu sub-rol o tu asignación no permiten emitir conceptos de tipo "%" sobre este registro.', p_tipo using errcode = '42501';
  end if;

  insert into public.conceptos_interventoria (proyecto_id, tipo, entidad_tipo, entidad_id, contrato_id, resultado, texto, subrol)
    values (p_proyecto, p_tipo, p_entidad_tipo, p_entidad_id, v_contrato, p_resultado, v_texto, v_subrol) returning id into v_id;

  -- El concepto mueve el estado del acta: con un No aprobado vigente pasa a Con observaciones; si no, queda En revisión.
  if p_tipo = 'acta_pago' and p_entidad_tipo = 'acta_pago' then
    select estado into v_estado from public.actas_pago where id = p_entidad_id;
    if v_estado <> 'aprobada_pago' then
      if exists (select 1 from (select distinct on (subrol) resultado from public.conceptos_interventoria
          where tipo = 'acta_pago' and entidad_id = p_entidad_id order by subrol, fecha desc, id desc) x where resultado = 'no_aprobado') then
        update public.actas_pago set estado = 'con_observaciones' where id = p_entidad_id;
      else
        update public.actas_pago set estado = 'en_revision_interventoria' where id = p_entidad_id;
      end if;
    end if;
  end if;
  return v_id;
end;
$$;

-- 4. HALLAZGOS Y REQUERIMIENTOS ----------------------------------------------------------------------------
create table public.hallazgos (
  id               uuid primary key default gen_random_uuid(),
  proyecto_id      uuid not null references public.proyectos (id) on delete cascade,
  contrato_id      uuid references public.contratos (id) on delete set null,
  severidad        text not null check (severidad in ('observacion', 'no_conformidad', 'incumplimiento_grave')),
  descripcion      text not null check (length(btrim(descripcion)) between 1 and 4000),
  evidencia        uuid[] not null default '{}',                 -- documentos del proyecto
  fecha            date not null default public.hoy_co(),
  plazo_respuesta  date not null,
  estado           text not null default 'abierto' check (estado in ('abierto', 'respondido', 'cerrado', 'escalado')),
  respuesta        text check (length(respuesta) <= 4000),
  respondido_por   uuid,
  respondido_en    timestamptz,
  escalado_en      timestamptz,
  cerrado_por      uuid,
  cerrado_en       timestamptz,
  creado_por       uuid not null default auth.uid(),
  creado_en        timestamptz not null default now()
);
create index hallazgos_proyecto_idx on public.hallazgos (proyecto_id, estado);
create trigger hallazgos_audit after insert or update or delete on public.hallazgos
  for each row execute function public.auditar_tabla();

alter table public.hallazgos enable row level security;
revoke all on public.hallazgos from anon, authenticated;
grant select on public.hallazgos to authenticated;
create policy hallazgos_ver on public.hallazgos for select to authenticated
  using (public.puede_ver_proyecto(proyecto_id) or (contrato_id is not null and public.es_interventor_de_contrato(contrato_id)) or (contrato_id is null and public.es_interventor(proyecto_id)));

create function public.hallazgo_crear(p_proyecto uuid, p_contrato uuid, p_severidad text, p_descripcion text, p_evidencia uuid[])
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_dias integer; v_id uuid; v_desc text := nullif(btrim(coalesce(p_descripcion, '')), '');
begin
  if auth.uid() is null or public.interventor_subrol(p_proyecto, array['director', 'tecnico', 'administrativo', 'financiero', 'juridico_contable'], null, p_contrato) is null then
    raise exception 'Solo la interventoría asignada registra hallazgos (sobre sus contratos).' using errcode = '42501';
  end if;
  if p_severidad not in ('observacion', 'no_conformidad', 'incumplimiento_grave') then raise exception 'Severidad no válida.' using errcode = '22023'; end if;
  if v_desc is null then raise exception 'Describe el hallazgo.' using errcode = '22023'; end if;
  if p_contrato is not null and not exists (select 1 from public.contratos where id = p_contrato and proyecto_id = p_proyecto) then
    raise exception 'El contrato no es de este proyecto.' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_evidencia), 0) > 0 and (select count(*) from public.documentos where id = any(p_evidencia) and proyecto_id = p_proyecto) <> cardinality(p_evidencia) then
    raise exception 'Alguna evidencia no es un documento de este proyecto.' using errcode = '22023';
  end if;
  v_dias := coalesce(public.parametro('plazo_hallazgo_' || p_severidad, p_proyecto)::integer, case p_severidad when 'observacion' then 5 when 'no_conformidad' then 3 else 1 end);
  insert into public.hallazgos (proyecto_id, contrato_id, severidad, descripcion, evidencia, plazo_respuesta)
    values (p_proyecto, p_contrato, p_severidad, v_desc, coalesce(p_evidencia, '{}'), public.dias_habiles_sumar(public.hoy_co(), v_dias)) returning id into v_id;
  return v_id;
exception when check_violation then
  raise exception 'La descripción es demasiado larga (máximo 4000 caracteres).' using errcode = '22023';
end;
$$;

-- Pasa a Escalado todo hallazgo abierto cuyo plazo venció. Lo ejecuta quien consulta (resultado determinista).
create function public.hallazgos_escalar(p_proyecto uuid)
returns integer language plpgsql security definer set search_path = ''
as $$
declare n integer;
begin
  if auth.uid() is null or not (public.puede_ver_proyecto(p_proyecto) or public.es_interventor(p_proyecto)) then return 0; end if;
  update public.hallazgos set estado = 'escalado', escalado_en = now()
    where proyecto_id = p_proyecto and estado = 'abierto' and plazo_respuesta < public.hoy_co();
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Responde el gerente (o quien lo representa: el contratista, registrado por el gerente).
create function public.hallazgo_responder(p_hallazgo uuid, p_respuesta text)
returns void language plpgsql security definer set search_path = ''
as $$
declare h public.hallazgos; v_r text := nullif(btrim(coalesce(p_respuesta, '')), '');
begin
  select * into h from public.hallazgos where id = p_hallazgo for update;
  if not found then raise exception 'Hallazgo no encontrado.' using errcode = '22023'; end if;
  if auth.uid() is null or not public.puede_gestionar(h.proyecto_id) then
    raise exception 'Solo el gerente (o el administrador) registra la respuesta.' using errcode = '42501';
  end if;
  if h.estado = 'cerrado' then raise exception 'El hallazgo ya está cerrado.' using errcode = '22023'; end if;
  if v_r is null or length(v_r) < 3 then raise exception 'Escribe la respuesta (mínimo 3 caracteres).' using errcode = '22023'; end if;
  if length(v_r) > 4000 then raise exception 'La respuesta es demasiado larga.' using errcode = '22023'; end if;
  update public.hallazgos set estado = 'respondido', respuesta = v_r, respondido_por = auth.uid(), respondido_en = now() where id = p_hallazgo;
end;
$$;

-- Cierra la interventoría (quien lo creó o el director) cuando la respuesta es satisfactoria.
create function public.hallazgo_cerrar(p_hallazgo uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare h public.hallazgos;
begin
  select * into h from public.hallazgos where id = p_hallazgo for update;
  if not found then raise exception 'Hallazgo no encontrado.' using errcode = '22023'; end if;
  if auth.uid() is null or not (h.creado_por = auth.uid() or public.interventor_subrol(h.proyecto_id, array['director'], null, h.contrato_id) is not null) then
    raise exception 'Solo quien registró el hallazgo o el director de interventoría lo cierra.' using errcode = '42501';
  end if;
  if h.estado <> 'respondido' then raise exception 'Solo se cierra un hallazgo que ya fue respondido.' using errcode = '22023'; end if;
  update public.hallazgos set estado = 'cerrado', cerrado_por = auth.uid(), cerrado_en = now() where id = p_hallazgo;
end;
$$;

-- Si la respuesta no es suficiente, se reabre con un nuevo plazo.
create function public.hallazgo_reabrir(p_hallazgo uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare h public.hallazgos; v_dias integer;
begin
  select * into h from public.hallazgos where id = p_hallazgo for update;
  if not found then raise exception 'Hallazgo no encontrado.' using errcode = '22023'; end if;
  if auth.uid() is null or not (h.creado_por = auth.uid() or public.interventor_subrol(h.proyecto_id, array['director'], null, h.contrato_id) is not null) then
    raise exception 'Solo quien registró el hallazgo o el director de interventoría lo reabre.' using errcode = '42501';
  end if;
  if h.estado not in ('respondido', 'cerrado') then raise exception 'Solo se reabre un hallazgo respondido o cerrado.' using errcode = '22023'; end if;
  v_dias := coalesce(public.parametro('plazo_hallazgo_' || h.severidad, h.proyecto_id)::integer, 3);
  update public.hallazgos set estado = 'abierto', plazo_respuesta = public.dias_habiles_sumar(public.hoy_co(), v_dias), cerrado_por = null, cerrado_en = null where id = p_hallazgo;
end;
$$;

-- 5. REVISIÓN DE DISEÑOS ------------------------------------------------------------------------------------------
create table public.revisiones_diseno (
  id             uuid primary key default gen_random_uuid(),
  proyecto_id    uuid not null references public.proyectos (id) on delete cascade,
  documento_id   uuid not null references public.documentos (id) on delete cascade,
  version        integer not null,                       -- versión del documento que se revisó
  disciplina     text not null check (length(btrim(disciplina)) between 1 and 100),
  ciclo          integer not null check (ciclo >= 1),
  estado         text not null check (estado in ('pendiente', 'con_observaciones', 'aprobado')),
  observaciones  text check (length(observaciones) <= 4000),
  revisor_id     uuid not null default auth.uid(),
  fecha          timestamptz not null default now(),
  unique (documento_id, ciclo)
);
create table public.diseno_estado (
  proyecto_id    uuid primary key references public.proyectos (id) on delete cascade,
  listo_licitar  boolean not null default false,
  marcado_por    uuid,
  fecha          timestamptz not null default now()
);
create trigger diseno_estado_audit after insert or update or delete on public.diseno_estado
  for each row execute function public.auditar_tabla();

alter table public.revisiones_diseno enable row level security;
alter table public.diseno_estado enable row level security;
revoke all on public.revisiones_diseno, public.diseno_estado from anon, authenticated;
grant select on public.revisiones_diseno, public.diseno_estado to authenticated;
create policy revisiones_ver on public.revisiones_diseno for select to authenticated using (public.puede_ver_proyecto(proyecto_id) or public.es_interventor(proyecto_id));
create policy diseno_estado_ver on public.diseno_estado for select to authenticated using (public.puede_ver_proyecto(proyecto_id) or public.es_interventor(proyecto_id));

create function public.revision_diseno_crear(p_proyecto uuid, p_documento uuid, p_disciplina text, p_estado text, p_observaciones text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_ver integer; v_ciclo integer; v_id uuid; v_obs text := nullif(btrim(coalesce(p_observaciones, '')), ''); v_cat text;
begin
  if auth.uid() is null or public.interventor_subrol(p_proyecto, array['tecnico', 'director'], array['disenos']) is null then
    raise exception 'Solo el interventor técnico (o el director) con alcance de diseños revisa entregables.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.documentos where id = p_documento and proyecto_id = p_proyecto and tipo = 'plano') then
    raise exception 'El entregable debe ser un plano de este proyecto.' using errcode = '22023';
  end if;
  if p_estado not in ('pendiente', 'con_observaciones', 'aprobado') then raise exception 'Estado no válido.' using errcode = '22023'; end if;
  if p_estado = 'con_observaciones' and v_obs is null then raise exception 'Escribe las observaciones de la revisión.' using errcode = '22023'; end if;
  v_cat := coalesce(public.parametro('catalogo_disciplinas_diseno', p_proyecto), '');
  if not (btrim(coalesce(p_disciplina, '')) = any(array(select btrim(x) from unnest(string_to_array(v_cat, ',')) x))) then
    raise exception 'La disciplina no está en el catálogo configurado.' using errcode = '22023';
  end if;
  select max(version) into v_ver from public.documento_versiones where documento_id = p_documento;
  select coalesce(max(ciclo), 0) + 1 into v_ciclo from public.revisiones_diseno where documento_id = p_documento;
  insert into public.revisiones_diseno (proyecto_id, documento_id, version, disciplina, ciclo, estado, observaciones)
    values (p_proyecto, p_documento, coalesce(v_ver, 1), btrim(p_disciplina), v_ciclo, p_estado, v_obs) returning id into v_id;
  -- Cualquier revisión nueva retira la marca de "listo para licitar" hasta que todo vuelva a estar aprobado.
  update public.diseno_estado set listo_licitar = false, fecha = now() where proyecto_id = p_proyecto and listo_licitar and p_estado <> 'aprobado';
  return v_id;
end;
$$;

-- Listo para licitar: todos los planos con su última revisión Aprobada y sobre su última versión.
create function public.diseno_marcar_listo(p_proyecto uuid, p_listo boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_total integer; v_ok integer;
begin
  if auth.uid() is null or not public.puede_gestionar(p_proyecto) then
    raise exception 'Solo el gerente o el administrador marcan el diseño como listo para licitar.' using errcode = '42501';
  end if;
  if p_listo then
    select count(*)::integer into v_total from public.documentos where proyecto_id = p_proyecto and tipo = 'plano';
    select count(*)::integer into v_ok from public.documentos d
      where d.proyecto_id = p_proyecto and d.tipo = 'plano' and exists (
        select 1 from public.revisiones_diseno r where r.documento_id = d.id and r.estado = 'aprobado'
          and r.ciclo = (select max(ciclo) from public.revisiones_diseno where documento_id = d.id)
          and r.version = (select max(version) from public.documento_versiones where documento_id = d.id));
    if v_total = 0 then raise exception 'No hay planos registrados.' using errcode = '22023'; end if;
    if v_ok < v_total then
      raise exception 'Solo % de % planos están aprobados en su última versión. Todos deben estar aprobados.', v_ok, v_total using errcode = '22023';
    end if;
  end if;
  insert into public.diseno_estado (proyecto_id, listo_licitar, marcado_por) values (p_proyecto, coalesce(p_listo, false), auth.uid())
    on conflict (proyecto_id) do update set listo_licitar = excluded.listo_licitar, marcado_por = excluded.marcado_por, fecha = now();
end;
$$;

-- 6. EVALUACIÓN DE PROVEEDORES Y CONTRATISTAS ------------------------------------------------------------------------
create table public.evaluaciones_proveedor (
  id             uuid primary key default gen_random_uuid(),
  proyecto_id    uuid not null references public.proyectos (id) on delete cascade,
  contrato_id    uuid references public.contratos (id) on delete set null,
  proveedor      text not null check (length(btrim(proveedor)) between 1 and 200),
  puntajes       jsonb not null,
  puntaje_total  numeric(4, 2) not null check (puntaje_total between 1 and 5),
  recomendacion  text not null check (recomendacion in ('recomendar', 'con_reservas', 'no_recomendar')),
  comentario     text check (length(comentario) <= 4000),
  evaluador_id   uuid not null default auth.uid(),
  fecha          timestamptz not null default now()
);
create table public.asesorias (
  id             uuid primary key default gen_random_uuid(),
  proyecto_id    uuid not null references public.proyectos (id) on delete cascade,
  tema           text not null check (length(btrim(tema)) between 1 and 200),
  tipo           text not null check (tipo in ('estudio_mercado', 'investigacion', 'estudios_previos_pliegos')),
  fuentes        text check (length(fuentes) <= 4000),
  conclusiones   text not null check (length(btrim(conclusiones)) between 1 and 4000),
  recomendacion  text not null check (length(btrim(recomendacion)) between 1 and 4000),
  autor_id       uuid not null default auth.uid(),
  fecha          timestamptz not null default now()
);
alter table public.evaluaciones_proveedor enable row level security;
alter table public.asesorias enable row level security;
revoke all on public.evaluaciones_proveedor, public.asesorias from anon, authenticated;
grant select on public.evaluaciones_proveedor, public.asesorias to authenticated;
create policy eval_prov_ver on public.evaluaciones_proveedor for select to authenticated
  using (public.puede_ver_proyecto(proyecto_id) or (contrato_id is not null and public.es_interventor_de_contrato(contrato_id)) or (contrato_id is null and public.es_interventor(proyecto_id)));
create policy asesorias_ver on public.asesorias for select to authenticated using (public.puede_ver_proyecto(proyecto_id) or public.es_interventor(proyecto_id));

-- La interventoría recomienda; la selección y la contratación son de la entidad.
create function public.evaluacion_proveedor_crear(p_proyecto uuid, p_contrato uuid, p_proveedor text, p_puntajes jsonb, p_recomendacion text, p_comentario text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_crit text[]; c text; v numeric; suma numeric := 0; v_id uuid;
begin
  if auth.uid() is null or public.interventor_subrol(p_proyecto, array['director', 'tecnico', 'administrativo', 'financiero', 'juridico_contable'], null, p_contrato) is null then
    raise exception 'Solo la interventoría asignada evalúa proveedores y contratistas.' using errcode = '42501';
  end if;
  if p_recomendacion not in ('recomendar', 'con_reservas', 'no_recomendar') then raise exception 'Recomendación no válida.' using errcode = '22023'; end if;
  if nullif(btrim(coalesce(p_proveedor, '')), '') is null then raise exception 'Indica el proveedor o contratista.' using errcode = '22023'; end if;
  v_crit := array(select btrim(x) from unnest(string_to_array(coalesce(public.parametro('criterios_evaluacion_proveedor', p_proyecto), ''), ',')) x where btrim(x) <> '');
  if cardinality(v_crit) = 0 then raise exception 'No hay criterios de evaluación configurados.' using errcode = '22023'; end if;
  foreach c in array v_crit loop
    begin
      v := (p_puntajes ->> c)::numeric;
    exception when others then v := null;
    end;
    if v is null or v < 1 or v > 5 or v <> trunc(v) then
      raise exception 'Califica el criterio "%" con un número entero de 1 a 5.', c using errcode = '22023';
    end if;
    suma := suma + v;
  end loop;
  insert into public.evaluaciones_proveedor (proyecto_id, contrato_id, proveedor, puntajes, puntaje_total, recomendacion, comentario)
    values (p_proyecto, p_contrato, btrim(p_proveedor), p_puntajes, round(suma / cardinality(v_crit), 2), p_recomendacion, nullif(btrim(coalesce(p_comentario, '')), ''))
    returning id into v_id;
  return v_id;
end;
$$;

create function public.asesoria_crear(p_proyecto uuid, p_tema text, p_tipo text, p_fuentes text, p_conclusiones text, p_recomendacion text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if auth.uid() is null or public.interventor_subrol(p_proyecto, array['director', 'tecnico', 'administrativo', 'financiero', 'juridico_contable'], array['asesoria']) is null then
    raise exception 'Solo la interventoría con alcance de asesoría aporta asesorías.' using errcode = '42501';
  end if;
  insert into public.asesorias (proyecto_id, tema, tipo, fuentes, conclusiones, recomendacion)
    values (p_proyecto, btrim(coalesce(p_tema, '')), coalesce(p_tipo, ''), nullif(btrim(coalesce(p_fuentes, '')), ''), btrim(coalesce(p_conclusiones, '')), btrim(coalesce(p_recomendacion, '')))
    returning id into v_id;
  return v_id;
exception when check_violation then
  raise exception 'Revisa el tema, el tipo, las conclusiones y la recomendación (obligatorios; máximo 4000 caracteres).' using errcode = '22023';
end;
$$;

-- 7. INFORMES ------------------------------------------------------------------------------------------------------------
create table public.informes_interventoria (
  id            uuid primary key default gen_random_uuid(),
  proyecto_id   uuid not null references public.proyectos (id) on delete cascade,
  alcance_id    uuid references public.interventoria_alcances (id) on delete set null,
  contrato_id   uuid references public.contratos (id) on delete set null,
  tipo          text not null check (tipo in ('periodico', 'especial', 'sancionatorio', 'final')),
  periodo       text not null check (length(btrim(periodo)) between 1 and 100),
  acta_pago_id  uuid references public.actas_pago (id) on delete set null,
  contenido     jsonb not null default '{}'::jsonb,           -- secciones automáticas (foto al crear)
  recomendacion text check (recomendacion in ('aprobar_pago', 'aprobar_con_observaciones', 'no_aprobar')),
  motivo        text check (length(motivo) <= 4000),
  estado        text not null default 'borrador' check (estado in ('borrador', 'firmado')),
  firmado_por   uuid,
  fecha_firma   timestamptz,
  creado_por    uuid not null default auth.uid(),
  creado_en     timestamptz not null default now()
);
create index informes_proyecto_idx on public.informes_interventoria (proyecto_id, creado_en desc);
create trigger informes_audit after insert or update or delete on public.informes_interventoria
  for each row execute function public.auditar_tabla();
alter table public.informes_interventoria enable row level security;
revoke all on public.informes_interventoria from anon, authenticated;
grant select on public.informes_interventoria to authenticated;
create policy informes_ver on public.informes_interventoria for select to authenticated
  using (public.puede_ver_proyecto(proyecto_id) or (contrato_id is not null and public.es_interventor_de_contrato(contrato_id)) or (contrato_id is null and public.es_interventor(proyecto_id)));

create function public.informe_crear(p_proyecto uuid, p_alcance uuid, p_tipo text, p_periodo text, p_acta uuid, p_contenido jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare a public.interventoria_alcances; v_id uuid;
begin
  select * into a from public.interventoria_alcances where id = p_alcance and proyecto_id = p_proyecto;
  if not found or auth.uid() is null or not exists (select 1 from public.mis_alcances(p_proyecto) m where m.id = p_alcance) then
    raise exception 'Solo la interventoría asignada elabora informes sobre su asignación.' using errcode = '42501';
  end if;
  if p_tipo not in ('periodico', 'especial', 'sancionatorio', 'final') then raise exception 'Tipo de informe no válido.' using errcode = '22023'; end if;
  if nullif(btrim(coalesce(p_periodo, '')), '') is null then raise exception 'Indica el periodo del informe.' using errcode = '22023'; end if;
  if p_acta is not null and not exists (select 1 from public.actas_pago where id = p_acta and proyecto_id = p_proyecto and contrato_id is not distinct from a.contrato_vigilado_id) then
    raise exception 'El acta de pago no corresponde al contrato de esta asignación.' using errcode = '22023';
  end if;
  insert into public.informes_interventoria (proyecto_id, alcance_id, contrato_id, tipo, periodo, acta_pago_id, contenido)
    values (p_proyecto, p_alcance, a.contrato_vigilado_id, p_tipo, btrim(p_periodo), p_acta, coalesce(p_contenido, '{}'::jsonb)) returning id into v_id;
  return v_id;
end;
$$;

create function public.informe_guardar(p_informe uuid, p_recomendacion text, p_motivo text)
returns void language plpgsql security definer set search_path = ''
as $$
declare i public.informes_interventoria;
begin
  select * into i from public.informes_interventoria where id = p_informe for update;
  if not found then raise exception 'Informe no encontrado.' using errcode = '22023'; end if;
  if auth.uid() is null or not exists (select 1 from public.mis_alcances(i.proyecto_id) m where m.id = i.alcance_id) then
    raise exception 'Solo la interventoría asignada edita sus informes.' using errcode = '42501';
  end if;
  if i.estado = 'firmado' then raise exception 'Un informe firmado no se modifica.' using errcode = '22023'; end if;
  if nullif(p_recomendacion, '') is not null and p_recomendacion not in ('aprobar_pago', 'aprobar_con_observaciones', 'no_aprobar') then
    raise exception 'Recomendación no válida.' using errcode = '22023';
  end if;
  update public.informes_interventoria set recomendacion = nullif(p_recomendacion, ''), motivo = nullif(btrim(coalesce(p_motivo, '')), '') where id = p_informe;
exception when check_violation then
  raise exception 'El motivo es demasiado largo (máximo 4000 caracteres).' using errcode = '22023';
end;
$$;

-- Firma el director de interventoría; con la firma el informe queda inmutable.
create function public.informe_firmar(p_informe uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare i public.informes_interventoria;
begin
  select * into i from public.informes_interventoria where id = p_informe for update;
  if not found then raise exception 'Informe no encontrado.' using errcode = '22023'; end if;
  if auth.uid() is null or not exists (
      select 1 from public.mis_alcances(i.proyecto_id) m join public.interventoria_usuarios u on u.alcance_id = m.id and u.usuario_id = auth.uid()
      where m.id = i.alcance_id and u.subrol = 'director') then
    raise exception 'Solo el director de interventoría de esta asignación firma el informe.' using errcode = '42501';
  end if;
  if i.estado = 'firmado' then raise exception 'El informe ya está firmado.' using errcode = '22023'; end if;
  if i.tipo = 'periodico' and (i.recomendacion is null or nullif(btrim(coalesce(i.motivo, '')), '') is null) then
    raise exception 'Antes de firmar, completa la recomendación y su motivo.' using errcode = '22023';
  end if;
  update public.informes_interventoria set estado = 'firmado', firmado_por = auth.uid(), fecha_firma = now() where id = p_informe;
end;
$$;

-- 8. PERMISOS DE EJECUCIÓN -----------------------------------------------------------------------------------------------
revoke execute on function
  public.festivo_guardar(date, text, boolean),
  public.interventoria_alcance_guardar(uuid, uuid, uuid, uuid, text[], date, date), public.interventoria_usuario_asignar(uuid, uuid, text),
  public.interventoria_asignacion_quitar(uuid, uuid),
  public.concepto_emitir(uuid, text, text, uuid, text, text),
  public.hallazgo_crear(uuid, uuid, text, text, uuid[]), public.hallazgos_escalar(uuid), public.hallazgo_responder(uuid, text),
  public.hallazgo_cerrar(uuid), public.hallazgo_reabrir(uuid),
  public.revision_diseno_crear(uuid, uuid, text, text, text), public.diseno_marcar_listo(uuid, boolean),
  public.evaluacion_proveedor_crear(uuid, uuid, text, jsonb, text, text), public.asesoria_crear(uuid, text, text, text, text, text),
  public.informe_crear(uuid, uuid, text, text, uuid, jsonb), public.informe_guardar(uuid, text, text), public.informe_firmar(uuid)
  from public, anon;
grant execute on function
  public.festivo_guardar(date, text, boolean),
  public.interventoria_alcance_guardar(uuid, uuid, uuid, uuid, text[], date, date), public.interventoria_usuario_asignar(uuid, uuid, text),
  public.interventoria_asignacion_quitar(uuid, uuid),
  public.concepto_emitir(uuid, text, text, uuid, text, text),
  public.hallazgo_crear(uuid, uuid, text, text, uuid[]), public.hallazgos_escalar(uuid), public.hallazgo_responder(uuid, text),
  public.hallazgo_cerrar(uuid), public.hallazgo_reabrir(uuid),
  public.revision_diseno_crear(uuid, uuid, text, text, text), public.diseno_marcar_listo(uuid, boolean),
  public.evaluacion_proveedor_crear(uuid, uuid, text, jsonb, text, text), public.asesoria_crear(uuid, text, text, text, text, text),
  public.informe_crear(uuid, uuid, text, text, uuid, jsonb), public.informe_guardar(uuid, text, text), public.informe_firmar(uuid)
  to authenticated;
revoke execute on function public.pascua(integer), public.al_lunes(date), public.festivos_colombia(integer), public.contrato_con_interventoria(uuid),
  public.concepto_permitido(text, text), public.concepto_alcances(text), public.hoy_co() from public, anon;
grant execute on function public.contrato_con_interventoria(uuid), public.concepto_permitido(text, text), public.concepto_alcances(text), public.hoy_co() to authenticated;
