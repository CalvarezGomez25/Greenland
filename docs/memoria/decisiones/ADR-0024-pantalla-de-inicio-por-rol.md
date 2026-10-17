# ADR-0024 · Pantalla de inicio por rol: «Mi trabajo» para quien no ve todo el portafolio

| Campo | Valor |
| --- | --- |
| Estado | Aceptada y vigente |
| Fecha | 2026-10-17 |
| Quién decidió | Usuario (petición del 17 de octubre): que quienes no ven el tablero general entren a «Mi trabajo». La decisión sobre la interventoría la delegó en Claude («decide de acuerdo al rol de la interventoría») |

## Contexto
Hasta entonces la primera pantalla de todos era el tablero de control. Para quien no tiene rol global era un tablero limitado a sus proyectos, y la interventoría veía una lista de proyectos. El usuario pidió que esas personas tengan sus actividades pendientes «a primera vista» y desde ahí entren a sus proyectos.

## Alternativas consideradas
- **Redirigir `/` sin conservar nada:** se perdería el tablero limitado a los proyectos de gerentes y supervisores (con «Requiere decisión» y exportaciones). Descartada.
- **Redirigir solo al iniciar sesión:** quien abre la dirección base con la sesión abierta seguiría viendo el tablero. Descartada.
- **Redirigir `/` y conservar el tablero limitado en `/tablero`** (elegida).
- **Interventoría:** mantener su tablero (`/tablero`) o quitarlo. Se verificó que mostraba la misma lista que «Mis proyectos» de «Mi trabajo» y que la especificación (§3) dice que la interventoría no entra por el portafolio.

## Decisión
- Quien tiene rol global (administrador, director general, analista PMO y finanzas) entra al tablero de control (`/`). Las demás personas entran a «Mi trabajo» (`/mi-trabajo`), con su tablero de actividades y, debajo, «Mis proyectos».
- El tablero limitado a sus proyectos queda en `/tablero` («Tablero de mis proyectos» en el menú); quien ve todo el portafolio que entre ahí vuelve a `/`.
- **Interventoría** (sin rol global y con todas sus asignaciones como interventoría): sin tablero propio; el enlace del menú desaparece y `/tablero` la lleva a «Mi trabajo». Quien es interventoría en un proyecto y gerente en otro conserva el tablero propio.
- «Mis proyectos» lista aquellos donde la persona está asignada; con rol global se muestra solo si hay asignaciones (corrección del 17 de octubre tras un caso real: un administrador asignado a dos proyectos no veía la lista; ver L-14).

## Consecuencias
- Para ver «Mis proyectos» la persona debe figurar como miembro del proyecto; ser administrador no basta.
- Los enlaces «Volver al portafolio» apuntan al tablero que corresponde a cada rol.
- No verificado con el Supabase real del usuario: se probó en un navegador real con un Supabase simulado (administrador, administrador con proyectos, gerente e interventoría).

## Evidencia
`src/lib/navegacion.ts` (`rutaDeInicio`, `rutaDelTablero`, `esSoloInterventoria`, `mostrarMisProyectos`) y `navegacion.test.ts`; `src/app/(app)/page.tsx`, `tablero/page.tsx`, `mi-trabajo/page.tsx`; commits `00cb5b3`, `9186580`, `78b5aa8`; `ESPECIFICACION.md` §3.
