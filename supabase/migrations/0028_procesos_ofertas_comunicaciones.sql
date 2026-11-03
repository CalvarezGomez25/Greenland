-- 0028: aliados, capa 3 (paquete RAÍZ): procesos de contratación, ofertas por ronda y comunicaciones con compromisos.
--
--  - Procesos (PR-01…) de un proyecto: invitación, cierre de propuestas, presupuesto de referencia, estado y adjudicatario.
--  - Ofertas (OF-001…) por proceso y ronda: valor, plazo, vigencia, habilitación y cinco calificaciones de 1 a 5. Los puntajes
--    (precio, cualitativo, total y orden) NO se guardan: se calculan al mostrar con los pesos de los parámetros.
--  - Adjudicar una oferta marca el proceso y el oferente; el contrato se registra desde la oferta adjudicada y se vincula al proceso.
--    La interventoría recomienda pero no adjudica: no ve los procesos.
--  - Comunicaciones de un contrato con compromisos (fecha, responsable, estado) que alimentan el semáforo del contrato.

-- 1. PARÁMETROS ------------------------------------------------------------------------------------------
insert into public.parametros (ambito, clave, valor, descripcion, fuente) values
 ('global', 'peso_precio', '0.40', 'Peso del puntaje de precio en el puntaje total de una oferta (el resto es el cualitativo)', 'Supuesto de diseño (RAÍZ); ajustar a la práctica de Greenland'),
 ('global', 'peso_experiencia', '0.15', 'Peso de la experiencia en el puntaje cualitativo', 'Supuesto de diseño (RAÍZ)'),
 ('global', 'peso_capacidad', '0.15', 'Peso de la capacidad técnica en el puntaje cualitativo', 'Supuesto de diseño (RAÍZ)'),
 ('global', 'peso_programacion', '0.10', 'Peso de la programación y el plazo en el puntaje cualitativo', 'Supuesto de diseño (RAÍZ)'),
 ('global', 'peso_comercial', '0.10', 'Peso de las condiciones comerciales en el puntaje cualitativo', 'Supuesto de diseño (RAÍZ)'),
 ('global', 'peso_sst', '0.10', 'Peso de SST y documentación en el puntaje cualitativo', 'Supuesto de diseño (RAÍZ)'),
 ('global', 'proceso_eval_dias', '15', 'Días para evaluar las ofertas desde el cierre antes de poner el proceso en rojo', 'Supuesto de diseño (RAÍZ)')
on conflict do nothing;

-- 2. PROCESOS ---------------------------------------------------------------------------------------------
create table public.procesos (
  id                      uuid primary key default gen_random_uuid(),
  proyecto_id             uuid not null references public.proyectos (id) on delete cascade,
  codigo                  text not null,
  objeto                  text not null check (length(btrim(objeto)) between 1 and 1000),
  tipo_servicio           text not null default 'otro' check (tipo_servicio in ('obra_civil', 'estructuras', 'hidraulicas', 'vias', 'diseno', 'interventoria', 'suministro', 'otro')),
  modalidad               text check (length(modalidad) <= 100),
  gestor                  text check (length(gestor) <= 200),
  fecha_invitacion        date,
  cierre_propuestas       date,
  presupuesto_referencia  numeric(15, 2) check (presupuesto_referencia >= 0),
  estado                  text not null default 'en_preparacion' check (estado in ('en_preparacion', 'abierta', 'en_evaluacion', 'adjudicada', 'desierta', 'cancelada', 'por_confirmar')),
  adjudicatario_id        uuid references public.terceros (id) on delete restrict,
  contrato_id             uuid references public.contratos (id) on delete set null,
  enlace                  text check (length(enlace) <= 500 and enlace ~ '^https?://[^[:space:]]+$'),
  observaciones           text check (length(observaciones) <= 1000),
  creado_en               timestamptz not null default now(),
  actualizado_en          timestamptz not null default now(),
  unique (proyecto_id, codigo)
);
create index procesos_proyecto_idx on public.procesos (proyecto_id);
create trigger procesos_actualizado before update on public.procesos for each row execute function public.marcar_actualizado();
create trigger procesos_audit after insert or update or delete on public.procesos for each row execute function public.auditar_tabla();

