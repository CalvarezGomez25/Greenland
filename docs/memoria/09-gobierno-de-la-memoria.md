# 09 · Gobierno de la memoria del proyecto

Cómo se mantiene esta memoria para que siga siendo cierta. Basado en las prácticas de [04-buenas-practicas-documentacion.md](04-buenas-practicas-documentacion.md).

## 1. Propósito y alcance

Dejar **trazabilidad** (por qué existe cada cosa y qué la prueba) y **la historia del desarrollo** de PMO360, de modo que una persona nueva —o el propio equipo dentro de un año— pueda entender qué se decidió, cuándo, por qué y con qué evidencia. No reemplaza a `ESPECIFICACION.md` (qué es y qué hace la plataforma) ni al README (cómo se instala).

## 2. Roles

| Rol | Persona | Responsabilidad |
| --- | --- | --- |
| Propietario | Carlos (gerente de proyectos, usuario de la plataforma) | Aprueba el contenido; confirma decisiones; aporta lo que no está en el repositorio (conversaciones anteriores, el libro) |
| Redactor | Claude (asistente de programación) | Redacta y actualiza; no inventa; marca lo no verificado; no aprueba decisiones |
| Revisor técnico | Por definir (pendiente M-5) | Revisión independiente de la parte técnica antes de datos reales |

## 3. Disparadores de actualización (qué obliga a escribir)

| Evento | Qué se actualiza |
| --- | --- |
| El usuario toma una decisión | Ficha `ADR-####`; fila en [`decisiones/README.md`](decisiones/README.md); `ESPECIFICACION.md` §14 si aplica |
| Se agrega o cambia un módulo o migración | [`06-trazabilidad.md`](06-trazabilidad.md); [`CHANGELOG.md`](CHANGELOG.md); README si cambia la instalación |
| Ocurre un incidente o se descubre una falla | [`07-lecciones-aprendidas.md`](07-lecciones-aprendidas.md) (formato no punitivo) |
| Termina una jornada de trabajo | Bitácora de sesión con [`plantillas/sesion.md`](plantillas/sesion.md) en [`sesiones/`](sesiones/) (a partir de la siguiente sesión) |
| Cambia de versión la especificación | Revisar README, historia y CHANGELOG para que coincidan (lección L-8) |
| Se verifica o se cita una fuente | [`08-fuentes-y-verificacion.md`](08-fuentes-y-verificacion.md), con nivel N1–N3 |
| Termina el piloto de 90 días | Resultados y decisión (seguir, ajustar o parar) como ADR; actualizar el marco teórico con lo medido |

## 4. Lista de comprobación antes de dar por hecho un trabajo

1. ¿Las pruebas pasan (`npm run verificar`, `npm run test:sql`)? Anotar el resultado y la fecha.
2. ¿Se actualizó la memoria según la tabla de disparadores?
3. ¿Cada cifra tiene fuente, o está marcada como no verificada?
4. ¿Se separó lo que el **usuario decidió** de lo que **Claude supuso**?
5. ¿Hay secretos, claves, identificadores de proyecto de Supabase o datos reales en lo que se va a subir? Si sí, no se sube.
6. ¿Se hizo commit y push a la rama de trabajo? No se abre Pull Request sin pedido del usuario.

## 5. Acuerdo de trabajo vigente (extraído de la sesión)

| Desde | Acuerdo |
| --- | --- |
| 8 oct | Explicar cada paso en lenguaje sencillo y pedir confirmación antes de instalar o ejecutar algo |
| 8 oct | No pasar claves ni contraseñas por el chat; las claves las maneja el usuario |
| 8 oct | Solo datos ficticios hasta decidir región y confidencialidad |
| 10 oct | Claude trabaja de forma autónoma: construye, prueba, hace commit y push; solo le pide al usuario lo que no puede hacer (Supabase, Vercel) |
| Preferencias del usuario | Respuestas concisas y prácticas; resultados profesionales, bien estructurados y con investigación profunda; **no inventar; dar resultados verificables** |

## 6. Convenciones

- **Idioma:** español de Colombia; tuteo en la interfaz.
- **Nombres de archivo:** numerados (`01-`, `02-`…) para orden de lectura; decisiones `ADR-####-slug.md`.
- **Estados de decisión:** Propuesta, Aceptada y vigente, Obsoleta, Reemplazada por ADR-####. Nada se borra.
- **Fechas:** AAAA-MM-DD en tablas; «11 de octubre de 2026» en prosa. Las horas del registro están en UTC.
- **Enlaces:** relativos, para que funcionen en GitHub.
- **Niveles de verificación:** N1, N2, N3, NV (ver [08-fuentes-y-verificacion.md](08-fuentes-y-verificacion.md)).

## 7. Revisión periódica

- **Mensual** mientras haya desarrollo activo, y **al cierre de cada hito**: leer la memoria completa contra el repositorio (README, especificación, migraciones, pruebas) y corregir lo que no coincida.
- **Revisión anual** del marco teórico: confirmar si hay ediciones nuevas de PMBOK, ISO 21502, ISO 31000.

## 8. Pendientes de esta memoria

| ID | Pendiente | Quién |
| --- | --- | --- |
| M-1 | Actualizar referencias a la edición vigente del PMBOK (8.ª) | Redactor, con aprobación del propietario |
| M-2 | Leer en fuente primaria ISO 21502, ISO 31000, PMBOK 8 y Mendelow (1991) | Propietario o revisor (requiere acceso a las normas) |
| M-3 | Consulta jurídica o archivística sobre Ley 594 de 2000 | Propietario |
| M-4 | Investigar gestión de beneficios y de recursos si se amplía el alcance | Redactor |
| M-5 | Designar revisor técnico independiente | Propietario |
| M-6 | Aportar las conversaciones o resúmenes de la fase 0 (libro, especificación v1, prototipos) para completar la historia | Propietario |
| M-7 | Reemplazar los marcadores `[Tu nombre]` y `[por definir]` del material FARO | Propietario |
