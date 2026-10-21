# 01 · Resumen ejecutivo

**PMO360 · Control integral de Proyectos** es una plataforma web de gestión de proyectos de infraestructura (portafolio, valor ganado, cambios, riesgos, cronograma, contratos, bitácora, documentos, cierre e interventoría) que se construyó entre el **8 y el 12 de octubre de 2026** para GreenLand, a partir de un libro de plantillas de gestión de proyectos y de prototipos previos del propietario. Esta memoria registra cómo y por qué.

## En una página

| Tema | Estado al 17 de octubre de 2026 |
| --- | --- |
| Alcance construido | 11 hitos de la versión 2.0, más ampliaciones (instalación, auditoría, aprobación de contratos, marca y menú, alertas por correo, presupuesto sobre la EDT, riesgos ampliados e importación, informe gerencial, directorio de contactos, **Actividades y «Mi trabajo» con tablero Kanban**, exportaciones con la identidad de la marca e inicio por rol) |
| Código | 62 commits, 24 migraciones, 18 suites de pruebas de base de datos |
| Verificación **hoy** | 328 pruebas unitarias correctas; 586 comprobaciones de base de datos correctas (17 de octubre de 2026) (PostgreSQL real en memoria) |
| Producción | Instalada por el propietario con **datos ficticios**; confirmó que funciona |
| **No ha ocurrido** | Ningún correo se ha enviado en producción; no hay datos reales; no hay revisión de seguridad independiente; no hay medición de ahorro de tiempo |
| Marco de adopción | FARO: piloto de 90 días con 3–4 de los 12 proyectos; sin cifras de ahorro porque no existen |
| Documento raíz | `ESPECIFICACION.md` v3.4.0 |

## Cinco hechos que explican el proyecto

1. **Nació del libro.** Las hojas del libro (acta, interesados, EDT, riesgos, cambios, reporte semanal, KPI y valor ganado, dashboard) son la columna vertebral. La sección 15 de la especificación las mapea a módulos.
2. **Lo hizo un gerente que no programa, con un asistente.** Hasta el 9 de octubre el trabajo fue guiado paso a paso; el 10 de octubre pasó a modo autónomo con el usuario limitado a Supabase y Vercel.
3. **La parte más cara fue la instalación, no el código.** Un día de configuración y cuatro despliegues fallidos dieron origen al instalador SQL único ([ADR-0008](decisiones/ADR-0008-instalador-sql-unico.md)).
4. **La seguridad se pone en la base de datos.** Una auditoría halló 1 falla crítica y 7 altas; se corrigieron y se probaron ([ADR-0004](decisiones/ADR-0004-reglas-de-acceso-en-la-base.md)).
5. **Se declara lo que no se sabe.** Sin datos reales, sin envío real de correos, sin cifras de ahorro, sin revisión externa de seguridad.

## Qué sigue (de la especificación y de esta memoria)

| Quién | Qué |
| --- | --- |
| Propietario | Pegar el último `supabase/instalar_todo.sql` en el Editor SQL y redesplegar; configurar las variables de correo y el usuario Analista PMO; crear un usuario Director general; decidir región y confidencialidad; reemplazar marcadores del material FARO |
| Propietario | Aportar las conversaciones o resúmenes de la fase 0 (libro, especificación inicial); designar revisor técnico |
| Ambos | Definir criterios de éxito del piloto y preparar el piloto |
| Claude | Resolver pendientes P5–P24 de la especificación según prioridad del usuario; mantener esta memoria |

## Cómo leer esta memoria

| Si quieres… | Lee |
| --- | --- |
| Entender cómo se construyó, en orden | [02-historia.md](02-historia.md) |
| Saber en qué teoría se apoya | [03-marco-teorico.md](03-marco-teorico.md) |
| Saber cómo se documenta y por qué | [04-buenas-practicas-documentacion.md](04-buenas-practicas-documentacion.md) |
| Ver por qué se decidió algo | [decisiones/](decisiones/README.md) |
| Rastrear una función hasta su prueba | [06-trazabilidad.md](06-trazabilidad.md) |
| Evitar repetir errores | [07-lecciones-aprendidas.md](07-lecciones-aprendidas.md) |
| Comprobar una fuente | [08-fuentes-y-verificacion.md](08-fuentes-y-verificacion.md) |
| Mantenerla al día | [09-gobierno-de-la-memoria.md](09-gobierno-de-la-memoria.md) |
