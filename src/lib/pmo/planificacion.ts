// Reglas de planificación: estrategia de stakeholders, score y nivel de riesgos.

export type EstrategiaStakeholder = "gestionar_de_cerca" | "mantener_satisfecho" | "mantener_informado" | "monitorear";

export const ETIQUETA_ESTRATEGIA: Record<EstrategiaStakeholder, string> = {
  gestionar_de_cerca: "Gestionar de cerca",
  mantener_satisfecho: "Mantener satisfecho",
  mantener_informado: "Mantener informado",
  monitorear: "Monitorear",
};

// Cortes del parámetro stakeholder_cortes_estrategia ("16,10,5"): sobre influencia = poder × interés.
// Se sigue la LEYENDA del libro (16 o más: gestionar de cerca; 10 a 15: mantener satisfecho), ya que
// los ejemplos del libro la contradicen (discrepancia D2, resuelta a favor de la leyenda).
export function leerCortes(texto: string | null): [number, number, number] {
  const n = (texto ?? "").split(",").map((x) => Number(x.trim()));
  return n.length === 3 && n.every((x) => Number.isFinite(x) && x > 0) && n[0] > n[1] && n[1] > n[2]
    ? [n[0], n[1], n[2]]
    : [16, 10, 5];
}

export function estrategiaStakeholder(influencia: number, cortes: [number, number, number] = [16, 10, 5]): EstrategiaStakeholder {
  if (influencia >= cortes[0]) return "gestionar_de_cerca";
  if (influencia >= cortes[1]) return "mantener_satisfecho";
  if (influencia >= cortes[2]) return "mantener_informado";
  return "monitorear";
}

export type CortesRiesgo = { critico: number; alto: number; medio: number };
export const CORTES_RIESGO: CortesRiesgo = { critico: 15, alto: 8, medio: 4 };
