-- 0027: aliados, capa 2 (paquete RAÍZ): pólizas de cada contrato, modificaciones contractuales y documentos del tercero.
--
--  - Pólizas: un amparo por contrato (cumplimiento, anticipo, salarios, calidad, estabilidad, responsabilidad civil) con su
--    aseguradora, número, valor asegurado y vencimiento. El mínimo exigido (porcentaje × base) sale de la tabla de amparos.
--  - Modificaciones (adición, otrosí, prórroga, suspensión, reinicio, cesión) con estado «en trámite» o «firmada». Solo las
--    firmadas mueven la fecha fin vigente y la suspensión. El VALOR vigente del contrato sigue cambiando por un cambio aprobado o por
--    el director (una sola vía): la modificación documenta el instrumento y su firma; puede ligarse al cambio que la originó.
--  - Documentos del tercero (RUT, cámara de comercio, seguridad social...) como enlaces con fecha de expedición; su vigencia sale de
--    la tabla de tipos. No se guardan archivos ni cédulas.
-- Los amparos, los tipos de documento y los días son configuración (tablas y parámetros), no valores fijos en el código.

-- 1. CONFIGURACIÓN -----------------------------------------------------------------------------------------
create table public.poliza_amparos (
  nombre       text primary key,
  orden        integer not null,
  porcentaje   numeric(5, 2) not null check (porcentaje > 0 and porcentaje <= 100),
  base         text not null check (base in ('valor_contrato', 'valor_anticipo')),
  vigencia     text not null,
  fuente       text not null,
  estado_dato  text not null check (estado_dato in ('Verificado', 'Supuesto'))
);
insert into public.poliza_amparos (nombre, orden, porcentaje, base, vigencia, fuente, estado_dato) values
 ('Cumplimiento', 1, 30, 'valor_contrato', 'Duración del contrato más sus prórrogas', 'Minuta de contrato de obra El Silencio GL (paquete RAÍZ)', 'Verificado'),
 ('Buen manejo del anticipo', 2, 100, 'valor_anticipo', 'Duración del contrato y sus prórrogas', 'Minuta de contrato de obra El Silencio GL (paquete RAÍZ)', 'Verificado'),
 ('Salarios y prestaciones sociales', 3, 20, 'valor_contrato', 'Duración del contrato más tres (3) años', 'Minuta de contrato de obra El Silencio GL (paquete RAÍZ)', 'Verificado'),
 ('Calidad y buen funcionamiento', 4, 30, 'valor_contrato', 'Duración más tres (3) años desde la liquidación', 'Minuta de contrato de obra El Silencio GL (paquete RAÍZ)', 'Verificado'),
 ('Estabilidad de la obra', 5, 30, 'valor_contrato', 'Duración más tres (3) años desde la liquidación', 'Minuta de contrato de obra El Silencio GL (paquete RAÍZ)', 'Verificado'),
 ('Responsabilidad civil extracontractual', 6, 30, 'valor_contrato', 'Duración del contrato más sus prórrogas', 'Minuta de contrato de obra El Silencio GL (paquete RAÍZ)', 'Verificado');

