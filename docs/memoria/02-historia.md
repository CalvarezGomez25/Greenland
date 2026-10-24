# 02 · Historia del desarrollo de PMO360

Cronología desde el antecedente hasta el 14 de octubre de 2026. Reconstruida a partir de (a) el historial de Git (53 commits al iniciar esta memoria), (b) el registro de la sesión de desarrollo en Claude Code y (c) los artifacts de la cuenta. **Las horas del registro de la sesión están en UTC; en Colombia son UTC−5.** Las fechas de commit también son UTC.

Convenciones: «Usuario» = Carlos, gerente de proyectos, no programador, que pidió desde el inicio explicaciones en lenguaje sencillo. «Claude» = el asistente de programación. Los números de decisión (`ADR-####`) remiten a [`decisiones/`](decisiones/). Las lecciones (`L-#`) a [07-lecciones-aprendidas.md](07-lecciones-aprendidas.md).

## Fase 0 · Antecedentes (hasta el 8 de octubre de 2026)

**Fuera del repositorio y no reconstruibles del todo.** La plataforma nació de trabajo anterior del usuario en otras conversaciones. Lo que se puede comprobar:

| Pieza | Evidencia | Qué aportó |
| --- | --- | --- |
| Libro *Sistema de Gestión de Proyectos de Infraestructura* (Excel) | Citado en `ESPECIFICACION.md`; hojas: Índice, Acta de Constitución, Stakeholders, WBS-EDT, Registro de Riesgos, Registro de Cambios, Reporte Semanal, KPIs & EVM, Dashboard RAG, Ruta PMP | Plantillas base; sección 15 de la especificación las mapea a módulos. **No accesible en esta memoria** |
| *Metodología de Control de Cambios GL* y prototipo SGCC | Citados en la especificación | Base del módulo de cambios. No accesibles |
| Prototipo «PM Infraestructura — Sistema Integral de Gerencia» | Artifact, actualizado el 8 oct | Página única con nueve módulos (Dashboard RAG, Reporte semanal, KPIs y EVM, Acta, Stakeholders, EDT, Riesgos, Cambios, Lecciones), PMBOK 7, USD, datos solo en el navegador. Fuente de las escalas 1–5 de riesgo y poder–interés, y del semáforo por SPI/CPI |
| Prototipo «Plataforma de Obra» | Artifact, 8 oct | Cuatro pantallas de obra (presupuesto con curva S, cronograma con Gantt, bitácora, contratos); sin usuarios ni servidor |
| «GreenLand Design System» | Artifact, 8–9 oct | Colores `#5D870E`, `#E6F1D1`, `#164504`, acento `#7C401D`; Baloo 2 y Roboto Light; tarjetas planas sin degradados ni emojis; español de Colombia |
| «Especificación técnica: Plataforma de Gestión de Obras» | Documento, 7 oct | Primera especificación; origen de `ESPECIFICACION.md` |

**Brecha declarada (G-4):** las conversaciones donde se hicieron el libro y la especificación inicial no se pudieron leer. Solo existe un listado de sesiones con una sesión visible (la de desarrollo). Esta fase se completa si el propietario aporta esas conversaciones o un resumen.

## Fase 1 · Cimientos y primer despliegue (8 de octubre)

**Petición inicial (17:11 UTC):** leer `ESPECIFICACION.md`, explicar cada paso en lenguaje sencillo, pedir confirmación antes de instalar o ejecutar, empezar por el hito 1 y antes de escribir código resumir lo entendido y listar dudas. Este **acuerdo de trabajo** gobernó el primer día (ver [09-gobierno-de-la-memoria.md](09-gobierno-de-la-memoria.md) §5).

