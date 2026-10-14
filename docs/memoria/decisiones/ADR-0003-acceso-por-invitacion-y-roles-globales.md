# ADR-0003 · Acceso por correo y contraseña, solo por invitación; Administrador y Director globales

| Campo | Valor |
| --- | --- |
| Estado | Aceptada y vigente |
| Fecha | 2026-10-08 |
| Quién decidió | Usuario (respuestas 4, 5, 6 y confirmación de 7 y 8) |

## Contexto
La información es confidencial. El Director general «ve todos los proyectos»; los demás roles dependen del proyecto.

## Alternativas consideradas
Enlace por correo sin contraseña; cuenta de Google; registro abierto.

## Decisión
Ingreso con correo y contraseña propios. Los usuarios entran por invitación. Administrador y Director general son roles globales; los demás son por proyecto y una persona puede tener roles distintos en proyectos distintos.

## Consecuencias
Las invitaciones se hacen desde el panel de Supabase; hubo que desactivar el registro abierto. La versión 2.0 amplió los roles (finanzas, analista PMO, interventoría, entre otros; sección 8 de la especificación). Recuperar una contraseña obliga a usar el correo de Supabase.

## Evidencia
Migración `0001_cimientos.sql`; commit `c42cb0d`.
