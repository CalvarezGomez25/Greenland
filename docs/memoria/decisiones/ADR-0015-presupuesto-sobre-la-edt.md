# ADR-0015 · El presupuesto puede construirse sobre la EDT, como vínculo opcional

| Campo | Valor |
| --- | --- |
| Estado | Aceptada y vigente |
| Fecha | 2026-10-11 |
| Quién decidió | Usuario («aplica ambas cosas», «sigo tus recomendaciones») |

## Contexto
El usuario preguntó si conviene crear el presupuesto desde los elementos de la EDT. Hoy son estructuras independientes y el presupuesto es de un solo nivel ([ADR-0006](ADR-0006-presupuesto-gerencial-por-capitulos.md)).

## Alternativas consideradas
Hacerlo obligatorio: se rechazó porque los presupuestos reales llegan con otra estructura (capítulos de obra frente a entregables de gestión), choca con el único nivel, el presupuesto suele existir antes que la EDT y mover un elemento ya presupuestado altera la línea base.

## Decisión
Vínculo opcional capítulo–elemento de la EDT. Botón «Crear capítulos desde la EDT» (eligiendo el nivel; propuesta: los hijos de la raíz). Los capítulos ligados no se borran aunque estén vacíos. La EDT muestra el costo directo sumado hacia arriba. Las tareas heredan el capítulo del elemento.

## Consecuencias
La interventoría no ve la columna de costo. Presupuestar con capítulos propios sigue funcionando.

## Evidencia
`0020_presupuesto_desde_edt.sql`; commit `ddd7eeb`; `pruebas-sql/t-edt-presupuesto.mjs` (21 comprobaciones).