| Hora (UTC) | Hecho |
| --- | --- |
| 17:11 | Claude entrega resumen y dudas; el usuario responde. Decisiones: construir en el repositorio `Greenland` en la nube ([ADR-0001](decisiones/ADR-0001-construir-en-el-repositorio-greenland.md)); correo y contraseña, usuarios por invitación, Director y Administrador como roles globales ([ADR-0003](decisiones/ADR-0003-acceso-por-invitacion-y-roles-globales.md)); 6 proyectos y 6 usuarios por ahora; datos ficticios ([ADR-0005](decisiones/ADR-0005-datos-ficticios-hasta-decidir-region.md)); usar GreenLand Design System |
| 17:28–17:31 | Claude localiza el prototipo «Plataforma de Obra» en los artifacts y verifica en la web los planes de Supabase y Vercel (con el aviso de que no pudo abrir los sitios y usó resúmenes de búsqueda): Vercel Hobby es no comercial, Supabase gratuito se pausa tras una semana sin uso, existe región São Paulo |
| 18:15–18:16 | Primera migración `0001_cimientos.sql` (perfiles, proyectos, miembros, reglas de acceso). Commit `81dd76b` |
| 19:05–19:28 | El usuario crea el proyecto en Supabase y ejecuta el SQL. Primeros obstáculos: no encontraba el Editor SQL; permisos de tabla excesivos para `authenticated`; se corrige con `0002_ajustar_permisos.sql` (commit `34c7fe8`). Se verifican concesiones de privilegios con una consulta |
| 19:58–21:57 | Despliegue en Vercel. El ingreso falla con 404: la URL de Supabase incluía `/rest/v1`. Claude normaliza la URL (`89913d7`) y añade mensajes de error distintos por causa (`ce734a6`). A las 21:57 el usuario confirma: «Ya publicó, ya puedo ingresar» (**L-1, L-2**) |

## Fase 2 · Presupuesto y la crisis de configuración (8–9 de octubre)

| Fecha | Hecho |
| --- | --- |
| 8 oct, 22:21 | «Todo salió correcto, continuemos con el Hito 2» |
| 8 oct, 23:01–23:28 | Diez decisiones del usuario sobre presupuesto (supervisor lo ve; costos incluyen AIU, IVA sobre la utilidad y retención en la fuente como porcentajes que varían según contratista; control de cambios formal también para el presupuesto, «opción A»). Autoriza instalar PGlite y Vitest para probar sin tocar Supabase ([ADR-0006](decisiones/ADR-0006-presupuesto-gerencial-por-capitulos.md), [ADR-0007](decisiones/ADR-0007-control-de-cambios-formal-por-niveles.md)) |
| 8–9 oct | Entregas A (lectura) y B (importar CSV, editar partidas, costos adicionales, gasto, registro de cambios). Commits `1979ae2`, `d0fb72b`, `ffedc7d`, `07d20c0` |
| 9 oct | Error `PGRST205` («tabla no encontrada») al abrir Presupuesto; la edición de proyecto no guarda. Se permite que el gerente edite su proyecto (`81913ff`, migración 0004). El error persiste |
| 9 oct, 01:48 | **Punto de quiebre.** El usuario, tras un día de configuración: «Debes ser capaz de corregir todos los errores sin que yo tenga que hacer la mayor parte del trabajo… Si es el caso, debes rehacer todo el proyecto desde cero. Buscar otras opciones de bases de datos y servidores más fáciles de configurar» |
| 9 oct, 01:49 | Respuesta de Claude: no hace falta rehacer; cualquier alternativa necesitaría el mismo paso de crear tablas. Se reduce a **un solo script idempotente** (`instalar_hito2.sql`, commit `83240d0`) probado dos veces seguidas sobre una copia (104/104 pruebas). Este episodio es el origen de [ADR-0008](decisiones/ADR-0008-instalador-sql-unico.md) (**L-3**) |

## Fase 3 · Los once hitos en un día (10 de octubre)

**11:55 UTC.** El usuario comparte la `ESPECIFICACION.md` actualizada (v2.0, con el rol de Interventoría) y cambia el modo de trabajo: «Realiza todos los hitos por tu cuenta y dame solo los pasos que deba yo hacer que tú no puedas, como ingresar a Supabase y Vercel. Intenta hacerlo todo por ti mismo». Desde aquí Claude trabaja de forma autónoma: commit y push por tarea, sin pedir confirmación para cada paso técnico.

