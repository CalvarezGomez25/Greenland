# 03 · Marco teórico de PMO360

Qué teoría de gestión de proyectos sostiene la plataforma, qué parte está verificada y en qué módulo se aplica.
Cada afirmación lleva un **nivel de verificación** (N1, N2, N3; definidos en [08-fuentes-y-verificacion.md](08-fuentes-y-verificacion.md)). Lo que es criterio de diseño propio de PMO360 y no de un estándar se rotula como tal.

> **Alcance honesto.** Este marco se armó el 14 de octubre de 2026 con búsqueda web. Las páginas de los editores (PMI, ISO, AXELOS) no se pudieron abrir directamente desde el entorno de trabajo (fallo de resolución de red), así que ningún estándar se leyó en su texto completo. Se confirmó lo que los resultados de búsqueda mostraban de la página del editor (N1) o lo que coincidía en varias fuentes independientes (N2). Antes de citar un estándar en un contrato o ante terceros, léelo en su fuente.

## 1. Estructura del marco

El marco tiene cuatro capas. Cada capa responde una pregunta distinta y se apoya en la anterior.

| Capa | Pregunta | Contenido | Dónde vive en la plataforma |
| --- | --- | --- | --- |
| 1. Gobierno y principios | ¿Con qué criterios se gestiona un proyecto? | PMBOK Guide 8.ª ed., ISO 21502, ISO 21500, PRINCE2 | Sección 2 de `ESPECIFICACION.md`; estructura por dominios |
| 2. Dominios técnicos | ¿Qué se controla y con qué técnica? | Alcance/EDT, cronograma, costo y valor ganado, riesgos, interesados, cambios, contratos, conocimiento | Módulos A–N |
| 3. Normativa local | ¿Qué exige el contexto colombiano? | Ley 80 de 1993, Ley 1474 de 2011, Ley 51 de 1983, Ley 594 de 2000 | Interventoría (N), festivos, gestión documental |
| 4. Adopción | ¿Cómo se explica, se prueba y se sostiene? | Marco FARO y piloto de 90 días | Sección 17 de `ESPECIFICACION.md`, `docs/presentacion-faro/` |

## 2. Capa 1 · Gobierno y principios

### 2.1 PMBOK Guide, 8.ª edición (PMI)

- La página oficial de PMI describe la 8.ª edición como una actualización que **conserva la base de principios y dominios de desempeño de la 7.ª y la simplifica**; lista **seis principios** y **siete dominios de desempeño**: gobernanza, alcance, cronograma, finanzas, interesados, recursos y riesgo. Añade cobertura de IA, PMO y adquisiciones, y recupera una guía de procesos de forma no prescriptiva. **N1** (página del editor vía buscador).
- Fuentes secundarias coinciden en que la edición salió en formato digital en noviembre de 2025 y agrupa unos 40 procesos en cinco "áreas de enfoque". **N2.**
- **Qué cambió respecto a la v1 de PMO360.** El prototipo de origen citaba «PMBOK® 7ed» y la especificación v3.0 cita la 7.ª edición («citada por el libro; no re-verificada»). Hay edición vigente más nueva. **Acción pendiente:** decidir si se actualiza la referencia (ver [09-gobierno-de-la-memoria.md](09-gobierno-de-la-memoria.md), pendiente M-1).
- **Lectura útil para PMO360.** Los siete dominios cubren lo que la plataforma ya tiene: *alcance* (EDT), *cronograma* (Gantt), *finanzas* (presupuesto, valor ganado, contratos y pagos), *interesados* (stakeholders, reportes), *riesgo* (registro y semáforo), *gobernanza* (roles, aprobaciones, auditoría) y *recursos* (parcial: asignación de personas a proyectos, sin gestión de recursos de obra). Esta correspondencia es un análisis de este documento, no una afirmación del editor.

### 2.2 ISO 21500 e ISO 21502

- **ISO 21502:2020**, *Project, programme and portfolio management — Guidance on project management*: guía de gestión de proyectos; no cubre programas ni portafolios; aplica a cualquier ciclo de vida (predictivo, incremental, iterativo, adaptativo o híbrido); describe prácticas que funcionan bien, no requisitos; se publicó en diciembre de 2020 y reemplazó a ISO 21500:2012. **N2** (listados de organismos de normalización coincidentes).
- **ISO 21500:2021**, *Context and concepts*: título verificado en el comité ISO/TC 258 en la v3.0 de la especificación. **N1** (verificación previa de la especificación).
- Uso en PMO360: vocabulario común y justificación de que la plataforma no impone un ciclo de vida único.

### 2.3 PRINCE2

