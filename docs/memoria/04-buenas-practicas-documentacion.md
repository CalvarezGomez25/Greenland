# 04 · Buenas prácticas para documentar proyectos, y cómo las aplica este repositorio

Investigación del 14 de octubre de 2026. Las prácticas se agrupan por el problema que resuelven. Cada una indica su nivel de verificación (ver [08-fuentes-y-verificacion.md](08-fuentes-y-verificacion.md)) y cómo se aplicó aquí. Son prácticas de ingeniería y de gestión de proyectos; ninguna es obligatoria por sí sola.

## 1. Prácticas investigadas

### 1.1 Registrar decisiones: *Architecture Decision Records* (ADR)
- Michael Nygard propuso en 2011 (artículo del 15 de noviembre) registrar cada decisión importante en un formato breve: **título con número, contexto, decisión, estado y consecuencias**. Estados: propuesta, aceptada, y luego obsoleta o reemplazada, con enlace a la que la reemplaza. Se deben listar **todas** las consecuencias, no solo las favorables. **N2** (arc42 y varias organizaciones coinciden).
- Los registros reemplazados **no se borran**; la decisión nueva referencia la anterior. **N2.**
- *Aplicación aquí:* carpeta [`decisiones/`](decisiones/) con una ficha por decisión y la plantilla en [`plantillas/`](plantillas/).

### 1.2 Separar los tipos de documento: Diátaxis
- Daniele Procida (Canonical) propone cuatro tipos que no se mezclan en un mismo documento: **tutoriales** (aprender), **guías prácticas** (resolver un problema), **referencia** (consultar datos) y **explicación** (comprender). **N2.**
- *Aplicación aquí:* la memoria sigue esta separación: explicación = marco teórico e historia; referencia = trazabilidad, fuentes y `ESPECIFICACION.md`; guías prácticas = README (puesta en marcha) y guías dentro de la aplicación; tutorial = no existe (**brecha G-5**).

### 1.3 Estructura estándar para documentar arquitectura: arc42
- Plantilla libre de Gernot Starke y Peter Hruschka (desde 2005) con **doce secciones** (requisitos, restricciones, vistas de bloques de construcción, tiempo de ejecución y despliegue, decisiones de arquitectura, escenarios de calidad, entre otras), independiente de herramientas y metodología. **N2.**
- *Aplicación aquí:* no se adoptó arc42 completo; `ESPECIFICACION.md` cumple un papel parecido (secciones 3, 7, 10, 11, 14). Opción futura si el sistema crece (**G-6**).

### 1.4 Llevar historial de cambios legible: *Keep a Changelog*
- Olivier Lacan: el historial es para personas; una entrada por versión; cambios agrupados por tipo (**Added, Changed, Deprecated, Removed, Fixed, Security**); versión más reciente primero; fechas visibles; enlazable. **N2.**
- *Aplicación aquí:* [`CHANGELOG.md`](CHANGELOG.md) en español, con las mismas categorías (Añadido, Cambiado, Corregido, Seguridad).

### 1.5 Documentación junto al código (*docs as code*)
- Texto plano versionado en Git, revisado por *pull request* y publicado desde el repositorio; **la automatización no actualiza sola el contenido: las actualizaciones hay que programarlas en el flujo de trabajo**. **N3** (artículos divulgativos).
- *Aplicación aquí:* toda la memoria es Markdown en `docs/memoria/` del mismo repositorio. La nota sobre actualización pesa: el README del proyecto quedó desactualizado (lección L-8) justamente por no haber un hábito de revisión.

### 1.6 Información documentada y control documental (ISO 9001:2015, cláusula 7.5)
- El volumen de documentación debe ser **proporcional** al tamaño, la complejidad y la competencia de las personas. Cada documento se **identifica** (título, fecha, autor, referencia), se **revisa y aprueba**, y se **controla** (disponible donde se necesita, protegido de alteración). Se distingue *mantener* documentos de *conservar* registros. **N2.**
- *Aplicación aquí:* encabezado uniforme con fecha, estado y responsable; [`09-gobierno-de-la-memoria.md`](09-gobierno-de-la-memoria.md) define quién aprueba y cuándo se revisa.

### 1.7 Lecciones aprendidas como proceso, no como archivo
- PMBOK (6.ª ed.) trata el registro de lecciones aprendidas como entrada y salida de «Gestionar el conocimiento del proyecto», y recomienda actualizarlo durante el proyecto, no solo al cierre. **N2/N3.** PRINCE2 distingue lección *registrada* de lección *aplicada* (**N3**).
- La evidencia de fallo en la práctica (NASA GAO-02-195, Duffield y Whitty, ver [03-marco-teorico.md](03-marco-teorico.md) §6) apunta a causas de **cultura y tiempo**, no de falta de plantilla.
- *Aplicación aquí:* [`07-lecciones-aprendidas.md`](07-lecciones-aprendidas.md) usa un formato **no punitivo** (qué pasó, causa, qué cambió) y cada lección enlaza el cambio concreto que produjo, para poder comprobar que fue aplicada.

