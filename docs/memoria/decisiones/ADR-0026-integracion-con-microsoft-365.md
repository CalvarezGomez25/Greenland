# ADR-0026 · Explorar la integración con Microsoft 365 (Teams y Planner) en lugar de un gestor propio

| Campo | Valor |
| --- | --- |
| Estado | Propuesta (exploración; no se ha construido nada) |
| Fecha | 2026-10-16 |
| Quién decidió | Usuario: pidió explorar un gestor tipo Trello, Asana o ClickUp, aceptó construir solo un mínimo propio y planteó usar la licencia corporativa de Microsoft; pidió la guía para TI. «Luego miramos cómo se hace la integración» |

## Contexto
La organización no usa ninguna herramienta común de tareas (dato del usuario). Tiene licencia corporativa de Microsoft; el plan exacto **no está confirmado** (el usuario lo confirmará). El módulo propio «Actividades» ([ADR-0023](ADR-0023-actividades-y-mi-trabajo.md)) es un mínimo para probar la adopción.

## Alternativas consideradas
- **Herramienta externa (Asana, ClickUp, Trello):** nadie la usa y exige licencias nuevas.
- **Gestor propio dentro de PMO360:** existe como mínimo (ADR-0023); obliga a mantener un producto de tareas.
- **Microsoft 365 como capa de trabajo y PMO360 como capa de control** (recomendada por Claude, sin construir): Planner dentro de Teams; PMO360 lee las tareas por Microsoft Graph, solo lectura.
- **Llevar PMO360 a Power Platform:** no recomendada (opinión de Claude, sin prueba).

## Decisión
Ninguna definitiva. Se acordó preparar la **guía para TI** ([documento](https://claude.ai/code/artifact/13eee31a-c754-4ef9-8904-86c5ded90492)) y hacer una prueba con un solo proyecto antes de integrar. Se mantiene «Actividades» como mínimo vigente.

## Consecuencias
- Pendiente del usuario: confirmar el plan de Microsoft 365. Pendiente de TI: cinco preguntas (plan, invitados externos para la interventoría, quién crea equipos, registro de aplicación en Entra ID, Power Automate).
- Límite conocido: la API de Graph solo accede a planes básicos de Planner (no a los premium).
- Casi todo lo citado de Microsoft salió de resultados de búsqueda, no de las páginas ([08-fuentes-y-verificacion.md](../08-fuentes-y-verificacion.md); pendiente M-8).
- Si se confirma, habrá que decidir cómo se liga Planner con PMO360 y revisar P34 (adopción).

## Evidencia
Guía para TI (documento); `ESPECIFICACION.md` P34; conversación del 16 y 17 de octubre de 2026.
