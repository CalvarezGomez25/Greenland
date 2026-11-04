// Explicaciones cortas de los conceptos, siglas e indicadores de la plataforma (ventanas emergentes «?»).
// Cada texto describe lo que la plataforma realmente calcula; si cambia una fórmula, cámbiese aquí.

export type Entrada = { titulo: string; texto: string; ejemplo?: string; meta?: string };

export const GLOSARIO = {
  proyectos_activos: { titulo: "Proyectos activos", texto: "Proyectos en estado Activo. Los que están en pausa, cerrados o cancelados no se cuentan." },
  semaforo: {
    titulo: "Semáforo",
    texto: "Estado general del proyecto: toma la peor de cuatro señales: desempeño del cronograma (SPI), del costo (CPI), el riesgo activo más alto y los cambios pendientes. Verde: en orden. Amarillo: alerta. Rojo: requiere atención.",
    meta: "Por defecto, SPI y CPI: verde desde 0,95; amarillo desde 0,85; por debajo, rojo. Un riesgo crítico o un cambio crítico pendiente da rojo.",
  },
  bac: {
    titulo: "Presupuesto hasta la conclusión (BAC)",
    texto: "Presupuesto total aprobado del proyecto (la línea base de costo). Es la referencia contra la que se mide el avance y el gasto.",
    ejemplo: "Presupuesto aprobado de $1.000.000.000 → BAC = 1.000.000.000.",
  },
  pv: {
    titulo: "Valor planificado (PV)",
    texto: "Cuánto del presupuesto debería estar ejecutado a la fecha de corte, según el cronograma.",
    ejemplo: "BAC de 1.000 millones y el plan dice que a esta fecha va el 40 % → PV = 400.000.000.",
  },
  ev: {
    titulo: "Valor ganado (EV)",
    texto: "Valor del trabajo realmente ejecutado a la fecha de corte: avance físico real × BAC.",
    ejemplo: "Avance real del 36 % sobre un BAC de 1.000 millones → EV = 360.000.000.",
  },
  ac: {
    titulo: "Costo real (AC)",
    texto: "Lo que realmente se ha gastado hasta la fecha de corte.",
    ejemplo: "Se han gastado 400.000.000 → AC = 400.000.000.",
  },
  spi: {
    titulo: "Índice de desempeño del cronograma (SPI)",
    texto: "EV ÷ PV. Dice si la obra va a tiempo: 1,00 = según lo planeado; menos de 1 = atrasada; más de 1 = adelantada.",
    ejemplo: "EV 360 M ÷ PV 400 M = 0,90 (atrasada).",
    meta: "Meta: 0,95 o más.",
  },
  cpi: {
    titulo: "Índice de desempeño del costo (CPI)",
    texto: "EV ÷ AC. Dice si se gasta con eficiencia: 1,00 = según lo presupuestado; menos de 1 = se gasta más de lo que se avanzó.",
    ejemplo: "EV 360 M ÷ AC 400 M = 0,90 (se gasta de más).",
    meta: "Meta: 0,95 o más.",
  },
  sv: { titulo: "Variación del cronograma (SV)", texto: "EV − PV, en pesos. Negativo: atraso; positivo: adelanto." },
  cv: { titulo: "Variación del costo (CV)", texto: "EV − AC, en pesos. Negativo: sobrecosto; positivo: ahorro." },
  eac: { titulo: "Estimación a la conclusión (EAC)", texto: "Cuánto costaría terminar el proyecto si el desempeño actual continúa: BAC ÷ CPI." },
  etc: { titulo: "Estimación para concluir (ETC)", texto: "Cuánto falta por gastar para terminar: EAC − AC." },
  tcpi: {
    titulo: "Desempeño requerido (TCPI)",
    texto: "Qué eficiencia hay que lograr de aquí en adelante para terminar dentro del presupuesto: (BAC − EV) ÷ (BAC − AC).",
    meta: "Meta: 1,10 o menos. Por encima es muy difícil recuperarse.",
  },
  vac: { titulo: "Variación a la conclusión (VAC)", texto: "BAC − EAC, en pesos. Negativo: se prevé terminar por encima del presupuesto." },
  avance_fisico: { titulo: "Avance físico", texto: "Porcentaje de obra ejecutada. En el valor ganado es EV ÷ BAC; en el cronograma, la suma del peso de cada tarea × su avance." },
  avance_plan: { titulo: "Avance planificado", texto: "PV ÷ BAC: cuánto debería llevar el proyecto según el plan." },
  avance_financiero: { titulo: "Avance financiero", texto: "Porcentaje del presupuesto ya gastado (gastado ÷ presupuesto)." },
  fecha_corte: {
    titulo: "Fecha de corte",
    texto: "Fecha a la que corresponden las cifras (por ejemplo, el último día del mes). Si ya hay una medición con esa fecha, se corrige en vez de duplicarse.",
  },
  medicion: {
    titulo: "Cómo registrar una medición",
    texto: "Úsala si no calculas el valor ganado desde la obra. Escribe cuatro valores en pesos a la fecha de corte: BAC, PV, EV y AC. La plataforma calcula los índices y el semáforo.",
    ejemplo: "BAC 1.000 M, PV 400 M, EV 360 M y AC 400 M dan SPI 0,90 y CPI 0,90.",
  },
  calculo_obra: {
    titulo: "Calcular desde la obra",
    texto: "Toma el BAC de la línea base de costo, el planificado y el avance del cronograma, y el gasto registrado. Se actualiza solo cuando cambian el avance o el gasto; este botón fuerza el cálculo de hoy.",
  },
  linea_base: { titulo: "Línea base de costo", texto: "Presupuesto aprobado que sirve de referencia. Después solo cambia mediante cambios aprobados." },
  curva_s: { titulo: "Curva S", texto: "Avance acumulado en el tiempo: lo planificado frente al gasto real. Si hay cronograma con pesos, el planificado sale de ahí; si no, de una distribución teórica." },
  riesgo_puntaje: {
    titulo: "Puntaje y nivel de riesgo",
    texto: "Puntaje = probabilidad (1 a 5) × impacto (1 a 5). Por defecto: Crítico desde 15, Alto desde 8, Medio desde 4 y Bajo por debajo.",
    meta: "Solo un riesgo crítico pone el proyecto en rojo.",
  },
  cambios_pendientes: { titulo: "Cambios pendientes", texto: "Solicitudes de cambio que aún no se cierran ni se rechazan. Un cambio crítico pendiente pone el proyecto en rojo." },
  reportado: { titulo: "Estado reportado", texto: "El estado que el gerente declara en el último reporte semanal enviado. Si difiere del semáforo calculado, se marca." },
  nivel_cambio: {
    titulo: "Nivel del cambio",
    texto: "Se calcula con el impacto en costo frente al presupuesto (o al valor del contrato, si el cambio está ligado a uno). Menor: hasta 2 %. Moderado: hasta 5 %. Crítico: más de 5 %. Un cambio de plazo en un contrato siempre es crítico.",
    meta: "Menor: lo aprueba el gerente. Moderado y crítico: el director general.",
  },
  costo_directo: { titulo: "Costo directo", texto: "Suma de cantidad × precio unitario de todas las partidas del presupuesto." },
  costo_total: { titulo: "Costo total", texto: "Costo directo más los costos indirectos (A.I.U., impuestos y otros) del presupuesto." },
  aiu: { titulo: "Costos indirectos (A.I.U.)", texto: "Administración, imprevistos y utilidad como porcentajes del costo directo; los impuestos y retenciones (por ejemplo IVA sobre la utilidad) se muestran aparte. Los porcentajes los define el proyecto." },
  adicional_obra: { titulo: "Adicional de obra", texto: "Trabajo que no estaba contemplado en la EDT original o que llegó como añadidura durante la ejecución. Es distinto de los costos indirectos. Queda aprobado cuando el cambio que lo respalda se aprueba." },
  corte_costos: { titulo: "Corte de control de costos", texto: "Cada medición de valor ganado es un corte. Invertido = costo real (AC); proyectado = estimación a la conclusión (EAC) calculada con el rendimiento real; por invertir = proyectado − invertido. Se compara con el corte anterior y con la línea base de costo (BAC)." },
  maestro_aliados: { titulo: "Maestro de RAIZ (aliados y proveedores)", texto: "Lista única de contratistas, proveedores, consultores e interventores, con su NIT o cédula. Cada tercero se escribe una vez y se elige al registrar un contrato. Un identificador PEND- es temporal, hasta recibir el RUT." },
  etapa_contrato: { titulo: "Etapa del contrato", texto: "Ruta de 9 etapas: Preparación, Revisión del contratista, Aprobación Greenland, Firmas, Garantías e inicio, Ejecución, Liquidación, Garantías postcontractuales y Archivado. Avanza de una en una; devolverse exige motivo." },
  semaforo_contrato: { titulo: "Semáforo del contrato", texto: "Rojo: la etapa excede sus días o el plazo venció. Ámbar: algo vence en 30 días, falta un dato o supera el tope de asamblea sin autorización. Verde: al día. También cuentan pólizas, documentos del contratista, compromisos y suspensión prolongada." },
  poliza_minimo: { titulo: "Valor mínimo de una póliza", texto: "Porcentaje del amparo (por ejemplo 30 % en cumplimiento) por el valor del contrato; en el buen manejo del anticipo, el 100 % del valor del anticipo. Una póliza asegurada por menos queda en rojo." },
  modificacion_firmada: { titulo: "Modificación firmada", texto: "Adición, otrosí, prórroga, suspensión, reinicio o cesión. Solo las firmadas mueven la fecha fin vigente y la suspensión; las que están en trámite no cambian nada. El valor del contrato cambia con un cambio aprobado." },
  puntaje_oferta: { titulo: "Puntaje de una oferta", texto: "Precio = 100 × menor valor de la ronda ÷ valor de la oferta. Cualitativo = promedio ponderado de cinco criterios (1 a 5) llevado a 100. Total = precio × 40 % + cualitativo × 60 %. Una oferta no habilitada no recibe total. Los pesos se editan en Parámetros." },
  novedad_campo: { titulo: "Novedad de campo", texto: "Un hecho de un contrato registrado desde obra, con foto (acta de inicio firmada, póliza, suspensión…). No cambia nada por sí sola: la gerencia la revisa y la aplica o la descarta." },
  plantilla_documento: { titulo: "Plantilla de documento", texto: "Archivo Word con campos de combinación (por ejemplo «CONTRATISTA» u «OBJETO») que sube el administrador. Con ella se genera la minuta, el otrosí o el acta de un contrato; lo que falta queda como «[POR COMPLETAR]»." },
  raiz: { titulo: "RAIZ", texto: "Registro de Aliados e Información centraliZada. Es el módulo donde cada contratista, proveedor, consultor o interventor se registra una sola vez, con sus documentos, y desde donde se ven sus contratos, procesos de contratación y novedades en todos los proyectos. Cada proyecto solo ve lo suyo." },
  nit_tercero: { titulo: "NIT o cédula", texto: "Identificador único del tercero; no se puede repetir. Solo números, con o sin dígito de verificación (por ejemplo 901519601-4); si lo escribes, la plataforma comprueba que coincida. Si todavía no tienes el RUT, usa un identificador temporal PEND-NOMBRE; queda marcado «Sin RUT» hasta que lo corrijas.", meta: "Evita crear dos veces al mismo aliado: busca primero por nombre o NIT." },
  tipo_tercero: { titulo: "Tipo de tercero", texto: "Contratista, proveedor, consultor o interventor. Sirve para filtrar el maestro y para sugerir el aliado correcto al registrar un contrato (por ejemplo, los interventores en el contrato de interventoría)." },
  doc_contratista: { titulo: "Documentos del contratista", texto: "RUT, cámara de comercio, seguridad social y similares. Se registran como enlace al soporte (OneDrive o SharePoint) con su fecha de expedición; la plataforma no guarda el archivo. Si un documento falta o está vencido, el semáforo del contrato lo avisa.", meta: "Revisa la lista del contratista antes de pasar su contrato a firmas." },
  contratante: { titulo: "Contratante", texto: "La sociedad que firma los contratos de un proyecto. Se registra aquí una vez y se elige en cada proyecto. Su tope de contratación sin asamblea define cuándo un contrato necesita autorización de la asamblea." },
  tope_asamblea: { titulo: "Tope sin asamblea (SMMLV)", texto: "Valor máximo, en salarios mínimos mensuales legales vigentes, que el contratante puede contratar sin autorización de la asamblea. Si el valor del contrato lo supera, el semáforo del contrato queda en ámbar hasta que se registre el acta y la fecha de autorización.", meta: "Si el contratante no tiene tope propio, se usa el parámetro general; el salario mínimo también sale de los parámetros." },
  proceso_contratacion: { titulo: "Proceso de contratación", texto: "Invitación a ofertar para un servicio u obra: se invita a varios oferentes del maestro, se recibe una oferta por ronda y se compara. Al adjudicar, el contrato se registra con el oferente elegido." },
  modalidad_proceso: { titulo: "Modalidad del proceso", texto: "Cómo se contrata (texto libre, por ejemplo invitación privada). Es un dato informativo para el expediente; la plataforma no le aplica reglas." },
  presupuesto_referencia: { titulo: "Presupuesto de referencia", texto: "Valor que el equipo espera pagar por este proceso. Es solo referencia para comparar las ofertas; no es el presupuesto del proyecto ni compromete recursos." },
  ronda_oferta: { titulo: "Ronda de ofertas", texto: "Cada oferente puede mejorar su propuesta en rondas sucesivas. Cada ronda se compara por separado: el puntaje de precio se calcula contra la oferta más baja de esa misma ronda." },
  oferta_habilitada: { titulo: "Oferta habilitada", texto: "Cumple los requisitos jurídicos, técnicos y financieros de la invitación. Una oferta marcada como no habilitada no recibe puntaje total; se sigue mostrando para el historial." },
  novedad_revision: { titulo: "Revisión de una novedad", texto: "Quien gerencia el proyecto aplica o descarta cada novedad registrada desde obra. Al aplicar, un acta de inicio, una suspensión o un reinicio actualizan el contrato; las demás quedan como constancia. Descartar exige explicar el motivo." },
  plantilla_ambito: { titulo: "Se usa para", texto: "Define dónde aparece la plantilla: en los contratos (por ejemplo, el acta de inicio) o en las modificaciones (por ejemplo, la constancia de un otrosí)." },
  campos_combinacion: { titulo: "Campos de combinación", texto: "Marcas dentro del Word (por ejemplo CONTRATISTA, OBJETO o VALOR_LETRAS) que la plataforma reemplaza con los datos del contrato. Lo que no tiene dato queda como [POR COMPLETAR] para que lo escribas a mano antes de descargar." },
  faro: { titulo: "FARO", texto: "Marco de cuatro pasos para explicar y adoptar la plataforma: Fuente única, Alerta a tiempo, Respaldo y Operación que escala. Cada paso ilumina un cuarto de vuelta (4 × 90° = 360°), de ahí el nombre PMO360. Se abre desde «Acerca de FARO» en el menú." },
  calendario_ics: { titulo: "Calendario (.ics)", texto: "Archivo con tus actividades y los vencimientos de tus proyectos, que se importa en Google Calendar, Outlook o Apple Calendar. Es una copia de hoy: si cambian las fechas, vuelve a descargarlo y los eventos se actualizan. La plataforma no se conecta a tu calendario." },
  borrador_correo: { titulo: "Borrador de correo", texto: "Abre un mensaje ya escrito en tu programa de correo. Tú lo revisas y lo envías desde tu cuenta: la plataforma no envía nada. Las invitaciones a varios aliados van en copia oculta (Cco) para que no vean los correos de los demás." },
  sobrecontratado: { titulo: "Sobrecontratado", texto: "Lo contratado (contratos aprobados) para un capítulo o adicional supera su presupuesto con indirectos." },
  gastado: { titulo: "Gastado a la fecha", texto: "Suma del gasto real registrado por mes hasta el mes de corte." },
  gasto_plan: { titulo: "Gasto frente al plan", texto: "Cuánto más o menos se ha gastado frente a lo que la curva S planeaba a esta fecha. Positivo: se ha gastado más de lo planificado." },
  facturado: { titulo: "Facturado (bruto)", texto: "Suma del valor bruto de las actas de pago radicadas del contrato." },
  ejecutado_contrato: { titulo: "Ejecutado del contrato", texto: "Facturado ÷ valor del contrato." },
  saldo_contrato: { titulo: "Saldo por ejecutar", texto: "Valor del contrato − lo facturado." },
  anticipo: { titulo: "Anticipo autorizado", texto: "Pago adelantado, discrecional: lo autoriza el director general según la urgencia o necesidad. Nunca supera el 20 % del contrato." },
  anticipo_pendiente: { titulo: "Anticipo por amortizar", texto: "Parte del anticipo que aún no se ha descontado de las actas de pago." },
  retencion: { titulo: "Retención de garantía", texto: "Porcentaje de cada acta que se retiene como garantía. Se libera al ejecutar el 100 % del contrato." },
  desembolsado: { titulo: "Desembolsado", texto: "Anticipo más lo pagado en las actas (valor neto), más la retención si ya se liberó." },
  avance_reportado: { titulo: "Avance reportado", texto: "El que registra el supervisor de obra tarea por tarea." },
  avance_verificado: { titulo: "Avance verificado", texto: "El que confirma la interventoría. Si existe, es el que usa el valor ganado." },
  avance_diferencia: { titulo: "Diferencia", texto: "Avance reportado − avance verificado, en puntos porcentuales." },
  avance_usado: { titulo: "Avance usado en el valor ganado", texto: "Verificado, si la interventoría ya lo registró; si no, el reportado." },
  planificado_hoy: { titulo: "Planificado a hoy", texto: "Cuánto debería llevar el proyecto hoy según la semana de inicio, la duración y el peso de cada tarea." },
} as const satisfies Record<string, Entrada>;

