-- 0026: aliados y proveedores (maestro de terceros), contratantes y datos contractuales (capa 1 del paquete RAÍZ).
--
-- Qué agrega, sin cambiar lo que ya funciona (anticipo, aprobación del director, actas, asignación al presupuesto):
--  - Maestro de terceros con NIT o cédula normalizados (llave única; identificador temporal PEND- hasta tener el RUT).
--  - Maestro de contratantes (sociedades del grupo) y el contratante de cada proyecto.
--  - En cada contrato: el tercero que lo ejecuta, la etapa de su ruta de vida (1 a 9), fechas de firma e inicio, plazo y
--    fecha fin inicial calculada, autorización de asamblea, consecutivo y orden de servicio. Historial de cambios de etapa.
-- Los porcentajes, días y topes son parámetros (tabla parametros), nunca valores fijos.
-- No se guarda cédula de representantes ni documentos: solo lo necesario para esta capa (minimización de datos).

-- 1. NIT -----------------------------------------------------------------------------
-- Dígito de verificación de un NIT colombiano (módulo 11 con los pesos de la DIAN).
create function public.nit_digito(p_numero text)
returns integer language plpgsql immutable set search_path = ''
as $$
declare
  pesos integer[] := array[3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  s integer := 0; i integer; r integer;
begin
  for i in 1 .. length(p_numero) loop
    s := s + substr(p_numero, length(p_numero) - i + 1, 1)::integer * pesos[i];
  end loop;
  r := s % 11;
  return case when r < 2 then r else 11 - r end;
end;
$$;

-- Deja el NIT o la cédula en una sola forma (sin puntos ni espacios) y lo valida. Acepta:
--  - solo números (5 a 12), con o sin dígito de verificación («901519601-4»); si trae el dígito, debe coincidir;
--  - un identificador temporal «PEND-NOMBRE» para el tercero que aún no entrega el RUT.
create function public.nit_normalizar(p_texto text)
returns text language plpgsql immutable set search_path = ''
as $$
declare t text := upper(regexp_replace(btrim(coalesce(p_texto, '')), '[[:space:].]', '', 'g')); v_dig text; v_dv text;
begin
  if t ~ '^PEND-[A-Z0-9-]{1,40}$' then return t; end if;
  if t ~ '^[0-9]{5,12}(-[0-9])?$' then
    if position('-' in t) > 0 then
      v_dig := split_part(t, '-', 1); v_dv := split_part(t, '-', 2);
      if public.nit_digito(v_dig)::text <> v_dv then
        raise exception 'El dígito de verificación no coincide con el NIT (debería ser %).', public.nit_digito(v_dig) using errcode = '22023';
      end if;
    end if;
    return t;
  end if;
  raise exception 'El NIT o la cédula no es válido: usa solo números (con o sin dígito de verificación, por ejemplo 901519601-4) o un identificador temporal PEND-NOMBRE.'
    using errcode = '22023';
end;
$$;

-- 2. QUIÉN PUEDE VER Y EDITAR ----------------------------------------------------------
-- Ver: quienes ven todo el portafolio (administrador, director general, analista PMO, finanzas) y los gerentes de proyecto.
-- Editar terceros: administrador, director general y gerentes de proyecto. Editar contratantes: administrador y director general.
create function public.puede_ver_aliados()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce(public.mi_rol_global() in ('administrador', 'director_general', 'analista_pmo', 'finanzas'), false)
      or exists (select 1 from public.miembros_proyecto where usuario_id = auth.uid() and rol = 'gerente');
$$;
create function public.puede_editar_aliados()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce(public.mi_rol_global() in ('administrador', 'director_general'), false)
      or exists (select 1 from public.miembros_proyecto where usuario_id = auth.uid() and rol = 'gerente');
$$;
create function public.puede_editar_contratantes()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(public.mi_rol_global() in ('administrador', 'director_general'), false); $$;
revoke execute on function public.puede_ver_aliados(), public.puede_editar_aliados(), public.puede_editar_contratantes() from public, anon;
grant execute on function public.puede_ver_aliados(), public.puede_editar_aliados(), public.puede_editar_contratantes() to authenticated;

-- 3. CONTRATANTES ------------------------------------------------------------------------
create table public.contratantes (
  id                    uuid primary key default gen_random_uuid(),
  codigo                text not null unique,
  razon_social          text not null check (length(btrim(razon_social)) between 1 and 200),
  nit                   text unique,
  representante_legal   text check (length(representante_legal) <= 200),
  municipio             text check (length(municipio) <= 100),
  correo_notificacion   text check (length(correo_notificacion) <= 200 and correo_notificacion ~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$'),
  correo_facturacion    text check (length(correo_facturacion) <= 200 and correo_facturacion ~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$'),
  tope_smmlv            integer check (tope_smmlv > 0),  -- tope de contratación sin asamblea; vacío = el parámetro general
  estado                text not null default 'activo' check (estado in ('activo', 'inactivo')),
  observaciones         text check (length(observaciones) <= 1000),
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now()
);
create unique index contratantes_razon_uq on public.contratantes (lower(btrim(razon_social)));

create function public.contratantes_preparar()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  new.razon_social := btrim(new.razon_social);
  new.nit := case when nullif(btrim(coalesce(new.nit, '')), '') is null then null else public.nit_normalizar(new.nit) end;
  new.representante_legal := nullif(btrim(coalesce(new.representante_legal, '')), '');
  new.municipio := nullif(btrim(coalesce(new.municipio, '')), '');
  new.correo_notificacion := lower(nullif(btrim(coalesce(new.correo_notificacion, '')), ''));
  new.correo_facturacion := lower(nullif(btrim(coalesce(new.correo_facturacion, '')), ''));
  new.observaciones := nullif(btrim(coalesce(new.observaciones, '')), '');
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(872601);
    new.codigo := 'CT-' || lpad((coalesce((select max(substr(codigo, 4)::integer) from public.contratantes), 0) + 1)::text, 2, '0');
  else
    new.codigo := old.codigo;  -- el código no cambia
    new.actualizado_en := now();
  end if;
  return new;
end;
$$;
create trigger contratantes_preparar before insert or update on public.contratantes
  for each row execute function public.contratantes_preparar();
create trigger contratantes_audit after insert or update or delete on public.contratantes
  for each row execute function public.auditar_tabla();

alter table public.contratantes enable row level security;
revoke all on public.contratantes from anon, authenticated;
grant select, insert, update on public.contratantes to authenticated;
create policy contratantes_ver    on public.contratantes for select to authenticated using (public.puede_ver_aliados());
create policy contratantes_crear  on public.contratantes for insert to authenticated with check (public.puede_editar_contratantes());
create policy contratantes_editar on public.contratantes for update to authenticated
  using (public.puede_editar_contratantes()) with check (public.puede_editar_contratantes());

-- El contratante de cada proyecto.
alter table public.proyectos add column contratante_id uuid references public.contratantes (id) on delete restrict;
create index proyectos_contratante_idx on public.proyectos (contratante_id);

create function public.proyecto_contratante_asignar(p_proyecto uuid, p_contratante uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.puede_gestionar(p_proyecto) then
    raise exception 'No tienes permiso para cambiar el contratante de este proyecto.' using errcode = '42501';
  end if;
  if p_contratante is not null and not exists (select 1 from public.contratantes where id = p_contratante and estado = 'activo') then
    raise exception 'El contratante no existe o está inactivo.' using errcode = '22023';
  end if;
  update public.proyectos set contratante_id = p_contratante where id = p_proyecto;
end;
$$;
revoke execute on function public.proyecto_contratante_asignar(uuid, uuid) from public, anon;
grant execute on function public.proyecto_contratante_asignar(uuid, uuid) to authenticated;

-- 4. TERCEROS ------------------------------------------------------------------------------
create table public.terceros (
  id                   uuid primary key default gen_random_uuid(),
  nit                  text not null unique,
  tipo_persona         text not null default 'juridica' check (tipo_persona in ('juridica', 'natural')),
  razon_social         text not null check (length(btrim(razon_social)) between 1 and 200),
  tipo_tercero         text not null default 'contratista' check (tipo_tercero in ('contratista', 'proveedor', 'consultor', 'interventor', 'otro')),
  especialidad         text check (length(especialidad) <= 200),
  municipio            text check (length(municipio) <= 100),
  direccion            text check (length(direccion) <= 200),
  correo_notificacion  text check (length(correo_notificacion) <= 200 and correo_notificacion ~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$'),
  telefono             text check (telefono ~ '^[0-9+() .-]{6,40}$'),
  representante_legal  text check (length(representante_legal) <= 200),
  estado               text not null default 'activo' check (estado in ('activo', 'inactivo')),
  fuente               text check (length(fuente) <= 300),   -- de dónde salió el dato (enlace o referencia al soporte)
  observaciones        text check (length(observaciones) <= 1000),
  creado_en            timestamptz not null default now(),
  actualizado_en       timestamptz not null default now()
);
create index terceros_nombre_idx on public.terceros (lower(razon_social));

create function public.terceros_preparar()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  new.nit := public.nit_normalizar(new.nit);
  new.razon_social := btrim(new.razon_social);
  new.especialidad := nullif(btrim(coalesce(new.especialidad, '')), '');
  new.municipio := nullif(btrim(coalesce(new.municipio, '')), '');
  new.direccion := nullif(btrim(coalesce(new.direccion, '')), '');
  new.correo_notificacion := lower(nullif(btrim(coalesce(new.correo_notificacion, '')), ''));
  new.telefono := nullif(btrim(coalesce(new.telefono, '')), '');
  new.representante_legal := nullif(btrim(coalesce(new.representante_legal, '')), '');
  new.fuente := nullif(btrim(coalesce(new.fuente, '')), '');
  new.observaciones := nullif(btrim(coalesce(new.observaciones, '')), '');
  if tg_op = 'UPDATE' then new.actualizado_en := now(); end if;
  return new;
end;
$$;
create trigger terceros_preparar before insert or update on public.terceros
  for each row execute function public.terceros_preparar();
create trigger terceros_audit after insert or update or delete on public.terceros
  for each row execute function public.auditar_tabla();

-- Un tercero no se borra (los contratos lo referencian): se marca «inactivo».
alter table public.terceros enable row level security;
revoke all on public.terceros from anon, authenticated;
grant select, insert, update on public.terceros to authenticated;
create policy terceros_ver    on public.terceros for select to authenticated using (public.puede_ver_aliados());
create policy terceros_crear  on public.terceros for insert to authenticated with check (public.puede_editar_aliados());
create policy terceros_editar on public.terceros for update to authenticated
  using (public.puede_editar_aliados()) with check (public.puede_editar_aliados());

-- 5. DATOS CONTRACTUALES EN CADA CONTRATO ----------------------------------------------------
alter table public.contratos
  add column tercero_id          uuid references public.terceros (id) on delete restrict,
  add column consecutivo         text check (length(consecutivo) <= 60),
  add column orden_servicio_sap  text check (length(orden_servicio_sap) <= 60),
  add column etapa               smallint not null default 4 check (etapa between 1 and 9),
  add column fecha_etapa         date not null default public.hoy_co(),
  add column fecha_firma         date,
  add column fecha_acta_inicio   date,
  add column plazo_valor         integer check (plazo_valor between 1 and 3650),
  add column plazo_unidad        text check (plazo_unidad in ('dias_calendario', 'dias_habiles', 'meses')),
  add column fecha_fin_inicial   date,
  add column autorizacion_asamblea text check (length(autorizacion_asamblea) <= 200),
  add constraint contratos_plazo_completo check ((plazo_valor is null) = (plazo_unidad is null));
create index contratos_tercero_idx on public.contratos (tercero_id);

-- Los contratos que ya existían: pendientes de aprobación = etapa 3; con actas de pago = etapa 6 (ejecución);
-- aprobados sin actas = etapa 4 (firmas). Es un punto de partida: el gerente la ajusta.
update public.contratos c set
  etapa = case when c.estado_aprobacion = 'pendiente' then 3
               when exists (select 1 from public.actas_pago a where a.contrato_id = c.id) then 6
               else 4 end,
  fecha_etapa = coalesce(c.aprobado_en::date, c.creado_en::date);

-- Fecha de fin = acta de inicio + plazo (días calendario, hábiles o meses).
create function public.fecha_fin_plazo(p_inicio date, p_valor integer, p_unidad text)
returns date language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_inicio is null or p_valor is null or p_unidad is null then return null; end if;
  return case p_unidad
    when 'dias_calendario' then p_inicio + p_valor
    when 'dias_habiles' then public.dias_habiles_sumar(p_inicio, p_valor)
    when 'meses' then (p_inicio + make_interval(months => p_valor))::date
  end;
end;
$$;
revoke execute on function public.fecha_fin_plazo(date, integer, text) from public, anon;
grant execute on function public.fecha_fin_plazo(date, integer, text) to authenticated;

create table public.contrato_etapa_historial (
  id             bigint generated always as identity primary key,
  contrato_id    uuid not null references public.contratos (id) on delete cascade,
  proyecto_id    uuid not null references public.proyectos (id) on delete cascade,
  etapa_anterior smallint,
  etapa_nueva    smallint not null,
  motivo         text check (length(motivo) <= 500),
  usuario_id     uuid default auth.uid(),
  creado_en      timestamptz not null default now()
);
create index contrato_etapa_historial_idx on public.contrato_etapa_historial (contrato_id, creado_en);
alter table public.contrato_etapa_historial enable row level security;
revoke all on public.contrato_etapa_historial from anon, authenticated;
grant select on public.contrato_etapa_historial to authenticated;
create policy etapa_historial_ver on public.contrato_etapa_historial for select to authenticated
  using (exists (select 1 from public.contratos c where c.id = contrato_id));

-- Etapa inicial, avance automático al aprobar y fecha fin inicial calculada.
create function public.contratos_etapa_y_fechas()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.etapa := case when new.estado_aprobacion = 'pendiente' then 3 else 4 end;
    new.fecha_etapa := public.hoy_co();
  else
    if old.estado_aprobacion = 'pendiente' and new.estado_aprobacion = 'aprobado' and new.etapa = 3 then new.etapa := 4; end if;
    if new.etapa is distinct from old.etapa then new.fecha_etapa := public.hoy_co(); end if;
  end if;
  new.fecha_fin_inicial := public.fecha_fin_plazo(new.fecha_acta_inicio, new.plazo_valor, new.plazo_unidad);
  return new;
end;
$$;
create trigger contratos_etapa_y_fechas before insert or update on public.contratos
  for each row execute function public.contratos_etapa_y_fechas();

-- Crear y actualizar un contrato ahora acepta el tercero (tercero_id): el nombre del contratista se toma de él.
create or replace function public.contrato_crear(p_proyecto uuid, p_datos jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid; v_valor numeric(15,2); v_aprueba boolean; v_tercero uuid; v_nombre text;
begin
  if auth.uid() is null or not public.puede_gestionar(p_proyecto) then
    raise exception 'No tienes permiso para registrar contratos en este proyecto.' using errcode = '42501';
  end if;
  begin
    v_valor := nullif(btrim(coalesce(p_datos ->> 'valor', '')), '')::numeric;
  exception when others then
    raise exception 'El valor del contrato debe ser un número válido.' using errcode = '22023';
  end;
  if v_valor is null or v_valor <= 0 then raise exception 'El valor del contrato debe ser mayor que cero.' using errcode = '22023'; end if;
  if nullif(btrim(coalesce(p_datos ->> 'tercero_id', '')), '') is not null then
    begin v_tercero := (p_datos ->> 'tercero_id')::uuid; exception when others then
      raise exception 'El tercero no es válido.' using errcode = '22023'; end;
    select razon_social into v_nombre from public.terceros where id = v_tercero and estado = 'activo';
    if v_nombre is null then raise exception 'El tercero no existe o está inactivo.' using errcode = '22023'; end if;
  else
    v_nombre := public.cambio_leer_texto(p_datos, 'contratista', 200, true);
  end if;
  v_aprueba := public.puede_aprobar_contratos(p_proyecto);   -- si lo crea quien aprueba, nace aprobado
  insert into public.contratos (proyecto_id, tipo, contratista, tercero_id, objeto, valor, retencion_pct, estado_aprobacion, aprobado_por, aprobado_en)
    values (p_proyecto,
      coalesce(p_datos ->> 'tipo', ''),
      v_nombre, v_tercero,
      public.cambio_leer_texto(p_datos, 'objeto', 1000, true),
      v_valor,
      coalesce(public.parametro('retencion_garantia_pct', p_proyecto)::numeric, 10),
      case when v_aprueba then 'aprobado' else 'pendiente' end, case when v_aprueba then auth.uid() end, case when v_aprueba then now() end)
    returning id into v_id;
  return v_id;
exception when check_violation then
  raise exception 'Tipo de contrato o valor no válido.' using errcode = '22023';
  when numeric_value_out_of_range then
  raise exception 'El valor del contrato es demasiado grande.' using errcode = '22023';
end;
$$;

create or replace function public.contrato_actualizar(p_contrato uuid, p_datos jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare c public.contratos; v_valor numeric(15,2); v_pagado numeric; v_amortizado numeric; v_tercero uuid; v_nombre text;
begin
  select * into c from public.contratos where id = p_contrato for update;
  if not found then raise exception 'Contrato no encontrado.' using errcode = '22023'; end if;
  if auth.uid() is null or not (public.puede_gestionar(c.proyecto_id) or public.puede_aprobar_contratos(c.proyecto_id)) then
    raise exception 'No tienes permiso para editar este contrato.' using errcode = '42501';
  end if;
  begin
    v_valor := nullif(btrim(coalesce(p_datos ->> 'valor', '')), '')::numeric;
  exception when others then
    raise exception 'El valor del contrato debe ser un número válido.' using errcode = '22023';
  end;
  if v_valor is null or v_valor <= 0 then raise exception 'El valor del contrato debe ser mayor que cero.' using errcode = '22023'; end if;
  if c.estado_aprobacion = 'aprobado' and v_valor <> c.valor and not public.puede_aprobar_contratos(c.proyecto_id) then
    raise exception 'El valor de un contrato aprobado solo lo cambia el director general (o se ajusta con un cambio aprobado).' using errcode = '42501';
  end if;
  select coalesce(sum(valor_bruto), 0) into v_pagado from public.actas_pago where contrato_id = p_contrato;
  if v_valor < v_pagado then
    raise exception 'El valor del contrato no puede ser menor que lo ya facturado en actas (%).', v_pagado using errcode = '22023';
  end if;
  select coalesce(sum(amortizacion), 0) into v_amortizado from public.actas_pago where contrato_id = p_contrato;
  v_tercero := c.tercero_id; v_nombre := null;
  if nullif(btrim(coalesce(p_datos ->> 'tercero_id', '')), '') is not null then
    begin v_tercero := (p_datos ->> 'tercero_id')::uuid; exception when others then
      raise exception 'El tercero no es válido.' using errcode = '22023'; end;
    if v_tercero is distinct from c.tercero_id then
      select razon_social into v_nombre from public.terceros where id = v_tercero and estado = 'activo';
      if v_nombre is null then raise exception 'El tercero no existe o está inactivo.' using errcode = '22023'; end if;
    end if;
  end if;
  update public.contratos set
    tipo = coalesce(p_datos ->> 'tipo', tipo),
    tercero_id = v_tercero,
    contratista = case when v_nombre is not null then v_nombre
                       when c.tercero_id is not null then c.contratista     -- el nombre sigue al tercero
                       else public.cambio_leer_texto(p_datos, 'contratista', 200, true) end,
    objeto = public.cambio_leer_texto(p_datos, 'objeto', 1000, true),
    valor = v_valor,
    anticipo_valor = case when c.anticipo_pct > 0 then greatest(round(v_valor * c.anticipo_pct / 100, 2), v_amortizado) else c.anticipo_valor end
  where id = p_contrato;
exception when check_violation then
  raise exception 'Tipo de contrato o valor no válido.' using errcode = '22023';
  when numeric_value_out_of_range then
  raise exception 'El valor del contrato es demasiado grande.' using errcode = '22023';
end;
$$;

-- Datos contractuales: consecutivo, orden de servicio, fechas, plazo y autorización de asamblea.
create function public.contrato_datos_guardar(p_contrato uuid, p_datos jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  c public.contratos; v_firma date; v_inicio date; v_plazo integer; v_unidad text;
  v_consec text; v_sap text; v_asamblea text;
begin
  select * into c from public.contratos where id = p_contrato for update;
  if not found then raise exception 'Contrato no encontrado.' using errcode = '22023'; end if;
  if auth.uid() is null or not (public.puede_gestionar(c.proyecto_id) or public.puede_aprobar_contratos(c.proyecto_id)) then
    raise exception 'No tienes permiso para editar este contrato.' using errcode = '42501';
  end if;
  begin
    v_firma := nullif(btrim(coalesce(p_datos ->> 'fecha_firma', '')), '')::date;
    v_inicio := nullif(btrim(coalesce(p_datos ->> 'fecha_acta_inicio', '')), '')::date;
    v_plazo := nullif(btrim(coalesce(p_datos ->> 'plazo_valor', '')), '')::integer;
  exception when others then
    raise exception 'Una fecha o el plazo no son válidos.' using errcode = '22023';
  end;
  v_unidad := nullif(btrim(coalesce(p_datos ->> 'plazo_unidad', '')), '');
  if (v_plazo is null) <> (v_unidad is null) then
    raise exception 'El plazo necesita el número y la unidad (días calendario, días hábiles o meses).' using errcode = '22023';
  end if;
  if v_firma is not null and v_inicio is not null and v_inicio < v_firma then
    raise exception 'El acta de inicio no puede ser anterior a la firma del contrato.' using errcode = '22023';
  end if;
  v_consec := nullif(btrim(coalesce(p_datos ->> 'consecutivo', '')), '');
  v_sap := nullif(btrim(coalesce(p_datos ->> 'orden_servicio_sap', '')), '');
  v_asamblea := nullif(btrim(coalesce(p_datos ->> 'autorizacion_asamblea', '')), '');
  update public.contratos set fecha_firma = v_firma, fecha_acta_inicio = v_inicio, plazo_valor = v_plazo, plazo_unidad = v_unidad,
    consecutivo = v_consec, orden_servicio_sap = v_sap, autorizacion_asamblea = v_asamblea
  where id = p_contrato;
exception when check_violation then
  raise exception 'Un dato del contrato es demasiado largo o no es válido.' using errcode = '22023';
end;
$$;

-- Cambiar la etapa: se avanza de una en una; retroceder o archivar exige las condiciones de abajo y queda en el historial.
create function public.contrato_etapa_cambiar(p_contrato uuid, p_etapa integer, p_motivo text)
returns void language plpgsql security definer set search_path = ''
as $$
declare c public.contratos; v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  select * into c from public.contratos where id = p_contrato for update;
  if not found then raise exception 'Contrato no encontrado.' using errcode = '22023'; end if;
  if auth.uid() is null or not public.puede_gestionar(c.proyecto_id) then
    raise exception 'No tienes permiso para cambiar la etapa de este contrato.' using errcode = '42501';
  end if;
  if p_etapa is null or p_etapa < 1 or p_etapa > 9 then raise exception 'La etapa no es válida.' using errcode = '22023'; end if;
  if p_etapa = c.etapa then return; end if;
  if v_motivo is not null and length(v_motivo) > 500 then raise exception 'El motivo no puede superar 500 caracteres.' using errcode = '22023'; end if;
  if c.estado_aprobacion = 'pendiente' and p_etapa > 3 then
    raise exception 'El contrato aún no está aprobado por el director general: no puede pasar de la etapa 3.' using errcode = '22023';
  end if;
  if p_etapa > c.etapa then
    if p_etapa <> c.etapa + 1 then raise exception 'La etapa se avanza de una en una.' using errcode = '22023'; end if;
    if p_etapa = 9 and c.etapa <> 8 then raise exception 'Solo se archiva un contrato que ya pasó por las garantías postcontractuales (etapa 8).' using errcode = '22023'; end if;
  elsif v_motivo is null or length(v_motivo) < 3 then
    raise exception 'Para devolver un contrato a una etapa anterior escribe el motivo (mínimo 3 caracteres).' using errcode = '22023';
  end if;
  update public.contratos set etapa = p_etapa where id = p_contrato;
  insert into public.contrato_etapa_historial (contrato_id, proyecto_id, etapa_anterior, etapa_nueva, motivo)
    values (p_contrato, c.proyecto_id, c.etapa, p_etapa, v_motivo);
end;
$$;
revoke execute on function public.contrato_datos_guardar(uuid, jsonb), public.contrato_etapa_cambiar(uuid, integer, text) from public, anon;
grant execute on function public.contrato_datos_guardar(uuid, jsonb), public.contrato_etapa_cambiar(uuid, integer, text) to authenticated;

-- 6. PARÁMETROS ----------------------------------------------------------------------------------------
insert into public.parametros (ambito, clave, valor, descripcion, fuente) values
 ('global', 'smmlv_cop', '1750905', 'Salario mínimo mensual legal vigente (COP): base del tope de contratación sin asamblea', 'Decreto 1469 de 2025; confirmado el 3 de noviembre de 2026 en fuentes secundarias (hay reportes de una suspensión judicial sin verificar): revisar la vigencia'),
 ('global', 'tope_asamblea_smmlv', '600', 'Contratos con valor mayor a este número de SMMLV necesitan autorización de asamblea', 'Certificados de existencia y representación de los contratantes (según el paquete RAÍZ); confirmar con Jurídica'),
 ('global', 'alerta_ambar_dias', '30', 'Días de anticipación para avisar un vencimiento (ámbar)', 'Supuesto de diseño (RAÍZ)'),
 ('global', 'etapa_dias_max_1', '7',  'Días máximos en la etapa 1 (Preparación)', 'Supuesto de diseño (RAÍZ); ajustar a la práctica de Greenland'),
 ('global', 'etapa_dias_max_2', '5',  'Días máximos en la etapa 2 (Revisión del contratista)', 'Supuesto de diseño (RAÍZ); ajustar a la práctica de Greenland'),
 ('global', 'etapa_dias_max_3', '7',  'Días máximos en la etapa 3 (Aprobación Greenland)', 'Supuesto de diseño (RAÍZ); ajustar a la práctica de Greenland'),
 ('global', 'etapa_dias_max_4', '5',  'Días máximos en la etapa 4 (Firmas)', 'Supuesto de diseño (RAÍZ); ajustar a la práctica de Greenland'),
 ('global', 'etapa_dias_max_5', '15', 'Días máximos en la etapa 5 (Garantías e inicio)', 'Supuesto de diseño (RAÍZ); ajustar a la práctica de Greenland'),
 ('global', 'etapa_dias_max_7', '60', 'Días máximos en la etapa 7 (Liquidación)', 'Supuesto de diseño (RAÍZ); ajustar a la práctica de Greenland')
on conflict do nothing;
