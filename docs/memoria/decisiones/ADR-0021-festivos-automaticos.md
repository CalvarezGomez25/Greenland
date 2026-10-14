# ADR-0021 · Festivos de Colombia calculados automáticamente

| Campo | Valor |
| --- | --- |
| Estado | Aceptada y vigente |
| Fecha | 2026-10-10 |
| Quién decidió | Usuario |

## Contexto
Los plazos en días hábiles de los hallazgos de interventoría requieren el calendario de festivos. Cargarlos a mano cada año es una carga innecesaria.

## Alternativas consideradas
Tabla de festivos a mano en el menú.

## Decisión
Los festivos se calculan solos para cualquier año según la Ley 51 de 1983, con la Pascua calculada (supuesto S12). La tabla `festivos` guarda solo fechas excepcionales. Se retiró del menú lateral.

## Consecuencias
El texto de la ley no se leyó; el cálculo debe validarse contra el calendario oficial cada año.

## Evidencia
`0016_festivos_automaticos.sql`; commit `3dc98d8`; supuesto S12.
