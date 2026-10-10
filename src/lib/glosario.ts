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
  costo_total: { titulo: "Costo total", texto: "Costo directo más los costos adicionales del presupuesto." },
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
  "Nivel": "nivel_cambio", "Costo directo": "costo_directo", "Costo total": "costo_total", "Gastado a la fecha": "gastado",
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
  { titulo: "Presupuesto y costos", temas: ["linea_base", "costo_directo", "costo_total", "gastado", "gasto_plan", "curva_s"] },
  { titulo: "Contratos y pagos", temas: ["facturado", "ejecutado_contrato", "saldo_contrato", "anticipo", "anticipo_pendiente", "retencion", "desembolsado"] },
  { titulo: "Cronograma y avance", temas: ["avance_reportado", "avance_verificado", "avance_diferencia", "avance_usado", "planificado_hoy"] },
];