create table public.documento_tipos (
  nombre         text primary key,
  orden          integer not null,
  vigencia_dias  integer not null check (vigencia_dias between 1 and 36500),
  fuente         text not null,
  estado_dato    text not null check (estado_dato in ('Verificado', 'Supuesto'))
);
insert into public.documento_tipos (nombre, orden, vigencia_dias, fuente, estado_dato) values
 ('Certificado de existencia y representación legal', 1, 30, 'Supuesto de diseño (RAÍZ); Greenland debe confirmar', 'Supuesto'),
 ('RUT', 2, 36500, 'El formulario RUT indica vigencia indefinida; pedir actualización ante cambios (RAÍZ)', 'Verificado'),
 ('Cédula del representante legal', 3, 36500, 'Supuesto de diseño (RAÍZ); Greenland debe confirmar', 'Supuesto'),
 ('Planilla de seguridad social (PILA)', 4, 30, 'Supuesto de diseño (RAÍZ); Greenland debe confirmar', 'Supuesto'),
 ('Certificación SG-SST', 5, 365, 'Supuesto de diseño (RAÍZ); Greenland debe confirmar', 'Supuesto'),
 ('Certificación bancaria', 6, 90, 'Supuesto de diseño (RAÍZ); Greenland debe confirmar', 'Supuesto'),
 ('Certificado de idoneidad / experiencia', 7, 365, 'Supuesto de diseño (RAÍZ); Greenland debe confirmar', 'Supuesto'),
 ('Estados financieros', 8, 365, 'Supuesto de diseño (RAÍZ); Greenland debe confirmar', 'Supuesto'),
 ('Consulta en listas restrictivas (SAGRILAFT)', 9, 365, 'Supuesto de diseño (RAÍZ); Greenland debe confirmar', 'Supuesto');

alter table public.poliza_amparos enable row level security;
alter table public.documento_tipos enable row level security;
revoke all on public.poliza_amparos, public.documento_tipos from anon, authenticated;
grant select on public.poliza_amparos, public.documento_tipos to authenticated;
create policy amparos_ver on public.poliza_amparos for select to authenticated using (true);
create policy doctipos_ver on public.documento_tipos for select to authenticated using (true);

insert into public.parametros (ambito, clave, valor, descripcion, fuente) values
 ('global', 'suspension_max_dias', '30', 'Días de suspensión de un contrato antes de ponerlo en rojo', 'Supuesto de diseño (RAÍZ); ajustar a la práctica de Greenland')
on conflict do nothing;

-- 2. PÓLIZAS ---------------------------------------------------------------------------------------------
create table public.contrato_polizas (
  id                uuid primary key default gen_random_uuid(),
  contrato_id       uuid not null references public.contratos (id) on delete cascade,
  proyecto_id       uuid not null references public.proyectos (id) on delete cascade,
  amparo            text not null references public.poliza_amparos (nombre),
  aseguradora       text check (length(aseguradora) <= 120),
  numero            text check (length(numero) <= 60),
  valor_asegurado   numeric(15, 2) check (valor_asegurado >= 0),
  fecha_expedicion  date,
  fecha_vencimiento date,
  estado            text not null default 'activa' check (estado in ('activa', 'cumplida')),
  enlace            text check (length(enlace) <= 500 and enlace ~ '^https?://[^[:space:]]+$'),
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),
  unique (contrato_id, amparo),
  check (fecha_expedicion is null or fecha_vencimiento is null or fecha_vencimiento >= fecha_expedicion)
);
create index contrato_polizas_proyecto_idx on public.contrato_polizas (proyecto_id);
create trigger contrato_polizas_actualizado before update on public.contrato_polizas
  for each row execute function public.marcar_actualizado();
create trigger contrato_polizas_audit after insert or update or delete on public.contrato_polizas
  for each row execute function public.auditar_tabla();

-- 3. MODIFICACIONES --------------------------------------------------------------------------------------
create table public.contrato_modificaciones (
  id               uuid primary key default gen_random_uuid(),
  contrato_id      uuid not null references public.contratos (id) on delete cascade,
  proyecto_id      uuid not null references public.proyectos (id) on delete cascade,
  tipo             text not null check (tipo in ('adicion', 'otrosi', 'prorroga', 'suspension', 'reinicio', 'cesion')),
  numero           integer not null check (numero > 0),
  fecha_firma      date,
  nueva_fecha_fin  date,
  valor            numeric(15, 2) not null default 0 check (valor >= 0),
  descripcion      text not null check (length(btrim(descripcion)) between 1 and 1000),
  justificacion    text check (length(justificacion) <= 1000),
  estado           text not null default 'en_tramite' check (estado in ('en_tramite', 'firmada')),
  cambio_id        uuid references public.cambios (id) on delete set null,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  unique (contrato_id, tipo, numero),
  check (estado <> 'firmada' or fecha_firma is not null)
);
create index contrato_modificaciones_contrato_idx on public.contrato_modificaciones (contrato_id);
create trigger contrato_modificaciones_actualizado before update on public.contrato_modificaciones
  for each row execute function public.marcar_actualizado();
