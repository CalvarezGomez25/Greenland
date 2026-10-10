-- =============================================================================
-- Hito 2 (v2.0): Acta de constitución y captura manual de BAC, PV, EV y AC
-- =============================================================================

-- ¿Puede reportar? Administrador, gerente del proyecto o analista PMO.
create function public.puede_reportar(p_proyecto uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.puede_gestionar(p_proyecto) or coalesce(public.mi_rol_global() = 'analista_pmo', false);
$$;
revoke execute on function public.puede_reportar(uuid) from public, anon;
grant execute on function public.puede_reportar(uuid) to authenticated;

-- 1. ACTA DE CONSTITUCIÓN (una por proyecto) ---------------------------------------
create table public.actas_constitucion (
  proyecto_id            uuid primary key references public.proyectos (id) on delete cascade,
  proposito              text,
  objetivo_smart         text,
  beneficios             text,
  alcance_incluido       text,
  alcance_excluido       text,
  supuestos              text,
  restricciones          text,
  presupuesto_estimado   numeric(15, 2) check (presupuesto_estimado >= 0),
  fuente_financiamiento  text,
  equipo_n               integer check (equipo_n >= 0),
  contratistas_externos  text,
  firma_gerente          date,
  firma_patrocinador     date,
  actualizado_en         timestamptz not null default now()
);
create trigger actas_actualizado before update on public.actas_constitucion
  for each row execute function public.marcar_actualizado();
create trigger actas_audit after insert or update or delete on public.actas_constitucion
  for each row execute function public.auditar_tabla();

alter table public.actas_constitucion enable row level security;
revoke all on public.actas_constitucion from anon, authenticated;
grant select on public.actas_constitucion to authenticated;
create policy actas_ver on public.actas_constitucion for select to authenticated
  using (public.puede_ver_proyecto(proyecto_id));

-- Guardar el contenido. Si el contenido cambia después de firmado, las firmas se anulan.
create function public.acta_guardar(p_proyecto uuid, p_datos jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v public.actas_constitucion;
  campos text[] := array['proposito','objetivo_smart','beneficios','alcance_incluido','alcance_excluido',
                         'supuestos','restricciones','fuente_financiamiento','contratistas_externos'];
  c text; t text;
  n_presupuesto numeric(15,2);
  n_equipo integer;
  nuevo jsonb := '{}'::jsonb;
  cambio boolean := false;
begin
  if auth.uid() is null or not public.puede_gestionar(p_proyecto) then
    raise exception 'No tienes permiso para editar el acta de este proyecto.' using errcode = '42501';
  end if;
  foreach c in array campos loop
    t := nullif(btrim(coalesce(p_datos ->> c, '')), '');
    if t is not null and length(t) > 4000 then
      raise exception 'Un campo del acta supera 4000 caracteres.' using errcode = '22023';
    end if;
    nuevo := nuevo || jsonb_build_object(c, t);
  end loop;
  begin
    n_presupuesto := nullif(btrim(coalesce(p_datos ->> 'presupuesto_estimado', '')), '')::numeric;
    n_equipo := nullif(btrim(coalesce(p_datos ->> 'equipo_n', '')), '')::integer;
  exception when others then
    raise exception 'El presupuesto estimado y el equipo deben ser números válidos.' using errcode = '22023';
  end;
  if n_presupuesto < 0 or n_equipo < 0 then
    raise exception 'El presupuesto estimado y el equipo no pueden ser negativos.' using errcode = '22023';
  end if;

  select * into v from public.actas_constitucion where proyecto_id = p_proyecto;
  if not found then
    insert into public.actas_constitucion (proyecto_id, proposito, objetivo_smart, beneficios, alcance_incluido,
      alcance_excluido, supuestos, restricciones, presupuesto_estimado, fuente_financiamiento, equipo_n, contratistas_externos)
    values (p_proyecto, nuevo ->> 'proposito', nuevo ->> 'objetivo_smart', nuevo ->> 'beneficios',
      nuevo ->> 'alcance_incluido', nuevo ->> 'alcance_excluido', nuevo ->> 'supuestos', nuevo ->> 'restricciones',
      n_presupuesto, nuevo ->> 'fuente_financiamiento', n_equipo, nuevo ->> 'contratistas_externos');
  else
    cambio := (v.proposito, v.objetivo_smart, v.beneficios, v.alcance_incluido, v.alcance_excluido, v.supuestos,
               v.restricciones, v.presupuesto_estimado, v.fuente_financiamiento, v.equipo_n, v.contratistas_externos)
      is distinct from (nuevo ->> 'proposito', nuevo ->> 'objetivo_smart', nuevo ->> 'beneficios', nuevo ->> 'alcance_incluido',
               nuevo ->> 'alcance_excluido', nuevo ->> 'supuestos', nuevo ->> 'restricciones', n_presupuesto,
               nuevo ->> 'fuente_financiamiento', n_equipo, nuevo ->> 'contratistas_externos');
    update public.actas_constitucion set
      proposito = nuevo ->> 'proposito', objetivo_smart = nuevo ->> 'objetivo_smart', beneficios = nuevo ->> 'beneficios',
      alcance_incluido = nuevo ->> 'alcance_incluido', alcance_excluido = nuevo ->> 'alcance_excluido',
      supuestos = nuevo ->> 'supuestos', restricciones = nuevo ->> 'restricciones', presupuesto_estimado = n_presupuesto,
      fuente_financiamiento = nuevo ->> 'fuente_financiamiento', equipo_n = n_equipo,
      contratistas_externos = nuevo ->> 'contratistas_externos',
      firma_gerente = case when cambio then null else firma_gerente end,
      firma_patrocinador = case when cambio then null else firma_patrocinador end
    where proyecto_id = p_proyecto;
  end if;
end;
$$;

-- Firmar: el gerente firma como gerente; el patrocinador (o el administrador, si el patrocinador
-- no es usuario de la plataforma) firma como patrocinador. Queda en auditoría quién registró la firma.
create function public.acta_firmar(p_proyecto uuid, p_como text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.' using errcode = '28000'; end if;
  if not exists (select 1 from public.actas_constitucion where proyecto_id = p_proyecto) then
    raise exception 'Primero guarda el contenido del acta.' using errcode = '22023';
  end if;
  if p_como = 'gerente' then
    if not public.es_gerente_proyecto(p_proyecto) then
      raise exception 'Solo el gerente del proyecto firma como gerente.' using errcode = '42501';
    end if;
    update public.actas_constitucion set firma_gerente = current_date where proyecto_id = p_proyecto;
  elsif p_como = 'patrocinador' then
    if not (public.es_admin() or exists (select 1 from public.miembros_proyecto
        where proyecto_id = p_proyecto and usuario_id = auth.uid() and rol = 'patrocinador')) then
      raise exception 'Solo el patrocinador (o el administrador) firma como patrocinador.' using errcode = '42501';
    end if;
    update public.actas_constitucion set firma_patrocinador = current_date where proyecto_id = p_proyecto;
  else
    raise exception 'Firma no válida.' using errcode = '22023';
  end if;
end;
$$;
revoke execute on function public.acta_guardar(uuid, jsonb), public.acta_firmar(uuid, text) from public, anon;
grant execute on function public.acta_guardar(uuid, jsonb), public.acta_firmar(uuid, text) to authenticated;

-- 2. MEDICIONES DE VALOR GANADO (captura manual) -----------------------------------
create table public.mediciones_evm (
  id           uuid primary key default gen_random_uuid(),
  proyecto_id  uuid not null references public.proyectos (id) on delete cascade,
  fecha_corte  date not null,
  bac          numeric(15, 2) not null check (bac >= 0),
  pv           numeric(15, 2) not null check (pv >= 0),
  ev           numeric(15, 2) not null check (ev >= 0),
  ac           numeric(15, 2) not null check (ac >= 0),
  origen       text not null default 'manual' check (origen in ('manual', 'calculado')),
  creado_por   uuid default auth.uid(),
  creado_en    timestamptz not null default now(),
  unique (proyecto_id, fecha_corte)
);
create index mediciones_evm_idx on public.mediciones_evm (proyecto_id, fecha_corte desc);
create trigger mediciones_audit after insert or update or delete on public.mediciones_evm
  for each row execute function public.auditar_tabla();

alter table public.mediciones_evm enable row level security;
revoke all on public.mediciones_evm from anon, authenticated;
grant select on public.mediciones_evm to authenticated;
create policy mediciones_ver on public.mediciones_evm for select to authenticated
  using (public.puede_ver_proyecto(proyecto_id));

create function public.medicion_guardar(p_proyecto uuid, p_fecha date, p_bac numeric, p_pv numeric, p_ev numeric, p_ac numeric)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.puede_reportar(p_proyecto) then
    raise exception 'No tienes permiso para registrar mediciones de este proyecto.' using errcode = '42501';
  end if;
  if p_fecha is null then raise exception 'Indica la fecha de corte.' using errcode = '22023'; end if;
  if p_bac is null or p_pv is null or p_ev is null or p_ac is null or least(p_bac, p_pv, p_ev, p_ac) < 0 then
    raise exception 'BAC, PV, EV y AC son obligatorios y no pueden ser negativos.' using errcode = '22023';
  end if;
  if p_bac = 0 then raise exception 'El BAC debe ser mayor que cero.' using errcode = '22023'; end if;
  if p_pv > p_bac or p_ev > p_bac then
    raise exception 'PV y EV no pueden superar el BAC.' using errcode = '22023';
  end if;
  insert into public.mediciones_evm (proyecto_id, fecha_corte, bac, pv, ev, ac, origen)
    values (p_proyecto, p_fecha, p_bac, p_pv, p_ev, p_ac, 'manual')
  on conflict (proyecto_id, fecha_corte) do update
    set bac = excluded.bac, pv = excluded.pv, ev = excluded.ev, ac = excluded.ac, origen = 'manual';
exception when numeric_value_out_of_range then
  raise exception 'Algún valor es demasiado grande.' using errcode = '22023';
end;
$$;

create function public.medicion_borrar(p_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_proy uuid;
begin
  select proyecto_id into v_proy from public.mediciones_evm where id = p_id;
  if v_proy is null then return; end if;
  if auth.uid() is null or not public.puede_reportar(v_proy) then
    raise exception 'No tienes permiso para borrar mediciones de este proyecto.' using errcode = '42501';
  end if;
  delete from public.mediciones_evm where id = p_id;
end;
$$;
revoke execute on function public.medicion_guardar(uuid, date, numeric, numeric, numeric, numeric), public.medicion_borrar(uuid) from public, anon;
grant execute on function public.medicion_guardar(uuid, date, numeric, numeric, numeric, numeric), public.medicion_borrar(uuid) to authenticated;
