# ADR-0014 · Menú lateral, ayuda contextual y glosario

| Campo | Valor |
| --- | --- |
| Estado | Aceptada y vigente |
| Fecha | 2026-10-10 |
| Quién decidió | Usuario (cuatro peticiones consecutivas) |

## Contexto
El usuario quería llegar rápido a cualquier proyecto y módulo, entender siglas e indicadores y ver siempre en qué proyecto está.

## Alternativas consideradas
Navegación superior sin selector de proyecto.

## Decisión
Menú lateral izquierdo con selector de proyecto y módulos desplegables (referencia visual: un sitio del propio usuario); títulos en español («Tablero de control» en vez de «dashboard»); anglicismos reemplazados; íconos «?» con explicación de siglas e instrucciones de diligenciamiento; glosario y guías con vínculo «Ver guía» en cada módulo; nombre del proyecto en todas las pantallas; cambio de usuario junto al nombre; proyectos ordenados por código.

## Consecuencias
Las guías deben mantenerse actualizadas con cada flujo nuevo (se actualizaron al cambiar el presupuesto y los riesgos).

## Evidencia
Commits `ca6370f`, `78f10d3`, `48f0997`, `3419da0`, `e991725`, `4207ce8`; `src/lib/guias.ts`.
