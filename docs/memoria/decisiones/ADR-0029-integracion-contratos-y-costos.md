# ADR-0029 · Integración de contratos y costos: costos indirectos (A.I.U.), adicionales de obra y balance

| Campo | Valor |
| --- | --- |
| Estado | **Vigente** (construida y probada con datos ficticios; pendiente de validar con el equipo y con datos reales, P40) |
| Fecha | 2026-10-24 |
| Quién decidió | Usuario: pidió «construye la integración de contratos y costos», que el presupuesto se divida entre costos directos e indirectos (A.I.U.) y que los adicionales sean **otro concepto**: «tareas que no estuvieron contempladas posiblemente en la EDT original o llegaron como añadidura durante la ejecución». Los detalles de diseño (base de comparación, prorrateo, estados) son propuesta del asesor, a validar |
| Migración | `0025_contratos_costos.sql` |

## Contexto
Los contratos (módulo M) no estaban ligados a los capítulos del presupuesto (módulo J), así que no se podía confrontar lo presupuestado con lo contratado ni ver cómo cada contrato afecta la «bolsa» de un capítulo. Además el término «costos adicionales» designaba los porcentajes A.I.U., lo que se confundía con los trabajos adicionales de obra.

## Decisión
1. **Presupuesto = costos directos + costos indirectos.** Los antes llamados «costos adicionales» pasan a llamarse **costos indirectos (A.I.U.)** y cada concepto tiene un tipo: administración, imprevistos, utilidad, impuestos u otro. A.I.U. = administración + imprevistos + utilidad; los impuestos y retenciones se muestran aparte. Los porcentajes los define el proyecto (la plataforma no fija tasas).
2. **Adicionales de obra** son un concepto distinto: trabajos no contemplados en la EDT original (`no_contemplado`) o añadidos durante la ejecución (`anadidura`), con código AD-001, valor directo, opción de aplicar los indirectos, elemento de la EDT opcional y **cambio** que los respalda. Su estado (En trámite / Aprobado / Rechazado) **se deriva del estado del cambio**; no se aprueban por una vía paralela.
3. **Asignación de contratos al presupuesto:** el valor de un contrato se reparte entre capítulos y adicionales (`contrato_asignaciones`). La suma asignada no puede superar el valor del contrato, y el valor del contrato no puede bajar de lo asignado.
4. **Balance de costos** (módulo nuevo en Obra): por capítulo y por adicional, presupuesto directo, presupuesto con indirectos, contratado, por aprobar, facturado, saldo y % contratado; marca lo sobrecontratado y los contratos con valor sin asignar.

## Supuestos de diseño (a validar)
- **Base de comparación «con indirectos»:** el A.I.U. se reparte entre capítulos en proporción a su costo directo, porque el valor de un contrato de obra suele incluir A.I.U.
- **Facturado por línea** = facturado del contrato × (asignado a la línea ÷ valor del contrato).
- Solo los contratos **aprobados** cuentan como contratado; los pendientes se muestran como «por aprobar».
- Los adicionales **no cambian el BAC automáticamente**: el BAC sigue cambiando solo por cambios aprobados (módulo F).
- Se conservan los nombres técnicos `costos_adicionales` y `costo_adicional_*` en la base de datos (historia y compatibilidad); solo cambian los textos de pantalla.
- Importar un presupuesto CSV que retire un capítulo con contratos asignados se bloquea; los capítulos con asignaciones sobreviven a la limpieza de vacíos y se re-ligan por nombre.

## Alternativas descartadas
| Opción | Por qué no |
| --- | --- |
| Un campo «capítulo» en cada contrato | Un contrato suele cubrir varios capítulos; no permite repartir valor |
| Los adicionales como un capítulo más del presupuesto | Mezcla lo original con lo sobrevenido y borra la trazabilidad frente a la línea base |
| Comparar contra el costo directo | Lo contratado incluiría A.I.U. y daría falsos sobrecostos |

## Consecuencias
- Los capítulos con contratos asignados no se pueden borrar sin quitar antes la asignación.
- La interventoría no ve asignaciones, adicionales ni balance (igual que el presupuesto).
- **No incluido (fases siguientes, sin decidir):** evolución corte a corte tipo «Casa Las Mercedes» (invertido / por invertir / proyectado, desviación frente al control anterior), «proyectado» estimado por el gerente y dos líneas base.

## Evidencia
`supabase/migrations/0025_contratos_costos.sql`; `pruebas-sql/t-contratos-costos.mjs` (40 comprobaciones); `src/lib/presupuesto/balance.ts` y `balance.test.ts`; pantallas `presupuesto/adicionales`, `presupuesto/balance` y la sección «Asignación al presupuesto» del contrato.
