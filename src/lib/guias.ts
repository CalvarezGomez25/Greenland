// Instrucciones de diligenciamiento por módulo (pantalla «Glosario y guías»). Describen lo que la plataforma hace hoy.

export type Guia = { clave: string; titulo: string; quien: string; pasos: string[]; notas?: string[] };

export const GUIAS: Guia[] = [
  {
    clave: "acta", titulo: "Acta de constitución", quien: "Gerente del proyecto o administrador",
    pasos: [
      "Escribe el propósito, el alcance, los supuestos y las restricciones del proyecto.",
      "El presupuesto total estimado es solo una referencia: el presupuesto que vale es el que apruebas en el módulo Presupuesto.",
      "Registra las firmas: quedan guardadas con quién firmó y cuándo.",
    ],
  },
  {
    clave: "presupuesto", titulo: "Presupuesto y costos", quien: "Gerente del proyecto o administrador (el supervisor lo consulta)",
    pasos: [
      "Opción recomendada: arma primero la EDT y usa «Crear capítulos desde la EDT» (eliges el nivel; normalmente el primero). Luego agrega las partidas bajo cada capítulo. Los capítulos de la EDT no se borran aunque estén vacíos.",
      "También puedes importar el presupuesto con «Importar CSV» o agregar las partidas una por una con capítulos propios; si un capítulo se llama igual que un elemento de la EDT, se liga solo.",
      "El archivo CSV usa punto y coma como separador y estas columnas: capitulo; codigo; descripcion; unidad; cantidad; precio_unitario.",
      "Los números van en formato colombiano: punto para los miles y coma para los decimales (1.234.567,50).",
      "Agrega los costos adicionales (se suman al costo directo para dar el costo total).",
      "Cuando el presupuesto esté listo, usa «Aprobar presupuesto como línea base»: ese valor es el BAC y desde ahí se calcula el valor ganado.",
      "Cada mes, registra el gasto real en «Registrar gasto» (mes 1 = primer mes del proyecto).",
    ],
    notas: ["La interventoría no ve el presupuesto."],
  },
  {
    clave: "cronograma", titulo: "Cronograma y avance", quien: "Gerente (crea las tareas); supervisor (avance reportado); interventoría (avance verificado)",
    pasos: [
      "Crea cada tarea con su semana de inicio (1 = primera semana del proyecto), su duración en semanas y su peso. Si la ligas a un elemento de la EDT que tiene capítulo en el presupuesto, el capítulo se completa solo.",
      "El peso es el porcentaje de la obra que representa la tarea; la suma de todos los pesos debe ser 100 %.",
      "El supervisor actualiza el avance de cada tarea (0 a 100 %); la bitácora también lo suma.",
      "La interventoría registra el avance verificado; si existe, es el que usa el valor ganado.",
      "El valor ganado calculado se actualiza solo cuando cambia el avance o el gasto.",
    ],
  },
  {
    clave: "evm", titulo: "Valor ganado", quien: "Gerente, administrador o analista PMO",
    pasos: [
      "En proyectos con área de Obra, el valor ganado se calcula solo con el presupuesto aprobado, el cronograma y el gasto. El botón «Calcular valor ganado de hoy» fuerza el cálculo.",
      "Si el proyecto no tiene esos datos, usa «Registrar medición»: fecha de corte y cuatro valores en pesos (BAC, PV, EV y AC).",
      "Si ya existe una medición con la misma fecha de corte, se corrige en vez de duplicarse.",
      "La plataforma calcula los índices (SPI, CPI) y el semáforo; no tienes que hacer cuentas.",
    ],
  },
  {
    clave: "cambios", titulo: "Control de cambios", quien: "Gerente o administrador registra; el gerente (menor) o el director general (moderado y crítico) aprueba",
    pasos: [
      "Registra el cambio: tipo, descripción antes y después, justificación, impacto en costo (en pesos; negativo si es un ahorro) y en días.",
      "Si el cambio afecta un contrato, elígelo: el nivel se mide sobre el valor de ese contrato (debe estar aprobado); si no, sobre el presupuesto.",
      "El nivel (Menor, Moderado o Crítico) lo calcula la plataforma; tú no lo eliges.",
      "Avanza el cambio por sus fases: Identificado, Radicado, En evaluación técnica y financiera, En análisis de impacto y En aprobación.",
      "Quien decide lo aprueba o lo rechaza; si supera el 5 % también requiere la firma del patrocinador.",
      "Al aprobarse, el presupuesto o el cronograma se ajustan con una nueva versión de la línea base.",
    ],
    notas: ["Quien debe decidir recibe un correo cuando el cambio llega a «En aprobación»."],
  },
  {
    clave: "riesgos", titulo: "Riesgos", quien: "Gerente o administrador",
    pasos: [
      "Describe el riesgo y elige su categoría.",
      "Califica la probabilidad y el impacto de 1 a 5: el puntaje (probabilidad × impacto) define el nivel.",
      "Escribe el plan de acción y el responsable. Un riesgo crítico activo pone el proyecto en rojo.",
    ],
  },
  {
    clave: "interesados", titulo: "Interesados", quien: "Gerente o administrador",
    pasos: [
      "Registra cada persona u organización con su rol.",
      "Califica su poder y su interés de 1 a 5: la plataforma calcula la estrategia de gestión.",
      "Anota sus necesidades y el canal de comunicación.",
    ],
  },
  {
    clave: "edt", titulo: "EDT (estructura de desglose del trabajo)", quien: "Gerente o administrador",
    pasos: [
      "Cada entregable lleva un código numérico con puntos (1, 1.1, 1.2.1) y, si corresponde, su elemento padre.",
      "Puedes empezar con la plantilla estándar y ajustarla.",
      "Marca el estado de cada elemento; las tareas del cronograma pueden ligarse a un elemento de la EDT.",
      "La columna «Costo directo» muestra lo presupuestado en los capítulos ligados a cada elemento (suma hacia arriba). No la ve la interventoría.",
    ],
  },
  {
    clave: "reportes", titulo: "Reporte semanal", quien: "Gerente, administrador o analista PMO",
    pasos: [
      "Crea el reporte de la semana (uno por semana y proyecto) y llénalo como borrador: estado que reportas, logros, alertas, decisiones requeridas y próximos hitos.",
      "Al enviarlo, los indicadores de ese momento quedan guardados y ya no cambian.",
      "Si escribes decisiones requeridas, el director general recibe un correo.",
    ],
  },
  {
    clave: "contratos", titulo: "Contratos y pagos", quien: "Gerente o administrador registra; el director general aprueba",
    pasos: [
      "Registra el contrato (tipo, contratista, objeto y valor). Queda «Pendiente de aprobación» del director general.",
      "Mientras esté pendiente puedes corregirlo, pero no admite anticipo ni actas de pago.",
      "Aprobado, el director puede autorizar el anticipo (máximo 20 % del contrato, con su motivo).",
      "Radica cada acta de pago con su fecha y su valor bruto: la plataforma calcula la amortización del anticipo, la retención de garantía y el neto a pagar.",
      "La retención se libera cuando se ha facturado el 100 % del contrato.",
    ],
    notas: ["La plataforma registra y calcula; no ejecuta pagos."],
  },
  {
    clave: "bitacora", titulo: "Bitácora de obra", quien: "Supervisor (también gerente e interventoría)",
    pasos: [
      "Registra una bitácora por día: clima, personal propio y de subcontratistas, y las actividades realizadas.",
      "En cada actividad puedes elegir la tarea y el avance del día: se suma al avance de la tarea (máximo 100 %).",
      "Agrega hasta 5 fotos; se reducen de tamaño antes de subirse. En el celular puedes elegirlas una a una.",
      "Si hubo retraso, indica la causa y las horas. Las horas por clima no se cuentan dos veces.",
    ],
    notas: ["Una bitácora guardada no se modifica; se le pueden agregar comentarios y visto bueno."],
  },
  {
    clave: "documentos", titulo: "Documentos", quien: "Gerente, administrador y supervisor",
    pasos: [
      "Sube el archivo y escribe su nombre y tipo (plano, contrato, acta, informe u otro). Tamaño máximo: 50 MB.",
      "Puedes ligar el documento a un contrato o a otro registro.",
      "Indica si la interventoría puede verlo.",
    ],
  },
  {
    clave: "cierre", titulo: "Cierre y lecciones aprendidas", quien: "Gerente o administrador",
    pasos: [
      "Registra las lecciones aprendidas antes de cerrar.",
      "Para cerrar no debe haber cambios pendientes ni hitos vencidos sin resolver; llena el acta de entrega (fecha y quién recibe).",
      "Un proyecto cerrado sale del tablero de control y pasa al histórico; solo el administrador puede reabrirlo.",
    ],
  },
  {
    clave: "interventoria", titulo: "Interventoría", quien: "Administrador o director general (asignaciones); interventores (resto)",
    pasos: [
      "Asignaciones: se define qué contrato vigila cada interventor, con qué alcances y desde cuándo.",
      "Conceptos: cada interventor emite conceptos solo sobre lo que le corresponde según su sub-rol.",
      "Hallazgos: se registran con su severidad; el plazo de respuesta se cuenta en días hábiles (observación 5, no conformidad 3, incumplimiento grave 1). Si vence, se escala.",
      "Informes: se arman con los datos del sistema, se completa la recomendación y se firman; después no se modifican.",
    ],
  },
];
