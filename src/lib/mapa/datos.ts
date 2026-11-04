// Datos del mapa de proceso de PMO360: etapas del ciclo, paquetes de trabajo (carriles), módulos, roles, decisiones y flujos de datos.
// Todo describe lo que la plataforma hace hoy (especificación, secciones 5 y 8). La etapa en que se ubica un módulo es una guía de uso, no una restricción.

export type Nivel = "D" | "H" | "V"; // decide o aprueba · registra o trabaja · consulta
export type RolClave = "ad" | "di" | "an" | "ge" | "pa" | "fi" | "su" | "in" | "co";
export type CarrilId = "ges" | "obr" | "con" | "cam" | "bas";
export type Etapa = { n: number; t: string; s: string };
export type Carril = { id: CarrilId; n: string; s: string; c: number };
export type Rol = { k: RolClave; n: string; p: string };
export type ModuloMapa = {
  id: string; l: CarrilId; row: number; a: number; b: number; nm: string; co: string; us: string; de: string; ru: string;
  ro: Partial<Record<RolClave, Nivel>>;
};
export type Decision = { m: string; r: string; t: string };
export type Flujo = [string, string, string]; // origen, destino, qué pasa

export const ETAPAS: Etapa[] = [
 {n:1,t:'Inicio',s:'Qué es el proyecto y quién interviene'},
 {n:2,t:'Planeación',s:'Alcance, costo, tiempo y riesgos'},
 {n:3,t:'Contratación',s:'Aliados, ofertas y contratos'},
 {n:4,t:'Ejecución',s:'Obra, campo e interventoría'},
 {n:5,t:'Seguimiento y control',s:'Medir, decidir y ajustar'},
 {n:6,t:'Cierre',s:'Entrega, liquidación y aprendizaje'}];
export const CARRILES: Carril[] = [
 {id:'ges',n:'Gestión del proyecto',s:'Planear, controlar y cerrar',c:1},
 {id:'obr',n:'Obra: costo y tiempo',s:'Presupuesto, cronograma y valor ganado',c:2},
 {id:'con',n:'Contratación y RAIZ',s:'Aliados, procesos y contratos',c:3},
 {id:'cam',n:'Campo e interventoría',s:'Lo que pasa en obra y su verificación',c:4},
 {id:'bas',n:'Control y administración',s:'Todo el ciclo: alertas, tableros y reglas',c:5}];
export const ROLES: Rol[] = [
 {k:'ad',n:'Administrador',p:'Todo: usuarios, parámetros y estructura. Crea proyectos y asigna personas. Solo él reabre un proyecto cerrado.'},
 {k:'di',n:'Director general',p:'Ve todo el portafolio. Aprueba los contratos nuevos y autoriza anticipos (máx. 20 %). Aprueba los cambios moderados y críticos.'},
 {k:'an',n:'Analista PMO',p:'Ve todo el portafolio. Consolida, evalúa el impacto de los cambios y mantiene el tablero y los reportes.'},
 {k:'ge',n:'Gerente de proyecto',p:'En sus proyectos edita acta, EDT, riesgos, presupuesto, cronograma y contratos. Aprueba cambios menores, adjudica y revisa las novedades.'},
 {k:'pa',n:'Patrocinador',p:'Ve su proyecto. Firma el acta y los cambios de más de 5 % del presupuesto.'},
 {k:'fi',n:'Finanzas',p:'Ve presupuesto, contratos y pagos de todo el portafolio. Hoy solo lectura.'},
 {k:'su',n:'Supervisor de obra',p:'Registra la bitácora con fotos y el avance de sus tareas. Ve el presupuesto.'},
 {k:'in',n:'Interventoría',p:'Ve y conceptúa en sus contratos; verifica el avance y registra hallazgos e informes. No aprueba ni edita contratos; no ve costos.'},
 {k:'co',n:'Consulta',p:'Solo lectura en los proyectos asignados.'}];
