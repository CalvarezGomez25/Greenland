# ADR-0006 · Presupuesto gerencial por capítulos, de un solo nivel

| Campo | Valor |
| --- | --- |
| Estado | Aceptada y vigente |
| Fecha | 2026-10-08 |
| Quién decidió | Usuario (decisiones 1–10 del hito 2) |

## Contexto
El prototipo tenía un presupuesto de obra detallado. La plataforma es gerencial, no de residencia de obra.

## Alternativas consideradas
Presupuesto multinivel con análisis de precios unitarios detallado.

## Decisión
Capítulos de un nivel con partidas; el supervisor lo ve; solo administrador y gerente lo modifican; importación por CSV o a mano; costos adicionales (administración, imprevistos, utilidad, IVA sobre la utilidad, retención en la fuente) como porcentajes del costo directo definidos por proyecto, porque varían según el contratista; cambios al presupuesto con registro y aprobación formal.

## Consecuencias
La plataforma no calcula impuestos (supuesto P2). La interventoría no ve el presupuesto (P9). Un presupuesto real con estructura distinta a la EDT es posible; ver [ADR-0015](ADR-0015-presupuesto-sobre-la-edt.md).

## Evidencia
Commits `1979ae2`, `d0fb72b`, `ffedc7d`, `07d20c0`; `0003_presupuesto.sql`; `ejemplos/` (CSV ficticio correcto y con errores).
