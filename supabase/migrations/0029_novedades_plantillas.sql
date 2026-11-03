-- 0029: aliados, capa 4 (paquete RAÍZ): novedades de campo con foto y plantillas de documentos Word.
--
--  - Novedades: quien está en obra (supervisor, interventoría o gerente) registra desde el celular un hecho de un contrato (acta de
--    inicio firmada, póliza expedida, suspensión, reinicio, comunicación...) con hasta 3 fotos. NO cambia nada solo: la gerencia la revisa y
--    la «aplica» (el acta de inicio, la suspensión y el reinicio se aplican con un clic; lo demás se registra a mano) o la descarta.
--  - Plantillas: los archivos Word con campos de combinación (los de RAÍZ u otros) los sube el administrador o el director a un
--    depósito privado; el texto jurídico vive allí, no en el código. Se generan documentos desde un contrato o una modificación.
-- Los plazos y porcentajes de las cláusulas de la minuta de El Silencio GL son parámetros.

-- 1. PARÁMETROS DE LAS CLÁUSULAS -----------------------------------------------------------------------------------
insert into public.parametros (ambito, clave, valor, descripcion, fuente) values
 ('global', 'minuta_penal_pct', '20', 'Cláusula penal (% del valor del contrato) que imprimen las minutas', 'Minuta de contrato de obra El Silencio GL (paquete RAÍZ)'),
 ('global', 'minuta_multa_dia_pct', '3', 'Retención por día de retraso (%) que imprimen las minutas', 'Minuta El Silencio GL; PENDIENTE de revisión jurídica (agota el valor en unos 33 días)'),
 ('global', 'minuta_confid_smmlv', '100', 'Pena por violar la confidencialidad (SMMLV)', 'Minuta de contrato de obra El Silencio GL (paquete RAÍZ)'),
 ('global', 'minuta_confid_anios', '10', 'Vigencia de la confidencialidad después del contrato (años)', 'Minuta de contrato de obra El Silencio GL (paquete RAÍZ)'),
 ('global', 'minuta_liquidacion_meses', '2', 'Plazo para la liquidación bilateral (meses)', 'Minuta de contrato de obra El Silencio GL (paquete RAÍZ)'),
 ('global', 'minuta_aviso_terminacion_dias', '10', 'Aviso para la terminación unilateral (días)', 'Minuta de contrato de obra El Silencio GL (paquete RAÍZ)'),
 ('global', 'minuta_inicio_dias', '8', 'Plazo para iniciar las obras tras aprobar las pólizas (días)', 'Minuta de contrato de obra El Silencio GL (paquete RAÍZ)'),
 ('global', 'minuta_suspension_dias', '8', 'Suspensión que habilita la terminación (días)', 'Minuta de contrato de obra El Silencio GL (paquete RAÍZ)'),
 ('global', 'minuta_subsanar_dias', '5', 'Plazo para los correctivos tras una auditoría (días hábiles)', 'Minuta de contrato de obra El Silencio GL (paquete RAÍZ)')
on conflict do nothing;

-- 2. DEPÓSITOS PRIVADOS ----------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('novedades', 'novedades', false), ('plantillas', 'plantillas', false) on conflict (id) do nothing;

-- Novedades: ruta <proyecto>/<novedad>/<archivo>. Se sube si se puede registrar la bitácora del proyecto; se lee si se ve el proyecto
-- (la interventoría ve solo lo que ella subió).
create policy novedades_objetos_leer on storage.objects for select to authenticated
  using (bucket_id = 'novedades' and (public.puede_ver_proyecto(public.proyecto_de_ruta(name)) or owner = auth.uid()));
create policy novedades_objetos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'novedades' and public.puede_registrar_bitacora(public.proyecto_de_ruta(name)));

-- Plantillas: las lee quien ve el maestro de aliados y las gestionan el administrador y el director general.
create policy plantillas_objetos_leer on storage.objects for select to authenticated
  using (bucket_id = 'plantillas' and public.puede_ver_aliados());
create policy plantillas_objetos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'plantillas' and public.puede_editar_contratantes());
create policy plantillas_objetos_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'plantillas' and public.puede_editar_contratantes());

