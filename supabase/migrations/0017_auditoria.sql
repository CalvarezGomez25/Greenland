-- 0017: correcciones de la auditoría (seguridad y reglas de negocio).

-- 1. Un cambio solo puede ligarse a un contrato de su propio proyecto (antes se podía leer y modificar el de otro).
create function public.cambio_validar_contrato()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.contrato_id is not null and not exists (
       select 1 from public.contratos where id = new.contrato_id and proyecto_id = new.proyecto_id) then
    raise exception 'El contrato no es de este proyecto.' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke execute on function public.cambio_validar_contrato() from public, anon, authenticated;
create trigger cambios_validar_contrato before insert or update of contrato_id, proyecto_id on public.cambios
  for each row execute function public.cambio_validar_contrato();

-- 2. El BAC solo lo usan funciones internas (no se expone a quien no puede ver el presupuesto).
revoke execute on function public.linea_base_bac(uuid) from public, anon, authenticated;

-- 3. El estado Cerrado no se cambia desde la ficha (salta las validaciones del cierre y de la reapertura).
create or replace function public.proyecto_ficha_guardar(
  p_proyecto uuid, p_tipo text, p_fase text, p_estado text, p_usa_obra boolean,
  p_organizacion uuid, p_portafolio uuid, p_codigo text
) returns void language plpgsql security definer set search_path = ''
as $$
declare v public.proyectos;
begin
  if auth.uid() is null or not public.puede_gestionar(p_proyecto) then
    raise exception 'No tienes permiso para editar este proyecto.' using errcode = '42501';
  end if;
  select * into v from public.proyectos where id = p_proyecto;
  if not found then raise exception 'Proyecto no encontrado.' using errcode = '22023'; end if;
  if p_estado is distinct from v.estado and (p_estado = 'cerrado' or v.estado = 'cerrado') then
    raise exception 'El cierre y la reapertura de un proyecto se hacen desde el módulo Cierre.' using errcode = '22023';
  end if;

  if (p_organizacion is distinct from v.organizacion_id
      or p_portafolio is distinct from v.portafolio_id
      or coalesce(nullif(btrim(coalesce(p_codigo, '')), '') <> v.codigo, false))
     and not public.es_admin() then
    raise exception 'Solo el administrador cambia el código, la organización y el portafolio.' using errcode = '42501';
  end if;
  if p_portafolio is not null and not exists (
       select 1 from public.portafolios where id = p_portafolio and organizacion_id = p_organizacion) then
    raise exception 'El portafolio no pertenece a la organización.' using errcode = '22023';
  end if;
  if p_codigo is not null and length(btrim(p_codigo)) > 30 then
    raise exception 'El código no puede superar 30 caracteres.' using errcode = '22023';
  end if;

  update public.proyectos set
    tipo = p_tipo, fase = p_fase, estado = p_estado, usa_obra = coalesce(p_usa_obra, true),
    organizacion_id = p_organizacion, portafolio_id = p_portafolio,
    codigo = coalesce(nullif(btrim(coalesce(p_codigo, '')), ''), v.codigo)
  where id = p_proyecto;
exception when check_violation then
  raise exception 'Valor no válido en la ficha del proyecto.' using errcode = '22023';
  when unique_violation then
  raise exception 'Ya existe un proyecto con ese código.' using errcode = '22023';
end;
$$;

