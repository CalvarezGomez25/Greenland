// Formatos de presentación (Colombia): índices con coma decimal, pesos con punto de miles.

import { formatearPesos } from "../presupuesto/dinero";

export const indice = (n: number | null): string =>
  n === null ? "—" : n.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const porcentaje = (n: number | null): string =>
  n === null ? "—" : `${n.toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`;

// Dinero con 2 decimales guardado como bigint ("centavos") → pesos enteros "1.234.567".
export const centavos = (c: bigint | null): string => (c === null ? "—" : formatearPesos(c * 10_000n));

// Semana ISO (calendario ISO 8601): propuesta del pendiente P4.
export function semanaIso(fechaIso: string): { anio: number; semana: number } {
  const [a, m, d] = fechaIso.split("-").map(Number);
  const f = new Date(Date.UTC(a, m - 1, d));
  const dia = f.getUTCDay() || 7;
  f.setUTCDate(f.getUTCDate() + 4 - dia); // jueves de la semana
  const inicio = new Date(Date.UTC(f.getUTCFullYear(), 0, 1));
  return { anio: f.getUTCFullYear(), semana: Math.ceil(((f.getTime() - inicio.getTime()) / 86400000 + 1) / 7) };
}
