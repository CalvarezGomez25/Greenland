# ADR-0007 · Control de cambios formal, con niveles y aprobación por nivel

| Campo | Valor |
| --- | --- |
| Estado | Aceptada y vigente |
| Fecha | 2026-10-08 |
| Quién decidió | Usuario (decisión 7, opción A) y especificación v2.0 |

## Contexto
El libro y la *Metodología de Control de Cambios GL* exigen registro y aprobación formal. Todo cambio puede alterar alcance, costo o plazo.

## Alternativas consideradas
Registro informal; aprobación solo del gerente.

## Decisión
Flujo de 8 fases. Nivel Menor hasta 2 % del valor de referencia; Moderado hasta 5 %; Crítico por encima. Menor lo aprueba el gerente; Moderado y Crítico, el director general de planificación y proyectos. Sobre 5 % se exige firma del patrocinador. Aprobados generan una línea base versionada. Un cambio de cronograma ligado a un contrato es Crítico.

## Consecuencias
El denominador del nivel era controlable por el gerente (riesgo hallado en la auditoría); se mitigó con [ADR-0012](ADR-0012-director-aprueba-contratos-nuevos.md). Los umbrales son parámetros editables por el administrador.

## Evidencia
`0008_cambios.sql`; commit `b3495f8`; supuestos S6, P1, P3.