-- 3. PLANTILLAS ---------------------------------------------------------------------------------------------------------
create table public.plantillas_documento (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null check (length(btrim(nombre)) between 1 and 120),
  ambito      text not null check (ambito in ('contrato', 'modificacion')),
  archivo     text not null unique check (length(archivo) between 10 and 300),   -- ruta en el depósito «plantillas»
  tamano      integer not null check (tamano > 0),
  campos      text[] not null default '{}',   -- campos de combinación que trae el archivo
  activa      boolean not null default true,
  nota        text check (length(nota) <= 500),
  subida_por  uuid default auth.uid(),
  creado_en   timestamptz not null default now()
);
create trigger plantillas_audit after insert or update or delete on public.plantillas_documento for each row execute function public.auditar_tabla();
alter table public.plantillas_documento enable row level security;
revoke all on public.plantillas_documento from anon, authenticated;
grant select, insert, update, delete on public.plantillas_documento to authenticated;
create policy plantillas_ver on public.plantillas_documento for select to authenticated using (public.puede_ver_aliados());
create policy plantillas_crear on public.plantillas_documento for insert to authenticated with check (public.puede_editar_contratantes());
create policy plantillas_editar on public.plantillas_documento for update to authenticated
  using (public.puede_editar_contratantes()) with check (public.puede_editar_contratantes());
create policy plantillas_borrar on public.plantillas_documento for delete to authenticated using (public.puede_editar_contratantes());

-- 4. NOVEDADES DE CAMPO -----------------------------------------------------------------------------------------------------
create table public.contrato_novedades (
  id            uuid primary key,
  proyecto_id   uuid not null references public.proyectos (id) on delete cascade,
  contrato_id   uuid not null references public.contratos (id) on delete cascade,
  tipo          text not null check (tipo in ('acta_inicio', 'poliza', 'modificacion', 'suspension', 'reinicio', 'comunicacion', 'otro')),
  fecha         date not null,
  descripcion   text not null check (length(btrim(descripcion)) between 1 and 1000),
  fotos         text[] not null default '{}' check (cardinality(fotos) <= 3),
  estado        text not null default 'pendiente' check (estado in ('pendiente', 'aplicada', 'descartada')),
  nota_revision text check (length(nota_revision) <= 500),
  registrada_por uuid not null default auth.uid(),
  revisada_por  uuid,
  revisada_en   timestamptz,
  creado_en     timestamptz not null default now()
);
create index contrato_novedades_proyecto_idx on public.contrato_novedades (proyecto_id, estado, creado_en desc);
create trigger contrato_novedades_audit after insert or update or delete on public.contrato_novedades for each row execute function public.auditar_tabla();
alter table public.contrato_novedades enable row level security;
revoke all on public.contrato_novedades from anon, authenticated;
grant select on public.contrato_novedades to authenticated;
-- La ve quien ve el proyecto (la interventoría no) y siempre quien la registró.
create policy novedades_ver on public.contrato_novedades for select to authenticated
  using (public.puede_ver_proyecto(proyecto_id) or registrada_por = auth.uid());

