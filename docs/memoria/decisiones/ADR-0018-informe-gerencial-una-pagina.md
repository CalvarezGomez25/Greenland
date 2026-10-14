# ADR-0018 · Informe gerencial de una página, por proyecto y semanal

| Campo | Valor |
| --- | --- |
| Estado | Aceptada y vigente |
| Fecha | 2026-10-11 |
| Quién decidió | Usuario |

## Contexto
El usuario necesita informes distribuibles por correo a los interesados, con el sistema de diseño de GreenLand.

## Alternativas consideradas
Informes largos; envío manual.

## Decisión
PDF y Excel de una sola hoja por proyecto (semáforo, indicadores, lectura rápida, riesgos principales, decisiones, hitos, cambios, último reporte). Envío automático los lunes a las 7:30 a. m. de Colombia (`30 12 * * 1` UTC) a las personas con correo: administrador, director, analista y finanzas reciben todos los proyectos; las demás, los suyos. La interventoría no lo recibe. Con más de 6 proyectos solo se adjunta PDF. Parámetro de apagado `informe_semanal_activo`.

## Consecuencias
Vercel Hobby no garantiza la hora exacta. Sin envío real todavía. Las fuentes (Baloo 2, Roboto) van incrustadas en el código.

## Evidencia
`0022_informe_semanal.sql`; commit `db2ac62`; 12 pruebas unitarias; `src/lib/informe/`.
