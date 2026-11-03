# ADR-0035 · Aliados, capa 4: novedades de campo y generación de documentos Word

| Campo | Valor |
| --- | --- |
| Estado | **Vigente** (construida con datos ficticios; las plantillas jurídicas las sube el administrador) |
| Fecha | 2026-11-03 |
| Quién decidió | Usuario: «sí, sigue con capas 3 y 4». El diseño es propuesta del asesor |
| Migración | `0029_novedades_plantillas.sql` |

## Decisión
1. **Novedades de campo** (`contrato_novedades`): quien está en obra (supervisor, gerente o interventoría con contrato asignado) registra desde el celular un hecho de un contrato (acta de inicio firmada, póliza, modificación, suspensión, reinicio, comunicación u otro), con fecha, descripción y hasta 3 fotos en un depósito privado (`novedades`). **Una novedad nunca cambia el contrato por sí sola**: la gerencia la revisa y la «aplica» o la descarta (con motivo). Aplicar un acta de inicio fija la fecha del contrato (si aún no la tiene); aplicar una suspensión o un reinicio registra una modificación firmada; las demás se registran a mano y se marcan aplicadas. La interventoría solo ve lo que ella registró. Reemplaza a «RAÍZ en campo» sin una base aparte.
2. **Plantillas de documentos** (`plantillas_documento` y depósito privado `plantillas`): archivos Word con campos de combinación (MERGEFIELD) con los nombres de RAÍZ. **El texto jurídico vive en esos archivos**, no en el código ni en el repositorio: el administrador o el director los suben; Jurídica los revisa. Al subir, la plataforma valida que sea un Word, lee sus campos y limita su tamaño (8 MB).
3. **Generación** (`/proyectos/[id]/contratos/[contratoId]/documento`): se elige una plantilla activa (de contrato o de modificación), se ve qué campos llena PMO360 y cuáles faltan (se pueden escribir en ese momento) y se descarga el `.docx`. Un dato faltante se imprime «[POR COMPLETAR]», nunca vacío. Fechas en letras, valores en pesos y en letras, y los plazos y porcentajes de las cláusulas de la minuta salen de parámetros (`minuta_*`). El motor propio (`src/lib/documentos/combinar.ts`, con `jszip`) reemplaza los campos simples en el cuerpo, los encabezados y los pies, conserva el formato y escapa el contenido.
4. **Dos plantillas incorporadas de ejemplo** (acta de inicio y constancia de modificación) con texto **neutro y la leyenda de que requieren revisión jurídica**, para poder generar documentos sin haber subido las oficiales. No se copió ningún texto de las minutas de la empresa.
5. **Qué no se resuelve** (por completar o a mano): actividades, cotización, forma de pago, modalidad de precio, interventor, fecha de entrega y de la oferta, **cédulas** de los representantes y el texto de las cláusulas de pólizas (`POL_*`), porque PMO360 no los guarda (minimización de datos) o falta definirlos con Jurídica.

## Prácticas aplicadas
- **Separar el contenido jurídico del código:** las plantillas son datos con su propia aprobación; el código solo combina.
- **Revisión humana antes de cambiar datos:** las novedades son propuestas, no hechos.
- **Mínimo privilegio y depósitos privados** con reglas de acceso por proyecto; fotos con ruta verificada (`<proyecto>/<novedad>/<archivo>`).
- **Archivos no confiables:** se limita el tamaño y la cantidad de partes del Word antes de abrirlo; los valores se escapan; el endpoint de descarga solo lee y exige poder gestionar el contrato.
- **No se inventan datos legales:** lo que no existe queda «[POR COMPLETAR]».

## Pendiente
Subir las plantillas oficiales (minuta de obra, oferta mercantil, adición u otrosí, kit F-01 a F-12) cuando Jurídica las apruebe; definir el texto de las cláusulas de pólizas, la modalidad de precio y las actividades; plantilla de otrosí para prestación de servicios (no existe en el paquete); evaluaciones de desempeño (F-10); notificaciones por correo y calendario (integraciones de la fase de operación).

## Evidencia
`supabase/migrations/0029_novedades_plantillas.sql`; `pruebas-sql/t-novedades-plantillas.mjs` (48 comprobaciones); `src/lib/documentos/` (`letras`, `combinar`, `campos`, `incorporadas`, `datos`) con 22 pruebas unitarias; pantallas `/proyectos/[id]/novedades`, `/aliados/plantillas` y «Generar documento» del contrato; documento de ejemplo generado y leído con datos ficticios.
