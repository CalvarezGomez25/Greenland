# Especificación técnica: Plataforma Integral de Gestión de Proyectos (PMO)

Versión 3.3.1, actualizada el 21 de octubre de 2026. Es la única versión vigente. Documento raíz de PMO360: qué es la plataforma, qué está construido, qué se decidió, qué se supuso y qué falta. Nació como documento base para construirla en Claude Code y ahora también registra lo construido.

## 0. Control del documento

| Campo | Valor |
| --- | --- |
| Versión | 3.3.1, única versión vigente |
| Última actualización | 21 de octubre de 2026 (revisión de coherencia sobre lo construido y decidido hasta el 17 de octubre de 2026; guías de operación en la sección 16) |
| Fuentes | Libro Sistema de Gestión de Proyectos de Infraestructura, Metodología de Control de Cambios GL, prototipo SGCC, prototipo de obra (Fases 1 a 4), reglas indicadas por el usuario, normativa colombiana de supervisión e interventoría (sección 2), registro de riesgos por frente de la Planta Empacadora El Silencio (Excel, 8 de octubre de 2026), investigación de marco teórico y de buenas prácticas de documentación del 14 de octubre de 2026 (sección 2 y `docs/memoria/`) y las decisiones del usuario durante la construcción (sección 14) |
| Decisiones confirmadas | Sección 14 |
| Código y documentación técnica | `README.md` (instalación y variables), `docs/SUPUESTOS.md`, `docs/AUDITORIA.md`, `docs/presentacion-faro/`, `docs/memoria/` (historia, marco teórico, decisiones, trazabilidad y lecciones) |

### Historial de cambios

| Versión | Fecha | Cambios |
| --- | --- | --- |
| 2.0 | 9 de octubre de 2026 | Rol y módulo de Interventoría |
| 3.0 | 11 de octubre de 2026 | Estado de construcción (sección 0.1); marca PMO360, menú lateral, ayuda y glosario (secciones 1.1, 3 y 5.Q); aprobación de contratos nuevos por el director (M); alertas por correo (5.O); presupuesto sobre la EDT (J); riesgos ampliados e importación desde Excel (E); informe gerencial de una página y envío semanal (5.P); auditoría y correcciones (12.1); festivos automáticos (N); parámetros, modelo de datos, roles, supuestos y pendientes actualizados; marco FARO para presentar y pilotear la plataforma (sección 17) |
| 3.1 | 15 de octubre de 2026 | Ajustes del tablero del proyecto del 12 de octubre (gráfico de avance, resumen de control, tablero ordenado por código; sección 3 y hito 21); marco FARO completo con su estado de material y pendientes (sección 17 y hito 20); marco de referencia ampliado con PMBOK 8.ª edición, ISO 21502, ISO 31000, historia del valor ganado y Ley 594 de 2000, con nivel de verificación (sección 2); memoria del proyecto `docs/memoria/` (sección 18 y hito 22); historia de cómo se llegó al nombre PMO360 (sección 1.2); decisión de no crear un rol «gerente junior» (secciones 8 y 14); pendientes P26 a P32; estado al 15 de octubre (sección 0.1) |
| 3.2 | 16 de octubre de 2026 | Correo y teléfono en los interesados y directorio de contactos reutilizable entre proyectos (módulo C, secciones 7 y 8, migración 0023, hito 23, supuesto S18, pendiente P33); estado de pruebas actualizado |
| 3.3 | 16 de octubre de 2026 | Módulo R, Actividades y «Mi trabajo»: un mínimo de trabajo colaborativo (secciones 4, 5, 7 y 8, migración 0024, hito 24, supuesto S19, pendiente P34); pendientes P35 (rol futuro de Carlos y administrador único de TI) y P36 (quién crea proyectos y arma equipos) |
| 3.3.1 | 21 de octubre de 2026 | Revisión de coherencia al unir dos líneas de trabajo (cifras de pruebas, conteo de fichas de decisión, estado de P16 y P17); guías de operación de la sección 16: crear usuarios con su rol y configurar y probar el envío de correos por fases; aviso de que los avisos inmediatos solo necesitan el proveedor de correo (módulo O); se registra la exploración de Microsoft 365 como decisión abierta (P37) |

### 0.1 Estado actual de un vistazo (16 de octubre de 2026)

| Aspecto | Estado |
| --- | --- |
| Hitos 1 a 11 de la sección 12 | Construidos. Todos los módulos del mapa (sección 4) están disponibles en la aplicación |
| Extensiones posteriores | Construidas: aprobación de contratos, alertas por correo, presupuesto sobre la EDT, riesgos ampliados e importación, informe gerencial y su envío semanal, marca, menú lateral y ayuda, y los ajustes del tablero del proyecto (hito 21). Material del marco FARO producido (hito 20). Memoria del proyecto creada (hito 22). Directorio de contactos construido (hito 23). Actividades y «Mi trabajo» construidos (hito 24) |
| Pruebas automáticas | 328 pruebas unitarias (Vitest, 35 archivos) y 586 comprobaciones de base de datos con PostgreSQL real en memoria (PGlite), todas correctas; se volvieron a ejecutar el 21 de octubre de 2026 sobre el código unido (el 14 de octubre eran 305 y 494, antes de los hitos 23 y 24) |
| Producción | El usuario instaló el SQL de la base en Supabase y desplegó en Vercel; confirmó que funciona con datos ficticios |
| Aún no ocurrido | Ningún correo se ha enviado en producción (falta configurar el proveedor, `CRON_SECRET` y el usuario de solo lectura); no hay datos reales; no hay revisión de seguridad independiente; no hay medición de ahorro de tiempo |
| Memoria del proyecto | `docs/memoria/` (sección 18): historia, marco teórico, 27 fichas de decisión, trazabilidad, lecciones aprendidas y fuentes. Las conversaciones anteriores a la sesión de desarrollo no se pudieron leer (pendiente P27) |
| Condiciones antes de datos reales | Definir región y confidencialidad; plan de alojamiento apto para uso comercial; revisión de seguridad (pendientes P12 a P14) |

## 1. Visión, alcance y principios

**Objetivo.** Una sola herramienta para que la PMO controle el portafolio completo (estado, costo, plazo, riesgos y cambios de todos los proyectos) y baje, en pocos clics, hasta el detalle de un proyecto o de una obra. Es una plataforma gerencial, no de residencia de obra: el detalle de obra se limita a lo que el gerente necesita para controlar.

**Principios de diseño (para evitar enredos).**

1. **Una sola fuente de verdad.** Cada dato se captura una vez, en el nivel donde nace. Los niveles superiores solo agregan, nunca vuelven a digitar.
2. **Drill-down total.** Todo indicador del dashboard es un enlace al registro que lo origina.
3. **Calculado, no digitado.** SPI, CPI, semáforo, scores y retenciones se calculan. Única excepción en la transición: la captura manual de PV, EV y AC del hito 2 (sección 12).
4. **Parámetros, no código.** Umbrales y porcentajes viven en una tabla configurable.
5. **Núcleo universal más módulos opcionales.** El Núcleo PMO sirve a cualquier proyecto (industrial, logístico, agroindustrial, obra civil). El área de Obra se activa solo donde aplica.
6. **Línea base y trazabilidad.** Todo cambio aprobado versiona la línea base. Todo movimiento financiero y todo cambio de parámetro deja registro de auditoría.
7. **Avisar, no esperar.** Lo que requiere una decisión se muestra en el tablero y se avisa por correo a quien debe decidir (módulo O). Cuando falta información, la plataforma lo dice («Sin datos», «Sin reporte de la semana») en lugar de mostrar un verde sin verificar.
8. **Explicado en español sencillo.** Los términos técnicos se muestran en español (EDT, Interesados, Valor ganado) y cada pantalla tiene ayuda contextual y un glosario (módulo Q). Las siglas SPI, CPI, BAC, EAC y TCPI se conservan por ser de uso corriente.

### 1.1 Identidad