| Hito (v2.0) | Contenido | Commit |
| --- | --- | --- |
| 1 | Roles completos, organizaciones, portafolios, ficha, parámetros, auditoría, usuarios | `6a61569` |
| 2 | Dashboard PMO, tablero del proyecto, acta, valor ganado, semáforo | `4da682c` |
| 3 | Stakeholders, EDT, riesgos (alimentan el semáforo) | `8463ff2` |
| 4 | Control de cambios de 8 fases, niveles, firma del patrocinador, líneas base versionadas | `b3495f8` |
| 5 | Reporte semanal con foto inmutable, hitos, reuniones, seis KPI con tendencia | `304218f` |
| 6 | Cronograma con Gantt, avance reportado y verificado, línea base de costo | `bf2cc37` |
| 7 | Contratos y pagos: anticipo autorizado, actas, retención, otrosí | `fda2ead` |
| 8 | Bitácora de obra móvil con fotos permanentes | `e658ec9` |
| 9 | Documentos con versiones, cierre y lecciones aprendidas | `16a7ebc` |
| 10 | Exportaciones Excel y PDF | `a76dd62` |
| 11 | Interventoría | `f437299` |

**Despliegue otra vez cuesta horas.** 15:19–17:00 UTC: el usuario no encuentra `DATABASE_URL`; luego el despliegue falla con `password authentication failed for user "postgres" (28P01)` cuatro veces, aun con la contraseña revisada. Claude no logra determinar la causa. Solución: el despliegue ya no se detiene por la conexión y se crea el **instalador único** `supabase/instalar_todo.sql` (commit `804855f`). El usuario lo ejecuta y confirma que funciona (**L-3, L-4**).

**Tarde del 10 de octubre.**
- 17:00: peticiones de ajuste: sacar los festivos del menú (se calculan solos, [ADR-0021](decisiones/ADR-0021-festivos-automaticos.md)), tarjetas del tablero que navegan, y exportaciones que no funcionaban. «Haz un recorrido completo de toda la plataforma… Audita con inteligencia y profundidad».
- **Auditoría** (`3dc98d8`, migración 0017): 1 hallazgo crítico y 7 altos, todos corregidos con pruebas. Detalle en [`docs/AUDITORIA.md`](../AUDITORIA.md) (**L-5**).
- 19:36: el director aprueba los contratos nuevos (migración 0018, [ADR-0012](decisiones/ADR-0012-director-aprueba-contratos-nuevos.md)).
- 20:10–20:46: nombre. El usuario: «“Plataforma de obra” es genérico. Algo como PMO360. Haz un par de propuestas». Claude propone cuatro opciones (PMO360, GreenLand PMO360, Atalaya, Raíz PMO), recomienda GreenLand PMO360 y advierte que no verificó disponibilidad de marca. El usuario decide: **PMO360 · Control integral de Proyectos**, sin repetir GreenLand porque ya es la imagen principal. Se aplica en el commit `63ac198`. Detalle en `ESPECIFICACION.md` §1.2 y [ADR-0013](decisiones/ADR-0013-marca-pmo360.md). Alertas por correo ([ADR-0017](decisiones/ADR-0017-correos-por-cron-con-usuario-de-solo-lectura.md), `1ecb136`).
- 21:31–23:47: menú lateral inspirado en otro sitio del usuario, tablero compacto, anglicismos reemplazados, ayuda «?», glosario, cambio de usuario y barra de proyecto con «Ver guía» ([ADR-0014](decisiones/ADR-0014-menu-lateral-ayuda-y-glosario.md)).

## Fase 4 · Del presupuesto a los informes (11 de octubre)

| Hecho | Decisión o commit |
| --- | --- |
| Presupuesto creable desde la EDT; el usuario pregunta si conviene, Claude analiza ventajas y riesgos y propone vínculo **opcional** | [ADR-0015](decisiones/ADR-0015-presupuesto-sobre-la-edt.md), `ddd7eeb` |
| El usuario pide recordatorio de pendientes (alertas por correo, usuario analista) y cierra la jornada | Recordatorio disparado el 12 oct |
| Registro de riesgos de la Planta El Silencio (Excel): leer, incorporar, «quiero ver cómo registras y distribuyes los datos». Se amplía el registro y se crea importación con vista previa | [ADR-0016](decisiones/ADR-0016-escala-de-riesgos-e-importacion.md), `5cd9187` (migración 0021). Se corre además el SQL actualizado (el usuario: «Todo está en orden») |
| Informe gerencial de una página (Excel y PDF) con envío automático los lunes a las 7:30 a. m. | [ADR-0018](decisiones/ADR-0018-informe-gerencial-una-pagina.md), `db2ac62` (migración 0022) |

## Fase 5 · Marco FARO y presentación (11 de octubre)

