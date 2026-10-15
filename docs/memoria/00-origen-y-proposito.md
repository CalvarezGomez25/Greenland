# 00 · Origen y propósito de PMO360

Documento para **explicar** la plataforma: cómo nació, por qué, para qué, para quién y en qué se apoya. Cada afirmación indica su base: **[Hecho]** verificable en el repositorio o en la cuenta; **[Decisión]** tomada por el propietario; **[Hipótesis]** razonamiento que el propietario debe confirmar con su propia experiencia antes de presentarlo como cierto.

## 1. En una frase

PMO360 es una plataforma web donde la oficina de proyectos (PMO) de GreenLand ve en un solo lugar el estado, el costo, el plazo, los riesgos y los cambios de todos sus proyectos, sabe quién debe decidir qué y puede demostrar de dónde sale cada dato.

## 2. Cómo nació

| Momento | Qué pasó | Base |
| --- | --- | --- |
| Antes de octubre de 2026 | El propietario, gerente de proyectos, reunió un libro de plantillas en Excel (acta de constitución, interesados, EDT, riesgos, cambios, reporte semanal, KPI y valor ganado, semáforo) y una metodología propia de control de cambios | [Hecho] citado en `ESPECIFICACION.md` §0 y §15; el libro no está en el repositorio |
| Hasta el 8 de octubre | Armó prototipos de una sola página: uno de gestión (PM Infraestructura) y uno de obra (presupuesto con curva S, cronograma, bitácora, contratos). Guardaban los datos solo en el navegador, sin usuarios ni servidor | [Hecho] artifacts de la cuenta |
| 7–8 de octubre | Escribió la especificación técnica para llevarlo a una plataforma real con usuarios, roles y base de datos | [Hecho] documento del 7 oct; `ESPECIFICACION.md` |
| 8–12 de octubre | Se construyó con un asistente de programación, sin que el propietario programara; 11 hitos más ampliaciones | [Hecho] historial de Git; ver [02-historia.md](02-historia.md) |
| 10 de octubre | Recibió nombre y marca: **PMO360 · Control integral de Proyectos** | [Decisión] [ADR-0013](decisiones/ADR-0013-marca-pmo360.md) |
| 11 de octubre | Se creó el marco FARO para explicarla y proponer un piloto | [Decisión] [ADR-0019](decisiones/ADR-0019-faro-y-piloto-de-90-dias.md) |

En corto: **pasó de un libro de Excel y prototipos individuales a un sistema compartido, con usuarios, permisos y registro.**

## 3. Por qué: la necesidad

**Lo que se puede afirmar con evidencia**

- El universo actual es de **unos 12 proyectos** [Decisión/Hecho: dicho por el propietario el 11 oct]; la escala inicial de construcción fue de 6 proyectos y 6 usuarios.
- La información de gestión vivía en **hojas de Excel y prototipos locales** [Hecho]: el registro de riesgos de la Planta El Silencio llegó como un Excel con 41 riesgos, y la plataforma tuvo que aprender a importarlo.
- Una herramienta de un solo usuario **no sirve para aprobar, avisar ni dejar rastro** entre varias personas: por eso los roles, las aprobaciones por nivel y la auditoría son el núcleo de la versión 2.0 [Hecho] (§5 de la especificación).
- Lo que no se mide no se puede justificar: **no existen cifras de horas ahorradas ni evaluaciones previas** [Hecho: dicho por el propietario]. Por eso el piloto mide primero y no promete ahorros.

**Lo que es hipótesis y el propietario debe confirmar con casos propios**

Son los tres dolores sobre los que se armó FARO. Están formulados como escenas típicas, no como casos reales de GreenLand [Hecho: así lo declara la sección 17 de la especificación]:

1. **[Hipótesis]** Cada proyecto cuenta su propia versión del avance y la dirección decide con mapas distintos.
2. **[Hipótesis]** Hay decisiones (cambios, contratos) que esperan firma sin que nadie sepa en qué escritorio están.
3. **[Hipótesis]** Hay datos que no se pueden defender porque no tienen dueño ni historial.

> Para presentarlos como hechos de GreenLand, sustituye cada escena por un ejemplo real y no sensible que tú conozcas. Está pendiente (M-7 de [09-gobierno-de-la-memoria.md](09-gobierno-de-la-memoria.md)).

**Respaldo externo del problema general (no de GreenLand)**

- Informe GAO-02-195 (2002) sobre la NASA: las lecciones de los proyectos no se identificaban, recopilaban ni compartían de forma rutinaria; barreras: falta de tiempo y miedo al castigo por errores [N1, ver [08-fuentes-y-verificacion.md](08-fuentes-y-verificacion.md)].
- Duffield y Whitty: de 522 respuestas, solo 11,7 % seguía el proceso de lecciones aprendidas de su organización [N2].
- No se usan cifras de «proyectos exitosos» de PMI o Standish: son antiguas y correlacionales.

## 4. Para qué: el propósito

Objetivo declarado en la especificación [Hecho, §1]: *una sola herramienta para que la PMO controle el portafolio completo y baje, en pocos clics, hasta el detalle de un proyecto o de una obra.* Plataforma **gerencial, no de residencia de obra**.