| Elemento | Valor |
| --- | --- |
| Nombre | PMO360 |
| Mensaje bajo el título | Control integral de Proyectos |
| Empresa | GreenLand (logo como imagen principal) |
| Significado del nombre | El 360 es la vuelta completa (visión integral, sin puntos ciegos); el marco FARO lo explica como una luz que gira en cuatro cuartos de vuelta (sección 17) |
| Tipografías | Baloo 2 (títulos) y Roboto (texto); los documentos exportados las incrustan |
| Paleta | Verdes de la marca (hoja #4c700b, #386631, #164504) y tierra #7c401d; semáforo Verde, Amarillo y Rojo siempre acompañado de la palabra |

**Fuera de alcance de la v3.1:** hoja de ruta de certificación PMP del libro (es desarrollo personal del gerente, no gestión de proyectos); módulo de flujo de caja; programas (el campo queda reservado); multimoneda; reajustes por IPC; impuestos y pólizas.

### 1.2 Cómo se llegó al nombre PMO360

Registro reconstruido del historial de Git, de los artifacts de la cuenta y de la sesión de desarrollo. Etiquetas: **Declarado** (lo dijo el usuario), **Verificado** (comprobable en un archivo o commit), **Supuesto**.

| Fecha (UTC) | Paso | Base |
| --- | --- | --- |
| 7 a 8 de octubre de 2026 | La especificación y el prototipo llevaban nombres descriptivos de obra: «Especificación técnica: Plataforma de Gestión de Obras» y «Plataforma de Obra». La aplicación se construyó con ese nombre en el ingreso y el inicio | Verificado: títulos de los artifacts y primeros commits |
| Título actual de este documento | «Plataforma Integral de Gestión de Proyectos (PMO)»: el alcance pasa de la obra al portafolio, y aparece la sigla PMO | Verificado: encabezado de este archivo |
| 10 de octubre, 12:05 a 12:20 | Las presentaciones de la plataforma se titulan «Plataforma PMO Greenland» y «Plataforma PMO Greenland, versión corta» (todavía sin nombre propio) | Verificado: títulos de los artifacts |
| 10 de octubre, 20:10 | El usuario pide cambiar el nombre: «“Plataforma de obra” es genérico»; quiere algo más profesional y creativo para la página de inicio y de ingreso, «algo como PMO360», y pide un par de propuestas. **La idea PMO360 es del usuario** | Declarado |
| 10 de octubre, 20:26 | Claude presenta cuatro opciones y recomienda la 2 (tabla siguiente). Advierte que **no verificó disponibilidad de marca ni de dominio** y sugiere revisarla en el registro de marcas de la SIC | Verificado: registro de la sesión |
| 10 de octubre, 20:43 | El usuario decide: **«Usa como nombre PMO360»**, con el mensaje «Control integral de Proyectos», y pide no repetir GreenLand porque ya es la imagen principal | Declarado |
| 10 de octubre, 20:46 | Se aplica en el ingreso, la pestaña del navegador («PMO360 · GreenLand»), el asunto y el botón de los correos («[PMO360] …»), las propiedades de los Excel y PDF exportados y el README. El nombre vive en un solo archivo (`src/lib/marca.ts`) | Verificado: commit `63ac198` |
| 11 de octubre | Al preparar el marco FARO, el usuario nota que no se explica la relación entre FARO y PMO360. Se formula el significado: **el 360 es la vuelta completa** (visión integral, sin puntos ciegos) y cada paso de FARO ilumina un cuarto de vuelta (4 × 90° = 360°) | Verificado: commit `0517e5b`. **Supuesto:** el significado se formuló después de elegir el nombre; el usuario no lo explicó el 10 de octubre |

**Opciones propuestas el 10 de octubre de 2026** (mensaje propuesto bajo el título):

| # | Nombre | Mensaje propuesto | Resultado |
| --- | --- | --- | --- |
| 1 | PMO360 (idea del usuario) | «Portafolio, obra e interventoría en una sola vista» | **Elegido**, con otro mensaje |
| 2 | GreenLand PMO360 | El mismo | Recomendada por Claude; descartada porque la marca ya va como imagen principal |
| 3 | Atalaya | «Torre de control de tus proyectos de obra» | No elegida |
| 4 | Raíz PMO | «Cimientos firmes para cada proyecto», en sintonía con el logo | No elegida |

**Pendiente P32:** verificar la disponibilidad del nombre como marca (registro de la SIC) y como dominio antes de usarlo fuera de la empresa. Hoy no está verificada.

## 2. Marco de referencia

| Referencia | Uso en la plataforma | Verificación |
| --- | --- | --- |
| PMBOK Guide 7.ª ed. (PMI) | Dominios de desempeño y base de las plantillas del libro | Citada por el libro. **Hay una edición vigente más nueva (8.ª, fila siguiente)**; pendiente P26 |
| PMBOK Guide 8.ª ed. (PMI) | Seis principios y siete dominios de desempeño (gobernanza, alcance, cronograma, finanzas, interesados, recursos y riesgo); recupera una guía de procesos no prescriptiva | **N1:** la página de producto de PMI lo describe (verificado el 14 de octubre de 2026 vía buscador; el texto de la guía no se leyó). La salida en noviembre de 2025 y las cinco áreas de enfoque: N2, fuentes de formación |
| ISO 21502:2020, Guidance on project management | Guía de gestión de proyectos para cualquier ciclo de vida; reemplazó a ISO 21500:2012 | **N2:** listados de organismos de normalización coincidentes; la norma no se leyó |
| Historia del valor ganado | Origen en el *Cost of Work Report* de PERT/Cost (1962); criterios C/SCSC del Departamento de Defensa de EE. UU. (1967); reescritura de 32 guías (1995-1996) e incorporación a ANSI/EIA-748 (1998) | **N2:** DTIC, CMS, biblioteca de PMI |
| Grupos de procesos PMI: Inicio, Planificación, Ejecución, Monitoreo y control, Cierre | Clasificación de módulos (sección 4) | Modelo conocido de PMI; no se verificó la publicación específica |
| The Standard for Portfolio Management, 4.ª ed. (PMI) | Estructura de portafolio y dashboard | [Existencia verificada en pmi.org](https://www.pmi.org/shop/p-/book/the-standard-for-portfolio-management-—-fourth-edition/00101600601); falta verificar si hay edición posterior |
| The Standard for Program Management, 4.ª ed. (PMI) | Campo de programa reservado | [Existencia verificada en pmi.org](https://www.pmi.org/shop/p-/book/the-standard-for-program-management-—-fourth-edition-(english)/00101600701) |
| PMI Practice Standard for EVM, 2.ª ed. | Fórmulas de valor ganado | Citada por el libro; no re-verificada |
| ISO 21500:2021, Project, programme and portfolio management: Context and concepts | Vocabulario y alineación general | [Título verificado](https://committee.iso.org/sites/tc258/home/projects/published/iso-3.html) |
| ISO 31000:2018 | Gestión de riesgos: ocho principios, marco y proceso; guía no certificable | Citada por el libro. **N2:** descripciones coincidentes de fuentes secundarias; la norma no se leyó |
| Ley 80 de 1993, art. 32, num. 1 y 2 | La interventoría es obligatoria en contratos de obra adjudicados por licitación pública; se contrata por concurso de méritos como especie de consultoría | Citada en la [Guía de supervisión de Colombia Compra Eficiente](https://colombiacompra.gov.co/sites/cce_public/files/documentos_adicionales_oc/guia_de_supervision-_cpr-115.pdf) y en el [concepto C-1832 de 2025](https://relatoria.colombiacompra.gov.co/conceptos/c-1832-de-2025/); no se leyó el texto oficial de la ley |
| Ley 51 de 1983 (festivos) | Base del cálculo automático de los festivos de Colombia para los plazos en días hábiles (módulo N); la Pascua se calcula | Citada por el código y por `docs/SUPUESTOS.md`; no se leyó el texto oficial |
| Ley 1474 de 2011, arts. 83 y 85 | Supervisión frente a interventoría; seguimiento técnico, y administrativo, financiero, contable o jurídico si se le encarga; ajuste del contrato de interventoría | Mismas dos fuentes. El art. 84 (facultades y deberes) no se pudo verificar: el sitio del Gestor Normativo bloqueó la consulta. Confirmar vigencia en el texto oficial antes de usar la norma en un contrato |
| Ley 594 de 2000, Ley General de Archivos (art. 21 y Título V); Decreto 1080 de 2015 | Obligan a las entidades públicas a un programa de gestión documental. Aplica a información de la plataforma solo si hay archivo público de por medio; no se ha definido | **N2:** programas de gestión documental de entidades y un artículo académico; **no se leyeron los textos oficiales ni el Decreto 2609 de 2012**. Pendiente P31 |

**Niveles de verificación (v3.1).** N1: confirmado en la página del editor o en documento oficial. N2: varias fuentes secundarias independientes coinciden. N3: fuente única o sin contrastar. Las páginas de PMI, ISO y de otros editores no se pudieron abrir desde el entorno de trabajo el 14 de octubre de 2026: todo N1 y N2 viene de resultados de búsqueda. Detalle, fuentes y enlaces en `docs/memoria/03-marco-teorico.md` y `docs/memoria/08-fuentes-y-verificacion.md`.

Los grupos de procesos describen en qué momento se usa cada módulo; no son estados del proyecto. Monitoreo y control corre en paralelo a todas las fases.

## 3. Arquitectura de información: niveles de drill-down

```
N0  DASHBOARD PMO (universal)
    filtros: portafolio, organización, gerente, fase, estado
    │   semáforo RAG, SPI y CPI del portafolio, requiere decisión, KPIs de gestión
    ▼
N1  TABLERO DEL PROYECTO
    │   KPIs de valor ganado, Curva S, riesgos principales, cambios pendientes, próximos hitos
    ├── N2  ÁREA GESTIÓN (todo proyecto)
    │       Acta, Stakeholders, WBS, Riesgos, Cambios, Reportes, Documentos, Cierre
    └── N2  ÁREA OBRA (si el proyecto la activa)
            Presupuesto, Cronograma, Contratos, Bitácora
                    ▼
            N3  REGISTRO
                un riesgo, un cambio, un acta de pago, una entrada de bitácora, una tarea
```

| Nivel | Pregunta que responde | Usuario principal |
| --- | --- | --- |
| N0 | ¿Qué proyectos están mal, por qué y qué decisión se necesita? | Director general de planificación y proyectos, analista PMO |
| N1 | ¿Cómo va este proyecto y qué lo explica? | Gerente de proyecto, patrocinador |
| N2 | ¿Cuál es el detalle de cada área de gestión u obra? | Gerente, finanzas, supervisor |
| N3 | ¿Qué pasó exactamente en este registro? | Quien lo creó o lo audita |

**Acceso de la interventoría.** No entra por N0. Ingresa directo al proyecto y solo ve los contratos que tiene asignados y su documentación (módulo N, sección 5; permisos en la sección 8).

**Pantalla de inicio por rol (v3.3).** Quien tiene rol global (administrador, director general, analista PMO y finanzas) ve todo el portafolio y entra al **tablero de control** (`/`). Las demás personas (gerentes, supervisores, patrocinio, consulta e interventoría) entran a **«Mi trabajo»** (`/mi-trabajo`): sus actividades pendientes a primera vista y, debajo, la lista de sus proyectos. «Mis proyectos» lista aquellos donde la persona está asignada; quien tiene rol global la ve solo si además está asignado a algún proyecto (para no listarle todo el portafolio). Su tablero de control limitado a sus proyectos sigue disponible en el menú lateral como «Tablero de mis proyectos» (`/tablero`); quien ve todo el portafolio que entre a `/tablero` vuelve a `/`. **La interventoría** (sin rol global y con todas sus asignaciones como interventoría) no tiene tablero de control, en coherencia con que no entra por el portafolio: su menú no trae «Tablero de mis proyectos», `/tablero` la lleva a «Mi trabajo» y su lista de proyectos está en «Mi trabajo»; una persona que es interventoría en un proyecto y gerente en otro conserva el tablero propio. En el menú de las personas sin rol global, «Mi trabajo» va primero. Los enlaces «Volver al portafolio» de las pantallas de proyecto llevan al tablero que corresponde a cada persona.

**Reglas de navegación.** Cada cifra del dashboard enlaza a la pantalla que la calcula; los cuadros principales y las filas del tablero son clicables. Por ejemplo: un SPI en rojo lleva al cronograma de ese proyecto; un riesgo crítico lleva al registro de riesgos filtrado. En la v3.0 la ruta de migas se reemplazó por el menú lateral (siguiente bloque) y por enlaces «Volver» en cada pantalla.

**Menú lateral izquierdo (v3.0).**

| Zona | Contenido |
| --- | --- |
| Espacio de trabajo | Tablero de control (portafolio) y Ayuda (guías y glosario) |
| Selector de proyecto | Los proyectos que la persona puede ver, ordenados por código en orden natural (GL-001, GL-002… GL-010) |
| Gestión del proyecto | Los módulos del proyecto elegido agrupados por área (Gestión, Obra, Interventoría), solo los que el rol permite |
| Pie | Nombre de la persona, «Cambiar de usuario» y «Salir» |

**Tablero del proyecto (N1), v3.1.** Arriba, el gráfico «Avance del proyecto: lo planeado frente a lo construido» (aro exterior = avance físico, marca = avance planificado, aro interior = avance financiero, con los tres porcentajes y la diferencia frente al plan) junto a un resumen de control en rejilla: estado calculado, SPI y CPI; presupuesto (BAC), costo real (AC) y proyección final (EAC) con el ahorro o sobrecosto previsto; riesgos activos con su nivel máximo; cambios pendientes; y decisiones pendientes del proyecto. La tarjeta «Avance físico / financiero» se retiró por redundante: el gráfico muestra lo mismo y además el planificado. La ficha (cliente, ubicación, inicio y duración) se compactó en una sola franja justo debajo del nombre del proyecto; la moneda solo se muestra si no es COP. En celular todo se apila en una columna. Decisión del usuario, 12 de octubre de 2026.

En la parte superior de cada pantalla de proyecto se muestra su nombre y código, y el enlace «Ver guía» abre la guía de ese módulo. El calendario de festivos no está en el menú (se consulta por su dirección y se mantiene solo).

## 4. Mapa de módulos

| Módulo | Área | Grupo de procesos | Dominio PMBOK 7 (propuesta) | Origen |
| --- | --- | --- | --- | --- |
| A. Dashboard PMO y portafolio | N0 | Monitoreo y control | Medición | Hoja Dashboard RAG |
| B. Ficha del proyecto y acta de constitución | Gestión | Inicio | Planificación, enfoque y ciclo de vida | Hoja Acta de Constitución |
| C. Stakeholders | Gestión | Inicio | Stakeholders | Hoja Stakeholders |
| D. WBS (EDT) | Gestión | Planificación | Planificación | Hoja WBS |
| E. Riesgos | Gestión | Planificación, Monitoreo | Incertidumbre | Hoja Registro de Riesgos |
| F. Control de cambios | Gestión | Monitoreo y control | Medición | Hoja Registro de Cambios, Metodología GL, SGCC |
| G. Reporte semanal, EVM y KPIs | Gestión | Monitoreo y control | Medición | Hojas Reporte Semanal y KPIs & EVM |
| H. Cierre y lecciones aprendidas | Gestión | Cierre | Entrega | Metodología GL, fase 8; WBS 1.7 |
| I. Documentos | Transversal | Todos | Trabajo del proyecto | Nuevo (planos y contratos) |
| J. Presupuesto y costos | Obra | Planificación | Planificación, Medición | Prototipo, Fase 1 |
| K. Cronograma y avance | Obra | Planificación, Ejecución | Planificación, Trabajo | Prototipo, Fase 2 |
| L. Bitácora de obra | Obra | Ejecución | Trabajo del proyecto | Prototipo, Fase 3 |
| M. Contratos y pagos | Obra | Ejecución | Trabajo del proyecto | Prototipo, Fase 4 |
| N. Interventoría | Transversal, por contrato | Planificación (revisión de diseños y asesoría), Ejecución, Monitoreo y control, Cierre | Trabajo del proyecto, Medición | Solicitud del usuario, 9 de octubre de 2026 |
| O. Alertas por correo | Transversal | Monitoreo y control | Medición | Solicitud del usuario, 10 de octubre de 2026 |
| P. Informe gerencial de una página | Transversal | Monitoreo y control | Medición | Solicitud del usuario, 11 de octubre de 2026 |
| Q. Ayuda y glosario | Transversal | Todos | Trabajo del proyecto | Solicitud del usuario, 10 de octubre de 2026 |
| R. Actividades y Mi trabajo | Gestión, por proyecto, y transversal | Ejecución, Monitoreo y control | Trabajo del proyecto | Solicitud del usuario, 16 de octubre de 2026 |

## 5. Especificación por módulo

### A. Dashboard PMO (nivel 0)

Orden de bloques, de arriba hacia abajo, pensado para decidir (qué está mal, por qué, qué hacer):

1. **Resumen del portafolio:** proyectos activos; cantidad en Verde, Amarillo y Rojo; suma de BAC y de AC; SPI y CPI del portafolio; semana de corte.
2. **Semáforo multi-proyecto** (tabla del libro). Columnas: proyecto, estado general, SPI, CPI, riesgos activos (nivel máximo), cambios pendientes, avance físico %, avance presupuestal %, comentario o acción. Orden: por código del proyecto (GL-001, GL-002… en orden natural); decisión del usuario del 12 de octubre de 2026, que reemplaza el orden por semáforo de la v2.0. El estado de cada proyecto se ve en su columna.
3. **Requiere decisión:** cambios pendientes de aprobación con su antigüedad; decisiones requeridas por dirección (de los reportes semanales); riesgos críticos activos; proyectos con TCPI mayor a 1,10; proyectos sin reporte de la semana; hitos vencidos; hallazgos de interventoría escalados; contratos nuevos por aprobar. Cada fila indica a quién corresponde (director, gerente o ambos), dato que usan los correos del módulo O.
4. **KPIs de gestión** (seis, mensuales, con tendencia): ver módulo G.

**Reglas**

- SPI y CPI del portafolio se calculan sumando primero: SPI = suma de EV / suma de PV; CPI = suma de EV / suma de AC. No se promedian los índices de cada proyecto (ver caso 13.4).
- Estado general calculado = la peor de cuatro dimensiones: SPI, CPI, riesgos y cambios pendientes, con los criterios de la sección 9. En riesgos, el Rojo solo se activa con un riesgo Crítico activo; un riesgo Alto o Medio da Amarillo y uno Bajo da Verde.
- Se muestran dos estados: el calculado y el reportado por el gerente en su reporte semanal. Si difieren, el sistema lo señala.
- Filtros: portafolio, organización, gerente, fase, estado.
- Exportación del tablero a Excel y PDF con las mismas cifras que se ven en pantalla (hito 10). Las tarjetas del resumen y las filas enlazan al detalle.

### B. Ficha del proyecto y acta de constitución

- **Ficha:** código, nombre, organización, portafolio, tipo de proyecto, patrocinador, gerente, fechas planificadas, moneda, fase actual (Inicio, Planificación, Ejecución, Cierre), estado (Activo, En pausa, Cerrado, Cancelado) y si usa el área de Obra.
- **Acta (1 por proyecto):** propósito y justificación, objetivo SMART, beneficios esperados, alcance incluido y excluido, supuestos, restricciones, presupuesto total estimado, fuente de financiamiento, equipo asignado, contratistas externos y firmas de gerente y patrocinador con fecha.
- **Regla:** el presupuesto estimado del acta es una referencia. La línea base de costo (BAC) nace al aprobar el presupuesto del proyecto (módulo J) y es la que usa el valor ganado.

### C. Stakeholders

- Campos del libro: nombre u organización, rol, poder (1-5), interés (1-5), influencia (poder × interés), estrategia de gestión, necesidades y expectativas, canal de comunicación.
- La estrategia se calcula automáticamente. Ver la discrepancia D2 de la sección 14: los ejemplos del libro no coinciden con su propia leyenda.
- Vista de matriz poder-interés.
- **Contacto (v3.2, migración 0023).** Cada interesado tiene además correo electrónico y teléfono, ambos opcionales y validados (correo con formato de dirección; teléfono de 6 a 40 caracteres con números, espacios y + ( ) - .). En la lista se muestran como enlaces para escribir o llamar.
- **Directorio de contactos reutilizable (v3.2).** Al guardar un interesado, la base de datos lo vincula con un contacto del directorio y lo crea si no existe: se busca por correo y, si no tiene correo, por nombre sin distinguir mayúsculas. Al agregar un interesado en otro proyecto, el selector «Reutilizar un contacto del directorio» rellena nombre, rol, correo y teléfono, que siguen siendo editables. **Poder, interés, necesidades y canal no se copian: son de cada proyecto.** El último dato guardado actualiza el contacto del directorio; lo que llega vacío no borra lo que ya había; los interesados de otros proyectos conservan sus propios datos. Pantalla «Directorio de contactos» (menú lateral): búsqueda por nombre, rol o correo, proyectos donde participa cada contacto (entre los que la persona ve), alta y edición; solo el administrador elimina contactos y, al hacerlo, los interesados se conservan y pierden el vínculo.

### D. WBS (EDT)

- Estructura jerárquica por código (1.0, 1.1, 1.1.1). Campos: código, entregable o paquete de trabajo, descripción, responsable, inicio plan, fin plan, estado (En curso, Completado, Pendiente, En riesgo, Bloqueado).
- Plantilla estándar del libro como punto de partida: 1.1 Gestión del proyecto, 1.2 Ingeniería y diseño, 1.3 Permisos y licencias, 1.4 Adquisiciones y contratos, 1.5 Construcción o ejecución, 1.6 Calidad y SST, 1.7 Entrega y cierre.
- Cada capítulo del presupuesto y cada tarea del cronograma puede vincularse a un elemento de la WBS (opcional). Eso permite ver el valor ganado por entregable.

### E. Riesgos

- Campos del libro: código (R01...), categoría, descripción, probabilidad (1-5), impacto (1-5), score (P × I), nivel, estrategia de respuesta, plan de acción, responsable, estado.
- Nivel: Crítico (15-25), Alto (8-14), Medio (4-7), Bajo (1-3).
- Estrategias: Evitar, Mitigar, Transferir (las del libro) y Aceptar (adición).
- Estados: Activo (del libro), Materializado y Cerrado (adiciones).
- Categorías iniciales del libro: Técnico, Permisos, Financiero, Ambiental, Stakeholders, Cadena de suministro, Seguridad SST. Configurable.
- Un riesgo materializado puede originar una solicitud de cambio (la Metodología GL lo lista como tipo de cambio).
- **Campos ampliados (v3.0, migración 0021):** frente, causa o disparador, consecuencia, momento de control, fecha objetivo y referencia o base. Los riesgos tienen código propio (T-01, F1-01…) o consecutivo automático (R01…) y quedan en la auditoría (antes no lo estaban).
- **Importación desde Excel:** en la pantalla de riesgos, «Importar riesgos desde Excel» lee un libro .xlsx con una hoja llamada «Registro», muestra una vista previa (conteo por nivel y por frente) y, si no hay errores, carga todo o nada. Si un código ya existe se actualiza; nunca se borra nada. El nivel y el puntaje los calcula la plataforma y se advierte si difieren de los que traía el archivo.
- **Escala de conversión (supuesto S15):** Baja, Media y Alta del Excel equivalen a 1, 2 y 4 en la escala de 1 a 5. Con los cortes de la plataforma reproduce exactamente la matriz 3 × 3 del Excel (caso 13.11). El Excel no trae estrategia de respuesta: queda vacía. Si no hay nombre de responsable se guarda el rol propuesto.

### F. Control de cambios

Se unifican tres fuentes del usuario: hoja Registro de Cambios del libro, Metodología GL y SGCC (formato, registro maestro y configuración).

- **Identificador:** CC-AAAA-NNN, consecutivo por proyecto (formato de la Metodología GL).
- **Campos:** proyecto, fecha de solicitud, solicitante, tipo, descripción (antes y después), justificación, impacto en alcance, impacto en costo (COP), impacto en tiempo (días, positivo o negativo), ámbitos de impacto afectados (alcance, financiero, cronograma, flujo de caja, contractual, operativo, riesgos, calidad, reputacional, regulatorio), aprobador, fecha de aprobación (obligatoria si se aprueba), responsable de implementación, observaciones y lecciones aprendidas.
- **Nivel (calculado)** según la Metodología GL: Menor hasta 2 %; Moderado de más de 2 % hasta 5 %; Crítico por encima de 5 % o con impacto en el cronograma contractual. La base del porcentaje es el valor del contrato si el cambio está ligado a uno, y el BAC en los demás casos (supuesto S6).
- **Flujo de estados**, de las 8 fases de la Metodología GL: Identificado, Radicado, En evaluación técnica y financiera, En análisis de impacto, En aprobación, Aprobado o Rechazado, En implementación, Cerrado.
- **Aprobación por nivel (confirmada):** el cambio menor lo aprueba el gerente de proyecto; los cambios moderados y críticos los aprueba el director general de planificación y proyectos. La regla se guarda como parámetro.
- **Concepto de interventoría:** si el cambio está ligado a un contrato con interventoría, la fase En evaluación técnica y financiera exige el concepto del interventor (módulo N). El concepto no aprueba ni rechaza: lo decide quien corresponda por nivel.
- **Reglas:** ningún cambio se ejecuta sin aprobación formal. Los cambios de más de 5 % del presupuesto exigen además la firma del patrocinador (libro; ver P1). Todo cambio aprobado crea una nueva versión de la línea base (alcance, cronograma y costo según corresponda). Todo cambio aprobado debe reflejarse en presupuesto y flujo de caja; el flujo de caja queda para una fase posterior.
- **Roles del flujo (Metodología GL):** el director de proyecto identifica y documenta; planeación y proyectos evalúa y consolida; finanzas actualiza el flujo de caja; el gerente de proyecto o el director general de planificación y proyectos, según el nivel, autoriza o rechaza.
- **Gobierno sugerido por la metodología:** comité mensual de cambios para proyectos estratégicos y auditoría trimestral de trazabilidad.

### G. Reporte semanal, EVM y KPIs de gestión

**Reporte semanal** (uno por proyecto y semana):

- Cabecera: proyecto, semana N.º, gerente, patrocinador, fecha del reporte, próxima revisión.
- Estado general reportado por el gerente: En tiempo y presupuesto (Verde), Con alertas (Amarillo), Requiere atención (Rojo).
- **Indicadores prellenados desde el sistema, no digitados:** avance físico real, presupuesto ejecutado, SPI, CPI, hitos cumplidos en la semana.
- Texto del gerente: logros de la semana, alertas y riesgos activos, decisiones requeridas de dirección, próximos hitos (2 semanas).
- Al enviarlo se guarda una foto inmutable de los indicadores. Así se construye el histórico y las tendencias.

**Panel de valor ganado** (fórmulas del libro):

| Índice | Fórmula | Meta |
| --- | --- | --- |
| SPI | EV / PV | 0,95 o más |
| CPI | EV / AC | 0,95 o más |
| SV | EV − PV | 0 o más |
| CV | EV − AC | 0 o más |
| EAC | BAC / CPI | No mayor al BAC |
| ETC | EAC − AC | Sin meta |
| TCPI | (BAC − EV) / (BAC − AC) | 1,10 o menos |

El libro no incluye VAC (BAC − EAC); se sugiere agregarlo como adición.

**KPIs de gestión del gerente** (mensuales, con tendencia):

| KPI | Definición | Meta | Fuente |
| --- | --- | --- | --- |
| Cumplimiento de hitos | Hitos cumplidos / planificados | 90 % o más | Hitos |
| Gestión de riesgos | Riesgos críticos con plan asignado / total de riesgos críticos | 100 % | Riesgos |
| Cambios controlados | Cambios formales / total de cambios | 85 % o más | Cambios (ver P3) |
| Reuniones con acta | Reuniones documentadas / total | 100 % | Reuniones |
| Satisfacción del patrocinador | Encuesta simple, escala 1 a 5 | 4,0 o más | Captura manual |
| Reportes a tiempo | Reportes en fecha / total | 100 % | Reportes |

### H. Cierre y lecciones aprendidas

Acta de entrega y cierre (fecha, receptor), lecciones aprendidas (categoría, descripción, recomendación) y cierre administrativo (WBS 1.1.3). Las lecciones de los cambios (fase 8 de la Metodología GL) se consolidan aquí. Al cerrar el proyecto, sale del dashboard activo y queda disponible como histórico.

### I. Documentos

Repositorio de planos, contratos, actas e informes con versiones, vinculables a un proyecto y, de forma opcional, a un registro (contrato, cambio, tarea). Archivos privados.

### J. Presupuesto y costos (obra)

- Costo directo total = suma de cantidad × precio unitario de todas las partidas, organizadas siempre por capítulos (un solo nivel). Cada capítulo muestra su subtotal y su participación en el total.
- Los capítulos pueden incluir rubros que no son de obra (diseño, permisos, interventoría), para que el BAC cubra todo el proyecto (supuesto S2).
- Importación CSV de 6 columnas: capítulo, código, descripción, unidad, cantidad, precio unitario. Acepta coma, punto y coma o tabulador, y formato numérico colombiano (1.234,56).
- **BAC** = suma de los capítulos del presupuesto aprobado. Cada aprobación de cambio crea una nueva versión.
- **Presupuesto sobre la EDT (v3.0, migración 0020; supuesto S14):** cada capítulo puede ligarse a un elemento de la EDT. «Crear capítulos desde la EDT» crea (o liga, si ya existen con el mismo nombre) los capítulos de los elementos de un nivel elegido. Una tarea con elemento de la EDT y sin capítulo hereda el del ancestro más cercano. Los capítulos ligados no se borran aunque estén vacíos. La EDT muestra el costo directo de cada elemento sumando sus descendientes (no lo ve la interventoría). Es opcional: un presupuesto sin EDT sigue funcionando.
- Curva S real: gasto mensual acumulado. Curva S planificada: el prototipo usa la distribución teórica 3t² − 2t³ (t = mes / duración). En la versión final se calcula desde el cronograma, distribuyendo el valor de cada tarea a lo largo de su duración.

### K. Cronograma y avance (obra)

- Gantt en semanas; las barras se mueven y se redimensionan arrastrando. La suma de pesos de las tareas debe ser 100.
- Avance físico = suma de (peso × avance de la tarea / 100).
- Planificado a la semana k = suma de peso × min(1, max(0, (k − inicio) / duración)).
- Avance financiero = AC / BAC.
- **Avance reportado y verificado:** el supervisor de obra registra el avance de cada tarea; la interventoría puede registrar su avance verificado (módulo N). El tablero muestra ambos y la diferencia. Con el parámetro `ev_usa_avance_verificado` activo, el valor ganado usa el verificado cuando existe (supuesto S11).
- Hitos con fecha plan, fecha real y estado, para el reporte semanal y el KPI de cumplimiento.
- Mejora prevista: derivar el peso de cada tarea del presupuesto de su capítulo vinculado, en lugar de digitarlo (supuesto S3). Dependencias entre tareas y ruta crítica, en fase futura.

### L. Bitácora de obra (obra)

- Obligatorios: fecha, supervisor, clima, horas perdidas por clima, personal propio y de subcontratistas, al menos una actividad (tarea, descripción, % de avance del día) y fotos de avance (hasta 5).
- Condicionales: retraso (causa: clima, material, personal, diseño, cliente u otra; horas; descripción) e incidente (accidente, casi accidente o condición insegura; persona; descripción).
- Opcionales: materiales recibidos, equipos y maquinaria, visitas, instrucciones o cambios solicitados, observaciones.
- Al guardar, el avance del día se suma al avance de la tarea, con tope de 100 %. Pendiente definir si al eliminar un registro el avance se revierte (en el prototipo no se revierte).
- Horas perdidas = horas por clima + horas de retrasos cuya causa no sea el clima, para no contar dos veces.
- Los retrasos, incidentes y la acumulación de horas perdidas alimentan el nivel N1 del proyecto.
- La interventoría ve las bitácoras de sus contratos, puede dar visto bueno o dejar un comentario fechado en cada entrada y crear entradas propias marcadas como "interventoría". No modifica las entradas del supervisor.

### M. Contratos y pagos (obra)

- Anticipo = valor del contrato × anticipo_pct. Es **discrecional**: lo autoriza el director general de planificación y proyectos según la urgencia o necesidad del servicio o insumo, y queda registrado quién lo autorizó y el motivo. Nunca supera el máximo (20 %), que rige para todos los contratos. Por debajo del umbral de referencia (350 millones) lo normal es no darlo; el sistema advierte, pero permite la autorización.
- Por cada acta: amortización = mínimo entre el anticipo pendiente y (valor bruto × anticipo_pct); retención = valor bruto × retención_pct; neto a pagar = valor bruto − amortización − retención.
- La suma de las actas no puede superar el valor del contrato.
- Desembolsado = anticipo + suma de netos (+ retención, si ya fue liberada).
- La retención se libera solo al ejecutar el 100 % del contrato, y la liberación puede revertirse.
- Cada contrato conserva el porcentaje de retención vigente al crearse.
- **Nueva contratación (v3.0, migración 0018):** el director general de planificación y proyectos revisa y aprueba cada contrato nuevo. Un contrato creado por el gerente queda pendiente: no admite anticipo ni actas de pago, no sirve de base para el nivel de un cambio, y su valor no se modifica una vez aprobado sin el director (o un cambio aprobado). Si lo crea quien aprueba, nace aprobado. El administrador solo aprueba con el parámetro `contrato_admin_puede_aprobar` (para pruebas).
- Cambios que afectan un contrato (otrosí) se tramitan por el módulo F.
- **Tipo de contrato:** obra, interventoría, consultoría, suministro u otro. El contrato de interventoría se registra aquí como cualquier otro, y su valor entra al presupuesto como rubro (módulo J).
- **Estados del acta de pago:** Radicada, En revisión de interventoría, Con observaciones, Aprobada para pago. Si el contrato tiene interventoría asignada y el parámetro `interventoria_vb_acta_obligatorio` está activo, el acta no pasa a Aprobada para pago sin concepto favorable (Aprobado o Aprobado con observaciones) de los interventores técnico y financiero. La plataforma no ejecuta pagos.

### N. Interventoría

**Fundamento.** La interventoría es seguimiento esencialmente técnico que puede ampliarse a lo administrativo, financiero, contable o jurídico, ejercido por un tercero contratado cuando el seguimiento requiere conocimiento especializado o la complejidad o extensión del contrato lo justifican; es obligatoria en contratos de obra adjudicados por licitación pública (fuentes y vigencia en la sección 2). Sus límites, según la guía de Colombia Compra Eficiente: no puede exonerar al contratista de obligaciones, avalar actividades ajenas al objeto ni suscribir por su cuenta documentos que aumenten el valor o modifiquen plazo u objeto; sus instrucciones y requerimientos constan por escrito; y puede responder civil, disciplinaria, fiscal y penalmente. De ahí el diseño: la interventoría **conceptúa, verifica, observa e informa; no aprueba ni modifica** datos del contrato.

**Alcance por tipo de interventor.** Un contrato de interventoría declara qué alcances cubre; cada usuario tiene un sub-rol que limita los conceptos que puede emitir.

| Sub-rol | Conceptúa sobre | Fuente de la función |
| --- | --- | --- |
| Director de interventoría | Todo su alcance; firma los informes | Práctica (por validar) |
| Interventor técnico | Avance verificado, calidad, bitácora, diseños, especificaciones | Guía de Colombia Compra Eficiente: verificar calidad y cantidad, controlar cronograma |
| Interventor financiero | Actas de pago, amortización del anticipo, impacto en costo de cambios, equilibrio económico | Guía: controlar anticipos, aprobar actas y cuentas de cobro, verificar el valor ejecutado |
| Interventor administrativo | Documentos, garantías, obligaciones laborales y de seguridad social del contratista, informes, actas | Guía: coordinar la ejecución, gestionar actas e informes |
| Jurídico o contable (opcional) | Prórrogas, adiciones, sanciones; conciliaciones contables | Guía: conceptos sobre prórrogas o adiciones; requerir incumplimientos |

**Submódulos.**

1. **Asignación.** Contrato de interventoría, contratos vigilados, alcances cubiertos, vigencia y usuarios con su sub-rol. Define qué ve cada interventor.
2. **Conceptos.** Registro único de pronunciamientos: tipo (acta de pago, avance, cambio, anticipo, diseño, estudios previos o pliegos, otro), registro al que se refiere, resultado (Aprobado, Aprobado con observaciones, No aprobado), texto, autor y fecha. Un concepto emitido no se edita ni se borra; se corrige con uno nuevo. Esto responde a la exigencia de dejar constancia escrita y a la responsabilidad personal del interventor.
3. **Avance verificado.** Por tarea, el interventor técnico registra su porcentaje verificado con una nota. El tablero N1 muestra avance reportado, verificado y la diferencia.
4. **Hallazgos y requerimientos.** Severidad (Observación, No conformidad, Incumplimiento grave), contrato, descripción, evidencia (fotos o documentos), plazo de respuesta, respuesta del contratista o del gerente, y estado (Abierto, Respondido, Cerrado, Escalado). Los escalados aparecen en el dashboard del proyecto y en la lista "requiere decisión" del módulo A.
5. **Revisión de diseños.** Cada entregable de diseño (módulo I) tiene ciclos de revisión: versión, disciplina, observaciones y estado (Pendiente, Con observaciones, Aprobado). Un diseño solo puede marcarse como listo para licitar con todos sus entregables en Aprobado. Las disciplinas son un catálogo configurable.
6. **Evaluación de proveedores y contratistas.** Calificación por criterios (calidad, cumplimiento del plazo, seguridad y salud, documentación, respuesta a requerimientos; escala de 1 a 5, criterios configurables) y una recomendación: Recomendar, Recomendar con reservas o No recomendar. La interventoría recomienda; la selección y la contratación son de la entidad.
7. **Asesoría para decisiones.** Registro de las investigaciones y estudios de mercado que la interventoría aporta al gerente: tema, fuentes, conclusiones y recomendación. Incluye el apoyo a los estudios previos y pliegos de una licitación. No contrata diseños ni estudios.
8. **Informes.** Cuatro tipos, según la guía de Colombia Compra Eficiente: periódico (uno por cada pago), especial (a solicitud escrita), para proceso sancionatorio y final (antes de la liquidación). La plataforma prellena los datos del sistema y el director de interventoría firma. Formato propuesto del informe periódico (no existe formato interno; ver S12):

| Sección | Contenido | Origen |
| --- | --- | --- |
| 1. Datos | Contrato, periodo y acta de pago | Automático |
| 2. Avance | Reportado, verificado y diferencia | Automático |
| 3. Financiero | Valor bruto, amortización, retención y neto del acta | Automático |
| 4. Hallazgos | Abiertos, cerrados y vencidos | Automático |
| 5. Conceptos | Emitidos en el periodo | Automático |
| 6. Recomendación | Aprobar pago, aprobar con observaciones o no aprobar, con su motivo | Manual |
| 7. Firma | Director de interventoría | Manual |

El informe final agrega el balance financiero, las obligaciones incumplidas, el estado de las garantías y la recomendación de liquidación. El informe sancionatorio agrega los hechos, las pruebas, los requerimientos previos y las cláusulas presuntamente incumplidas.

**Plazos de respuesta a hallazgos** (propuesta, ver S12; días hábiles con el calendario de festivos de Colombia, que la plataforma calcula sola para cualquier año —Ley 51 de 1983 y Pascua calculada—; la tabla `festivos` solo guarda fechas excepcionales):

| Severidad | Plazo de respuesta | Si vence |
| --- | --- | --- |
| Observación | 5 días hábiles | Pasa a Escalado y avisa al gerente |
| No conformidad | 3 días hábiles | Pasa a Escalado y avisa al gerente |
| Incumplimiento grave | 1 día hábil | Pasa a Escalado y avisa al gerente y al director de planificación y proyectos |

**Reglas.**

- La interventoría no contrata, no adjudica ni selecciona proveedores o contratistas: recomienda con base en sus evaluaciones. Tampoco contrata diseños. No edita presupuesto, cronograma, contratos, valores de actas, parámetros ni riesgos; no autoriza anticipos, no libera retenciones y no aprueba cambios.
- Los hallazgos y el avance verificado **no cambian el semáforo calculado** en la v2.0, para respetar la regla de que el proyecto solo pasa a Rojo por un riesgo Crítico (supuesto S13). Se muestran como indicadores aparte.
- Toda acción de la interventoría queda en auditoría con usuario y fecha.
- Una acta de pago o un cambio pendiente de concepto de interventoría aparece con su antigüedad en el tablero N1.
- Datos que la interventoría no ve: dashboard del portafolio, otros proyectos, stakeholders, riesgos internos, evaluación del patrocinador, acta de constitución (presupuesto estimado y financiación), parámetros y auditoría.
- Antes de existir contrato de obra (revisión de diseños y asesoría), el acceso se limita a documentos, revisiones y asesorías del proyecto asignado.

### O. Alertas por correo

Objetivo: que quien debe decidir se entere cuando la decisión nace, sin entrar a la plataforma.

| Aviso | Cuándo | A quién |
| --- | --- | --- |
| Inmediato: cambio en aprobación | El cambio pasa a «En aprobación» | Menor: gerente del proyecto. Moderado o crítico: director general |
| Inmediato: contrato por aprobar | Un contrato nuevo queda pendiente | Director general |
| Inmediato: reporte con decisiones | Se envía un reporte semanal con decisiones requeridas | Director general |
| Resumen diario | Todos los días hacia las 7:00 a. m. de Colombia (cron de las 12:00 UTC), mientras haya algo pendiente | Cada persona recibe solo lo suyo: el director, las decisiones de todos los proyectos; cada gerente, las de sus proyectos |

**Reglas**

- Si no hay ningún usuario con rol Director general, lo del director va a los administradores.
- Proveedor de correo, por variables de entorno: SMTP (por ejemplo Gmail con «contraseña de aplicación»), Resend (dominio verificado) o «consola» (pruebas, no envía). Sin proveedor no se envía nada y la plataforma funciona igual.
- El resumen diario y el informe semanal (módulo P) los dispara el cron de Vercel con `Authorization: Bearer CRON_SECRET` y leen los datos con un **usuario de solo lectura (rol Analista PMO)**. **Nunca se usa la clave secreta (`service_role`) de Supabase.**
- Se apagan con el parámetro `alertas_correo_activas = no`.
- Los textos de los correos se escapan; los enlaces apuntan a `URL_PUBLICA` o a la dirección de Vercel.

### P. Informe gerencial de una página

**Contenido (una sola página, A4 vertical):** nombre, código, cliente, ubicación, fase, estado y gerente; estado general con las causas que lo explican; semáforos de cronograma, costo, riesgos y cambios; ocho tarjetas (SPI, CPI, avance físico, presupuesto BAC, costo final proyectado EAC, riesgos activos, cambios pendientes, decisiones pendientes); «Lectura rápida» con hasta cinco puntos; cinco riesgos principales; decisiones que requieren la dirección; hitos vencidos y próximos; cambios pendientes; último reporte semanal enviado (logros y alertas).

**Reglas**

- Todo sale de los datos del sistema; nada se digita. La «Lectura rápida» solo dice lo que los datos muestran; sin mediciones ni riesgos dice «sin datos suficientes todavía» y no emite un estado.
- **Descarga manual:** en la pantalla de cada proyecto, junto al título, «Informe gerencial» con los botones Excel y PDF. No está disponible para la interventoría. El PDF incrusta las tipografías de la marca; el Excel es una sola hoja lista para imprimir en una página, con cifras numéricas.
- **Envío automático:** todos los lunes a las 7:30 a. m. de Colombia (cron `30 12 * * 1`, UTC) a cada persona con correo registrado, con un resumen de los puntos principales en el cuerpo, una invitación a abrir los archivos adjuntos para ver el detalle, y adjuntos el PDF y el Excel de cada proyecto activo que le corresponde.
- **Quién recibe qué (supuesto S16):** administrador, director general, analista PMO y finanzas reciben todos los proyectos activos; las demás personas, los proyectos donde son miembros; la interventoría no recibe nada (su acceso excluye costos y riesgos). Quien no tiene correo válido, y el usuario técnico del cron, no reciben. Con más de seis proyectos por persona se adjunta solo el PDF.
- Se apaga con el parámetro `informe_semanal_activo = no`.
- **Límites de Vercel Hobby:** dos tareas programadas por cuenta (ya usadas: resumen diario e informe semanal), una ejecución por franja sin garantía del minuto exacto y 60 segundos por ejecución. Para uso comercial hay que pasar a un plan de pago.

### Q. Ayuda y glosario

- **Ayuda contextual:** un ícono «?» junto a los conceptos y cifras (SPI, CPI, semáforo, avance físico y otros) abre una explicación corta al pasar el cursor, al enfocar con teclado o al tocar.
- **Glosario** (en el menú, «Ayuda»): lista buscable de términos con su definición en español sencillo.
- **Guías por módulo:** el enlace «Ver guía» de cada pantalla de proyecto abre los pasos de ese módulo y quién lo usa.

### R. Actividades y Mi trabajo

Objetivo: que el equipo reparta y siga el trabajo diario en una sola herramienta, con responsable real y fecha, en lugar de que cada persona lo lleve a su manera. Es un **mínimo**; la fase siguiente depende de que el piloto muestre uso real (P34).

- **Actividad.** Título, detalle, responsable (una persona con cuenta, del equipo del proyecto o con rol global de administrador, director general o analista PMO; opcional), fecha límite (opcional), prioridad (alta, media, baja) y estado (por hacer, en curso, bloqueada, hecha). Ligas opcionales a un riesgo (por ejemplo, la acción de su plan de respuesta) y a un elemento de la EDT del mismo proyecto. Al marcarla hecha se guarda la fecha de cierre; si se reabre, se borra.
- **Vencida** = no está hecha y su fecha límite ya pasó (fecha de Colombia). Vence hoy no es vencida. La tarjeta lo dice con la palabra, no solo con el color.
- **Pantalla «Actividades» de cada proyecto.** Tablero Kanban de cuatro columnas con contador, filtro «Solo las mías» y, en «Hecha», las 12 más recientes (con enlace para ver todas). Cada tarjeta muestra prioridad, plazo, responsable y ligas. Se mueve **arrastrándola** a otra columna (el cambio se ve al instante y vuelve atrás si la base de datos lo rechaza) o con el selector «Mover a», que es la vía en el celular y con teclado. Dentro de cada columna el orden es por fecha límite; no se reordena a mano.
- **Pantalla «Mi trabajo»** (menú lateral, para todos). El mismo tablero Kanban con las actividades de la persona en todos sus proyectos (en «Hecha», las 8 más recientes) y, arriba, cuántas están vencidas y cuántas vencen en los próximos 7 días.
- **No son las tareas del cronograma** (módulo K): estas tienen peso y mueven el valor ganado; las actividades no.
- **Permisos** (aplicados en la base de datos; ver sección 8): ven quienes ya ven el proyecto; crean, editan y borran administrador, gerente del proyecto, director general y analista PMO; la persona responsable solo cambia el estado; la interventoría ve solo lo que le asignaron o creó y se asigna únicamente a sí misma.
- **Fuera de este mínimo:** comentarios y menciones, adjuntos, avisos por correo o dentro de la plataforma, reordenar tarjetas dentro de una columna, subtareas, tareas recurrentes, plantillas, liga a cambios e hitos y aporte de las vencidas al semáforo y al resumen diario.

## 6. Integración entre módulos: indicador, fórmula y fuente

Esta tabla es el contrato de datos. Define de dónde sale cada número del dashboard.

| Indicador | Fórmula | Fuente |
| --- | --- | --- |
| BAC | Suma de capítulos del presupuesto aprobado vigente | J, versión de línea base |
| PV | Planificado acumulado a la fecha de corte × BAC | K, cronograma |
| EV | Avance físico ponderado × BAC; usa el avance verificado si existe y el parámetro está activo (S11) | K, N, tareas |
| AC | Gasto real acumulado (ver S4) | J, gasto mensual |
| Avance físico | EV / BAC | K |
| Avance financiero | AC / BAC | J |
| SPI, CPI, SV, CV, EAC, ETC, TCPI | Fórmulas del módulo G | BAC, PV, EV, AC |
| Score de riesgo y nivel | P × I; Crítico 15-25, Alto 8-14, Medio 4-7, Bajo 1-3 | E |
| Riesgo máximo activo del proyecto | Mayor nivel entre riesgos con estado Activo | E |
| Cambios pendientes | Cambios no cerrados ni rechazados | F |
| Nivel del cambio | Impacto en costo / base, contra 2 % y 5 % | F, parámetros |
| Estado general calculado | Peor de SPI, CPI, riesgos y cambios | A, parámetros |
| Avance físico verificado | Σ (peso × avance verificado de la tarea / 100) | N, tareas |
| Diferencia de avance | Avance reportado − avance verificado | K, N |
| Actas con concepto pendiente | Actas en estado Radicada o En revisión de interventoría, con su antigüedad | M, N |
| Hallazgos abiertos | Hallazgos en estado Abierto, Respondido o Escalado, por severidad | N |
| Hitos cumplidos (%) | Cumplidos / planificados | K |
| KPIs de gestión | Ver módulo G | Riesgos, cambios, reportes, reuniones |
| Indicadores del portafolio | Sumas de EV, PV, AC y BAC de proyectos activos | Todos los proyectos |
| Costo directo por elemento de la EDT | Suma de los subtotales de los capítulos ligados al elemento y a sus descendientes | J, D |
| Contratos por aprobar | Contratos en estado «pendiente» | M |
| Decisiones pendientes | Lista «Requiere decisión» con su audiencia (director, gerente o ambos) | A, F, E, G, M, N |
| Informe gerencial | Un documento por proyecto con los indicadores anteriores, sin cifras digitadas | A, E, F, G, K, M |

**Transición.** En el hito 2 el valor ganado se captura a mano (BAC, PV, EV y AC, como en el libro) para dar valor temprano. Desde el hito 6, esos valores pasan a calcularse desde presupuesto y cronograma. La captura manual queda como alternativa para proyectos sin área de Obra.

## 7. Modelo de datos

`proyecto_id` es el hilo conductor: todas las tablas lo llevan, excepto las del núcleo organizacional.

**Núcleo organizacional**

| Tabla | Campos principales |
| --- | --- |
| organizaciones | id, nombre, tipo (grupo, empresa, unidad) |
| portafolios | id, organizacion_id, nombre |
| perfiles | usuario_id, nombre, rol_global |
| proyectos | id, codigo, nombre, organizacion_id, portafolio_id, programa_id (reservado), tipo, patrocinador_id, gerente_id, fecha_inicio_plan, fecha_fin_plan, moneda (COP), fase, estado, usa_obra |
| miembros_proyecto | proyecto_id, usuario_id, rol |
| parametros | ambito (global, portafolio, proyecto), ambito_id, clave, valor, descripcion, fuente |
| auditoria | id, usuario_id, fecha, tabla, registro_id, campo, valor_anterior, valor_nuevo |

**Inicio y planificación**

| Tabla | Campos principales |
| --- | --- |
| actas_constitucion | proyecto_id, proposito, objetivo_smart, beneficios, alcance_incluido, alcance_excluido, supuestos, restricciones, presupuesto_estimado, fuente_financiamiento, equipo_n, contratistas_externos, firma_gerente (fecha), firma_patrocinador (fecha) |
| stakeholders | id, proyecto_id, nombre, rol, correo, telefono, contacto_id, poder, interes, necesidades, canal (influencia y estrategia calculadas) |
| contactos | id, nombre, rol, correo, telefono, creado_en, actualizado_en (directorio reutilizable; correo único sin distinguir mayúsculas; nombre único cuando no hay correo) |
| wbs_elementos | id, proyecto_id, padre_id, codigo, nombre, descripcion, responsable, inicio_plan, fin_plan, estado |
| riesgos | id, proyecto_id, codigo, categoria, descripcion, probabilidad, impacto, estrategia, plan_accion, responsable, estado (score y nivel calculados) |
| lineas_base | id, proyecto_id, version, tipo (alcance, cronograma, costo), bac, fecha_fin, aprobada_por, fecha, cambio_id |

**Obra: presupuesto, cronograma y ejecución**

| Tabla | Campos principales |
| --- | --- |
| capitulos | id, proyecto_id, codigo, nombre, orden, wbs_id (opcional) |
| apu_partidas | id, proyecto_id, capitulo_id (obligatorio), codigo, descripcion, unidad, cantidad, precio_unitario |
| gasto_mensual | proyecto_id, mes, valor_real |
| tareas | id, proyecto_id, nombre, semana_inicio, duracion_semanas, peso_pct, avance_pct, avance_verificado_pct (opcional), nota_verificacion, verificado_por, fecha_verificacion, orden, wbs_id (opcional) |
| hitos | id, proyecto_id, nombre, fecha_plan, fecha_real, estado |
| bitacoras | id, proyecto_id, fecha, supervisor_id, clima, horas_perdidas_clima, personal_propio, personal_subcontratistas, retraso (causa, horas, descripción), incidente (tipo, persona, descripción), materiales, equipos, visitas, instrucciones, observaciones |
| bitacora_actividades | bitacora_id, tarea_id, avance_dia_pct, descripcion |
| bitacora_fotos | bitacora_id, ruta_archivo (máximo 5 por registro) |
| contratos | id, proyecto_id, tipo (obra, interventoria, consultoria, suministro, otro), subcontratista, objeto, valor, anticipo_pct, anticipo_autorizado_por, anticipo_motivo, retencion_pct, retencion_liberada |
| actas_pago | id, contrato_id, fecha, valor_bruto, estado (radicada, en_revision_interventoria, con_observaciones, aprobada_pago) |

**Interventoría**

| Tabla | Campos principales |
| --- | --- |
| interventoria_alcances | id, proyecto_id, contrato_interventoria_id, contrato_vigilado_id (opcional), alcances (tecnica, administrativa, financiera, juridica, contable, disenos, asesoria), fecha_inicio, fecha_fin |
| interventoria_usuarios | alcance_id, usuario_id, subrol (director, tecnico, administrativo, financiero, juridico_contable) |
| conceptos_interventoria | id, proyecto_id, tipo, entidad_tipo, entidad_id, resultado, texto, autor_id, fecha (inmutable) |
| hallazgos | id, proyecto_id, contrato_id, severidad, descripcion, evidencia (documentos), fecha, plazo_respuesta, respuesta, estado, creado_por |
| revisiones_diseno | id, proyecto_id, documento_id, version, disciplina, ciclo, observaciones, estado, revisor_id, fecha |
| evaluaciones_proveedor | id, proyecto_id, contrato_id (opcional), proveedor, puntajes por criterio, puntaje_total, recomendacion (recomendar, con_reservas, no_recomendar), evaluador_id, fecha |
| asesorias | id, proyecto_id, tema, tipo (estudio_mercado, investigacion, estudios_previos_pliegos), fuentes, conclusiones, recomendacion, autor_id, fecha |
| informes_interventoria | id, proyecto_id, alcance_id, tipo (periodico, especial, sancionatorio, final), periodo, acta_pago_id (opcional), contenido, firmado_por, fecha |

**Actividades (v3.3, migración 0024)**

| Tabla | Campos principales |
| --- | --- |
| actividades | id, proyecto_id, titulo, descripcion, responsable_id (perfil, opcional), fecha_limite, prioridad (alta, media, baja), estado (por_hacer, en_curso, bloqueada, hecha), riesgo_id (opcional), wbs_id (opcional), creado_por, completada_en, creado_en, actualizado_en |

**Monitoreo, control y cierre**

| Tabla | Campos principales |
| --- | --- |
| mediciones_evm | proyecto_id, fecha_corte, bac, pv, ev, ac, origen (manual, calculado) |
| reportes_semanales | id, proyecto_id, semana, fecha_reporte, proxima_revision, estado_reportado, logros, alertas, decisiones_requeridas, proximos_hitos, foto de indicadores (pv, ev, ac, spi, cpi, avance fisico, avance presupuestal, hitos cumplidos), enviado_en |
| cambios | id (CC-AAAA-NNN), proyecto_id, contrato_id (opcional), fecha_solicitud, solicitante_id, tipo, descripcion, justificacion, impacto_alcance, impacto_costo, impacto_dias, ambitos_impacto, estado_flujo, aprobador_id, fecha_aprobacion, responsable_implementacion, observaciones (nivel y % de variación calculados) |
| reuniones | id, proyecto_id, fecha, tipo, tiene_acta, acuerdos |
| evaluaciones_patrocinador | proyecto_id, mes, puntaje (1 a 5) |
| lecciones_aprendidas | id, proyecto_id, cambio_id (opcional), categoria, descripcion, recomendacion |
| cierres | proyecto_id, fecha_entrega, receptor, observaciones |
| documentos | id, proyecto_id, tipo (plano, contrato, acta, informe, otro), nombre, ruta_archivo, version, subido_por, fecha, entidad_tipo, entidad_id |

**Cambios del modelo en la v3.0**

| Tabla | Cambio |
| --- | --- |
| actividades | v3.3, migración 0024: tabla con seguridad por filas, auditoría y disparador `actividades_validar` (responsable del equipo, ligas del mismo proyecto, fecha de cierre y límite de lo que cambia quien solo es responsable); función `puede_gestionar_actividades` |
| stakeholders y contactos | v3.2, migración 0023: columnas correo, telefono y contacto_id; tabla `contactos`; función `puede_usar_directorio` y disparador `interesado_vincular_contacto` |
| riesgos | Nuevas columnas: frente, causa, consecuencia, momento_control, fecha_objetivo, referencia. Función `riesgos_importar`. Ahora con auditoría |
| contratos | Nuevas columnas: estado_aprobacion (pendiente, aprobado), aprobado_por, aprobado_en. Los contratos existentes quedan aprobados |
| capitulos | `wbs_id` en uso: liga opcional a la EDT, con funciones `capitulos_desde_edt` y `capitulos_vincular_edt` y herencia de capítulo en las tareas |
| festivos | Solo fechas excepcionales; los festivos de Colombia se calculan por función |
| contadores | Consecutivos por proyecto que no se reutilizan (códigos de riesgos, cambios y similares) |
| migraciones_aplicadas | Control del instalador: cada migración se aplica una sola vez |
| parametros | Nuevas claves (sección 9) |

El esquema completo está en `supabase/migrations/0001` a `0023`. En la auditoría de octubre de 2026 (migraciones 0001 a 0016) las 47 tablas tenían seguridad por filas (RLS); las escrituras sensibles pasan por funciones de base de datos.

Los valores derivados no se guardan; se calculan a partir de estos datos. Excepción: la foto de indicadores del reporte semanal, que es histórica y no se recalcula.

## 8. Roles y permisos (propuesta a validar)

| Rol | Alcance | Puede |
| --- | --- | --- |
| Administrador | Todo | Usuarios, parámetros, estructura |
| Director general de planificación y proyectos | Todo el portafolio | Ver todo; autorizar anticipos de contratos; aprobar cambios moderados y críticos; consultar el dashboard completo |
| Analista PMO | Todo el portafolio | Consolidar, evaluar impacto de cambios, mantener el dashboard y los reportes |
| Gerente de proyecto | Sus proyectos | Editar ficha, acta, WBS, riesgos, presupuesto, cronograma, contratos; radicar cambios y aprobar los menores; emitir reportes |
| Patrocinador | Sus proyectos | Ver; firmar el acta y los cambios de más de 5 % del presupuesto |
| Finanzas | Portafolio | Ver presupuesto, contratos y pagos; actualizar flujo de caja (fase futura) |
| Supervisor de obra | Obras asignadas | Crear bitácoras, subir fotos, actualizar avance de sus tareas |
| Interventoría | Contratos asignados | Ver, conceptuar, verificar avance, registrar hallazgos e informes. No edita datos del contrato ni aprueba (módulo N y matriz siguiente). Sub-roles: director, técnico, administrativo, financiero, jurídico o contable |
| Consulta | Proyectos asignados | Solo lectura (cliente, directivos) |

**Actividades (v3.3).** Las ven quienes ya ven el proyecto (administrador, director general, analista PMO, finanzas y el equipo). Las crean, editan y borran el administrador, el gerente del proyecto, el director general y el analista PMO. La persona responsable cambia solo el estado de las suyas. La interventoría ve únicamente las que le asignaron o creó, solo puede asignárselas a sí misma, no las liga a riesgos (que no ve) y puede editar y borrar las que creó. Supervisor, patrocinador, consulta y finanzas no crean actividades. Las reglas viven en la base de datos (`puede_gestionar_actividades`, seguridad por filas y disparador).

**Directorio de contactos (v3.2).** Lo ven, crean y editan el administrador, el director general, el analista PMO y quien sea gerente de algún proyecto; solo el administrador elimina. Finanzas, supervisión, patrocinio, consulta e interventoría no lo ven. Las reglas viven en la base de datos (`puede_usar_directorio`, seguridad por filas).

**Crear proyectos y roles nuevos (decisión del 15 de octubre de 2026).** Solo el administrador crea proyectos y asigna personas a ellos. Se consideró un rol global «gerente junior» que creara y gestionara sus propios proyectos sin acceso a estructura ni parámetros; **se decidió no crearlo y dejar los roles como están**. Para que un gerente nuevo gestione un proyecto, el administrador lo crea y lo asigna como «Gerente de proyecto» en «Equipo del proyecto». Análisis técnico de lo que habría implicado: una migración, cambios de tipos, permisos y pantalla «Nuevo proyecto», pruebas de base de datos y reinstalar el SQL.

**Matriz propuesta para Interventoría** (ver P5 y P9):

| Módulo | Acceso | Acciones |
| --- | --- | --- |
| A. Dashboard PMO | Sin acceso | |
| N1. Tablero del proyecto | Vista reducida | Ver avance reportado y verificado, actas y cambios pendientes de concepto, hallazgos |
| B. Ficha y acta | Solo ficha básica y alcance | Ver |
| C, E, G, H | Sin acceso | |
| D. WBS | Lectura | Ver |
| F. Cambios | Los ligados a sus contratos | Ver y emitir concepto |
| I. Documentos | Carpetas de sus contratos | Ver, subir, versionar informes y revisiones |
| J. Presupuesto | Sin acceso en la v3.0 (decisión P9: el presupuesto no se expone a la interventoría) | |
| K. Cronograma | Lectura | Ver; registrar avance verificado |
| L. Bitácora | Lectura | Visto bueno, comentarios y entradas propias |
| M. Contratos y pagos | Lectura de sus contratos y actas | Conceptuar sobre actas, amortización y anticipo; no editar valores |
| N. Interventoría | Total en su alcance | Crear conceptos, hallazgos, revisiones e informes |

El sub-rol limita el tipo de concepto: por ejemplo, el financiero no conceptúa sobre diseños, y el técnico no conceptúa sobre amortización del anticipo.

La matriz definitiva por módulo y por acción se valida con el usuario (ver P5).

**Reglas de permisos adoptadas en la construcción (v3.0)**

- El **supervisor de obra** ve el presupuesto; solo el administrador y el gerente lo modifican. El gerente de cada proyecto puede editar los datos de su proyecto.
- Las asignaciones de interventoría ya creadas solo las cambian o quitan el administrador o el director general.
- Los contratos nuevos los aprueba el director general (módulo M). Cambios y anticipos tienen parámetros de prueba para el administrador, en «no» por defecto.
- El registro de cambios del presupuesto lo ven también finanzas y el analista PMO.
- El **analista PMO** se usa además como usuario técnico de solo lectura para las tareas programadas (módulos O y P); no se emplea la clave secreta de Supabase.
- Siempre debe quedar al menos un administrador.
- Los permisos se aplican en la base de datos, no solo en la pantalla.

## 9. Parámetros configurables

Se guardan en la tabla `parametros`. Prevalece el valor del proyecto sobre el del portafolio, y este sobre el global. Todo cambio queda en auditoría.

| Parámetro | Valor inicial | Origen |
| --- | --- | --- |
| retencion_garantia_pct | 10 | Reglas de contratos |
| anticipo_max_pct | 20 | Reglas de contratos; rige para todos los contratos |
| anticipo_umbral_referencia_cop | 350.000.000 | Reglas de contratos; por debajo, lo normal es no dar anticipo |
| spi_verde_min, cpi_verde_min | 0,95 | Libro, Dashboard RAG |
| spi_amarillo_min, cpi_amarillo_min | 0,85 | Libro, Dashboard RAG |
| tcpi_max | 1,10 | Libro, KPIs y EVM |
| riesgo_critico_min, alto_min, medio_min | 15, 8, 4 | Libro, Registro de Riesgos |
| cambio_menor_max_pct, cambio_moderado_max_pct | 2, 5 | Metodología GL |
| cambio_firma_patrocinador_pct | 5 | Libro, Registro de Cambios |
| cambio_aprobador_menor | Gerente de proyecto | Usuario, 9 de octubre de 2026 |
| cambio_aprobador_moderado, cambio_aprobador_critico | Director general de planificación y proyectos | Usuario, 9 de octubre de 2026 |
| cambio_umbral_monto_cop | 10.000.000 (valor del prototipo SGCC, por confirmar) | SGCC, Configuración |
| interventoria_vb_acta_obligatorio | Sí | Propuesta; requiere concepto favorable antes de aprobar el pago |
| plazo_hallazgo_observacion, plazo_hallazgo_no_conformidad, plazo_hallazgo_incumplimiento_grave | 5, 3 y 1 días hábiles | Propuesta, ver S12 |
| criterios_evaluacion_proveedor | Calidad, plazo, seguridad y salud, documentación, respuesta a requerimientos; escala 1 a 5 | Propuesta, ver S12 |
| ev_usa_avance_verificado | Sí | Supuesto S11 |
| catalogo_disciplinas_diseno | Arquitectónico, estructural, geotécnico, hidrosanitario, eléctrico, otros | Propuesta, por validar |
| contrato_admin_puede_aprobar | no (solo para pruebas) | Usuario, 10 de octubre de 2026 |
| cambio_admin_puede_aprobar, anticipo_admin_puede_autorizar | no (solo para pruebas) | Construcción |
| alertas_correo_activas | sí | Usuario, 10 de octubre de 2026 |
| informe_semanal_activo | sí | Usuario, 11 de octubre de 2026 |
| reporte_dias_gracia | 2 días después del domingo de la semana | Propuesta, P4 |
| tipos_cambio, tipos_reunion, tipos_contrato, categorias_leccion, categorias_riesgo | Catálogos configurables (ver `supabase/migrations`) | Propuesta; resuelve D3 |
| kpi_hitos_min | 90 % | Libro |
| kpi_riesgos_con_plan | 100 % | Libro |
| kpi_cambios_controlados_min | 85 % | Libro |
| kpi_reuniones_con_acta | 100 % | Libro |
| kpi_satisfaccion_min | 4,0 | Libro |
| kpi_reportes_a_tiempo | 100 % | Libro |
| stakeholder_cortes_estrategia | 16, 10, 5 (sobre poder × interés) | Libro; ver D2 |

**Criterios del semáforo** (base del libro, con la decisión del usuario sobre riesgos): Verde con SPI y CPI de 0,95 o más, riesgos bajos y sin cambios pendientes. Amarillo con SPI o CPI entre 0,85 y menos de 0,95, riesgos medios o altos y cambios pendientes que no sean críticos. Rojo con SPI o CPI por debajo de 0,85, algún riesgo Crítico activo o algún cambio crítico pendiente.

## 10. Pila tecnológica propuesta

| Capa | Herramienta | Uso |
| --- | --- | --- |
| Interfaz | Next.js 16 (App Router) con React 19, TypeScript y Tailwind 4 | Aplicación web adaptable a celular |
| Base de datos | Supabase (PostgreSQL) | Datos del portafolio y de cada proyecto |
| Usuarios y permisos | Supabase Auth con seguridad por filas | Acceso por portafolio, proyecto y rol |
| Archivos | Supabase Storage | Fotos de bitácora, planos y contratos |
| Publicación | Vercel | Enlace propio y despliegue |
| Código | Git y GitHub | Versiones y respaldo |
| Correo | Nodemailer (SMTP, p. ej. Gmail) o Resend | Alertas y envío semanal (módulos O y P) |
| Tareas programadas | Cron de Vercel | Resumen diario 7:00 a. m. y informe semanal los lunes 7:30 a. m. (Colombia) |
| Documentos | ExcelJS y pdf-lib, con tipografías incrustadas | Exportaciones e informe gerencial |
| Pruebas | Vitest y PGlite (PostgreSQL en memoria) | Cálculos, reglas y permisos |
| Instalación | `scripts/migrar.mjs` y `supabase/instalar_todo.sql` | Aplicar las migraciones al construir, o pegar el instalador en el editor SQL de Supabase |

**Variables de entorno:** conexión a Supabase; para correo, `SMTP_USUARIO` y `SMTP_CLAVE` (o `RESEND_API_KEY` y `CORREO_REMITENTE`); `CRON_SECRET`; `ALERTAS_USUARIO` y `ALERTAS_CLAVE` (usuario de solo lectura con rol Analista PMO); opcional `URL_PUBLICA`. Los nombres y pasos están en el `README.md`; los valores nunca se guardan en el repositorio.

Planes, límites y precios de estas herramientas cambian: verificarlos en sus sitios oficiales antes de pasar a producción. En particular, el plan Hobby de Vercel es de uso no comercial: para uso corporativo hay que contratar un plan apto y calcular el costo real de operación (pendiente P13). Antes de cargar datos reales hay que definir la región del servidor y quién accede a presupuestos y contratos, que son información confidencial.

## 11. Requisitos no funcionales

- Diseño pensado primero para celular, sobre todo la bitácora. El dashboard PMO debe leerse bien en pantalla grande y en celular.
- Idioma español, formato numérico y de fechas de Colombia, moneda COP.
- Seguridad: acceso por rol y por proyecto; archivos privados; auditoría de cambios en contratos, pagos, anticipos, línea base y parámetros.
- Respaldos de base de datos y archivos.
- Pruebas automáticas de los cálculos con los casos de la sección 13 (328 pruebas unitarias y 586 comprobaciones de base de datos al 21 de octubre de 2026). Comandos: `npm run verificar` (tipos, lint, pruebas y compilación) y `npm run test:sql`.
- Exportación a Excel y PDF: construida (hito 10) para el dashboard, el reporte semanal, el valor ganado, los cambios, los contratos y el informe gerencial.

## 12. Hitos de construcción

Cada hito termina con un entregable que se prueba con datos reales y se confirma antes de pasar al siguiente.

| Hito | Contenido | Se acepta cuando |
| --- | --- | --- |
| 1. Cimientos | Inicio de sesión, roles (incluido Interventoría con acceso por contrato), organizaciones, portafolios, proyectos, parámetros, auditoría | Un usuario sin acceso a un proyecto no lo ve; los parámetros se editan y quedan auditados; el rol Interventoría solo ve los contratos asignados (caso 13.9, pruebas de acceso) |
| 2. Dashboard PMO v1 | Ficha y acta; captura manual de BAC, PV, EV, AC; semáforo calculado solo con SPI y CPI; dashboard N0 y tablero N1 básico | Se cumplen los casos 13.3 y 13.4 |
| 3. Planificación | Stakeholders, WBS y riesgos; los riesgos se suman al semáforo | Casos 13.5, 13.6 y 13.7 |
| 4. Control de cambios | Flujo de 8 fases, niveles, aprobación por nivel, firma del patrocinador, versionado de línea base | Caso 13.8, incluida la aprobación por nivel |
| 5. Reporte semanal y KPIs de gestión | Reporte con indicadores prellenados, hitos, reuniones, evaluación del patrocinador | El dashboard muestra los seis KPIs con tendencia |
| 6. Presupuesto y cronograma | APU por capítulos, Curva S, Gantt; el valor ganado pasa a calcularse solo | Casos 13.2 y 13.3 coinciden con la captura manual previa |
| 7. Contratos y pagos | Contratos, actas, anticipo autorizado, retención | Caso 13.1 |
| 8. Bitácora móvil | Formulario con fotos permanentes y su efecto en el avance | Registro desde celular que actualiza el avance de la tarea |
| 9. Documentos y cierre | Repositorio con versiones, cierre y lecciones aprendidas | Un proyecto cerrado sale del dashboard activo y queda en histórico |
| 10. Reportes y exportaciones | Excel y PDF del dashboard y de los reportes | Exportación coincide con la pantalla |
| 11. Interventoría | Módulo N completo: conceptos, flujo del acta, avance verificado, hallazgos, revisión de diseños, evaluación de proveedores, asesoría e informes | Casos 13.9 y 13.10. Puede construirse justo después del hito 8 si se necesita antes |

Fase posterior, fuera de esta versión: flujo de caja, dependencias y ruta crítica, programas, multimoneda.

### 12.1 Estado de construcción e hitos adicionales (v3.0 a v3.2)

Los hitos 1 a 11 están **construidos**, con pruebas de base de datos (`pruebas-sql/t-h1` a `t-h9` y `t-h11`; el hito 10, exportaciones, se cubre con pruebas unitarias) y pruebas unitarias de los cálculos. «Probado» significa con PostgreSQL real en memoria y un simulador de la API de Supabase; la primera corrida contra el Supabase real la hizo el usuario con datos ficticios.

| Hito | Contenido | Estado y prueba |
| --- | --- | --- |
| 12. Instalación | Migraciones automáticas al construir (`scripts/migrar.mjs`, con bloqueo de un despliegue a la vez) e instalador único repetible (`supabase/instalar_todo.sql`) para pegar en el editor SQL de Supabase. La conexión directa desde Vercel falló por autenticación, por eso el instalador es el camino vigente | Construido. `t-instalador` y `t-migraciones`. El usuario ejecutó el instalador y confirmó que funciona |
| 13. Auditoría y correcciones | Revisión independiente de base y código (migración 0017) y festivos automáticos (0016); recorrido en celular con seis roles. Detalle en `docs/AUDITORIA.md` | Construido. `t-auditoria` (19 comprobaciones) |
| 14. Aprobación de contratos | El director aprueba los contratos nuevos (0018, módulo M) | Construido. Cubierto en `t-h7`, `t-h4` y `t-auditoria` |
| 15. Marca, menú lateral y ayuda | PMO360, menú lateral por código, cambio de usuario, ayuda «?», glosario y guías (módulo Q); reemplazo de anglicismos | Construido. Recorridos en navegador y pruebas unitarias |
| 16. Alertas por correo | Avisos inmediatos y resumen diario (0019, módulo O) | Construido. `t-alertas` (12 comprobaciones). **Sin envío real todavía** |
| 17. Presupuesto sobre la EDT | Capítulos desde la EDT, herencia en tareas y costo por elemento (0020) | Construido. `t-edt-presupuesto` (21 comprobaciones) |
| 18. Riesgos ampliados e importación | Campos nuevos e importación desde Excel (0021, módulo E) | Construido. `t-riesgos-importar` (17) y pruebas unitarias del lector. Probado con los 41 riesgos del Excel de la Planta El Silencio en una copia local con datos ficticios |
| 19. Informe gerencial y envío semanal | Informe de una página en PDF y Excel, botón por proyecto, correo semanal con adjuntos y parámetro de apagado (0022, módulo P) | Construido. 12 pruebas unitarias; probado en copia local con envío por «consola». **Sin envío real todavía** |
| 20. Marco FARO y presentación | Framework de cuatro pasos (sección 17), guion para exponer, lámina de una página en PDF, PNG y PPTX editable, documento corto, guion de video y el hilo con el nombre PMO360 (`docs/presentacion-faro/`, artifact web «FARO – Que ningún proyecto navegue a ciegas») | Producido el 11 de octubre de 2026. No es código: no tiene pruebas automáticas. Pendiente reemplazar los marcadores `[Tu nombre]` y `[por definir]` (P29) |
| 21. Tablero del proyecto y orden por código | Tablero de control con proyectos ordenados por código; gráfico de avance «planeado frente a construido»; resumen de control en rejilla (estado, SPI, CPI, BAC, AC, EAC, riesgos, cambios y decisiones); ficha compacta bajo el nombre del proyecto (sección 3) | Construido el 12 de octubre de 2026. Verificado en pantalla ancha y en celular de 390 px; `tsc`, `eslint` y compilación correctos |
| 22. Memoria del proyecto | Repositorio `docs/memoria/` (sección 18): historia, marco teórico, buenas prácticas de documentación, fichas de decisión, trazabilidad, lecciones, fuentes, gobierno y un PDF de origen y propósito | Creado el 14 de octubre de 2026. Enlaces internos verificados; no es código |
| 23. Interesados con contacto y directorio reutilizable | Correo y teléfono en el interesado; directorio de contactos con vinculación automática, selector «Reutilizar un contacto del directorio» al agregar, pantalla del directorio con búsqueda y edición y enlace en el menú lateral (módulo C) | Construido el 16 de octubre de 2026. `t-contactos` (38 comprobaciones de base de datos), 9 pruebas unitarias nuevas y recorrido en navegador (escritorio y celular de 390 px, gerente y supervisor) |
| 24. Actividades y Mi trabajo | Trabajo asignado a personas con responsable, fecha límite, prioridad y estado, ligable a un riesgo y a un elemento de la EDT; tablero por proyecto y pantalla «Mi trabajo» (módulo R; migración 0024) | Construido el 16 de octubre de 2026. `t-actividades` (54 comprobaciones de base de datos), 7 pruebas unitarias nuevas, `tsc`, `eslint` y compilación correctos. **Sin recorrido en navegador todavía** |
| 25. Exportaciones con la identidad de la marca | PDF y Excel de todas las tablas (tablero de control, reporte semanal, valor ganado, cambios y contratos) con logo, tipografías Baloo 2 y Roboto, paleta verde, etiquetas de semáforo y, en el PDF del tablero, tarjetas de indicadores | Construido el 17 de octubre de 2026. 4 pruebas unitarias nuevas; revisado en imagen (PDF y Excel convertido) con datos de ejemplo |

## 13. Casos de prueba de referencia

**13.1 Contratos.** Contrato de 480.000.000, anticipo 20 % (96.000.000), retención 10 %.

| Acta | Bruto | Amortización | Retención | Neto |
| --- | --- | --- | --- | --- |
| 1 | 120.000.000 | 24.000.000 | 12.000.000 | 84.000.000 |
| 2 | 150.000.000 | 30.000.000 | 15.000.000 | 105.000.000 |
| Total | 270.000.000 | 54.000.000 | 27.000.000 | 189.000.000 |

Anticipo pendiente por amortizar: 42.000.000. Desembolsado: 285.000.000 (anticipo + netos).

**13.2 Avance físico.** Preliminares (peso 3, avance 100 %), Cimentación (peso 17, 100 %), Estructura (peso 30, 30 %) y el resto en 0 %: avance físico = 3 + 17 + 9 = 29 %.

**13.3 Valor ganado.** BAC 1.000.000.000; PV 400.000.000; EV 360.000.000; AC 400.000.000.

| Índice | Resultado |
| --- | --- |
| SPI | 0,90 |
| CPI | 0,90 |
| SV | −40.000.000 |
| CV | −40.000.000 |
| EAC | 1.111.111.111 |
| ETC | 711.111.111 |
| TCPI | 1,0667 (no supera 1,10) |
| VAC (adición) | −111.111.111 |
| Avance físico, plan y financiero | 36 %, 40 % y 40 % |

Con riesgos bajos y sin cambios pendientes, el estado calculado es Amarillo (SPI y CPI entre 0,85 y 0,95).

**13.4 Portafolio.** Tres proyectos, en millones de COP:

| Proyecto | BAC | PV | EV | AC | SPI | CPI | Estado (riesgos bajos, sin cambios) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | 1.000 | 400 | 360 | 400 | 0,90 | 0,90 | Amarillo |
| B | 600 | 300 | 285 | 290 | 0,95 | 0,9828 | Verde |
| C | 800 | 200 | 150 | 210 | 0,75 | 0,7143 | Rojo |
| Portafolio | 2.400 | 900 | 795 | 900 | 0,8833 | 0,8833 | |

El SPI del portafolio es 795 / 900 = 0,8833. El promedio simple de los tres SPI daría 0,8667, que es incorrecto como indicador consolidado.

**13.5 Riesgos del libro** (probabilidad × impacto): R01 3 × 5 = 15, Crítico. R02 4 × 4 = 16, Crítico. R03 3 × 4 = 12, Alto. R05 2 × 3 = 6, Medio. Con los 7 riesgos del libro: 2 críticos, 4 altos, 1 medio, 0 bajos.

**13.6 Stakeholders del libro** (poder × interés): Patrocinador 25, Director de Obras 16, Comunidad 8, Contratista principal 15, Ente regulador 15. Ver la discrepancia D2 antes de fijar el resultado esperado de la estrategia.

**13.7 Semáforo con riesgos y cambios.** Un proyecto con SPI 0,98, CPI 0,97, un riesgo Crítico activo y sin cambios queda en Rojo. Con el mismo SPI y CPI y un riesgo máximo Alto (sin Crítico), queda en Amarillo.

**13.8 Cambios** sobre un contrato de 480.000.000 (2 % = 9.600.000; 5 % = 24.000.000):

| Impacto | % | Nivel | Aprueba | Firma del patrocinador |
| --- | --- | --- | --- | --- |
| 8.000.000 | 1,67 % | Menor | Gerente de proyecto | No |
| 12.000.000 | 2,50 % | Moderado | Director general de planificación y proyectos | No |
| 30.000.000 | 6,25 % | Crítico | Director general de planificación y proyectos | Sí |

**13.9 Interventoría: acta de pago y acceso.** Con el contrato de 480.000.000 del caso 13.1 y una interventoría asignada con el parámetro `interventoria_vb_acta_obligatorio` activo:

| Paso | Resultado esperado |
| --- | --- |
| Se radica el acta 1 (120.000.000) | Estado Radicada; aparece como pendiente de concepto en N1 |
| El interventor financiero emite No aprobado | El acta pasa a Con observaciones; no puede pasar a Aprobada para pago |
| Emite nuevo concepto Aprobado con observaciones | El anterior queda en el historial; el acta puede aprobarse para pago |
| El interventor intenta cambiar el valor bruto del acta | Rechazado por permisos |
| El interventor técnico intenta emitir un concepto sobre amortización | Rechazado por sub-rol |
| Un interventor asignado solo al contrato A abre el contrato B | No lo ve |
| Un interventor abre el dashboard del portafolio | No tiene acceso |

**13.10 Avance verificado.** Con el caso 13.2: avance reportado 29 %. La interventoría verifica Estructura en 20 % en lugar de 30 %: avance verificado = 3 + 17 + 6 = 26 %. Con BAC de 1.000.000.000, el valor ganado es 290.000.000 con el avance reportado y 260.000.000 con el verificado; la diferencia de avance es 3 puntos. Con `ev_usa_avance_verificado` activo, el EV del proyecto es 260.000.000.

**13.11 Importación de riesgos desde Excel.** El registro de la Planta Empacadora El Silencio trae 41 riesgos en siete frentes. Resultado esperado y verificado en la copia local: 41 riesgos importados, con **5 críticos, 23 altos, 13 medios y 0 bajos**, igual que la hoja Resumen del Excel. Por frente: Transversal 11, F1 4, F2 5, F3 5, F4 4, F5 5 y F6 7. Reimportar el mismo archivo no duplica: actualiza los 41.

Equivalencia de la escala (verificada con prueba unitaria; Crítico desde 15, Alto desde 8, Medio desde 4):

| Probabilidad | Impacto | Puntaje | Nivel |
| --- | --- | --- | --- |
| Alta (4) | Alta (4) | 16 | Crítico |
| Alta (4) | Media (2) | 8 | Alto |
| Media (2) | Alta (4) | 8 | Alto |
| Media (2) | Media (2) | 4 | Medio |
| Baja (1) | Alta (4) | 4 | Medio |
| Alta (4) | Baja (1) | 4 | Medio |
| Baja (1) | Media (2) | 2 | Bajo |
| Media (2) | Baja (1) | 2 | Bajo |
| Baja (1) | Baja (1) | 1 | Bajo |

Con 5 riesgos críticos activos, el estado general del proyecto es Rojo (regla de la sección 9). Las referencias normativas que traen los riesgos (por ejemplo RETIE, NSR-10 o decretos ambientales) vienen del Excel y la plataforma no las verifica: validarlas con el área responsable.

**13.12 Contratos nuevos.** Un gerente crea un contrato de 480.000.000: queda pendiente; no admite anticipo ni actas de pago y no sirve de base para el nivel de un cambio. El director general lo aprueba y desde entonces opera como en el caso 13.1. El gerente no puede cambiar el valor de un contrato aprobado.

**13.13 Quién recibe el informe semanal.** Con dos proyectos activos (p1 y p2): el director general recibe p1 y p2; el gerente de p1 recibe solo p1; una persona con rol de interventoría en p2 no recibe nada; una persona sin proyectos no recibe nada; un correo inválido o ausente no recibe nada; el usuario técnico del cron no recibe nada. Con más de seis proyectos por persona se adjunta solo el PDF.

**13.12 Interesados con contacto y directorio.** Un gerente registra en el proyecto 1 a «Ana Pérez» con correo `  Ana.Perez@Empresa.co ` y teléfono `+57 300 123 4567`: queda guardada como `ana.perez@empresa.co`, vinculada a un contacto nuevo del directorio. En el proyecto 2, otro gerente registra a «Ana P.» con el mismo correo y otro teléfono: **no se duplica el contacto**; los dos interesados comparten contacto y el directorio queda con el último teléfono y nombre, y conserva el rol. Un correo sin formato o un teléfono con letras se rechazan. Poder e interés quedan en cada interesado y el directorio no los guarda. Ven el directorio el administrador, el director, el analista PMO y los gerentes; no lo ven supervisión, interventoría, finanzas ni quien no tiene rol. Un gerente no borra contactos; el administrador sí, y el interesado se conserva sin vínculo. Verificado en `pruebas-sql/t-contactos.mjs` (38 comprobaciones), con 9 pruebas unitarias y un recorrido en navegador del selector «Reutilizar un contacto del directorio», la búsqueda y el acceso por rol.

## 14. Decisiones, supuestos, discrepancias y pendientes

**Decisiones confirmadas por el usuario**

| Tema | Decisión |
| --- | --- |
| Presupuesto | Siempre por capítulos, un solo nivel; la plataforma es gerencial, no de residencia de obra |
| Anticipo | Discrecional del director general de planificación y proyectos; tope de 20 % para todos los contratos; lo normal es no darlo en contratos menores a 350 millones |
| Semáforo de riesgos | El proyecto solo pasa a Rojo por riesgos cuando hay un riesgo Crítico |
| Aprobación de cambios | Menor: gerente de proyecto. Moderado y crítico: director general de planificación y proyectos |
| Alcance de la interventoría | No contrata ni adjudica; recomienda según sus evaluaciones de proveedores y contratistas. No contrata diseños. Asesora con investigación y estudios de mercado para apoyar decisiones |
| Presupuesto y permisos | El supervisor ve el presupuesto; solo el administrador y el gerente lo modifican. El gerente de cada proyecto edita los datos de su proyecto. La interventoría no ve el presupuesto |
| Datos | Solo datos ficticios hasta decidir región y confidencialidad |
| Nueva contratación | El director general revisa y aprueba cada contrato nuevo |
| Alertas | Aviso por correo al responsable cuando una decisión queda pendiente, más un resumen diario |
| Marca | Nombre PMO360, mensaje «Control integral de Proyectos», logo de GreenLand como imagen principal. La idea del nombre es del usuario; se evaluaron cuatro opciones el 10 de octubre de 2026 (sección 1.2) |
| Navegación y ayuda | Menú lateral izquierdo con proyectos ordenados por código; títulos en español; ayuda «?» y glosario; cambio de usuario en el pie |
| Presupuesto y EDT | El presupuesto puede construirse sobre los elementos de la EDT (creación por nivel y herencia en tareas) |
| Informe gerencial | Una página, en Excel y PDF, desde cada proyecto; envío automático los lunes a las 7:30 a. m. a las personas registradas, con resumen en el cuerpo |
| Presentación | Framework FARO (sección 17); el piloto propuesto es de 90 días con 3 a 4 de los 12 proyectos; GreenLand como marca; presenta el usuario; no se citan cifras de ahorro porque no existen |
| Tablero del proyecto | El gráfico de avance sustituye a la tarjeta «Avance físico / financiero» por redundante; resumen de control en rejilla; ficha bajo el nombre; tablero de control ordenado por código (12 de octubre de 2026) |
| Roles y creación de proyectos | No se crea un rol «gerente junior». Solo el administrador crea proyectos; un gerente nuevo se asigna como «Gerente de proyecto» (15 de octubre de 2026) |
| Memoria del proyecto | Se documenta la historia, las decisiones y la trazabilidad en `docs/memoria/`, con niveles de verificación y regla de no inventar (14 de octubre de 2026) |
| Interesados y directorio | Los interesados llevan correo y teléfono; los contactos se guardan en un directorio compartido entre proyectos y se reutilizan al registrar interesados nuevos (16 de octubre de 2026) |
| Gestor de tareas y Microsoft 365 | Se mantiene «Actividades» como mínimo propio; la integración con Microsoft 365 (Teams y Planner) queda en exploración, con una guía para TI y una prueba en un proyecto antes de integrar (16 y 17 de octubre de 2026; P37, ADR-0026) |

**Discrepancias detectadas en los documentos del usuario**

| ID | Hallazgo | Propuesta |
| --- | --- | --- |
| D1 | El libro está en USD; la plataforma trabaja en COP | Moneda por proyecto, COP por defecto, sin conversión |
| D2 (resuelta en la construcción: la estrategia sigue la leyenda del libro, por producto) | En la hoja Stakeholders, Director de Obras (4 × 4 = 16) figura como "Mantener satisfecho" y Contratista principal (3 × 5 = 15) como "Gestionar de cerca", pero la leyenda de la misma hoja dice que 16 o más es "Gestionar de cerca" y 10 a 15 "Mantener satisfecho" | Decidir si la estrategia se define por cuadrantes (poder alto y bajo, interés alto y bajo) o por el producto, y corregir los ejemplos |
| D3 | Tres catálogos de tipo de cambio: libro (6 tipos), Metodología GL (6 tipos) y Formato de cambio (5 opciones) | Catálogo único configurable; valor inicial a elegir |
| D4 | El libro mide el 5 % sobre el presupuesto; la Metodología GL, sobre el presupuesto del contrato | Contrato si el cambio está ligado a uno; BAC en los demás casos |
| D5 | El prototipo SGCC usa un umbral de $10.000.000 y 5 %; la Metodología GL propone 2 % y 5 % | Confirmar cuáles rigen y cómo se combinan |
| D6 | Tres vocabularios de estado de cambio: Pendiente, Aprobado y Rechazado (formato); En revisión e Implementado (libro); 8 fases (Metodología GL) | Usar las 8 fases como flujo y derivar los otros |

**Supuestos adoptados (a validar)**

| ID | Supuesto |
| --- | --- |
| S1 | El estado general calculado es el peor de las cuatro dimensiones. Es consistente con los 5 ejemplos del libro. Un riesgo Alto da Amarillo (inferencia de la decisión sobre riesgos Críticos) |
| S2 | BAC es la suma de capítulos del presupuesto aprobado; los capítulos pueden incluir rubros ajenos a la obra |
| S3 | EV = avance físico ponderado × BAC, con pesos de tarea digitados. Mejora: derivarlos del presupuesto |
| S4 | AC es el gasto real registrado. Pendiente decidir si se alimenta con el valor bruto de las actas de pago (costo incurrido) y no con desembolsos, porque un anticipo es un pago, no un costo |
| S5 | Los indicadores del portafolio se agregan sumando, no promediando |
| S6 | El porcentaje de un cambio se mide sobre el contrato si está ligado a uno; si no, sobre el BAC. Fronteras: menor hasta 2 %, moderado de más de 2 % hasta 5 %, crítico por encima de 5 % |
| S7 | Se agregan la estrategia de riesgo Aceptar y los estados Materializado y Cerrado |
| S8 | La amortización del anticipo es proporcional a cada acta; la retención se libera al ejecutar el 100 % del contrato |
| S9 | Cambios en el semáforo: Rojo con un cambio crítico pendiente; Amarillo con cambios menores o moderados pendientes; Verde sin cambios pendientes. Interpreta "cambios mayores" del libro |
| S10 | La interventoría conceptúa, verifica y observa, pero no aprueba ni modifica datos del contrato (límite que fija la guía de Colombia Compra Eficiente para supervisores e interventores) |
| S11 | Con interventoría asignada, el valor ganado usa el avance verificado cuando existe; si no, el reportado |
| S12 | Los plazos de respuesta a hallazgos, los criterios de evaluación de proveedores y el formato de informe son propuestas del asesor: el usuario indicó que no existe política de plazos ni formatos. Validar con el uso real |
| S13 | Los hallazgos y el avance verificado no cambian el semáforo calculado en la v2.0 |
| S14 | El presupuesto puede construirse sobre la EDT: un capítulo se liga a un elemento por nombre o por creación desde un nivel; la tarea hereda el capítulo del ancestro más cercano; el costo de un elemento suma el de sus descendientes |
| S15 | Baja, Media y Alta de un registro de riesgos en Excel equivalen a 1, 2 y 4 en la escala de 1 a 5, porque con los cortes vigentes reproducen la matriz 3 × 3 del Excel. Se puede recalibrar en un taller de validación |
| S16 | El informe semanal lo reciben los roles globales (todos los proyectos activos) y las personas miembros de un proyecto (ese proyecto), excepto la interventoría; el correo no incluye datos de proyectos que la persona no ve en la plataforma |
| S17 | La hora de los avisos es la de Colombia (sin horario de verano): 12:00 UTC el resumen diario y 12:30 UTC el informe semanal; en Vercel Hobby el minuto exacto no está garantizado |
| S18 | El directorio se alimenta solo al guardar interesados (sin captura aparte), identifica a la persona por correo y, sin correo, por nombre; el último dato guardado gana y lo vacío no borra. Lo ven quienes gestionan proyectos, no toda la plataforma. Son supuestos del asesor: validar con el uso real |
| S19 | Las actividades son un mínimo propio y separado de las tareas del cronograma (sin peso ni efecto en el valor ganado); el responsable es una persona con cuenta; la interventoría solo gestiona las suyas. Son supuestos del asesor: validar con el uso real |

**Pendientes**

| ID | Pendiente | Estado |
| --- | --- | --- |
| P1 | Firma del patrocinador en cambios de más de 5 % | Resuelto en la construcción (se mantiene además de la aprobación del director). Queda por decidir si se extiende al cambio crítico que solo afecta el cronograma |
| P2 | Impuestos (IVA) en los impactos de costo | Resuelto: no se calculan impuestos en esta versión |
| P3 | Cambios ejecutados sin formato | Resuelto: marca «detectado sin formato» |
| P4 | Definición de «semana N.º» | Resuelto: semana calendario ISO |
| P5 | Matriz definitiva de permisos por rol, módulo y acción | Abierto: requiere validación del usuario |
| P6 | Comparar la bitácora con los requisitos contractuales de entidades públicas o de la interventoría | Abierto |
| P7 | Flujo de caja, reajustes por IPC y pólizas | Abierto; fuera del alcance de la v3.1 |
| P8 | Verificar ediciones posteriores de los estándares de portafolio y programa de PMI | Abierto |
| P9 | Qué sub-roles de interventoría contrata GreenLand y qué debe ver cada uno | Parcial: el presupuesto no se expone a la interventoría; falta validar el resto de la matriz |
| P10 | Contenido obligatorio de los estudios previos y pliegos según el régimen aplicable | Abierto |
| P11 | Validar plazos de respuesta, criterios de evaluación y formato de informe de interventoría tras el primer mes de uso | Abierto |
| P12 | **Región y confidencialidad** de los datos, incluido el tratamiento de datos personales de usuarios (revisar con Jurídica; por ejemplo, la Ley 1581 de 2012, no verificada en esta versión) | Abierto; condiciona cargar datos reales |
| P13 | **Plan de alojamiento apto para uso comercial** y cálculo del costo real de operación (hoy Vercel Hobby, de uso no comercial) | Abierto |
| P14 | **Revisión de seguridad independiente** antes de cargar datos reales | Abierto |
| P15 | Primera corrida con datos reales de un proyecto | Abierto; depende de P12 a P14 |
| P16 | **Configurar el correo en Vercel:** proveedor (SMTP o Resend), `CRON_SECRET`, `ALERTAS_USUARIO`, `ALERTAS_CLAVE` y opcional `URL_PUBLICA`; redesplegar y probar con `curl` | Abierto. El recordatorio del 12 de octubre ya se cumplió; el usuario retomó la configuración el 17 de octubre y recibió la guía por fases (sección 16). Sin envío real hasta hoy |
| P17 | **Crear el usuario Analista PMO de solo lectura** (Supabase Authentication, «Auto Confirm User») y asignarle el rol en `/usuarios` | Abierto; mismo estado que P16 |
| P18 | Variante de riesgo: registrar a mano una medición con un BAC inflado antes de aprobar el presupuesto | Abierto; documentado en `docs/AUDITORIA.md` |
| P19 | Responsables y fechas objetivo del registro de riesgos: reemplazar los roles propuestos por nombres y calificar en taller con diseñadores, Jurídica, Operación e Interventoría | Abierto; las calificaciones del Excel son preliminares |
| P20 | **Piloto de 90 días** con 3 a 4 de los 12 proyectos: elegir proyectos, responsable, medidas y criterios de éxito antes de empezar | Abierto; depende de la decisión de la dirección |
| P21 | **Línea base de ahorro de tiempo:** no existe; el piloto debe crearla (tiempo de preparar el informe semanal, antigüedad de decisiones pendientes, datos incorrectos hallados, puntualidad de reportes, percepción) | Abierto |
| P22 | Comparación con software comercial | Abierto; puede incluirse en el piloto |
| P23 | Quién mantiene la plataforma y cómo se explica su origen (construida con asistencia de inteligencia artificial y pruebas automáticas); designar un responsable y un apoyo | Abierto |
| P24 | Siglas en español (por ejemplo IDP e IDC en lugar de SPI y CPI) | Abierto; solo si se pide |
| P25 | Orden del tablero | Resuelto el 12 de octubre de 2026: por código del proyecto |
| P26 | Actualizar las referencias del PMBOK a la 8.ª edición en esta sección 2 y revisar si cambian los nombres de dominios usados en la plataforma | Abierto; memoria M-1 |
| P27 | Aportar las conversaciones anteriores o un resumen (libro, especificación inicial, prototipos, motivación) para completar la fase 0 de la historia | Abierto; memoria M-6. Solo el propietario puede hacerlo |
| P28 | Designar un revisor técnico independiente para la memoria y la revisión de seguridad | Abierto; memoria M-5 |
| P29 | Reemplazar `[Tu nombre]` y `[por definir]` en el material FARO y sustituir las escenas ilustrativas de los pasos A, R y O por ejemplos reales no sensibles, si se quiere presentarlas como hechos de GreenLand | Abierto |
| P30 | Leer en fuente primaria ISO 21502, ISO 31000, PMBOK 8.ª, Mendelow (1991) y los textos de las leyes citadas | Abierto; memoria M-2 |
| P31 | Consultar con Jurídica o con un archivista si la Ley 594 de 2000 aplica a la información de la plataforma | Abierto; memoria M-3 |
| P32 | Verificar la disponibilidad del nombre PMO360 como marca (registro de la SIC) y como dominio antes de usarlo fuera de la empresa | Abierto; no verificado |
| P33 | **Datos personales en el directorio** (nombre, correo y teléfono de terceros): definir con Jurídica la base legal, el aviso a los titulares y quién puede ver y exportar el directorio antes de cargar contactos reales (Ley 1581 de 2012 y normas de datos personales, **no verificadas** en esta versión). Se suma a P12 | Abierto; hoy solo hay datos ficticios |
| P34 | **Adopción de Actividades:** la organización no usa hoy ninguna herramienta de tareas, por lo que el riesgo es que el tablero no se actualice. Medir en el piloto de 90 días con un proyecto: porcentaje de actividades con fecha y responsable, actividades que se mueven de estado cada semana y preferencia del equipo. Decidir con esos datos si se construyen comentarios, adjuntos y avisos | Abierto; sin datos de uso |
| P35 | **Rol futuro de Carlos y administrador único de TI.** Más adelante Carlos dejará de ser administrador y será gerente de proyectos con visión del portafolio; quedará un solo administrador, el de TI (nunca dos). Propuesta: Carlos con rol global «Analista PMO» (ve todo el portafolio sin administrar) más rol de proyecto «Gerente de proyecto» en sus proyectos; no usar «Director general» salvo que deba aprobar cambios críticos y contratos nuevos. Orden del traspaso: 1) crear y asignar al administrador de TI, 2) asignar a Carlos el rol global y sus roles de gerente, 3) recién entonces quitarle el rol de administrador (la plataforma exige siempre al menos uno). A decidir con ello: el administrador de TI **ve los datos de todos los proyectos** (presupuestos, contratos, riesgos); si debe administrar sin verlos haría falta un rol nuevo «solo administración», que conviene resolver junto con P12 a P14 (confidencialidad y datos reales). El nombre «Analista PMO» no refleja el caso de Carlos; se puede mostrar con otro nombre | Abierto. Decidido el 17 de octubre de 2026: **por ahora todo sigue igual** (Carlos es administrador, crea los proyectos y el equipo). **Regla de traspaso:** siempre hay exactamente un administrador; al nombrar a otra persona administradora, quien lo era lo deja automáticamente (nunca quedan dos). Hoy la plataforma solo garantiza «al menos un administrador» (migración 0017) y permite varios, así que el traspaso automático **está por construir** antes de usarse. **Decidido (17 de octubre de 2026): Carlos, al dejar de ser administrador, pasa automáticamente a «Analista PMO»** para conservar el acceso al portafolio; sus roles de gerente en cada proyecto se mantienen. A definir al construirlo: una confirmación para que un cambio accidental no deje sin acceso al administrador actual |
| P36 | **Quién crea proyectos y arma los equipos.** Hoy solo el administrador crea proyectos y asigna personas a ellos (decisión del 15 de octubre de 2026). Con un administrador de TI cada proyecto nuevo y cada cambio de equipo pasaría por TI, un posible cuello de botella para la PMO. Opciones: a) dejarlo así (TI lo hace por solicitud; lo más sencillo y controlado); b) ampliar permisos para que un rol de la PMO cree proyectos y arme equipos sin administrar usuarios ni parámetros (cambio pequeño en permisos de base de datos, pantallas y pruebas). Decidir **antes** de traspasar el rol de administrador (P35). Mientras Carlos sea administrador, sin cambios | **Decidido (17 de octubre de 2026): cuando el administrador sea el de TI, el director general de planificación y proyectos crea los proyectos y arma los equipos** (opción b: sin administrar usuarios ni parámetros). Rige desde el traspaso de P35; **aún no se hace**: hoy esos permisos son solo del administrador y Carlos sigue siendo el administrador que crea los proyectos. Por construir con el traspaso. A definir entonces: alcance exacto del director (crear proyectos, editar la ficha, asignar y quitar miembros, reabrir proyectos cerrados, que hoy solo reabre el administrador) y que no pueda asignar roles globales |
| P37 | **Integración con Microsoft 365 (Teams y Planner).** Se exploró usar la licencia corporativa de Microsoft como capa de trabajo y dejar a PMO360 como capa de control (lectura de tareas por Microsoft Graph, solo lectura); **no se ha construido nada ni hay decisión definitiva** (ADR-0026). Pendiente del usuario: confirmar el plan de Microsoft 365. Pendiente de TI: cinco preguntas (plan, invitados externos para la interventoría, quién crea equipos, registro de aplicación en Entra ID, Power Automate) y una prueba con un solo proyecto. Lo citado de Microsoft salió de resultados de búsqueda, no de sus páginas | Abierto; relacionado con P34 (adopción de Actividades) |

