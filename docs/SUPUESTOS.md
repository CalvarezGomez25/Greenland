# Supuestos y decisiones adoptadas

Resumen de cómo la v1 resuelve los puntos abiertos de `ESPECIFICACION.md` §14. Todo es parametrizable o
fácil de cambiar; deben validarse con el uso real.

## Decisiones confirmadas por el usuario (implementadas)
- Supervisor ve el presupuesto; solo Administrador y Gerente lo modifican.
- El gerente de cada proyecto puede editar los datos de su obra.
- Datos ficticios hasta decidir región y confidencialidad.
- Anticipo: autorizado por el director general, tope 20 %. Cambios: menor → gerente; moderado/crítico → director.
- Riesgos: Rojo solo con un riesgo Crítico.
- Nueva contratación: el director general revisa y aprueba cada contrato nuevo (parámetro `contrato_admin_puede_aprobar`, «no» por defecto, solo para pruebas).
- Asignaciones de interventoría ya creadas: solo las cambian o quitan el administrador o el director general.
- El registro de cambios del presupuesto lo ven también finanzas y analista PMO.

## Supuestos aplicados
| ID | Cómo quedó |
| --- | --- |
| S1 | Semáforo = peor de SPI, CPI, riesgos y cambios |
| S4 | AC sale del gasto mensual registrado (aún no de las actas de pago) |
| S5 | El portafolio suma antes de dividir |
| S6 | Menor hasta 2 %, moderado hasta 5 %, crítico por encima; comparaciones exactas; cambio de cronograma ligado a contrato = Crítico |
| S8 | Amortización = mín(pendiente, bruto × %); retención con porcentaje vigente al crear el contrato |
| S10–S11 | Interventoría conceptúa y verifica; no aprueba. Con avance verificado, el EV lo usa |
| S12 | Plazos de hallazgos en días hábiles colombianos con escalamiento al consultar; los festivos se calculan solos para cualquier año (Ley 51/1983, Pascua calculada), sin cargarlos a mano; la tabla `festivos` solo guarda fechas excepcionales |
| S13 | Hallazgos y avance verificado no cambian el semáforo |
| D2 | La estrategia de stakeholders sigue la leyenda del libro (por producto) |
| P1 | Firma del patrocinador para cambios de más del 5 % |
| P2 | No se calculan impuestos |
| P3 | Marca «detectado sin formato» en cambios |
| P4 | Semana ISO |
| P9 | El presupuesto no se expone a la interventoría |

## Reglas de datos
- Inmutables: conceptos de interventoría, bitácora (el avance se suma con tope de 100 % y no se revierte), reportes enviados, informes firmados, versiones de documentos.
- Pendientes sin implementar: flujo de caja, reajustes por IPC y pólizas (P7); P5, P6, P8, P10 y P11 requieren validación del usuario.
- Parámetros `cambio_admin_puede_aprobar` y `anticipo_admin_puede_autorizar` en «no» por defecto (cámbialos a «si» solo para pruebas).

## Límites conocidos
- Validado con PostgreSQL real (PGlite) y un simulador de la API; falta la primera corrida contra el Supabase real.
- Vercel Hobby es de uso no comercial.
- `npm audit`: 5 avisos altos en herramientas de desarrollo.

## Registro de riesgos ampliado e importación desde Excel (migración 0021)
- Los riesgos suman: frente, causa, consecuencia, momento de control, fecha objetivo y referencia. Se importan desde un .xlsx (hoja «Registro») en `/proyectos/[id]/importar-riesgos`.
- Escala: Baja/Media/Alta del Excel = 1/2/4 en la escala 1–5. Con los cortes de la plataforma (Crítico ≥ 15, Alto ≥ 8, Medio ≥ 4) reproduce exactamente la matriz 3×3 del Excel. Es una decisión de conversión; se puede recalibrar en la validación en taller.
- El Excel no trae estrategia de respuesta: queda vacía (no se inventa). Si no hay nombre de responsable, se guarda el rol propuesto.
- Reimportar actualiza por ID (no duplica) y no borra nada. Los riesgos ahora quedan en la auditoría (antes no lo estaban).