| Propósito | Cómo lo cumple hoy [Hecho] |
| --- | --- |
| Ver el portafolio sin puntos ciegos | Tablero de control con semáforo calculado (el peor de plazo, costo, riesgos y cambios); «Sin datos» cuando no hay información |
| Decidir a tiempo | Panel «Requiere decisión»; correo a quien debe decidir (construido; **sin envío real todavía**) |
| Reportar sin rehacer | Informe gerencial de una página en PDF y Excel; envío semanal programado los lunes 7:30 a. m. (**sin envío real todavía**) |
| Poder defender el dato | Permisos por rol aplicados en la base; registro de auditoría; cambios con aprobación formal y línea base versionada; reportes firmados inmutables |
| Aprender entre proyectos | Cierre y lecciones aprendidas (hoy registra; falta el ciclo de aplicación, brecha G-2) |
| Operar con interventoría independiente | Rol por contrato que conceptúa y verifica sin ver el presupuesto |

## 5. Para quién

| Quién | Qué obtiene |
| --- | --- |
| **Director general de planificación y proyectos** | Todo el portafolio, las decisiones pendientes a su nombre (cambios moderados y críticos, anticipos, contratos nuevos) y el informe semanal |
| **Gerentes de proyecto** | Su proyecto en un lugar: acta, EDT, riesgos, presupuesto, cronograma, contratos, reportes; aprueban cambios menores |
| **Analista PMO y Finanzas** | Consolidación del portafolio, presupuesto, contratos y pagos |
| **Patrocinadores y consulta** | Lectura de sus proyectos; firma de cambios de más de 5 % |
| **Supervisores de obra** | Bitácora desde el celular con fotos permanentes y avance |
| **Interventoría** | Contratos asignados: conceptos, avance verificado, hallazgos e informes |
| **Junta y jefes** (audiencia de la presentación) | Un piloto acotado, con criterios definidos antes de empezar |

Roles completos en `ESPECIFICACION.md` §8. Escala de referencia: unos 12 proyectos.

## 6. Qué no es

- No es una herramienta de residencia de obra detallada [Decisión: [ADR-0006](decisiones/ADR-0006-presupuesto-gerencial-por-capitulos.md)].
- No reemplaza el criterio del gerente ni promete ahorros [Decisión: [ADR-0019](decisiones/ADR-0019-faro-y-piloto-de-90-dias.md)].
- No calcula impuestos, flujo de caja, reajustes por IPC ni pólizas (fuera de alcance de la v3.1).
- No está lista para datos reales: faltan región y confidencialidad, alojamiento apto para uso comercial y revisión de seguridad independiente (P12–P14).

## 7. Referencias que la sustentan

| Tema | Referencia | Verificación |
| --- | --- | --- |
| Principios y dominios de gestión | PMBOK Guide 8.ª edición (6 principios, 7 dominios); ISO 21502:2020; ISO 21500 | N1 / N2 |
| Valor ganado | Criterios C/SCSC (1967), ANSI/EIA-748 (1998) | N2 |
| Riesgos | ISO 31000:2018 | N2 |
| Estructura de alcance | EDT y regla del 100 % (PMI Practice Standard for WBS) | N1/N2 |
| Control de cambios y lecciones | PMBOK; prácticas PRINCE2 | N2 / N3 |
| Contexto colombiano | Ley 80 de 1993, Ley 1474 de 2011, Ley 51 de 1983, Ley 594 de 2000 | N2, textos no leídos |
| Documentación del propio proyecto | Fichas de decisión (Nygard), Diátaxis, Keep a Changelog, ISO 9001 §7.5 | N2 |
| Presentación | Principio de la Pirámide (Minto), MECE, estructura de Sandeep Swadia | N3 |

Detalle, enlaces y limitaciones: [03-marco-teorico.md](03-marco-teorico.md) y [08-fuentes-y-verificacion.md](08-fuentes-y-verificacion.md).

## 8. Cómo contarlo en tres minutos

1. **Origen (30 s).** «Partimos de un libro de Excel y prototipos míos. Lo convertimos en un sistema compartido, con usuarios, permisos y registro, en cinco días, con un asistente de programación.»
2. **Necesidad (45 s).** «Manejamos unos 12 proyectos. Hoy cada uno se reporta a su manera. Queremos ver el portafolio completo, saber quién debe decidir qué y poder defender cada número.» *(Reemplaza con un ejemplo real tuyo.)*
3. **Propósito (45 s).** «Una sola fuente, alertas a tiempo, respaldo del dato y una operación que aguante más proyectos: eso es FARO.»
4. **Para quién (30 s).** «Dirección, gerentes, finanzas, supervisores e interventoría, cada uno con lo suyo.»
5. **Honestidad (30 s).** «Probado con datos ficticios, 305 pruebas unitarias y 494 de base de datos correctas. Sin datos reales, sin correos enviados todavía y sin cifras de ahorro. Por eso pido un piloto de 90 días con 3 o 4 proyectos.»

## 9. Preguntas que te harán, con respuesta honesta

| Pregunta | Respuesta |
| --- | --- |
| ¿Cuánto ahorra? | No lo sabemos: no existe línea base. El piloto mide tiempo de informe, antigüedad de decisiones y datos incorrectos |
| ¿Es seguro? | Permisos aplicados en la base y auditoría interna con 1 falla crítica y 7 altas corregidas. Falta revisión externa antes de datos reales |
| ¿Quién la mantiene? | Hoy el propietario con asistente de programación. El mantenimiento a largo plazo y su costo son pendientes (O del marco FARO; P13) |
| ¿Qué pasa si falla? | Base estándar PostgreSQL, instalación en un archivo, documentación y 799 comprobaciones automáticas; sin plan de continuidad formal todavía |
| ¿Por qué no un software comercial? | No se hizo comparación. Es un vacío declarado |