create trigger contrato_modificaciones_audit after insert or update or delete on public.contrato_modificaciones
  for each row execute function public.auditar_tabla();

-- Fecha fin vigente y suspensión del contrato: se recalculan al cambiar las modificaciones (solo cuentan las firmadas).
-- Fecha fin vigente = la mayor entre la inicial y las nuevas fechas fin firmadas. Suspendido = hay más suspensiones
-- firmadas que reinicios firmados; «desde» es la fecha de la última suspensión.
alter table public.contratos add column fecha_fin_vigente date, add column suspendido_desde date;
update public.contratos set fecha_fin_vigente = fecha_fin_inicial;

create or replace function public.contratos_etapa_y_fechas()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_susp integer; v_reinicios integer;
begin
  if tg_op = 'INSERT' then
    new.etapa := case when new.estado_aprobacion = 'pendiente' then 3 else 4 end;
    new.fecha_etapa := public.hoy_co();
  else
    if old.estado_aprobacion = 'pendiente' and new.estado_aprobacion = 'aprobado' and new.etapa = 3 then new.etapa := 4; end if;
    if new.etapa is distinct from old.etapa then new.fecha_etapa := public.hoy_co(); end if;
  end if;
  new.fecha_fin_inicial := public.fecha_fin_plazo(new.fecha_acta_inicio, new.plazo_valor, new.plazo_unidad);
  if tg_op = 'INSERT' then
    new.fecha_fin_vigente := new.fecha_fin_inicial; new.suspendido_desde := null;
  else
    select greatest(new.fecha_fin_inicial, max(nueva_fecha_fin)) into new.fecha_fin_vigente
      from public.contrato_modificaciones where contrato_id = new.id and estado = 'firmada';
    select count(*) filter (where tipo = 'suspension'), count(*) filter (where tipo = 'reinicio') into v_susp, v_reinicios
      from public.contrato_modificaciones where contrato_id = new.id and estado = 'firmada';
    new.suspendido_desde := case when v_susp > v_reinicios then
      (select max(fecha_firma) from public.contrato_modificaciones where contrato_id = new.id and estado = 'firmada' and tipo = 'suspension') end;
  end if;
  return new;
end;
$$;

create function public.modificaciones_recalcular_contrato()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.contratos set actualizado_en = now() where id = coalesce(new.contrato_id, old.contrato_id);
  return null;
end;
$$;
create trigger modificaciones_recalcular after insert or update or delete on public.contrato_modificaciones
  for each row execute function public.modificaciones_recalcular_contrato();

-- 4. DOCUMENTOS DEL TERCERO --------------------------------------------------------------------------------
create table public.tercero_documentos (
  id                uuid primary key default gen_random_uuid(),
  tercero_id        uuid not null references public.terceros (id) on delete cascade,
  tipo              text not null references public.documento_tipos (nombre),
  fecha_expedicion  date not null,
  enlace            text check (length(enlace) <= 500 and enlace ~ '^https?://[^[:space:]]+$'),
  observaciones     text check (length(observaciones) <= 500),
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now()
);
create index tercero_documentos_tercero_idx on public.tercero_documentos (tercero_id);
create trigger tercero_documentos_actualizado before update on public.tercero_documentos
  for each row execute function public.marcar_actualizado();
create trigger tercero_documentos_audit after insert or update or delete on public.tercero_documentos
  for each row execute function public.auditar_tabla();
