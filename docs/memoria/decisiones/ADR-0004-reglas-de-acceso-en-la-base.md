# ADR-0004 · Las reglas de acceso viven en la base de datos

| Campo | Valor |
| --- | --- |
| Estado | Aceptada y vigente |
| Fecha | 2026-10-08 |
| Quién decidió | Claude propuso, el usuario aceptó |

## Contexto
Si el control de permisos está solo en las pantallas, alguien puede saltárselo con la API.

## Alternativas consideradas
Control solo en la aplicación.

## Decisión
Seguridad a nivel de fila (RLS) en todas las tablas. Las escrituras pasan por funciones SQL con permisos mínimos (`SECURITY DEFINER`); las lecturas, por RLS. Nadie cambia su propio rol global. Nadie borra proyectos desde la aplicación.

## Consecuencias
Mayor complejidad: cada regla de negocio se prueba con PostgreSQL real (PGlite, 494 comprobaciones). La auditoría de octubre halló fallos de esta capa (un cambio podía ligarse al contrato de otro proyecto; una función de BAC era ejecutable por cualquiera) y se corrigieron en la migración 0017. 47 tablas con RLS verificadas en la auditoría.

## Evidencia
`0001_cimientos.sql`, `0017_auditoria.sql`, `docs/AUDITORIA.md`, `pruebas-sql/t-auditoria.mjs`.
