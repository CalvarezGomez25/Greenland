# ADR-0005 · Solo datos ficticios hasta decidir región y confidencialidad

| Campo | Valor |
| --- | --- |
| Estado | Aceptada y vigente |
| Fecha | 2026-10-08 |
| Quién decidió | Usuario (decisión 12) |

## Contexto
No se había decidido dónde deben residir los datos ni qué tan confidenciales son los presupuestos y contratos.

## Alternativas consideradas
Cargar datos reales desde el inicio.

## Decisión
Se trabaja solo con datos ficticios. Para pruebas se eligió la región São Paulo (la más cercana a Colombia entre las disponibles). Antes de datos reales: resolver región y confidencialidad, plan de alojamiento apto para uso comercial y revisión de seguridad.

## Consecuencias
El piloto de 90 días no puede empezar con datos reales hasta cerrar los pendientes P12–P14. Cambiar de región implica crear otro proyecto de Supabase y migrar.

## Evidencia
`ESPECIFICACION.md` §14 (P12–P14).
