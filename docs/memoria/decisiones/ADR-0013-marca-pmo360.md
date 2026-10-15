# ADR-0013 · Marca: PMO360 · Control integral de Proyectos

| Campo | Valor |
| --- | --- |
| Estado | Aceptada y vigente |
| Fecha | 2026-10-10 |
| Quién decidió | Usuario. La idea del nombre es suya (mensaje de las 20:10 UTC) y la decisión final es del mensaje de las 20:43 UTC |

## Contexto
La aplicación se llamaba «Plataforma de obra», nombre heredado del prototipo y de la primera especificación. El usuario lo consideró genérico y pidió un nombre más profesional y creativo para el inicio y el ingreso, «algo como PMO360». Antes ya existían las presentaciones «Plataforma PMO Greenland» (10 de octubre, 12:05 UTC). El historial completo está en `ESPECIFICACION.md` §1.2.

## Alternativas consideradas
Claude propuso cuatro el 10 de octubre a las 20:26 UTC, con el mensaje propuesto bajo el título:

| # | Nombre | Mensaje propuesto |
| --- | --- | --- |
| 1 | PMO360 (idea del usuario) | «Portafolio, obra e interventoría en una sola vista» |
| 2 | GreenLand PMO360 | El mismo (recomendada por Claude: aprovecha la idea y lleva la marca de la empresa) |
| 3 | Atalaya | «Torre de control de tus proyectos de obra» |
| 4 | Raíz PMO | «Cimientos firmes para cada proyecto» |

Claude advirtió que no verificó disponibilidad de marca ni de dominio y sugirió revisar el registro de marcas de la SIC.

## Decisión
Nombre **PMO360**, mensaje **«Control integral de Proyectos»**. El logo de GreenLand queda como imagen principal y no se repite en el nombre (el usuario descartó la opción 2 por esa razón).

## Consecuencias
- El nombre está centralizado en `src/lib/marca.ts`; se refleja en el ingreso, la pestaña del navegador («PMO360 · GreenLand»), los correos («[PMO360] …»), las propiedades de Excel y PDF y el README.
- El significado «360 = vuelta completa, sin puntos ciegos» se formuló el 11 de octubre al hilar el nombre con el marco FARO ([ADR-0019](ADR-0019-faro-y-piloto-de-90-dias.md)); el 10 de octubre el usuario no explicó el significado (**Supuesto**).
- **Pendiente:** la disponibilidad como marca y como dominio no está verificada (P32 de la especificación).

## Evidencia
Commit `63ac198` (2026-10-10 20:46 UTC); commit `0517e5b` (hilo con FARO); `ESPECIFICACION.md` §1.1, §1.2 y §17; registro de la sesión del 10 de octubre.
