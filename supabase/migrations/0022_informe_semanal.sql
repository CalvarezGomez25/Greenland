-- 0022: informe gerencial semanal por correo (lunes 7:30 a. m., hora de Colombia).
insert into public.parametros (ambito, clave, valor, descripcion, fuente) values
 ('global', 'informe_semanal_activo', 'si',
  'Si es "no", la plataforma no envía el informe gerencial semanal por correo', 'Decisión del usuario')
on conflict do nothing;
