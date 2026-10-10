-- Escalamiento de hallazgos vencidos en todos los proyectos que el usuario ve (se usa al abrir el dashboard).
create function public.hallazgos_escalar_todos()
returns integer language plpgsql security definer set search_path = ''
as $$
declare n integer;
begin
  if auth.uid() is null then return 0; end if;
  update public.hallazgos set estado = 'escalado', escalado_en = now()
    where estado = 'abierto' and plazo_respuesta < public.hoy_co()
      and (public.puede_ver_proyecto(proyecto_id) or public.es_interventor(proyecto_id));
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.hallazgos_escalar_todos() from public, anon;
grant execute on function public.hallazgos_escalar_todos() to authenticated;