El usuario pide un marco de máximo cuatro pasos para dar sustento, orden y estructura al argumento de la plataforma (utilidad, sostenibilidad, escalabilidad), con tono neutro, convincente y fácil de exponer, tomando como referencia la estructura de explicación del creador Sandeep Swadia.

- **Investigación:** Claude lee transcripciones de 3 de sus 458 videos (no puede ver los videos) y consulta guías de práctica (Principio de la Pirámide, MECE). Documenta límites: fuentes de consultoría, no estándares.
- **Preguntas y respuestas:** objetivo (entender y luego pilotear), formatos (todos), foco (emoción antes que números), nombre mnemotécnico, borrador y revisión, sin cifras de ahorro, 12 proyectos.
- **Nombre:** se proponen BASE y FARO. El usuario elige **FARO** con la imagen del faro como gancho: *Fuente única, Alerta a tiempo, Respaldo, Operación que escala*. Frase: «Que ningún proyecto navegue a ciegas».
- **Hilo de investigación paralelo** sobre un caso colombiano. El agente no pudo abrir páginas; las cifras no se contrastaron; los casos de Reficar, La Línea e Hidroituango se evaluaron y **se descartaron** por sensibilidad y falta de verificación. Se quedaron las historias ilustrativas ([ADR-0019](decisiones/ADR-0019-faro-y-piloto-de-90-dias.md)).
- **Producción:** guion para exponer, lámina de una página (PDF, PNG y PPTX editable), documento corto, guion de video (`ea1aef9`, `c3b86ed`), `ESPECIFICACION.md` a v3.0 (`34b97f9`). Hilo entre el nombre y el marco: PMO360 es la vuelta completa; cada paso ilumina un cuarto (4 × 90° = 360°) (`0517e5b`).

## Fase 6 · Ajustes de tablero (12 de octubre)

- Proyectos del tablero ordenados por código GL-001, GL-002… (`b2da7d3`).
- Página del proyecto: gráfico de avance «planeado frente a construido»; la tarjeta de avance físico/financiero se retira por redundante; ficha compacta (`34baca8`).
- Resumen de control en rejilla para pantalla ancha y ficha bajo el nombre (`3689e5b`) — [ADR-0020](decisiones/ADR-0020-tablero-del-proyecto.md).

## Fase 7 · Esta memoria (14 de octubre)

El usuario pide documentar todo desde la gestación como repositorio de memoria con trazabilidad, complementar con otros chats, organizar un marco teórico validado e investigar buenas prácticas de documentación. Resultado: este conjunto `docs/memoria/`. **No se pudieron leer otras conversaciones:** el listado de sesiones solo mostró la de desarrollo; los antecedentes se reconstruyeron de los artifacts de la cuenta y de `ESPECIFICACION.md`.

## Fase 8 · Interesados con contacto y directorio (16 de octubre)

El usuario, al revisar el registro de interesados, pidió agregar correo electrónico y teléfono, guardarlos en la base de datos y poder reutilizar el registro en proyectos siguientes. Se construyó la migración 0023 (tabla `contactos`, columnas nuevas y vinculación automática), el selector «Reutilizar un contacto del directorio» y la pantalla del directorio. Se verificó con 38 comprobaciones de base de datos nuevas, 9 pruebas unitarias nuevas y un recorrido en navegador. Decisión en [ADR-0022](decisiones/ADR-0022-interesados-y-directorio-de-contactos.md).

Entre la fase 7 y esta, el 15 de octubre, el usuario consultó cómo crear un rol «gerente junior» que creara y gestionara sus propios proyectos; tras el análisis decidió **no hacer cambios** (ver `ESPECIFICACION.md` §8).

## Fase 9 · Actividades y «Mi trabajo» (16 de octubre)

El usuario preguntó si convenía darle a la plataforma la forma de un gestor colaborativo tipo Trello, Asana o ClickUp. Tras comparar tres caminos (integrar una herramienta externa, módulo propio o reencuadrar toda la plataforma) y discutir el riesgo de complicar la herramienta, acordaron construir **un mínimo propio**, para gerencia, analistas e interventoría. El usuario aclaró que la organización no usa hoy ninguna de esas herramientas: cada persona gestiona su información a su manera. Se construyó la migración 0024 (tabla `actividades`), el tablero por proyecto y la pantalla «Mi trabajo». Se verificó con 54 comprobaciones de base de datos y 7 pruebas unitarias nuevas, más tipos, lint y compilación; **aún sin recorrido en navegador**. Decisión en [ADR-0023](decisiones/ADR-0023-actividades-y-mi-trabajo.md); la adopción se mide en el piloto (P34).

