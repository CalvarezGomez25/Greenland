// Interventoría (especificación, módulo N): catálogos y reglas de sub-rol. La base de datos las vuelve a imponer.

export const SUBROLES: [string, string][] = [
  ["director", "Director de interventoría"], ["tecnico", "Interventor técnico"], ["administrativo", "Interventor administrativo"],
  ["financiero", "Interventor financiero"], ["juridico_contable", "Jurídico o contable"],
];
export const ALCANCES: [string, string][] = [
  ["tecnica", "Técnica"], ["administrativa", "Administrativa"], ["financiera", "Financiera"], ["juridica", "Jurídica"],
  ["contable", "Contable"], ["disenos", "Diseños"], ["asesoria", "Asesoría"],
];
export const TIPOS_CONCEPTO: [string, string][] = [
  ["acta_pago", "Acta de pago"], ["avance", "Avance"], ["cambio", "Cambio"], ["anticipo", "Anticipo y amortización"],
  ["diseno", "Diseño"], ["estudios_previos_pliegos", "Estudios previos o pliegos"], ["otro", "Otro"],
];
export const RESULTADOS: [string, string][] = [["aprobado", "Aprobado"], ["aprobado_con_observaciones", "Aprobado con observaciones"], ["no_aprobado", "No aprobado"]];
export const SEVERIDADES: [string, string][] = [["observacion", "Observación"], ["no_conformidad", "No conformidad"], ["incumplimiento_grave", "Incumplimiento grave"]];
export const ESTADOS_HALLAZGO: [string, string][] = [["abierto", "Abierto"], ["respondido", "Respondido"], ["cerrado", "Cerrado"], ["escalado", "Escalado"]];
export const ESTADOS_REVISION: [string, string][] = [["pendiente", "Pendiente"], ["con_observaciones", "Con observaciones"], ["aprobado", "Aprobado"]];
export const RECOMENDACIONES_PROVEEDOR: [string, string][] = [["recomendar", "Recomendar"], ["con_reservas", "Recomendar con reservas"], ["no_recomendar", "No recomendar"]];
export const TIPOS_ASESORIA: [string, string][] = [["estudio_mercado", "Estudio de mercado"], ["investigacion", "Investigación"], ["estudios_previos_pliegos", "Estudios previos y pliegos"]];
export const TIPOS_INFORME: [string, string][] = [["periodico", "Periódico (uno por cada pago)"], ["especial", "Especial (a solicitud escrita)"], ["sancionatorio", "Para proceso sancionatorio"], ["final", "Final (antes de la liquidación)"]];
export const RECOMENDACIONES_INFORME: [string, string][] = [["aprobar_pago", "Aprobar el pago"], ["aprobar_con_observaciones", "Aprobar con observaciones"], ["no_aprobar", "No aprobar"]];
export const SEVERIDAD_PLAZO_CLAVE: Record<string, string> = { observacion: "plazo_hallazgo_observacion", no_conformidad: "plazo_hallazgo_no_conformidad", incumplimiento_grave: "plazo_hallazgo_incumplimiento_grave" };

export const etiqueta = (lista: [string, string][], v: string | null | undefined) => lista.find(([k]) => k === v)?.[1] ?? "—";

// Qué tipos de concepto puede emitir cada sub-rol (el técnico no conceptúa sobre el anticipo; el financiero no sobre diseños).
const PERMITIDO: Record<string, string[] | "todos"> = {
  director: "todos",
  tecnico: ["acta_pago", "avance", "cambio", "diseno", "estudios_previos_pliegos", "otro"],
  financiero: ["acta_pago", "anticipo", "cambio", "otro"],
  administrativo: ["estudios_previos_pliegos", "otro"],
  juridico_contable: ["cambio", "estudios_previos_pliegos", "otro"],
};
export function conceptoPermitido(subrol: string, tipo: string): boolean {
  const p = PERMITIDO[subrol];
  return p === "todos" ? true : Boolean(p?.includes(tipo));
}

// A qué tipo de registro se refiere cada tipo de concepto.
export const ENTIDAD_DE_CONCEPTO: Record<string, string> = {
  acta_pago: "acta_pago", avance: "tarea", cambio: "cambio", anticipo: "contrato", diseno: "documento", estudios_previos_pliegos: "proyecto", otro: "proyecto",
};

// Decide si un acta puede aprobarse para pago según los últimos conceptos de cada sub-rol (copia de la regla de la base de datos).
export function actaConConceptoFavorable(
  ultimos: { subrol: string; resultado: string }[], // último concepto de cada sub-rol sobre esa acta
  asignados: string[], // sub-roles asignados al contrato
): boolean {
  if (ultimos.some((u) => u.resultado === "no_aprobado")) return false;
  let requeridos = ["tecnico", "financiero"].filter((s) => asignados.includes(s));
  if (requeridos.length === 0) requeridos = ["director"];
  return requeridos.every((s) => {
    const u = ultimos.find((x) => x.subrol === s);
    return Boolean(u && u.resultado !== "no_aprobado");
  });
}
