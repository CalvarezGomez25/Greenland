# ADR-0031 · Control de costos por capítulo (fase 2): cómo se proyecta un capítulo

| Campo | Valor |
| --- | --- |
| Estado | **Vigente** (construida con datos ficticios; a validar con datos reales) |
| Fecha | 2026-10-24 |
| Quién decidió | Usuario: «avanza con las dos tareas» (fase 2 y actualización de materiales), después de que el asesor dejara abierto cómo proyectar un capítulo ([ADR-0030](ADR-0030-control-de-costos-por-cortes.md)). La regla de proyección es propuesta del asesor, a validar |

## Decisión
Para cada capítulo del presupuesto, **a la fecha** (sin historial por corte):
- **Presupuesto** = el del capítulo con su parte de indirectos (como en el balance).
- **Avance físico** = promedio de las tareas del cronograma ligadas al capítulo, ponderado por su peso (avance reportado).
- **Valor ganado (EV)** = presupuesto × avance. **Invertido (AC)** = facturado asignado al capítulo (actas de los contratos aprobados, repartidas por lo asignado).
- **Proyectado (EAC)** = presupuesto × AC / EV (misma fórmula del proyecto); **por invertir** = EAC − AC.
- Se compara el proyectado con el presupuesto y con lo **contratado**: un proyectado por encima de lo contratado avisa que el contrato podría no alcanzar (posible adicional).
- Sin tareas ligadas, sin avance o sin facturado asignado **no hay proyección** (se indica el motivo; no se inventa).

## Supuestos
- **S26:** el «invertido» por capítulo es lo facturado de sus contratos, porque el gasto mensual real (`gasto_mensual`) no se lleva por capítulo; por eso la suma de capítulos no tiene por qué coincidir con el gasto real del proyecto.
- El avance por capítulo exige ligar las tareas del cronograma a capítulos (directo o por la EDT). Un capítulo sin tareas ligadas queda «sin proyección».

## No incluido
Historial por corte de cada capítulo (exigiría guardar una foto por capítulo en cada medición) y dos líneas base (fase 3): sin construir ni decidir.

## Evidencia
`src/lib/presupuesto/proyeccion-capitulos.ts` y `.test.ts` (3 pruebas); sección «Por capítulo, a la fecha» de la pantalla Control de costos; revisión en navegador con datos ficticios.