## 15. Trazabilidad: hoja del libro a módulo

| Hoja del libro | Módulo |
| --- | --- |
| Índice | Navegación general |
| Acta de Constitución | B |
| Stakeholders | C |
| WBS - EDT | D |
| Registro de Riesgos | E |
| Registro de Cambios (con Metodología GL y SGCC) | F |
| Reporte Semanal | G |
| KPIs & EVM | G, y dashboard A |
| Dashboard RAG | A |
| Ruta PMP | Fuera de alcance |
| (sin hoja; solicitud del usuario del 9 de octubre de 2026) | N |
| Registro de Riesgos por frente, Planta Empacadora El Silencio (Excel, 8 de octubre de 2026; hojas Registro, Matriz y Resumen) | E (campos ampliados, importación y caso 13.11) |
| (sin hoja; solicitudes del usuario del 10 y 11 de octubre de 2026) | O, P, Q y sección 17 |
| (sin hoja; solicitudes del usuario del 12 de octubre de 2026) | Tablero del proyecto y tablero de control (sección 3, hito 21) |
| (sin hoja; solicitud del usuario del 16 de octubre de 2026: «correo electrónico, teléfono» y reutilización del registro) | Módulo C y directorio de contactos (hito 23) |
| (sin hoja; solicitudes del usuario del 14 y 15 de octubre de 2026) | Sección 18 (memoria del proyecto), sección 2 (marco de referencia) y decisión sobre roles (sección 8) |

