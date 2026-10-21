# ADR-0025 · Exportaciones a PDF y Excel con la identidad de la marca

| Campo | Valor |
| --- | --- |
| Estado | Aceptada y vigente |
| Fecha | 2026-10-17 |
| Quién decidió | Usuario (petición del 17 de octubre, con una captura del PDF del tablero): el PDF era «muy plano, poco atractivo»; pidió el aspecto del informe gerencial y, en Excel, el sistema de diseño con logos |

## Contexto
Los PDF y Excel de tablas (tablero, reporte semanal, valor ganado, cambios, contratos) salían de un generador común sin identidad: tipografía estándar, cabecera verde lisa y sin logo.

## Alternativas consideradas
- **Hacer solo el PDF del tablero con un diseño aparte:** deja los demás archivos planos. Descartada.
- **Mejorar el generador común** (elegida): todos los archivos de tablas ganan la identidad.
- **Paleta del Excel:** el estándar de hojas de cálculo de Greenland propone azul, gris y naranja; el usuario pidió expresamente el sistema de diseño de PMO360 (verde). Se siguió el pedido y del estándar se aplicó lo que no choca (sin cuadrícula, paneles fijos, zoom, impresión horizontal, formato de pesos, «S/I»).

## Decisión
PDF con logo, Baloo 2 y Roboto, paleta verde, encabezado en cada hoja, pie con «Página X de Y», filas alternadas y etiquetas de color para el semáforo, el nivel de riesgo y Sí / No; el tablero suma tarjetas de indicadores. Excel con logo, encabezado de marca, encabezados verdes, filas alternadas, etiquetas de color, impresión horizontal ajustada al ancho y fila de títulos repetida. El informe gerencial de una página no cambia.

## Consecuencias
- El PDF del tablero conserva la hoja horizontal (el semáforo tiene 14 columnas).
- En Excel, los datos sin información dicen «S/I»; en PDF, «—».
- Las tarjetas solo van en el PDF; en Excel las cifras están en la hoja «Resumen del portafolio».
- Verificado en imagen (PDF y Excel convertido con LibreOffice), no abierto en Excel.

## Evidencia
`src/lib/exportar/` (`pdf.ts`, `excel.ts`, `tonos.ts`, `dashboard.ts`, `tipos.ts`) y `exportar.test.ts`; commit `72dc45c`; `ESPECIFICACION.md` hito 25.
