# ADR-0012 · El director general aprueba cada contrato nuevo

| Campo | Valor |
| --- | --- |
| Estado | Aceptada y vigente |
| Fecha | 2026-10-10 |
| Quién decidió | Usuario (respuesta del 10 oct 19:36) |

## Contexto
La auditoría encontró que el gerente controlaba el valor del contrato que sirve de denominador del nivel de un cambio.

## Alternativas consideradas
Seguir con aprobación del gerente.

## Decisión
Un contrato nuevo queda pendiente hasta que el director lo revisa. Mientras esté pendiente no admite anticipo ni actas y no sirve de base para un cambio. Un parámetro de prueba permite que el administrador apruebe; viene en «no».

## Consecuencias
Se necesita al menos un usuario Director general para aprobar. Queda abierta la variante de registrar una medición con un BAC inflado antes de aprobar el presupuesto.

## Evidencia
`0018_aprobacion_contratos.sql`; commit `d2e2737`; `docs/AUDITORIA.md`.
