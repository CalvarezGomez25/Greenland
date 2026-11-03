# ADR-0032 · Aliados y proveedores (capa 1): maestro de terceros, contratantes y datos contractuales

| Campo | Valor |
| --- | --- |
| Estado | **Vigente** (capa 1 construida con datos ficticios; capas 2 a 4 sin construir) |
| Fecha | 2026-11-03 |
| Quién decidió | Usuario: compartió el paquete «Módulo de aliados, proveedores y contratos» (RAÍZ v0.9.5) y confirmó empezar por la capa 1 con datos ficticios, **mantener la regla de anticipo de PMO360**, que **el maestro lo vea todo el portafolio** y **no hacer grandes cambios** («usar la estructura de RAÍZ para complementar y robustecer PMO360»). Las prácticas de diseño de abajo son propuesta del asesor |
| Migración | `0026_aliados_contratos.sql` |

## Contexto
RAÍZ es un libro de Excel con 14 entidades que PMO360 solo cubría en parte: los contratos guardaban el contratista como texto libre, sin NIT, etapa, fechas ni semáforo. El paquete propone un módulo grande (terceros, contratos, modificaciones, pólizas, procesos, documentos Word, campo, integraciones). Se evaluó (3 nov 2026) mostrar solo el tablero frente a ampliar por capas, y se eligió **ampliar por capas**, porque el semáforo de RAÍZ depende de datos que PMO360 no tenía.

## Decisión (capa 1)
1. **Maestro de terceros** con NIT o cédula como llave única. El NIT se normaliza (sin puntos ni espacios) y, si trae dígito de verificación, se valida con el módulo 11 de la DIAN (probado contra 17 NIT reales del paquete, 0 diferencias). Un identificador temporal `PEND-NOMBRE` se reemplaza por el NIT real cuando llega el RUT; los contratos apuntan al `id` interno y no se rompen. Un tercero **no se borra**: se marca inactivo.
2. **Contratantes** (sociedades del grupo) con código CT-nn automático y tope de contratación sin asamblea propio o general; cada proyecto tiene un contratante.
3. **En cada contrato:** tercero, consecutivo, orden de servicio SAP, **etapa (1 a 9)**, fecha de firma, acta de inicio, plazo (días calendario, hábiles o meses) con **fecha fin inicial calculada** (los hábiles usan los festivos de la plataforma) y autorización de asamblea. La etapa avanza de una en una; devolverse exige motivo y queda en un historial; archivar solo desde la etapa 8; un contrato sin aprobar del director no pasa de la etapa 3.
4. **Semáforo por contrato** (Verde, Ámbar, Rojo, con la palabra y no solo el color), en la lista de contratos del proyecto (ordenada por urgencia) y en el detalle. Vigila: etapa vencida (rojo), plazo vencido en ejecución (rojo), plazo por vencer en 30 días (ámbar), falta el dato para calcular el fin (ámbar) y supera el tope sin autorización de asamblea (ámbar).
5. **Visibilidad:** ve el maestro todo el portafolio (administrador, director general, analista PMO, finanzas) y los gerentes de proyecto; edita terceros el administrador, el director y los gerentes; edita contratantes el administrador y el director. En cada proyecto solo se ven sus contratos.

## Prácticas aplicadas (y por qué)
- **Una sola fuente de verdad, sin duplicar:** el tercero se escribe una vez; el contrato solo apunta a él y toma su nombre. Lo que RAÍZ llama «pagos» ya lo cubren las actas de pago de PMO360 (no se duplica).
- **Llave natural validada + llave interna estable:** el NIT es único y se valida; las referencias usan el `id`, así un `PEND-` que se corrige no rompe nada.
- **Sin borrado físico en datos maestros:** inactivar conserva la historia y la auditoría.
- **Mínimo de datos personales:** solo el nombre del representante legal; **no** se guardan cédulas ni documentos (solo un enlace al soporte). Las cédulas de representantes se evaluarán en la capa de documentos, cuando se necesiten para las minutas y se resuelva la base legal (P33).
- **Parámetros y no valores fijos:** SMMLV, tope de 600 SMMLV, 30 días de alerta y los días máximos por etapa viven en `parametros` y se editan en la pantalla de Parámetros. Los marcados «Supuesto de diseño» siguen como supuestos.
- **Un solo semáforo por contrato, con alcance declarado:** en la pantalla se dice qué vigila hoy y qué vigilará después (pólizas, documentos del contratista, compromisos y suspensiones). No se cambia el semáforo del proyecto hasta validar este.
- **Permisos de menor privilegio y registro de cambios:** las tablas nuevas tienen reglas de acceso y auditoría; cada cambio de etapa queda con quién y cuándo.

## Lo que se mantiene sin cambios
Anticipo (decisión discrecional del director, máximo 20 %; **se conserva la regla de PMO360**, no la de «solo obra mayor de $350 millones» del paquete), retención de garantía, aprobación del contrato por el director, actas de pago, asignación al presupuesto y control de cambios.

## Alternativas descartadas
| Opción | Por qué no |
| --- | --- |
| Mostrar solo el tablero de RAÍZ en PMO360 | Obliga a duplicar la lógica y seguir capturando en Excel; sin las fechas y etapas el semáforo sería casi todo ámbar (solo 3 de 27 contratos tienen acta de inicio) |
| Cargar de una vez las 14 entidades | Un cambio grande y difícil de validar; el usuario pidió no hacer grandes cambios |
| Reemplazar el campo de texto del contratista | Se conserva para los contratos anteriores; se liga al maestro al editarlos |

## Pendiente (capas siguientes y condiciones)
Capa 2: pólizas, documentos del tercero y modificaciones (ligadas al control de cambios para no tener dos formas de cambiar el valor). Capa 3: procesos, ofertas y comparativo. Capa 4: minutas y actas en Word, y campo. Antes de cargar datos reales: región, confidencialidad y plan comercial (P12 a P14), base legal para datos personales (P33) y decidir si se cargan los contratos de Casa Las Mercedes.

## Evidencia
`supabase/migrations/0026_aliados_contratos.sql`; `pruebas-sql/t-aliados.mjs` (66 comprobaciones); `src/lib/contratos/vigilancia.ts` y `.test.ts` (15); `src/lib/aliados.ts`; pantallas `/aliados`, `/aliados/contratantes` y las secciones «Ruta del contrato» y «Datos contractuales» del contrato.
