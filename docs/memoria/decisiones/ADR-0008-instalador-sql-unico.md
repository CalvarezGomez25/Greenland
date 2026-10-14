# ADR-0008 · Instalador SQL único e idempotente en lugar de migraciones desde el despliegue

| Campo | Valor |
| --- | --- |
| Estado | Aceptada y vigente |
| Fecha | 2026-10-10 |
| Quién decidió | Claude, tras la falla repetida de la conexión; el usuario lo ejecutó y confirmó |

## Contexto
El 9 de octubre faltaban tablas en el Supabase real y el usuario perdió un día. El 10 de octubre el despliegue en Vercel falló cuatro veces con `password authentication failed for user "postgres" (28P01)` al intentar migrar con `DATABASE_URL`. La causa no se pudo determinar.

## Alternativas consideradas
(a) Migrar en cada despliegue con `DATABASE_URL` (se construyó, `scripts/migrar.mjs`, commit `b3bbb5d`, y falló); (b) rehacer en otra plataforma (descartado, ver [ADR-0002](ADR-0002-pila-tecnologica.md)); (c) usar otra herramienta de migraciones: no evaluada.

## Decisión
Un archivo `supabase/instalar_todo.sql` que reúne todas las migraciones, se puede ejecutar varias veces, reconoce una base antigua y solo agrega lo que falta. Se regenera con `npm run generar:instalador`. El despliegue ya no se detiene si no hay conexión; con `MIGRAR_ESTRICTO=1` vuelve a detenerse.

## Consecuencias
El usuario debe pegar el instalador completo en el Editor SQL cada vez que haya migraciones nuevas, antes de redesplegar. Pegarlo desde un celular puede fallar (el archivo pesaba unos 287 KB con 15 migraciones). `instalar_hito2.sql` queda como respaldo histórico. La causa raíz de 28P01 sigue sin determinar.

## Evidencia
Commits `83240d0`, `b3bbb5d`, `1b0fcb4`, `804855f`; `pruebas-sql/t-instalador.mjs` y `t-migraciones.mjs`.
