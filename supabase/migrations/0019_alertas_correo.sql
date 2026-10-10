-- 0019: alertas por correo cuando una decisión queda pendiente.
insert into public.parametros (ambito, clave, valor, descripcion, fuente) values
 ('global', 'alertas_correo_activas', 'si',
  'Si es "no", la plataforma no envía correos de alerta (ni inmediatos ni el resumen diario)', 'Decisión del usuario');

-- Correos de quienes deben enterarse de una decisión del proyecto: el director general (si no hay ninguno, los
-- administradores) y/o el gerente del proyecto. Lo puede pedir quien gestiona el proyecto, el director o el analista.
create function public.correos_alerta(p_proyecto uuid, p_audiencia text)
returns table (correo text) language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not (coalesce(public.puede_gestionar(p_proyecto), false) or coalesce(public.es_director_general(), false) or coalesce(public.mi_rol_global() = 'analista_pmo', false)) then
    raise exception 'No tienes permiso para esta consulta.' using errcode = '42501';
  end if;
  if p_audiencia not in ('director', 'gerente', 'ambos') then
    raise exception 'Audiencia no válida.' using errcode = '22023';
  end if;
  return query
  select distinct x.correo from (
    select p.correo from public.perfiles p
      where p_audiencia in ('director', 'ambos') and p.rol_global = 'director_general'
    union all
    select p.correo from public.perfiles p
      where p_audiencia in ('director', 'ambos') and p.rol_global = 'administrador'
        and not exists (select 1 from public.perfiles d where d.rol_global = 'director_general')
    union all
    select p.correo from public.miembros_proyecto m join public.perfiles p on p.id = m.usuario_id
      where p_audiencia in ('gerente', 'ambos') and m.proyecto_id = p_proyecto and m.rol = 'gerente'
  ) x where x.correo is not null and btrim(x.correo) <> '';
end;
$$;
revoke execute on function public.correos_alerta(uuid, text) from public, anon;
grant execute on function public.correos_alerta(uuid, text) to authenticated;
