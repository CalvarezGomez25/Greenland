# ADR-0038 · Calendario y correo sin conexión a cuentas: archivo .ics y borradores

| Campo | Valor |
| --- | --- |
| Estado | **Vigente** |
| Fecha | 2026-11-04 |
| Quién decidió | Usuario: «avanza con integración con correo y calendario» (pendiente de la lista de RAIZ). El alcance es propuesta del asesor |
| Migración | Ninguna |

## Contexto
Lo que vence (actividades, cierres de propuestas, pólizas, documentos del contratista, compromisos, fines de contrato) hoy solo se ve dentro de la plataforma o en los avisos por correo. Se quería llevarlo al calendario de cada persona y poder escribir al contratista sin copiar datos a mano.

## Decisión
1. **Calendario sin conectarse a ninguna cuenta.** Página «Mi calendario» (`/calendario`, menú «Espacio de trabajo»): lista las fechas de la persona y permite **descargar un archivo .ics** (`/calendario/descargar`, solo con sesión) o **agregar un evento** a Google Calendar u Outlook con un enlace. Son eventos de día completo con recordatorio de un día antes e identificador fijo, así que reimportar el archivo actualiza los eventos en lugar de duplicarlos.
2. **Qué fechas.** Actividades suyas pendientes con fecha límite; y, de lo que su sesión le deja ver, cierres de propuestas (procesos en preparación, abierta o evaluación), vencimientos de pólizas activas, vencimiento de documentos del contratista (lo calcula la base), compromisos abiertos y fines de contrato (fecha fin vigente). Ventana: 30 días atrás a 365 adelante. La interventoría no recibe procesos porque la base no se los deja leer.
3. **Correo sin enviar nada desde la plataforma.** Borradores `mailto:` que se abren en el programa de correo de la persona: «Invitar por correo» en cada proceso (eliges aliados con correo; **van en copia oculta** para que los competidores no vean los correos de los demás; **no incluye el presupuesto de referencia**) y «Recordar por correo» en el contrato para pólizas que vencen en 60 días o menos o ya vencidas y para compromisos abiertos. Los cuerpos largos se recortan a 1.500 caracteres.
4. **Ayuda:** dos términos de glosario, una guía y íconos «?».

## Alternativas consideradas
- *Suscripción en vivo al calendario (enlace secreto por persona):* da fechas siempre al día, pero obliga a servir datos sin sesión con una clave por persona, a replicar fuera de la base las reglas de visibilidad y a decidir su rotación. Se deja como siguiente etapa si se quiere (requiere una tabla de claves hasheadas y una función de lectura con revisión de seguridad).
- *Conexión OAuth con Gmail, Outlook o Microsoft 365:* pediría permisos amplios sobre cuentas personales y de la empresa, y una revisión de seguridad que hoy no existe (P14). Descartada por ahora.
- *Enviar correos desde la plataforma (Resend):* ya existe para los avisos automáticos; para mensajes a contratistas se prefirió que cada persona revise y envíe desde su cuenta, con su firma y trazabilidad en su propio correo.

## Consecuencias
- No hay datos nuevos guardados ni cambios de base de datos: no hay que pegar nada en Supabase.
- El archivo .ics es una copia del momento de la descarga.
- Pendientes posibles: suscripción en vivo, registrar en la plataforma que se envió un recordatorio, y plantillas de correo editables.

## Evidencia
`src/lib/calendario/{ics,eventos}.ts`, `src/lib/correo/borradores.ts`, `src/app/(app)/calendario/`, pruebas `ics.test.ts` (6), `eventos.test.ts` (4) y `borradores.test.ts` (7).
