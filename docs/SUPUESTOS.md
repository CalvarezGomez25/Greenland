# Supuestos y decisiones adoptadas

Resumen de cómo la v1 resuelve los puntos abiertos de `ESPECIFICACION.md` §14. Todo es parametrizable o
fácil de cambiar; deben validarse con el uso real.

## Decisiones confirmadas por el usuario (implementadas)
- Supervisor ve el presupuesto; solo Administrador y Gerente lo modifican.
- El gerente de cada proyecto puede editar los datos de su obra.
- Datos ficticios hasta decidir región y confidencialidad.
- Anticipo: autorizado por el director general, tope 20 %. Cambios: menor → gerente; moderado/crítico → director.
- Riesgos: Rojo solo con un riesgo Crítico.

## Supuestos aplicados
| ID | Cómo quedó |
| --- | --- |
| S1 | Semáforo = peor de SPI, CPI, riesgos y cambios |
| S4 | AC sale del gasto mensual registrado (aún no de las actas de pago) |
| S5 | El portafolio suma antes de dividir |
| S6 | Menor hasta 2 %, moderado hasta 5 %, crítico por encima; comparaciones exactas; cambio de cronograma ligado a contrato = Crítico |
| S8 | Amortización = mín(pendiente, bruto × %); retención con porcentaje vigente al crear el contrato |
| S10–S11 | Interventoría conceptúa y verifica; no aprueba. Con avance verificado, el EV lo usa |
| S12 | Plazos de hallazgos en días hábiles colombianos (Ley 51/1983, Pascua calculada) con escalamiento al consultar; parametrizables |
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
