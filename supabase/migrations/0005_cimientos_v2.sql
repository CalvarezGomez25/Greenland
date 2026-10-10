-- =============================================================================
-- Hito 1 (v2.0): roles completos, organizaciones, portafolios, ficha del proyecto,
-- parámetros configurables y auditoría general.
-- =============================================================================

-- 1. ROLES --------------------------------------------------------------------
alter table public.perfiles drop constraint perfiles_rol_global_check;
alter table public.perfiles add constraint perfiles_rol_global_check
  check (rol_global in ('administrador', 'director_general', 'analista_pmo', 'finanzas'));

alter table public.miembros_proyecto drop constraint miembros_proyecto_rol_check;
alter table public.miembros_proyecto add constraint miembros_proyecto_rol_check
  check (rol in ('gerente', 'patrocinador', 'supervisor', 'interventoria', 'consulta'));

-- Ven todo el portafolio: administrador, director general, analista PMO y finanzas.
create or replace function public.ve_todos()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce(public.mi_rol_global() in ('administrador', 'director_general', 'analista_pmo', 'finanzas'), false);
$$;

-- Miembro del proyecto con acceso general. La interventoría NO cuenta: ve solo lo asignado.
create or replace function public.es_miembro(p_proyecto uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.miembros_proyecto
    where proyecto_id = p_proyecto and usuario_id = auth.uid() and rol <> 'interventoria'
  );
$$;

create function public.es_interventor(p_proyecto uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.miembros_proyecto
    where proyecto_id = p_proyecto and usuario_id = auth.uid() and rol = 'interventoria'
  );
$$;

-- ¿Tiene acceso general (no es solo interventor)? Para parámetros y datos transversales.
create function public.acceso_general()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.ve_todos() or exists (
    select 1 from public.miembros_proyecto where usuario_id = auth.uid() and rol <> 'interventoria'
  );
$$;

create function public.es_director_general()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(public.mi_rol_global() = 'director_general', false); $$;