## 16. Uso con Claude Code (sin saber programar)

La plataforma ya está construida (secciones 0.1 y 12.1). Este documento es la base para mantenerla y ampliarla.

1. Ten Claude Code, Node.js (versión LTS) y Git, y acceso a las cuentas de GitHub, Supabase y Vercel.
2. Abre la carpeta del repositorio en Claude Code. `ESPECIFICACION.md` está en la raíz, junto a `README.md`.
3. Pega el prompt de abajo y pide que te guíe paso a paso.
4. Avanza por cambios pequeños; valida cada uno con los casos de la sección 13 y con las pruebas automáticas.

**Pasos que solo puede hacer el usuario (por cada versión con migraciones nuevas):**

1. Pegar `supabase/instalar_todo.sql` completo en Supabase, en el editor SQL, y ejecutarlo (se puede repetir sin problema).
2. Redesplegar en Vercel.
3. Para los correos: configurar las variables de la sección 10 (pendientes P16 y P17).

**Guía: crear un usuario nuevo con su rol y permisos (17 de octubre de 2026).** Son tres pasos:
1. **Crear la cuenta** en Supabase (no en la plataforma): Authentication → Users → Add user, con correo y contraseña y marcando «Auto Confirm User». Sin rol ni proyectos, la persona no ve nada.
2. **Rol global**, solo si debe ver todo el portafolio: en la plataforma, como administrador, Usuarios → Rol global (Administrador, Director general, Analista PMO o Finanzas).
3. **Rol por proyecto:** en el proyecto, «Equipo del proyecto» (solo el administrador asigna): Gerente de proyecto, Patrocinador, Supervisor de obra, Interventoría o Consulta. Una persona puede tener roles distintos en proyectos distintos. Debe existir al menos un usuario con rol Director general.