export const RK: RolClave[] = ROLES.map((r) => r.k);
const GEN = "ad di an ge pa fi su co";
const ALL = GEN + " in";
function R(base: string, over?: string): Partial<Record<RolClave, Nivel>> {
  const o: Partial<Record<RolClave, Nivel>> = {};
  base.split(" ").forEach((k) => { if (k) o[k as RolClave] = "V"; });
  (over ?? "").split(" ").forEach((s) => { if (s) { const [k, v] = s.split(":"); o[k as RolClave] = v as Nivel; } });
  return o;
}
export const MODULOS_MAPA: ModuloMapa[] = [
 {id:'acta',l:'ges',row:0,a:1,b:1,nm:'Acta de constitución',co:'Propósito, alcance y firmas',us:'Propósito, alcance, supuestos y firmas del proyecto.',
  de:'Es el punto de partida acordado. Las firmas quedan con quién firmó y cuándo. Su presupuesto es solo referencia: el que vale se aprueba en Presupuesto.',ru:'Proyecto → Gestión → Acta de constitución',ro:R(GEN,'ge:H ad:H pa:D')},
 {id:'inter',l:'ges',row:1,a:1,b:1,nm:'Interesados',co:'Poder, interés y estrategia',us:'Quién influye en el proyecto y cómo gestionarlo.',
  de:'Poder e interés de 1 a 5; la estrategia (gestionar de cerca, mantener satisfecho o informado) se calcula sola. Los contactos se escriben una vez en el directorio.',ru:'Proyecto → Gestión → Interesados',ro:R(GEN,'ge:H ad:H')},
 {id:'edt',l:'ges',row:0,a:2,b:2,nm:'EDT',co:'El proyecto en entregables',us:'El proyecto dividido en entregables, con responsable y estado.',
  de:'Es la base común: de aquí se arma el presupuesto y se ligan las tareas del cronograma.',ru:'Proyecto → Gestión → EDT',ro:R(ALL,'ge:H ad:H')},
 {id:'riesgos',l:'ges',row:1,a:2,b:6,nm:'Riesgos',co:'Puntaje y plan de respuesta',us:'Probabilidad × impacto: Crítico, Alto, Medio o Bajo, con estrategia y plan. Importa desde Excel.',
  de:'Un riesgo crítico activo pone el semáforo del proyecto en rojo. Una acción del plan de respuesta puede volverse una actividad.',ru:'Proyecto → Gestión → Riesgos',ro:R(GEN,'ge:H ad:H')},
 {id:'cambios',l:'ges',row:0,a:3,b:5,nm:'Control de cambios',co:'Solicitudes y aprobación por nivel',us:'Flujo por fases; la plataforma calcula el nivel (Menor, Moderado, Crítico) según el impacto en costo.',
  de:'Un cambio aprobado ajusta la línea base y puede ligarse a un contrato (otrosí) o a un adicional de obra. Los cambios sin resolver bloquean el cierre.',ru:'Proyecto → Gestión → Control de cambios',ro:R(ALL,'ge:D ad:H di:D pa:D an:H in:H')},
 {id:'act',l:'ges',row:2,a:1,b:3,nm:'Actividades y Mi trabajo',co:'Quién hace qué y para cuándo',us:'Tablero Kanban del trabajo diario: responsable, fecha límite y estado. No son tareas del cronograma.',
  de:'Cada persona ve sus pendientes en «Mi trabajo», con la línea de tiempo y lo vencido. Se pueden ligar a un riesgo o a la EDT.',ru:'Proyecto → Actividades · Menú → Mi trabajo',ro:R(ALL,'ge:H ad:H di:H an:H in:H')},
 {id:'reportes',l:'ges',row:2,a:4,b:6,nm:'Reporte semanal',co:'Indicadores y foto de la semana',us:'Indicadores de gestión con meta, hitos y reuniones; un reporte por semana con foto histórica.',
  de:'Al enviarlo, los indicadores quedan guardados y no cambian. Si hay decisiones requeridas, el director general recibe un correo.',ru:'Proyecto → Gestión → Reporte semanal',ro:R(GEN,'ge:H ad:H an:H')},
 {id:'docs',l:'bas',row:1,a:3,b:3,nm:'Documentos',co:'Planos, contratos, actas e informes',us:'Un repositorio con todas las versiones; define lo que ve la interventoría.',
  de:'Se pueden ligar a un contrato u otro registro. Tamaño máximo 50 MB por archivo.',ru:'Proyecto → Gestión → Documentos',ro:R(ALL,'ge:H ad:H su:H in:H')},
 {id:'cierre',l:'ges',row:0,a:6,b:6,nm:'Cierre y lecciones',co:'Acta de entrega y aprendizaje',us:'Acta de entrega y registro de lecciones aprendidas.',
  de:'Los cambios sin resolver bloquean el cierre; los hitos vencidos avisan pero no lo impiden. Un proyecto cerrado sale del tablero y pasa al histórico.',ru:'Proyecto → Gestión → Cierre y lecciones',ro:R(GEN,'ge:D ad:D')},

 {id:'pres',l:'obr',row:0,a:2,b:5,nm:'Presupuesto y costos',co:'Capítulos, A.I.U., adicionales y línea base',us:'Capítulos y partidas, costos indirectos (A.I.U.), adicionales de obra, línea base (BAC), gasto real y Curva S.',
  de:'Al aprobarse, el presupuesto es la línea base de costo. Los adicionales son trabajos fuera de la EDT original y quedan aprobados cuando el cambio que los respalda se aprueba.',ru:'Proyecto → Obra → Presupuesto',ro:R(GEN,'ge:D ad:H')},
 {id:'crono',l:'obr',row:1,a:2,b:5,nm:'Cronograma y avance',co:'Tareas con peso, Gantt y avance',us:'Tareas con semana de inicio, duración y peso (suman 100 %); Gantt; avance reportado y verificado.',
  de:'Cada tarea se liga a un capítulo para que el control por capítulo tenga avance. La interventoría registra el avance verificado, que es el que usa el valor ganado.',ru:'Proyecto → Obra → Cronograma',ro:R(ALL,'ge:H su:H in:H ad:H')},
 {id:'valor',l:'obr',row:2,a:4,b:4,nm:'Valor ganado',co:'SPI, CPI y proyecciones',us:'SPI, CPI y estimaciones al terminar (EAC, ETC, VAC, TCPI).',
  de:'En proyectos de obra se calcula solo con presupuesto aprobado, cronograma y gasto. Nadie escribe las cifras a mano.',ru:'Proyecto → Gestión → Valor ganado',ro:R(GEN,'ge:H ad:H an:H')},
 {id:'bal',l:'obr',row:2,a:3,b:3,nm:'Balance de costos',co:'Presupuestado frente a contratado',us:'Presupuesto con indirectos frente a lo contratado y facturado.',
  de:'Avisa si hay sobrecontratación o contratos con valor sin asignar. Solo cuentan los contratos aprobados.',ru:'Proyecto → Obra → Balance de costos',ro:R(GEN)},
 {id:'cc',l:'obr',row:2,a:5,b:5,nm:'Control de costos',co:'Invertido, por invertir, proyectado',us:'Corte a corte: invertido, por invertir y proyectado (EAC).',
  de:'Compara cada corte con el anterior y con la línea base, y repite el control por capítulo.',ru:'Proyecto → Obra → Control de costos',ro:R(GEN)},

 {id:'raiz',l:'con',row:0,a:3,b:6,nm:'RAIZ · Registro de Aliados',co:'Maestro único de aliados',us:'Contratistas, proveedores, consultores e interventores escritos una sola vez, con sus documentos, contratantes y plantillas.',
  de:'Cada aliado se elige desde aquí en cualquier proyecto. Si falta el RUT se usa un identificador temporal (PEND-). Cada proyecto solo ve sus contratos; el maestro completo lo ven pocos roles.',ru:'Menú → Administración → RAIZ',ro:R('ad di an ge fi','ad:H di:H ge:H')},
 {id:'proc',l:'con',row:1,a:3,b:3,nm:'Procesos de contratación',co:'Ofertas por ronda y comparativo',us:'Invitaciones, ofertas por ronda y comparativo con puntaje.',
  de:'Una oferta no habilitada no recibe puntaje total. Al adjudicar, el contrato se registra desde la oferta ganadora. La interventoría no ve esta pantalla.',ru:'Proyecto → Obra → Procesos de contratación',ro:R(GEN,'ge:D ad:H')},
 {id:'word',l:'con',row:1,a:4,b:4,nm:'Documentos en Word',co:'Plantillas llenas con datos',us:'Plantilla Word llena con los datos del contrato.',
  de:'Las plantillas oficiales las sube el administrador o el director general; el texto jurídico lo aporta Jurídica.',ru:'Contrato → Generar documento (Word)',ro:R('ad di ge','ge:H ad:H di:H')},
 {id:'contr',l:'con',row:2,a:3,b:6,nm:'Contratos y pagos',co:'Ruta de 9 etapas, pólizas y pagos',us:'Ruta de nueve etapas con semáforo, pólizas, modificaciones, anticipo, actas de pago y retención.',
  de:'El semáforo vigila etapa, plazo, tope de asamblea, pólizas, documentos del contratista y compromisos. La plataforma registra y calcula; no ejecuta pagos.',ru:'Proyecto → Obra → Contratos y pagos',ro:R(ALL,'ge:H ad:H di:D in:H')},

 {id:'bit',l:'cam',row:0,a:4,b:4,nm:'Bitácora de obra',co:'Registro diario con fotos',us:'Una entrada por día: clima, personal, actividades y fotos.',
  de:'El avance diario que se anota se suma a la tarea del cronograma. Una entrada guardada no se edita: se agregan comentarios y visto bueno.',ru:'Proyecto → Obra → Bitácora',ro:R(ALL,'su:H ge:H in:H ad:H')},
 {id:'nov',l:'cam',row:1,a:4,b:4,nm:'Novedades de campo',co:'Hechos de obra con foto',us:'Hecho de un contrato desde obra, con hasta 3 fotos, para aplicar o descartar.',
  de:'Aplicar un acta de inicio, una suspensión o un reinicio actualiza el contrato. Una novedad nunca cambia el contrato por sí sola.',ru:'Proyecto → Obra → Novedades de campo',ro:R(ALL,'su:H ge:D ad:D in:H')},
 {id:'interv',l:'cam',row:2,a:4,b:6,nm:'Interventoría',co:'Conceptos, hallazgos e informes',us:'Conceptos, hallazgos con plazos en días hábiles, diseños, evaluaciones e informes firmados.',
  de:'La interventoría conceptúa y verifica; no aprueba ni modifica datos del contrato, y ve solo lo que se le asigna. Si vence la respuesta de un hallazgo, se escala.',ru:'Proyecto → Interventoría',ro:R(ALL,'in:H ad:D di:D')},

 {id:'sem',l:'bas',row:0,a:1,b:3,nm:'Semáforo del proyecto',co:'La peor de cuatro señales',us:'Toma la peor de cuatro señales: cronograma (SPI), costo (CPI), riesgo más alto y cambios pendientes.',
  de:'Donde falta información dice «Sin datos» en vez de mostrar un verde sin verificar. Cada contrato tiene además su propio semáforo.',ru:'Tablero de control y cada proyecto',ro:R(GEN)},
 {id:'dec',l:'bas',row:0,a:4,b:6,nm:'Requiere decisión y alertas',co:'Quién decide y cuándo se entera',us:'Tablero «Requiere decisión», correo a quien decide y resumen diario.',
  de:'Reúne cambios en aprobación, contratos por aprobar y decisiones pedidas en los reportes. El envío de correos está construido pero aún no se ha configurado.',ru:'Tablero de control',ro:R('ad di an ge pa','di:D')},
 {id:'tab',l:'bas',row:1,a:1,b:2,nm:'Tablero de control y Mi trabajo',co:'Todos los proyectos o los tuyos',us:'Estado de todos los proyectos para quien ve el portafolio; «Mi trabajo» para quien trabaja en proyectos.',
  de:'Cada persona entra a la pantalla que le corresponde según su rol; la interventoría entra por Mi trabajo.',ru:'Menú → Tablero de control · Mi trabajo',ro:R(ALL)},
 {id:'inf',l:'bas',row:1,a:4,b:4,nm:'Informe gerencial',co:'Una página en Excel o PDF',us:'Resumen de una página del proyecto y exportaciones a Excel y PDF.',
  de:'Se genera desde el proyecto. El envío semanal automático está construido pero aún no se ha configurado.',ru:'Proyecto → Informe gerencial',ro:R(GEN,'an:H ge:H')},
 {id:'adm',l:'bas',row:1,a:5,b:6,nm:'Administración',co:'Usuarios, parámetros y auditoría',us:'Usuarios, organización, parámetros, festivos, directorio de contactos y registro de auditoría.',
  de:'Los permisos se aplican en la base de datos, no solo en la pantalla. La auditoría registra quién hizo qué y cuándo.',ru:'Menú → Administración',ro:R('ad di an fi','ad:D')}
];
export const DECISIONES: Decision[] = [
 {m:'acta',r:'GE · PA',t:'Firman el gerente y el patrocinador'},
 {m:'pres',r:'GE',t:'Aprueba la línea base de costo'},
 {m:'cambios',r:'GE · DI · PA',t:'Menor: gerente. Moderado y crítico: director general. Más de 5 % del presupuesto: también el patrocinador'},
 {m:'proc',r:'GE',t:'Adjudica la oferta ganadora (habilitada y con valor)'},
 {m:'contr',r:'DI',t:'Aprueba los contratos nuevos'},
 {m:'contr',r:'DI',t:'Autoriza el anticipo (máximo 20 %, con su motivo)'},
 {m:'nov',r:'GE · AD',t:'Aplica o descarta cada novedad (descartar exige motivo)'},
 {m:'interv',r:'AD · DI',t:'Asigna la interventoría a cada contrato'},
 {m:'cierre',r:'GE · AD',t:'Cierra el proyecto; los cambios sin resolver lo bloquean. Solo el administrador lo reabre'}];