alter table public.tercero_documentos enable row level security;
revoke all on public.tercero_documentos from anon, authenticated;
grant select, insert, update, delete on public.tercero_documentos to authenticated;
create policy tdocs_ver    on public.tercero_documentos for select to authenticated using (public.puede_ver_aliados());
create policy tdocs_crear  on public.tercero_documentos for insert to authenticated with check (public.puede_editar_aliados());
create policy tdocs_editar on public.tercero_documentos for update to authenticated
  using (public.puede_editar_aliados()) with check (public.puede_editar_aliados());
create policy tdocs_borrar on public.tercero_documentos for delete to authenticated using (public.puede_editar_aliados());

-- Vigencia de los documentos de unos terceros, sin enlaces ni observaciones: lo usa el semáforo de un contrato, que ve
-- quien puede ver el contrato aunque no pueda ver el maestro. Solo se devuelve el último documento de cada tipo.
create function public.terceros_documentos_vigencia(p_terceros uuid[])
returns table (tercero_id uuid, tipo text, fecha_vencimiento date)
language sql stable security definer set search_path = ''
as $$
  select distinct on (d.tercero_id, d.tipo) d.tercero_id, d.tipo, (d.fecha_expedicion + t.vigencia_dias)
    from public.tercero_documentos d
    join public.documento_tipos t on t.nombre = d.tipo
   where d.tercero_id = any (p_terceros)
     and auth.uid() is not null
     and (public.puede_ver_aliados()
          or exists (select 1 from public.contratos c where c.tercero_id = d.tercero_id and public.puede_ver_proyecto(c.proyecto_id)))
   order by d.tercero_id, d.tipo, d.fecha_expedicion desc;
$$;
revoke execute on function public.terceros_documentos_vigencia(uuid[]) from public, anon;
grant execute on function public.terceros_documentos_vigencia(uuid[]) to authenticated;

-- 5. FUNCIONES DE ESCRITURA ----------------------------------------------------------------------------------
create function public.contrato_gestion_exigir(p_contrato uuid)
returns public.contratos language plpgsql stable security definer set search_path = ''
as $$
declare c public.contratos;
begin
  select * into c from public.contratos where id = p_contrato;
  if not found then raise exception 'Contrato no encontrado.' using errcode = '22023'; end if;
  if auth.uid() is null or not (public.puede_gestionar(c.proyecto_id) or public.puede_aprobar_contratos(c.proyecto_id)) then
    raise exception 'No tienes permiso para modificar este contrato.' using errcode = '42501';
  end if;
  return c;
end;
$$;
revoke execute on function public.contrato_gestion_exigir(uuid) from public, anon, authenticated;

