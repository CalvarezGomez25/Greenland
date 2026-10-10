// Módulos del tablero del proyecto (N1). `disponible` se activa cuando el módulo está construido.

import type { Permisos } from "./permisos";

export type Modulo = {
  clave: string;
  titulo: string;
  descripcion: string;
  ruta: string; // relativa a /proyectos/[id]
  area: "gestion" | "obra" | "interventoria";
  disponible: boolean;
  ver: (p: Permisos, usaObra: boolean) => boolean;
};

const general = (p: Permisos) => !p.interventor;

export const MODULOS: Modulo[] = [
  { clave: "acta", titulo: "Ficha y acta de constitución", descripcion: "Propósito, alcance, supuestos y firmas", ruta: "acta", area: "gestion", disponible: true, ver: general },
  { clave: "evm", titulo: "Valor ganado (EVM)", descripcion: "BAC, PV, EV, AC y los índices SPI, CPI y TCPI", ruta: "evm", area: "gestion", disponible: true, ver: general },
  { clave: "stakeholders", titulo: "Stakeholders", descripcion: "Matriz poder-interés y estrategia", ruta: "r/stakeholders", area: "gestion", disponible: true, ver: general },
  { clave: "wbs", titulo: "WBS (EDT)", descripcion: "Estructura de entregables", ruta: "r/wbs", area: "gestion", disponible: true, ver: () => true },
  { clave: "riesgos", titulo: "Riesgos", descripcion: "Registro, score y nivel", ruta: "r/riesgos", area: "gestion", disponible: true, ver: general },
  { clave: "cambios", titulo: "Control de cambios", descripcion: "Solicitudes, niveles y aprobación", ruta: "cambios", area: "gestion", disponible: true, ver: () => true },
  { clave: "reportes", titulo: "Reporte semanal y KPIs", descripcion: "Reportes, hitos, reuniones y KPIs de gestión", ruta: "reportes", area: "gestion", disponible: true, ver: general },
  { clave: "documentos", titulo: "Documentos", descripcion: "Planos, contratos, actas e informes", ruta: "documentos", area: "gestion", disponible: true, ver: () => true },
  { clave: "cierre", titulo: "Cierre y lecciones aprendidas", descripcion: "Acta de entrega y lecciones", ruta: "cierre", area: "gestion", disponible: true, ver: general },
  { clave: "presupuesto", titulo: "Presupuesto y costos", descripcion: "Capítulos, partidas, costos adicionales y gasto", ruta: "presupuesto", area: "obra", disponible: true, ver: (p, o) => o && !p.interventor },
  { clave: "cronograma", titulo: "Cronograma y avance", descripcion: "Gantt, pesos y avance físico", ruta: "cronograma", area: "obra", disponible: true, ver: (_p, o) => o },
  { clave: "contratos", titulo: "Contratos y pagos", descripcion: "Contratos, anticipo, actas y retención", ruta: "contratos", area: "obra", disponible: true, ver: (_p, o) => o },
  { clave: "bitacora", titulo: "Bitácora de obra", descripcion: "Registro diario con fotos", ruta: "bitacora", area: "obra", disponible: true, ver: (_p, o) => o },
  { clave: "interventoria", titulo: "Interventoría", descripcion: "Conceptos, hallazgos, diseños, evaluaciones e informes", ruta: "interventoria", area: "interventoria", disponible: true, ver: () => true },
];

export function modulosVisibles(p: Permisos, usaObra: boolean): Modulo[] {
  return MODULOS.filter((m) => m.disponible && m.ver(p, usaObra));
}