export const FLUJOS: Flujo[] = [
 ['edt','pres','El presupuesto se arma sobre la EDT'],
 ['pres','crono','Cada tarea se liga a un capítulo del presupuesto'],
 ['crono','valor','Avance físico y plan alimentan el valor ganado'],
 ['pres','valor','Línea base y gasto real alimentan el valor ganado'],
 ['bit','crono','El avance diario se suma a la tarea'],
 ['interv','crono','El avance verificado reemplaza al reportado'],
 ['valor','cc','Invertido y proyectado, corte a corte'],
 ['pres','bal','El presupuesto se compara con lo contratado'],
 ['contr','bal','Lo contratado y facturado llega al balance'],
 ['raiz','proc','Los oferentes se eligen del maestro'],
 ['raiz','contr','El contratista se elige del maestro'],
 ['proc','contr','La adjudicación crea el contrato'],
 ['contr','word','Los datos del contrato llenan la plantilla'],
 ['nov','contr','Aplicar una novedad actualiza el contrato'],
 ['cambios','contr','Un cambio aprobado mueve el valor (otrosí)'],
 ['cambios','pres','Un cambio aprobado ajusta la línea base y los adicionales'],
 ['riesgos','sem','Un riesgo crítico activo pone el semáforo en rojo'],
 ['valor','sem','SPI y CPI definen el semáforo'],
 ['sem','dec','Las alertas llegan a quien debe decidir'],
 ['valor','reportes','Los indicadores se congelan en el reporte semanal'],
 ['cambios','cierre','Los cambios sin resolver bloquean el cierre'],
 ['interv','contr','Conceptos sobre actas de pago y anticipo']];
export const MODULO_POR_ID: Record<string, ModuloMapa> = Object.fromEntries(MODULOS_MAPA.map((m) => [m.id, m]));
export const CARRIL_POR_ID: Record<string, Carril> = Object.fromEntries(CARRILES.map((l) => [l.id, l]));

// Módulos esenciales de la versión resumida.
export const ESENCIALES = new Set(["acta", "edt", "riesgos", "cambios", "cierre", "pres", "crono", "valor", "bal", "cc", "raiz", "proc", "contr", "bit", "nov", "interv", "sem", "dec"]);
// Frase corta de cada rol, para la versión resumida.
export const ROL_CORTO: Record<RolClave, string> = {
  ad: "Todo: usuarios, parámetros y estructura", di: "Aprueba contratos, anticipos y cambios moderados y críticos", an: "Consolida, evalúa cambios y mantiene los tableros",
  ge: "Gestiona su proyecto; aprueba cambios menores y adjudica", pa: "Firma el acta y los cambios de más de 5 %", fi: "Ve presupuesto, contratos y pagos",
  su: "Registra bitácora, fotos y avance de obra", in: "Conceptúa y verifica; no aprueba", co: "Solo lectura",
};
