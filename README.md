# Plataforma de Obra (GreenLand)

Plataforma web para gerentes de obra: control financiero, gestión de obra y archivos.
La especificación completa está en `ESPECIFICACION.md` (documento de referencia) y se
construye por hitos.

## Estado

**Hito 1 (Cimientos):** inicio de sesión, proyectos, roles y acceso por proyecto.

- `supabase/migrations/`: archivos SQL que se ejecutan, en orden, en el SQL Editor de Supabase.
- `src/`: aplicación (Next.js, TypeScript, Tailwind), con el estilo del sistema de diseño GreenLand.

## Configuración

Hacen falta dos variables (ver `.env.example`). Nunca subas claves al repositorio y nunca
uses la clave secreta (`service_role`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Comandos

```
npm ci           # instalar dependencias
npm run dev      # servidor de desarrollo
npm run lint     # revisión de estilo
npm run build    # compilación de producción
```
