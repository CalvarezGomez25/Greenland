# Registro de cambios de PMO360

Formato inspirado en *Keep a Changelog* (categorías: Añadido, Cambiado, Corregido, Seguridad). Más reciente primero. Fechas en UTC según el historial de Git. Las versiones corresponden a la especificación (`ESPECIFICACION.md`): 1.0 inicial, 2.0 (9 oct), 3.0 (11 oct). La aplicación no tiene aún numeración de versión propia.

## [3.5.1] · 23 de octubre de 2026
### Seguridad
- **Revisión de la alerta de Next.js** (`npm audit`): Next.js 16.4.0 estaba afectada por 3 avisos (2 críticos: ejecución remota de código en la optimización de imágenes con SVG y en funciones `use cache`; 1 alto: denegación de servicio con acciones de servidor). Se actualizó a **16.4.3** (versión de parche, sin cambios de código). Nodemailer pasó de 6.10.1 a **10.2.1** (tenía avisos altos y moderados; el uso es solo `createTransport` y `sendMail`).
- Quedan 2 avisos moderados en `uuid` dentro de `exceljs`: afectan solo a quien pasa un búfer propio a `uuid` v3/v5/v6; no se actualiza porque la solución que propone `npm audit` es bajar `exceljs` a la 3.4.0 (cambio incompatible y retroceso).
### Cambiado
- Línea de tiempo de «Mi trabajo» más compacta; «Mis proyectos» pasa a una franja de tarjetas pequeñas (con el color de cada proyecto) entre la línea de tiempo y el tablero, que gana protagonismo.

## [3.5.0] · 23 de octubre de 2026
### Cambiado
- **Se vuelve a la imagen anterior (sistema de diseño previo de GreenLand)** por decisión del usuario: se revirtió el código de la v3.4.0 con `git revert -m 1 9df595b` (`dc309ba`). La documentación de la v3.4.0 se conserva como registro; el estado de [ADR-0028](decisiones/ADR-0028-sistema-de-diseno-greenland-v1.md) pasa a «Revertida».
### Añadido
- **Línea de tiempo en «Mi trabajo»**: horizonte entre lo más atrasado y lo más lejano que tiene pendiente la persona, con un hito por fecha límite, «hoy» marcado, colores por proyecto asignado y leyenda. Pruebas unitarias en `actividades.test.ts`. Sin cambios de base de datos.

