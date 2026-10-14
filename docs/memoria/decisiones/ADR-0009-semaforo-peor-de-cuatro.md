# ADR-0009 · El semáforo del proyecto es el peor de cuatro dimensiones

| Campo | Valor |
| --- | --- |
| Estado | Aceptada y vigente |
| Fecha | 2026-10-10 |
| Quién decidió | Supuesto S1 aceptado; regla de riesgos por el usuario |

## Contexto
El prototipo calculaba el semáforo con SPI y CPI. Riesgos y cambios también deben pesar.

## Alternativas consideradas
Promedio ponderado.

## Decisión
Estado = el peor de SPI, CPI, riesgos y cambios. Por riesgos solo pasa a Rojo cuando hay un riesgo Crítico (decisión del usuario). Sin datos se muestra «Sin datos», no verde. Hallazgos de interventoría y avance verificado no cambian el semáforo (S13).

## Consecuencias
Un solo problema grave basta para poner Rojo (gestión por excepción). Los umbrales numéricos son parámetros (sección 9 de la especificación).

## Evidencia
Hitos 2 y 3; commits `4da682c`, `8463ff2`; supuestos S1, S13.
