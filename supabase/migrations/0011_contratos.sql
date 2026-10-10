-- =============================================================================
-- Hito 7 (v2.0): Contratos y pagos (anticipo autorizado, actas de pago, retención)
-- =============================================================================

insert into public.parametros (ambito, clave, valor, descripcion, fuente) values
 ('global', 'anticipo_admin_puede_autorizar', 'no',
  'Si es "si", el administrador también puede autorizar anticipos (útil solo en pruebas); por defecto solo el director general', 'Propuesta'),
 ('global', 'tipos_contrato', 'obra,interventoria,consultoria,suministro,otro', 'Tipos de contrato admitidos', 'Especificación, módulo M');

-- 1. CONTRATOS -------------------------------------------------------------------------------
create table public.contratos (
  id                    uuid primary key default gen_random_uuid(),
  proyecto_id           uuid not null references public.proyectos (id) on delete cascade,
  tipo                  text not null check (tipo in ('obra', 'interventoria', 'consultoria', 'suministro', 'otro')),
  contratista           text not null check (length(btrim(contratista)) between 1 and 200),
  objeto                text not null check (length(btrim(objeto)) between 1 and 1000),
  valor                 numeric(15, 2) not null check (valor > 0),
  anticipo_pct          numeric(5, 2) not null default 0 check (anticipo_pct between 0 and 100),
  anticipo_valor        numeric(15, 2) not null default 0 check (anticipo_valor >= 0),
  anticipo_autorizado_por uuid,
  anticipo_motivo       text check (length(anticipo_motivo) <= 500),
  anticipo_autorizado_en timestamptz,
  retencion_pct         numeric(5, 2) not null check (retencion_pct between 0 and 100),  -- vigente al crear el contrato
  retencion_liberada    boolean not null default false,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now()
);
create index contratos_proyecto_idx on public.contratos (proyecto_id);
create trigger contratos_actualizado before update on public.contratos
  for each row execute function public.marcar_actualizado();
create trigger contratos_audit after insert or update or delete on public.contratos
  for each row execute function public.auditar_tabla();

-- 2. ACTAS DE PAGO -----------------------------------------------------------------------------
-- Los valores se calculan al crear el acta y quedan fijos (la amortización depende del anticipo pendiente de ese momento).
create table public.actas_pago (
  id            uuid primary key default gen_random_uuid(),
  contrato_id   uuid not null references public.contratos (id) on delete cascade,
  proyecto_id   uuid not null references public.proyectos (id) on delete cascade,
  numero        integer not null check (numero >= 1),
  fecha         date not null,
  valor_bruto   numeric(15, 2) not null check (valor_bruto > 0),
  amortizacion  numeric(15, 2) not null check (amortizacion >= 0),
  retencion     numeric(15, 2) not null check (retencion >= 0),
  neto          numeric(15, 2) not null,
  estado        text not null default 'radicada'
    check (estado in ('radicada', 'en_revision_interventoria', 'con_observaciones', 'aprobada_pago')),
  creado_por    uuid default auth.uid(),
  creado_en     timestamptz not null default now(),
  unique (contrato_id, numero)
);
create index actas_pago_proyecto_idx on public.actas_pago (proyecto_id, estado);
create trigger actas_pago_audit after insert or update or delete on public.actas_pago
  for each row execute function public.auditar_tabla();

alter table public.contratos enable row level security;
alter table public.actas_pago enable row level security;
revoke all on public.contratos, public.actas_pago from anon, authenticated;
grant select on public.contratos, public.actas_pago to authenticated;
create policy contratos_ver on public.contratos for select to authenticated using (public.puede_ver_proyecto(proyecto_id));
create policy actas_pago_ver on public.actas_pago for select to authenticated using (public.puede_ver_proyecto(proyecto_id));

-- 3. FUNCIONES DE APOYO ---------------------------------------------------------------------------
-- Ahora el valor del contrato es real (antes no había contratos).
create or replace function public.valor_contrato(p_contrato uuid)
returns numeric language sql stable security definer set search_path = ''
as $$ select valor from public.contratos where id = p_contrato; $$;

alter table public.cambios add constraint cambios_contrato_fk
  foreign key (contrato_id) references public.contratos (id) on delete set null;

