# ADR-0020 · Tablero del proyecto: gráfico de avance y resumen de control

| Campo | Valor |
| --- | --- |
| Estado | Aceptada y vigente |
| Fecha | 2026-10-12 |
| Quién decidió | Usuario (tres peticiones consecutivas) |

## Contexto
La página del proyecto repetía información y desaprovechaba el ancho en pantalla grande.

## Alternativas consideradas
Mantener la tarjeta «Avance físico / financiero» junto al gráfico (redundante).

## Decisión
Gráfico «Avance del proyecto: lo planeado frente a lo construido» (aro exterior = físico, marca = planificado, aro interior = financiero). Resumen de control en rejilla: estado, SPI, CPI; BAC, AC y EAC con ahorro o sobrecosto previsto; riesgos activos; cambios pendientes; decisiones pendientes. Ficha compacta (cliente, ubicación, inicio y duración) bajo el nombre del proyecto. En celular se apila. En el tablero de control del portafolio los proyectos se ordenan por código (GL-001, GL-002…).

## Consecuencias
La tarjeta de avance se retiró. Cada tarjeta es un enlace a su módulo.

## Evidencia
Commits `b2da7d3`, `34baca8`, `3689e5b`; `ESPECIFICACION.md` §3.
