# Registro de decisiones (ADR)

Una ficha por decisión importante, con el formato propuesto por Michael Nygard en 2011 (contexto, decisión, estado, consecuencias), ampliado con alternativas y evidencia. Las decisiones reemplazadas **no se borran**: pasan a «Reemplazada por ADR-####». Plantilla en [`../plantillas/adr.md`](../plantillas/adr.md).

**Origen de las fichas.** Las ADR-0001 a ADR-0021 se redactaron el 14 de octubre de 2026 a partir del historial de la sesión y de `ESPECIFICACION.md` §14; no se escribieron en el momento de cada decisión. Donde la sesión no conserva el detalle de las alternativas, la ficha lo dice.

| Ficha | Decisión | Fecha | Estado |
| --- | --- | --- | --- |
| [ADR-0001](ADR-0001-construir-en-el-repositorio-greenland.md) | Construir en el repositorio Greenland, en la nube | 2026-10-08 | Vigente |
| [ADR-0002](ADR-0002-pila-tecnologica.md) | Pila tecnológica: Next.js, Supabase, Vercel y GitHub | 2026-10-08 | Vigente |
| [ADR-0003](ADR-0003-acceso-por-invitacion-y-roles-globales.md) | Acceso por correo y contraseña, solo por invitación; Administrador y Director globales | 2026-10-08 | Vigente |
| [ADR-0004](ADR-0004-reglas-de-acceso-en-la-base.md) | Las reglas de acceso viven en la base de datos | 2026-10-08 | Vigente |
| [ADR-0005](ADR-0005-datos-ficticios-hasta-decidir-region.md) | Solo datos ficticios hasta decidir región y confidencialidad | 2026-10-08 | Vigente |
| [ADR-0006](ADR-0006-presupuesto-gerencial-por-capitulos.md) | Presupuesto gerencial por capítulos, de un solo nivel | 2026-10-08 | Vigente |
| [ADR-0007](ADR-0007-control-de-cambios-formal-por-niveles.md) | Control de cambios formal, con niveles y aprobación por nivel | 2026-10-08 | Vigente |
| [ADR-0008](ADR-0008-instalador-sql-unico.md) | Instalador SQL único e idempotente en lugar de migraciones desde el despliegue | 2026-10-10 | Vigente |
| [ADR-0009](ADR-0009-semaforo-peor-de-cuatro.md) | El semáforo del proyecto es el peor de cuatro dimensiones | 2026-10-10 | Vigente |
| [ADR-0010](ADR-0010-anticipo-discrecional-tope-20.md) | Anticipo discrecional del director, con tope de 20 % | 2026-10-10 | Vigente |
| [ADR-0011](ADR-0011-interventoria-sin-presupuesto.md) | Interventoría: rol por contrato, sin presupuesto, sin contratar | 2026-10-09 | Vigente |
| [ADR-0012](ADR-0012-director-aprueba-contratos-nuevos.md) | El director general aprueba cada contrato nuevo | 2026-10-10 | Vigente |
| [ADR-0013](ADR-0013-marca-pmo360.md) | Marca: PMO360 · Control integral de Proyectos | 2026-10-10 | Vigente |
| [ADR-0014](ADR-0014-menu-lateral-ayuda-y-glosario.md) | Menú lateral, ayuda contextual y glosario | 2026-10-10 | Vigente |
| [ADR-0015](ADR-0015-presupuesto-sobre-la-edt.md) | El presupuesto puede construirse sobre la EDT, como vínculo opcional | 2026-10-11 | Vigente |
| [ADR-0016](ADR-0016-escala-de-riesgos-e-importacion.md) | Escala de riesgos e importación desde Excel | 2026-10-11 | Vigente |
| [ADR-0017](ADR-0017-correos-por-cron-con-usuario-de-solo-lectura.md) | Correos automáticos por tareas programadas con un usuario de solo lectura | 2026-10-10 | Vigente |
| [ADR-0018](ADR-0018-informe-gerencial-una-pagina.md) | Informe gerencial de una página, por proyecto y semanal | 2026-10-11 | Vigente |
| [ADR-0019](ADR-0019-faro-y-piloto-de-90-dias.md) | Marco FARO y piloto de 90 días | 2026-10-11 | Vigente |
| [ADR-0020](ADR-0020-tablero-del-proyecto.md) | Tablero del proyecto: gráfico de avance y resumen de control | 2026-10-12 | Vigente |
| [ADR-0021](ADR-0021-festivos-automaticos.md) | Festivos de Colombia calculados automáticamente | 2026-10-10 | Vigente |

Las decisiones de detalle (supuestos S1–S13, P1–P11, D2, etc.) siguen en `docs/SUPUESTOS.md` y en la sección 14 de `ESPECIFICACION.md`.
