# ADR-0011 · Interventoría: rol por contrato, sin presupuesto, sin contratar

| Campo | Valor |
| --- | --- |
| Estado | Aceptada y vigente |
| Fecha | 2026-10-09 |
| Quién decidió | Usuario (especificación v2.0) |

## Contexto
En la normativa colombiana, la interventoría es obligatoria en contratos de obra por licitación pública (Ley 80 de 1993, art. 32; N2). El módulo debía respetar su independencia.

## Alternativas consideradas
Tratar a la interventoría como un miembro más del proyecto.

## Decisión
Rol Interventoría con acceso por contrato: conceptúa y verifica, no aprueba; no contrata ni adjudica; recomienda según evaluaciones de proveedores y contratistas; no contrata diseños; asesora con estudios de mercado; **no ve el presupuesto**. Hallazgos con plazos en días hábiles colombianos y escalamiento.

## Consecuencias
La asignación de interventoría solo la cambia el administrador o el director general (auditoría). El texto de la Ley 1474 no se leyó; el art. 84 no se pudo verificar.

## Evidencia
`0014_interventoria.sql`; commit `f437299`; `pruebas-sql/t-h11.mjs` (96 comprobaciones).
