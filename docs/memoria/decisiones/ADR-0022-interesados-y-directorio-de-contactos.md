# ADR-0022 · Correo y teléfono en los interesados y directorio de contactos reutilizable

| Campo | Valor |
| --- | --- |
| Estado | Aceptada y vigente |
| Fecha | 2026-10-16 |
| Quién decidió | Usuario (petición del 16 de octubre); el diseño lo propuso Claude y el usuario no pidió cambios |

## Contexto
Al revisar el registro de interesados, el usuario pidió agregar correo electrónico y teléfono, guardarlos en la base de datos y poder reutilizar el registro para agilizar el llenado en proyectos siguientes. Hasta entonces el interesado solo tenía nombre, rol, poder, interés, necesidades y canal, y cada proyecto lo escribía de nuevo.

## Alternativas consideradas
- **Solo agregar las dos columnas** (sin directorio): no reutiliza nada; descartada porque no cumple lo pedido.
- **Copiar interesados de un proyecto a otro** (botón «copiar de…»): obliga a saber de qué proyecto, y mezcla datos propios del proyecto (poder, interés, necesidades) con datos de la persona.
- **Directorio de contactos compartido** (elegida): separa los datos de la persona (nombre, rol, correo, teléfono) de los del proyecto.
- **Captura aparte del directorio** (sin vinculación automática): más control, pero más trabajo por persona; no elegida.

## Decisión
Tabla `contactos` y columnas `correo`, `telefono` y `contacto_id` en los interesados. Un disparador de base de datos vincula cada interesado guardado con su contacto y lo crea si no existe (por correo; sin correo, por nombre). Al agregar un interesado se puede elegir un contacto del directorio y se rellenan sus datos, que siguen siendo editables. Pantalla «Directorio de contactos» con búsqueda, alta y edición. Los permisos viven en la base de datos: lo usan administrador, director general, analista PMO y gerentes; solo el administrador elimina.

## Consecuencias
- Poder, interés, necesidades y canal siguen siendo de cada proyecto.
- El último dato guardado actualiza el contacto; los demás proyectos conservan los suyos.
- **El directorio contiene datos personales de terceros.** Con datos ficticios no hay problema; antes de datos reales hay que definir base legal, aviso y acceso con Jurídica (P33 de la especificación; normas no verificadas).
- Requiere pegar de nuevo `supabase/instalar_todo.sql` (migración 0023) y redesplegar.
- Dos personas distintas sin correo y con el mismo nombre se tratan como una sola; se evita agregando el correo.

## Evidencia
`supabase/migrations/0023_interesados_contactos.sql`; `pruebas-sql/t-contactos.mjs` (38 comprobaciones); `src/lib/contactos.ts` y su prueba; pantallas `src/app/(app)/directorio/`; `ESPECIFICACION.md` módulo C, §7, §8, §13.12, hito 23, S18 y P33.
