# Archivos de ejemplo (datos ficticios)

Sirven para probar la importación de presupuesto. Formato: UTF-8, separador `;`,
números con formato colombiano (punto de miles, coma decimal), fila de encabezado.

| Archivo | Qué prueba | Resultado esperado |
| --- | --- | --- |
| `presupuesto-ejemplo.csv` | Importación correcta | 10 partidas en 5 capítulos; costo directo total **1.231.970.000** |
| `presupuesto-con-errores.csv` | Validaciones | 2 filas válidas y 6 rechazadas, cada una con su motivo (capítulo vacío, cantidad no numérica, precio negativo, columnas incompletas, código repetido, unidad vacía) |

Las filas del primer archivo no están agrupadas por capítulo a propósito (Acabados aparece
antes y después de Instalaciones): la plataforma debe agruparlas por capítulo.