**Guía: configurar y probar el envío de correos, por fases (17 de octubre de 2026).** Los avisos inmediatos de aprobaciones (cambio que pasa a «En aprobación», contrato por aprobar, reporte con decisiones) **solo necesitan el proveedor de correo**; el resumen diario y el informe del lunes necesitan además `CRON_SECRET` y el usuario lector (Analista PMO).
1. Antes: tener pegado el último `supabase/instalar_todo.sql` y un usuario Director general con correo.
2. Proveedor: Gmail con «contraseña de aplicación» (`SMTP_USUARIO` y `SMTP_CLAVE`) o Resend. En Vercel, ambiente Production.
3. Ensayo sin enviar: agregar `CORREO_PROVEEDOR=consola` y redesplegar; los correos «salen» en los Logs de Vercel con la línea `[correo:consola]`.
4. Probar el aviso: pasar un cambio a «En aprobación» (menor: va al gerente; moderado o crítico: al director).
5. Tareas programadas: `CRON_SECRET`, crear el usuario lector y `ALERTAS_USUARIO` y `ALERTAS_CLAVE`; redesplegar; disparar a mano con `curl` o con «Run» en Settings → Cron Jobs, si el plan lo muestra (no verificado).
6. Envío real: borrar `CORREO_PROVEEDOR`, redesplegar y probar primero con una sola persona. Repetir el informe semanal con envío real escribe a **todos** los destinatarios.
Estado al 21 de octubre de 2026: el usuario aún no ha hecho la configuración final (P16 y P17); nada se ha enviado en producción.