-- ¿Requiere concepto de interventoría el acta? (lo reemplaza el hito de interventoría)
create function public.acta_requiere_interventoria(p_acta uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select false; $$;
create function public.acta_concepto_favorable(p_acta uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select true; $$;
revoke execute on function public.acta_requiere_interventoria(uuid), public.acta_concepto_favorable(uuid) from public, anon, authenticated;

-- 4. CREAR Y ACTUALIZAR CONTRATOS -------------------------------------------------------------------------
create function public.contrato_crear(p_proyecto uuid, p_datos jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid; v_valor numeric(15,2);
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
  insert into public.contratos (proyecto_id, tipo, contratista, objeto, valor, retencion_pct)
    values (p_proyecto,
      coalesce(p_datos ->> 'tipo', ''),
      public.cambio_leer_texto(p_datos, 'contratista', 200, true),
      public.cambio_leer_texto(p_datos, 'objeto', 1000, true),
      v_valor,
      coalesce(public.parametro('retencion_garantia_pct', p_proyecto)::numeric, 10))
    returning id into v_id;
  return v_id;
exception when check_violation then
  raise exception 'Tipo de contrato o valor no válido.' using errcode = '22023';
  when numeric_value_out_of_range then
  raise exception 'El valor del contrato es demasiado grande.' using errcode = '22023';
end;
$$;

create function public.contrato_actualizar(p_contrato uuid, p_datos jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare c public.contratos; v_valor numeric(15,2); v_pagado numeric;
begin
  select * into c from public.contratos where id = p_contrato for update;
  if not found then raise exception 'Contrato no encontrado.' using errcode = '22023'; end if;
  if auth.uid() is null or not public.puede_gestionar(c.proyecto_id) then
    raise exception 'No tienes permiso para editar este contrato.' using errcode = '42501';
  end if;
  begin
    v_valor := nullif(btrim(coalesce(p_datos ->> 'valor', '')), '')::numeric;
  exception when others then
    raise exception 'El valor del contrato debe ser un número válido.' using errcode = '22023';
  end;
  if v_valor is null or v_valor <= 0 then raise exception 'El valor del contrato debe ser mayor que cero.' using errcode = '22023'; end if;
  select coalesce(sum(valor_bruto), 0) into v_pagado from public.actas_pago where contrato_id = p_contrato;
  if v_valor < v_pagado then
    raise exception 'El valor del contrato no puede ser menor que lo ya facturado en actas (%).', v_pagado using errcode = '22023';
  end if;
  update public.contratos set
    tipo = coalesce(p_datos ->> 'tipo', tipo),
    contratista = public.cambio_leer_texto(p_datos, 'contratista', 200, true),
    objeto = public.cambio_leer_texto(p_datos, 'objeto', 1000, true),
    valor = v_valor
  where id = p_contrato;
exception when check_violation then
  raise exception 'Tipo de contrato o valor no válido.' using errcode = '22023';
  when numeric_value_out_of_range then
  raise exception 'El valor del contrato es demasiado grande.' using errcode = '22023';
end;
$$;

-- 5. ANTICIPO ---------------------------------------------------------------------------------------------
-- Discrecional: lo autoriza el director general según la urgencia o necesidad. Nunca supera el máximo.
-- Por debajo del umbral de referencia, lo normal es no darlo: se advierte pero se permite.
create function public.contrato_anticipo_autorizar(p_contrato uuid, p_pct numeric, p_motivo text)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  c public.contratos; v_max numeric; v_umbral numeric; v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_aviso text;
begin
  select * into c from public.contratos where id = p_contrato for update;
  if not found then raise exception 'Contrato no encontrado.' using errcode = '22023'; end if;
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

-- 6. ACTAS DE PAGO ---------------------------------------------------------------------------------------
-- amortización = mínimo(anticipo pendiente, bruto × anticipo %); retención = bruto × retención %;
-- neto = bruto − amortización − retención. La suma de las actas no puede superar el valor del contrato.
create function public.acta_pago_crear(p_contrato uuid, p_fecha date, p_bruto numeric)
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

-- Estados: radicada → en revisión de interventoría → con observaciones / aprobada para pago.
-- Con interventoría asignada y parámetro activo, no se aprueba sin concepto favorable.
create function public.acta_pago_estado(p_acta uuid, p_estado text)
returns void language plpgsql security definer set search_path = ''
as $$
declare a public.actas_pago;
begin
  select * into a from public.actas_pago where id = p_acta for update;
  if not found then raise exception 'Acta no encontrada.' using errcode = '22023'; end if;
  if auth.uid() is null or not public.puede_gestionar(a.proyecto_id) then
    raise exception 'Solo el gerente o el administrador cambian el estado del acta.' using errcode = '42501';
  end if;
  if p_estado not in ('radicada', 'en_revision_interventoria', 'con_observaciones', 'aprobada_pago') then
    raise exception 'Estado no válido.' using errcode = '22023';
  end if;
  if a.estado = 'aprobada_pago' then
    raise exception 'El acta ya está aprobada para pago.' using errcode = '22023';
  end if;
  if p_estado = 'aprobada_pago'
     and public.acta_requiere_interventoria(p_acta)
     and coalesce(public.parametro('interventoria_vb_acta_obligatorio', a.proyecto_id), 'si') = 'si'
     and not public.acta_concepto_favorable(p_acta) then
    raise exception 'El acta no puede aprobarse para pago sin concepto favorable de la interventoría.' using errcode = '22023';
  end if;
  update public.actas_pago set estado = p_estado where id = p_acta;
end;
$$;

-- Solo se borra la última acta, si aún no está aprobada.
create function public.acta_pago_borrar(p_acta uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare a public.actas_pago;
begin
  select * into a from public.actas_pago where id = p_acta for update;
  if not found then return; end if;
  if auth.uid() is null or not public.puede_gestionar(a.proyecto_id) then
    raise exception 'No tienes permiso para borrar actas.' using errcode = '42501';
  end if;
  if a.estado = 'aprobada_pago' then raise exception 'Un acta aprobada para pago no se borra.' using errcode = '22023'; end if;
  if exists (select 1 from public.actas_pago where contrato_id = a.contrato_id and numero > a.numero) then
    raise exception 'Solo se puede borrar la última acta del contrato.' using errcode = '22023';
  end if;
  delete from public.actas_pago where id = p_acta;
end;
$$;

-- 7. RETENCIÓN ------------------------------------------------------------------------------------------------
create function public.contrato_retencion_liberar(p_contrato uuid, p_liberar boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare c public.contratos; v_fact numeric;
begin
  select * into c from public.contratos where id = p_contrato for update;
  if not found then raise exception 'Contrato no encontrado.' using errcode = '22023'; end if;
  if auth.uid() is null or not public.puede_gestionar(c.proyecto_id) then
    raise exception 'No tienes permiso para liberar o revertir la retención.' using errcode = '42501';
  end if;
  if p_liberar then
    select coalesce(sum(valor_bruto), 0) into v_fact from public.actas_pago where contrato_id = p_contrato;
    if v_fact < c.valor then
      raise exception 'La retención se libera solo al ejecutar el 100 %% del contrato (facturado %, de %).', v_fact, c.valor using errcode = '22023';
    end if;
  end if;
  update public.contratos set retencion_liberada = p_liberar where id = p_contrato;
end;
$$;

-- 8. OTROSÍ: un cambio aprobado ligado a un contrato ajusta su valor -----------------------------------------
create function public.cambio_aplicar_a_contrato()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare c public.contratos; v_nuevo numeric; v_fact numeric;
begin
  if new.estado_flujo = 'aprobado' and old.estado_flujo is distinct from 'aprobado' and new.contrato_id is not null and new.impacto_costo <> 0 then
    select * into c from public.contratos where id = new.contrato_id for update;
    if found then
      v_nuevo := c.valor + new.impacto_costo;
      select coalesce(sum(valor_bruto), 0) into v_fact from public.actas_pago where contrato_id = c.id;
      if v_nuevo <= 0 or v_nuevo < v_fact then
        raise exception 'El cambio dejaría el contrato en %, por debajo de lo ya facturado (%).', v_nuevo, v_fact using errcode = '22023';
      end if;
      update public.contratos set valor = v_nuevo where id = c.id;
    end if;
  end if;
  return null;
end;
$$;
revoke execute on function public.cambio_aplicar_a_contrato() from public, anon, authenticated;
create trigger cambios_a_contrato after update of estado_flujo on public.cambios
  for each row execute function public.cambio_aplicar_a_contrato();

revoke execute on function public.contrato_crear(uuid, jsonb), public.contrato_actualizar(uuid, jsonb),
  public.contrato_anticipo_autorizar(uuid, numeric, text), public.acta_pago_crear(uuid, date, numeric),
  public.acta_pago_estado(uuid, text), public.acta_pago_borrar(uuid), public.contrato_retencion_liberar(uuid, boolean) from public, anon;
grant execute on function public.contrato_crear(uuid, jsonb), public.contrato_actualizar(uuid, jsonb),
  public.contrato_anticipo_autorizar(uuid, numeric, text), public.acta_pago_crear(uuid, date, numeric),
  public.acta_pago_estado(uuid, text), public.acta_pago_borrar(uuid), public.contrato_retencion_liberar(uuid, boolean) to authenticated;
