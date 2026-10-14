# ADR-0010 · Anticipo discrecional del director, con tope de 20 %

| Campo | Valor |
| --- | --- |
| Estado | Aceptada y vigente |
| Fecha | 2026-10-10 |
| Quién decidió | Usuario (sección 14 de la especificación) |

## Contexto
Los anticipos comprometen caja y son una fuente típica de riesgo en contratos de obra.

## Alternativas consideradas
Anticipo automático por umbral.

## Decisión
El anticipo lo autoriza el director general de planificación y proyectos; tope del 20 % del contrato para todos; lo normal es no darlo en contratos menores a 350 millones. La auditoría añadió que, si el valor del contrato baja, el anticipo conserva el porcentaje autorizado y el tope es duro en la tabla.

## Consecuencias
Quien administra la plataforma no autoriza anticipos salvo un parámetro de prueba que está en «no».

## Evidencia
`0011_contratos.sql`, `0017_auditoria.sql`; commit `fda2ead`.
