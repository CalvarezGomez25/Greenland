-- 0018: el director general revisa y aprueba los contratos nuevos (nueva contratación).
-- Un contrato creado por el gerente queda «pendiente»: no admite anticipo ni actas de pago, no sirve de base
-- para el nivel de un cambio, y su valor no se modifica una vez aprobado sin el director.

insert into public.parametros (ambito, clave, valor, descripcion, fuente) values
 ('global', 'contrato_admin_puede_aprobar', 'no',
  'Si es "si", el administrador también puede aprobar contratos nuevos (útil solo en pruebas); por defecto solo el director general', 'Decisión del usuario');

alter table public.contratos
  add column estado_aprobacion text not null default 'aprobado' check (estado_aprobacion in ('pendiente', 'aprobado')),
  add column aprobado_por uuid,
  add column aprobado_en timestamptz;
-- Los contratos que ya existían quedan aprobados (default 'aprobado').

create or replace function public.valor_contrato(p_contrato uuid)
returns numeric language sql stable security definer set search_path = ''
as $$ select valor from public.contratos where id = p_contrato and estado_aprobacion = 'aprobado'; $$;

-- ¿Puede esta persona aprobar contratos? (director general; el administrador solo si el parámetro lo permite)
create function public.puede_aprobar_contratos(p_proyecto uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select public.es_director_general() or (public.es_admin() and public.parametro('contrato_admin_puede_aprobar', p_proyecto) = 'si'); $$;
revoke execute on function public.puede_aprobar_contratos(uuid) from public, anon;
grant execute on function public.puede_aprobar_contratos(uuid) to authenticated;

create or replace function public.contrato_crear(p_proyecto uuid, p_datos jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid; v_valor numeric(15,2); v_aprueba boolean;
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
  v_aprueba := public.puede_aprobar_contratos(p_proyecto);   -- si lo crea quien aprueba, nace aprobado
  insert into public.contratos (proyecto_id, tipo, contratista, objeto, valor, retencion_pct, estado_aprobacion, aprobado_por, aprobado_en)
    values (p_proyecto,
      coalesce(p_datos ->> 'tipo', ''),
      public.cambio_leer_texto(p_datos, 'contratista', 200, true),
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
declare c public.contratos; v_valor numeric(15,2); v_pagado numeric; v_amortizado numeric;
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
  update public.contratos set
    tipo = coalesce(p_datos ->> 'tipo', tipo),
    contratista = public.cambio_leer_texto(p_datos, 'contratista', 200, true),
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

create or replace function public.contrato_anticipo_autorizar(p_contrato uuid, p_pct numeric, p_motivo text)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  c public.contratos; v_max numeric; v_umbral numeric; v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_aviso text;
begin
  select * into c from public.contratos where id = p_contrato for update;
  if not found then raise exception 'Contrato no encontrado.' using errcode = '22023'; end if;
  if c.estado_aprobacion <> 'aprobado' then raise exception 'El contrato aún no está aprobado por el director general.' using errcode = '22023'; end if;
  if auth.uid() is null or not (public.es_director_general()
      or (public.es_admin() and public.parametro('anticipo_admin_puede_autorizar', c.proyecto_id) = 'si')) then
    raise exception 'Solo el director general de planificación y proyectos autoriza anticipos.' using errcode = '42501';
  end if;
  if exists (select 1 from public.actas_pago where contrato_id = p_contrato) then
    raise exception 'El contrato ya tiene actas de pago: el anticipo no se puede cambiar.' using errcode = '22023';
  end if;
  v_max := coalesce(public.parametro('anticipo_max_pct', c.proyecto_id)::numeric, 20);
  v_umbral := coalesce(public.parametro('anticipo_umbral_referencia_cop', c.proyecto_id)::numeric, 350000000);
  if p_pct is null or p_pct < 0 then raise exception 'El porcentaje de anticipo no puede ser negativo.' using errcode = '22023'; end if;
  if p_pct > v_max then
    raise exception 'El anticipo no puede superar el % %% del valor del contrato (máximo para todos los contratos).', v_max using errcode = '22023';
  end if;
  if p_pct > 0 and (v_motivo is null or length(v_motivo) < 3) then
    raise exception 'Escribe el motivo del anticipo (urgencia o necesidad del servicio o insumo).' using errcode = '22023';
  end if;
  if v_motivo is not null and length(v_motivo) > 500 then raise exception 'El motivo no puede superar 500 caracteres.' using errcode = '22023'; end if;

  update public.contratos set
    anticipo_pct = round(p_pct, 2),
    anticipo_valor = round(valor * p_pct / 100, 2),
    anticipo_autorizado_por = case when p_pct > 0 then auth.uid() end,
    anticipo_motivo = case when p_pct > 0 then v_motivo end,
    anticipo_autorizado_en = case when p_pct > 0 then now() end
  where id = p_contrato;
  if p_pct > 0 and c.valor < v_umbral then
    v_aviso := 'Atención: el contrato es menor a la referencia de ' || to_char(v_umbral, 'FM999G999G999G999') ||
               ' y lo normal es no dar anticipo. Quedó registrado quién lo autorizó y el motivo.';
  end if;
  return v_aviso;
end;
$$;

create or replace function public.acta_pago_crear(p_contrato uuid, p_fecha date, p_bruto numeric)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  c public.contratos; v_facturado numeric; v_amortizado numeric; v_pendiente numeric;
  v_amort numeric; v_ret numeric; v_num integer; v_id uuid;
begin
  select * into c from public.contratos where id = p_contrato for update;
  if not found then raise exception 'Contrato no encontrado.' using errcode = '22023'; end if;
  if auth.uid() is null or not public.puede_gestionar(c.proyecto_id) then
    raise exception 'No tienes permiso para radicar actas de pago en este proyecto.' using errcode = '42501';
  end if;
  if c.estado_aprobacion <> 'aprobado' then raise exception 'El contrato aún no está aprobado por el director general: no se radican actas de pago.' using errcode = '22023'; end if;
  if p_fecha is null then raise exception 'Indica la fecha del acta.' using errcode = '22023'; end if;
  if p_bruto is null or p_bruto <= 0 then raise exception 'El valor bruto del acta debe ser mayor que cero.' using errcode = '22023'; end if;
  if c.retencion_liberada then raise exception 'La retención de este contrato ya fue liberada: no se radican más actas.' using errcode = '22023'; end if;

  select coalesce(sum(valor_bruto), 0), coalesce(sum(amortizacion), 0), coalesce(max(numero), 0) + 1
    into v_facturado, v_amortizado, v_num from public.actas_pago where contrato_id = p_contrato;
  if v_facturado + p_bruto > c.valor then
    raise exception 'La suma de las actas (%) superaría el valor del contrato (%).', v_facturado + p_bruto, c.valor using errcode = '22023';
  end if;
  v_pendiente := greatest(c.anticipo_valor - v_amortizado, 0);
  v_amort := round(least(v_pendiente, p_bruto * c.anticipo_pct / 100), 2);
  v_ret := round(p_bruto * c.retencion_pct / 100, 2);
  insert into public.actas_pago (contrato_id, proyecto_id, numero, fecha, valor_bruto, amortizacion, retencion, neto)
    values (p_contrato, c.proyecto_id, v_num, p_fecha, round(p_bruto, 2), v_amort, v_ret, round(p_bruto, 2) - v_amort - v_ret)
    returning id into v_id;
  return v_id;
exception when numeric_value_out_of_range then
  raise exception 'El valor del acta es demasiado grande.' using errcode = '22023';
end;
$$;

create or replace function public.cambio_validar_contrato()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.contrato_id is not null and not exists (
       select 1 from public.contratos where id = new.contrato_id and proyecto_id = new.proyecto_id and estado_aprobacion = 'aprobado') then
    raise exception 'El contrato no es de este proyecto o aún no está aprobado.' using errcode = '22023';
  end if;
  return new;
end;
$$;

-- Aprobación del contrato por el director general.
create function public.contrato_aprobar(p_contrato uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare c public.contratos;
begin
  select * into c from public.contratos where id = p_contrato for update;
  if not found then raise exception 'Contrato no encontrado.' using errcode = '22023'; end if;
  if auth.uid() is null or not public.puede_aprobar_contratos(c.proyecto_id) then
    raise exception 'Solo el director general de planificación y proyectos aprueba los contratos nuevos.' using errcode = '42501';
  end if;
  if c.estado_aprobacion = 'aprobado' then return; end if;
  update public.contratos set estado_aprobacion = 'aprobado', aprobado_por = auth.uid(), aprobado_en = now() where id = p_contrato;
end;
$$;
revoke execute on function public.contrato_aprobar(uuid) from public, anon;
grant execute on function public.contrato_aprobar(uuid) to authenticated;