> Lee ESPECIFICACION.md completo (versión 3.3.1), README.md y docs/memoria/README.md. La plataforma PMO360 ya está construida: revisa las secciones 0.1 y 12.1. Soy gerente de proyectos y no sé programar: explícame cada paso en lenguaje sencillo y pídeme confirmación antes de instalar, ejecutar o publicar cualquier cosa. Antes de cambiar código, resume lo que entendiste y lista tus dudas. Mantén todas las reglas y umbrales como parámetros configurables (sección 9). Nunca uses ni me pidas la clave secreta (service_role) de Supabase, y no guardes contraseñas en el repositorio. Valida cada cambio con `npm run verificar`, `npm run test:sql` y los casos de la sección 13. No inventes cifras: si un dato no existe, dilo.

## 17. Presentación y adopción: marco FARO

Material para explicar la plataforma ante colegas, jefes y junta directiva, y para pedir un piloto. Los archivos están en `docs/presentacion-faro/`: guion para exponer, lámina de una página, documento corto y guion de video.

**Idea central.** «Que ningún proyecto navegue a ciegas.» Un faro no evita la tormenta; evita que se navegue a ciegas. La plataforma no reemplaza el criterio del gerente ni promete ahorros.

**El hilo entre PMO360 y FARO.** PMO360 es el nombre de la plataforma («Control integral de Proyectos»): el **360** es la vuelta completa, la visión integral del portafolio, sin puntos ciegos. FARO es el marco para explicarla y adoptarla: **cuatro pasos y cada uno ilumina un cuarto de vuelta** (4 × 90° = 360°), en el orden F (primer cuarto), A, R y O (con el que se completa la vuelta). Frase puente: **«PMO360 es la luz; FARO es cómo la mantenemos encendida»**. Aparece en la apertura, al final de cada paso y en el cierre del guion, en el documento corto, en el guion de video y en la lámina (anillo de 360° con los cuatro cuartos alrededor de «PMO360»).