export type TemaAyuda = keyof typeof GLOSARIO;

// Rótulos de las tarjetas y columnas de la plataforma → tema de ayuda.
const POR_ROTULO: Record<string, TemaAyuda> = {
  "Proyectos activos": "proyectos_activos", "Semáforo": "semaforo",
  "Presupuesto (BAC)": "bac", "Costo real (AC)": "ac", "Cronograma (SPI)": "spi", "Costo (CPI)": "cpi",
  "Desempeño del cronograma (SPI)": "spi", "Desempeño del costo (CPI)": "cpi",
  "Variación del cronograma (SV, COP)": "sv", "Variación del costo (CV, COP)": "cv",
  "Estimación a la conclusión (EAC, COP)": "eac", "Estimación para concluir (ETC, COP)": "etc",
  "Desempeño requerido (TCPI)": "tcpi", "Variación a la conclusión (VAC, COP)": "vac",
  "Avance físico": "avance_fisico", "Avance plan": "avance_plan", "Avance financiero": "avance_financiero", "Avance presup.": "avance_financiero",
  "Avance físico / financiero": "avance_fisico", "Riesgos": "riesgo_puntaje", "Cambios": "cambios_pendientes", "Reportado": "reportado",
  "Nivel": "nivel_cambio", "Costo directo": "costo_directo", "Costo total": "costo_total", "Costos indirectos (A.I.U.)": "aiu", "Etapa": "etapa_contrato", "Proyectado (EAC)": "corte_costos", "Gastado a la fecha": "gastado",
  "Gasto frente al plan": "gasto_plan", "Facturado (bruto)": "facturado", "Ejecutado": "ejecutado_contrato", "Saldo por ejecutar": "saldo_contrato",
  "Anticipo autorizado": "anticipo", "Anticipo por amortizar": "anticipo_pendiente", "Retención acumulada": "retencion", "Desembolsado": "desembolsado",
  "Avance reportado": "avance_reportado", "Avance verificado": "avance_verificado", "Diferencia": "avance_diferencia",
  "Avance usado en el EV": "avance_usado", "Planificado a hoy": "planificado_hoy",
  BAC: "bac", PV: "pv", EV: "ev", AC: "ac", SPI: "spi", CPI: "cpi",
};

