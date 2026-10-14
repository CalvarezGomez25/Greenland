# ADR-0017 · Correos automáticos por tareas programadas con un usuario de solo lectura

| Campo | Valor |
| --- | --- |
| Estado | Aceptada y vigente |
| Fecha | 2026-10-10 |
| Quién decidió | Usuario pidió las alertas; diseño de Claude |

## Contexto
Cuando una decisión queda pendiente, el responsable debe enterarse. El resumen diario necesita leer varios proyectos sin usar la clave de alto privilegio.

## Alternativas consideradas
Usar la clave `service_role` de Supabase (rechazado por riesgo).

## Decisión
Avisos inmediatos (cambio a «En aprobación», contrato por aprobar, reporte con decisiones) y resumen diario a las 7:00 a. m. de Bogotá. Las tareas programadas de Vercel se autentican con `CRON_SECRET` y leen con un usuario Analista PMO de solo lectura. Proveedor: Gmail con contraseña de aplicación o Resend. Se apagan con el parámetro `alertas_correo_activas`.

## Consecuencias
Vercel Hobby admite 2 tareas programadas, no garantiza el minuto exacto y limita cada ejecución a 60 s. **Estado al 14 oct: construido y probado en copia local; ningún correo se ha enviado en producción.**

## Evidencia
`0019_alertas_correo.sql`; commit `1ecb136`; `pruebas-sql/t-alertas.mjs` (12 comprobaciones); README «Alertas por correo».
