# ADR-0033 · Aliados, capa 2: pólizas, modificaciones contractuales y documentos del tercero

| Campo | Valor |
| --- | --- |
| Estado | **Vigente** (construida con datos ficticios; sin datos reales) |
| Fecha | 2026-11-03 |
| Quién decidió | Usuario: «sí, sigue con la capa 2», tras la capa 1 ([ADR-0032](ADR-0032-aliados-y-proveedores-capa-1.md)). La regla de cómo conviven las modificaciones y los cambios es propuesta del asesor, a validar |
| Migración | `0027_polizas_modificaciones_documentos.sql` |

## Decisión
1. **Pólizas** (`contrato_polizas`): una por contrato y amparo, con aseguradora, número, valor asegurado, expedición, vencimiento, estado (activa o cumplida) y enlace al soporte. Los seis amparos (cumplimiento, buen manejo del anticipo, salarios y prestaciones, calidad, estabilidad y responsabilidad civil) y su porcentaje y base salen de la tabla `poliza_amparos`, tomada de la minuta de El Silencio GL (marcada «Verificado» en el paquete). **Mínimo exigido = porcentaje × base** (valor del contrato o del anticipo). Guardar el mismo amparo corrige la póliza.
2. **Modificaciones** (`contrato_modificaciones`): adición, otrosí, prórroga, suspensión, reinicio y cesión, con número consecutivo por tipo, estado **en trámite o firmada**, fecha de firma, nueva fecha fin, valor informativo, descripción y, opcionalmente, el cambio que las originó. **Solo las firmadas** mueven la **fecha fin vigente** (la mayor entre la inicial y las nuevas fechas fin firmadas) y la **suspensión** (más suspensiones firmadas que reinicios; desde la fecha de la última). Una firmada solo la borra el administrador; el tipo no cambia al editar.
3. **Una sola vía para el valor.** El valor vigente del contrato (`contratos.valor`) sigue cambiando únicamente por un **cambio aprobado ligado al contrato** o por el director, como hasta hoy. Una modificación **no suma valor por sí sola**: documenta el instrumento y su firma, y se liga al cambio que lo originó. Así no hay dos formas de cambiar el valor ni riesgo de contarlo dos veces.
4. **Documentos del tercero** (`tercero_documentos`): enlaces con fecha de expedición por tipo de documento; el vencimiento es expedición + la vigencia del tipo (`documento_tipos`: RUT sin vencimiento «Verificado»; los demás son «Supuesto de diseño» de RAÍZ). Cuenta el más reciente de cada tipo. No se guardan archivos ni cédulas.
5. **Semáforo del contrato ampliado:** rojo si hay suspensión de más de 30 días (parámetro `suspension_max_dias`), póliza vencida o por debajo del mínimo, o documento del contratista vencido; ámbar si el contrato está suspendido, una póliza vence en 30 días o menos o le falta un dato, el contratista no tiene documentos o alguno vence pronto. Mientras un contrato está suspendido, el plazo no alerta. Las pólizas se vigilan en las etapas 5 a 8 y los documentos en las etapas 1 a 8. Quien ve un contrato ve su semáforo completo aunque no vea el maestro de documentos: la base le entrega solo las fechas de vencimiento (sin enlaces).

## Prácticas aplicadas
- Configuración en tablas y parámetros (amparos, tipos de documento, días), no en el código; cada dato de configuración declara su fuente y si es «Verificado» o «Supuesto».
- Un solo camino para cada cambio de dato crítico (valor por cambio aprobado; fechas por modificación firmada).
- Lo no firmado no mueve fechas; todo cambio queda en la auditoría.
- Mínimo privilegio: escribe quien gestiona el contrato (gerente o administrador); leen las mismas personas que ven el contrato; documentos del tercero los edita quien edita el maestro. Los enlaces solo aceptan http o https.
- Sin duplicar lo que PMO360 ya tiene: los pagos siguen siendo actas de pago.

## Pendiente
Compromisos de las comunicaciones (vigilados por RAÍZ), procesos y ofertas (capa 3) y minutas y campo (capa 4). Decidir con Jurídica la lista de amparos exigibles por tipo de contrato (hoy no se avisa si falta una póliza) y confirmar los supuestos de vigencia de documentos. Al cargar los datos reales, las 29 modificaciones del paquete entrarían como instrumentos sin cambio ligado, con el valor vigente del contrato cargado tal cual lo trae RAÍZ.

## Evidencia
`supabase/migrations/0027_polizas_modificaciones_documentos.sql`; `pruebas-sql/t-polizas-modificaciones.mjs` (52 comprobaciones); `src/lib/contratos/vigilancia.ts` (+ 11 pruebas nuevas) y `datos-vigilancia.ts`; secciones «Pólizas» y «Modificaciones del contrato» del contrato y «Documentos del tercero» del maestro.