-- 4. Al cambiar el valor del contrato, el anticipo autorizado sigue siendo el mismo porcentaje.
create or replace function public.contrato_actualizar(p_contrato uuid, p_datos jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare c public.contratos; v_valor numeric(15,2); v_pagado numeric; v_amortizado numeric;
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

-- 5. Lo ya firmado o registrado no se altera por borrados en cascada: el borrado se rechaza.
alter table public.informes_interventoria drop constraint if exists informes_interventoria_alcance_id_fkey;
alter table public.informes_interventoria add constraint informes_interventoria_alcance_id_fkey
  foreign key (alcance_id) references public.interventoria_alcances (id) on delete no action;
alter table public.informes_interventoria drop constraint if exists informes_interventoria_acta_pago_id_fkey;
alter table public.informes_interventoria add constraint informes_interventoria_acta_pago_id_fkey
  foreign key (acta_pago_id) references public.actas_pago (id) on delete no action;
alter table public.bitacora_actividades drop constraint if exists bitacora_actividades_tarea_id_fkey;
alter table public.bitacora_actividades add constraint bitacora_actividades_tarea_id_fkey
  foreign key (tarea_id) references public.tareas (id) on delete no action;

-- 6. Quien es vigilado no cambia ni quita su propia interventoría: solo el administrador o el director general.
create function public.interventoria_alcance_proteger()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null and not (public.es_admin() or public.es_director_general()) then
    raise exception 'Solo el administrador o el director general cambian o quitan una asignación de interventoría ya creada.' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke execute on function public.interventoria_alcance_proteger() from public, anon, authenticated;
create trigger interventoria_alcances_proteger before update or delete on public.interventoria_alcances
  for each row execute function public.interventoria_alcance_proteger();

-- 7. Quien solo consulta no puede generar mediciones calculadas con fechas futuras.
create or replace function public.medicion_calcular(p_proyecto uuid, p_fecha date)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_inicio date; v_bac numeric; v_k numeric; v_pv numeric; v_ev numeric; v_ac numeric; v_pesos numeric;
  v_mes integer; v_usa boolean;
begin
  if auth.uid() is null or not (public.puede_ver_proyecto(p_proyecto) or public.es_interventor(p_proyecto)) then
    raise exception 'No tienes acceso a este proyecto.' using errcode = '42501';
  end if;
  select fecha_inicio into v_inicio from public.proyectos where id = p_proyecto and usa_obra;
  if v_inicio is null or p_fecha is null or p_fecha < v_inicio
     or (p_fecha > public.hoy_co() and not public.puede_gestionar(p_proyecto)) then return; end if;   -- quien solo consulta no calcula fechas futuras
  select bac into v_bac from public.lineas_base where proyecto_id = p_proyecto and tipo = 'costo' order by version desc limit 1;
  select coalesce(sum(peso_pct), 0) into v_pesos from public.tareas where proyecto_id = p_proyecto;
  if v_bac is null or v_bac <= 0 or v_pesos <= 0 then return; end if;   -- faltan línea base o cronograma: no hay nada que calcular

  v_usa := coalesce(public.parametro('ev_usa_avance_verificado', p_proyecto), 'si') = 'si';
  v_k := greatest(0, (p_fecha - v_inicio)::numeric / 7);
  select coalesce(sum(peso_pct * least(1, greatest(0, (v_k - (semana_inicio - 1)) / duracion_semanas))), 0) / 100 * v_bac,
         coalesce(sum(peso_pct * (case when v_usa then coalesce(avance_verificado_pct, avance_pct) else avance_pct end) / 100), 0) / 100 * v_bac
    into v_pv, v_ev from public.tareas where proyecto_id = p_proyecto;
  v_mes := (extract(year from p_fecha)::integer - extract(year from v_inicio)::integer) * 12
         + extract(month from p_fecha)::integer - extract(month from v_inicio)::integer + 1;
  select coalesce(sum(valor_real), 0) into v_ac from public.gasto_mensual where proyecto_id = p_proyecto and mes <= greatest(v_mes, 0);

  insert into public.mediciones_evm (proyecto_id, fecha_corte, bac, pv, ev, ac, origen, creado_por)
    values (p_proyecto, p_fecha, round(v_bac, 2), round(least(v_pv, v_bac), 2), round(least(v_ev, v_bac), 2), round(v_ac, 2), 'calculado', auth.uid())
  on conflict (proyecto_id, fecha_corte) do update
    set bac = excluded.bac, pv = excluded.pv, ev = excluded.ev, ac = excluded.ac, origen = 'calculado'
    where public.mediciones_evm.origen = 'calculado';   -- una medición manual de la misma fecha no se pisa
exception when numeric_value_out_of_range then
  return;
end;
$$;

-- 8. Tope al plazo en días hábiles.
create or replace function public.dias_habiles_sumar(p_fecha date, p_n integer)
returns date language plpgsql stable security definer set search_path = ''
as $$
declare f date := p_fecha; n integer := 0;
begin
  if p_n is null or p_n < 0 or p_n > 366 then raise exception 'El plazo debe estar entre 0 y 366 días hábiles.' using errcode = '22023'; end if;
  while n < p_n loop
    f := f + 1;
    if extract(isodow from f)::integer < 6
       and not exists (select 1 from public.festivos where fecha = f)
       and not exists (select 1 from public.festivos_colombia(extract(year from f)::integer) c where c.fecha = f) then
      n := n + 1;
    end if;
  end loop;
  return f;
end;
$$;
revoke execute on function public.dias_habiles_sumar(date, integer) from public, anon;
grant execute on function public.dias_habiles_sumar(date, integer) to authenticated;

-- 9. Siempre debe quedar al menos un administrador: nadie deja la plataforma sin administrador.
create function public.perfil_proteger_admin()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.rol_global = 'administrador' and new.rol_global is distinct from old.rol_global
     and not exists (select 1 from public.perfiles where rol_global = 'administrador' and id <> old.id) then
    raise exception 'Debe quedar al menos un administrador en la plataforma.' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke execute on function public.perfil_proteger_admin() from public, anon, authenticated;
create trigger perfiles_proteger_admin before update of rol_global on public.perfiles
  for each row execute function public.perfil_proteger_admin();

-- 10. Tope duro del anticipo: 20 % del contrato para todos (la regla no depende de un parámetro editable).
alter table public.contratos add constraint contratos_anticipo_tope check (anticipo_pct <= 20);

-- 11. hallazgo_cerrar: quien registró el hallazgo debe seguir teniendo acceso al proyecto.
create or replace function public.hallazgo_cerrar(p_hallazgo uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare h public.hallazgos;
begin
  select * into h from public.hallazgos where id = p_hallazgo for update;
  if not found then raise exception 'Hallazgo no encontrado.' using errcode = '22023'; end if;
  if auth.uid() is null or not ((h.creado_por = auth.uid() and (public.puede_ver_proyecto(h.proyecto_id) or public.es_interventor(h.proyecto_id))) or public.interventor_subrol(h.proyecto_id, array['director'], null, h.contrato_id) is not null) then
    raise exception 'Solo quien registró el hallazgo o el director de interventoría lo cierra.' using errcode = '42501';
  end if;
  if h.estado <> 'respondido' then raise exception 'Solo se cierra un hallazgo que ya fue respondido.' using errcode = '22023'; end if;
  update public.hallazgos set estado = 'cerrado', cerrado_por = auth.uid(), cerrado_en = now() where id = p_hallazgo;
end;
$$;

-- 11. hallazgo_reabrir: quien registró el hallazgo debe seguir teniendo acceso al proyecto.
create or replace function public.hallazgo_reabrir(p_hallazgo uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare h public.hallazgos; v_dias integer;
begin
  select * into h from public.hallazgos where id = p_hallazgo for update;
  if not found then raise exception 'Hallazgo no encontrado.' using errcode = '22023'; end if;
  if auth.uid() is null or not ((h.creado_por = auth.uid() and (public.puede_ver_proyecto(h.proyecto_id) or public.es_interventor(h.proyecto_id))) or public.interventor_subrol(h.proyecto_id, array['director'], null, h.contrato_id) is not null) then
    raise exception 'Solo quien registró el hallazgo o el director de interventoría lo reabre.' using errcode = '42501';
  end if;
  if h.estado not in ('respondido', 'cerrado') then raise exception 'Solo se reabre un hallazgo respondido o cerrado.' using errcode = '22023'; end if;
  v_dias := coalesce(public.parametro('plazo_hallazgo_' || h.severidad, h.proyecto_id)::integer, 3);
  update public.hallazgos set estado = 'abierto', plazo_respuesta = public.dias_habiles_sumar(public.hoy_co(), v_dias), cerrado_por = null, cerrado_en = null where id = p_hallazgo;
end;
$$;
