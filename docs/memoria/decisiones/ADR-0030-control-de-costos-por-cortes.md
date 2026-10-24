# ADR-0030 · Control de costos por cortes (fase 1) y aceptación de los supuestos de la integración de contratos y costos

| Campo | Valor |
| --- | --- |
| Estado | **Vigente** (fase 1 construida con datos ficticios; fases 2 y 3 sin construir) |
| Fecha | 2026-10-24 |
| Quién decidió | Usuario: pidió construir la fase 1 del gráfico de control de costos «tipo la casa» con las sugerencias del asesor, **hacer el supuesto de diseño P40** (se aceptan S21 a S24 de [ADR-0029](ADR-0029-integracion-contratos-y-costos.md)), y dijo que **«al gerente le basta con el EAC calculado»** y que se ligaran contratos con capítulos «habilitando fase 2» |

## Contexto
El director quiere ver los indicadores corte a corte, como en el tablero de control de costos de Casa Las Mercedes: por corte, lo invertido, lo que falta por invertir y lo proyectado, y su desviación frente al control anterior y frente a la línea base. Solo se tomó el **concepto**; no se copió ningún dato real de esa casa.

## Decisión
1. **Cada medición de valor ganado es un corte** (`mediciones_evm`, tanto las calculadas como las manuales). No hay tabla nueva ni migración.
2. Por corte se muestra: **invertido** = AC; **proyectado** = EAC calculado (BAC × AC / EV); **por invertir** = proyectado − invertido (nunca negativo); **invertido en el periodo** = AC − AC del corte anterior; **variación frente al corte anterior** = EAC − EAC anterior; **variación frente a la línea base** = EAC − BAC; **cambio de la línea base** entre cortes (viene de cambios aprobados) y CPI.
3. **El «proyectado» es siempre el EAC calculado** (S25): el gerente no escribe una estimación propia. Sin avance o sin gasto no hay proyección y se muestra «sin proyección» (no se inventa un número).
4. Pantalla nueva «Control de costos» (módulo de Obra, oculto a interventoría): cuatro indicadores del último corte, gráfico de barras corte a corte (invertido + por invertir hasta lo proyectado, con la línea base) y tabla de detalle con las variaciones; en rojo lo que se encarece.
5. **Se aceptan los supuestos S21 a S24** de ADR-0029 (P40, puntos 1 y 3 resueltos).

## Fase 2 (habilitada, sin construir)
El reparto de cada contrato entre capítulos y adicionales (migración 0025) permite el mismo control **por capítulo**: invertido (facturado asignado), contratado y proyectado por capítulo. Falta decidir cómo proyectar un capítulo (EAC por capítulo exige avance físico por capítulo, que hoy se lleva por tarea del cronograma y solo se liga a capítulos vía la EDT). Fase 3 (dos líneas base: interna y contractual) sigue sin decidir.

## Alternativas descartadas
| Opción | Por qué no |
| --- | --- |
| «Proyectado» escrito por el gerente | El usuario dijo que basta con el EAC calculado; evita cifras sin sustento |
| Tabla de cortes propia | Duplicaría las mediciones de valor ganado, que ya se calculan solas en proyectos con obra |

## Evidencia
`src/lib/pmo/cortes.ts` y `cortes.test.ts` (5 pruebas); `src/components/grafico-cortes.tsx`; `src/app/(app)/proyectos/[id]/control-costos/page.tsx`; revisión en navegador con datos ficticios (4 cortes de «Bodega norte»).