## [3.4.0] · 21 de octubre de 2026 (código revertido el 23 de octubre)
### Cambiado
- **Nueva imagen corporativa: sistema de diseño GreenLand v1.0.0** en toda la interfaz (verde #027001, texto #5E5E5E, Archivo, píldoras, tarjetas con muesca, sin sombras ni mayúsculas sostenidas, alertas sobrias) (`506d98a`), en las exportaciones PDF y Excel, el informe gerencial y los correos (`f6d9f22`). Decisión y forma de volver atrás en [ADR-0028](decisiones/ADR-0028-sistema-de-diseno-greenland-v1.md). Sin cambios de base de datos.
- `ESPECIFICACION.md` a la versión 3.4.0 (§1.1, hito 26, S20, P39).
### Pendiente
- Paquete oficial del sistema (logotipos, íconos), fuente licenciada, validación de la paleta de alertas y material de FARO con la identidad anterior (P39).

## [3.3.2] · 21 de octubre de 2026
### Cambiado
- Se registra que la rama principal es `claude/especificacion-project-manager-495kj0` y la regla de integración (traer lo último antes de cada sesión, *merge*, sin forzar). Pendiente P38: ramas secundarias.

## [3.3.1] · 21 de octubre de 2026
### Corregido
- `ESPECIFICACION.md`: cifras de pruebas (328 unitarias y 586 de base de datos, verificadas de nuevo el 21 de octubre sobre el código unido) y estado de P16 y P17 (el recordatorio del 12 de octubre ya se cumplió; configuración de correos aún pendiente).
- Memoria: cifras del guion de origen y propósito alineadas (914 comprobaciones automáticas en total) y PDF regenerado.
### Cambiado
- Se unieron las dos líneas de trabajo de la rama (interesados y directorio, y actividades, Kanban, inicio por rol y traspaso); la versión vigente de la especificación pasa a 3.3.1.
### Añadido
- Guías de operación en la especificación (sección 16) y en el README: crear usuarios con su rol y configurar y probar el envío de correos por fases.

## [3.3] · 16 de octubre de 2026
### Añadido
- Módulo **Actividades**: trabajo asignado a personas del proyecto, con responsable real, fecha límite, prioridad y estado (por hacer, en curso, bloqueada, hecha), ligable a un riesgo y a un elemento de la EDT; tablero de cuatro columnas por proyecto (migración 0024, [ADR-0023](decisiones/ADR-0023-actividades-y-mi-trabajo.md)).
- Pantalla **Mi trabajo** (menú lateral): las actividades pendientes de la persona en todos sus proyectos, agrupadas por urgencia.
- **Pantalla de inicio por rol:** quien no ve todo el portafolio (sin rol global) entra a «Mi trabajo», con sus actividades pendientes y la lista de sus proyectos; el tablero de control sigue siendo el inicio de quien tiene rol global. Los demás conservan su tablero limitado a sus proyectos como «Tablero de mis proyectos» (`/tablero`); la interventoría no lo tiene (su lista de proyectos ya está en «Mi trabajo»). Verificado en un navegador real con administrador, gerente e interventoría.
- «Mis proyectos» de «Mi trabajo» también se muestra a quien tiene rol global y está asignado a proyectos (antes solo a quien no tenía rol global). Lista los proyectos donde la persona está asignada.
- Guía «Actividades y Mi trabajo» en la ayuda.
- Tablero Kanban real en «Actividades» y «Mi trabajo»: cuatro columnas lado a lado, tarjetas que se arrastran de una columna a otra con cambio inmediato (vuelve atrás si la base de datos lo rechaza) y selector «Mover a» para celular y teclado. Verificado en un navegador real con un Supabase simulado.
- Pruebas: `t-actividades` (54 comprobaciones de base de datos) y 7 pruebas unitarias.
### Cambiado
- **Exportaciones a PDF y Excel con la identidad de la marca** (la del informe gerencial): logo, tipografías Baloo 2 y Roboto, paleta verde, filas alternadas y etiquetas de color para el semáforo, los niveles de riesgo y Sí / No. El PDF del tablero de control suma tarjetas de indicadores (proyectos activos, verde / amarillo / rojo / sin datos, BAC, AC, SPI y CPI del portafolio), encabezado en cada hoja y pie con número de página. El Excel lleva el logo, encabezado de marca, sin cuadrícula, paneles fijos, formato de pesos y «S/I» donde falta información, e imprime en horizontal ajustado al ancho con la fila de títulos repetida. Aplica a todos los PDF y Excel de tablas de la plataforma (tablero, reporte semanal, valor ganado, cambios, contratos).
- `ESPECIFICACION.md` a la versión 3.3 (módulo R, secciones 4, 7 y 8, hito 24, S19 y P34).
- Memoria del proyecto actualizada (17 de octubre de 2026): fichas ADR-0024 a ADR-0027, lecciones L-14 a L-17, fuentes de la integración con Microsoft 365, bitácora de sesión, historia (fase 10), trazabilidad y resumen ejecutivo; pendiente M-8.
### Pendiente
- Dos decisiones registradas como pendientes (17 de octubre de 2026): P35, rol futuro de Carlos (Analista PMO con visión del portafolio y gerente de sus proyectos) y administrador único de TI; y P36, quién crea proyectos y arma los equipos una vez el administrador sea de TI. P36 decidido: cuando el administrador sea el de TI, el director general de planificación y proyectos crea los proyectos y arma los equipos (por construir con el traspaso; hoy lo hace Carlos como administrador). Regla acordada para P35: siempre exactamente un administrador; al nombrar a otro, el anterior deja de serlo automáticamente (por construir; hoy la plataforma permite varios). Decidido: en el traspaso, Carlos pasa automáticamente a «Analista PMO» (conserva el acceso al portafolio y sus roles de gerente). Por ahora todo sigue igual: Carlos es administrador.
- Recorrido en navegador con datos ficticios y validación de adopción en el piloto (P34). Comentarios, adjuntos y avisos quedan para una fase siguiente, solo si hay uso real.

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