-- Registra una novedad. Las fotos ya están subidas al depósito con la ruta <proyecto>/<novedad>/<archivo>.
create function public.novedad_crear(p_id uuid, p_proyecto uuid, p_contrato uuid, p_datos jsonb, p_fotos jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_tipo text := coalesce(nullif(btrim(coalesce(p_datos ->> 'tipo', '')), ''), 'otro');
  v_desc text := nullif(btrim(coalesce(p_datos ->> 'descripcion', '')), '');
  v_fecha date; v_fotos text[]; r text;
begin
  if auth.uid() is null or not public.puede_registrar_bitacora(p_proyecto) then
    raise exception 'No tienes permiso para registrar novedades en este proyecto.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.contratos where id = p_contrato and proyecto_id = p_proyecto) then
    raise exception 'El contrato no existe en este proyecto o no tienes acceso a él.' using errcode = '22023';
  end if;
  if v_desc is null then raise exception 'Describe la novedad.' using errcode = '22023'; end if;
  begin v_fecha := nullif(btrim(coalesce(p_datos ->> 'fecha', '')), '')::date;
  exception when others then raise exception 'La fecha no es válida.' using errcode = '22023'; end;
  if v_fecha is null then raise exception 'Indica la fecha de la novedad.' using errcode = '22023'; end if;
  if v_fecha > public.hoy_co() then raise exception 'La fecha de la novedad no puede ser futura.' using errcode = '22023'; end if;
  if jsonb_typeof(coalesce(p_fotos, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_fotos, '[]'::jsonb)) > 3 then
    raise exception 'Máximo 3 fotos por novedad.' using errcode = '22023';
  end if;
  v_fotos := array(select jsonb_array_elements_text(coalesce(p_fotos, '[]'::jsonb)));
  foreach r in array v_fotos loop
    if r !~ ('^' || p_proyecto::text || '/' || p_id::text || '/[A-Za-z0-9._-]{1,100}$') then
      raise exception 'Una foto no tiene la ruta esperada.' using errcode = '22023';
    end if;
  end loop;
  insert into public.contrato_novedades (id, proyecto_id, contrato_id, tipo, fecha, descripcion, fotos)
    values (p_id, p_proyecto, p_contrato, v_tipo, v_fecha, v_desc, v_fotos);
  return p_id;
exception when check_violation then
  raise exception 'Un dato de la novedad no es válido (tipo, textos o número de fotos).' using errcode = '22023';
end;
$$;

-- La gerencia revisa una novedad: la aplica o la descarta. Aplicar un acta de inicio, una suspensión o un reinicio deja el dato
-- en el contrato (el acta de inicio solo si el contrato aún no la tiene; suspensión y reinicio como modificaciones firmadas).
create function public.novedad_revisar(p_novedad uuid, p_accion text, p_nota text)
returns void language plpgsql security definer set search_path = ''
as $$
declare n public.contrato_novedades; v_nota text := nullif(btrim(coalesce(p_nota, '')), '');
begin
  select * into n from public.contrato_novedades where id = p_novedad for update;
  if not found then raise exception 'Novedad no encontrada.' using errcode = '22023'; end if;
  if auth.uid() is null or not public.puede_gestionar(n.proyecto_id) then
    raise exception 'Solo la gerencia del proyecto revisa las novedades.' using errcode = '42501';
  end if;
  if n.estado <> 'pendiente' then raise exception 'La novedad ya fue revisada.' using errcode = '22023'; end if;
  if p_accion not in ('aplicar', 'descartar') then raise exception 'Acción no válida.' using errcode = '22023'; end if;
  if v_nota is not null and length(v_nota) > 500 then raise exception 'La nota no puede superar 500 caracteres.' using errcode = '22023'; end if;
  if p_accion = 'descartar' and v_nota is null then raise exception 'Escribe por qué se descarta la novedad.' using errcode = '22023'; end if;
  if p_accion = 'aplicar' then
    if n.tipo = 'acta_inicio' then
      if (select fecha_acta_inicio from public.contratos where id = n.contrato_id) is not null then
        raise exception 'El contrato ya tiene fecha de acta de inicio: corrígela en «Datos contractuales» y descarta esta novedad.' using errcode = '22023';
      end if;
      update public.contratos set fecha_acta_inicio = n.fecha where id = n.contrato_id;
    elsif n.tipo in ('suspension', 'reinicio') then
      perform public.modificacion_guardar(n.contrato_id, null, jsonb_build_object('tipo', n.tipo, 'estado', 'firmada', 'fecha_firma', n.fecha::text,
        'descripcion', n.descripcion, 'justificacion', 'Novedad de campo registrada el ' || n.creado_en::date::text));
    end if;
  end if;
  update public.contrato_novedades set estado = case when p_accion = 'aplicar' then 'aplicada' else 'descartada' end,
    nota_revision = v_nota, revisada_por = auth.uid(), revisada_en = now() where id = p_novedad;
exception when others then
  if sqlstate in ('22023', '42501') then raise; end if;
  raise exception 'No se pudo aplicar la novedad: %', sqlerrm using errcode = '22023';
end;
$$;
revoke execute on function public.novedad_crear(uuid, uuid, uuid, jsonb, jsonb), public.novedad_revisar(uuid, text, text) from public, anon;
grant execute on function public.novedad_crear(uuid, uuid, uuid, jsonb, jsonb), public.novedad_revisar(uuid, text, text) to authenticated;
