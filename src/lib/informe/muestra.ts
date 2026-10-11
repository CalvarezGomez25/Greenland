// Informe de ejemplo con datos FICTICIOS: lo usan las pruebas y la vista previa del diseño.
import type { InformeProyecto } from "./modelo";

export const INFORME_MUESTRA: InformeProyecto = {
  generado: "2026-10-12",
  proyecto: { id: "00000000-0000-4000-8000-000000000001", nombre: "Planta empacadora El Silencio", codigo: "GL-001", cliente: "El Silencio S.A.S.", ubicacion: "Llanogrande, Rionegro", fase: "ejecucion", estado: "activo", inicio: "2026-03-02", duracionMeses: 14, gerente: "Gloria Gerente" },
  semaforo: { general: "rojo", spi: "amarillo", cpi: "verde", riesgos: "rojo", cambios: "amarillo" },
  corteEvm: "2026-10-09",
  spi: 0.91, cpi: 1.02, avanceFisico: 38.4, avancePlan: 42.2, avanceFinanciero: 36.5,
  bac: 18_450_000_000, pv: 7_786_000_000, ev: 7_085_000_000, ac: 6_946_000_000, eac: 18_090_000_000,
  riesgos: {
    activos: 41, criticos: 5, altos: 23, medios: 13, bajos: 0,
    principales: [
      { codigo: "T-01", frente: "Transversal", descripcion: "Frontera de responsabilidad difusa entre la obra ya ejecutada por el contratista anterior y los nuevos contratistas, mientras la reclamación sigue abierta.", nivel: "critico", score: 16, responsable: "Gerencia + Jurídica" },
      { codigo: "F1-01", frente: "F1", descripcion: "Equipos de proceso y de frío (si aplica) definidos tarde.", nivel: "critico", score: 16, responsable: "Gerencia + Operación" },
      { codigo: "F5-01", frente: "F5", descripcion: "Cantidades inciertas de movimiento de tierras.", nivel: "critico", score: 16, responsable: "Gerencia + Topografía" },
      { codigo: "F6-01", frente: "F6", descripcion: "Crecientes durante la construcción de cimentaciones en el cauce.", nivel: "critico", score: 16, responsable: "Gerencia + Contratista" },
      { codigo: "F6-02", frente: "F6", descripcion: "Cierre o afectación de la vía de acceso durante la reconformación.", nivel: "critico", score: 16, responsable: "Gerencia" },
    ],
  },
  cambios: { pendientes: 3, criticos: 0, lista: [
    { codigo: "CC-004", descripcion: "Ampliación del cuarto frío en la bodega principal", estado: "En aprobación", impactoCosto: 184_000_000, nivel: "moderado" },
    { codigo: "CC-005", descripcion: "Cambio de especificación de pisos industriales", estado: "Evaluación técnica y financiera", impactoCosto: 62_000_000, nivel: "menor" },
    { codigo: "CC-006", descripcion: "Redes eléctricas adicionales en el edificio administrativo", estado: "Solicitado", impactoCosto: 41_000_000, nivel: "menor" },
  ] },
  hitos: {
    vencidos: [{ nombre: "Entrega de planos para construcción del Frente 3", fecha: "2026-09-30" }],
    proximos: [{ nombre: "Adjudicación del contrato de la subestación", fecha: "2026-10-23" }, { nombre: "Inicio de cimentaciones del puente", fecha: "2026-11-09" }],
  },
  reporte: { semana: 41, anio: 2026, estado: "amarillo", logros: "Se firmó el acta de estado del Frente 1 con la interventoría y se completó la topografía del Frente 5.", alertas: "Pendiente la factibilidad del operador de red para la subestación; riesgo de retraso en la energización.", decisiones: "Aprobar la adjudicación anticipada del transformador.", },
  decisiones: [
    { tipo: "Riesgo crítico", detalle: "Hay al menos un riesgo crítico activo" },
    { tipo: "Decisión requerida", detalle: "Reporte de la semana 41: Aprobar la adjudicación anticipada del transformador." },
    { tipo: "Hitos vencidos", detalle: "1 sin cumplir (el más antiguo: Entrega de planos para construcción del Frente 3)" },
  ],
};
