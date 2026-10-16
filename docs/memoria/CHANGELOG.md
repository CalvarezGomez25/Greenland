# Registro de cambios de PMO360

Formato inspirado en *Keep a Changelog* (categorías: Añadido, Cambiado, Corregido, Seguridad). Más reciente primero. Fechas en UTC según el historial de Git. Las versiones corresponden a la especificación (`ESPECIFICACION.md`): 1.0 inicial, 2.0 (9 oct), 3.0 (11 oct). La aplicación no tiene aún numeración de versión propia.

## [3.2] · 16 de octubre de 2026
### Añadido
- Correo electrónico y teléfono en los interesados, con validación.
- Directorio de contactos reutilizable entre proyectos: vinculación automática al guardar un interesado, selector «Reutilizar un contacto del directorio», pantalla del directorio con búsqueda y edición, y enlace en el menú lateral (migración 0023, [ADR-0022](decisiones/ADR-0022-interesados-y-directorio-de-contactos.md)).
- Pruebas: `t-contactos` (38 comprobaciones de base de datos) y 9 pruebas unitarias.
### Cambiado
- `ESPECIFICACION.md` a la versión 3.2 (módulo C, secciones 7 y 8, caso 13.12, hito 23, S18 y P33). Guía de «Interesados» actualizada.
### Pendiente
- Datos personales de terceros en el directorio: base legal, aviso y acceso antes de cargar contactos reales (P33).

## [3.1] · 15 de octubre de 2026
### Cambiado
- `ESPECIFICACION.md` a la versión 3.1: marco de referencia ampliado con nivel de verificación (PMBOK 8.ª, ISO 21502, ISO 31000, historia del valor ganado, Ley 594), hitos 20 a 22, decisiones del 12 al 15 de octubre, pendientes P26 a P31, estado del material FARO (17.1 y 17.2) y sección 18 (memoria del proyecto).
- README alineado con la versión 3.1.
### Añadido
- Historia de cómo se llegó al nombre PMO360 (`ESPECIFICACION.md` §1.2, pendiente P32) y ficha ADR-0013 completa con las cuatro opciones evaluadas.
- Memoria del proyecto `docs/memoria/` y PDF de origen y propósito (`6a6f89a`, `66f6811`, `ff74209`).
### Decisión
- No se crea un rol «gerente junior»; los roles quedan como están (sección 8 de la especificación).

## [3.0-ajustes] · 12 de octubre de 2026
### Cambiado
- Tablero de control: proyectos ordenados por código (`b2da7d3`).
- Tablero del proyecto: gráfico de avance «planeado frente a construido», ficha compacta bajo el nombre y resumen de control en rejilla; se retira la tarjeta de avance físico/financiero por redundante (`34baca8`, `3689e5b`).

## [3.0] · 11 de octubre de 2026
### Añadido
- Registro de riesgos ampliado e importación desde Excel con vista previa (migración 0021, `5cd9187`).
- Informe gerencial de una página en PDF y Excel, y envío semanal los lunes 7:30 a. m. (migración 0022, `db2ac62`).
- Material del marco FARO (`ea1aef9`), lámina editable (`c3b86ed`) y el hilo con PMO360 (`0517e5b`).
### Cambiado
- Presupuesto sobre la EDT, con costo por elemento y capítulo heredado en tareas (migración 0020, `ddd7eeb`).
- `ESPECIFICACION.md` a la versión 3.0 (`34b97f9`).

## [2.x] · 10 de octubre de 2026
### Añadido
- Hitos 1 a 11 de la versión 2.0: roles, portafolios, dashboard, acta, valor ganado, interesados, EDT, riesgos, control de cambios, reporte semanal, cronograma, contratos y pagos, bitácora móvil, documentos y cierre, exportaciones, interventoría (`6a61569` a `f437299`).
- Alertas por correo: avisos inmediatos y resumen diario (migración 0019, `1ecb136`).
- Menú lateral, ayuda «?», glosario y guías, cambio de usuario, «Ver guía» (`ca6370f` a `4207ce8`).
- Pruebas SQL en el repositorio, README de puesta en marcha y documento de supuestos (`3b0ee7a`).
- Instalador SQL único e idempotente (`804855f`); diagnóstico de la conexión sin revelar la contraseña (`1b0fcb4`).
### Cambiado
- Marca PMO360 · Control integral de Proyectos (`63ac198`).
- Aprobación de contratos nuevos por el director (migración 0018, `d2e2737`).
### Seguridad
- Auditoría independiente: 1 hallazgo crítico y 7 altos corregidos; festivos automáticos (migraciones 0016 y 0017, `3dc98d8`). Detalle en `docs/AUDITORIA.md`.

## [1.x] · 8 al 9 de octubre de 2026
### Añadido
- Hito 1 (cimientos): estructura Next.js, ingreso, proyectos, equipo (`81dd76b` a `c42cb0d`).
- Hito 2: presupuesto con importación de CSV, partidas, costos adicionales, gasto y registro de cambios (`1979ae2` a `07d20c0`); edición de proyecto, incluido el gerente (`76d1e38`, `81913ff`).
- Instalador del hito 2 (`83240d0`) y migraciones automáticas al desplegar (`b3bbb5d`).
### Corregido
- Permisos de tabla del rol `authenticated` (`34c7fe8`, migración 0002).
- Normalización de la URL de Supabase y mensajes de error de ingreso (`89913d7`, `ce734a6`).
- Diagnóstico seguro del presupuesto (`d480820`).
