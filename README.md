# PMO360 · Control integral de Proyectos (GreenLand)

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

## Alertas por correo

Cuando una decisión queda pendiente, la plataforma avisa por correo al responsable:

- **Aviso inmediato:** cambio que pasa a «En aprobación» (menor → gerente; moderado o crítico → director general), contrato nuevo por aprobar (director) y reporte semanal enviado con decisiones requeridas (director).
- **Resumen diario (7:00 a. m. de Bogotá):** cada persona recibe solo lo suyo (el director, las decisiones de todos los proyectos; cada gerente, las de sus proyectos), mientras haya algo pendiente. Si no existe ningún usuario con rol Director general, las del director van a los administradores.
- Se apagan con el parámetro `alertas_correo_activas = no` (en `/parametros`). Sin proveedor de correo configurado, no se envía nada y todo lo demás funciona igual.

Configuración en Vercel (variables de entorno):

1. **Cómo se envía** (una de dos): Gmail → `SMTP_USUARIO` (el correo) y `SMTP_CLAVE` (una «contraseña de aplicación» de Google, no la contraseña normal); o Resend → `RESEND_API_KEY` y `CORREO_REMITENTE` (dirección de un dominio verificado en Resend).
2. `CRON_SECRET`: una clave larga inventada por ti. Vercel la envía sola al cron diario (`vercel.json`).
3. `ALERTAS_USUARIO` y `ALERTAS_CLAVE`: un usuario de solo lectura. Créalo en Supabase → Authentication → Users → Add user (correo y contraseña, «Auto Confirm User») y en `/usuarios` asígnale el rol **Analista PMO**. Así el resumen no necesita la clave secreta de Supabase.
4. Opcional: `URL_PUBLICA` (por defecto se usa la dirección de Vercel).

Prueba manual del resumen: `curl -H "Authorization: Bearer TU_CRON_SECRET" https://tu-plataforma.vercel.app/api/cron/alertas`.

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