| Letra | Paso | Pregunta de la junta | Lo que la plataforma ya hace (verificable) |
| --- | --- | --- | --- |
| F | Fuente única | ¿Cómo va realmente cada proyecto? | Semáforo de cuatro dimensiones (el peor manda); «Sin datos» en vez de un verde sin verificar; riesgos importables desde Excel; presupuesto ligado a la EDT |
| A | Alerta a tiempo | ¿Quién decide y cuándo se entera? | Tablero «Requiere decisión»; correo a quien decide; resumen diario; informe de una página cada lunes a las 7:30 a. m. |
| R | Respaldo | ¿Por qué creerle a este dato? | Permisos por rol aplicados en la base de datos; la interventoría no ve costos; registro de cambios; reglas y supuestos escritos; casi 800 comprobaciones automáticas |
| O | Operación que escala | ¿Aguanta con más proyectos, más gente y más tiempo? | Base de datos estándar (Postgres); instalación en un solo archivo; documentación; límites técnicos documentados y suficientes para 12 proyectos |

**Reglas de presentación**

- Molde de cada paso: afirmación, historia, lo que la plataforma hace y pregunta a la sala. Con colegas y en video se abre con la imagen del faro; con la junta se abre directo con tres preguntas («¿cómo vamos?, ¿quién decide eso?, ¿de dónde salió ese número?»).
- Las historias de los pasos A, R y O son escenas típicas, no casos reales, y se presentan como tales. La historia del paso F es la del matemático Abraham Wald y los aviones de la Segunda Guerra Mundial.
- Se evita citar casos reales sensibles de la infraestructura colombiana (procesos fiscales o judiciales abiertos). Una investigación previa los evaluó y se descartó usarlos.
- No se citan cifras de ahorro: no existen. Solo se cita lo verificable.

