# Plataforma de Obra (GreenLand)

Plataforma web de gestión de proyectos de construcción (PMO): portafolio, EVM, cambios, cronograma,
contratos, bitácora, documentos, cierre e interventoría. La especificación vigente es `ESPECIFICACION.md`
(v2.0); los supuestos y pendientes adoptados están en [`docs/SUPUESTOS.md`](docs/SUPUESTOS.md).

## Estado

Los 11 hitos están construidos. Verificación automática (`npm run verificar` + `npm run test:sql`):
tipos, estilo, pruebas unitarias, compilación de producción y 404 comprobaciones SQL sobre PostgreSQL real
(PGlite) que cubren permisos por rol (RLS), reglas de negocio y las migraciones.

## Puesta en marcha (una sola vez)

1. **Supabase**: crea el proyecto; en *Authentication → URL configuration* agrega la URL de Vercel.
2. **Vercel**: importa el repositorio y define estas variables de entorno:
   - `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase → *Project settings → API*).
   - `DATABASE_URL`: Supabase → *Connect → Session pooler*, con la contraseña de la base de datos.
     Con ella, **cada despliegue aplica solo las migraciones pendientes** (`scripts/migrar.mjs`); sin ella, o si la conexión falla, se omiten y el despliegue continúa (con `MIGRAR_ESTRICTO=1` se detiene).
   - **Alternativa sin contraseña:** pega `supabase/instalar_todo.sql` completo en Supabase → *SQL Editor* → *Run*. Es repetible y deja la base al día. Se regenera con `npm run generar:instalador`.
   - Nunca uses la clave `service_role`.
3. Despliega. Después, entra como administrador en `/usuarios`, asigna roles globales, y agrega
   miembros a cada proyecto. Revisa `/parametros` y `/festivos` (calendario de festivos de Colombia, cada año).

## Comandos

```
npm ci              # instalar dependencias
npm run dev         # servidor de desarrollo
npm run verificar   # tsc + eslint + pruebas unitarias + build
npm run test:sql    # pruebas SQL (migraciones, RLS y reglas) con PGlite
npm run migrar      # aplicar migraciones a DATABASE_URL (también corre en cada build)
```

## Estructura

- `supabase/migrations/`: migraciones numeradas (0001–0015); `supabase/instalar_hito2.sql` es un instalador idempotente de respaldo.
- `src/lib/`: reglas de negocio puras (EVM, semáforo, cambios, contratos, festivos, interventoría) con pruebas.
- `src/app/(app)/`: pantallas; `src/lib/exportar/`: Excel y PDF.
- `pruebas-sql/`: suites SQL por hito.

Las escrituras pasan por funciones SQL (SECURITY DEFINER) con permisos mínimos; las lecturas, por RLS.