-- Guarda la póliza de un amparo (la crea o la corrige).
create function public.poliza_guardar(p_contrato uuid, p_datos jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  c public.contratos; v_id uuid; v_amparo text := nullif(btrim(coalesce(p_datos ->> 'amparo', '')), '');
  v_valor numeric(15, 2); v_exp date; v_venc date; v_estado text := coalesce(nullif(btrim(coalesce(p_datos ->> 'estado', '')), ''), 'activa');
  v_enlace text := nullif(btrim(coalesce(p_datos ->> 'enlace', '')), '');
begin
  c := public.contrato_gestion_exigir(p_contrato);
  if v_amparo is null or not exists (select 1 from public.poliza_amparos where nombre = v_amparo) then
    raise exception 'Elige el amparo de la póliza.' using errcode = '22023';
  end if;
  begin
    v_valor := nullif(btrim(coalesce(p_datos ->> 'valor_asegurado', '')), '')::numeric;
    v_exp := nullif(btrim(coalesce(p_datos ->> 'fecha_expedicion', '')), '')::date;
    v_venc := nullif(btrim(coalesce(p_datos ->> 'fecha_vencimiento', '')), '')::date;
  exception when others then
    raise exception 'El valor asegurado o una fecha no son válidos.' using errcode = '22023';
  end;
  if v_estado not in ('activa', 'cumplida') then raise exception 'Estado de póliza no válido.' using errcode = '22023'; end if;
  if v_enlace is not null and v_enlace !~ '^https?://[^[:space:]]+$' then
    raise exception 'El enlace al soporte debe empezar por http:// o https://.' using errcode = '22023';
  end if;
  insert into public.contrato_polizas (contrato_id, proyecto_id, amparo, aseguradora, numero, valor_asegurado, fecha_expedicion, fecha_vencimiento, estado, enlace)
    values (p_contrato, c.proyecto_id, v_amparo, nullif(btrim(coalesce(p_datos ->> 'aseguradora', '')), ''), nullif(btrim(coalesce(p_datos ->> 'numero', '')), ''),
            v_valor, v_exp, v_venc, v_estado, v_enlace)
  on conflict (contrato_id, amparo) do update set aseguradora = excluded.aseguradora, numero = excluded.numero, valor_asegurado = excluded.valor_asegurado,
    fecha_expedicion = excluded.fecha_expedicion, fecha_vencimiento = excluded.fecha_vencimiento, estado = excluded.estado, enlace = excluded.enlace
  returning id into v_id;
  return v_id;
exception when check_violation then
  raise exception 'Un dato de la póliza no es válido (revisa las fechas y el tamaño de los textos).' using errcode = '22023';
  when numeric_value_out_of_range then
  raise exception 'El valor asegurado es demasiado grande.' using errcode = '22023';
end;
$$;

create function public.poliza_borrar(p_poliza uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_contrato uuid;
begin
  select contrato_id into v_contrato from public.contrato_polizas where id = p_poliza;
  if v_contrato is null then raise exception 'Póliza no encontrada.' using errcode = '22023'; end if;
  perform public.contrato_gestion_exigir(v_contrato);
  delete from public.contrato_polizas where id = p_poliza;
end;
$$;

-- Crea o corrige una modificación. El número es consecutivo por contrato y tipo.
create function public.modificacion_guardar(p_contrato uuid, p_id uuid, p_datos jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  c public.contratos; m public.contrato_modificaciones; v_id uuid;
  v_tipo text := nullif(btrim(coalesce(p_datos ->> 'tipo', '')), '');
  v_estado text := coalesce(nullif(btrim(coalesce(p_datos ->> 'estado', '')), ''), 'en_tramite');
  v_firma date; v_fin date; v_valor numeric(15, 2); v_cambio uuid;
  v_desc text := nullif(btrim(coalesce(p_datos ->> 'descripcion', '')), '');
  v_just text := nullif(btrim(coalesce(p_datos ->> 'justificacion', '')), '');
begin
  c := public.contrato_gestion_exigir(p_contrato);
  if c.estado_aprobacion = 'pendiente' then raise exception 'El contrato aún no está aprobado por el director general.' using errcode = '22023'; end if;
  if p_id is not null then
    select * into m from public.contrato_modificaciones where id = p_id and contrato_id = p_contrato for update;
    if not found then raise exception 'La modificación no existe en este contrato.' using errcode = '22023'; end if;
    v_tipo := m.tipo;  -- el tipo no cambia
  end if;
  if v_tipo is null or v_tipo not in ('adicion', 'otrosi', 'prorroga', 'suspension', 'reinicio', 'cesion') then
    raise exception 'Elige el tipo de modificación.' using errcode = '22023';
  end if;
  if v_estado not in ('en_tramite', 'firmada') then raise exception 'Estado de la modificación no válido.' using errcode = '22023'; end if;
  if v_desc is null then raise exception 'Describe la modificación.' using errcode = '22023'; end if;
  begin
    v_firma := nullif(btrim(coalesce(p_datos ->> 'fecha_firma', '')), '')::date;
    v_fin := nullif(btrim(coalesce(p_datos ->> 'nueva_fecha_fin', '')), '')::date;
    v_valor := coalesce(nullif(btrim(coalesce(p_datos ->> 'valor', '')), '')::numeric, 0);
    v_cambio := nullif(btrim(coalesce(p_datos ->> 'cambio_id', '')), '')::uuid;
  exception when others then
    raise exception 'Una fecha, el valor o el cambio no son válidos.' using errcode = '22023';
  end;
  if v_valor < 0 then raise exception 'El valor no puede ser negativo.' using errcode = '22023'; end if;
  if v_estado = 'firmada' and v_firma is null then raise exception 'Una modificación firmada necesita su fecha de firma.' using errcode = '22023'; end if;
  if v_fin is not null and v_tipo not in ('adicion', 'otrosi', 'prorroga') then
    raise exception 'La nueva fecha fin solo aplica a adiciones, otrosíes y prórrogas.' using errcode = '22023';
  end if;
  if v_valor > 0 and v_tipo not in ('adicion', 'otrosi') then raise exception 'El valor solo aplica a adiciones y otrosíes.' using errcode = '22023'; end if;
  if v_cambio is not null and not exists (select 1 from public.cambios where id = v_cambio and contrato_id = p_contrato) then
    raise exception 'El cambio no existe o no está ligado a este contrato.' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.contrato_modificaciones (contrato_id, proyecto_id, tipo, numero, fecha_firma, nueva_fecha_fin, valor, descripcion, justificacion, estado, cambio_id)
      values (p_contrato, c.proyecto_id, v_tipo,
              coalesce((select max(numero) from public.contrato_modificaciones where contrato_id = p_contrato and tipo = v_tipo), 0) + 1,
              v_firma, v_fin, v_valor, v_desc, v_just, v_estado, v_cambio)
      returning id into v_id;
  else
    update public.contrato_modificaciones set fecha_firma = v_firma, nueva_fecha_fin = v_fin, valor = v_valor, descripcion = v_desc,
      justificacion = v_just, estado = v_estado, cambio_id = v_cambio where id = p_id returning id into v_id;
  end if;
  return v_id;
exception when check_violation then
  raise exception 'Un dato de la modificación no es válido (revisa los textos y las fechas).' using errcode = '22023';
  when numeric_value_out_of_range then
  raise exception 'El valor es demasiado grande.' using errcode = '22023';
end;
$$;

-- Una modificación en trámite la borra quien gestiona el contrato; una firmada solo el administrador.
create function public.modificacion_borrar(p_modificacion uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare m public.contrato_modificaciones;
begin
  select * into m from public.contrato_modificaciones where id = p_modificacion;
  if not found then raise exception 'Modificación no encontrada.' using errcode = '22023'; end if;
  perform public.contrato_gestion_exigir(m.contrato_id);
  if m.estado = 'firmada' and not public.es_admin() then
    raise exception 'Una modificación firmada solo la borra el administrador.' using errcode = '42501';
  end if;
  delete from public.contrato_modificaciones where id = p_modificacion;
end;
$$;

revoke execute on function public.poliza_guardar(uuid, jsonb), public.poliza_borrar(uuid),
  public.modificacion_guardar(uuid, uuid, jsonb), public.modificacion_borrar(uuid) from public, anon;
grant execute on function public.poliza_guardar(uuid, jsonb), public.poliza_borrar(uuid),
  public.modificacion_guardar(uuid, uuid, jsonb), public.modificacion_borrar(uuid) to authenticated;

-- 6. LECTURA --------------------------------------------------------------------------------------------------
-- Se ven con las mismas reglas que el contrato (interventoría, solo los contratos que le asignaron).
alter table public.contrato_polizas enable row level security;
alter table public.contrato_modificaciones enable row level security;
revoke all on public.contrato_polizas, public.contrato_modificaciones from anon, authenticated;
grant select on public.contrato_polizas, public.contrato_modificaciones to authenticated;
create policy polizas_ver on public.contrato_polizas for select to authenticated
  using (exists (select 1 from public.contratos c where c.id = contrato_id));
create policy modificaciones_ver on public.contrato_modificaciones for select to authenticated
  using (exists (select 1 from public.contratos c where c.id = contrato_id));