-- Administrador o gerente del proyecto: quien gestiona el proyecto.
create function public.puede_gestionar(p_proyecto uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select public.es_admin() or public.es_gerente_proyecto(p_proyecto); $$;

revoke execute on function public.es_interventor(uuid), public.acceso_general(),
  public.es_director_general(), public.puede_gestionar(uuid) from public, anon;
grant execute on function public.es_interventor(uuid), public.acceso_general(),
  public.es_director_general(), public.puede_gestionar(uuid) to authenticated;

drop policy proyectos_ver on public.proyectos;
create policy proyectos_ver on public.proyectos
  for select to authenticated
  using (public.ve_todos() or public.es_miembro(id) or public.es_interventor(id));

drop policy miembros_ver on public.miembros_proyecto;
create policy miembros_ver on public.miembros_proyecto
  for select to authenticated
  using (public.ve_todos() or usuario_id = auth.uid() or public.es_miembro(proyecto_id));

-- 2. ORGANIZACIONES Y PORTAFOLIOS -----------------------------------------------
create table public.organizaciones (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null check (length(btrim(nombre)) > 0),
  tipo      text not null default 'empresa' check (tipo in ('grupo', 'empresa', 'unidad')),
  creado_en timestamptz not null default now()
);
create table public.portafolios (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones (id),
  nombre          text not null check (length(btrim(nombre)) > 0),
  creado_en       timestamptz not null default now()
);

with o as (insert into public.organizaciones (nombre, tipo) values ('Greenland', 'grupo') returning id)
insert into public.portafolios (organizacion_id, nombre) select id, 'Portafolio general' from o;

alter table public.organizaciones enable row level security;
alter table public.portafolios enable row level security;
revoke all on public.organizaciones, public.portafolios from anon, authenticated;
grant select, insert, update on public.organizaciones, public.portafolios to authenticated;

create policy organizaciones_ver on public.organizaciones for select to authenticated using (public.acceso_general());
create policy organizaciones_crear on public.organizaciones for insert to authenticated with check (public.es_admin());
create policy organizaciones_editar on public.organizaciones for update to authenticated
  using (public.es_admin()) with check (public.es_admin());
create policy portafolios_ver on public.portafolios for select to authenticated using (public.acceso_general());
create policy portafolios_crear on public.portafolios for insert to authenticated with check (public.es_admin());
create policy portafolios_editar on public.portafolios for update to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- 3. FICHA DEL PROYECTO ---------------------------------------------------------
create sequence public.proyectos_codigo_seq;

alter table public.proyectos
  add column codigo          text unique,
  add column organizacion_id uuid references public.organizaciones (id),
  add column portafolio_id   uuid references public.portafolios (id),
  add column tipo            text not null default 'obra_civil'
    check (tipo in ('obra_civil', 'industrial', 'logistico', 'agroindustrial', 'otro')),
  add column fase            text not null default 'inicio'
    check (fase in ('inicio', 'planificacion', 'ejecucion', 'cierre')),
  add column estado          text not null default 'activo'
    check (estado in ('activo', 'en_pausa', 'cerrado', 'cancelado')),
  add column usa_obra        boolean not null default true;

-- Proyectos existentes: código y portafolio por defecto.
update public.proyectos set
  organizacion_id = (select id from public.organizaciones order by creado_en limit 1),
  portafolio_id = (select id from public.portafolios order by creado_en limit 1);
update public.proyectos p set codigo = 'GL-' || lpad(nextval('public.proyectos_codigo_seq')::text, 3, '0')
  from (select id from public.proyectos order by creado_en, id) o where p.id = o.id;

create function public.proyecto_valores_iniciales()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.organizacion_id is null then
    new.organizacion_id := (select id from public.organizaciones order by creado_en limit 1);
  end if;
  if new.portafolio_id is null then
    new.portafolio_id := (select id from public.portafolios
      where organizacion_id = new.organizacion_id order by creado_en limit 1);
  end if;
  if new.codigo is null then
    new.codigo := 'GL-' || lpad(nextval('public.proyectos_codigo_seq')::text, 3, '0');
  end if;
  return new;
end;
$$;
create trigger proyectos_valores_iniciales before insert on public.proyectos
  for each row execute function public.proyecto_valores_iniciales();
grant usage on sequence public.proyectos_codigo_seq to authenticated;

-- Ficha: el gerente y el administrador editan tipo, fase, estado y uso del área de Obra.
-- Código, organización y portafolio solo los cambia el administrador.
create function public.proyecto_ficha_guardar(
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
revoke execute on function public.proyecto_ficha_guardar(uuid, text, text, text, boolean, uuid, uuid, text) from public, anon;
grant execute on function public.proyecto_ficha_guardar(uuid, text, text, text, boolean, uuid, uuid, text) to authenticated;

-- 4. AUDITORÍA GENERAL ------------------------------------------------------------
create table public.auditoria (
  id             bigint generated always as identity primary key,
  usuario_id     uuid,
  fecha          timestamptz not null default now(),
  tabla          text not null,
  registro_id    text,
  proyecto_id    uuid,
  campo          text not null,
  valor_anterior text,
  valor_nuevo    text
);
create index auditoria_proyecto_idx on public.auditoria (proyecto_id, fecha desc);
create index auditoria_fecha_idx on public.auditoria (fecha desc);

-- Trigger genérico: guarda un renglón por campo cambiado (o uno por alta / baja).
create function public.auditar_tabla()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_viejo jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_nuevo jsonb := case when tg_op in ('UPDATE', 'INSERT') then to_jsonb(new) end;
  v_base  jsonb := coalesce(v_nuevo, v_viejo);
  v_id    text := coalesce(v_base ->> 'id', v_base ->> 'usuario_id', v_base ->> 'proyecto_id');
  v_proy  uuid := nullif(case when tg_table_name = 'proyectos' then v_base ->> 'id' else v_base ->> 'proyecto_id' end, '')::uuid;
  k text;
begin
  if tg_op = 'INSERT' then
    insert into public.auditoria (usuario_id, tabla, registro_id, proyecto_id, campo, valor_nuevo)
      values (auth.uid(), tg_table_name, v_id, v_proy, '(alta)', v_nuevo::text);
  elsif tg_op = 'DELETE' then
    insert into public.auditoria (usuario_id, tabla, registro_id, proyecto_id, campo, valor_anterior)
      values (auth.uid(), tg_table_name, v_id, v_proy, '(baja)', v_viejo::text);
  else
    for k in select key from jsonb_each(v_nuevo) loop
      continue when k in ('actualizado_en', 'creado_en');
      if (v_viejo -> k) is distinct from (v_nuevo -> k) then
        insert into public.auditoria (usuario_id, tabla, registro_id, proyecto_id, campo, valor_anterior, valor_nuevo)
          values (auth.uid(), tg_table_name, v_id, v_proy, k,
                  v_viejo ->> k, v_nuevo ->> k);
      end if;
    end loop;
  end if;
  return null;
end;
$$;
revoke execute on function public.auditar_tabla() from public, anon, authenticated;

alter table public.auditoria enable row level security;
revoke all on public.auditoria from anon, authenticated;
grant select on public.auditoria to authenticated;
create policy auditoria_ver on public.auditoria for select to authenticated
  using (public.es_admin() or public.es_director_general()
         or (proyecto_id is not null and public.es_gerente_proyecto(proyecto_id)));

create trigger proyectos_audit after insert or update or delete on public.proyectos
  for each row execute function public.auditar_tabla();
create trigger miembros_audit after insert or update or delete on public.miembros_proyecto
  for each row execute function public.auditar_tabla();
create trigger perfiles_audit after update on public.perfiles
  for each row execute function public.auditar_tabla();

-- 5. PARÁMETROS --------------------------------------------------------------------
create table public.parametros (
  id          uuid primary key default gen_random_uuid(),
  ambito      text not null check (ambito in ('global', 'portafolio', 'proyecto')),
  ambito_id   uuid,
  clave       text not null,
  valor       text not null,
  descripcion text,
  fuente      text,
  check ((ambito = 'global') = (ambito_id is null))
);
create unique index parametros_unico on public.parametros
  (ambito, coalesce(ambito_id, '00000000-0000-0000-0000-000000000000'::uuid), clave);

insert into public.parametros (ambito, clave, valor, descripcion, fuente) values
 ('global','retencion_garantia_pct','10','Retención de garantía sobre cada acta de pago (%)','Reglas de contratos'),
 ('global','anticipo_max_pct','20','Anticipo máximo para todos los contratos (%)','Reglas de contratos'),
 ('global','anticipo_umbral_referencia_cop','350000000','Por debajo de este valor, lo normal es no dar anticipo (COP)','Reglas de contratos'),
 ('global','spi_verde_min','0.95','SPI mínimo para Verde','Libro, Dashboard RAG'),
 ('global','cpi_verde_min','0.95','CPI mínimo para Verde','Libro, Dashboard RAG'),
 ('global','spi_amarillo_min','0.85','SPI mínimo para Amarillo','Libro, Dashboard RAG'),
 ('global','cpi_amarillo_min','0.85','CPI mínimo para Amarillo','Libro, Dashboard RAG'),
 ('global','tcpi_max','1.10','TCPI máximo aceptable','Libro, KPIs y EVM'),
 ('global','riesgo_critico_min','15','Score mínimo de riesgo Crítico','Libro, Registro de Riesgos'),
 ('global','riesgo_alto_min','8','Score mínimo de riesgo Alto','Libro, Registro de Riesgos'),
 ('global','riesgo_medio_min','4','Score mínimo de riesgo Medio','Libro, Registro de Riesgos'),
 ('global','cambio_menor_max_pct','2','Cambio Menor: hasta este % (inclusive)','Metodología GL'),
 ('global','cambio_moderado_max_pct','5','Cambio Moderado: hasta este % (inclusive); por encima es Crítico','Metodología GL'),
 ('global','cambio_firma_patrocinador_pct','5','Cambios por encima de este % exigen firma del patrocinador','Libro, Registro de Cambios'),
 ('global','cambio_aprobador_menor','gerente','Quién aprueba cambios menores (gerente | director_general)','Usuario, 9 de octubre de 2026'),
 ('global','cambio_aprobador_moderado','director_general','Quién aprueba cambios moderados','Usuario, 9 de octubre de 2026'),
 ('global','cambio_aprobador_critico','director_general','Quién aprueba cambios críticos','Usuario, 9 de octubre de 2026'),
 ('global','cambio_umbral_monto_cop','10000000','Valor del prototipo SGCC, por confirmar (COP)','SGCC, Configuración'),
 ('global','tipos_cambio','Alcance,Cronograma,Costo,Contractual (otrosí),Riesgo materializado,Calidad,Otro','Catálogo único de tipos de cambio (discrepancia D3)','Propuesta'),
 ('global','interventoria_vb_acta_obligatorio','si','Exigir concepto favorable de interventoría antes de aprobar un acta (si | no)','Propuesta'),
 ('global','plazo_hallazgo_observacion','5','Días hábiles para responder una Observación','Propuesta, ver S12'),
 ('global','plazo_hallazgo_no_conformidad','3','Días hábiles para responder una No conformidad','Propuesta, ver S12'),
 ('global','plazo_hallazgo_incumplimiento_grave','1','Días hábiles para responder un Incumplimiento grave','Propuesta, ver S12'),
 ('global','criterios_evaluacion_proveedor','Calidad,Cumplimiento del plazo,Seguridad y salud,Documentación,Respuesta a requerimientos','Criterios de evaluación (escala 1 a 5)','Propuesta, ver S12'),
 ('global','ev_usa_avance_verificado','si','El valor ganado usa el avance verificado por interventoría si existe (si | no)','Supuesto S11'),
 ('global','catalogo_disciplinas_diseno','Arquitectónico,Estructural,Geotécnico,Hidrosanitario,Eléctrico,Otros','Disciplinas de revisión de diseños','Propuesta, por validar'),
 ('global','categorias_riesgo','Técnico,Permisos,Financiero,Ambiental,Stakeholders,Cadena de suministro,Seguridad SST','Categorías de riesgo','Libro'),
 ('global','kpi_hitos_min','90','KPI: cumplimiento de hitos mínimo (%)','Libro'),
 ('global','kpi_riesgos_con_plan','100','KPI: riesgos críticos con plan (%)','Libro'),
 ('global','kpi_cambios_controlados_min','85','KPI: cambios controlados mínimo (%)','Libro'),
 ('global','kpi_reuniones_con_acta','100','KPI: reuniones con acta (%)','Libro'),
 ('global','kpi_satisfaccion_min','4.0','KPI: satisfacción del patrocinador mínima (1 a 5)','Libro'),
 ('global','kpi_reportes_a_tiempo','100','KPI: reportes a tiempo (%)','Libro'),
 ('global','stakeholder_cortes_estrategia','16,10,5','Cortes de poder × interés: Gestionar de cerca, Mantener satisfecho, Mantener informado (resto: Monitorear)','Libro; ver D2');

-- Valor vigente: el del proyecto, si no el de su portafolio, si no el global.
create function public.parametro(p_clave text, p_proyecto uuid default null)
returns text language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select valor from public.parametros where ambito = 'proyecto' and ambito_id = p_proyecto and clave = p_clave),
    (select pa.valor from public.parametros pa join public.proyectos pr on pr.portafolio_id = pa.ambito_id
       where pa.ambito = 'portafolio' and pr.id = p_proyecto and pa.clave = p_clave),
    (select valor from public.parametros where ambito = 'global' and clave = p_clave)
  );
