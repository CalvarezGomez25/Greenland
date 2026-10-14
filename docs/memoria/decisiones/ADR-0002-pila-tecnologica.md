# ADR-0002 · Pila tecnológica: Next.js, Supabase, Vercel y GitHub

| Campo | Valor |
| --- | --- |
| Estado | Aceptada y vigente |
| Fecha | 2026-10-08 |
| Quién decidió | Especificación §10; confirmada por el usuario al crear las cuentas |

## Contexto
La especificación proponía una aplicación web móvil primero con base de datos gestionada. El usuario es gerente de proyectos y no programa.

## Alternativas consideradas
Otras bases y servidores «más fáciles de configurar» (pedidas por el usuario el 9 de octubre tras un día de problemas de configuración). Claude argumentó que cualquiera exigiría el mismo paso de crear las tablas y optó por reducir ese paso a uno solo ([ADR-0008](ADR-0008-instalador-sql-unico.md)).

## Decisión
Next.js 16 con React 19, Tailwind 4 y TypeScript; Supabase (PostgreSQL, autenticación y archivos); Vercel (publicación); Vitest y PGlite para pruebas.

## Consecuencias
Vercel Hobby es de uso personal y no comercial (verificado vía búsqueda el 8 oct, N2): bloquea el uso comercial. Supabase gratuito se pausa tras una semana sin actividad. `npm audit` reporta 5 avisos altos en herramientas de desarrollo. Condiciones antes de datos reales: pendientes P12–P14 de la especificación.

## Evidencia
`package.json`, `docs/SUPUESTOS.md` (límites conocidos).
