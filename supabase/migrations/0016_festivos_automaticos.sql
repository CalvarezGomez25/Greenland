-- Los festivos de Colombia se calculan solos para cualquier año (fijos, trasladados al lunes y Semana Santa),
-- sin cargarlos a mano. La tabla public.festivos queda solo para fechas excepcionales que el administrador agregue.
create or replace function public.dias_habiles_sumar(p_fecha date, p_n integer)
returns date language plpgsql stable security definer set search_path = ''
as $$
declare f date := p_fecha; n integer := 0;
begin
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