// Tema de ayuda de un rótulo (si lo hay).
export const temaDe = (rotulo: string): TemaAyuda | undefined => POR_ROTULO[rotulo];

// Orden y agrupación de los términos en la pantalla «Glosario y guías».
export const CATEGORIAS_GLOSARIO: { titulo: string; temas: TemaAyuda[] }[] = [
  { titulo: "Valor ganado e indicadores", temas: ["bac", "pv", "ev", "ac", "spi", "cpi", "sv", "cv", "eac", "etc", "tcpi", "vac", "avance_fisico", "avance_plan", "avance_financiero", "fecha_corte", "medicion", "calculo_obra"] },
  { titulo: "Semáforo, riesgos y cambios", temas: ["semaforo", "proyectos_activos", "reportado", "riesgo_puntaje", "cambios_pendientes", "nivel_cambio"] },
  { titulo: "Presupuesto y costos", temas: ["linea_base", "costo_directo", "aiu", "adicional_obra", "sobrecontratado", "corte_costos", "costo_total", "gastado", "gasto_plan", "curva_s"] },
  { titulo: "RAIZ, procesos y novedades", temas: ["raiz", "maestro_aliados", "nit_tercero", "tipo_tercero", "doc_contratista", "contratante", "tope_asamblea", "proceso_contratacion", "modalidad_proceso", "presupuesto_referencia", "ronda_oferta", "oferta_habilitada", "puntaje_oferta", "novedad_campo", "novedad_revision", "plantilla_documento", "plantilla_ambito", "campos_combinacion", "calendario_ics", "borrador_correo"] },
  { titulo: "Contratos y pagos", temas: ["facturado", "ejecutado_contrato", "saldo_contrato", "anticipo", "anticipo_pendiente", "retencion", "desembolsado", "etapa_contrato", "semaforo_contrato", "poliza_minimo", "modificacion_firmada"] },
  { titulo: "Cronograma y avance", temas: ["avance_reportado", "avance_verificado", "avance_diferencia", "avance_usado", "planificado_hoy"] },
];