create table public.ofertas (
  id                  uuid primary key default gen_random_uuid(),
  proceso_id          uuid not null references public.procesos (id) on delete cascade,
  proyecto_id         uuid not null references public.proyectos (id) on delete cascade,
  codigo              text not null,
  tercero_id          uuid not null references public.terceros (id) on delete restrict,
  oferente            text not null,   -- nombre del oferente al registrar la oferta: lo ve quien no ve el maestro de terceros
  ronda               integer not null default 1 check (ronda between 1 and 20),
  fecha_recepcion     date,
  valor_total         numeric(15, 2) check (valor_total >= 0),
  aiu_pct             numeric(6, 2) check (aiu_pct between 0 and 100),
  plazo_dias          integer check (plazo_dias between 1 and 3650),
  anticipo_pct        numeric(5, 2) check (anticipo_pct between 0 and 100),
  vigencia_hasta      date,
  incluye_polizas     boolean,
  apu_discriminado    boolean,
  habilitada          text check (habilitada in ('si', 'no')),
  estado              text not null default 'invitado' check (estado in ('invitado', 'recibida', 'en_aclaracion', 'descartada', 'adjudicada', 'no_presento', 'por_confirmar')),
  crit_experiencia    smallint check (crit_experiencia between 1 and 5),
  crit_capacidad      smallint check (crit_capacidad between 1 and 5),
  crit_programacion   smallint check (crit_programacion between 1 and 5),
  crit_comercial      smallint check (crit_comercial between 1 and 5),
  crit_sst            smallint check (crit_sst between 1 and 5),
  enlace              text check (length(enlace) <= 500 and enlace ~ '^https?://[^[:space:]]+$'),
  observaciones       text check (length(observaciones) <= 1000),
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now(),
  unique (proyecto_id, codigo),
  unique (proceso_id, tercero_id, ronda)
);
create index ofertas_proceso_idx on public.ofertas (proceso_id);
create trigger ofertas_actualizado before update on public.ofertas for each row execute function public.marcar_actualizado();
create trigger ofertas_audit after insert or update or delete on public.ofertas for each row execute function public.auditar_tabla();

-- 3. COMUNICACIONES Y COMPROMISOS --------------------------------------------------------------------------
create table public.contrato_comunicaciones (
  id               uuid primary key default gen_random_uuid(),
  contrato_id      uuid not null references public.contratos (id) on delete cascade,
  proyecto_id      uuid not null references public.proyectos (id) on delete cascade,
  fecha            date not null,
  canal            text not null default 'correo' check (canal in ('correo', 'reunion', 'llamada', 'chat', 'visita_obra', 'comunicacion_escrita', 'acta', 'revision_aprobacion')),
  asunto           text not null check (length(btrim(asunto)) between 1 and 200),
  resumen          text check (length(resumen) <= 1000),
  enlace           text check (length(enlace) <= 500 and enlace ~ '^https?://[^[:space:]]+$'),
  responsable      text check (length(responsable) <= 200),
  requiere_accion  boolean not null default false,
  fecha_compromiso date,
  estado           text not null default 'abierto' check (estado in ('abierto', 'cerrado')),
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  check (not requiere_accion or fecha_compromiso is not null or estado = 'cerrado')
);
create index contrato_comunicaciones_idx on public.contrato_comunicaciones (contrato_id, fecha desc);
create trigger contrato_comunicaciones_actualizado before update on public.contrato_comunicaciones for each row execute function public.marcar_actualizado();
create trigger contrato_comunicaciones_audit after insert or update or delete on public.contrato_comunicaciones for each row execute function public.auditar_tabla();

