-- =============================================================================
-- Hito 4 (v2.0): Control de cambios (flujo de 8 fases), niveles, aprobación por nivel,
-- firma del patrocinador y versionado de la línea base.
-- =============================================================================

-- Parámetro nuevo: ¿el administrador puede aprobar cambios? (por defecto no: lo decide el rol de la regla)
insert into public.parametros (ambito, clave, valor, descripcion, fuente) values
 ('global', 'cambio_admin_puede_aprobar', 'no',
  'Si es "si", el administrador también puede aprobar o rechazar cambios (útil solo en pruebas)', 'Propuesta');

-- 1. LÍNEAS BASE ---------------------------------------------------------------------
create table public.lineas_base (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos (id) on delete cascade,
  tipo        text not null check (tipo in ('alcance', 'cronograma', 'costo')),
  version     integer not null check (version >= 1),
  bac         numeric(15, 2) check (bac >= 0),       -- línea base de costo
  fecha_fin   date,                                  -- línea base de cronograma
  nota        text check (length(nota) <= 500),
  aprobada_por uuid,
  fecha       date not null default current_date,
  cambio_id   uuid,
  unique (proyecto_id, tipo, version)
);
create index lineas_base_idx on public.lineas_base (proyecto_id, tipo, version desc);

-- BAC vigente: la última línea base de costo; si aún no hay, el BAC de la última medición de valor ganado.
create function public.linea_base_bac(p_proyecto uuid)
returns numeric language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select bac from public.lineas_base where proyecto_id = p_proyecto and tipo = 'costo' order by version desc limit 1),
    (select bac from public.mediciones_evm where proyecto_id = p_proyecto order by fecha_corte desc limit 1)
  );
$$;
revoke execute on function public.linea_base_bac(uuid) from public, anon;
grant execute on function public.linea_base_bac(uuid) to authenticated;

-- Valor del contrato (lo reemplaza el hito de contratos). Mientras tanto no hay contratos.
create function public.valor_contrato(p_contrato uuid)
returns numeric language sql stable security definer set search_path = ''
as $$ select null::numeric; $$;
revoke execute on function public.valor_contrato(uuid) from public, anon, authenticated;

