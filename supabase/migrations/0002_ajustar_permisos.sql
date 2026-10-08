-- =============================================================================
-- Hito 1 (ajuste): dejar a los usuarios con sesión solo los permisos necesarios
-- Ejecutar UNA sola vez en Supabase > SQL Editor, después de 0001.
--
-- Por qué: Supabase entrega por defecto TODOS los permisos de tabla al rol
-- "authenticated" (incluidos TRUNCATE, TRIGGER y REFERENCES). La migración 0001
-- retiró los de "anon" pero no los sobrantes de "authenticated". Las reglas por
-- filas ya impedían leer o escribir lo no permitido, pero TRUNCATE no pasa por
-- esas reglas, así que se retira todo y se concede solo lo estrictamente usado.
-- =============================================================================

revoke all on public.perfiles          from authenticated;
revoke all on public.proyectos         from authenticated;
revoke all on public.miembros_proyecto from authenticated;

-- perfiles: leer y editar (las filas permitidas las decide la seguridad por filas)
grant select, update                 on public.perfiles          to authenticated;

-- proyectos: leer, crear y editar (no se borra desde la aplicación)
grant select, insert, update         on public.proyectos         to authenticated;

-- miembros_proyecto: leer, asignar, cambiar rol y quitar miembros
grant select, insert, update, delete on public.miembros_proyecto to authenticated;
