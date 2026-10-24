# 06 · Trazabilidad: de la teoría a la prueba

Cadena que se puede recorrer en ambos sentidos: **fuente o necesidad → decisión → módulo → migración → prueba → commit**. Sirve para responder «¿por qué existe esto?» y «¿qué lo prueba?».

Las columnas «Migración» y «Prueba» se verificaron contra los archivos del repositorio el 14 de octubre de 2026. «Hito» sigue la sección 12 de `ESPECIFICACION.md`. «Módulo» (A–Q) sigue la sección 5.

## 1. Módulos

| Módulo | Fundamento (capa del marco) | Decisiones | Migración | Prueba SQL | Commit |
| --- | --- | --- | --- | --- | --- |
| A · Tablero de control (portafolio) | PMBOK 8 (gobernanza); semáforo del libro (hoja «Dashboard RAG») | [0009](decisiones/ADR-0009-semaforo-peor-de-cuatro.md), [0020](decisiones/ADR-0020-tablero-del-proyecto.md) | 0006 | `t-h2` | `4da682c` |
| B · Ficha y acta de constitución | PMBOK (inicio); hoja «Acta de Constitución» | — | 0005, 0006 | `t-h1`, `t-h2` | `6a61569`, `4da682c` |
| C · Interesados | Matriz poder–interés (N3); hoja «Stakeholders»; directorio reutilizable (petición del usuario) | [0022](decisiones/ADR-0022-interesados-y-directorio-de-contactos.md) | 0007, 0023 | `t-h3`, `t-contactos` | `8463ff2`, hito 23 |
| D · EDT | Regla del 100 % (N2); hoja «WBS - EDT» | [0015](decisiones/ADR-0015-presupuesto-sobre-la-edt.md) | 0007, 0020 | `t-h3`, `t-edt-presupuesto` | `8463ff2`, `ddd7eeb` |
| E · Riesgos | ISO 31000 (N2); hoja «Registro de Riesgos»; Excel Planta El Silencio | [0016](decisiones/ADR-0016-escala-de-riesgos-e-importacion.md) | 0007, 0021 | `t-h3`, `t-riesgos-importar` | `8463ff2`, `5cd9187` |
| F · Control de cambios | Control integrado de cambios (N2); *Metodología de Control de Cambios GL* | [0007](decisiones/ADR-0007-control-de-cambios-formal-por-niveles.md) | 0008 | `t-h4` | `b3495f8` |
| G · Reporte semanal, valor ganado y KPI | EVM (N2); hojas «Reporte Semanal» y «KPIs & EVM» | — | 0009 | `t-h5` | `304218f` |
| H · Cierre y lecciones aprendidas | Gestionar el conocimiento (N2/N3) | L-13 | 0013 | `t-h9` | `16a7ebc` |
| I · Documentos | ISO 9001 §7.5 (N2) | — | 0013 | `t-h9` | `16a7ebc` |
| J · Presupuesto y costos | Costo/finanzas (PMBOK 8) | [0006](decisiones/ADR-0006-presupuesto-gerencial-por-capitulos.md), [0015](decisiones/ADR-0015-presupuesto-sobre-la-edt.md) | 0003, 0020 | `t-h2`, `t-edt-presupuesto` | `07d20c0`, `ddd7eeb` |
| K · Cronograma y avance | Cronograma (PMBOK 8); curva S | — | 0010 | `t-h6` | `bf2cc37` |
| L · Bitácora de obra | Registro de campo; información documentada | — | 0012 | `t-h8` | `e658ec9` |
| M · Contratos y pagos | Adquisiciones; Ley 80 | [0010](decisiones/ADR-0010-anticipo-discrecional-tope-20.md), [0012](decisiones/ADR-0012-director-aprueba-contratos-nuevos.md) | 0011, 0018 | `t-h7` | `fda2ead`, `d2e2737` |
| J/M · Integración de contratos y costos (A.I.U., adicionales, balance) | Costo/finanzas y adquisiciones (PMBOK 8); petición del usuario del 24 oct; modelo de control de costos de Casa Las Mercedes (solo concepto, sin datos) | [0029](decisiones/ADR-0029-integracion-contratos-y-costos.md) | 0025 | `t-contratos-costos`; unitarias `calculos`, `balance` | — |
| J · Control de costos por cortes (fase 1) | Control de costos corte a corte de Casa Las Mercedes (solo concepto); EVM (PMBOK 8); petición del usuario del 24 oct | [0030](decisiones/ADR-0030-control-de-costos-por-cortes.md) | — (usa `mediciones_evm`) | unitarias `cortes` | — |
| J · Control de costos por capítulo (fase 2) | EVM aplicado por capítulo; petición del usuario del 24 oct | [0031](decisiones/ADR-0031-control-de-costos-por-capitulo.md) | — | unitarias `proyeccion-capitulos` | — |
| N · Interventoría | Ley 80 art. 32; Ley 1474 (N2); Ley 51 de 1983 | [0011](decisiones/ADR-0011-interventoria-sin-presupuesto.md), [0021](decisiones/ADR-0021-festivos-automaticos.md) | 0014, 0015, 0016 | `t-h11` | `f437299`, `3dc98d8` |
| O · Alertas por correo | Gestión por excepción (criterio propio) | [0017](decisiones/ADR-0017-correos-por-cron-con-usuario-de-solo-lectura.md) | 0019 | `t-alertas` | `1ecb136` |
| P · Informe gerencial | Informe de una página; sistema de diseño GreenLand | [0018](decisiones/ADR-0018-informe-gerencial-una-pagina.md) | 0022 | pruebas unitarias en `src/lib/informe/` | `db2ac62` |
| Q · Ayuda y glosario | Accesibilidad para usuarios no técnicos | [0014](decisiones/ADR-0014-menu-lateral-ayuda-y-glosario.md) | — | pruebas unitarias | `48f0997`, `3419da0`, `4207ce8` |
| R · Actividades y Mi trabajo | Trabajo del proyecto (PMBOK 7); petición del usuario del 16 oct; mínimo a validar en el piloto; tablero Kanban el 17 oct | [0023](decisiones/ADR-0023-actividades-y-mi-trabajo.md), [0026](decisiones/ADR-0026-integracion-con-microsoft-365.md) | 0024 | `t-actividades`; unitarias `actividades.test.ts` | `650d8a8`, `d50aa6a`, `a2be839` (hito 24) |
| Inicio por rol y navegación | Interventoría fuera del portafolio (§3); petición del usuario del 17 oct | [0024](decisiones/ADR-0024-pantalla-de-inicio-por-rol.md) | — | unitarias `navegacion.test.ts` | `00cb5b3`, `9186580`, `78b5aa8` |
| Administración: traspaso y permisos del director | Decisión del usuario del 17 oct (**por construir**) | [0027](decisiones/ADR-0027-administrador-unico-y-traspaso.md) | — (pendiente) | — (pendiente) | `4e85691` a `fd3c101` (solo documentos) |
| Exportaciones Excel y PDF | Informes a la dirección; identidad de la marca (informe gerencial) | [0025](decisiones/ADR-0025-exportaciones-con-identidad-de-marca.md) | — | pruebas unitarias `exportar.test.ts` | `a76dd62`, `72dc45c` (hito 25) |
| Imagen corporativa (todos los módulos) | Sistema de diseño GreenLand v1.0.0 | [0028](decisiones/ADR-0028-sistema-de-diseno-greenland-v1.md) | — | pruebas unitarias de exportaciones y navegación | `506d98a`, `f6d9f22` |
| Seguridad y auditoría | Principio de reglas en la base | [0004](decisiones/ADR-0004-reglas-de-acceso-en-la-base.md) | 0017 | `t-auditoria` | `3dc98d8` |
| Instalación | Reducir pasos manuales | [0008](decisiones/ADR-0008-instalador-sql-unico.md) | todas | `t-instalador`, `t-migraciones` | `804855f` |