-- Concepto de interventoría pendiente (lo reemplaza el hito de interventoría).
create function public.cambio_concepto_pendiente(p_cambio uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select false; $$;
revoke execute on function public.cambio_concepto_pendiente(uuid) from public, anon, authenticated;

-- 2. CAMBIOS ----------------------------------------------------------------------------
create table public.cambios (
  id                         uuid primary key default gen_random_uuid(),
  proyecto_id                uuid not null references public.proyectos (id) on delete cascade,
  codigo                     text not null,
  contrato_id                uuid,
  riesgo_id                  uuid references public.riesgos (id) on delete set null,
  fecha_solicitud            date not null default current_date,
  solicitante_id             uuid default auth.uid(),
  tipo                       text not null check (length(btrim(tipo)) between 1 and 100),
  descripcion_antes          text check (length(descripcion_antes) <= 4000),
  descripcion_despues        text not null check (length(btrim(descripcion_despues)) between 1 and 4000),
  justificacion              text not null check (length(btrim(justificacion)) between 1 and 4000),
  impacto_alcance            text check (length(impacto_alcance) <= 4000),
  impacto_costo              numeric(15, 2) not null default 0,
  impacto_dias               integer not null default 0 check (impacto_dias between -3650 and 3650),
  ambitos                    text[] not null default '{}'
    check (ambitos <@ array['alcance','financiero','cronograma','flujo_caja','contractual','operativo','riesgos','calidad','reputacional','regulatorio']),
  estado_flujo               text not null default 'identificado'
    check (estado_flujo in ('identificado','radicado','evaluacion_tecnica_financiera','analisis_impacto','aprobacion','aprobado','rechazado','implementacion','cerrado')),
  -- calculados (los fija la base de datos, nunca la pantalla)
  nivel                      text check (nivel in ('menor', 'moderado', 'critico')),
  variacion_pct              numeric(12, 4),
  base_valor                 numeric(15, 2),
  requiere_firma_patrocinador boolean not null default false,
  en_aprobacion_desde        timestamptz,
  firma_patrocinador         date,
  firma_patrocinador_por     uuid,
  aprobador_id               uuid,
  fecha_aprobacion           date,
  responsable_implementacion text check (length(responsable_implementacion) <= 200),
  observaciones              text check (length(observaciones) <= 4000),
  lecciones                  text check (length(lecciones) <= 4000),
  detectado_sin_formato      boolean not null default false,
  creado_en                  timestamptz not null default now(),
  actualizado_en             timestamptz not null default now(),
  unique (proyecto_id, codigo)
);
create index cambios_proyecto_idx on public.cambios (proyecto_id, estado_flujo);
create trigger cambios_actualizado before update on public.cambios
  for each row execute function public.marcar_actualizado();
create trigger cambios_audit after insert or update or delete on public.cambios
  for each row execute function public.auditar_tabla();
create trigger lineas_base_audit after insert or update or delete on public.lineas_base
  for each row execute function public.auditar_tabla();

create table public.cambios_historial (
  id         bigint generated always as identity primary key,
  cambio_id  uuid not null references public.cambios (id) on delete cascade,
  proyecto_id uuid not null,
  fecha      timestamptz not null default now(),
  usuario_id uuid default auth.uid(),
  de_estado  text,
  a_estado   text not null,
  nota       text
);
create index cambios_historial_idx on public.cambios_historial (cambio_id, id);

alter table public.cambios enable row level security;
alter table public.cambios_historial enable row level security;
alter table public.lineas_base enable row level security;
revoke all on public.cambios, public.cambios_historial, public.lineas_base from anon, authenticated;
grant select on public.cambios, public.cambios_historial, public.lineas_base to authenticated;
create policy cambios_ver on public.cambios for select to authenticated using (public.puede_ver_proyecto(proyecto_id));
create policy cambios_historial_ver on public.cambios_historial for select to authenticated using (public.puede_ver_proyecto(proyecto_id));
create policy lineas_base_ver on public.lineas_base for select to authenticated using (public.puede_ver_proyecto(proyecto_id));

-- 3. NIVEL Y BASE --------------------------------------------------------------------------
-- Base del porcentaje: valor del contrato si el cambio está ligado a uno; si no, el BAC (S6).
-- Menor: hasta 2 %. Moderado: más de 2 % hasta 5 %. Crítico: más de 5 %, o cambio de plazo en un
-- contrato. Comparación exacta (sin redondear): 9.600.000 sobre 480.000.000 es exactamente 2 %.
create function public.cambio_calcular(
  p_proyecto uuid, p_contrato uuid, p_costo numeric, p_dias integer,
  out base_valor numeric, out variacion_pct numeric, out nivel text, out requiere_firma boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_menor numeric := coalesce(public.parametro('cambio_menor_max_pct', p_proyecto)::numeric, 2);
  v_mod   numeric := coalesce(public.parametro('cambio_moderado_max_pct', p_proyecto)::numeric, 5);
  v_firma numeric := coalesce(public.parametro('cambio_firma_patrocinador_pct', p_proyecto)::numeric, 5);
  v_abs numeric := abs(coalesce(p_costo, 0));
begin
  if p_contrato is not null then base_valor := public.valor_contrato(p_contrato); end if;
  if base_valor is null or base_valor <= 0 then base_valor := public.linea_base_bac(p_proyecto); end if;
  if base_valor is not null and base_valor <= 0 then base_valor := null; end if;

  if v_abs = 0 then variacion_pct := 0;
  elsif base_valor is null then variacion_pct := null;
  else variacion_pct := round(v_abs * 100 / base_valor, 4);
  end if;

  if p_contrato is not null and coalesce(p_dias, 0) <> 0 then nivel := 'critico';
  elsif v_abs = 0 then nivel := 'menor';
  elsif base_valor is null then nivel := null;
  elsif v_abs * 100 <= v_menor * base_valor then nivel := 'menor';
  elsif v_abs * 100 <= v_mod * base_valor then nivel := 'moderado';
  else nivel := 'critico';
  end if;

  requiere_firma := (base_valor is not null and v_abs * 100 > v_firma * base_valor);
end;
$$;
revoke execute on function public.cambio_calcular(uuid, uuid, numeric, integer) from public, anon, authenticated;

-- 4. VALIDACIÓN DE DATOS ---------------------------------------------------------------------
create function public.cambio_leer_texto(p_datos jsonb, p_campo text, p_max integer, p_obligatorio boolean)
returns text language plpgsql immutable set search_path = ''
as $$
declare t text := nullif(btrim(coalesce(p_datos ->> p_campo, '')), '');
begin
  if t is null and p_obligatorio then
    raise exception 'El campo % es obligatorio.', replace(p_campo, '_', ' ') using errcode = '22023';
  end if;
  if t is not null and length(t) > p_max then
    raise exception 'El campo % supera % caracteres.', replace(p_campo, '_', ' '), p_max using errcode = '22023';
  end if;
  return t;
end;
$$;
revoke execute on function public.cambio_leer_texto(jsonb, text, integer, boolean) from public, anon, authenticated;

-- 5. CREAR ---------------------------------------------------------------------------------------
create function public.cambio_crear(p_proyecto uuid, p_datos jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid; v_anio text := to_char(current_date, 'YYYY'); v_codigo text;
  v_costo numeric(15,2); v_dias integer; v_ambitos text[]; calc record;
  v_contrato uuid := nullif(p_datos ->> 'contrato_id', '')::uuid;
  v_riesgo uuid := nullif(p_datos ->> 'riesgo_id', '')::uuid;
begin
  if auth.uid() is null or not public.puede_gestionar(p_proyecto) then
    raise exception 'No tienes permiso para registrar cambios en este proyecto.' using errcode = '42501';
  end if;
  begin
    v_costo := coalesce(nullif(btrim(coalesce(p_datos ->> 'impacto_costo', '')), '')::numeric, 0);
    v_dias := coalesce(nullif(btrim(coalesce(p_datos ->> 'impacto_dias', '')), '')::integer, 0);
  exception when others then
    raise exception 'El impacto en costo y en días deben ser números válidos.' using errcode = '22023';
  end;
  v_ambitos := coalesce(array(select jsonb_array_elements_text(coalesce(p_datos -> 'ambitos', '[]'::jsonb))), '{}');
  if v_riesgo is not null and not exists (select 1 from public.riesgos where id = v_riesgo and proyecto_id = p_proyecto) then
    raise exception 'El riesgo no es de este proyecto.' using errcode = '22023';
  end if;

  select * into calc from public.cambio_calcular(p_proyecto, v_contrato, v_costo, v_dias);
  v_codigo := 'CC-' || v_anio || '-' || lpad(public.siguiente_consecutivo(p_proyecto, 'cambio-' || v_anio)::text, 3, '0');
  insert into public.cambios (proyecto_id, codigo, contrato_id, riesgo_id, tipo, descripcion_antes, descripcion_despues,
      justificacion, impacto_alcance, impacto_costo, impacto_dias, ambitos, nivel, variacion_pct, base_valor,
      requiere_firma_patrocinador, responsable_implementacion, observaciones, detectado_sin_formato)
    values (p_proyecto, v_codigo, v_contrato, v_riesgo,
      public.cambio_leer_texto(p_datos, 'tipo', 100, true),
      public.cambio_leer_texto(p_datos, 'descripcion_antes', 4000, false),
      public.cambio_leer_texto(p_datos, 'descripcion_despues', 4000, true),
      public.cambio_leer_texto(p_datos, 'justificacion', 4000, true),
      public.cambio_leer_texto(p_datos, 'impacto_alcance', 4000, false),
      v_costo, v_dias, v_ambitos, calc.nivel, calc.variacion_pct, calc.base_valor, calc.requiere_firma,
      public.cambio_leer_texto(p_datos, 'responsable_implementacion', 200, false),
      public.cambio_leer_texto(p_datos, 'observaciones', 4000, false),
      coalesce((p_datos ->> 'detectado_sin_formato')::boolean, false))
    returning id into v_id;
  insert into public.cambios_historial (cambio_id, proyecto_id, a_estado, nota) values (v_id, p_proyecto, 'identificado', 'Cambio identificado y documentado');
  return v_id;
exception when check_violation then
  raise exception 'Algún valor del cambio no es válido (revisa el impacto en días y los ámbitos).' using errcode = '22023';
  when numeric_value_out_of_range then
  raise exception 'El impacto en costo es demasiado grande.' using errcode = '22023';
end;
$$;

-- 6. ACTUALIZAR ----------------------------------------------------------------------------------
-- Antes de la aprobación se puede editar todo (gerente o analista PMO). Desde la aprobación solo
-- observaciones, responsable de implementación y lecciones aprendidas (gerente).
create function public.cambio_actualizar(p_cambio uuid, p_datos jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare c public.cambios; calc record; v_costo numeric(15,2); v_dias integer; v_ambitos text[];
  v_contrato uuid; v_antes boolean;
begin
  select * into c from public.cambios where id = p_cambio for update;
  if not found then raise exception 'Cambio no encontrado.' using errcode = '22023'; end if;
  v_antes := c.estado_flujo in ('identificado','radicado','evaluacion_tecnica_financiera','analisis_impacto');

  if auth.uid() is null or not (public.puede_gestionar(c.proyecto_id) or (v_antes and public.puede_reportar(c.proyecto_id))) then
    raise exception 'No tienes permiso para editar este cambio.' using errcode = '42501';
  end if;
  if c.estado_flujo = 'cerrado' then
    raise exception 'El cambio está cerrado y no se puede editar.' using errcode = '22023';
  end if;

  if v_antes then
    begin
      v_costo := coalesce(nullif(btrim(coalesce(p_datos ->> 'impacto_costo', '')), '')::numeric, 0);
      v_dias := coalesce(nullif(btrim(coalesce(p_datos ->> 'impacto_dias', '')), '')::integer, 0);
    exception when others then
      raise exception 'El impacto en costo y en días deben ser números válidos.' using errcode = '22023';
    end;
    v_ambitos := coalesce(array(select jsonb_array_elements_text(coalesce(p_datos -> 'ambitos', '[]'::jsonb))), '{}');
    v_contrato := nullif(p_datos ->> 'contrato_id', '')::uuid;
    select * into calc from public.cambio_calcular(c.proyecto_id, v_contrato, v_costo, v_dias);
    update public.cambios set
      contrato_id = v_contrato,
      tipo = public.cambio_leer_texto(p_datos, 'tipo', 100, true),
      descripcion_antes = public.cambio_leer_texto(p_datos, 'descripcion_antes', 4000, false),
      descripcion_despues = public.cambio_leer_texto(p_datos, 'descripcion_despues', 4000, true),
      justificacion = public.cambio_leer_texto(p_datos, 'justificacion', 4000, true),
      impacto_alcance = public.cambio_leer_texto(p_datos, 'impacto_alcance', 4000, false),
      impacto_costo = v_costo, impacto_dias = v_dias, ambitos = v_ambitos,
      nivel = calc.nivel, variacion_pct = calc.variacion_pct, base_valor = calc.base_valor,
      requiere_firma_patrocinador = calc.requiere_firma,
      detectado_sin_formato = coalesce((p_datos ->> 'detectado_sin_formato')::boolean, false)
    where id = p_cambio;
  end if;

  update public.cambios set
    responsable_implementacion = public.cambio_leer_texto(p_datos, 'responsable_implementacion', 200, false),
    observaciones = public.cambio_leer_texto(p_datos, 'observaciones', 4000, false),
    lecciones = public.cambio_leer_texto(p_datos, 'lecciones', 4000, false)
  where id = p_cambio;
exception when check_violation then
  raise exception 'Algún valor del cambio no es válido (revisa el impacto en días y los ámbitos).' using errcode = '22023';
  when numeric_value_out_of_range then
  raise exception 'El impacto en costo es demasiado grande.' using errcode = '22023';
end;
$$;

-- 7. AVANZAR / DEVOLVER -------------------------------------------------------------------------------
create function public.cambio_avanzar(p_cambio uuid, p_nota text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare c public.cambios; v_sig text; calc record; v_nota text := nullif(btrim(coalesce(p_nota, '')), '');
begin
  select * into c from public.cambios where id = p_cambio for update;
  if not found then raise exception 'Cambio no encontrado.' using errcode = '22023'; end if;
  if auth.uid() is null then raise exception 'Debes iniciar sesión.' using errcode = '28000'; end if;
  if v_nota is not null and length(v_nota) > 500 then raise exception 'La nota no puede superar 500 caracteres.' using errcode = '22023'; end if;

  v_sig := case c.estado_flujo
    when 'identificado' then 'radicado'
    when 'radicado' then 'evaluacion_tecnica_financiera'
    when 'evaluacion_tecnica_financiera' then 'analisis_impacto'
    when 'analisis_impacto' then 'aprobacion'
    when 'aprobado' then 'implementacion'
    when 'implementacion' then 'cerrado'
    when 'rechazado' then 'cerrado'
    else null end;
  if v_sig is null then
    raise exception '%', case c.estado_flujo
      when 'aprobacion' then 'En esta fase se aprueba o se rechaza el cambio.'
      else 'El cambio ya está cerrado.' end using errcode = '22023';
  end if;

  -- Quién puede dar cada paso
  if c.estado_flujo in ('identificado', 'aprobado', 'implementacion', 'rechazado') then
    if not public.puede_gestionar(c.proyecto_id) then
      raise exception 'Solo el gerente del proyecto (o el administrador) puede dar este paso.' using errcode = '42501';
    end if;
  elsif not public.puede_reportar(c.proyecto_id) then
    raise exception 'Solo el gerente, el analista PMO o el administrador pueden dar este paso.' using errcode = '42501';
  end if;

  if c.estado_flujo = 'identificado' and c.nivel is null then
    raise exception 'No hay línea base de costo (BAC) para calcular el nivel del cambio. Registra primero una medición de valor ganado.' using errcode = '22023';
  end if;
  if c.estado_flujo = 'evaluacion_tecnica_financiera' and public.cambio_concepto_pendiente(c.id) then
    raise exception 'Falta el concepto de la interventoría antes de pasar al análisis de impacto.' using errcode = '22023';
  end if;

  if v_sig = 'aprobacion' then
    -- Al entrar a aprobación se recalcula el nivel con la línea base vigente y queda fijo.
    select * into calc from public.cambio_calcular(c.proyecto_id, c.contrato_id, c.impacto_costo, c.impacto_dias);
    if calc.nivel is null then
      raise exception 'No hay línea base de costo (BAC) para calcular el nivel del cambio.' using errcode = '22023';
    end if;
    update public.cambios set nivel = calc.nivel, variacion_pct = calc.variacion_pct, base_valor = calc.base_valor,
      requiere_firma_patrocinador = calc.requiere_firma, en_aprobacion_desde = now() where id = c.id;
  end if;

  update public.cambios set estado_flujo = v_sig where id = c.id;
  insert into public.cambios_historial (cambio_id, proyecto_id, de_estado, a_estado, nota)
    values (c.id, c.proyecto_id, c.estado_flujo, v_sig, v_nota);
end;
$$;

create function public.cambio_devolver(p_cambio uuid, p_nota text)
returns void language plpgsql security definer set search_path = ''
as $$
declare c public.cambios; v_nota text := nullif(btrim(coalesce(p_nota, '')), '');
begin
  select * into c from public.cambios where id = p_cambio for update;
  if not found then raise exception 'Cambio no encontrado.' using errcode = '22023'; end if;
  if auth.uid() is null or not public.puede_reportar(c.proyecto_id) then
    raise exception 'No tienes permiso para devolver este cambio.' using errcode = '42501';
  end if;
  if c.estado_flujo <> 'aprobacion' then
    raise exception 'Solo se puede devolver un cambio que está en aprobación.' using errcode = '22023';
  end if;
  if v_nota is null or length(v_nota) < 3 or length(v_nota) > 500 then
    raise exception 'Escribe el motivo de la devolución (3 a 500 caracteres).' using errcode = '22023';
  end if;
  update public.cambios set estado_flujo = 'analisis_impacto', en_aprobacion_desde = null,
    firma_patrocinador = null, firma_patrocinador_por = null where id = c.id;
  insert into public.cambios_historial (cambio_id, proyecto_id, de_estado, a_estado, nota)
    values (c.id, c.proyecto_id, 'aprobacion', 'analisis_impacto', 'Devuelto: ' || v_nota);
end;
$$;

-- 8. FIRMA DEL PATROCINADOR -------------------------------------------------------------------------------
create function public.cambio_firmar_patrocinador(p_cambio uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare c public.cambios;
begin
  select * into c from public.cambios where id = p_cambio for update;
  if not found then raise exception 'Cambio no encontrado.' using errcode = '22023'; end if;
  if auth.uid() is null or not (public.es_admin() or exists (select 1 from public.miembros_proyecto
      where proyecto_id = c.proyecto_id and usuario_id = auth.uid() and rol = 'patrocinador')) then
    raise exception 'Solo el patrocinador (o el administrador) registra su firma.' using errcode = '42501';
  end if;
  if c.estado_flujo <> 'aprobacion' then
    raise exception 'La firma se registra cuando el cambio está en aprobación.' using errcode = '22023';
  end if;
  if not c.requiere_firma_patrocinador then
    raise exception 'Este cambio no requiere la firma del patrocinador.' using errcode = '22023';
  end if;
  update public.cambios set firma_patrocinador = current_date, firma_patrocinador_por = auth.uid() where id = c.id;
  insert into public.cambios_historial (cambio_id, proyecto_id, de_estado, a_estado, nota)
    values (c.id, c.proyecto_id, 'aprobacion', 'aprobacion', 'Firma del patrocinador registrada');
end;
$$;

-- 9. DECIDIR: APROBAR O RECHAZAR -------------------------------------------------------------------------------
-- Quién decide lo define el parámetro cambio_aprobador_<nivel>: "gerente" o "director_general".
create function public.cambio_decidir(p_cambio uuid, p_decision text, p_nota text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  c public.cambios; v_aprobador text; v_permitido boolean; v_nota text := nullif(btrim(coalesce(p_nota, '')), '');
  v_bac numeric; v_fin date; v_ver integer; v_nuevo text;
begin
  select * into c from public.cambios where id = p_cambio for update;
  if not found then raise exception 'Cambio no encontrado.' using errcode = '22023'; end if;
  if auth.uid() is null then raise exception 'Debes iniciar sesión.' using errcode = '28000'; end if;
  if c.estado_flujo <> 'aprobacion' then
    raise exception 'El cambio no está en la fase de aprobación.' using errcode = '22023';
  end if;
  if p_decision not in ('aprobar', 'rechazar') then raise exception 'Decisión no válida.' using errcode = '22023'; end if;
  if v_nota is not null and length(v_nota) > 500 then raise exception 'La nota no puede superar 500 caracteres.' using errcode = '22023'; end if;

  v_aprobador := public.parametro('cambio_aprobador_' || case c.nivel when 'menor' then 'menor' when 'moderado' then 'moderado' else 'critico' end, c.proyecto_id);
  v_permitido := (v_aprobador = 'gerente' and public.es_gerente_proyecto(c.proyecto_id))
              or (v_aprobador = 'director_general' and public.es_director_general())
              or (public.es_admin() and public.parametro('cambio_admin_puede_aprobar', c.proyecto_id) = 'si');
  if not v_permitido then
    raise exception 'Este cambio es de nivel % y lo decide: %.', c.nivel,
      case v_aprobador when 'gerente' then 'el gerente del proyecto' else 'el director general de planificación y proyectos' end
      using errcode = '42501';
  end if;

  if p_decision = 'rechazar' then
    if v_nota is null or length(v_nota) < 3 then
      raise exception 'Escribe el motivo del rechazo (mínimo 3 caracteres).' using errcode = '22023';
    end if;
    update public.cambios set estado_flujo = 'rechazado', aprobador_id = auth.uid(), fecha_aprobacion = current_date where id = c.id;
    insert into public.cambios_historial (cambio_id, proyecto_id, de_estado, a_estado, nota) values (c.id, c.proyecto_id, 'aprobacion', 'rechazado', v_nota);
    return;
  end if;

  if c.requiere_firma_patrocinador and c.firma_patrocinador is null then
    raise exception 'Este cambio supera el % del presupuesto y requiere la firma del patrocinador antes de aprobarse.',
      coalesce(public.parametro('cambio_firma_patrocinador_pct', c.proyecto_id), '5') || ' %' using errcode = '22023';
  end if;

  update public.cambios set estado_flujo = 'aprobado', aprobador_id = auth.uid(), fecha_aprobacion = current_date where id = c.id;
  insert into public.cambios_historial (cambio_id, proyecto_id, de_estado, a_estado, nota) values (c.id, c.proyecto_id, 'aprobacion', 'aprobado', v_nota);

  -- Todo cambio aprobado versiona la línea base que corresponda.
  if c.impacto_costo <> 0 then
    v_bac := public.linea_base_bac(c.proyecto_id);
    select coalesce(max(version), 0) + 1 into v_ver from public.lineas_base where proyecto_id = c.proyecto_id and tipo = 'costo';
    insert into public.lineas_base (proyecto_id, tipo, version, bac, aprobada_por, cambio_id, nota)
      values (c.proyecto_id, 'costo', v_ver, coalesce(v_bac, 0) + c.impacto_costo, auth.uid(), c.id, 'Cambio ' || c.codigo);
  end if;
  if c.impacto_dias <> 0 then
    select coalesce((select fecha_fin from public.lineas_base where proyecto_id = c.proyecto_id and tipo = 'cronograma' order by version desc limit 1),
      (select (fecha_inicio + make_interval(months => duracion_meses))::date from public.proyectos where id = c.proyecto_id)) into v_fin;
    select coalesce(max(version), 0) + 1 into v_ver from public.lineas_base where proyecto_id = c.proyecto_id and tipo = 'cronograma';
    insert into public.lineas_base (proyecto_id, tipo, version, fecha_fin, aprobada_por, cambio_id, nota)
      values (c.proyecto_id, 'cronograma', v_ver, v_fin + c.impacto_dias, auth.uid(), c.id, 'Cambio ' || c.codigo);
  end if;
  if nullif(btrim(coalesce(c.impacto_alcance, '')), '') is not null then
    select coalesce(max(version), 0) + 1 into v_ver from public.lineas_base where proyecto_id = c.proyecto_id and tipo = 'alcance';
    insert into public.lineas_base (proyecto_id, tipo, version, aprobada_por, cambio_id, nota)
      values (c.proyecto_id, 'alcance', v_ver, auth.uid(), c.id, 'Cambio ' || c.codigo);
  end if;
end;
$$;

revoke execute on function
  public.cambio_crear(uuid, jsonb), public.cambio_actualizar(uuid, jsonb), public.cambio_avanzar(uuid, text),
  public.cambio_devolver(uuid, text), public.cambio_firmar_patrocinador(uuid), public.cambio_decidir(uuid, text, text)
  from public, anon;
grant execute on function
  public.cambio_crear(uuid, jsonb), public.cambio_actualizar(uuid, jsonb), public.cambio_avanzar(uuid, text),
  public.cambio_devolver(uuid, text), public.cambio_firmar_patrocinador(uuid), public.cambio_decidir(uuid, text, text)
  to authenticated;
