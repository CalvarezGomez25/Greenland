# ADR-0001 · Construir en el repositorio Greenland, en la nube

| Campo | Valor |
| --- | --- |
| Estado | Aceptada y vigente |
| Fecha | 2026-10-08 |
| Quién decidió | Usuario (respuesta 1 a las dudas del hito 1) |

## Contexto
La especificación original pedía trabajar en una carpeta local `plataforma-obra`. La sesión corre en la nube y ya tenía conectado el repositorio `calvarezgomez25/greenland`, vacío.

## Alternativas consideradas
Carpeta local en el computador del usuario (obligaría a instalar Node y Git).

## Decisión
Construir en el repositorio Greenland, rama `claude/especificacion-project-manager-495kj0`, con commit y push por tarea y sin abrir Pull Request salvo que el usuario lo pida.

## Consecuencias
El usuario no instala nada para empezar. Todo el historial queda en GitHub. La rama de trabajo concentra más de 50 commits; no hay revisión por Pull Request.

## Evidencia
Primer commit `81dd76b` (8 oct 2026).