- Versión 6: registros separados (diario, registro de incidencias, registro de calidad, registro de lecciones). Versión 7: según sitios de preparación de examen, los productos de gestión pasan de 26 a 15 y se agrupan en un «registro del proyecto» (*Project Log*) con seis registros. **N3**: solo fuentes secundarias de estudio, no AXELOS.
- Idea aprovechable (también en PMBOK): **una lección registrada no es una lección aplicada.** Fuente: misma nota de estudio, **N3**. Se refuerza con la evidencia de la sección 4.

### 2.4 Estándares de portafolio y programa (PMI)

- *The Standard for Portfolio Management* y *The Standard for Program Management*, 4.ª edición: existencia verificada en pmi.org en la especificación. **N1.** Falta verificar si hay edición posterior.

## 3. Capa 2 · Dominios técnicos y su aplicación

| Dominio | Teoría o técnica | Verificación | Qué hace PMO360 | Módulo |
| --- | --- | --- | --- | --- |
| Alcance | **EDT (WBS)** y la **regla del 100 %**: la suma de los hijos cubre todo el alcance del padre, en todos los niveles | PMI Practice Standard for WBS, 3.ª ed., existe (N1); la regla aparece ya en la 2.ª ed. de 2006 (N2); el **origen de la regla no se pudo establecer** | EDT multinivel; presupuesto ligable a la EDT (decisión [ADR-0015](decisiones/ADR-0015-presupuesto-sobre-la-edt.md)) | D, J |
| Costo y cronograma integrados | **Valor ganado (EVM)**. Cronología: concepto nacido en el *Cost of Work Report* de PERT/Cost (1962); criterios C/SCSC del Departamento de Defensa de EE. UU. (1967); reescritura de 32 guías por la NDIA (1995–1996) e incorporación a ANSI/EIA-748 (1998) | N2 (DTIC, CMS, biblioteca PMI, Wikipedia coinciden) | Cálculo de PV, EV, AC, SPI, CPI, SV, CV, EAC, ETC, TCPI; semáforo; curva S | G, K |
| Riesgos | **ISO 31000:2018**: 8 principios, marco y proceso (comunicación, alcance y contexto, evaluación —identificación, análisis, valoración—, tratamiento, seguimiento). Guía, no certificable | N2 | Registro con probabilidad × impacto; la escala 1–5 y los cortes Crítico ≥ 15, Alto ≥ 8, Medio ≥ 4 son **criterio de diseño de PMO360** (heredado del prototipo), no de la norma | E |
| Interesados | **Matriz poder–interés** de Mendelow (1991): cuatro cuadrantes con estrategia por cuadrante | N3: original no localizado; el título del artículo no está confirmado | Puntaje poder × interés con umbrales ≥ 16, 10–15, 5–9, 1–4: **criterio de diseño**, heredado del prototipo | C |
| Cambios | **Control integrado de cambios**: todo cambio propuesto se registra, se evalúa su impacto y se aprueba, rechaza o difiere | N2 (descripciones del registro de cambios en PMBOK 6) | Flujo de 8 fases, niveles Menor/Moderado/Crítico (hasta 2 % / hasta 5 % / mayor), aprobación por nivel, firma del patrocinador sobre 5 %, líneas base versionadas. Umbrales: **decisión del usuario** (supuesto S6) | F |
| Conocimiento | **Registro de lecciones aprendidas** como entrada y salida del proceso *Gestionar el conocimiento del proyecto* (PMBOK 6) | N2/N3 | Módulo de cierre y lecciones; aún sin ciclo de **aplicación** de lecciones (ver brecha en [04-buenas-practicas-documentacion.md](04-buenas-practicas-documentacion.md)) | H |
| Información documentada | **ISO 9001:2015, cláusula 7.5**: «información documentada» (documentos y registros bajo un solo término); extensión según tamaño, complejidad y competencia; identificar, revisar y aprobar; controlar disponibilidad y proteger de alteración | N2 (consultoras; no el texto de la norma) | Documentos con versiones, bitácora y reportes inmutables, auditoría | I, L, G |

### 3.1 Fórmulas de valor ganado usadas (matemática estándar)

SPI = EV / PV · CPI = EV / AC · SV = EV − PV · CV = EV − AC · EAC = BAC / CPI · ETC = EAC − AC · TCPI = (BAC − EV) / (BAC − AC)

Variante de EAC usada: la que supone que el rendimiento de costo actual continúa. La plataforma la usa como proyección final; otras variantes del EAC no se implementan.

### 3.2 Criterios de diseño propios de PMO360 (no vienen de un estándar)

Estos principios se infieren del comportamiento del sistema y de las decisiones del usuario. Son hipótesis de trabajo que el piloto debe validar.

