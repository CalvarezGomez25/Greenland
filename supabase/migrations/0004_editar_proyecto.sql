-- =============================================================================
-- Hito 2 (ajuste): editar los datos de un proyecto
-- Pueden: el Administrador y el Gerente de ESE proyecto. Se hace con una función
-- (no con permiso directo sobre la tabla) para limitar qué columnas cambian y
-- verificar el gasto ya registrado dentro de la misma base de datos.
-- =============================================================================

create or replace function public.proyecto_editar(
  p_proyecto uuid,
  p_nombre text,
  p_cliente text,
  p_ubicacion text,
  p_fecha_inicio date,
  p_duracion integer
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_mes_max integer;
begin
  if auth.uid() is null
     or not (public.es_admin() or public.es_gerente_proyecto(p_proyecto)) then
    raise exception 'No tienes permiso para editar este proyecto.' using errcode = '42501';
  end if;

  if p_nombre is null or length(btrim(p_nombre)) not between 1 and 120 then
    raise exception 'El nombre es obligatorio (máximo 120 caracteres).' using errcode = '22023';
  end if;
  if length(coalesce(p_cliente, '')) > 120 or length(coalesce(p_ubicacion, '')) > 160 then
    raise exception 'Cliente o ubicación demasiado largos.' using errcode = '22023';
  end if;
  if p_fecha_inicio is null then
    raise exception 'Indica una fecha de inicio válida.' using errcode = '22023';
  end if;
  if p_duracion is null or p_duracion not between 1 and 120 then
    raise exception 'La duración debe estar entre 1 y 120 meses.' using errcode = '22023';
  end if;

  select max(mes) into v_mes_max from public.gasto_mensual where proyecto_id = p_proyecto;
  if v_mes_max is not null and p_duracion < v_mes_max then
    raise exception 'Ya hay gasto registrado hasta el mes %. La duración no puede ser menor.', v_mes_max
      using errcode = '22023';
  end if;

  update public.proyectos
     set nombre = btrim(p_nombre),
         cliente = nullif(btrim(coalesce(p_cliente, '')), ''),
         ubicacion = nullif(btrim(coalesce(p_ubicacion, '')), ''),
         fecha_inicio = p_fecha_inicio,
         duracion_meses = p_duracion
   where id = p_proyecto;

  if not found then
    raise exception 'Proyecto no encontrado.' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.proyecto_editar(uuid, text, text, text, date, integer)
  from public, anon, authenticated;
grant execute on function public.proyecto_editar(uuid, text, text, text, date, integer)
  to authenticated;
