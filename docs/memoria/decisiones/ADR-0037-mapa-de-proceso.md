# ADR-0037 · Mapa de proceso de PMO360 como página de la plataforma

| Campo | Valor |
| --- | --- |
| Estado | **Vigente** |
| Fecha | 2026-11-04 |
| Quién decidió | Usuario: «quiero un mapa de proceso de todo PMO360» para el equipo de la oficina de proyectos y para el propio usuario; interactivo y en lámina para imprimir; sin FARO; con roles y poder de decisión; sistema de diseño GreenLand de la plataforma. Aprobó carriles para la lámina completa y metro para la resumida, y pidió llevarlo al menú |

## Decisión
1. **Contenido.** Seis etapas (Inicio, Planeación, Contratación, Ejecución, Seguimiento y control, Cierre), cinco paquetes de trabajo como carriles, 26 módulos, 22 flujos de datos, 9 puntos de decisión y 9 roles. Todo sale de la especificación (secciones 5 y 8) y de lo construido; no se agregó ninguna función que no exista.
2. **Estilos.** Matriz de carriles y mapa de metro, con opción de compararlos. En la matriz se combinaron las franjas verticales de etapa del metro: un velo gris neutro muy leve que baja desde cada etapa y que no altera el color de los carriles; las marcas de etapa del borde de cada carril se redujeron (nombre completo solo en el primer carril, número en los demás) porque saturaban y eran redundantes.
3. **Detalle.** Completo (26 módulos) y resumido (18 esenciales, con Balance de costos); la versión resumida no lleva franjas verticales.
4. **Dónde vive.** Página `/mapa-proceso` en el menú izquierdo, visible para todos los roles (no muestra datos de proyectos), con enlace desde Ayuda. Los datos y la geometría son módulos de TypeScript con pruebas; la página es un componente de cliente. Las cuatro láminas PDF (A2 las completas y A3 las resumidas) se sirven desde `public/mapa-proceso/` y solo con sesión iniciada, porque el proxy de autenticación las cubre.
5. **Lectura honesta.** La etapa en que está cada módulo es una guía de uso: la plataforma permite registrar en cualquier momento lo que el rol permite.

## Alternativas consideradas
- *Dejarlo solo como artefacto externo:* descartado; el usuario pidió llevarlo a la plataforma y así la explicación vive junto a los módulos que describe.
- *Incrustar el HTML del artefacto en un `iframe`:* descartado; no se prueba, no sigue el tema de la plataforma y duplica la fuente de datos.
- *Tema oscuro en la página:* no aplica; la plataforma no tiene modo oscuro. El artefacto externo sí sigue el tema del dispositivo y tiene un selector.
- *Panel de detalle como cajón flotante:* descartado; tapaba las últimas etapas del mapa. Se mantuvo la columna lateral y se ajustó el ancho del lienzo.

## Consecuencias
- Si se agrega un módulo al menú del proyecto, una prueba falla hasta que se le dé su pieza en el mapa (`mapa.test.ts`).
- Si cambian los permisos o las decisiones, hay que ajustar `datos.ts` y regenerar las láminas desde `docs/mapa-proceso/mapa-proceso.html` (el artefacto, que sigue siendo la fuente de las láminas).
- Pendiente: sincronizar el artefacto y `datos.ts` si evolucionan por separado; hoy el artefacto es copia del mismo contenido.

## Evidencia
`src/lib/mapa/{datos,geometria}.ts`, `src/lib/mapa/mapa.test.ts`, `src/app/(app)/mapa-proceso/`, `docs/mapa-proceso/`, `public/mapa-proceso/`.
