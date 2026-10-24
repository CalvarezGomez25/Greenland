// Módulos del tablero del proyecto (N1). `disponible` se activa cuando el módulo está construido.

import type { Permisos } from "./permisos";

export type Modulo = {
  clave: string;
  titulo: string;
  corto: string; // nombre breve para el menú lateral
  descripcion: string;
  ruta: string; // relativa a /proyectos/[id]
  area: "gestion" | "obra" | "interventoria";
  disponible: boolean;
  ver: (p: Permisos, usaObra: boolean) => boolean;
};

const general = (p: Permisos) => !p.interventor;

export const MODULOS: Modulo[] = [
  { clave: "actividades", corto: "Actividades", titulo: "Actividades", descripcion: "Trabajo asignado: responsable, fecha límite y estado", ruta: "actividades", area: "gestion", disponible: true, ver: () => true },
  { clave: "acta", corto: "Acta de constitución", titulo: "Ficha y acta de constitución", descripcion: "Propósito, alcance, supuestos y firmas", ruta: "acta", area: "gestion", disponible: true, ver: general },
  { clave: "evm", corto: "Valor ganado", titulo: "Valor ganado", descripcion: "Presupuesto, valor planificado, valor ganado, costo real e índices de desempeño", ruta: "evm", area: "gestion", disponible: true, ver: general },
  { clave: "stakeholders", corto: "Interesados", titulo: "Interesados", descripcion: "Matriz poder-interés y estrategia", ruta: "r/stakeholders", area: "gestion", disponible: true, ver: general },
  { clave: "wbs", corto: "EDT", titulo: "EDT (estructura de desglose del trabajo)", descripcion: "Estructura de entregables", ruta: "r/wbs", area: "gestion", disponible: true, ver: () => true },
  { clave: "riesgos", corto: "Riesgos", titulo: "Riesgos", descripcion: "Registro, puntaje y nivel", ruta: "r/riesgos", area: "gestion", disponible: true, ver: general },
  { clave: "cambios", corto: "Control de cambios", titulo: "Control de cambios", descripcion: "Solicitudes, niveles y aprobación", ruta: "cambios", area: "gestion", disponible: true, ver: () => true },
  { clave: "reportes", corto: "Reporte semanal", titulo: "Reporte semanal e indicadores", descripcion: "Reportes, hitos, reuniones e indicadores de gestión", ruta: "reportes", area: "gestion", disponible: true, ver: general },
  { clave: "documentos", corto: "Documentos", titulo: "Documentos", descripcion: "Planos, contratos, actas e informes", ruta: "documentos", area: "gestion", disponible: true, ver: () => true },
  { clave: "cierre", corto: "Cierre y lecciones", titulo: "Cierre y lecciones aprendidas", descripcion: "Acta de entrega y lecciones", ruta: "cierre", area: "gestion", disponible: true, ver: general },
  { clave: "presupuesto", corto: "Presupuesto", titulo: "Presupuesto y costos", descripcion: "Capítulos, partidas, costos indirectos (A.I.U.), adicionales y gasto", ruta: "presupuesto", area: "obra", disponible: true, ver: (p, o) => o && !p.interventor },
  { clave: "balance", corto: "Balance de costos", titulo: "Balance de costos y contratos", descripcion: "Presupuesto frente a lo contratado y facturado, por capítulo y adicional", ruta: "presupuesto/balance", area: "obra", disponible: true, ver: (p, o) => o && !p.interventor },
  { clave: "controlcostos", corto: "Control de costos", titulo: "Control de costos por cortes", descripcion: "Invertido, por invertir y proyectado, corte a corte", ruta: "control-costos", area: "obra", disponible: true, ver: (p, o) => o && !p.interventor },
  { clave: "cronograma", corto: "Cronograma", titulo: "Cronograma y avance", descripcion: "Gantt, pesos y avance físico", ruta: "cronograma", area: "obra", disponible: true, ver: (_p, o) => o },
  { clave: "contratos", corto: "Contratos y pagos", titulo: "Contratos y pagos", descripcion: "Contratos, anticipo, actas y retención", ruta: "contratos", area: "obra", disponible: true, ver: (_p, o) => o },
  { clave: "bitacora", corto: "Bitácora", titulo: "Bitácora de obra", descripcion: "Registro diario con fotos", ruta: "bitacora", area: "obra", disponible: true, ver: (_p, o) => o },
  { clave: "interventoria", corto: "Interventoría", titulo: "Interventoría", descripcion: "Conceptos, hallazgos, diseños, evaluaciones e informes", ruta: "interventoria", area: "interventoria", disponible: true, ver: () => true },
];

export function modulosVisibles(p: Permisos, usaObra: boolean): Modulo[] {
  return MODULOS.filter((m) => m.disponible && m.ver(p, usaObra));
}
