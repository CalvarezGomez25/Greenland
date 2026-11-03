# ADR-0034 · Aliados, capa 3: procesos de contratación, ofertas con puntaje y comunicaciones con compromisos

| Campo | Valor |
| --- | --- |
| Estado | **Vigente** (construida con datos ficticios; pesos son supuestos de diseño) |
| Fecha | 2026-11-03 |
| Quién decidió | Usuario: «sí, sigue con capas 3 y 4», tras [ADR-0033](ADR-0033-aliados-capa-2-polizas-modificaciones-documentos.md). Los detalles de diseño son propuesta del asesor |
| Migración | `0028_procesos_ofertas_comunicaciones.sql` |

## Decisión
1. **Procesos de contratación** (`procesos`, PR-nn por proyecto): objeto, tipo de servicio, fechas de invitación y cierre, presupuesto de referencia, estado (en preparación, abierta, en evaluación, adjudicada, desierta, cancelada, por confirmar) y enlace a la carpeta. Módulo nuevo en Obra, **oculto a la interventoría** (recomienda, no adjudica).
2. **Ofertas** (`ofertas`, OF-nnn): por proceso, oferente (del maestro de aliados) y ronda; valor, plazo, AIU, anticipo, vigencia, habilitación (sí/no) y cinco calificaciones de 1 a 5. La oferta guarda el **nombre del oferente** al registrarla, para que lo vea quien no ve el maestro. **Los puntajes no se guardan**: se calculan al mostrar (`src/lib/contratos/ofertas.ts`) con pesos de parámetros: precio = 100 × menor valor de la ronda ÷ valor; cualitativo = promedio ponderado de los cinco criterios llevado a 100; total = precio × 40 % + cualitativo × 60 %; una oferta no habilitada no recibe total. Cada ronda se compara por separado.
3. **Adjudicar** (`proceso_adjudicar`): solo un proceso abierto o en evaluación y una oferta recibida o en aclaración, **habilitada** y con valor. Marca la oferta y el proceso (adjudicatario). «Adjudicada» no se escribe a mano. Sin contrato se puede devolver la adjudicación; con contrato, no.
4. **Del proceso al contrato:** desde un proceso adjudicado se abre «Registrar contrato» con el adjudicatario, el objeto, el tipo y el valor de la oferta ganadora; al guardar, el contrato (que sigue pendiente de aprobación del director) queda vinculado al proceso.
5. **Comunicaciones y compromisos** (`contrato_comunicaciones`): por contrato, con canal, asunto, responsable y, si hay compromiso, su fecha y estado. Un compromiso abierto entra al semáforo del contrato: rojo si venció, ámbar si vence en 30 días o menos.
6. **Semáforo del proceso:** abierto sin fecha de cierre o a 7 días o menos = ámbar, cierre vencido = rojo; en evaluación, ámbar pasado el 70 % de los días permitidos (15) y rojo pasados; adjudicado sin contrato y por confirmar = ámbar.

## Diferencias deliberadas frente al libro de RAÍZ
- **Orden en la ronda:** RAÍZ ordena por total y, si falta el cualitativo, compara el precio con su propia escala, lo que puede repetir el primer lugar. Aquí primero van las ofertas con total (de mayor a menor) y después las que solo tienen precio, para que cada una tenga una posición propia (S35).
- **Menor valor de la ronda:** el documento del paquete dice «solo ofertas habilitadas y no descartadas», pero la fórmula del libro solo excluye las descartadas. Se sigue la **fórmula** (es lo que produce los resultados que el equipo ya conoce) y se anota la diferencia (S35).

## Prácticas aplicadas
Datos calculados no se almacenan (evita desfases); pesos y días en parámetros; una sola puerta para cada transición crítica (adjudicar); permisos de menor privilegio y auditoría; enlaces solo http(s); la interventoría no ve lo que no decide.

## Pendiente
Evaluaciones de desempeño (F-10, 0 registros en RAÍZ), importación de los 7 procesos y 27 ofertas (con sus valores pendientes de completar según el paquete), y confirmar los pesos con la dirección.

## Evidencia
`supabase/migrations/0028_procesos_ofertas_comunicaciones.sql`; `pruebas-sql/t-procesos.mjs` (58 comprobaciones); `src/lib/contratos/ofertas.ts` y `.test.ts` (13 con el semáforo del proceso); pantallas `/proyectos/[id]/procesos` y la sección «Comunicaciones y compromisos» del contrato.