$$;
revoke execute on function public.parametro(text, uuid) from public, anon;
grant execute on function public.parametro(text, uuid) to authenticated;

alter table public.parametros enable row level security;
revoke all on public.parametros from anon, authenticated;
grant select on public.parametros to authenticated;
create policy parametros_ver on public.parametros for select to authenticated using (public.acceso_general());
create trigger parametros_audit after insert or update or delete on public.parametros
  for each row execute function public.auditar_tabla();

-- Solo el administrador cambia parámetros. Nunca se crean claves nuevas: solo se ajustan las existentes.
create function public.parametro_guardar(p_ambito text, p_ambito_id uuid, p_clave text, p_valor text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_base public.parametros;
begin
  if auth.uid() is null or not public.es_admin() then
    raise exception 'Solo el administrador puede cambiar parámetros.' using errcode = '42501';
  end if;
  select * into v_base from public.parametros where ambito = 'global' and clave = p_clave;
  if not found then raise exception 'El parámetro % no existe.', p_clave using errcode = '22023'; end if;
  if p_valor is null or length(btrim(p_valor)) = 0 or length(p_valor) > 500 then
    raise exception 'El valor es obligatorio (máximo 500 caracteres).' using errcode = '22023';
  end if;
  if v_base.valor ~ '^[0-9]+([.][0-9]+)?$' and btrim(p_valor) !~ '^[0-9]+([.][0-9]+)?$' then
    raise exception 'El parámetro % debe ser un número (use punto para decimales).', p_clave using errcode = '22023';
  end if;
  if p_ambito = 'global' then
    update public.parametros set valor = btrim(p_valor) where id = v_base.id;
  elsif p_ambito = 'portafolio' and exists (select 1 from public.portafolios where id = p_ambito_id)
     or p_ambito = 'proyecto' and exists (select 1 from public.proyectos where id = p_ambito_id) then
    insert into public.parametros (ambito, ambito_id, clave, valor, descripcion, fuente)
      values (p_ambito, p_ambito_id, p_clave, btrim(p_valor), v_base.descripcion, 'Ajuste manual')
    on conflict (ambito, coalesce(ambito_id, '00000000-0000-0000-0000-000000000000'::uuid), clave)
      do update set valor = excluded.valor;
  else
    raise exception 'Ámbito no válido.' using errcode = '22023';
  end if;
end;
$$;
revoke execute on function public.parametro_guardar(text, uuid, text, text) from public, anon;
grant execute on function public.parametro_guardar(text, uuid, text, text) to authenticated;

-- Quitar un ajuste de portafolio o proyecto (vuelve a regir el valor superior).
create function public.parametro_quitar_ajuste(p_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.es_admin() then
    raise exception 'Solo el administrador puede cambiar parámetros.' using errcode = '42501';
  end if;
  delete from public.parametros where id = p_id and ambito <> 'global';
end;
$$;
revoke execute on function public.parametro_quitar_ajuste(uuid) from public, anon;
grant execute on function public.parametro_quitar_ajuste(uuid) to authenticated;

-- 6. ASIGNAR ROL GLOBAL ----------------------------------------------------------------
create function public.perfil_asignar_rol_global(p_usuario uuid, p_rol text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.es_admin() then
    raise exception 'Solo el administrador asigna roles.' using errcode = '42501';
  end if;
  if p_usuario = auth.uid() then
    raise exception 'No puedes cambiar tu propio rol (para evitar quedarte sin administrador).' using errcode = '22023';
  end if;
  if p_rol is not null and p_rol not in ('administrador', 'director_general', 'analista_pmo', 'finanzas') then
    raise exception 'Rol no válido.' using errcode = '22023';
  end if;
  update public.perfiles set rol_global = p_rol where id = p_usuario;
  if not found then raise exception 'Usuario no encontrado.' using errcode = '22023'; end if;
end;
$$;
revoke execute on function public.perfil_asignar_rol_global(uuid, text) from public, anon;
grant execute on function public.perfil_asignar_rol_global(uuid, text) to authenticated;
