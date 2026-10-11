-- Registro de riesgos ampliado + importación desde Excel.
-- Agrega los datos que traen los registros de riesgos por frente (frente, causa, consecuencia, momento de
-- control, fecha objetivo y referencia) y una función para cargar varios riesgos de una vez.
alter table public.riesgos add column if not exists frente          text check (length(frente) <= 120);
alter table public.riesgos add column if not exists causa           text check (length(causa) <= 2000);
alter table public.riesgos add column if not exists consecuencia    text check (length(consecuencia) <= 2000);
alter table public.riesgos add column if not exists momento_control text check (length(momento_control) <= 60);
alter table public.riesgos add column if not exists fecha_objetivo  date;
alter table public.riesgos add column if not exists referencia      text check (length(referencia) <= 1000);
create index if not exists riesgos_frente_idx on public.riesgos (proyecto_id, frente);

-- Los riesgos no tenían registro de cambios: ahora cada alta, cambio o baja queda en la auditoría.
drop trigger if exists riesgos_audit on public.riesgos;
create trigger riesgos_audit after insert or update or delete on public.riesgos
  for each row execute function public.auditar_tabla();

-- Carga o actualiza riesgos por código (T-01, F1-01...). Todo o nada; cada riesgo queda en la auditoría.
create or replace function public.riesgos_importar(p_proyecto uuid, p_filas jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_fila  record;
  e       jsonb;
  v_cod   text;
  v_creados integer := 0;
  v_actual  integer := 0;
  v_dup   text;
  v_estr  text;
  v_fecha date;
  v_nuevo boolean;
begin
  if not coalesce(public.puede_gestionar(p_proyecto), false) then
    raise exception 'No tienes permiso para modificar los riesgos de este proyecto.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('riesgos:' || p_proyecto::text));

  if p_filas is null or jsonb_typeof(p_filas) <> 'array' or jsonb_array_length(p_filas) = 0 then
    raise exception 'No hay riesgos para importar.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_filas) > 500 then
    raise exception 'Se admiten como máximo 500 riesgos por importación.' using errcode = '22023';
  end if;

  select btrim(x ->> 'codigo') into v_dup from jsonb_array_elements(p_filas) as t(x)
   group by btrim(x ->> 'codigo') having count(*) > 1 limit 1;
  if v_dup is not null then
    raise exception 'El código "%" está repetido en el archivo.', v_dup using errcode = '22023';
  end if;

  for v_fila in select t.x as e, t.n as n from jsonb_array_elements(p_filas) with ordinality as t(x, n) loop
    e := v_fila.e;
    if jsonb_typeof(e) <> 'object' then
      raise exception 'Fila %: formato no válido.', v_fila.n using errcode = '22023';
    end if;
    v_cod := btrim(coalesce(e ->> 'codigo', ''));
    if length(v_cod) not between 1 and 30 then
      raise exception 'Fila %: el código es obligatorio (máximo 30 caracteres).', v_fila.n using errcode = '22023';
    end if;
    v_estr := nullif(btrim(coalesce(e ->> 'estrategia', '')), '');
    v_fecha := null;
    if nullif(btrim(coalesce(e ->> 'fecha_objetivo', '')), '') is not null then
      if (e ->> 'fecha_objetivo') !~ '^\d{4}-\d{2}-\d{2}$' then
        raise exception 'Fila %: la fecha objetivo debe tener formato AAAA-MM-DD.', v_fila.n using errcode = '22023';
      end if;
      v_fecha := (e ->> 'fecha_objetivo')::date;
    end if;

    -- los demás límites (largos, 1 a 5, estados) los hacen respetar las restricciones de la tabla
    begin
      insert into public.riesgos (proyecto_id, codigo, categoria, descripcion, probabilidad, impacto, estrategia,
                                  plan_accion, responsable, estado, frente, causa, consecuencia, momento_control,
                                  fecha_objetivo, referencia)
      values (p_proyecto, v_cod, btrim(e ->> 'categoria'), btrim(e ->> 'descripcion'),
              (e ->> 'probabilidad')::int, (e ->> 'impacto')::int, v_estr,
              nullif(btrim(coalesce(e ->> 'plan_accion', '')), ''), nullif(btrim(coalesce(e ->> 'responsable', '')), ''),
              coalesce(nullif(btrim(coalesce(e ->> 'estado', '')), ''), 'activo'),
              nullif(btrim(coalesce(e ->> 'frente', '')), ''), nullif(btrim(coalesce(e ->> 'causa', '')), ''),
              nullif(btrim(coalesce(e ->> 'consecuencia', '')), ''), nullif(btrim(coalesce(e ->> 'momento_control', '')), ''),
              v_fecha, nullif(btrim(coalesce(e ->> 'referencia', '')), ''))
      on conflict (proyecto_id, codigo) do update set
        categoria = excluded.categoria, descripcion = excluded.descripcion, probabilidad = excluded.probabilidad,
        impacto = excluded.impacto, estrategia = excluded.estrategia, plan_accion = excluded.plan_accion,
        responsable = excluded.responsable, estado = excluded.estado, frente = excluded.frente, causa = excluded.causa,
        consecuencia = excluded.consecuencia, momento_control = excluded.momento_control,
        fecha_objetivo = excluded.fecha_objetivo, referencia = excluded.referencia
      returning (xmax = 0) into v_nuevo;  -- xmax = 0: fila recién insertada; si no, fue actualizada
      if v_nuevo then v_creados := v_creados + 1; else v_actual := v_actual + 1; end if;
    exception when check_violation or not_null_violation or invalid_text_representation then
      raise exception 'Fila % (%): algún dato no es válido (categoría y descripción obligatorias; probabilidad e impacto de 1 a 5; estado activo, materializado o cerrado).', v_fila.n, v_cod
        using errcode = '22023';
    end;
  end loop;

  return jsonb_build_object('creados', v_creados, 'actualizados', v_actual);
end;
$$;
revoke execute on function public.riesgos_importar(uuid, jsonb) from public, anon;
grant execute on function public.riesgos_importar(uuid, jsonb) to authenticated;