**Lo que se pide: un piloto de 90 días con 3 a 4 de los 12 proyectos.** Condiciones: criterios de éxito acordados antes de empezar; un responsable; región y confidencialidad resueltas (P12); plan de alojamiento apto (P13); recomendable una revisión de seguridad (P14).

| Medida del piloto | Cómo se mide |
| --- | --- |
| Tiempo de preparar el informe semanal | Cronometrar por proyecto, con línea base tomada en las dos primeras semanas con el método actual |
| Antigüedad de decisiones pendientes | Días entre que la decisión queda pendiente y se resuelve; la plataforma ya calcula los días en aprobación de los cambios |
| Datos incorrectos hallados | Diferencias entre la fuente actual y la plataforma, contadas y clasificadas |
| Puntualidad de los reportes semanales | Proyectos con reporte enviado en la semana |
| Percepción | Encuesta de tres preguntas (claridad, utilidad y confianza) a gerentes y directores |

Los umbrales para decidir al final (seguir, ajustar o parar) no se fijan en este documento: se acuerdan con la dirección antes de empezar.

**Lo que se declara de frente:** solo datos ficticios hasta hoy; sin línea base de ahorro; costo de operación por calcular; alojamiento actual de uso no comercial; límites técnicos conocidos (500 riesgos por importación, 1.000 filas por lista, dos tareas programadas y 60 segundos por ejecución), que para 12 proyectos no son un obstáculo; sin comparación con software comercial; sin revisión de seguridad independiente.

**Referencias de comunicación usadas (no verificadas en fuentes primarias):** el Principio de la Pirámide de Barbara Minto (respuesta primero, luego tres o cuatro argumentos) y el criterio MECE (cada paso se distingue de los demás y no falta ninguno), citados en guías de consultoría; y el estilo de explicación del creador de contenido Sandeep Swadia, del que se tomó solo la estructura (anuncia la cantidad de pasos y repite en cada uno afirmación, historia, evidencia y acción), analizada a partir de las transcripciones de tres videos.

### 17.1 Origen del marco y decisiones que lo definieron (11 de octubre de 2026)

| Paso | Qué se hizo | Resultado |
| --- | --- | --- |
| Encargo | El usuario pidió un marco de máximo cuatro pasos para dar sustento, orden y estructura al argumento de la plataforma (utilidad, sostenibilidad, escalabilidad), con tono neutro, convincente y fácil de exponer, tomando como referencia la estructura de explicación de un creador de contenido | Alcance acordado: entender la plataforma y pedir un piloto; todos los formatos; emoción antes que cifras; nombre mnemotécnico |
| Investigación | Se leyeron las transcripciones de 3 de los 458 videos del creador (no se pudieron ver los videos) y guías de armado de argumentos (Principio de la Pirámide, MECE) | Referencias **N3**: guías de consultoría y divulgación, no estándares |
| Nombre | Se propusieron BASE y FARO; el usuario eligió **FARO** con la imagen del faro como gancho | Fuente única, Alerta a tiempo, Respaldo, Operación que escala |
| Caso local | Un hilo de investigación paralelo evaluó casos colombianos (Reficar, túnel de La Línea, Hidroituango, entre otros). El agente no pudo abrir páginas y ninguna cifra se contrastó con la fuente primaria | **Descartados** por sensibilidad política, procesos abiertos y falta de contraste. Se mantienen escenas ilustrativas rotuladas como tales |
| Presentación | Con colegas se abre con la imagen del faro; con la junta se abre directo con tres preguntas; presenta el usuario; GreenLand como marca | Reglas de la sección 17 |
| Hilo con el nombre | El usuario notó que no se explicaba la relación entre FARO y PMO360 | Anillo de 360° con cuatro cuartos de vuelta y la frase puente «PMO360 es la luz; FARO es cómo la mantenemos encendida» |

### 17.2 Estado del material de presentación (15 de octubre de 2026)

| Pieza | Archivo o lugar | Estado |
| --- | --- | --- |
| Guion para exponer | `docs/presentacion-faro/01-guion-para-exponer.docx` | Producido |
| Lámina de una página | `docs/presentacion-faro/02-lamina-una-pagina.pdf`, `.png` y `.pptx` (editable) | Producida |
| Documento corto | `docs/presentacion-faro/03-documento-corto.docx` y `.pdf` | Producido |
| Guion de video | `docs/presentacion-faro/04-guion-de-video.docx` (objetivo 3 min 30 s, unas 370 palabras) | Producido; el video no se ha grabado |
| Versión web | Artifact «FARO – Que ningún proyecto navegue a ciegas» en la cuenta del usuario | Publicado el 11 de octubre de 2026 |
| Origen y propósito | `docs/memoria/00-origen-y-proposito.md` y `docs/memoria/PMO360-origen-y-proposito.pdf` (4 páginas, para compartir) | Producido el 14 de octubre de 2026 |
| Marcadores sin completar | `[Tu nombre]` y `[por definir]` en los documentos | Pendiente P29 |

**Estado de los dolores que motivan los pasos.** Las escenas de los pasos A, R y O son hipótesis ilustrativas, no casos reales de GreenLand (etiqueta **Supuesto**). El paso F usa la historia de Abraham Wald, aviones de la Segunda Guerra Mundial (fuente de divulgación, **N3**). Los hechos que sí están verificados son los de la columna «Lo que la plataforma ya hace» de la tabla de la sección 17.

**El piloto es un pedido, no una decisión tomada.** Elegir proyectos, responsable, medidas y criterios de éxito sigue abierto (P20, P21); depende además de cerrar P12 a P14 si se usan datos reales.

## 18. Memoria del proyecto (trazabilidad e historia)

Repositorio `docs/memoria/`, creado el 14 de octubre de 2026 para explicar cómo nació la plataforma, por qué, para qué, para quién, con qué referencias y qué decisiones la formaron. No reemplaza este documento: lo resume y lo enlaza.

| Documento | Contenido |
| --- | --- |
| `README.md` | Índice y límites de la memoria |
| `00-origen-y-proposito.md` y su PDF | Cómo nació, por qué, para qué, para quién; guion de tres minutos; preguntas difíciles |
| `01-resumen-ejecutivo.md` | Estado, hechos clave y pendientes |
| `02-historia.md` | Cronología desde los antecedentes hasta hoy, con commits |
| `03-marco-teorico.md` | Teoría, normativa y nivel de verificación de cada afirmación |
| `04-buenas-practicas-documentacion.md` | Investigación sobre cómo documentar proyectos, diagnóstico y brechas |
| `decisiones/` | 27 fichas de decisión (ADR) |
| `06-trazabilidad.md` | Módulo → decisión → migración → prueba → commit |
| `07-lecciones-aprendidas.md` | Incidentes y qué cambió |
| `08-fuentes-y-verificacion.md` | Bibliografía con niveles N1 a N3 |
| `09-gobierno-de-la-memoria.md` | Roles, disparadores de actualización y pendientes |
| `CHANGELOG.md`, `sesiones/`, `plantillas/` | Registro de cambios, bitácora de sesiones y plantillas |

**Reglas de rigor.** No se inventan fechas, cifras, normas ni citas; lo no conocido se escribe como «no disponible» y se lista como brecha. Cada afirmación se etiqueta: **Verificado** (con fuente y nivel), **Declarado** (lo dijo el usuario), **Supuesto** o **Estimación**. Una decisión aceptada no se reescribe: se marca como reemplazada y se enlaza la nueva. No se guardan credenciales ni identificadores de proyecto de Supabase.

**Límites.** Las conversaciones anteriores a la sesión de desarrollo no se pudieron leer (P27). Las fichas ADR-0001 a ADR-0021 se redactaron después de las decisiones, a partir del registro de la sesión; las ADR-0022 a ADR-0027 se escribieron el día de cada decisión.

**Cuándo se actualiza.** Con cada decisión, cambio de módulo o migración, incidente, cambio de versión de este documento y cierre de jornada (tabla de disparadores en `docs/memoria/09-gobierno-de-la-memoria.md`). Al subir de versión esta especificación se revisan también `README.md` y `docs/memoria/CHANGELOG.md` para que coincidan (lección L-8).