## Fase 10 · Tablero Kanban, exportaciones, inicio por rol y administración (16 y 17 de octubre)

- **Despliegue del módulo.** El usuario pidió dejar PMO360 intacta y probar el gestor en una rama aparte (`prueba/gestor-colaborativo`); como Vercel no permitía desplegar esa rama, pidió devolver el módulo a la rama principal (`650d8a8`, `3454ada`, `d50aa6a`; ver L-15).
- **Tablero Kanban real** en «Actividades» y «Mi trabajo»: columnas lado a lado, tarjetas que se arrastran con cambio inmediato y selector «Mover a» para celular (`a2be839`; L-16).
- **Exportaciones con la identidad de la marca** a partir de una captura del PDF del tablero que el usuario calificó de plano (`72dc45c`) — [ADR-0025](decisiones/ADR-0025-exportaciones-con-identidad-de-marca.md).
- **Pantalla de inicio por rol**: quien no ve todo el portafolio entra a «Mi trabajo»; la interventoría queda sin tablero propio; corrección de «Mis proyectos» para un administrador asignado a proyectos (`00cb5b3`, `9186580`, `78b5aa8`; L-14) — [ADR-0024](decisiones/ADR-0024-pantalla-de-inicio-por-rol.md).
- **Microsoft 365.** Tras comprobar que la organización no usa ninguna herramienta de tareas, el usuario planteó usar la licencia corporativa de Microsoft; se preparó una guía para TI (documento) y se dejó como propuesta — [ADR-0026](decisiones/ADR-0026-integracion-con-microsoft-365.md).
- **Administración futura.** El usuario decidió: por ahora Carlos sigue como administrador; más adelante habrá un único administrador de TI, Carlos pasará a Analista PMO y el director general creará los proyectos y los equipos. Quedó como pendientes P35 y P36 (`4e85691` a `fd3c101`) — [ADR-0027](decisiones/ADR-0027-administrador-unico-y-traspaso.md).

## Fase 11 · Nueva imagen corporativa (21 de octubre)

El usuario pidió aplicar el sistema de diseño renovado de GreenLand (v1.0.0, publicado ese día) a toda la plataforma para desplegar con la nueva imagen, y dejó al asesor decidir si crear una versión aparte para poder volver. Se evaluaron tres opciones y se eligió cambiar en la rama principal con un único punto de reversión ([ADR-0028](decisiones/ADR-0028-sistema-de-diseno-greenland-v1.md)). Primero se remapearon los tokens de color y tipografía, luego se barrieron los componentes (píldoras, campos, tarjetas con muesca, tablas, alertas) y se verificó en navegador en escritorio y celular; después se aplicó la misma identidad a las exportaciones PDF y Excel, al informe gerencial y a los correos. Quedan brechas con el paquete oficial, los íconos y la fuente licenciada (P39).

## 24 de octubre de 2026 · Integración de contratos y costos

El usuario pidió ligar los contratos al presupuesto para confrontar lo presupuestado con lo contratado, dividir el presupuesto entre costos directos e indirectos (A.I.U.) y tratar los adicionales como un concepto aparte (trabajos no contemplados en la EDT original o añadidos durante la ejecución). Se construyó en [ADR-0029](decisiones/ADR-0029-integracion-contratos-y-costos.md): tipos de costo indirecto, adicionales con estado derivado del cambio, asignación de contratos a capítulos y adicionales, y un módulo Balance de costos. Del tablero de control de costos de Casa Las Mercedes se tomó solo el concepto (corte a corte); su evolución gráfica quedó como fase posterior sin decidir (P40).

Ese mismo día el usuario aceptó los supuestos de diseño (P40), dijo que al gerente le basta con el EAC calculado y pidió la fase 1 del gráfico tipo Casa Las Mercedes ([ADR-0030](decisiones/ADR-0030-control-de-costos-por-cortes.md)): pantalla «Control de costos» con invertido, por invertir y proyectado corte a corte. La fase 2 (por capítulo) quedó habilitada por la asignación de contratos.

## Estado al 17 de octubre de 2026

Ver [01-resumen-ejecutivo.md](01-resumen-ejecutivo.md).