### 1.8 Gestión documental en Colombia
- La Ley 594 de 2000 obliga a las entidades públicas a un **Programa de Gestión Documental** (art. 21) y aplica sin importar el soporte; el Decreto 1080 de 2015 lo exige a las entidades del Estado. **N2** (no se leyó el texto oficial).
- *Aplicación aquí:* se registra como pendiente M-3. Esta memoria **no** es un programa de gestión documental; es documentación de proyecto.

## 2. Diagnóstico del estado documental del repositorio (antes de esta memoria)

Evaluación al 14 de octubre de 2026 contra las prácticas anteriores.

| Práctica | Estado | Evidencia |
| --- | --- | --- |
| Documento raíz único y fechado | Cumple | `ESPECIFICACION.md` v3.0 con historial de cambios |
| Supuestos y decisiones registrados | Cumple parcialmente | Sección 14 de la especificación y `docs/SUPUESTOS.md`, pero sin fecha ni motivo por decisión, ni enlace a los cambios de código |
| Auditoría registrada | Cumple | `docs/AUDITORIA.md`, cubierta por `pruebas-sql/t-auditoria.mjs` |
| Historial de cambios por versión | Faltaba | Solo el historial del documento de especificación y el registro de commits |
| Historia del desarrollo y sus incidentes | Faltaba | Solo en la conversación de la sesión |
| Trazabilidad requisito → módulo → migración → prueba | Parcial | Sección 15 de la especificación mapea hojas del libro a módulos; no llegaba a migración ni prueba |
| Registro de lecciones del propio proyecto | Faltaba | — |
| Coherencia entre documentos | **Falla detectada** | El README decía «v2.0», «404 comprobaciones» y «migraciones 0001–0015»; la realidad es v3.0, 494 y 0001–0022. Se corrigió en este mismo trabajo |
| Verificación de fuentes | Parcial | Columna «Verificación» en la sección 2 de la especificación; varias referencias «no re-verificadas» |

## 3. Brechas abiertas

| ID | Brecha | Propuesta |
| --- | --- | --- |
| G-1 | No hay enlace automático entre una decisión y el commit que la implementó | Mantener a mano la columna «Commit» de las fichas de decisión; evaluar convención de mensajes de commit con número de decisión |
| G-2 | El registro de lecciones de la plataforma (módulo H) no tiene ciclo de aplicación | Definir en el piloto si cada lección tiene responsable y fecha de revisión (requiere decisión del usuario) |
| G-3 | Bitácora de sesiones solo reconstruida a partir de una conversación | Desde ahora, plantilla de sesión ([`plantillas/sesion.md`](plantillas/sesion.md)) al cierre de cada jornada |
| G-4 | Las conversaciones anteriores (donde nació el libro y la especificación v1) no son accesibles | El propietario puede exportarlas o resumirlas en [`02-historia.md`](02-historia.md) fase 0 |
| G-5 | No hay tutorial de inicio para un usuario nuevo del repositorio | Evaluar tras el piloto |
| G-6 | No hay vista de arquitectura documentada (contexto, contenedores, despliegue) | Evaluar arc42 o diagrama simple cuando el sistema deba entregarse a otro equipo |
| G-7 | Documentación sobre el entorno de producción (cuentas, variables, responsables) no existe más allá del README | Definir con TI antes de usar datos reales (ver pendientes P12–P14 de la especificación) |

## 4. Reglas que adopta este repositorio

1. **No inventar.** Todo dato lleva fecha, fuente o la marca «no verificado».
2. **Una decisión, una ficha.** Con contexto, alternativas, consecuencias, fecha y quién decidió.
3. **Lo reemplazado no se borra.** Se marca como «Reemplazada por…».
4. **Un hecho, un lugar.** La memoria resume y enlaza; el detalle técnico vive en `ESPECIFICACION.md`, `docs/SUPUESTOS.md` y `docs/AUDITORIA.md`.
5. **Se actualiza con el trabajo, no después.** Ver disparadores en [09-gobierno-de-la-memoria.md](09-gobierno-de-la-memoria.md).
6. **Nada sensible.** Sin contraseñas, claves, identificadores de proyecto de Supabase ni datos reales de clientes.
