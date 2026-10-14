# ADR-0016 · Escala de riesgos e importación desde Excel

| Campo | Valor |
| --- | --- |
| Estado | Aceptada y vigente |
| Fecha | 2026-10-11 |
| Quién decidió | Claude propuso a partir del Excel del usuario; el usuario revisó |

## Contexto
El registro de riesgos de la Planta El Silencio (41 riesgos por frente) usa Baja/Media/Alta; la plataforma usa 1–5.

## Alternativas consideradas
Cambiar la escala de la plataforma a 3×3.

## Decisión
Baja/Media/Alta se convierten a 1/2/4. Con los cortes Crítico ≥ 15, Alto ≥ 8, Medio ≥ 4 se reproduce exactamente la matriz 3×3 del Excel. Se amplía el registro (frente, causa, consecuencia, momento de control, fecha objetivo, referencia). Importación con vista previa, máximo 500 filas, todo o nada; reimportar actualiza por código y no borra. La estrategia de respuesta no se inventa si el Excel no la trae.

## Consecuencias
La conversión es una decisión de calibración que se puede revisar en el taller de validación. Los riesgos ahora entran a la auditoría.

## Evidencia
`0021_riesgos_ampliado.sql`; commit `5cd9187`; `pruebas-sql/t-riesgos-importar.mjs` (17) y 7 pruebas unitarias; `docs/SUPUESTOS.md`.