| Criterio | Evidencia en el repositorio |
| --- | --- |
| **Fuente única.** Un dato, un lugar | Dashboard calculado desde los mismos registros que los módulos; cálculos en `src/lib/` con pruebas |
| **Gestión por excepción.** Semáforo = peor de cronograma, costo, riesgos y cambios | Supuesto S1; decisión [ADR-0009](decisiones/ADR-0009-semaforo-peor-de-cuatro.md) |
| **No inventar el verde.** Sin dato se muestra «Sin datos» | Sección 17 de `ESPECIFICACION.md` |
| **Reglas en la base, no solo en la pantalla.** Permisos por rol aplicados por RLS | Decisión [ADR-0004](decisiones/ADR-0004-reglas-de-acceso-en-la-base.md); auditoría `docs/AUDITORIA.md` |
| **Lo firmado no se edita.** Reportes enviados, informes firmados, bitácora y versiones de documentos son inmutables | `docs/SUPUESTOS.md`, «Reglas de datos» |
| **Gerencial, no de residencia de obra.** Presupuesto por capítulos a un nivel | Decisión [ADR-0006](decisiones/ADR-0006-presupuesto-gerencial-por-capitulos.md) |

## 4. Capa 3 · Normativa colombiana

| Norma | Para qué se usa | Verificación |
| --- | --- | --- |
| Ley 80 de 1993, art. 32 | La interventoría es obligatoria en contratos de obra por licitación pública; se contrata por concurso de méritos | N2: citada en la Guía de supervisión de Colombia Compra Eficiente y en el concepto C-1832 de 2025; **texto oficial no leído** |
| Ley 1474 de 2011, arts. 83 y 85 | Supervisión frente a interventoría | N2 por las mismas fuentes; **el art. 84 no se pudo verificar** |
| Ley 51 de 1983 | Cálculo automático de festivos para plazos en días hábiles | Citada por el código; texto no leído |
| Ley 594 de 2000, Ley General de Archivos (art. 21 y Título V) | Obliga a las entidades públicas a formular programas de gestión documental; el Decreto 1080 de 2015 lo hace exigible a las entidades del Estado | **N2** (programas de gestión documental de municipios y universidades, y un artículo académico); **Decretos 2609 de 2012 y 1080 de 2015: no leídos en el texto oficial** |

La Ley 594 aplica a entidades públicas y a particulares que cumplen funciones públicas. Si los clientes de GreenLand son públicos o la plataforma sirve a contratos públicos, hay que consultar con un archivista o jurídico cuándo la información de la plataforma es documento de archivo. Es pendiente de gobierno, no de código (M-3).

## 5. Capa 4 · Adopción: FARO

FARO (Fuente única, Alerta a tiempo, Respaldo, Operación que escala) es el marco de presentación y de piloto de 90 días. Hilo con el nombre: PMO360 es la vuelta completa; cada paso ilumina un cuarto de vuelta (4 × 90° = 360°). Origen, decisiones y material en [02-historia.md](02-historia.md) (fase 5) y `docs/presentacion-faro/`.

Referencias de comunicación usadas en su construcción (todas **N3**, guías de consultoría y divulgación, no estándares): Principio de la Pirámide (Barbara Minto), criterio MECE y estructura de explicación del creador Sandeep Swadia (se leyeron las transcripciones de 3 de sus 458 videos).

## 6. Evidencia sobre el problema que la plataforma pretende atender

- **La captura de lecciones falla en la práctica.** El informe GAO-02-195 de 2002 halló que en la NASA las lecciones no se identificaban, recopilaban ni compartían de forma rutinaria; entre las barreras, falta de tiempo y percepción de intolerancia a los errores. **N1** (govinfo.gov, vía buscador). Una auditoría del Inspector General de la NASA de 2012 reportó uso todavía irregular del sistema de lecciones. **N2** (citada en un artículo).
- Un estudio de Duffield y Whitty reporta que de 522 respuestas de profesionales, solo 11,7 % seguía el proceso de lecciones aprendidas de su organización. **N2** (según el propio artículo, no verificado en su cuestionario).
- **Qué no se usa como argumento.** Las cifras de *Pulse of the Profession* (por ejemplo 89 % frente a 36 % de proyectos exitosos) y de *CHAOS* (2006) aparecieron en fuentes antiguas o de proveedores. Son correlacionales y no se citan como beneficio esperado de PMO360. Coherente con la regla del proyecto: **no hay cifras de ahorro** hasta que el piloto las mida.

## 7. Qué falta de este marco

| ID | Pendiente |
| --- | --- |
| M-1 | Revisar la edición vigente del PMBOK (8.ª) y actualizar las referencias de `ESPECIFICACION.md` sección 2 |
| M-2 | Leer en fuente primaria: ISO 21502, ISO 31000, PMBOK 8, Mendelow (1991) |
| M-3 | Consultar con jurídico o archivística la aplicación de la Ley 594 a la información de la plataforma |
| M-4 | Aún no investigados: gestión de beneficios, gestión de recursos de obra, ruta crítica (fuera de alcance según la especificación) |