-- 4. LECTURA ---------------------------------------------------------------------------------------------------
-- Procesos y ofertas: quien ve el presupuesto del proyecto (la interventoría no: recomienda, pero no adjudica).
-- Comunicaciones: con las mismas reglas que el contrato.
alter table public.procesos enable row level security;
alter table public.ofertas enable row level security;
alter table public.contrato_comunicaciones enable row level security;
revoke all on public.procesos, public.ofertas, public.contrato_comunicaciones from anon, authenticated;
grant select on public.procesos, public.ofertas, public.contrato_comunicaciones to authenticated;
create policy procesos_ver on public.procesos for select to authenticated using (public.puede_ver_proyecto(proyecto_id));
create policy ofertas_ver on public.ofertas for select to authenticated using (public.puede_ver_proyecto(proyecto_id));
create policy comunicaciones_ver on public.contrato_comunicaciones for select to authenticated
  using (exists (select 1 from public.contratos c where c.id = contrato_id));

-- 5. ESCRITURA ----------------------------------------------------------------------------------------------------
create function public.proceso_gestion_exigir(p_proyecto uuid)
returns void language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.puede_gestionar(p_proyecto) then
    raise exception 'No tienes permiso para gestionar los procesos de contratación de este proyecto.' using errcode = '42501';
  end if;
end;
$$;
revoke execute on function public.proceso_gestion_exigir(uuid) from public, anon, authenticated;