## 2. Estado de verificación al 17 de octubre de 2026

| Verificación | Resultado | Cómo repetirla |
| --- | --- | --- |
| Pruebas unitarias | **328 correctas en 35 archivos** (`npx vitest run`, ejecutado el 17 oct, commit `78b5aa8`) | `npm test` |
| Pruebas de base de datos | **586 comprobaciones correctas, 0 suites con fallos** (`npm run test:sql`, ejecutado el 17 oct, commit `78b5aa8`) | `npm run test:sql` |
| Tipos, estilo y compilación | `tsc`, `eslint` y `next build` correctos el 17 oct (commit `78b5aa8`) | `npm run verificar` |
| Pruebas en navegador | Tablero Kanban, inicio por rol y «Mis proyectos» probados en un navegador real con un **Supabase simulado** (no el real); PDF y Excel revisados como imagen | Guion de la sesión del 17 oct |
| Producción | El usuario instaló el SQL y desplegó con datos ficticios; confirmó que funciona. **Ningún correo enviado; sin datos reales; sin revisión de seguridad independiente** | — |

## 3. Cómo se mantiene

Cada cambio de módulo agrega o ajusta su fila. Al crear una migración, se añade a la columna «Migración». Al decidir algo, se crea la ficha ADR y se enlaza aquí. Regla completa en [09-gobierno-de-la-memoria.md](09-gobierno-de-la-memoria.md).
