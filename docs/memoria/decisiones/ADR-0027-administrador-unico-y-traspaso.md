# ADR-0027 · Administrador único, traspaso a TI y quién crea proyectos

| Campo | Valor |
| --- | --- |
| Estado | Aceptada en principio; **por construir** (hoy todo sigue igual) |
| Fecha | 2026-10-17 |
| Quién decidió | Usuario, en cuatro mensajes del 17 de octubre de 2026 |

## Contexto
Carlos es hoy el administrador de la plataforma, crea los proyectos y arma los equipos. Más adelante habrá un administrador de TI. La plataforma solo garantiza «al menos un administrador» (migración 0017) y permite varios.

## Alternativas consideradas
- Dos administradores a la vez: **rechazada por el usuario**.
- Un rol nuevo «solo administración» para que TI no vea datos de proyectos: **no se decidió**; se deja ligado a P12–P14 (confidencialidad y datos reales).
- Quién crea proyectos tras el traspaso: TI por solicitud, o ampliar permisos a un rol de la PMO. El usuario eligió la segunda con el director general.

## Decisión
1. **Por ahora todo igual:** Carlos es administrador y crea los proyectos y los equipos.
2. **Siempre exactamente un administrador.** Al nombrar a otra persona administradora, la anterior deja de serlo automáticamente.
3. Al dejar de ser administrador, **Carlos pasa automáticamente a «Analista PMO»**: conserva el acceso al portafolio y sus roles de gerente por proyecto.
4. **Cuando el administrador sea el de TI, el director general de planificación y proyectos crea los proyectos y arma los equipos** (sin administrar usuarios ni parámetros).

## Consecuencias
- Falta construir: traspaso automático, confirmación contra cambios accidentales y permisos del director (alcance exacto por definir: crear proyectos, editar la ficha, asignar y quitar miembros, reabrir proyectos cerrados, y no asignar roles globales).
- Mientras tanto no conviene nombrar un segundo administrador.
- El administrador de TI vería los datos de todos los proyectos (rol de administrador actual).

## Evidencia
`ESPECIFICACION.md` P35 y P36 (§14); commits `4e85691`, `456700a`, `dd050a0`, `fd3c101`; migración `0017_auditoria.sql` (regla «al menos un administrador»).