-- Crea o corrige un proceso. «Adjudicada» no se escribe a mano: se llega con proceso_adjudicar.
create function public.proceso_guardar(p_proyecto uuid, p_id uuid, p_datos jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  o public.procesos; v_id uuid;
  v_objeto text := nullif(btrim(coalesce(p_datos ->> 'objeto', '')), '');
  v_tipo text := coalesce(nullif(btrim(coalesce(p_datos ->> 'tipo_servicio', '')), ''), 'otro');
  v_estado text := coalesce(nullif(btrim(coalesce(p_datos ->> 'estado', '')), ''), 'en_preparacion');
  v_inv date; v_cierre date; v_ppto numeric(15, 2);
  v_enlace text := nullif(btrim(coalesce(p_datos ->> 'enlace', '')), '');
begin
  perform public.proceso_gestion_exigir(p_proyecto);
  if v_objeto is null then raise exception 'Describe el objeto y el alcance del proceso.' using errcode = '22023'; end if;
  begin
    v_inv := nullif(btrim(coalesce(p_datos ->> 'fecha_invitacion', '')), '')::date;
    v_cierre := nullif(btrim(coalesce(p_datos ->> 'cierre_propuestas', '')), '')::date;
    v_ppto := nullif(btrim(coalesce(p_datos ->> 'presupuesto_referencia', '')), '')::numeric;
  exception when others then
    raise exception 'Una fecha o el presupuesto de referencia no son válidos.' using errcode = '22023';
  end;
  if v_enlace is not null and v_enlace !~ '^https?://[^[:space:]]+$' then
    raise exception 'El enlace a la carpeta debe empezar por http:// o https://.' using errcode = '22023';
  end if;
  if p_id is not null then
    select * into o from public.procesos where id = p_id and proyecto_id = p_proyecto for update;
    if not found then raise exception 'El proceso no existe en este proyecto.' using errcode = '22023'; end if;
    if v_estado = 'adjudicada' and o.estado <> 'adjudicada' then
      raise exception 'Para adjudicar, usa «Adjudicar» en la oferta ganadora.' using errcode = '22023';
    end if;
    if o.estado = 'adjudicada' and v_estado <> 'adjudicada' then
      if o.contrato_id is not null then raise exception 'El proceso ya tiene un contrato: no se puede devolver la adjudicación.' using errcode = '22023'; end if;
      update public.ofertas set estado = 'recibida' where proceso_id = o.id and estado = 'adjudicada';
    end if;
  elsif v_estado = 'adjudicada' then
    raise exception 'Un proceso nuevo no puede nacer adjudicado.' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.procesos (proyecto_id, codigo, objeto, tipo_servicio, modalidad, gestor, fecha_invitacion, cierre_propuestas, presupuesto_referencia, estado, enlace, observaciones)
      values (p_proyecto, 'PR-' || lpad(public.siguiente_consecutivo(p_proyecto, 'proceso')::text, 2, '0'), v_objeto, v_tipo,
              nullif(btrim(coalesce(p_datos ->> 'modalidad', '')), ''), nullif(btrim(coalesce(p_datos ->> 'gestor', '')), ''),
              v_inv, v_cierre, v_ppto, v_estado, v_enlace, nullif(btrim(coalesce(p_datos ->> 'observaciones', '')), ''))
      returning id into v_id;
  else
    update public.procesos set objeto = v_objeto, tipo_servicio = v_tipo, modalidad = nullif(btrim(coalesce(p_datos ->> 'modalidad', '')), ''),
      gestor = nullif(btrim(coalesce(p_datos ->> 'gestor', '')), ''), fecha_invitacion = v_inv, cierre_propuestas = v_cierre,
      presupuesto_referencia = v_ppto, estado = v_estado, enlace = v_enlace, observaciones = nullif(btrim(coalesce(p_datos ->> 'observaciones', '')), ''),
      adjudicatario_id = case when v_estado = 'adjudicada' then adjudicatario_id else null end
      where id = p_id returning id into v_id;
  end if;
  return v_id;
exception when check_violation then
  raise exception 'Un dato del proceso no es válido (revisa el estado, el tipo y los textos).' using errcode = '22023';
  when numeric_value_out_of_range then
  raise exception 'El presupuesto de referencia es demasiado grande.' using errcode = '22023';
end;
$$;

create function public.proceso_borrar(p_proceso uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare o public.procesos;
begin
  select * into o from public.procesos where id = p_proceso;
  if not found then raise exception 'Proceso no encontrado.' using errcode = '22023'; end if;
  perform public.proceso_gestion_exigir(o.proyecto_id);
  if o.estado = 'adjudicada' or o.contrato_id is not null then
    raise exception 'Un proceso adjudicado o con contrato no se borra.' using errcode = '22023';
  end if;
  delete from public.procesos where id = p_proceso;
end;
$$;

-- Crea o corrige una oferta. El oferente es un tercero del maestro.
create function public.oferta_guardar(p_proceso uuid, p_id uuid, p_datos jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  o public.procesos; f public.ofertas; v_id uuid; v_tercero uuid; v_nombre text;
  v_ronda integer; v_recep date; v_vig date; v_valor numeric(15, 2); v_aiu numeric; v_plazo integer; v_ant numeric;
  v_estado text := coalesce(nullif(btrim(coalesce(p_datos ->> 'estado', '')), ''), 'invitado');
  v_hab text := nullif(btrim(coalesce(p_datos ->> 'habilitada', '')), '');
  v_enlace text := nullif(btrim(coalesce(p_datos ->> 'enlace', '')), '');
  v_crit smallint[] := array[null, null, null, null, null]::smallint[]; k text; i integer := 0;
begin
  select * into o from public.procesos where id = p_proceso;
  if not found then raise exception 'Proceso no encontrado.' using errcode = '22023'; end if;
  perform public.proceso_gestion_exigir(o.proyecto_id);
  if p_id is not null then
    select * into f from public.ofertas where id = p_id and proceso_id = p_proceso for update;
    if not found then raise exception 'La oferta no existe en este proceso.' using errcode = '22023'; end if;
    v_tercero := f.tercero_id;
  else
    begin v_tercero := nullif(btrim(coalesce(p_datos ->> 'tercero_id', '')), '')::uuid;
    exception when others then raise exception 'El oferente no es válido.' using errcode = '22023'; end;
  end if;
  select razon_social into v_nombre from public.terceros where id = v_tercero and (estado = 'activo' or p_id is not null);
  if v_nombre is null then raise exception 'Elige un oferente del maestro de aliados (activo).' using errcode = '22023'; end if;
  if v_estado not in ('invitado', 'recibida', 'en_aclaracion', 'descartada', 'adjudicada', 'no_presento', 'por_confirmar') then
    raise exception 'Estado de la oferta no válido.' using errcode = '22023';
  end if;
  if v_estado = 'adjudicada' and (p_id is null or f.estado <> 'adjudicada') then
    raise exception 'Para adjudicar, usa «Adjudicar» en la oferta ganadora.' using errcode = '22023';
  end if;
  if p_id is not null and f.estado = 'adjudicada' and v_estado <> 'adjudicada' then
    raise exception 'Una oferta adjudicada solo cambia de estado al devolver la adjudicación del proceso.' using errcode = '22023';
  end if;
  if v_hab is not null and v_hab not in ('si', 'no') then raise exception 'Habilitada debe ser sí o no.' using errcode = '22023'; end if;
  if v_enlace is not null and v_enlace !~ '^https?://[^[:space:]]+$' then
    raise exception 'El enlace a la propuesta debe empezar por http:// o https://.' using errcode = '22023';
  end if;
  begin
    v_ronda := coalesce(nullif(btrim(coalesce(p_datos ->> 'ronda', '')), '')::integer, case when p_id is null then 1 else f.ronda end);
    v_recep := nullif(btrim(coalesce(p_datos ->> 'fecha_recepcion', '')), '')::date;
    v_vig := nullif(btrim(coalesce(p_datos ->> 'vigencia_hasta', '')), '')::date;
    v_valor := nullif(btrim(coalesce(p_datos ->> 'valor_total', '')), '')::numeric;
    v_aiu := nullif(btrim(coalesce(p_datos ->> 'aiu_pct', '')), '')::numeric;
    v_plazo := nullif(btrim(coalesce(p_datos ->> 'plazo_dias', '')), '')::integer;
    v_ant := nullif(btrim(coalesce(p_datos ->> 'anticipo_pct', '')), '')::numeric;
    foreach k in array array['crit_experiencia', 'crit_capacidad', 'crit_programacion', 'crit_comercial', 'crit_sst'] loop
      i := i + 1;
      v_crit[i] := nullif(btrim(coalesce(p_datos ->> k, '')), '')::smallint;
    end loop;
  exception when others then
    raise exception 'Un número o una fecha de la oferta no son válidos.' using errcode = '22023';
  end;
  if p_id is not null and v_ronda <> f.ronda then raise exception 'La ronda de una oferta no cambia: registra otra oferta en la nueva ronda.' using errcode = '22023'; end if;
  if p_id is null then
    insert into public.ofertas (proceso_id, proyecto_id, codigo, tercero_id, oferente, ronda, fecha_recepcion, valor_total, aiu_pct, plazo_dias, anticipo_pct, vigencia_hasta,
        incluye_polizas, apu_discriminado, habilitada, estado, crit_experiencia, crit_capacidad, crit_programacion, crit_comercial, crit_sst, enlace, observaciones)
      values (p_proceso, o.proyecto_id, 'OF-' || lpad(public.siguiente_consecutivo(o.proyecto_id, 'oferta')::text, 3, '0'), v_tercero, v_nombre, v_ronda, v_recep, v_valor, v_aiu, v_plazo, v_ant, v_vig,
        (p_datos ->> 'incluye_polizas') = 'si', (p_datos ->> 'apu_discriminado') = 'si', v_hab, v_estado, v_crit[1], v_crit[2], v_crit[3], v_crit[4], v_crit[5], v_enlace,
        nullif(btrim(coalesce(p_datos ->> 'observaciones', '')), ''))
      returning id into v_id;
  else
    update public.ofertas set fecha_recepcion = v_recep, valor_total = v_valor, aiu_pct = v_aiu, plazo_dias = v_plazo, anticipo_pct = v_ant, vigencia_hasta = v_vig,
        incluye_polizas = (p_datos ->> 'incluye_polizas') = 'si', apu_discriminado = (p_datos ->> 'apu_discriminado') = 'si', habilitada = v_hab, estado = v_estado,
        crit_experiencia = v_crit[1], crit_capacidad = v_crit[2], crit_programacion = v_crit[3], crit_comercial = v_crit[4], crit_sst = v_crit[5],
        enlace = v_enlace, observaciones = nullif(btrim(coalesce(p_datos ->> 'observaciones', '')), '')
      where id = p_id returning id into v_id;
  end if;
  return v_id;
exception when check_violation then
  raise exception 'Un dato de la oferta no es válido (revisa los rangos: calificaciones de 1 a 5, porcentajes de 0 a 100).' using errcode = '22023';
  when unique_violation then
  raise exception 'Ese oferente ya tiene una oferta en esta ronda del proceso.' using errcode = '22023';
  when numeric_value_out_of_range then
  raise exception 'Un valor de la oferta es demasiado grande.' using errcode = '22023';
end;
$$;

create function public.oferta_borrar(p_oferta uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare f public.ofertas;
begin
  select * into f from public.ofertas where id = p_oferta;
  if not found then raise exception 'Oferta no encontrada.' using errcode = '22023'; end if;
  perform public.proceso_gestion_exigir(f.proyecto_id);
  if f.estado = 'adjudicada' then raise exception 'Una oferta adjudicada no se borra: primero devuelve la adjudicación del proceso.' using errcode = '22023'; end if;
  delete from public.ofertas where id = p_oferta;
end;
$$;

-- Adjudica el proceso a una oferta: queda como ganadora y el oferente como adjudicatario.
create function public.proceso_adjudicar(p_proceso uuid, p_oferta uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare o public.procesos; f public.ofertas;
begin
  select * into o from public.procesos where id = p_proceso for update;
  if not found then raise exception 'Proceso no encontrado.' using errcode = '22023'; end if;
  perform public.proceso_gestion_exigir(o.proyecto_id);
  select * into f from public.ofertas where id = p_oferta and proceso_id = p_proceso for update;
  if not found then raise exception 'La oferta no existe en este proceso.' using errcode = '22023'; end if;
  if o.estado not in ('abierta', 'en_evaluacion') then
    raise exception 'Solo se adjudica un proceso abierto o en evaluación.' using errcode = '22023';
  end if;
  if f.estado not in ('recibida', 'en_aclaracion') then
    raise exception 'Solo se adjudica una oferta recibida o en aclaración.' using errcode = '22023';
  end if;
  if f.habilitada is distinct from 'si' then
    raise exception 'La oferta debe estar habilitada (jurídica, técnica y financieramente) antes de adjudicarla.' using errcode = '22023';
  end if;
  if f.valor_total is null or f.valor_total <= 0 then raise exception 'La oferta no tiene valor registrado.' using errcode = '22023'; end if;
  update public.ofertas set estado = 'adjudicada' where id = p_oferta;
  update public.procesos set estado = 'adjudicada', adjudicatario_id = f.tercero_id where id = p_proceso;
end;
$$;

-- Vincula el contrato que nació del proceso adjudicado.
create function public.proceso_contrato_vincular(p_proceso uuid, p_contrato uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare o public.procesos; c public.contratos;
begin
  select * into o from public.procesos where id = p_proceso for update;
  if not found then raise exception 'Proceso no encontrado.' using errcode = '22023'; end if;
  perform public.proceso_gestion_exigir(o.proyecto_id);
  if o.estado <> 'adjudicada' then raise exception 'El proceso aún no está adjudicado.' using errcode = '22023'; end if;
  select * into c from public.contratos where id = p_contrato and proyecto_id = o.proyecto_id;
  if not found then raise exception 'El contrato no existe en este proyecto.' using errcode = '22023'; end if;
  if c.tercero_id is distinct from o.adjudicatario_id then
    raise exception 'El contrato debe ser del adjudicatario del proceso.' using errcode = '22023';
  end if;
  update public.procesos set contrato_id = p_contrato where id = p_proceso;
end;
$$;

-- Comunicaciones y compromisos de un contrato.
create function public.comunicacion_guardar(p_contrato uuid, p_id uuid, p_datos jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  c public.contratos; v_id uuid; v_fecha date; v_comp date;
  v_canal text := coalesce(nullif(btrim(coalesce(p_datos ->> 'canal', '')), ''), 'correo');
  v_asunto text := nullif(btrim(coalesce(p_datos ->> 'asunto', '')), '');
  v_estado text := coalesce(nullif(btrim(coalesce(p_datos ->> 'estado', '')), ''), 'abierto');
  v_accion boolean := coalesce((p_datos ->> 'requiere_accion') = 'si', false);
  v_enlace text := nullif(btrim(coalesce(p_datos ->> 'enlace', '')), '');
begin
  c := public.contrato_gestion_exigir(p_contrato);
  if v_asunto is null then raise exception 'Escribe el asunto.' using errcode = '22023'; end if;
  begin
    v_fecha := nullif(btrim(coalesce(p_datos ->> 'fecha', '')), '')::date;
    v_comp := nullif(btrim(coalesce(p_datos ->> 'fecha_compromiso', '')), '')::date;
  exception when others then raise exception 'Una fecha no es válida.' using errcode = '22023'; end;
  if v_fecha is null then raise exception 'Indica la fecha de la comunicación.' using errcode = '22023'; end if;
  if v_accion and v_estado = 'abierto' and v_comp is null then raise exception 'Un compromiso abierto necesita su fecha.' using errcode = '22023'; end if;
  if v_enlace is not null and v_enlace !~ '^https?://[^[:space:]]+$' then raise exception 'El enlace debe empezar por http:// o https://.' using errcode = '22023'; end if;
  if p_id is null then
    insert into public.contrato_comunicaciones (contrato_id, proyecto_id, fecha, canal, asunto, resumen, enlace, responsable, requiere_accion, fecha_compromiso, estado)
      values (p_contrato, c.proyecto_id, v_fecha, v_canal, v_asunto, nullif(btrim(coalesce(p_datos ->> 'resumen', '')), ''), v_enlace,
              nullif(btrim(coalesce(p_datos ->> 'responsable', '')), ''), v_accion, v_comp, v_estado) returning id into v_id;
  else
    update public.contrato_comunicaciones set fecha = v_fecha, canal = v_canal, asunto = v_asunto, resumen = nullif(btrim(coalesce(p_datos ->> 'resumen', '')), ''),
      enlace = v_enlace, responsable = nullif(btrim(coalesce(p_datos ->> 'responsable', '')), ''), requiere_accion = v_accion, fecha_compromiso = v_comp, estado = v_estado
      where id = p_id and contrato_id = p_contrato returning id into v_id;
    if v_id is null then raise exception 'La comunicación no existe en este contrato.' using errcode = '22023'; end if;
  end if;
  return v_id;
exception when check_violation then
  raise exception 'Un dato de la comunicación no es válido (canal, estado o textos).' using errcode = '22023';
end;
$$;

create function public.comunicacion_borrar(p_comunicacion uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_contrato uuid;
begin
  select contrato_id into v_contrato from public.contrato_comunicaciones where id = p_comunicacion;
  if v_contrato is null then raise exception 'Comunicación no encontrada.' using errcode = '22023'; end if;
  perform public.contrato_gestion_exigir(v_contrato);
  delete from public.contrato_comunicaciones where id = p_comunicacion;
end;
$$;

revoke execute on function public.proceso_guardar(uuid, uuid, jsonb), public.proceso_borrar(uuid), public.oferta_guardar(uuid, uuid, jsonb), public.oferta_borrar(uuid),
  public.proceso_adjudicar(uuid, uuid), public.proceso_contrato_vincular(uuid, uuid), public.comunicacion_guardar(uuid, uuid, jsonb), public.comunicacion_borrar(uuid) from public, anon;
grant execute on function public.proceso_guardar(uuid, uuid, jsonb), public.proceso_borrar(uuid), public.oferta_guardar(uuid, uuid, jsonb), public.oferta_borrar(uuid),
  public.proceso_adjudicar(uuid, uuid), public.proceso_contrato_vincular(uuid, uuid), public.comunicacion_guardar(uuid, uuid, jsonb), public.comunicacion_borrar(uuid) to authenticated;
