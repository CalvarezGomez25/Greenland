# ADR-0023 · Actividades y «Mi trabajo»: un mínimo de trabajo colaborativo dentro de PMO360

| Campo | Valor |
| --- | --- |
| Estado | Aceptada y vigente (versión mínima; sujeta a validación en el piloto) |
| Fecha | 2026-10-16 |
| Quién decidió | Usuario (conversación del 16 de octubre): pidió explorar un gestor de trabajo tipo Trello, Asana o ClickUp y, tras el análisis, aprobó construir «un mínimo» para gerencia, analistas e interventoría |

## Contexto
PMO360 registraba y controlaba el proyecto, pero no había dónde repartir y seguir el trabajo diario: el responsable de la EDT y de los riesgos es texto libre y las «tareas» del cronograma tienen peso y alimentan el valor ganado, no se asignan a personas. El usuario aclaró que **la organización no usa hoy ninguna herramienta como Trello, Asana o ClickUp**: cada persona gestiona su información a su manera, sin una herramienta común que pueda socializarse.

## Alternativas consideradas
- **A. Integrar una herramienta externa** (Asana, ClickUp, Trello): duplica la captura, saca datos y permisos de la base y exige licencias; además la organización no tiene ninguna en uso, así que no hay nada que integrar. Descartada.
- **B. Módulo propio dentro de PMO360** (elegida): una sola fuente de verdad, los mismos permisos y la misma auditoría, y conexión con riesgos y EDT, que es lo que las herramientas genéricas no ofrecen.
- **C. Reencuadrar toda la plataforma como gestor colaborativo**: reescritura grande, pérdida del foco gerencial y comparación directa con productos maduros. Descartada.
- **Alcance:** versión completa (comentarios, adjuntos, notificaciones, plantillas) frente a un mínimo. Se eligió el mínimo para comprobar la adopción antes de invertir más.

## Decisión
Tabla `actividades` (migración 0024) con título, detalle, responsable (persona con cuenta, opcional), fecha límite, prioridad (alta, media, baja), estado (por hacer, en curso, bloqueada, hecha) y ligas opcionales a un riesgo y a un elemento de la EDT. Dos pantallas:
- **Actividades** de cada proyecto: tablero de cuatro columnas, filtro «Solo las mías», alta y edición con el formulario genérico.
- **Mi trabajo** (menú lateral): lo pendiente de la persona en todos sus proyectos, agrupado en vencidas, próximos 7 días, más adelante y sin fecha.

Permisos en la base de datos: ven quienes ya ven el proyecto; crean, editan y borran administrador, gerente del proyecto, director general y analista PMO; **la persona responsable solo cambia el estado**; la interventoría ve solo lo que le asignaron o creó, se asigna únicamente a sí misma y no liga riesgos (que no ve). Las actividades **no** son las tareas del cronograma: no tienen peso ni mueven el valor ganado.

## Consecuencias
- Quedan fuera a propósito: comentarios, adjuntos, menciones, notificaciones dentro de la plataforma o por correo, arrastrar tarjetas, tareas recurrentes, plantillas y la liga a cambios e hitos. Son la fase siguiente, **solo si el piloto muestra uso real**.
- Supervisor, patrocinador, consulta y finanzas ven el tablero pero no crean; el supervisor responsable puede mover sus actividades.
- Nada alimenta aún el semáforo ni el resumen diario: una actividad vencida se ve en el tablero y en «Mi trabajo», pero no genera aviso.
- Riesgo de adopción: un tablero que nadie actualiza da una falsa sensación de control. Se mide en el piloto (ver P34 de la especificación).
- Requiere pegar de nuevo `supabase/instalar_todo.sql` (migración 0024) y redesplegar.

## Evidencia
`supabase/migrations/0024_actividades.sql`; `pruebas-sql/t-actividades.mjs` (54 comprobaciones); `src/lib/actividades.ts` y su prueba (7); pantallas `src/app/(app)/proyectos/[id]/actividades/` y `src/app/(app)/mi-trabajo/`; `ESPECIFICACION.md` módulo R, §7, §8, hito 24, S19 y P34.
